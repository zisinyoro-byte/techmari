/**
 * Threshold Persistence Store
 *
 * Persists backtest-derived thresholds to disk so they survive server restarts.
 * Uses a simple JSON file at data/thresholds.json.
 *
 * Flow:
 *   1. Backtest completes → deriveThresholdsFromBacktest() → registerBacktestThresholds()
 *   2. backtest route calls persistThresholds() → writes to file
 *   3. On server start, loadPersistedThresholds() loads from file into memory registry
 */

import fs from 'fs';
import path from 'path';
import type { LeagueBacktestThresholds } from '@/lib/betting-filters';

const THRESHOLDS_DIR = path.join(process.cwd(), 'data');
const THRESHOLDS_FILE = path.join(THRESHOLDS_DIR, 'thresholds.json');

interface ThresholdStoreData {
  version: number;
  updatedAt: string;
  thresholds: Record<string, LeagueBacktestThresholds>;
}

/**
 * Ensure the data directory exists.
 */
function ensureDir(): void {
  if (!fs.existsSync(THRESHOLDS_DIR)) {
    fs.mkdirSync(THRESHOLDS_DIR, { recursive: true });
  }
}

/**
 * Read the thresholds file from disk.
 * Returns null if the file doesn't exist or is corrupt.
 */
function readStore(): ThresholdStoreData | null {
  try {
    if (!fs.existsSync(THRESHOLDS_FILE)) return null;
    const raw = fs.readFileSync(THRESHOLDS_FILE, 'utf-8');
    const data = JSON.parse(raw) as ThresholdStoreData;
    if (data.version !== 1) {
      console.warn('[ThresholdStore] Unknown version, starting fresh');
      return null;
    }
    return data;
  } catch (error) {
    console.error('[ThresholdStore] Failed to read store:', error);
    return null;
  }
}

/**
 * Write the thresholds file to disk.
 */
function writeStore(data: ThresholdStoreData): void {
  try {
    ensureDir();
    fs.writeFileSync(THRESHOLDS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[ThresholdStore] Persisted ${Object.keys(data.thresholds).length} league(s) to ${THRESHOLDS_FILE}`);
  } catch (error) {
    console.error('[ThresholdStore] Failed to write store:', error);
  }
}

/**
 * Load all persisted thresholds from disk into the provided register callback.
 * Called once at server startup.
 *
 * @param registerFn - callback that registers each threshold (e.g. registerBacktestThresholds)
 * @returns number of thresholds loaded
 */
export function loadPersistedThresholds(
  registerFn: (t: LeagueBacktestThresholds) => void
): number {
  const store = readStore();
  if (!store || Object.keys(store.thresholds).length === 0) {
    console.log('[ThresholdStore] No persisted thresholds found');
    return 0;
  }

  let count = 0;
  for (const [league, thresholds] of Object.entries(store.thresholds)) {
    registerFn(thresholds);
    count++;
  }

  console.log(`[ThresholdStore] Loaded ${count} persisted league threshold(s) from disk`);
  return count;
}

/**
 * Persist a single league's thresholds to disk.
 * Merges with existing persisted data.
 */
export function persistThreshold(thresholds: LeagueBacktestThresholds): void {
  const store = readStore() ?? {
    version: 1,
    updatedAt: new Date().toISOString(),
    thresholds: {},
  };

  // Key by lowercase league name for consistency
  const key = thresholds.leagueName.toLowerCase();
  store.thresholds[key] = thresholds;
  store.updatedAt = new Date().toISOString();

  writeStore(store);
}

/**
 * Persist multiple leagues' thresholds to disk.
 * Replaces all existing persisted data.
 */
export function persistAllThresholds(thresholds: LeagueBacktestThresholds[]): void {
  const store: ThresholdStoreData = {
    version: 1,
    updatedAt: new Date().toISOString(),
    thresholds: {},
  };

  for (const t of thresholds) {
    const key = t.leagueName.toLowerCase();
    store.thresholds[key] = t;
  }

  writeStore(store);
}

/**
 * Get all persisted thresholds from disk without loading into memory.
 * Useful for UI display / export.
 */
export function getPersistedThresholds(): LeagueBacktestThresholds[] {
  const store = readStore();
  if (!store) return [];
  return Object.values(store.thresholds);
}

/**
 * Remove a league's persisted thresholds from disk.
 */
export function removePersistedThreshold(leagueName: string): void {
  const store = readStore();
  if (!store) return;

  const key = leagueName.toLowerCase();
  delete store.thresholds[key];
  store.updatedAt = new Date().toISOString();

  writeStore(store);
  console.log(`[ThresholdStore] Removed persisted thresholds for ${leagueName}`);
}

/**
 * Clear all persisted thresholds from disk.
 */
export function clearPersistedThresholds(): void {
  try {
    if (fs.existsSync(THRESHOLDS_FILE)) {
      fs.unlinkSync(THRESHOLDS_FILE);
      console.log('[ThresholdStore] Cleared all persisted thresholds');
    }
  } catch (error) {
    console.error('[ThresholdStore] Failed to clear store:', error);
  }
}
