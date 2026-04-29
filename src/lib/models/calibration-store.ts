/**
 * Calibration Store
 *
 * In-memory storage for league-specific calibration ratios derived from backtest results.
 * When a backtest is run, the calibration ratios are saved here keyed by league.
 * The predict route reads these ratios to adjust raw model probabilities.
 *
 * Calibration ratio = actual_rate / predicted_rate
 *   > 1.0 means the model underestimates (e.g. model says 55% O2.5, actual is 66%)
 *   < 1.0 means the model overestimates
 *
 * Calibrated probability = clamp(raw_prob × ratio, 5, 95)
 */

export interface CalibrationRatios {
  // Per-market calibration ratios derived from backtest
  over25: number;
  over15: number;
  bttsYes: number;
  // 1X2 calibration
  homeWin: number;
  draw: number;
  awayWin: number;
  // Metadata
  league: string;
  testSeason: string;
  matches: number;
  brierScore: number;
  timestamp: number;
}

// In-memory store: league code → CalibrationRatios
const store = new Map<string, CalibrationRatios>();

/**
 * Save calibration ratios for a league (called after backtest completes).
 */
export function saveCalibration(league: string, ratios: CalibrationRatios): void {
  store.set(league, ratios);
  console.log(`[Calibration] Saved for ${league}: O2.5=${ratios.over25.toFixed(3)}, BTTS=${ratios.bttsYes.toFixed(3)}, H=${ratios.homeWin.toFixed(3)}, D=${ratios.draw.toFixed(3)}, A=${ratios.awayWin.toFixed(3)}`);
}

/**
 * Get calibration ratios for a league. Returns null if no backtest has been run.
 */
export function getCalibration(league: string): CalibrationRatios | null {
  return store.get(league) ?? null;
}

/**
 * Apply calibration correction to a raw probability.
 * Clamps result between 5% and 95% to avoid extremes.
 */
export function applyCalibration(rawProb: number, ratio: number): number {
  return Math.round(Math.min(95, Math.max(5, rawProb * ratio)) * 10) / 10;
}

/**
 * Get all stored calibration entries (for UI display).
 */
export function getAllCalibrations(): Map<string, CalibrationRatios> {
  return new Map(store);
}

/**
 * Clear all calibration data.
 */
export function clearCalibration(): void {
  store.clear();
}
