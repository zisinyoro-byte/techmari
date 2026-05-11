// ============================================================================
// Signal Calculus Module — Derivatives (Momentum) & Integration (Cumulative)
// ============================================================================
// This module adds calculus-based enhancements to the existing signal pipeline:
//
// 1. DERIVATIVES → Signal Momentum
//    Compares current snapshot to previous snapshot to detect trends.
//    Instead of just "xG Overperformance: Strong Over", you also get
//    "xG Momentum: Rising" — meaning the overperformance is getting stronger.
//
// 2. INTEGRATION → Cumulative Z-Score Trend
//    Accumulates Z-Score deviations over time to detect sustained trends.
//    Instead of just "Z-Score = +1.2" for one game, you get
//    "3-game cumulative trend: +3.5 — consistently beating expectations".
//
// Both are non-invasive: they add data to existing signals without changing
// the underlying computation. The UI shows tiny indicators (arrows, tags).
// ============================================================================

// ============================================================================
// Signal Momentum (Derivatives)
// ============================================================================

/** Momentum direction for a signal */
export type MomentumDirection = 'Rising' | 'Falling' | 'Flat';

/** Momentum assessment for a single signal */
export interface SignalMomentum {
  /** The signal label (e.g., "Strong Over", "Neutral", etc.) */
  current: string;
  /** The previous signal label */
  previous: string;
  /** Trend direction */
  direction: MomentumDirection;
  /** Arrow character for UI display */
  arrow: '↑' | '↓' | '→';
}

/** Complete momentum data for all three signals */
export interface AllSignalMomentum {
  xgMomentum: SignalMomentum;
  regressionMomentum: SignalMomentum;
  zScoreMomentum: SignalMomentum;
}

/**
 * Signal ordering from most "overperforming" to most "underperforming".
 * Used to compare snapshots and detect directional movement.
 * Lower index = more overperforming (better for goals).
 */
const SIGNAL_ORDER: Record<string, number> = {
  'Strong Over': 0,
  'Over': 1,
  'Neutral': 2,
  'Under': 3,
  'Strong Under': 4,
};

/**
 * Compute signal momentum by comparing current and previous snapshots.
 *
 * A signal is "Rising" if it moved toward "Strong Over" (lower index),
 * "Falling" if it moved toward "Strong Under" (higher index),
 * "Flat" if it stayed the same.
 *
 * For xG Overperformance:
 *   Rising = team is becoming MORE underperforming xG (overperformance growing)
 *   Falling = team is reverting to xG expectations
 *
 * For Regression to Mean:
 *   Rising = team's hot streak is intensifying
 *   Falling = team is cooling off
 *
 * For Z-Score:
 *   Rising = more anomalous goal-scoring (could be over or under)
 *   Falling = returning to normal
 *
 * @param current  - Current signal label
 * @param previous - Previous signal label (from last period)
 * @returns SignalMomentum with direction and arrow
 */
export function computeSignalMomentum(current: string, previous: string): SignalMomentum {
  const currentIdx = SIGNAL_ORDER[current] ?? 2;
  const previousIdx = SIGNAL_ORDER[previous] ?? 2;

  let direction: MomentumDirection;
  let arrow: '↑' | '↓' | '→';

  if (currentIdx < previousIdx) {
    direction = 'Rising';
    arrow = '↑';
  } else if (currentIdx > previousIdx) {
    direction = 'Falling';
    arrow = '↓';
  } else {
    direction = 'Flat';
    arrow = '→';
  }

  return { current, previous, direction, arrow };
}

/**
 * Compute momentum for all three signals (xG, Regression, Z-Score).
 *
 * @param currentSignals  - Current { xgSignal, regressionSignal, zScoreSignal }
 * @param previousSignals - Previous period's signals (same shape)
 * @returns Momentum data for all three signals
 */
export function computeAllSignalMomentum(
  currentSignals: { xgSignal: string; regressionSignal: string; zScoreSignal: string },
  previousSignals: { xgSignal: string; regressionSignal: string; zScoreSignal: string }
): AllSignalMomentum {
  return {
    xgMomentum: computeSignalMomentum(currentSignals.xgSignal, previousSignals.xgSignal),
    regressionMomentum: computeSignalMomentum(currentSignals.regressionSignal, previousSignals.regressionSignal),
    zScoreMomentum: computeSignalMomentum(currentSignals.zScoreSignal, previousSignals.zScoreSignal),
  };
}

// ============================================================================
// Cumulative Z-Score Trend (Integration)
// ============================================================================

/** Trend direction for cumulative Z-Score */
export type CumulativeTrend = 'Accumulating Positive' | 'Accumulating Negative' | 'Neutral' | 'Volatile';

/** Cumulative Z-Score analysis result */
export interface CumulativeZScoreResult {
  /** Sum of Z-Scores over the last N games */
  cumulativeZScore: number;
  /** Number of games in the window */
  windowSize: number;
  /** Trend assessment */
  trend: CumulativeTrend;
  /** Per-game Z-Score breakdown */
  gameBreakdown: { zScore: number; runningSum: number }[];
  /** Display tag for UI (e.g., "3-game rising trend") */
  displayTag: string;
}

