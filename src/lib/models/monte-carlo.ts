import { poissonRandom, goalRandom } from './poisson';
import type { PredictionResult } from '@/lib/types';
import { getLeagueTuning } from './league-configs';

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
 * Simulates thousands of matches using Poisson or Negative Binomial distributed goal counts.
 *
 * Phase 2d: Dixon-Coles correction
 *   When rho > 0, adjusts the final scoreline probabilities to correct for
 *   the independent Poissons' underestimation of draws (especially 0-0, 1-1)
 *   and overestimation of narrow wins (0-1, 1-0).
 *
 * Phase 2f: Negative Binomial distribution
 *   When dispersion < Infinity, uses NB distribution instead of Poisson.
 *   NB handles overdispersion better (variance > mean), which is typical in
 *   football where strong teams can run up high scores against weak ones.
 *   Falls back to Poisson when dispersion is Infinity or > 100.
 *
 * Item 1 (BTTS Jensen-gap): bttsJensenCorrection is now a per-league
 *   parameter (was hard-coded 0.55). 0 disables the correction entirely.
 *
 * Item 3 (HT lambda ratio): htFtRatio replaces the hard-coded 0.45.
 *   Caller can pass a matchup-specific value (e.g. from
 *   `estimateMatchupHtFtRatio`); otherwise falls back to league default.
 *
 * @param lambdaHome  - Expected home goals
 * @param lambdaAway  - Expected away goals
 * @param iterations  - Number of Monte Carlo simulations (default 100,000)
 * @param rho         - Dixon-Coles correlation parameter (0 = no correction)
 * @param dispersion  - NB dispersion parameter r (Infinity = Poisson fallback)
 * @param options     - Optional tuning: bttsJensenCorrection, htFtRatio, league
 */
