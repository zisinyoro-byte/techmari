import { factorial } from '@/lib/utils';

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
