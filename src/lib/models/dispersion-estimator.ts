// ============================================================================
// dispersion-estimator.ts — Per-matchup Negative Binomial dispersion estimation
// ============================================================================
// Replaces the previous league-wide dispersion estimate with a
// matchup-similarity-windowed estimate. The motivation:
//
// Football goal distributions are overdispersed (variance > mean) but the
// degree of overdispersion varies dramatically by matchup:
//
//   - Heavy favorite vs underdog: HIGH variance (could be 5-0 or 1-0)
//     => low `r` (high dispersion, fat tails)
//
//   - Two balanced mid-table teams: LOW variance (likely 1-1 or 2-1)
//     => high `r` (low dispersion, thin tails)
//
//   - Two defensive teams: LOW variance, LOW mean (often 0-0 or 1-0)
//     => high `r` with small lambda
//
//   - Two attacking teams: MEDIUM variance, HIGH mean (could be 2-2 or 4-1)
//     => medium `r` with large lambda
//
// Using a single league-wide `r` averages all this out, which over-weights
// tails for balanced matchups (inflating O3.5) and under-weights tails for
// mismatched matchups (deflating O3.5).
//
// This module estimates dispersion from a window of historical matches
// between teams of similar strength differential to the target matchup.
// ============================================================================

import type { MatchResult, TeamStats } from '@/lib/types';
import { estimateDispersion } from './poisson';
import { getLeagueTuning } from './league-configs';

/**
 * Estimate dispersion for a specific matchup.
 *
 * Algorithm:
 *   1. Compute the target matchup's strength differential: |homeAttack - awayAttack|
 *   2. Filter all historical matches to those with a similar strength diff
 *      (within the league's similarity window, default ±0.20)
 *   3. If we have ≥30 similar matches, estimate dispersion from those
 *   4. Otherwise, fall back to league-wide dispersion (current behavior)
 *
 * The minimum-sample threshold (30) ensures the dispersion estimate is
 * statistically meaningful. Below that, the league-wide estimate is more
 * stable.
 *
 * @param matches     - All training matches (used as the search pool)
 * @param teamStats   - Pre-computed team stats (for attack strength lookup)
 * @param homeTeam    - Target matchup home team
 * @param awayTeam    - Target matchup away team
 * @param league      - League code (for tuning the similarity window)
 * @returns Dispersion parameter r (Infinity = Poisson, finite = NB)
 */
