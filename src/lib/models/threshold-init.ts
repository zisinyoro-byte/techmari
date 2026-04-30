/**
 * Threshold Initialization (Server-Side Only)
 *
 * Loads persisted backtest-derived thresholds from disk into the
 * in-memory registry. Uses lazy initialization — only loads once,
 * triggered from any server-side API route (predict, backtest, etc.).
 *
 * NOT safe to import from Edge Runtime (instrumentation.ts, middleware).
 */

import { registerBacktestThresholds, getAllBacktestThresholds } from '@/lib/betting-filters';
import {
  loadPersistedThresholds,
  persistAllThresholds,
} from '@/lib/models/threshold-store';

let initialized = false;

/**
 * Initialize thresholds from disk. Safe to call multiple times — only loads once.
 * Call this early in any server-side API route handler.
 */
export function initializeThresholds(): void {
  if (initialized) return;
  initialized = true;

  const count = loadPersistedThresholds(registerBacktestThresholds);
  if (count > 0) {
    const leagues = getAllBacktestThresholds().map(t => t.leagueName);
    console.log(`[ThresholdInit] Initialized ${count} league(s): ${leagues.join(', ')}`);
  }
}

/**
 * Persist all currently registered thresholds to disk.
 * Useful for manual save or when thresholds are registered outside the backtest flow.
 */
export function saveAllThresholdsToDisk(): void {
  const all = getAllBacktestThresholds();
  if (all.length > 0) {
    persistAllThresholds(all);
  }
}
