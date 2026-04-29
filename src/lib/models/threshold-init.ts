/**
 * Threshold Initialization (Server-Side Only)
 *
 * Loads persisted backtest-derived thresholds from disk into the
 * in-memory registry on server startup.
 *
 * Import this from a server-only entry point (e.g. backtest route, layout, etc.)
 * — NOT from client components.
 */

import { registerBacktestThresholds, getAllBacktestThresholds } from '@/lib/betting-filters';
import {
  loadPersistedThresholds,
  persistAllThresholds,
} from '@/lib/models/threshold-store';

let initialized = false;

/**
 * Initialize thresholds from disk. Safe to call multiple times — only loads once.
 * Call this early in server startup (e.g. in an API route or instrumentation file).
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
