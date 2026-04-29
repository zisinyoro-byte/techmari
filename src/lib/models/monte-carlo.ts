import { poissonRandom } from './poisson';
import { poissonProb } from './poisson';
import type { PredictionResult } from '@/lib/types';

/**
 * Calculate implied decimal odds from a probability percentage.
 * Extracted from predict/route.ts line 379.
 */
function calculateImpliedOdds(probability: number): number {
  if (probability <= 0) return 999;
  if (probability >= 100) return 1;
  return Math.round((100 / probability) * 100) / 100;
}

/**
 * Run Monte Carlo simulation to generate match predictions.
 * Simulates thousands of matches using Poisson-distributed goal counts.
 * Extracted from predict/route.ts lines 386-554.
 *
 * Phase 2d: Dixon-Coles correction
 *   When rho > 0, adjusts the final scoreline probabilities to correct for
 *   the independent Poissons' underestimation of draws (especially 0-0, 1-1)
 *   and overestimation of narrow wins (0-1, 1-0).
 */
export function runMonteCarlo(
  lambdaHome: number,
  lambdaAway: number,
  iterations: number = 100000,
  rho: number = 0  // Dixon-Coles correlation parameter (0 = independent Poisson, 0.1-0.2 typical)
): PredictionResult {
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let over05Count = 0;
  let over15Count = 0;
  let over25Count = 0;
  let over35Count = 0;
  let bttsCount = 0;

  const scoreCounts = new Map<string, number>();

  // Halftime simulation (typically ~45% of full-time goals)
  const htLambdaHome = lambdaHome * 0.45;
  const htLambdaAway = lambdaAway * 0.45;

  let htHomeWins = 0;
  let htDraws = 0;
  let htAwayWins = 0;
  const htScoreCounts = new Map<string, number>();

  for (let i = 0; i < iterations; i++) {
    // Full-time simulation
    const homeGoals = poissonRandom(lambdaHome);
    const awayGoals = poissonRandom(lambdaAway);

    if (homeGoals > awayGoals) homeWins++;
    else if (awayGoals > homeGoals) awayWins++;
    else draws++;

    const totalGoals = homeGoals + awayGoals;
    if (totalGoals > 0.5) over05Count++;
    if (totalGoals > 1.5) over15Count++;
    if (totalGoals > 2.5) over25Count++;
    if (totalGoals > 3.5) over35Count++;
    if (homeGoals > 0 && awayGoals > 0) bttsCount++;

    const scoreKey = `${homeGoals}-${awayGoals}`;
    scoreCounts.set(scoreKey, (scoreCounts.get(scoreKey) || 0) + 1);

    // Halftime simulation
    const htHomeGoals = poissonRandom(htLambdaHome);
    const htAwayGoals = poissonRandom(htLambdaAway);

    if (htHomeGoals > htAwayGoals) htHomeWins++;
    else if (htAwayGoals > htHomeGoals) htAwayWins++;
    else htDraws++;

    const htScoreKey = `${htHomeGoals}-${htAwayGoals}`;
    htScoreCounts.set(htScoreKey, (htScoreCounts.get(htScoreKey) || 0) + 1);
  }

  // Find most likely full-time score
  let likelyScore = '0-0';
  let maxCount = 0;
  for (const [score, count] of scoreCounts) {
    if (count > maxCount) {
      maxCount = count;
      likelyScore = score;
    }
  }

  // Find most likely halftime score
  let htLikelyScore = '0-0';
  let htMaxCount = 0;
  for (const [score, count] of htScoreCounts) {
    if (count > htMaxCount) {
      htMaxCount = count;
      htLikelyScore = score;
    }
  }

  // Get top scores
  const sortedScores = Array.from(scoreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([score, count]) => ({
      score,
      prob: Math.round((count / iterations) * 1000) / 10,
    }));

  const htSortedScores = Array.from(htScoreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([score, count]) => ({
      score,
      prob: Math.round((count / iterations) * 1000) / 10,
    }));

  // Calculate probabilities
  const homeWinProb = (homeWins / iterations) * 100;
  const drawProb = (draws / iterations) * 100;
  const awayWinProb = (awayWins / iterations) * 100;
  const over05Prob = (over05Count / iterations) * 100;
  const over15Prob = (over15Count / iterations) * 100;
  const over25Prob = (over25Count / iterations) * 100;
  const over35Prob = (over35Count / iterations) * 100;
  const bttsProb = (bttsCount / iterations) * 100;
  const htHomeWinProb = (htHomeWins / iterations) * 100;
  const htDrawProb = (htDraws / iterations) * 100;
  const htAwayWinProb = (htAwayWins / iterations) * 100;

  // Phase 2d: Apply Dixon-Coles correction to scoreline probabilities
  // The Dixon-Coles model adjusts low-scoreline probabilities to account for
  // goal correlation (teams tend to either both score or both not score).
  // This upweights 0-0, 1-1 draws and downweights 0-1, 1-0 narrow wins.
  let adjustedScoreMatrix = sortedScores;
  let adjustedHomeWin = homeWinProb;
  let adjustedDraw = drawProb;
  let adjustedAwayWin = awayWinProb;
  let adjustedBtts = bttsProb;
  let adjustedLikelyScore = likelyScore;
  let adjustedLikelyScoreProb = maxCount / iterations * 100;

  if (rho > 0) {
    adjustedScoreMatrix = applyDixonColesCorrection(sortedScores, lambdaHome, lambdaAway, rho);
    // Recalculate 1X2 from corrected scoreline matrix
    let adjHome = 0, adjDraw = 0, adjAway = 0;
    let adjBttsCount = 0;
    let adjMaxCount = 0;
    let adjTopScore = '0-0';
    for (const entry of adjustedScoreMatrix) {
      const [h, a] = entry.score.split('-').map(Number);
      if (h > a) adjHome += entry.prob;
      else if (a > h) adjAway += entry.prob;
      else adjDraw += entry.prob;
      if (h > 0 && a > 0) adjBttsCount += entry.prob;
      if (entry.prob > adjMaxCount) {
        adjMaxCount = entry.prob;
        adjTopScore = entry.score;
      }
    }
    adjustedHomeWin = adjHome;
    adjustedDraw = adjDraw;
    adjustedAwayWin = adjAway;
    adjustedBtts = adjBttsCount;
    adjustedLikelyScore = adjTopScore;
    adjustedLikelyScoreProb = adjMaxCount;
  }

  // Calculate confidence
  let confidence: 'high' | 'medium' | 'low' = 'low';
  let confidenceReason = '';

  const maxProb = Math.max(homeWinProb, drawProb, awayWinProb);

  if (maxProb > 55) {
    confidence = 'high';
    confidenceReason = maxProb === homeWinProb ? 'Strong home win probability based on statistical analysis' : 'Strong away win probability based on statistical analysis';
  } else if (maxProb > 45) {
    confidence = 'medium';
    confidenceReason = 'Moderate confidence - one outcome has a notable edge';
  } else {
    confidence = 'low';
    confidenceReason = 'Close matchup - outcomes are relatively evenly distributed';
  }

  return {
    homeWin: Math.round(adjustedHomeWin * 10) / 10,
    draw: Math.round(adjustedDraw * 10) / 10,
    awayWin: Math.round(adjustedAwayWin * 10) / 10,
    homeXg: Math.round(lambdaHome * 100) / 100,
    awayXg: Math.round(lambdaAway * 100) / 100,
    likelyScore: adjustedLikelyScore,
    likelyScoreProb: Math.round(adjustedLikelyScoreProb * 10) / 10,
    over25: Math.round(over25Prob * 10) / 10,
    over35: Math.round(over35Prob * 10) / 10,
    over15: Math.round(over15Prob * 10) / 10,
    over05: Math.round(over05Prob * 10) / 10,
    btts: Math.round(adjustedBtts * 10) / 10,
    scoreMatrix: adjustedScoreMatrix,
    confidence,
    confidenceReason,
    // Halftime predictions
    htHomeWin: Math.round(htHomeWinProb * 10) / 10,
    htDraw: Math.round(htDrawProb * 10) / 10,
    htAwayWin: Math.round(htAwayWinProb * 10) / 10,
    htHomeXg: Math.round(htLambdaHome * 100) / 100,
    htAwayXg: Math.round(htLambdaAway * 100) / 100,
    htLikelyScore,
    htLikelyScoreProb: Math.round((htMaxCount / iterations) * 1000) / 10,
    htScoreMatrix: htSortedScores,
    // Implied odds (use adjusted probabilities for 1X2 and BTTS)
    impliedOdds: {
      homeWin: calculateImpliedOdds(adjustedHomeWin),
      draw: calculateImpliedOdds(adjustedDraw),
      awayWin: calculateImpliedOdds(adjustedAwayWin),
      over25: calculateImpliedOdds(over25Prob),
      under25: calculateImpliedOdds(100 - over25Prob),
      over35: calculateImpliedOdds(over35Prob),
      under35: calculateImpliedOdds(100 - over35Prob),
      over15: calculateImpliedOdds(over15Prob),
      under15: calculateImpliedOdds(100 - over15Prob),
      over05: calculateImpliedOdds(over05Prob),
      under05: calculateImpliedOdds(100 - over05Prob),
      bttsYes: calculateImpliedOdds(adjustedBtts),
      bttsNo: calculateImpliedOdds(100 - adjustedBtts),
      htHomeWin: calculateImpliedOdds(htHomeWinProb),
      htDraw: calculateImpliedOdds(htDrawProb),
      htAwayWin: calculateImpliedOdds(htAwayWinProb),
    },
  };
}

