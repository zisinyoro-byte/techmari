import { factorial } from '@/lib/utils';

// ============================================================================
// Poisson Distribution (original)
// ============================================================================

/**
 * Poisson random number generator using Knuth's algorithm.
 * Used in Monte Carlo simulation to generate random goal counts from a Poisson distribution.
 * Extracted from predict/route.ts line 182.
 */
export function poissonRandom(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;

  do {
    k++;
    p *= Math.random();
  } while (p > L);

  return k - 1;
}

/**
 * Poisson probability mass function.
 * Returns the probability of observing exactly k events given expected rate lambda.
 * Extracted from backtest/route.ts line 300.
 */
export function poissonProb(lambda: number, k: number): number {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

// ============================================================================
// Negative Binomial Distribution — Poisson's bigger brother
// ============================================================================
// The Negative Binomial (NB) distribution is a generalization of Poisson that
// handles overdispersion (variance > mean). Football goal data typically shows
// overdispersion because:
//   - Strong teams can score many goals against weak teams (high variance tail)
//   - Defensive games cluster at 0-0, 1-0, 1-1 (excess low-scoreline probability)
//
// Parameterization (lambda, r):
//   lambda (mu) = expected goals (same as Poisson)
//   r = dispersion parameter (r -> infinity = Poisson)
//   p = r / (lambda + r)   (success probability per trial)
//
// PMF: P(X=k) = C(k+r-1, k) * p^r * (1-p)^k
//
// When r -> infinity, NB converges to Poisson(lambda).
// For football: r is typically 5-20 (estimated from data).
// ============================================================================

/** Default dispersion parameter when no data is available for estimation */
const DEFAULT_DISPERSION_R = 10;

/** Minimum dispersion to prevent overflow in calculations */
const MIN_DISPERSION_R = 2;

/**
 * Natural logarithm of the Gamma function (Lanczos approximation).
 * Provides numerical stability for large arguments where factorial would overflow.
 * Accurate to ~15 significant digits for n > 0.
 *
 * Based on the Lanczos approximation with g=7 and coefficients from
 * Numerical Recipes in C (2nd ed.), Chapter 6.1.
 */
export function lnGamma(n: number): number {
  if (n <= 0) return Infinity;

  const g = 7;
  const c: number[] = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];

  if (n < 0.5) {
    // Reflection formula: Gamma(z) * Gamma(1-z) = pi / sin(pi*z)
    return Math.log(Math.PI / Math.sin(Math.PI * n)) - lnGamma(1 - n);
  }

  let x = n - 1;
  let a = c[0];
  const t = x + g + 0.5;

  for (let i = 1; i < g + 2; i++) {
    a += c[i] / (x + i);
  }

  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * Natural logarithm of the binomial coefficient C(n, k) = n! / (k! * (n-k)!).
 * Uses log-gamma for numerical stability with large n.
 */
function lnBinomialCoeff(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  if (k === 0 || k === n) return 0;
  // For small values where factorial is safe, use direct computation
  if (n <= 170) {
    return Math.log(factorial(n) / (factorial(k) * factorial(n - k)));
  }
  return lnGamma(n + 1) - lnGamma(k + 1) - lnGamma(n - k + 1);
}

/**
 * Negative Binomial probability mass function.
 *
 * Returns P(X = k) given expected goals (lambda) and dispersion (r).
 *
 * @param lambda - Expected goals (mean), same as Poisson lambda
 * @param k      - Number of goals to compute probability for
 * @param r      - Dispersion parameter (higher = closer to Poisson)
 * @returns Probability of exactly k goals
 *
 * PMF: P(X=k) = C(k+r-1, k) * (r/(lambda+r))^r * (lambda/(lambda+r))^k
 *
 * Log form for numerical stability:
 *   lnP = lnGamma(k+r) - lnGamma(k+1) - lnGamma(r) + r*ln(p) + k*ln(1-p)
 *   where p = r / (lambda + r)
 */
export function negBinProb(lambda: number, k: number, r: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  if (r <= 0) return poissonProb(lambda, k); // fallback to Poisson

  const clampedR = Math.max(r, MIN_DISPERSION_R);
  const p = clampedR / (lambda + clampedR); // success probability

  // Use log-gamma for numerical stability
  const logP = lnGamma(k + clampedR) - lnGamma(k + 1) - lnGamma(clampedR)
    + clampedR * Math.log(p) + k * Math.log(1 - p);

  return Math.exp(logP);
}

/**
 * Estimate the dispersion parameter r from goal data using Method of Moments.
 *
 * For Negative Binomial:
 *   E[X] = lambda
 *   Var[X] = lambda * (1 + lambda/r)
 *   => r = lambda^2 / (Var - lambda)
 *
 * If variance <= mean (no overdispersion), returns Infinity (Poisson case).
 *
 * @param goals - Array of goal counts from matches
 * @returns Estimated dispersion r, or Infinity if no overdispersion detected
 */
export function estimateDispersion(goals: number[]): number {
  if (goals.length < 5) return DEFAULT_DISPERSION_R;

  const n = goals.length;
  const mean = goals.reduce((s, g) => s + g, 0) / n;
  const variance = goals.reduce((s, g) => s + (g - mean) ** 2, 0) / n;

  // If no overdispersion, return Infinity (equivalent to Poisson)
  if (variance <= mean || mean <= 0) return Infinity;

  const r = (mean * mean) / (variance - mean);

  // Clamp to reasonable range for football
  // r < 2 is too aggressive, r > 100 is effectively Poisson
  if (r < MIN_DISPERSION_R) return MIN_DISPERSION_R;
  if (r > 100) return Infinity; // close enough to Poisson

  return Math.round(r * 100) / 100;
}

/**
 * Negative Binomial random number generator using the waiting-time method.
 *
 * Generates a random goal count from NB(r, p) distribution.
 * Algorithm: generate r geometric random variables, sum them.
 * This is equivalent to: number of failures before r-th success in Bernoulli(p) trials.
 *
 * For efficiency when r is large (close to Poisson), falls back to Poisson.
 *
 * @param lambda - Expected goals (mean)
 * @param r      - Dispersion parameter
 * @returns Random goal count
 */
export function negBinRandom(lambda: number, r: number): number {
  if (lambda <= 0) return 0;
  if (r <= 0 || !isFinite(r) || r > 100) return poissonRandom(lambda); // fallback

  const p = r / (lambda + r);

  // Waiting-time method: sum of r geometric random variables
  // Each geometric: number of Bernoulli failures before one success
  let total = 0;
  for (let i = 0; i < Math.ceil(r); i++) {
    // Geometric(p): number of failures before success
    // P(X=k) = (1-p)^k * p, generate using: floor(log(U) / log(1-p))
    const u = Math.random();
    if (u === 0) continue; // avoid log(0)
    total += Math.floor(Math.log(u) / Math.log(1 - p));
  }

  // Scale by r if using fractional r
  if (r !== Math.ceil(r)) {
    total = Math.round(total * (r / Math.ceil(r)));
  }

  return total;
}

/**
 * Unified random goal generator: uses Negative Binomial with dispersion,
 * falling back to Poisson when r is large or invalid.
 *
 * @param lambda    - Expected goals
 * @param dispersion - Dispersion parameter r (Infinity or large = Poisson)
 * @returns Random goal count
 */
export function goalRandom(lambda: number, dispersion: number = Infinity): number {
  if (!isFinite(dispersion) || dispersion > 100) {
    return poissonRandom(lambda);
  }
  return negBinRandom(lambda, dispersion);
}

/**
 * Unified probability mass function: uses Negative Binomial with dispersion,
 * falling back to Poisson when r is large or invalid.
 *
 * @param lambda     - Expected goals
 * @param k          - Number of goals
 * @param dispersion - Dispersion parameter r (Infinity or large = Poisson)
 * @returns Probability of exactly k goals
 */
export function goalProb(lambda: number, k: number, dispersion: number = Infinity): number {
  if (!isFinite(dispersion) || dispersion > 100) {
    return poissonProb(lambda, k);
  }
  return negBinProb(lambda, k, dispersion);
}
