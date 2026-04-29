import type { MatchResult, TeamStats, PatternAnalysis, LeagueInsights, LeagueAverages } from '@/lib/types';
import { poissonProb } from './poisson';
import { calculateBidirectionalHomeAdvantage } from './home-advantage';
import { calculateSeasonWeights, weightedAverage } from './season-weighting';

/**
 * Calculate implied decimal odds from a probability percentage.
 * Extracted from predict/route.ts line 379.
 */
export function calculateImpliedOdds(probability: number): number {
  if (probability <= 0) return 999;
  if (probability >= 100) return 1;
  return Math.round((100 / probability) * 100) / 100;
}

/**
 * Calculate pattern analysis across league matches.
 * Analyzes BTTS patterns, goal timing, HT/FT transitions, and comebacks.
 * Extracted from predict/route.ts lines 557-646.
 */
export function calculatePatterns(matches: MatchResult[]): PatternAnalysis {
  let bothHalves = 0;
  let firstHalfOnly = 0;
  let secondHalfOnly = 0;
  let neitherHalf = 0;
  let firstHalfGoals = 0;
  let secondHalfGoals = 0;

  // HT/FT transitions
  let htHomeLeadFtHomeWin = 0;
  let htHomeLeadFtDraw = 0;
  let htHomeLeadFtAwayWin = 0;
  let htDrawFtHomeWin = 0;
  let htDrawFtDraw = 0;
  let htDrawFtAwayWin = 0;
  let htAwayLeadFtHomeWin = 0;
  let htAwayLeadFtDraw = 0;
  let htAwayLeadFtAwayWin = 0;

  let comebacks = 0;

  for (const match of matches) {
    const bttsHT = match.htHomeGoals > 0 && match.htAwayGoals > 0;
    const shHomeGoals = match.ftHomeGoals - match.htHomeGoals;
    const shAwayGoals = match.ftAwayGoals - match.htAwayGoals;
    const bttsSH = shHomeGoals > 0 && shAwayGoals > 0;

    if (bttsHT && bttsSH) bothHalves++;
    else if (bttsHT) firstHalfOnly++;
    else if (bttsSH) secondHalfOnly++;
    else neitherHalf++;

    firstHalfGoals += match.htHomeGoals + match.htAwayGoals;
    secondHalfGoals += shHomeGoals + shAwayGoals;

    // HT/FT transitions
    if (match.htResult === 'H') {
      if (match.ftResult === 'H') htHomeLeadFtHomeWin++;
      else if (match.ftResult === 'D') htHomeLeadFtDraw++;
      else htHomeLeadFtAwayWin++;
    } else if (match.htResult === 'D') {
      if (match.ftResult === 'H') htDrawFtHomeWin++;
      else if (match.ftResult === 'D') htDrawFtDraw++;
      else htDrawFtAwayWin++;
    } else {
      if (match.ftResult === 'H') htAwayLeadFtHomeWin++;
      else if (match.ftResult === 'D') htAwayLeadFtDraw++;
      else htAwayLeadFtAwayWin++;
    }

    // Comebacks (HT lead changes to FT opposite)
    if ((match.htResult === 'H' && match.ftResult === 'A') ||
        (match.htResult === 'A' && match.ftResult === 'H')) {
      comebacks++;
    }
  }

  const total = matches.length || 1;

  return {
    bttsPatterns: {
      bothHalves: Math.round((bothHalves / total) * 1000) / 10,
      firstHalfOnly: Math.round((firstHalfOnly / total) * 1000) / 10,
      secondHalfOnly: Math.round((secondHalfOnly / total) * 1000) / 10,
      neitherHalf: Math.round((neitherHalf / total) * 1000) / 10,
    },
    goalTiming: {
      firstHalfGoals,
      secondHalfGoals,
      avgFirstHalfGoals: Math.round((firstHalfGoals / total) * 100) / 100,
      avgSecondHalfGoals: Math.round((secondHalfGoals / total) * 100) / 100,
    },
    resultTransitions: {
      htHomeLeadFtHomeWin: Math.round((htHomeLeadFtHomeWin / total) * 1000) / 10,
      htHomeLeadFtDraw: Math.round((htHomeLeadFtDraw / total) * 1000) / 10,
      htHomeLeadFtAwayWin: Math.round((htHomeLeadFtAwayWin / total) * 1000) / 10,
      htDrawFtHomeWin: Math.round((htDrawFtHomeWin / total) * 1000) / 10,
      htDrawFtDraw: Math.round((htDrawFtDraw / total) * 1000) / 10,
      htDrawFtAwayWin: Math.round((htDrawFtAwayWin / total) * 1000) / 10,
      htAwayLeadFtHomeWin: Math.round((htAwayLeadFtHomeWin / total) * 1000) / 10,
      htAwayLeadFtDraw: Math.round((htAwayLeadFtDraw / total) * 1000) / 10,
      htAwayLeadFtAwayWin: Math.round((htAwayLeadFtAwayWin / total) * 1000) / 10,
    },
    comebackRate: Math.round((comebacks / total) * 1000) / 10,
    scoringStreaks: {
      currentScoringStreak: 0, // Would need match-by-match analysis
      currentConcedingStreak: 0,
    },
  };
}

