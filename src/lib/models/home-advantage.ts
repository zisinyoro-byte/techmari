/**
 * Bidirectional Home Advantage
 *
 * The original model only measures scoring uplift at home (attack side).
 * Real home advantage is BOTH scoring more AND conceding less.
 * This module calculates both dimensions and provides a combined metric.
 */

export interface HomeAdvantageMetrics {
  /** How much more home teams score vs league avg home scoring (ratio, >1 = stronger) */
  scoringAdvantage: number;
  /** How much home teams concede vs league avg away scoring (ratio, <1 = stronger defense) */
  defensiveAdvantage: number;
  /** Combined metric using geometric mean of scoring and inverse defensive */
  overallAdvantage: number;
}

/**
 * Calculate bidirectional home advantage for a team.
 *
 * Scoring advantage: ratio of home scoring rate vs league avg home scoring.
 *   >1 means the team scores more than average at home.
 *
 * Defensive advantage: ratio of home conceded rate vs league avg away scoring.
 *   <1 means the team concedes less than average at home (stronger defense).
 *
 * Overall advantage: geometric mean of scoring advantage and inverse defensive
 *   advantage. This combines both dimensions into a single metric.
 *
 * All values are clamped to reasonable ranges to prevent extreme outliers.
 *
 * @param homeGoalsPerGame    - Average goals the team scores when playing at home
 * @param homeConcededPerGame - Average goals the team concedes when playing at home
 * @param awayGoalsPerGame    - Average goals the team scores when playing away
 * @param awayConcededPerGame - Average goals the team concedes when playing away
 * @param leagueHomeGoals     - League average goals scored by home teams per game
 * @param leagueAwayGoals     - League average goals scored by away teams per game
 */
export function calculateBidirectionalHomeAdvantage(
  homeGoalsPerGame: number,
  homeConcededPerGame: number,
  _awayGoalsPerGame: number,
  _awayConcededPerGame: number,
  leagueHomeGoals: number,
  leagueAwayGoals: number
): HomeAdvantageMetrics {
  // Scoring advantage: ratio of home scoring rate vs league avg home scoring
  const scoringAdvantage = leagueHomeGoals > 0
    ? homeGoalsPerGame / leagueHomeGoals
    : 1.0;

  // Defensive advantage: ratio of home conceded rate vs league avg away scoring
  // LOWER conceded rate = STRONGER defensive advantage
  // If home team concedes 0.8 when away teams avg 1.2 at home, defensive factor = 0.8/1.2 = 0.67
  // This means home defense is 33% better than average
  const defensiveAdvantage = leagueAwayGoals > 0
    ? homeConcededPerGame / leagueAwayGoals
    : 1.0;

  // Overall home advantage (geometric mean of scoring and inverse defensive)
  // Inverse defensive: lower conceded = better, so we invert it
  const inverseDefensive = defensiveAdvantage > 0 ? 1 / defensiveAdvantage : 1.0;
  const overallAdvantage = Math.sqrt(scoringAdvantage * inverseDefensive);

  return {
    scoringAdvantage: Math.min(Math.max(scoringAdvantage, 0.8), 1.3),
    defensiveAdvantage: Math.min(Math.max(defensiveAdvantage, 0.7), 1.3),
    overallAdvantage: Math.min(Math.max(overallAdvantage, 0.8), 1.3),
  };
}