export function estimateMatchupDispersion(
  matches: MatchResult[],
  teamStats: Map<string, TeamStats>,
  homeTeam: string,
  awayTeam: string,
  league: string,
): number {
  // Need team stats for both teams to compute target differential
  const homeStats = teamStats.get(homeTeam);
  const awayStats = teamStats.get(awayTeam);
  if (!homeStats || !awayStats) {
    // Fallback: league-wide dispersion
    return estimateDispersion(matches.map(m => m.ftHomeGoals + m.ftAwayGoals));
  }

  // Target matchup strength differential
  // Using attack ratio as the strength proxy (relative to league avg)
  const targetDiff = Math.abs(homeStats.attack - awayStats.attack);

  // Get the similarity window for this league
  const tuning = getLeagueTuning(league);
  const window = tuning.dispersionSimilarityWindow;

  // Filter matches to those with similar strength differential
  // Use cached attack values where possible; fall back to fresh compute.
  // For efficiency, build a quick lookup of attack values per team.
  const attackCache = new Map<string, number>();
  for (const [team, stats] of teamStats.entries()) {
    attackCache.set(team, stats.attack);
  }

  const similarMatches: MatchResult[] = [];
  for (const m of matches) {
    const homeAtt = attackCache.get(m.homeTeam);
    const awayAtt = attackCache.get(m.awayTeam);
    if (homeAtt === undefined || awayAtt === undefined) continue;

    const matchDiff = Math.abs(homeAtt - awayAtt);
    if (Math.abs(matchDiff - targetDiff) <= window) {
      similarMatches.push(m);
    }
  }

  // Need at least 30 similar matches for a meaningful dispersion estimate.
  // Below this, the league-wide estimate is more stable.
  const MIN_SIMILAR_SAMPLE = 30;
  if (similarMatches.length < MIN_SIMILAR_SAMPLE) {
    return estimateDispersion(matches.map(m => m.ftHomeGoals + m.ftAwayGoals));
  }

  // Estimate dispersion from the similar matches' total goals
  const similarTotalGoals = similarMatches.map(m => m.ftHomeGoals + m.ftAwayGoals);
  const matchupDispersion = estimateDispersion(similarTotalGoals);
  const leagueDispersion = estimateDispersion(matches.map(m => m.ftHomeGoals + m.ftAwayGoals));

  // Bayesian shrinkage: blend per-matchup dispersion with league-wide based on
  // sample size. This prevents noise from small samples while still allowing
  // per-matchup signal to influence the estimate when we have enough data.
  //
  // blendWeight = n / (n + k), where k controls how much league-wide prior we use.
  // k = 200 (conservative): at n=30 → 13% per-matchup, at n=100 → 33%, at n=300 → 60%
  // This strong prior ensures per-matchup dispersion only kicks in when we have
  // enough similar matches to be confident. Without this, small-sample noise in
  // the per-matchup estimate interacts badly with the Jensen-gap BTTS correction
  // (which was tuned for league-wide dispersion).
  const SHRINKAGE_K = 200;
  const blendWeight = similarMatches.length / (similarMatches.length + SHRINKAGE_K);

  // If either dispersion is infinite (Poisson case), use the other one
  if (!isFinite(matchupDispersion) && !isFinite(leagueDispersion)) {
    return Infinity; // both Poisson
  }
  if (!isFinite(matchupDispersion)) {
    return leagueDispersion;
  }
  if (!isFinite(leagueDispersion)) {
    return matchupDispersion;
  }

  // Bayesian blend: more per-matchup weight when we have more similar matches
  return blendWeight * matchupDispersion + (1 - blendWeight) * leagueDispersion;
}

/**
 * Estimate the halftime/full-time goal ratio for a specific matchup.
 *
 * Algorithm:
 *   1. Start with the league's baseline HT/FT ratio (from league-configs)
 *   2. Adjust based on matchup characteristics:
 *      - High total xG (both teams attacking) → slightly higher HT ratio
 *        (open games tend to have more first-half action)
 *      - Low total xG (defensive matchup) → slightly lower HT ratio
 *        (cagey games often 0-0 at HT)
 *      - Large strength differential → lower HT ratio
 *        (underdog parks bus early, game opens up in 2nd half)
 *
 * @param league     - League code (for baseline ratio)
 * @param lambdaHome - Computed home xG
 * @param lambdaAway - Computed away xG
 * @param homeAttack - Home team attack strength (relative to league, 1.0 = avg)
 * @param awayAttack - Away team attack strength
 * @returns HT ratio in [0.35, 0.55] (extremes clamped)
 */
export function estimateMatchupHtFtRatio(
  league: string,
  lambdaHome: number,
  lambdaAway: number,
  homeAttack: number,
  awayAttack: number,
): number {
  const tuning = getLeagueTuning(league);
  let ratio = tuning.htFtRatio;

  const totalXg = lambdaHome + lambdaAway;

  // Adjustment 1: high-scoring matchups have slightly more first-half action
  // League avg total goals ~2.7. Every goal above that → +0.005 ratio
  // Every goal below → -0.005 ratio. Clamped to ±0.03.
  const scoringAdjustment = Math.max(-0.03, Math.min(0.03, (totalXg - 2.7) * 0.01));
  ratio += scoringAdjustment;

  // Adjustment 2: large strength differential → lower HT ratio
  // (underdog defends deep early; favorite eventually breaks through in 2nd half)
  const strengthDiff = Math.abs(homeAttack - awayAttack);
  // strengthDiff is typically 0.0-1.0; 0.5+ is a notable mismatch
  const mismatchAdjustment = Math.max(-0.04, Math.min(0, -strengthDiff * 0.04));
  ratio += mismatchAdjustment;

  // Clamp to sensible range
  return Math.max(0.35, Math.min(0.55, ratio));
}
