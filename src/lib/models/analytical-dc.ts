// ============================================================================
// analytical-dc.ts — Exact Dixon-Coles probability matrix
// ============================================================================
// Computes the FULL bivariate probability matrix (all scorelines up to MAX_GOALS)
// with the Dixon-Coles tau correction baked into every cell.
//
// This is the mathematically correct way to use the DC model — unlike the
// post-hoc correction in monte-carlo.ts which only adjusts the top-10
// scorelines and covers only ~76% of probability mass.
//
// Used for:
//   - Exact 1X2 probabilities (home/draw/away)
//   - Exact BTTS probability under DC
//   - Exact over/under probabilities under DC
//
// The MC simulation is still used for generating the score matrix display,
// HT predictions, and NB dispersion. This module replaces the MC for 1X2.
// ============================================================================

import { goalProb } from './poisson';

/** Maximum goals per team to enumerate (covers >99.9% of probability mass) */
const MAX_GOALS = 9;

/**
 * Dixon-Coles tau correction factor for a given scoreline.
 *
 * tau(x,y) = 1 - lambdaH*lambdaA*rho   if x=0, y=0
 *            = 1 + lambdaH*rho            if x=0, y=1
 *            = 1 + lambdaA*rho            if x=1, y=0
 *            = 1 - rho                   if x=1, y=1
 *            = 1                         otherwise
 */
function tau(h: number, a: number, lambdaH: number, lambdaA: number, rho: number): number {
  if (h === 0 && a === 0) return 1 - lambdaH * lambdaA * rho;
  if (h === 0 && a === 1) return 1 + lambdaH * rho;
  if (h === 1 && a === 0) return 1 + lambdaA * rho;
  if (h === 1 && a === 1) return 1 - rho;
  return 1;
}

export interface AnalyticalDCResult {
  /** Exact home win probability (%) */
  homeWin: number;
  /** Exact draw probability (%) */
  draw: number;
  /** Exact away win probability (%) */
  awayWin: number;
  /** Exact BTTS probability (%) */
  btts: number;
  /** Exact over 2.5 probability (%) */
  over25: number;
  /** Exact over 1.5 probability (%) */
  over15: number;
  /** Exact over 0.5 probability (%) */
  over05: number;
  /** Full probability matrix [homeGoals][awayGoals] = probability */
  matrix: number[][];
  /** Sum of all matrix cells (should be ~1.0) */
  totalMass: number;
}

/**
 * Compute the exact Dixon-Coles probability matrix.
 *
 * For each scoreline (h, a) where 0 <= h,a <= MAX_GOALS:
 *   P(h,a) = tau(h,a) * P_poisson(lambdaH, h) * P_poisson(lambdaA, a)
 *
 * Then sum exact probabilities for each outcome.
 *
 * @param lambdaHome  - Home team expected goals
 * @param lambdaAway  - Away team expected goals
 * @param rho         - Dixon-Coles correlation parameter
 * @param dispersion  - NB dispersion (Infinity = Poisson)
 * @returns Exact probabilities for all markets
 */
export function computeAnalyticalDC(
  lambdaHome: number,
  lambdaAway: number,
  rho: number,
  dispersion: number = Infinity,
): AnalyticalDCResult {
  const matrix: number[][] = [];
  let totalMass = 0;
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let btts = 0;
  let over05 = 0;
  let over15 = 0;
  let over25 = 0;

  for (let h = 0; h <= MAX_GOALS; h++) {
    matrix[h] = [];
    for (let a = 0; a <= MAX_GOALS; a++) {
      const pHome = goalProb(lambdaHome, h, dispersion);
      const pAway = goalProb(lambdaAway, a, dispersion);
      const t = tau(h, a, lambdaHome, lambdaAway, rho);
      const p = pHome * pAway * t;
      matrix[h][a] = p;
      totalMass += p;

      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;

      if (h > 0 && a > 0) btts += p;
      if (h + a > 0.5) over05 += p;
      if (h + a > 1.5) over15 += p;
      if (h + a > 2.5) over25 += p;
    }
  }

  // Normalize to 100% to account for truncated tail beyond MAX_GOALS
  // (typically < 0.1% of mass)
  const scale = totalMass > 0 ? 100 / totalMass : 1;

  return {
    homeWin: Math.round(homeWin * scale * 10) / 10,
    draw: Math.round(draw * scale * 10) / 10,
    awayWin: Math.round(awayWin * scale * 10) / 10,
    btts: Math.round(btts * scale * 10) / 10,
    over25: Math.round(over25 * scale * 10) / 10,
    over15: Math.round(over15 * scale * 10) / 10,
    over05: Math.round(over05 * scale * 10) / 10,
    matrix,
    totalMass: Math.round(totalMass * 10000) / 10000,
  };
}

/**
 * Compute Kelly-optimal stake fraction for a single bet.
 *
 * f* = (b*p - q) / b
 * where:
 *   b = decimal odds - 1 (net payout per unit staked)
 *   p = model probability (as decimal, e.g. 0.55)
 *   q = 1 - p
 *
 * Returns the fraction of bankroll to stake.
 * Negative = no bet (no edge).
 * Clamped to [0, 0.25] — never bet more than 25% of bankroll.
 *
 * @param modelProb  - Model's probability (0-100)
 * @param bookieOdds - Bookmaker decimal odds (e.g. 1.85)
 * @param kellyFraction - Fraction of full Kelly to use (default 0.25 = quarter Kelly)
 * @returns Stake as fraction of bankroll (0-0.25), or 0 if no edge
 */
export function kellyStake(
  modelProb: number,
  bookieOdds: number,
  kellyFraction: number = 0.25,
): number {
  if (!bookieOdds || bookieOdds <= 1 || modelProb <= 0) return 0;

  const p = modelProb / 100;
  const b = bookieOdds - 1; // net payout
  const q = 1 - p;

  const fullKelly = (b * p - q) / b;

  // No edge — don't bet
  if (fullKelly <= 0) return 0;

  // Apply fractional Kelly for safety
  const stake = fullKelly * kellyFraction;

  // Hard cap at 25% of bankroll per bet
  return Math.min(Math.round(stake * 1000) / 1000, 0.25);
}

/**
 * Compute Kelly stakes for all main markets.
 *
 * @param prediction - Model probabilities
 * @param odds - Bookmaker odds (decimal)
 * @param kellyFraction - Fraction of full Kelly (default 0.25)
 */
export function computeKellyStakes(
  prediction: {
    homeWin: number;
    draw: number;
    awayWin: number;
    over25: number;
    btts: number;
    over35: number;
  },
  odds: {
    home?: number | null;
    draw?: number | null;
    away?: number | null;
    over25?: number | null;
    bttsYes?: number | null;
    over35?: number | null;
  },
  kellyFraction: number = 0.25,
): {
  homeWin: number;
  draw: number;
  awayWin: number;
  over25: number;
  btts: number;
  over35: number;
} {
  return {
    homeWin: kellyStake(prediction.homeWin, odds.home ?? 0, kellyFraction),
    draw: kellyStake(prediction.draw, odds.draw ?? 0, kellyFraction),
    awayWin: kellyStake(prediction.awayWin, odds.away ?? 0, kellyFraction),
    over25: kellyStake(prediction.over25, odds.over25 ?? 0, kellyFraction),
    btts: kellyStake(prediction.btts, odds.bttsYes ?? 0, kellyFraction),
    over35: kellyStake(prediction.over35, odds.over35 ?? 0, kellyFraction),
  };
}