/**
 * Calculate league-wide aggregate insights from match data and team stats.
 * Extracted from predict/route.ts lines 649-689.
 */
export function calculateLeagueInsights(matches: MatchResult[], teamStats: Map<string, TeamStats>): LeagueInsights {
  const totalGoals = matches.reduce((sum, m) => sum + m.ftHomeGoals + m.ftAwayGoals, 0);
  const homeGoals = matches.reduce((sum, m) => sum + m.ftHomeGoals, 0);
  const awayGoals = matches.reduce((sum, m) => sum + m.ftAwayGoals, 0);
  const homeWins = matches.filter(m => m.ftResult === 'H').length;
  const draws = matches.filter(m => m.ftResult === 'D').length;
  const awayWins = matches.filter(m => m.ftResult === 'A').length;
  const btts = matches.filter(m => m.ftHomeGoals > 0 && m.ftAwayGoals > 0).length;
  const over25 = matches.filter(m => m.ftHomeGoals + m.ftAwayGoals > 2.5).length;

  const total = matches.length || 1;

  // Find best attack/defense
  let bestAttack = { team: '', avg: 0 };
  let bestDefense = { team: '', avg: Infinity };

  for (const [team, stats] of teamStats) {
    if (stats.totalGames >= 5) { // At least 5 games
      if (stats.avgScored > bestAttack.avg) {
        bestAttack = { team, avg: stats.avgScored };
      }
      if (stats.avgConceded < bestDefense.avg) {
        bestDefense = { team, avg: stats.avgConceded };
      }
    }
  }

  return {
    avgGoalsPerGame: Math.round((totalGoals / total) * 100) / 100,
    avgHomeGoals: Math.round((homeGoals / total) * 100) / 100,
    avgAwayGoals: Math.round((awayGoals / total) * 100) / 100,
    homeWinPercent: Math.round((homeWins / total) * 1000) / 10,
    drawPercent: Math.round((draws / total) * 1000) / 10,
    awayWinPercent: Math.round((awayWins / total) * 1000) / 10,
    bttsPercent: Math.round((btts / total) * 1000) / 10,
    over25Percent: Math.round((over25 / total) * 1000) / 10,
    bestAttack,
    bestDefense,
    totalMatches: matches.length,
  };
}

/**
 * Calculate league averages from training data.
 * Used by the backtest prediction model.
 * Extracted from backtest/route.ts lines 205-224.
 */
export function calculateLeagueAverages(results: MatchResult[]): LeagueAverages {
  if (results.length === 0) {
    return { avgHomeGoals: 1.5, avgAwayGoals: 1.2, avgTotalGoals: 2.7, homeWinRate: 0.45, drawRate: 0.25, awayWinRate: 0.30 };
  }

  const totalHomeGoals = results.reduce((sum, m) => sum + m.ftHomeGoals, 0);
  const totalAwayGoals = results.reduce((sum, m) => sum + m.ftAwayGoals, 0);
  const homeWins = results.filter(m => m.ftResult === 'H').length;
  const draws = results.filter(m => m.ftResult === 'D').length;
  const awayWins = results.filter(m => m.ftResult === 'A').length;

  return {
    avgHomeGoals: totalHomeGoals / results.length,
    avgAwayGoals: totalAwayGoals / results.length,
    avgTotalGoals: (totalHomeGoals + totalAwayGoals) / results.length,
    homeWinRate: homeWins / results.length,
    drawRate: draws / results.length,
    awayWinRate: awayWins / results.length,
  };
}