/**
 * Compute cumulative Z-Score trend over the last N matches.
 *
 * This is the INTEGRATION operation from calculus: we accumulate (sum up)
 * the Z-Score deviations over time. While a single Z-Score tells you
 * "is this game an anomaly?", the cumulative Z-Score tells you
 * "is this team CONSISTENTLY beating/missing expectations?"
 *
 * A positive cumulative Z-Score means the team is consistently scoring
 * more goals than expected. A negative one means consistently fewer.
 *
 * @param goalsPerGame   - Array of total goals per game (most recent first)
 * @param expectedPerGame - Array of expected goals per game (same order, most recent first)
 * @param windowSize     - Number of recent games to consider (default 5)
 * @returns CumulativeZScoreResult with trend analysis
 */
export function computeCumulativeZScore(
  goalsPerGame: number[],
  expectedPerGame: number[],
  windowSize: number = 5
): CumulativeZScoreResult {
  const n = Math.min(goalsPerGame.length, expectedPerGame.length, windowSize);

  if (n === 0) {
    return {
      cumulativeZScore: 0,
      windowSize: 0,
      trend: 'Neutral',
      gameBreakdown: [],
      displayTag: 'No data',
    };
  }

  // Compute overall mean and std dev from the expected values
  const goals = goalsPerGame.slice(0, n);
  const expected = expectedPerGame.slice(0, n);

  const mean = goals.reduce((s, g) => s + g, 0) / n;
  const variance = goals.reduce((s, g) => s + (g - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance) || 1; // avoid division by zero

  // Compute per-game Z-Scores and cumulative sum
  // Z = (actual - expected) / stdDev — how much each game deviated from expectation
  const breakdown: { zScore: number; runningSum: number }[] = [];
  let runningSum = 0;

  for (let i = 0; i < n; i++) {
    const z = stdDev > 0 ? (goals[i] - expected[i]) / stdDev : 0;
    runningSum += z;
    breakdown.push({ zScore: Math.round(z * 100) / 100, runningSum: Math.round(runningSum * 100) / 100 });
  }

  const cumulativeZScore = Math.round(runningSum * 100) / 100;

  // Determine trend
  let trend: CumulativeTrend;
  let displayTag: string;

  if (cumulativeZScore > 2.0) {
    trend = 'Accumulating Positive';
    displayTag = `${n}-game rising trend (+${cumulativeZScore.toFixed(1)})`;
  } else if (cumulativeZScore < -2.0) {
    trend = 'Accumulating Negative';
    displayTag = `${n}-game falling trend (${cumulativeZScore.toFixed(1)})`;
  } else {
    trend = 'Neutral';
    displayTag = `${n}-game stable trend (${cumulativeZScore >= 0 ? '+' : ''}${cumulativeZScore.toFixed(1)})`;
  }

  // Check for volatility (large swings in Z-Score direction)
  if (n >= 3) {
    let directionChanges = 0;
    for (let i = 1; i < n; i++) {
      if ((breakdown[i].zScore > 0) !== (breakdown[i - 1].zScore > 0)) {
        directionChanges++;
      }
    }
    // If more than half the games switch direction, it's volatile
    if (directionChanges >= n / 2) {
      trend = 'Volatile';
      displayTag = `${n}-game volatile (${directionChanges} direction changes)`;
    }
  }

  return {
    cumulativeZScore,
    windowSize: n,
    trend,
    gameBreakdown: breakdown,
    displayTag,
  };
}

/**
 * Helper: compute per-team Z-Score data from match results for momentum calculation.
 * Returns the Z-Score data needed for both current and previous period comparison.
 *
 * @param matches     - Match results sorted by date (most recent first)
 * @param teamName    - Team to compute Z-Score for
 * @param windowSize  - Number of recent games to consider
 * @param offsetGames - Number of games to skip (0 = most recent, 3 = previous period)
 */
export function computeTeamZScoreForPeriod(
  matches: { homeTeam: string; awayTeam: string; ftHomeGoals: number; ftAwayGoals: number }[],
  teamName: string,
  windowSize: number = 5,
  offsetGames: number = 0
): { mean: number; stdDev: number; lastWindowAvg: number; zScore: number } {
  // Get total goals for each game involving this team
  const teamGoals = matches
    .map(m => {
      if (m.homeTeam === teamName) return { total: m.ftHomeGoals + m.ftAwayGoals, isHome: true };
      if (m.awayTeam === teamName) return { total: m.ftHomeGoals + m.ftAwayGoals, isHome: false };
      return null;
    })
    .filter((g): g is { total: number; isHome: boolean } => g !== null);

  if (teamGoals.length < offsetGames + windowSize) {
    return { mean: 0, stdDev: 0, lastWindowAvg: 0, zScore: 0 };
  }

  // All goals up to offset point for mean/stdDev
  const allGoals = teamGoals.slice(offsetGames).map(g => g.total);
  const mean = allGoals.reduce((s, g) => s + g, 0) / allGoals.length;
  const variance = allGoals.reduce((s, g) => s + (g - mean) ** 2, 0) / allGoals.length;
  const stdDev = Math.sqrt(variance) || 1;

  // Most recent window
  const window = teamGoals.slice(offsetGames, offsetGames + windowSize).map(g => g.total);
  const lastWindowAvg = window.reduce((s, g) => s + g, 0) / window.length;

  const zScore = stdDev > 0 ? (lastWindowAvg - mean) / stdDev : 0;

  return { mean, stdDev, lastWindowAvg, zScore };
}