/**
 * Phase 2d: Apply Dixon-Coles correction to scoreline probabilities.
 *
 * The Dixon-Coles (1997) model adjusts independent Poisson probabilities for
 * low-scoring scorelines (0-0, 1-0, 0-1, 1-1) to account for the empirical
 * observation that football goals are negatively correlated:
 *   - 0-0 and 1-1 (draws) are MORE likely than independent Poissons predict
 *   - 0-1 and 1-0 (narrow wins) are LESS likely
 *
 * The tau function applies a time-on-psi correction factor that decays
 * exponentially as the total goals in the scoreline increase. For scorelines
 * with total goals >= 3, the correction is negligible.
 *
 * @param scoreMatrix - Top scorelines from Monte Carlo with their raw probabilities
 * @param lambdaHome  - Expected home goals
 * @param lambdaAway  - Expected away goals
 * @param rho         - Correlation parameter (0 = no correction, 0.1-0.2 = typical)
 * @returns Corrected scoreline matrix with probabilities renormalized to ~100%
 */
function applyDixonColesCorrection(
  scoreMatrix: { score: string; prob: number }[],
  lambdaHome: number,
  lambdaAway: number,
  rho: number
): { score: string; prob: number }[] {
  // Dixon-Coles tau function: exponential decay correction
  // Only applies to scorelines where total goals <= 2
  const tau = (x: number, y: number): number => {
    if (x === 0 && y === 0) return 1 - lambdaHome * lambdaAway * rho;
    if (x === 0 && y === 1) return 1 + lambdaHome * rho;
    if (x === 1 && y === 0) return 1 + lambdaAway * rho;
    if (x === 1 && y === 1) return 1 - rho;
    return 1; // No correction for scorelines with 3+ total goals
  };

  // Apply correction to each scoreline
  const corrected = scoreMatrix.map(entry => {
    const [h, a] = entry.score.split('-').map(Number);
    const correction = tau(h, a);
    return {
      score: entry.score,
      prob: entry.prob * correction,
    };
  });

  // Renormalize so probabilities sum to the same total as before
  const originalTotal = scoreMatrix.reduce((sum, e) => sum + e.prob, 0);
  const correctedTotal = corrected.reduce((sum, e) => sum + e.prob, 0);

  if (correctedTotal > 0) {
    const scale = originalTotal / correctedTotal;
    for (const entry of corrected) {
      entry.prob = Math.round(entry.prob * scale * 10) / 10;
    }
  }

  // Re-sort by probability (corrections may change the ranking)
  corrected.sort((a, b) => b.prob - a.prob);

  return corrected;
}