/**
 * Calculate team statistics for a single team from historical data.
 * Supports season-weighted match duplication for recency-weighted predictions.
 * Simplified version used by the backtest prediction model.
 * Extracted from backtest/route.ts lines 168-202.
 */
function calculateBacktestTeamStats(
  results: MatchResult[],
  team: string,
  seasonWeights?: Map<string, number>
) {
  // If season weights are provided, duplicate matches proportionally
  let weightedResults = results;
  if (seasonWeights && seasonWeights.size > 0) {
    weightedResults = [];
    for (const match of results) {
      const weight = seasonWeights.get(match.season) ?? 1;
      // Duplicate matches based on weight (e.g., weight 0.4 → 4 copies, weight 0.1 → 1 copy)
      const copies = Math.max(1, Math.round(weight * 10));
      for (let i = 0; i < copies; i++) {
        weightedResults.push(match);
      }
    }
  }

  const homeGames = weightedResults.filter(m => m.homeTeam === team);
  const awayGames = weightedResults.filter(m => m.awayTeam === team);

  const homeScored = homeGames.reduce((sum, m) => sum + m.ftHomeGoals, 0);
  const homeConceded = homeGames.reduce((sum, m) => sum + m.ftAwayGoals, 0);
  const awayScored = awayGames.reduce((sum, m) => sum + m.ftAwayGoals, 0);
  const awayConceded = awayGames.reduce((sum, m) => sum + m.ftHomeGoals, 0);

  const homeWins = homeGames.filter(m => m.ftResult === 'H').length;
  const awayWins = awayGames.filter(m => m.ftResult === 'A').length;
  const draws = homeGames.filter(m => m.ftResult === 'D').length + awayGames.filter(m => m.ftResult === 'D').length;

  const totalGames = homeGames.length + awayGames.length;

  return {
    homeGames: homeGames.length,
    awayGames: awayGames.length,
    totalGames,
    avgHomeScored: homeGames.length > 0 ? homeScored / homeGames.length : 0,
    avgHomeConceded: homeGames.length > 0 ? homeConceded / homeGames.length : 0,
    avgAwayScored: awayGames.length > 0 ? awayScored / awayGames.length : 0,
    avgAwayConceded: awayGames.length > 0 ? awayConceded / awayGames.length : 0,
    attackStrength: totalGames > 0 ? (homeScored + awayScored) / totalGames : 0,
    defenseStrength: totalGames > 0 ? (homeConceded + awayConceded) / totalGames : 0,
    form: totalGames > 0 ? (homeWins + awayWins + 0.5 * draws) / totalGames : 0.5,
    wins: homeWins + awayWins,
    draws,
    losses: totalGames - homeWins - awayWins - draws,
    bttsRate: totalGames > 0 ?
      [...homeGames, ...awayGames].filter(m => m.ftHomeGoals > 0 && m.ftAwayGoals > 0).length / totalGames : 0.5,
    over25Rate: totalGames > 0 ?
      [...homeGames, ...awayGames].filter(m => m.ftHomeGoals + m.ftAwayGoals > 2.5).length / totalGames : 0.5,
  };
}

/**
 * Generate backtest predictions using Poisson-based model with form adjustment
 * and bidirectional home advantage.
 *
 * @param trainingData  - Historical match results used for team stat calculation
 * @param homeTeam      - Home team name
 * @param awayTeam      - Away team name
 * @param leagueAvgs    - League-wide averages from training data
 * @param seasonWeights - Optional per-season weight map for recency weighting
 */
