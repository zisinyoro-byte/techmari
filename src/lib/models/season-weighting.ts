/**
 * Season Weighting with Exponential Decay
 *
 * Assigns exponential decay weights to seasons so that the most recent season
 * receives the highest influence on predictions, while older seasons contribute
 * proportionally less.
 *
 * Example with 5 seasons (1516, 1617, 1718, 1819, 1920):
 *   1516: weight ≈ 0.18
 *   1617: weight ≈ 0.28
 *   1718: weight ≈ 0.43
 *   1819: weight ≈ 0.66
 *   1920: weight ≈ 1.00
 *   Normalized to sum to 1.0
 */

const DECAY_FACTOR = 0.65; // Each older season gets 65% of the previous season's weight

/**
 * Calculate exponential decay weights for a set of seasons.
 * Seasons are sorted chronologically (oldest first), and weights are assigned
 * so that the most recent season gets the highest weight.
 *
 * @param seasons - Array of season identifiers (e.g., ['1516', '1617', '1920'])
 * @returns Map of season -> normalized weight (sums to 1.0)
 */
export function calculateSeasonWeights(seasons: string[]): Map<string, number> {
  const weights = new Map<string, number>();

  if (seasons.length === 0) return weights;

  // Sort seasons chronologically (oldest first)
  const sortedSeasons = [...seasons].sort();

  let weight = 1.0;
  let totalWeight = 0;

  for (const season of sortedSeasons) {
    weights.set(season, weight);
    totalWeight += weight;
    weight *= DECAY_FACTOR;
  }

  // Normalize to sum to 1
  for (const [season, w] of weights) {
    weights.set(season, w / totalWeight);
  }

  return weights;
}

/**
 * Apply weighted average for a numeric value across multiple seasons.
 * Each entry provides a weight and a value; the result is the weighted mean.
 *
 * @param values - Array of { weight, value } pairs
 * @returns Weighted average, or 0 if totalWeight is 0
 */
export function weightedAverage(values: { weight: number; value: number }[]): number {
  const totalWeight = values.reduce((sum, v) => sum + v.weight, 0);
  if (totalWeight === 0) return 0;
  return values.reduce((sum, v) => sum + v.weight * v.value, 0) / totalWeight;
}