export function runMonteCarlo(
  lambdaHome: number,
  lambdaAway: number,
  iterations: number = 100000,
  rho: number = 0,
  dispersion: number = Infinity,
  options: {
    /** Per-league BTTS Jensen correction scaling factor (default: 0.55 = old behavior).
     *  Set to 0 to disable the Jensen-gap correction entirely. */
    bttsJensenCorrection?: number;
    /** Halftime/full-time goal ratio (default: 0.45 = old behavior).
     *  Pass a matchup-specific value from estimateMatchupHtFtRatio for better HT predictions. */
    htFtRatio?: number;
    /** League code (used for default tuning lookup if specific values not provided) */
    league?: string;
  } = {},
): PredictionResult {
  // Resolve tuning: explicit parameter > league-specific default > old hardcoded value
  const leagueTuning = options.league ? getLeagueTuning(options.league) : null;
  const bttsJensenCorrection = options.bttsJensenCorrection ??
    leagueTuning?.bttsJensenCorrection ??
    0.55;
  const htFtRatio = options.htFtRatio ??
    leagueTuning?.htFtRatio ??
    0.45;

  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let over05Count = 0;
  let over15Count = 0;
  let over25Count = 0;
  let over35Count = 0;
  let bttsCount = 0;

  const scoreCounts = new Map<string, number>();

  // Halftime simulation — ratio now configurable per league/matchup (Item 3)
  const htLambdaHome = lambdaHome * htFtRatio;
  const htLambdaAway = lambdaAway * htFtRatio;

  let htHomeWins = 0;
  let htDraws = 0;
  let htAwayWins = 0;
  const htScoreCounts = new Map<string, number>();

  const useNB = isFinite(dispersion) && dispersion <= 100;

  for (let i = 0; i < iterations; i++) {
    // Full-time simulation
    // Phase 2f: Use NB when dispersion is finite, Poisson otherwise
    const homeGoals = useNB ? goalRandom(lambdaHome, dispersion) : poissonRandom(lambdaHome);
    const awayGoals = useNB ? goalRandom(lambdaAway, dispersion) : poissonRandom(lambdaAway);

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
    const htHomeGoals = useNB ? goalRandom(htLambdaHome, dispersion) : poissonRandom(htLambdaHome);
    const htAwayGoals = useNB ? goalRandom(htLambdaAway, dispersion) : poissonRandom(htLambdaAway);

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
    // Recalculate 1X2 from corrected scoreline matrix (top-10 only)
    // then rescale to 100% to account for the ~24% probability mass
    // not captured in the top-10 scorelines.
    let adjHome = 0, adjDraw = 0, adjAway = 0;
    let adjMaxCount = 0;
    let adjTopScore = '0-0';
    for (const entry of adjustedScoreMatrix) {
      const [h, a] = entry.score.split('-').map(Number);
      if (h > a) adjHome += entry.prob;
      else if (a > h) adjAway += entry.prob;
      else adjDraw += entry.prob;
      if (entry.prob > adjMaxCount) {
        adjMaxCount = entry.prob;
        adjTopScore = entry.score;
      }
    }
    // Rescale 1X2 to sum to 100% (top-10 only covers ~76% of mass)
    const adjTotal = adjHome + adjDraw + adjAway;
    if (adjTotal > 0 && adjTotal < 0.95) {
      const scale = 1 / adjTotal;
      adjHome *= scale;
      adjDraw *= scale;
      adjAway *= scale;
    }
    adjustedHomeWin = adjHome;
    adjustedDraw = adjDraw;
    adjustedAwayWin = adjAway;
    adjustedLikelyScore = adjTopScore;
    adjustedLikelyScoreProb = adjMaxCount;

    // BTTS correction: use the full 100K-simulation BTTS (not the top-10
    // scoreline matrix) and apply Dixon-Coles analytically.
    // The DC tau adjustment reduces P(0-0), which increases BTTS.
    // P(BTTS) = 1 - P(home=0) - P(away=0) + P(0-0)
    // ΔP(0-0) = -P(0-0) × λH × λA × ρ  (P(0-0) decreases when ρ > 0)
    // ΔP(1-1) = -P(1-1) × ρ  (P(1-1) also decreases when ρ > 0)
    // Net BTTS change from DC: the corrected matrix increases P(0-0) reduction
    // but also increases P(0-1) and P(1-0) (one team blanks). The net effect on
    // BTTS = 1 - P(home=0) - P(away=0) + P(0-0) is negative when rho > 0:
    //   Delta BTTS = -rho * [P(0-0)*lambdaH*lambdaA + P(1-1)]
    // P(0-0) decreases (good for BTTS) but P(home=0) and P(away=0) increase more.
    const pHome0 = Math.exp(-lambdaHome);
    const pAway0 = Math.exp(-lambdaAway);
    const p00 = pHome0 * pAway0;
    const p11 = (lambdaHome * Math.exp(-lambdaHome)) * (lambdaAway * Math.exp(-lambdaAway));
    const bttsCorrection = rho * (p00 * lambdaHome * lambdaAway + p11);
    adjustedBtts = bttsProb - bttsCorrection * 100; // SUBTRACT: DC reduces BTTS when rho > 0
  }

  // Jensen-gap correction for BTTS (applies to both rho=0 and rho>0 paths)
  // See predictions.ts for full explanation. The MC simulation uses the same
  // high-variance lambdas, so it suffers the same concavity artifact.
  //
  // Item 1 fix: the 0.55 constant is now a per-league calibrated parameter
  // (`bttsJensenCorrection`). Some leagues need more correction (defensive,
  // low-BTTS-rate leagues like Serie A) and others need less (high-scoring
  // leagues like Eredivisie where the model already overestimates BTTS).
  // See src/lib/models/league-configs.ts for the per-league values.
  if (!useNB && bttsJensenCorrection > 0) { // Only for Poisson; NB has different distribution properties
    const balancedLambda = (lambdaHome + lambdaAway) / 2;
    const bttsBalanced = (1 - Math.exp(-balancedLambda)) * (1 - Math.exp(-balancedLambda));
    const lambdaImbalance = Math.abs(lambdaHome - lambdaAway) / (lambdaHome + lambdaAway + 0.001);
    const correctionFraction = bttsJensenCorrection * lambdaImbalance;
    adjustedBtts = adjustedBtts + (bttsBalanced * 100 - adjustedBtts) * correctionFraction;
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
