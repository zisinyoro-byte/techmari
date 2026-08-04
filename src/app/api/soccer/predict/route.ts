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
import { estimateDispersion } from '@/lib/models/poisson';
import { optimizeDixonColes } from '@/lib/models/dixon-coles-optimizer';
import { calculatePatterns, calculateLeagueInsights } from '@/lib/models/predictions';
import { getCalibration, applyCalibration } from '@/lib/models/calibration-store';
import { initializeThresholds } from '@/lib/models/threshold-init';
import { applyBookieOddsDampener, computeTeamAvgOdds } from '@/lib/betting-filters';

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
    // Ensure persisted thresholds are loaded (lazy, one-time)
    initializeThresholds();

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

    // Phase 2g: Gradient descent on Dixon-Coles parameters
    // When there's sufficient data, optimize attack/defense/home-advantage parameters
    // by minimizing negative log-likelihood. Uses Adam optimizer with momentum.
    let optimizedHomeAdv: number | null = null;
    let optimizedRho: number | null = null;
    let optimizedAttack: Map<string, number> | null = null;
    let optimizedDefense: Map<string, number> | null = null;
    const DC_MIN_MATCHES = 100; // need at least 100 matches for meaningful optimization
    if (allMatches.length >= DC_MIN_MATCHES) {
      try {
        const dcMatches = allMatches.map(m => ({
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          homeGoals: m.ftHomeGoals,
          awayGoals: m.ftAwayGoals,
        }));
        const dcParams = optimizeDixonColes(dcMatches, leagueHomeAvg, leagueAwayAvg, {
          maxIterations: 150,
          learningRate: 0.008,
          verbose: true,
        });
        if (dcParams.converged) {
          optimizedHomeAdv = dcParams.homeAdvantage;
          optimizedRho = dcParams.rho;
          optimizedAttack = dcParams.attack;
          optimizedDefense = dcParams.defense;
          console.log(`[Predict] Dixon-Coles optimized: homeAdv=${optimizedHomeAdv.toFixed(4)}, rho=${optimizedRho.toFixed(4)}, NLL=${dcParams.nll.toFixed(2)}, iterations=${dcParams.iterations}`);
        }
      } catch (dcError) {
        console.warn('[Predict] Dixon-Coles optimization failed (non-fatal):', dcError);
      }
    }

    // Phase 2c: H2H-based lambda adjustment
    // If there are enough H2H matches (≥4), blend base lambdas with H2H-informed lambdas
    const h2hMatches = allMatches.filter(
      m => (m.homeTeam === homeTeam && m.awayTeam === awayTeam) ||
           (m.homeTeam === awayTeam && m.awayTeam === homeTeam)
    );
    const H2H_MIN_SAMPLE = 4;
    const H2H_BLEND_WEIGHT = 0.3; // 30% H2H influence, 70% base model

    // Use optimized home advantage if available, otherwise use bidirectional
    const effectiveHomeAdv = optimizedHomeAdv ?? ha.scoringAdvantage;
    const effectiveRho = optimizedRho ?? (h2hMatches.length >= H2H_MIN_SAMPLE ? 0.05 : 0);

    // Phase 2a: Context-specific lambda calculation using decomposed ratios
    // λ_home = home team's home attack × away team's away defense × league avg
    // Phase 2g: When Dixon-Coles converged, use optimized attack/defense parameters
    //   instead of ratio-based stats for the main lambda calculation
    let lambdaHome: number;
    let lambdaAway: number;
    if (optimizedAttack && optimizedDefense) {
      const dcHomeAttack = optimizedAttack.get(homeTeam) ?? homeStats.homeAttack;
      const dcAwayDefense = optimizedDefense.get(awayTeam) ?? awayStats.awayDefense;
      const dcAwayAttack = optimizedAttack.get(awayTeam) ?? awayStats.awayAttack;
      const dcHomeDefense = optimizedDefense.get(homeTeam) ?? homeStats.homeDefense;
      lambdaHome = dcHomeAttack * dcAwayDefense * leagueHomeAvg * effectiveHomeAdv;
      lambdaAway = dcAwayAttack * dcHomeDefense * leagueAwayAvg;
      console.log(`[Predict] Using DC-optimized params: homeAttack=${dcHomeAttack.toFixed(3)}, awayDefense=${dcAwayDefense.toFixed(3)}, awayAttack=${dcAwayAttack.toFixed(3)}, homeDefense=${dcHomeDefense.toFixed(3)}`);
    } else {
      lambdaHome = homeStats.homeAttack * awayStats.awayDefense * leagueHomeAvg * effectiveHomeAdv;
      lambdaAway = awayStats.awayAttack * homeStats.homeDefense * leagueAwayAvg * ha.defensiveAdvantage;
    }

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

    // Phase 2f: Estimate dispersion from match data for NB distribution
    // If data shows overdispersion, use Negative Binomial instead of Poisson
    const allTotalGoals = allMatches.map(m => m.ftHomeGoals + m.ftAwayGoals);
    const dispersion = estimateDispersion(allTotalGoals);

    // Run Monte Carlo simulation with H2H-adjusted lambdas, NB dispersion, and optimized rho
    const prediction = runMonteCarlo(
      adjustedLambdaHome,
      adjustedLambdaAway,
      100000,
      effectiveRho,
      dispersion
    );

    // Phase 2h: Calibration correction — applied BEFORE dampener so that
    // the calibration ratio (measured against raw model output in backtests)
    // corrects the right baseline. Dampener then adjusts for heavy-favorite dynamics.
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
        over35: applyCalibration(prediction.over35, calData.over35),
      };
      prediction.calibrationSource = {
        testSeason: calData.testSeason,
        matches: calData.matches,
        brierScore: calData.brierScore,
      };

      // Apply calibrated values as the new baseline for dampener
      if (prediction.calibrated) {
        prediction.over25 = prediction.calibrated.over25;
        prediction.over35 = prediction.calibrated.over35;
        prediction.btts = prediction.calibrated.btts;
      }
    }

    // Phase 2i: Bookie odds dampener for heavy favorites
    // Applied AFTER calibration so it adjusts the corrected probabilities.
    const homeAvgOdds = computeTeamAvgOdds(allMatches, homeTeam);
    const awayAvgOdds = computeTeamAvgOdds(allMatches, awayTeam);
    const dampened = applyBookieOddsDampener(
      prediction.over25, prediction.over35, prediction.btts,
      homeAvgOdds, awayAvgOdds,
      leagueHomeAvg + leagueAwayAvg
    );
    if (dampened.dampened) {
      prediction.over25 = dampened.over25;
      prediction.over35 = dampened.over35;
      prediction.btts = dampened.btts;
      // Update calibrated values too if they exist
      if (prediction.calibrated) {
        prediction.calibrated.over25 = dampened.over25;
        prediction.calibrated.over35 = dampened.over35;
        prediction.calibrated.btts = dampened.btts;
      }
      console.log(`[Predict] ${dampened.reason} → O2.5: ${dampened.over25}%, BTTS: ${dampened.btts}%`);
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

    // Rolling 5-game stats — computes per-venue rolling averages from last 5 games
    // Replaces season-level averages for ChecklistInput (adds ~20pp discrimination)
    const sortedMatches = [...allMatches].sort((a, b) => {
      const da = a.date.split('/');
      const db = b.date.split('/');
      return `${da[2] ?? ''}-${da[1] ?? ''}-${da[0] ?? ''}`.localeCompare(`${db[2] ?? ''}-${db[1] ?? ''}-${db[0] ?? ''}`);
    });

    const homeHomeMatches = sortedMatches.filter(m => m.homeTeam === homeTeam).slice(-5);
    const awayAwayMatches = sortedMatches.filter(m => m.awayTeam === awayTeam).slice(-5);
    const homeRollingScored = homeHomeMatches.length > 0
      ? homeHomeMatches.reduce((s, m) => s + m.ftHomeGoals, 0) / homeHomeMatches.length : 0;
    const awayRollingScored = awayAwayMatches.length > 0
      ? awayAwayMatches.reduce((s, m) => s + m.ftAwayGoals, 0) / awayAwayMatches.length : 0;

    // Pattern analysis
    const patternAnalysis = calculatePatterns(allMatches);

    // League insights
    const leagueInsights = calculateLeagueInsights(allMatches, teamStats);

    const response: PredictionResponse = {
      prediction,
      homeTeamStats: homeStats,
      awayTeamStats: awayStats,
      rollingStats: {
        homeRollingScored,
        awayRollingScored,
        rollingCombinedScoring: homeRollingScored + awayRollingScored,
      },
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
