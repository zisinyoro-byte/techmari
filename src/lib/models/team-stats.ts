import type { MatchResult, TeamStats } from '@/lib/types';
import { calculateBidirectionalHomeAdvantage } from './home-advantage';

// Within-season recency: exponential decay factor for match recency
// More recent matches get higher weight. 0.92^n where n = matches ago.
const WITHIN_SEASON_DECAY = 0.92;
// Maximum number of recent matches to consider for recency weighting
const MAX_RECENCY_WINDOW = 20;

/**
 * Calculate comprehensive team statistics from match results.
 * Computes attack/defense strength (overall + home/away decomposed),
 * bidirectional home advantage, form, BTTS, and over/under stats per team.
 *
 * Phase 2 additions:
 *   - homeAttack / awayAttack / homeDefense / awayDefense decomposed ratios
 *   - Within-season recency weighting (exponential decay for recent matches)
 */
export function calculateTeamStats(matches: MatchResult[]): Map<string, TeamStats> {
  const teams = new Map<string, TeamStats>();

  if (matches.length === 0) return teams;

  // Calculate league averages
  const leagueHomeGoals = matches.reduce((sum, m) => sum + m.ftHomeGoals, 0) / matches.length;
  const leagueAwayGoals = matches.reduce((sum, m) => sum + m.ftAwayGoals, 0) / matches.length;
  const leagueAvgGoals = leagueHomeGoals + leagueAwayGoals;

  // Sort matches by date (ascending) for recency weighting
  const sortedMatches = [...matches].sort((a, b) => parseMatchDate(a.date) - parseMatchDate(b.date));

  // Initialize team data with weighted accumulators
  const teamData = new Map<string, {
    // Raw counts (unweighted, for games played)
    homeGames: number;
    awayGames: number;
    wins: number;
    draws: number;
    losses: number;
    bttsFullTime: number;
    bttsFirstHalf: number;
    bttsSecondHalf: number;
    over25: number;
    over35: number;
    form: { result: 'W' | 'D' | 'L'; gf: number; ga: number; date: string }[];
    // Weighted accumulators for recency-weighted averages
    weightedHomeScored: number;
    weightedHomeConceded: number;
    weightedAwayScored: number;
    weightedAwayConceded: number;
    weightedHomeWeight: number;
    weightedAwayWeight: number;
  }>();

  for (const match of sortedMatches) {
    // Initialize teams if needed
    if (!teamData.has(match.homeTeam)) {
      teamData.set(match.homeTeam, {
        homeGames: 0, awayGames: 0,
        wins: 0, draws: 0, losses: 0,
        form: [],
        bttsFullTime: 0, bttsFirstHalf: 0, bttsSecondHalf: 0,
        over25: 0, over35: 0,
        weightedHomeScored: 0, weightedHomeConceded: 0,
        weightedAwayScored: 0, weightedAwayConceded: 0,
        weightedHomeWeight: 0, weightedAwayWeight: 0,
      });
    }
    if (!teamData.has(match.awayTeam)) {
      teamData.set(match.awayTeam, {
        homeGames: 0, awayGames: 0,
        wins: 0, draws: 0, losses: 0,
        form: [],
        bttsFullTime: 0, bttsFirstHalf: 0, bttsSecondHalf: 0,
        over25: 0, over35: 0,
        weightedHomeScored: 0, weightedHomeConceded: 0,
        weightedAwayScored: 0, weightedAwayConceded: 0,
        weightedHomeWeight: 0, weightedAwayWeight: 0,
      });
    }

    const homeData = teamData.get(match.homeTeam)!;
    const awayData = teamData.get(match.awayTeam)!;

    // Within-season recency weight
    // Recent matches (higher index in sorted array) get higher weight
    const matchIndex = sortedMatches.indexOf(match);
    const matchesFromEnd = sortedMatches.length - 1 - matchIndex;
    const recencyWeight = Math.pow(WITHIN_SEASON_DECAY, Math.min(matchesFromEnd, MAX_RECENCY_WINDOW));

    // Raw counts (unweighted)
    homeData.homeGames++;
    awayData.awayGames++;

    // Weighted goal accumulators for home team
    homeData.weightedHomeScored += match.ftHomeGoals * recencyWeight;
    homeData.weightedHomeConceded += match.ftAwayGoals * recencyWeight;
    homeData.weightedHomeWeight += recencyWeight;

    // Weighted goal accumulators for away team
    awayData.weightedAwayScored += match.ftAwayGoals * recencyWeight;
    awayData.weightedAwayConceded += match.ftHomeGoals * recencyWeight;
    awayData.weightedAwayWeight += recencyWeight;

    // Results
    if (match.ftResult === 'H') {
      homeData.wins++;
      awayData.losses++;
      homeData.form.push({ result: 'W', gf: match.ftHomeGoals, ga: match.ftAwayGoals, date: match.date });
      awayData.form.push({ result: 'L', gf: match.ftAwayGoals, ga: match.ftHomeGoals, date: match.date });
    } else if (match.ftResult === 'A') {
      awayData.wins++;
      homeData.losses++;
      homeData.form.push({ result: 'L', gf: match.ftHomeGoals, ga: match.ftAwayGoals, date: match.date });
      awayData.form.push({ result: 'W', gf: match.ftAwayGoals, ga: match.ftHomeGoals, date: match.date });
    } else {
      homeData.draws++;
      awayData.draws++;
      homeData.form.push({ result: 'D', gf: match.ftHomeGoals, ga: match.ftAwayGoals, date: match.date });
      awayData.form.push({ result: 'D', gf: match.ftAwayGoals, ga: match.ftHomeGoals, date: match.date });
    }

    // BTTS patterns
    const bttsHT = match.htHomeGoals > 0 && match.htAwayGoals > 0;
    const shHomeGoals = match.ftHomeGoals - match.htHomeGoals;
    const shAwayGoals = match.ftAwayGoals - match.htAwayGoals;
    const bttsSH = shHomeGoals > 0 && shAwayGoals > 0;
    const totalGoals = match.ftHomeGoals + match.ftAwayGoals;

    if (match.ftHomeGoals > 0 && match.ftAwayGoals > 0) {
      homeData.bttsFullTime++;
      awayData.bttsFullTime++;
    }
    if (bttsHT) {
      homeData.bttsFirstHalf++;
      awayData.bttsFirstHalf++;
    }
    if (bttsSH) {
      homeData.bttsSecondHalf++;
      awayData.bttsSecondHalf++;
    }

    if (totalGoals > 2.5) {
      homeData.over25++;
      awayData.over25++;
    }
    if (totalGoals > 3.5) {
      homeData.over35++;
      awayData.over35++;
    }
  }

  // Calculate final stats for each team
  for (const [team, data] of teamData) {
    const totalGames = data.homeGames + data.awayGames;

    // Recency-weighted home/away averages (more weight on recent matches)
    const homeScored = data.weightedHomeWeight > 0 ? data.weightedHomeScored / data.weightedHomeWeight : 0;
    const homeConceded = data.weightedHomeWeight > 0 ? data.weightedHomeConceded / data.weightedHomeWeight : 0;
    const awayScored = data.weightedAwayWeight > 0 ? data.weightedAwayScored / data.weightedAwayWeight : 0;
    const awayConceded = data.weightedAwayWeight > 0 ? data.weightedAwayConceded / data.weightedAwayWeight : 0;

    const totalGoalsScored = data.weightedHomeScored + data.weightedAwayScored;
    const totalGoalsConceded = data.weightedHomeConceded + data.weightedAwayConceded;
    const totalWeight = data.weightedHomeWeight + data.weightedAwayWeight;

    const avgScored = totalWeight > 0 ? totalGoalsScored / totalWeight : 0;
    const avgConceded = totalWeight > 0 ? totalGoalsConceded / totalWeight : 0;

    // Overall attack/defense strength (relative to league avg per team)
    const attack = avgScored / (leagueAvgGoals / 2);
    const defense = avgConceded / (leagueAvgGoals / 2);

    // Phase 2a: Decomposed attack/defense ratios
    // homeAttack = how much the team scores at home relative to league avg home goals
    // awayAttack = how much the team scores away relative to league avg away goals
    // homeDefense = how much the team concedes at home relative to league avg away goals
    // awayDefense = how much the team concedes away relative to league avg home goals
    const homeAttack = leagueHomeGoals > 0 ? homeScored / leagueHomeGoals : 1;
    const awayAttack = leagueAwayGoals > 0 ? awayScored / leagueAwayGoals : 1;
    const homeDefense = leagueAwayGoals > 0 ? homeConceded / leagueAwayGoals : 1;
    const awayDefense = leagueHomeGoals > 0 ? awayConceded / leagueHomeGoals : 1;

    // Bidirectional home advantage calculation
    const ha = calculateBidirectionalHomeAdvantage(
      homeScored,
      homeConceded,
      awayScored,
      awayConceded,
      leagueHomeGoals,
      leagueAwayGoals
    );
    const homeAdvantage = ha.overallAdvantage;

    // Recent form (last 5 matches by date)
    const sortedForm = data.form.sort((a, b) => parseMatchDate(b.date) - parseMatchDate(a.date)).slice(0, 5);
    const recentForm = sortedForm.map(f => f.result);
    const recentGoalsScored = sortedForm.reduce((sum, f) => sum + f.gf, 0);
    const recentGoalsConceded = sortedForm.reduce((sum, f) => sum + f.ga, 0);

    teams.set(team, {
      attack: attack || 1,
      defense: defense || 1,
      homeAttack: homeAttack || 1,
      awayAttack: awayAttack || 1,
      homeDefense: homeDefense || 1,
      awayDefense: awayDefense || 1,
      homeAdvantage,
      avgScored,
      avgConceded,
      homeScored,
      homeConceded,
      awayScored,
      awayConceded,
      homeGames: data.homeGames,
      awayGames: data.awayGames,
      totalGames,
      wins: data.wins,
      draws: data.draws,
      losses: data.losses,
      recentForm,
      recentGoalsScored,
      recentGoalsConceded,
      bttsFullTime: data.bttsFullTime,
      bttsFirstHalf: data.bttsFirstHalf,
      bttsSecondHalf: data.bttsSecondHalf,
      over25: data.over25,
      over35: data.over35,
    });
  }

  return teams;
}

/**
 * Parse match date string (DD/MM/YYYY or ISO format) to timestamp.
 */
function parseMatchDate(dateStr: string): number {
  if (!dateStr) return 0;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    let y = parseInt(parts[2]);
    if (y < 100) y += y < 50 ? 2000 : 1900;
    return new Date(y, parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
  }
  return new Date(dateStr).getTime();
}
