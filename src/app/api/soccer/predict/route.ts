import { NextRequest, NextResponse } from 'next/server';
import { fetchSeasonData } from '@/lib/data-cache';
import type {
  TeamStats,
  PredictionResponse,
} from '@/lib/types';
import { ALL_SEASONS } from '@/lib/constants';
import { calculateSeasonWeights, weightedAverage } from '@/lib/models/season-weighting';
import { calculateBidirectionalHomeAdvantage } from '@/lib/models/home-advantage';
import { calculateTeamStats } from '@/lib/models/team-stats';
import { runMonteCarlo } from '@/lib/models/monte-carlo';
import { calculatePatterns, calculateLeagueInsights } from '@/lib/models/predictions';
import { getCalibration, applyCalibration } from '@/lib/models/calibration-store';

// ---------------------------------------------------------------------------
// combineWeightedTeamStats – merge per-season TeamStats using exponential weights
// ---------------------------------------------------------------------------

interface SeasonStatsEntry {
  season: string;
  weight: number;
  stats: Map<string, TeamStats>;
}

function combineWeightedTeamStats(entries: SeasonStatsEntry[]): Map<string, TeamStats> {
  const combined = new Map<string, TeamStats>();

  // Sort entries by season descending so the most recent season is first
  const sorted = [...entries].sort((a, b) => b.season.localeCompare(a.season));

  // Collect all teams across all seasons
  const allTeams = new Set<string>();
  for (const entry of entries) {
    for (const team of entry.stats.keys()) {
      allTeams.add(team);
    }
  }

  for (const team of allTeams) {
    // Find entries where this team has stats
    const teamEntries = entries
      .filter(e => e.stats.has(team))
      .sort((a, b) => b.season.localeCompare(a.season)); // most recent first

    if (teamEntries.length === 0) continue;

    // For form/recent data, use the most recent season's data
    const mostRecentStats = teamEntries[0].stats.get(team)!;

    // Weighted numeric fields
    const avgScored = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.avgScored,
    })));
    const avgConceded = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.avgConceded,
    })));
    const attack = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.attack,
    })));
    const defense = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.defense,
    })));
    // Phase 2a: decomposed home/away attack/defense ratios
    const homeAttack = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.homeAttack,
    })));
    const awayAttack = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.awayAttack,
    })));
    const homeDefense = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.homeDefense,
    })));
    const awayDefense = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.awayDefense,
    })));
    const homeScored = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.homeScored,
    })));
    const homeConceded = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.homeConceded,
    })));
    const awayScored = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.awayScored,
    })));
    const awayConceded = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.awayConceded,
    })));
    const homeAdvantage = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.homeAdvantage,
    })));

    // Aggregate counts (weighted sum)
    const totalGames = Math.round(weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.totalGames,
    }))));
    const homeGames = Math.round(weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.homeGames,
    }))));
    const awayGames = Math.round(weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.awayGames,
    }))));

    // Use the most recent season for form data (non-weightable)
    combined.set(team, {
      attack: attack || 1,
      defense: defense || 1,
      homeAttack: homeAttack || 1,
      awayAttack: awayAttack || 1,
      homeDefense: homeDefense || 1,
      awayDefense: awayDefense || 1,
      homeAdvantage: Math.min(Math.max(homeAdvantage, 0.8), 1.3),
      avgScored,
      avgConceded,
      homeScored,
      homeConceded,
      awayScored,
      awayConceded,
      homeGames,
      awayGames,
      totalGames,
      wins: mostRecentStats.wins,
      draws: mostRecentStats.draws,
      losses: mostRecentStats.losses,
      recentForm: mostRecentStats.recentForm,
      recentGoalsScored: mostRecentStats.recentGoalsScored,
      recentGoalsConceded: mostRecentStats.recentGoalsConceded,
      bttsFullTime: mostRecentStats.bttsFullTime,
      bttsFirstHalf: mostRecentStats.bttsFirstHalf,
      bttsSecondHalf: mostRecentStats.bttsSecondHalf,
      over25: mostRecentStats.over25,
      over35: mostRecentStats.over35,
    });
  }

  return combined;
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const league = searchParams.get('league');
  const season = searchParams.get('season');
  const homeTeam = searchParams.get('homeTeam');
  const awayTeam = searchParams.get('awayTeam');

  if (!league || !season) {
    return NextResponse.json(
      { error: 'Missing required parameters: league and season' },
      { status: 400 }
    );
  }

  if (!homeTeam || !awayTeam) {
    return NextResponse.json(
      { error: 'Missing required parameters: homeTeam and awayTeam' },
      { status: 400 }
    );
  }

  if (homeTeam === awayTeam) {
    return NextResponse.json(
      { error: 'Home team and away team must be different' },
      { status: 400 }
    );
  }

  try {
    // Fetch match data — with season weighting when season === 'all'
    let allMatches: typeof import('@/lib/types').MatchResult[];
    let teamStats: Map<string, TeamStats>;

    if (season === 'all') {
      // Fetch each season separately
      const seasonPromises = ALL_SEASONS.map(s => fetchSeasonData(league, s));
      const seasonResults = await Promise.all(seasonPromises);

      // Calculate season weights (exponential decay)
      const seasonWeights = calculateSeasonWeights(ALL_SEASONS);

      // Compute team stats per season
      const seasonTeamStats: SeasonStatsEntry[] = seasonResults.map((matches, i) => ({
        season: ALL_SEASONS[i],
        weight: seasonWeights.get(ALL_SEASONS[i]) || 0,
        stats: calculateTeamStats(matches),
      }));

      // Combine into weighted team stats
      teamStats = combineWeightedTeamStats(seasonTeamStats);
      allMatches = seasonResults.flat();
    } else {
      allMatches = await fetchSeasonData(league, season);
      teamStats = calculateTeamStats(allMatches);
    }

    if (allMatches.length === 0) {
      return NextResponse.json(
        { error: 'No match data available for the selected league and season' },
        { status: 404 }
      );
    }

    const homeStats = teamStats.get(homeTeam);
    const awayStats = teamStats.get(awayTeam);

    if (!homeStats || !awayStats) {
      return NextResponse.json(
        { error: `Team not found: ${!homeStats ? homeTeam : awayTeam}` },
        { status: 404 }
      );
    }

    // Calculate league averages for xG calculation
    const leagueHomeAvg = allMatches.reduce((sum, m) => sum + m.ftHomeGoals, 0) / allMatches.length;
    const leagueAwayAvg = allMatches.reduce((sum, m) => sum + m.ftAwayGoals, 0) / allMatches.length;

    // Calculate bidirectional home advantage for this specific matchup
    const ha = calculateBidirectionalHomeAdvantage(
      homeStats.homeScored,
      homeStats.homeConceded,
      homeStats.awayScored,
      homeStats.awayConceded,
      leagueHomeAvg,
      leagueAwayAvg
    );

    // Phase 2a: Context-specific lambda calculation using decomposed ratios
    // λ_home = home team's home attack × away team's away defense × league avg
    // This is more accurate than using overall attack/defense because it accounts for
    // the fact that teams perform differently at home vs away
    const lambdaHome = homeStats.homeAttack * awayStats.awayDefense * leagueHomeAvg * ha.scoringAdvantage;
    const lambdaAway = awayStats.awayAttack * homeStats.homeDefense * leagueAwayAvg * ha.defensiveAdvantage;

    // Phase 2c: H2H-based lambda adjustment
    // If there are enough H2H matches (≥4), blend base lambdas with H2H-informed lambdas
    const h2hMatches = allMatches.filter(
      m => (m.homeTeam === homeTeam && m.awayTeam === awayTeam) ||
           (m.homeTeam === awayTeam && m.awayTeam === homeTeam)
    );
    const H2H_MIN_SAMPLE = 4;
    const H2H_BLEND_WEIGHT = 0.3; // 30% H2H influence, 70% base model

    let adjustedLambdaHome = lambdaHome;
    let adjustedLambdaAway = lambdaAway;

    if (h2hMatches.length >= H2H_MIN_SAMPLE) {
      // Calculate H2H-based expected goals for both teams
      const h2hAvgHomeGoals = h2hMatches.reduce((sum, m) => sum + (m.homeTeam === homeTeam ? m.ftHomeGoals : m.ftAwayGoals), 0) / h2hMatches.length;
      const h2hAvgAwayGoals = h2hMatches.reduce((sum, m) => sum + (m.homeTeam === awayTeam ? m.ftHomeGoals : m.ftAwayGoals), 0) / h2hMatches.length;

      // Blend base lambdas with H2H-informed lambdas
      adjustedLambdaHome = lambdaHome * (1 - H2H_BLEND_WEIGHT) + h2hAvgHomeGoals * H2H_BLEND_WEIGHT;
      adjustedLambdaAway = lambdaAway * (1 - H2H_BLEND_WEIGHT) + h2hAvgAwayGoals * H2H_BLEND_WEIGHT;
    }

    // Run Monte Carlo simulation with H2H-adjusted lambdas
    const prediction = runMonteCarlo(adjustedLambdaHome, adjustedLambdaAway, 100000, h2hMatches.length >= H2H_MIN_SAMPLE ? 0.1 : 0);

    // Apply calibration correction if backtest data is available for this league
    const calData = getCalibration(league);
    if (calData) {
      // Normalize 1X2 calibrated probs so they sum to ~100
      const rawH = applyCalibration(prediction.homeWin, calData.homeWin);
      const rawD = applyCalibration(prediction.draw, calData.draw);
      const rawA = applyCalibration(prediction.awayWin, calData.awayWin);
      const total1X2 = rawH + rawD + rawA;

      prediction.calibrated = {
        homeWin: Math.round((rawH / total1X2) * 100 * 10) / 10,
        draw: Math.round((rawD / total1X2) * 100 * 10) / 10,
        awayWin: Math.round((rawA / total1X2) * 100 * 10) / 10,
        over25: applyCalibration(prediction.over25, calData.over25),
        over15: applyCalibration(prediction.over15, calData.over15),
        btts: applyCalibration(prediction.btts, calData.bttsYes),
        over35: applyCalibration(prediction.over35, calData.over25), // use O2.5 ratio as proxy
      };
      prediction.calibrationSource = {
        testSeason: calData.testSeason,
        matches: calData.matches,
        brierScore: calData.brierScore,
      };
    }

    // H2H stats (reuse h2hMatches from above)

    let homeTeamWins = 0;
    let draws = 0;
    let awayTeamWins = 0;

    for (const m of h2hMatches) {
      if (m.ftResult === 'D') {
        draws++;
      } else if (m.homeTeam === homeTeam) {
        if (m.ftResult === 'H') homeTeamWins++;
        else awayTeamWins++;
      } else {
        if (m.ftResult === 'A') homeTeamWins++;
        else awayTeamWins++;
      }
    }

    const h2hStats = {
      totalMatches: h2hMatches.length,
      homeTeamWins,
      draws,
      awayTeamWins,
      avgGoals: h2hMatches.length > 0
        ? Math.round((h2hMatches.reduce((sum, m) => sum + m.ftHomeGoals + m.ftAwayGoals, 0) / h2hMatches.length) * 100) / 100
        : 0,
    };

    // Pattern analysis
    const patternAnalysis = calculatePatterns(allMatches);

    // League insights
    const leagueInsights = calculateLeagueInsights(allMatches, teamStats);

    const response: PredictionResponse = {
      prediction,
      homeTeamStats: homeStats,
      awayTeamStats: awayStats,
      h2hStats,
      patternAnalysis,
      leagueInsights,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error generating prediction:', error);
    return NextResponse.json(
      { error: 'Failed to generate prediction' },
      { status: 500 }
    );
  }
}