export function generateBacktestPredictions(
  trainingData: MatchResult[],
  homeTeam: string,
  awayTeam: string,
  leagueAvgs: LeagueAverages,
  seasonWeights?: Map<string, number>
): { homeWin: number; draw: number; awayWin: number; over15: number; over25: number; btts: number; totalXg: number } {

  const homeStats = calculateBacktestTeamStats(trainingData, homeTeam, seasonWeights);
  const awayStats = calculateBacktestTeamStats(trainingData, awayTeam, seasonWeights);

  // Apply bidirectional home advantage to xG calculation
  const ha = calculateBidirectionalHomeAdvantage(
    homeStats.homeGames > 0 ? homeStats.avgHomeScored : leagueAvgs.avgHomeGoals,
    homeStats.homeGames > 0 ? homeStats.avgHomeConceded : leagueAvgs.avgAwayGoals,
    homeStats.awayGames > 0 ? homeStats.avgAwayScored : leagueAvgs.avgAwayGoals,
    homeStats.awayGames > 0 ? homeStats.avgAwayConceded : leagueAvgs.avgHomeGoals,
    leagueAvgs.avgHomeGoals,
    leagueAvgs.avgAwayGoals
  );

  // Phase 2e: Unified multiplicative xG formula (same as predict route)
  // homeXg = homeAttack * awayDefense * leagueHomeAvg * scoringAdvantage
  // awayXg = awayAttack * homeDefense * leagueAwayAvg * defensiveAdvantage
  const homeAttackRatio = leagueAvgs.avgTotalGoals > 0
    ? (homeStats.homeGames > 0 ? homeStats.avgHomeScored : leagueAvgs.avgHomeGoals) / (leagueAvgs.avgTotalGoals / 2)
    : 1;
  const awayDefenseRatio = leagueAvgs.avgTotalGoals > 0
    ? (awayStats.awayGames > 0 ? awayStats.avgAwayConceded : leagueAvgs.avgHomeGoals) / (leagueAvgs.avgTotalGoals / 2)
    : 1;
  const awayAttackRatio = leagueAvgs.avgTotalGoals > 0
    ? (awayStats.awayGames > 0 ? awayStats.avgAwayScored : leagueAvgs.avgAwayGoals) / (leagueAvgs.avgTotalGoals / 2)
    : 1;
  const homeDefenseRatio = leagueAvgs.avgTotalGoals > 0
    ? (homeStats.homeGames > 0 ? homeStats.avgHomeConceded : leagueAvgs.avgAwayGoals) / (leagueAvgs.avgTotalGoals / 2)
    : 1;

  const homeXg = homeAttackRatio * awayDefenseRatio * leagueAvgs.avgHomeGoals * ha.scoringAdvantage;
  const awayXg = awayAttackRatio * homeDefenseRatio * leagueAvgs.avgAwayGoals * ha.defensiveAdvantage;
  const totalXg = homeXg + awayXg;

  // Poisson-based probabilities - iterate over sufficient range (0-7) to capture
  // all likely scorelines, avoiding the truncated approximation that missed 4-6% of probability mass
  let homeWinProb = 0;
  let awayWinProb = 0;
  let drawProbCalc = 0;
  for (let i = 0; i <= 7; i++) {
    for (let j = 0; j <= 7; j++) {
      const p = poissonProb(homeXg, i) * poissonProb(awayXg, j);
      if (i > j) homeWinProb += p;
      else if (j > i) awayWinProb += p;
      else drawProbCalc += p;
    }
  }

  // Adjust probabilities
  let drawProb = 1 - homeWinProb - awayWinProb;

  // Form adjustment
  const formAdjustment = (homeStats.form - awayStats.form) * 0.1;
  const adjustedHomeWin = Math.max(0.1, Math.min(0.8, homeWinProb + formAdjustment));
  const adjustedAwayWin = Math.max(0.1, Math.min(0.8, awayWinProb - formAdjustment));
  drawProb = Math.max(0.15, Math.min(0.4, 1 - adjustedHomeWin - adjustedAwayWin));

  // Normalize
  const total = adjustedHomeWin + drawProb + adjustedAwayWin;
  const finalHomeWin = adjustedHomeWin / total;
  const finalDraw = drawProb / total;
  const finalAwayWin = adjustedAwayWin / total;

  // Goals markets
  const p0 = Math.exp(-totalXg);
  const p1 = totalXg * Math.exp(-totalXg);
  const p2 = (totalXg * totalXg / 2) * Math.exp(-totalXg);
  const over15Prob = 1 - p0 - p1;
  const over25Prob = 1 - p0 - p1 - p2;

  // BTTS
  const homeScoresProb = 1 - Math.exp(-homeXg);
  const awayScoresProb = 1 - Math.exp(-awayXg);
  const bttsProb = homeScoresProb * awayScoresProb;

  return {
    homeWin: Math.round(finalHomeWin * 100),
    draw: Math.round(finalDraw * 100),
    awayWin: Math.round(finalAwayWin * 100),
    over15: Math.round(Math.min(95, Math.max(40, over15Prob * 100))),
    over25: Math.round(Math.min(85, Math.max(35, over25Prob * 100))),
    btts: Math.round(Math.min(80, Math.max(30, bttsProb * 100))),
    totalXg: Math.round(totalXg * 100) / 100,
  };
}
