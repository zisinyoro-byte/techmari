import { poissonRandom } from './poisson';
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
 */
export function runMonteCarlo(
  lambdaHome: number,
  lambdaAway: number,
  iterations: number = 100000
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
    homeWin: Math.round(homeWinProb * 10) / 10,
    draw: Math.round(drawProb * 10) / 10,
    awayWin: Math.round(awayWinProb * 10) / 10,
    homeXg: Math.round(lambdaHome * 100) / 100,
    awayXg: Math.round(lambdaAway * 100) / 100,
    likelyScore,
    likelyScoreProb: Math.round((maxCount / iterations) * 1000) / 10,
    over25: Math.round(over25Prob * 10) / 10,
    over35: Math.round(over35Prob * 10) / 10,
    over15: Math.round(over15Prob * 10) / 10,
    over05: Math.round(over05Prob * 10) / 10,
    btts: Math.round(bttsProb * 10) / 10,
    scoreMatrix: sortedScores,
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
    // Implied odds
    impliedOdds: {
      homeWin: calculateImpliedOdds(homeWinProb),
      draw: calculateImpliedOdds(drawProb),
      awayWin: calculateImpliedOdds(awayWinProb),
      over25: calculateImpliedOdds(over25Prob),
      under25: calculateImpliedOdds(100 - over25Prob),
      over35: calculateImpliedOdds(over35Prob),
      under35: calculateImpliedOdds(100 - over35Prob),
      over15: calculateImpliedOdds(over15Prob),
      under15: calculateImpliedOdds(100 - over15Prob),
      over05: calculateImpliedOdds(over05Prob),
      under05: calculateImpliedOdds(100 - over05Prob),
      bttsYes: calculateImpliedOdds(bttsProb),
      bttsNo: calculateImpliedOdds(100 - bttsProb),
      htHomeWin: calculateImpliedOdds(htHomeWinProb),
      htDraw: calculateImpliedOdds(htDrawProb),
      htAwayWin: calculateImpliedOdds(htAwayWinProb),
    },
  };
}
