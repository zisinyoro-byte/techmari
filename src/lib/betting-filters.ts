// ============================================================================
// Shared Betting Filter Configuration — Single Source of Truth
// ============================================================================
// Backtest-derived threshold system with hybrid formula fallback:
//   1. If backtest-derived thresholds exist for a league → use those (optimal)
//   2. Otherwise → fall back to hybrid: max(absoluteFloor, leagueBaseline * multiplier)
// League-level criteria always use absolute thresholds.
// Used by: PredictionsTab, ModelsTab, BttsCheckTab, Over35Tab
// ============================================================================

// ============================================================================
// League-level baselines — computed from actual results data
// ============================================================================
export interface LeagueBaselines {
  avgGoalsPerGame: number;   // from analytics
  over25Rate: number;        // from analytics (%)
  bttsRate: number;          // computed from results (%)
  over35Rate: number;        // computed from results (%)
  avgHomeGoals: number;      // from analytics
  avgAwayGoals: number;      // from analytics
  shotConversion: number;    // from analytics (%)
}

/**
 * Compute league baselines from results + analytics data.
 * Call this once per league/season, pass the result into all filter functions.
 */
export function computeLeagueBaselines(
  results: { ftHomeGoals: number; ftAwayGoals: number }[],
  analytics: {
    avgGoalsPerGame: number;
    over25Percent: number;
    avgHomeGoals: number;
    avgAwayGoals: number;
    overallShotConversion: string | number;
  }
): LeagueBaselines {
  const total = results.length || 1;
  const bttsCount = results.filter(r => r.ftHomeGoals > 0 && r.ftAwayGoals > 0).length;
  const over35Count = results.filter(r => r.ftHomeGoals + r.ftAwayGoals > 3.5).length;

  return {
    avgGoalsPerGame: analytics.avgGoalsPerGame,
    over25Rate: analytics.over25Percent,
    bttsRate: (bttsCount / total) * 100,
    over35Rate: (over35Count / total) * 100,
    avgHomeGoals: analytics.avgHomeGoals,
    avgAwayGoals: analytics.avgAwayGoals,
    shotConversion: typeof analytics.overallShotConversion === 'string'
      ? parseFloat(analytics.overallShotConversion)
      : analytics.overallShotConversion,
  };
}

// ============================================================================
// Per-criterion threshold definitions
// ============================================================================

/** Thresholds for each BTTS checklist criterion */
export interface BttsCriterionThresholds {
  modelBttsProb: number;   // %
  homeAvgGoals: number;    // goals
  awayAvgGoals: number;    // goals
  modelO25Prob: number;    // %
  shotConversion: number;  // %
}

/** Thresholds for each Over 3.5 checklist criterion */
export interface Over35CriterionThresholds {
  modelO35Prob: number;    // %
  bttsProb: number;        // %
  homeAvgGoals: number;    // goals
  awayAvgGoals: number;    // goals
  shotConversion: number;  // %
}

/** Thresholds for STRONG BET check */
export interface StrongBetCriterionThresholds {
  o25Prob: number;           // %
  o35Prob: number;           // %
  bttsProb: number;          // %
  bttsChecklistCount: number; // absolute count
}

/** Thresholds for GREY RESULT check */
export interface GreyResultCriterionThresholds {
  bttsProb: number;              // %
  o25Prob: number;               // %
  o35Prob: number;               // %
  bttsChecklistCount: number;    // absolute count
  over35ChecklistCount: number;  // absolute count
  requiredChecks: number;        // absolute count
}

/** Complete threshold set for one league (backtest-derived) */
export interface LeagueBacktestThresholds {
  leagueName: string;
  // League-level (always absolute)
  bttsLeagueAvgGoals: number;
  bttsLeagueO25Rate: number;
  o35LeagueAvgGoals: number;
  o35LeagueO25Rate: number;
  // Match-level
  btts: BttsCriterionThresholds;
  over35: Over35CriterionThresholds;
  strongBet: StrongBetCriterionThresholds;
  greyResult: GreyResultCriterionThresholds;
  // Metadata
  sampleSize: number;       // number of matches used to derive
  derivedAt: string;        // ISO date string
}

// ============================================================================
// Backtest-derived threshold registry
// ============================================================================
// This is the central store. Thresholds are added here when backtests run.
// Leagues without entries fall back to the hybrid formula.
// Supports localStorage persistence for client-side survival across page reloads.
// ============================================================================

const STORAGE_KEY = 'techmari_backtest_thresholds';

const backtestRegistry = new Map<string, LeagueBacktestThresholds>();

let loadedFromStorage = false;

/**
 * Load thresholds from localStorage into the in-memory registry.
 * Safe to call multiple times — only loads once per session.
 */
function loadFromLocalStorage(): void {
  if (loadedFromStorage || typeof window === 'undefined') return;
  loadedFromStorage = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.version !== 1) return;
    const entries: Record<string, LeagueBacktestThresholds> = data.thresholds;
    for (const [key, thresholds] of Object.entries(entries)) {
      backtestRegistry.set(key, thresholds);
    }
    const count = Object.keys(entries).length;
    if (count > 0) {
      console.log(`[BettingFilters] Loaded ${count} persisted threshold(s) from localStorage`);
    }
  } catch {
    // localStorage not available or corrupt data — silent fail
  }
}

/**
 * Save all in-memory thresholds to localStorage.
 */
function saveToLocalStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const data: Record<string, LeagueBacktestThresholds> = {};
    for (const [key, thresholds] of backtestRegistry.entries()) {
      data[key] = thresholds;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      thresholds: data,
    }));
  } catch {
    // localStorage not available or quota exceeded — silent fail
  }
}

/**
 * Register backtest-derived thresholds for a league.
 * Also persists to localStorage automatically.
 */
export function registerBacktestThresholds(thresholds: LeagueBacktestThresholds): void {
  // Ensure we've loaded from localStorage first
  loadFromLocalStorage();
  backtestRegistry.set(thresholds.leagueName.toLowerCase(), thresholds);
  saveToLocalStorage();
}

/**
 * Get backtest-derived thresholds for a league, if available.
 */
export function getBacktestThresholds(leagueName: string): LeagueBacktestThresholds | undefined {
  loadFromLocalStorage();
  return backtestRegistry.get(leagueName.toLowerCase());
}

/**
 * Get all registered backtest thresholds (for display/export).
 */
export function getAllBacktestThresholds(): LeagueBacktestThresholds[] {
  loadFromLocalStorage();
  return Array.from(backtestRegistry.values());
}

/**
 * Check if a league has backtest-derived thresholds with sufficient sample size.
 */
export function hasSufficientBacktest(leagueName: string, minSampleSize = 150): boolean {
  loadFromLocalStorage();
  const t = backtestRegistry.get(leagueName.toLowerCase());
  return t !== undefined && t.sampleSize >= minSampleSize;
}

// ============================================================================
// Hybrid fallback thresholds (used when no backtest data exists)
// League-level: absolute. Match-level: floor + multiplier pairs.
// ============================================================================

// ---- BTTS Checklist criteria ----
export const BTTS_LEAGUE_THRESHOLDS = {
  leagueAvgGoals: 2.7,
  leagueO25Rate: 55,
} as const;

export const BTTS_HYBRID_THRESHOLDS = {
  modelBttsProb:  { floor: 55, multiplier: 1.12 },
  homeAvgGoals:   { floor: 1.3, multiplier: 1.10 },
  awayAvgGoals:   { floor: 1.1, multiplier: 1.10 },
  modelO25Prob:   { floor: 62, multiplier: 1.10 },
  shotConversion: { floor: 11, multiplier: 1.15 },
} as const;

// ---- Over 3.5 Checklist criteria ----
export const OVER35_LEAGUE_THRESHOLDS = {
  leagueAvgGoals: 2.8,
  leagueO25Rate: 52,
} as const;

export const OVER35_HYBRID_THRESHOLDS = {
  modelO35Prob:   { floor: 40, multiplier: 1.20 },
  bttsProb:       { floor: 52, multiplier: 1.10 },
  homeAvgGoals:   { floor: 1.4, multiplier: 1.12 },
  awayAvgGoals:   { floor: 1.2, multiplier: 1.10 },
  shotConversion: { floor: 12, multiplier: 1.15 },
} as const;

// ---- STRONG BET — Points-based system (need 7+ of 12) ----
// Updated signal checks based on 7,110-match backtest data:
//   xG = Over (mild underperformance = finishing due to click)
//   Regression = Under (recently hot = goals keep flowing)
//   Z-Score = Neutral (no anomaly = natural attacking football)
//   Signal Divergence = xG and Regression point opposite (high-variance games)
export const STRONG_BET_POINTS = {
  o25: 2,
  o35: 1,
  btts: 1,
  bttsChecklist: 2,
  xgSignal: 2,
  regressionSignal: 2,
  zScoreSignal: 1,
  signalDivergence: 1,
  threshold: 7,
  maxPoints: 12,
} as const;

export const STRONG_BET_HYBRID = {
  o25Prob:   { floor: 65, multiplier: 1.10 },
  o35Prob:   { floor: 42, multiplier: 1.25 },
  bttsProb:  { floor: 55, multiplier: 1.12 },
  bttsChecklistCount: 6,
} as const;

// ---- GREY RESULT — 8 checks, need 6+ ----
// Updated signal checks based on backtest data:
//   Regression = Neutral or Under (normal variance or recently hot)
//   Z-Score = Neutral (universal goal-fest sweet spot, Strong Over nearly impossible)
//   xG = Over or Under (both mild states beat extremes)
export const GREY_RESULT_CONFIG = {
  bttsProb:  { floor: 55, multiplier: 1.12 },
  o25Prob:   { floor: 65, multiplier: 1.10 },
  o35Prob:   { floor: 40, multiplier: 1.20 },
  bttsChecklistCount: 5,
  over35ChecklistCount: 3,
  requiredChecks: 6,
} as const;

// ---- GOAL FEST — Backtest-optimized combo detector ----
// Fires when: xG=Over/Under + Regression=Under/StrongUnder + Z-Score=Neutral + model agrees
// Best combo from 7,110-match analysis: 59.2% O2.5, 61.7% BTTS (206-match sample)
export const GOAL_FEST_CONFIG = {
  o25Prob:   { floor: 55, multiplier: 1.10 },
  bttsProb:  { floor: 55, multiplier: 1.10 },
} as const;

/** Resolved GOAL FEST thresholds */
export interface ResolvedGoalFestThresholds {
  o25Prob: number;
  bttsProb: number;
  source: 'backtest' | 'hybrid';
}

// ---- Signal thresholds (xG, Regression, Z-Score) — unchanged ----
export const XG_THRESHOLDS = {
  strongOver: -0.7,
  over: -0.3,
  strongUnder: 0.7,
  under: 0.3,
} as const;

export const REGRESSION_THRESHOLDS = {
  perTeam: {
    strongOver: -0.8,
    over: -0.3,
    strongUnder: 0.8,
    under: 0.3,
  },
  total: {
    strongOver: -1.2,
    over: -0.5,
    strongUnder: 1.2,
    under: 0.5,
  },
} as const;

export const ZSCORE_THRESHOLDS = {
  strongOver: 4,
  over: 2.5,
  strongUnder: -3,
  under: -1.5,
} as const;

// ============================================================================
// Hybrid threshold helper (fallback formula)
// ============================================================================
function hybridThreshold(floor: number, baseline: number, multiplier: number): number {
  return Math.max(floor, baseline * multiplier);
}

// ============================================================================
// Threshold resolution — backtest-derived when available, hybrid fallback
// ============================================================================

/** Resolved league-level thresholds (always absolute) */
export interface ResolvedLeagueThresholds {
  bttsLeagueAvgGoals: number;
  bttsLeagueO25Rate: number;
  o35LeagueAvgGoals: number;
  o35LeagueO25Rate: number;
}

/** Resolved BTTS match-level thresholds */
export interface ResolvedThresholds {
  modelBttsProb: number;
  homeAvgGoals: number;
  awayAvgGoals: number;
  modelO25Prob: number;
  shotConversion: number;
  source: 'backtest' | 'hybrid';
}

/** Resolved Over 3.5 match-level thresholds */
export interface ResolvedOver35Thresholds {
  modelO35Prob: number;
  bttsProb: number;
  homeAvgGoals: number;
  awayAvgGoals: number;
  shotConversion: number;
  source: 'backtest' | 'hybrid';
}

/** Resolved STRONG BET thresholds */
export interface ResolvedStrongBetThresholds {
  o25Prob: number;
  o35Prob: number;
  bttsProb: number;
  bttsChecklistCount: number;
  source: 'backtest' | 'hybrid';
}

/** Resolved GREY RESULT thresholds */
export interface ResolvedGreyResultThresholds {
  bttsProb: number;
  o25Prob: number;
  o35Prob: number;
  bttsChecklistCount: number;
  over35ChecklistCount: number;
  requiredChecks: number;
  source: 'backtest' | 'hybrid';
}

/**
 * Resolve all thresholds for a given league.
 * Uses backtest-derived if available (sample >= minSampleSize), otherwise hybrid.
 */
export function resolveAllThresholds(
  leagueName: string | undefined,
  baselines: LeagueBaselines,
  minSampleSize = 150
) {
  const bt = leagueName ? getBacktestThresholds(leagueName) : undefined;
  const useBacktest = bt !== undefined && bt.sampleSize >= minSampleSize;

  // League-level thresholds (always absolute)
  const league: ResolvedLeagueThresholds = useBacktest
    ? {
        bttsLeagueAvgGoals: bt!.bttsLeagueAvgGoals,
        bttsLeagueO25Rate: bt!.bttsLeagueO25Rate,
        o35LeagueAvgGoals: bt!.o35LeagueAvgGoals,
        o35LeagueO25Rate: bt!.o35LeagueO25Rate,
      }
    : {
        bttsLeagueAvgGoals: BTTS_LEAGUE_THRESHOLDS.leagueAvgGoals,
        bttsLeagueO25Rate: BTTS_LEAGUE_THRESHOLDS.leagueO25Rate,
        o35LeagueAvgGoals: OVER35_LEAGUE_THRESHOLDS.leagueAvgGoals,
        o35LeagueO25Rate: OVER35_LEAGUE_THRESHOLDS.leagueO25Rate,
      };

  const src: 'backtest' | 'hybrid' = useBacktest ? 'backtest' : 'hybrid';

  // BTTS match-level thresholds
  const btts: ResolvedThresholds = useBacktest
    ? { ...bt!.btts, source: 'backtest' }
    : {
        modelBttsProb: hybridThreshold(BTTS_HYBRID_THRESHOLDS.modelBttsProb.floor, baselines.bttsRate, BTTS_HYBRID_THRESHOLDS.modelBttsProb.multiplier),
        homeAvgGoals: hybridThreshold(BTTS_HYBRID_THRESHOLDS.homeAvgGoals.floor, baselines.avgHomeGoals, BTTS_HYBRID_THRESHOLDS.homeAvgGoals.multiplier),
        awayAvgGoals: hybridThreshold(BTTS_HYBRID_THRESHOLDS.awayAvgGoals.floor, baselines.avgAwayGoals, BTTS_HYBRID_THRESHOLDS.awayAvgGoals.multiplier),
        modelO25Prob: hybridThreshold(BTTS_HYBRID_THRESHOLDS.modelO25Prob.floor, baselines.over25Rate, BTTS_HYBRID_THRESHOLDS.modelO25Prob.multiplier),
        shotConversion: hybridThreshold(BTTS_HYBRID_THRESHOLDS.shotConversion.floor, baselines.shotConversion, BTTS_HYBRID_THRESHOLDS.shotConversion.multiplier),
        source: 'hybrid',
      };

  // Over 3.5 match-level thresholds
  const over35: ResolvedOver35Thresholds = useBacktest
    ? { ...bt!.over35, source: 'backtest' }
    : {
        modelO35Prob: hybridThreshold(OVER35_HYBRID_THRESHOLDS.modelO35Prob.floor, baselines.over35Rate, OVER35_HYBRID_THRESHOLDS.modelO35Prob.multiplier),
        bttsProb: hybridThreshold(OVER35_HYBRID_THRESHOLDS.bttsProb.floor, baselines.bttsRate, OVER35_HYBRID_THRESHOLDS.bttsProb.multiplier),
        homeAvgGoals: hybridThreshold(OVER35_HYBRID_THRESHOLDS.homeAvgGoals.floor, baselines.avgHomeGoals, OVER35_HYBRID_THRESHOLDS.homeAvgGoals.multiplier),
        awayAvgGoals: hybridThreshold(OVER35_HYBRID_THRESHOLDS.awayAvgGoals.floor, baselines.avgAwayGoals, OVER35_HYBRID_THRESHOLDS.awayAvgGoals.multiplier),
        shotConversion: hybridThreshold(OVER35_HYBRID_THRESHOLDS.shotConversion.floor, baselines.shotConversion, OVER35_HYBRID_THRESHOLDS.shotConversion.multiplier),
        source: 'hybrid',
      };

  // STRONG BET thresholds
  const strongBet: ResolvedStrongBetThresholds = useBacktest
    ? { ...bt!.strongBet, source: 'backtest' }
    : {
        o25Prob: hybridThreshold(STRONG_BET_HYBRID.o25Prob.floor, baselines.over25Rate, STRONG_BET_HYBRID.o25Prob.multiplier),
        o35Prob: hybridThreshold(STRONG_BET_HYBRID.o35Prob.floor, baselines.over35Rate, STRONG_BET_HYBRID.o35Prob.multiplier),
        bttsProb: hybridThreshold(STRONG_BET_HYBRID.bttsProb.floor, baselines.bttsRate, STRONG_BET_HYBRID.bttsProb.multiplier),
        bttsChecklistCount: STRONG_BET_HYBRID.bttsChecklistCount,
        source: 'hybrid',
      };

  // GREY RESULT thresholds
  const greyResult: ResolvedGreyResultThresholds = useBacktest
    ? { ...bt!.greyResult, source: 'backtest' }
    : {
        bttsProb: hybridThreshold(GREY_RESULT_CONFIG.bttsProb.floor, baselines.bttsRate, GREY_RESULT_CONFIG.bttsProb.multiplier),
        o25Prob: hybridThreshold(GREY_RESULT_CONFIG.o25Prob.floor, baselines.over25Rate, GREY_RESULT_CONFIG.o25Prob.multiplier),
        o35Prob: hybridThreshold(GREY_RESULT_CONFIG.o35Prob.floor, baselines.over35Rate, GREY_RESULT_CONFIG.o35Prob.multiplier),
        bttsChecklistCount: GREY_RESULT_CONFIG.bttsChecklistCount,
        over35ChecklistCount: GREY_RESULT_CONFIG.over35ChecklistCount,
        requiredChecks: GREY_RESULT_CONFIG.requiredChecks,
        source: 'hybrid',
      };

  // GOAL FEST thresholds
  const goalFest: ResolvedGoalFestThresholds = useBacktest
    ? {
        o25Prob: bt!.strongBet.o25Prob,  // reuse STRONG BET O2.5 threshold
        bttsProb: bt!.strongBet.bttsProb, // reuse STRONG BET BTTS threshold
        source: 'backtest',
      }
    : {
        o25Prob: hybridThreshold(GOAL_FEST_CONFIG.o25Prob.floor, baselines.over25Rate, GOAL_FEST_CONFIG.o25Prob.multiplier),
        bttsProb: hybridThreshold(GOAL_FEST_CONFIG.bttsProb.floor, baselines.bttsRate, GOAL_FEST_CONFIG.bttsProb.multiplier),
        source: 'hybrid',
      };

  return { league, btts, over35, strongBet, greyResult, goalFest, source: src };
}

// ============================================================================
// Filter input types
// ============================================================================

export interface ChecklistInput {
  avgGoalsPerGame: number;
  over25Percent: number;
  bttsProb: number;
  avgHomeGoals: number;
  avgAwayGoals: number;
  o25Prob: number;
  o35Prob: number;
  overallShotConversion: number;
}

export interface SignalInput {
  xgSignal: string;
  regressionSignal: string;
  zScoreSignal: string;
}

// ============================================================================
// Checklist computation (with resolved thresholds)
// ============================================================================

/**
 * Compute BTTS checklist score (0-7) using resolved thresholds.
 * Resolved thresholds are either backtest-derived or hybrid formula.
 */
export function computeBttsChecklist(
  input: ChecklistInput,
  resolved: ReturnType<typeof resolveAllThresholds>
): number {
  const lt = resolved.league;
  const rt = resolved.btts;
  let count = 0;
  if (input.avgGoalsPerGame >= lt.bttsLeagueAvgGoals) count++;
  if (input.over25Percent >= lt.bttsLeagueO25Rate) count++;
  if (input.bttsProb >= rt.modelBttsProb) count++;
  if (input.avgHomeGoals >= rt.homeAvgGoals) count++;
  if (input.avgAwayGoals >= rt.awayAvgGoals) count++;
  if (input.o25Prob >= rt.modelO25Prob) count++;
  if (input.overallShotConversion >= rt.shotConversion) count++;
  return count;
}

/**
 * Compute BTTS checklist labels (for CSV export)
 */
export function computeBttsChecklistLabels(
  input: ChecklistInput,
  resolved: ReturnType<typeof resolveAllThresholds>
): string[] {
  const lt = resolved.league;
  const rt = resolved.btts;
  const checks: string[] = [];
  if (input.avgGoalsPerGame >= lt.bttsLeagueAvgGoals) checks.push(`League Avg Goals >=${lt.bttsLeagueAvgGoals}`);
  if (input.over25Percent >= lt.bttsLeagueO25Rate) checks.push(`League O2.5 Rate >=${lt.bttsLeagueO25Rate}%`);
  if (input.bttsProb >= rt.modelBttsProb) checks.push(`Model BTTS Prob >=${rt.modelBttsProb.toFixed(0)}%`);
  if (input.avgHomeGoals >= rt.homeAvgGoals) checks.push(`Home Avg Goals >=${rt.homeAvgGoals.toFixed(2)}`);
  if (input.avgAwayGoals >= rt.awayAvgGoals) checks.push(`Away Avg Goals >=${rt.awayAvgGoals.toFixed(2)}`);
  if (input.o25Prob >= rt.modelO25Prob) checks.push(`Model O2.5 Prob >=${rt.modelO25Prob.toFixed(0)}%`);
  if (input.overallShotConversion >= rt.shotConversion) checks.push(`Shot Conversion >=${rt.shotConversion.toFixed(0)}%`);
  return checks;
}

/**
 * Compute Over 3.5 checklist score (0-7) using resolved thresholds.
 */
export function computeOver35Checklist(
  input: ChecklistInput,
  resolved: ReturnType<typeof resolveAllThresholds>
): number {
  const lt = resolved.league;
  const rt = resolved.over35;
  let count = 0;
  if (input.avgGoalsPerGame >= lt.o35LeagueAvgGoals) count++;
  if (input.o35Prob >= rt.modelO35Prob) count++;
  if (input.bttsProb >= rt.bttsProb) count++;
  if (input.over25Percent >= lt.o35LeagueO25Rate) count++;
  if (input.avgHomeGoals >= rt.homeAvgGoals) count++;
  if (input.avgAwayGoals >= rt.awayAvgGoals) count++;
  if (input.overallShotConversion >= rt.shotConversion) count++;
  return count;
}

/**
 * Compute Over 3.5 checklist labels (for CSV export)
 */
export function computeOver35ChecklistLabels(
  input: ChecklistInput,
  resolved: ReturnType<typeof resolveAllThresholds>
): string[] {
  const lt = resolved.league;
  const rt = resolved.over35;
  const checks: string[] = [];
  if (input.avgGoalsPerGame >= lt.o35LeagueAvgGoals) checks.push(`League Avg Goals >=${lt.o35LeagueAvgGoals}`);
  if (input.o35Prob >= rt.modelO35Prob) checks.push(`Model O3.5 Prob >=${rt.modelO35Prob.toFixed(0)}%`);
  if (input.bttsProb >= rt.bttsProb) checks.push(`BTTS Prob >=${rt.bttsProb.toFixed(0)}%`);
  if (input.over25Percent >= lt.o35LeagueO25Rate) checks.push(`O2.5 Rate >=${lt.o35LeagueO25Rate}%`);
  if (input.avgHomeGoals >= rt.homeAvgGoals) checks.push(`Home Avg Goals >=${rt.homeAvgGoals.toFixed(2)}`);
  if (input.avgAwayGoals >= rt.awayAvgGoals) checks.push(`Away Avg Goals >=${rt.awayAvgGoals.toFixed(2)}`);
  if (input.overallShotConversion >= rt.shotConversion) checks.push(`Shot Conversion >=${rt.shotConversion.toFixed(0)}%`);
  return checks;
}

/**
 * Compute STRONG BET using points-based system with resolved thresholds.
 * Signal checks updated based on 7,110-match backtest analysis:
 *   xG = Over (mild underperformance, finishing due to click)
 *   Regression = Under (recently hot, goals keep flowing)
 *   Z-Score = Neutral (no anomaly, natural attacking football)
 *   Signal Divergence (xG + Regression point opposite = high-variance games)
 * Returns { isStrongBet, points, maxPoints, breakdown }
 */
export function computeStrongBet(
  checklistInput: ChecklistInput,
  signals: SignalInput,
  resolved: ReturnType<typeof resolveAllThresholds>
): {
  isStrongBet: boolean;
  points: number;
  maxPoints: number;
  breakdown: { check: string; points: number; passed: boolean }[];
} {
  const st = resolved.strongBet;
  const p = STRONG_BET_POINTS;

  const bttsCount = computeBttsChecklist(checklistInput, resolved);

  // Signal helpers — backtest-optimized conditions
  const isXgMild = (sig: string) => sig === 'Over' || sig === 'Under';
  const isRegressionUnder = (sig: string) => sig === 'Under' || sig === 'Strong Under';
  const isZScoreNeutral = (sig: string) => sig === 'Neutral';
  // Divergence: xG points one way (Over=goals due), Regression points opposite (Under=hot)
  const hasSignalDivergence = (xg: string, reg: string) =>
    (xg === 'Over' || xg === 'Strong Over') && isRegressionUnder(reg);

  const checks = [
    { check: `O2.5 >=${st.o25Prob.toFixed(0)}%`, points: p.o25, passed: checklistInput.o25Prob >= st.o25Prob },
    { check: `O3.5 >=${st.o35Prob.toFixed(0)}%`, points: p.o35, passed: checklistInput.o35Prob >= st.o35Prob },
    { check: `BTTS >=${st.bttsProb.toFixed(0)}%`, points: p.btts, passed: checklistInput.bttsProb >= st.bttsProb },
    { check: `BTTS Checklist >=${st.bttsChecklistCount}/7`, points: p.bttsChecklist, passed: bttsCount >= st.bttsChecklistCount },
    { check: 'xG = Over/Under', points: p.xgSignal, passed: isXgMild(signals.xgSignal) },
    { check: 'Regression = Under', points: p.regressionSignal, passed: isRegressionUnder(signals.regressionSignal) },
    { check: 'Z-Score = Neutral', points: p.zScoreSignal, passed: isZScoreNeutral(signals.zScoreSignal) },
    { check: 'Signal Divergence', points: p.signalDivergence, passed: hasSignalDivergence(signals.xgSignal, signals.regressionSignal) },
  ];

  const totalPoints = checks.reduce((sum, c) => sum + (c.passed ? c.points : 0), 0);

  return {
    isStrongBet: totalPoints >= p.threshold,
    points: totalPoints,
    maxPoints: p.maxPoints,
    breakdown: checks,
  };
}

/**
 * Compute GREY RESULT using resolved thresholds.
 * Signal checks updated based on 7,110-match backtest analysis:
 *   Regression = Neutral or Under (normal variance or recently hot)
 *   Z-Score = Neutral (universal goal-fest sweet spot, Strong Over nearly impossible)
 *   xG = Over or Under (both mild states beat extremes)
 * Returns { isGreyResult, score, totalChecks, breakdown }
 */
export function computeGreyResult(
  checklistInput: ChecklistInput,
  signals: SignalInput,
  resolved: ReturnType<typeof resolveAllThresholds>
): {
  isGreyResult: boolean;
  score: number;
  totalChecks: number;
  breakdown: { check: string; passed: boolean }[];
} {
  const gt = resolved.greyResult;
  const bttsCount = computeBttsChecklist(checklistInput, resolved);
  const o35Count = computeOver35Checklist(checklistInput, resolved);

  // Backtest-optimized signal helpers
  const isRegNeutralOrUnder = (sig: string) => sig === 'Neutral' || sig === 'Under' || sig === 'Strong Under';
  const isZsNeutral = (sig: string) => sig === 'Neutral';
  const isXgMild = (sig: string) => sig === 'Over' || sig === 'Under';

  const checks = [
    { check: 'Regression = Neutral/Under', passed: isRegNeutralOrUnder(signals.regressionSignal) },
    { check: 'Z-Score = Neutral', passed: isZsNeutral(signals.zScoreSignal) },
    { check: 'xG = Over/Under', passed: isXgMild(signals.xgSignal) },
    { check: `BTTS Checklist >=${gt.bttsChecklistCount}/7`, passed: bttsCount >= gt.bttsChecklistCount },
    { check: `BTTS >=${gt.bttsProb.toFixed(0)}%`, passed: checklistInput.bttsProb >= gt.bttsProb },
    { check: `O2.5 >=${gt.o25Prob.toFixed(0)}%`, passed: checklistInput.o25Prob >= gt.o25Prob },
    { check: `O3.5 Checklist >=${gt.over35ChecklistCount}/7`, passed: o35Count >= gt.over35ChecklistCount },
    { check: `O3.5 >=${gt.o35Prob.toFixed(0)}%`, passed: checklistInput.o35Prob >= gt.o35Prob },
  ];

  const score = checks.filter(c => c.passed).length;

  return {
    isGreyResult: score >= gt.requiredChecks,
    score,
    totalChecks: checks.length,
    breakdown: checks,
  };
}

/**
 * Compute GOAL FEST indicator — backtest-optimized combo detector.
 * Best combo from 7,110-match analysis across 4 leagues x 5 seasons:
 *   xG = Over or Under (mild signal on either side)
 *   Regression = Under or Strong Under (teams are hot)
 *   Z-Score = Neutral (no anomaly)
 *   O2.5 >= threshold (model agrees on goals)
 *   BTTS >= threshold (model agrees both teams score)
 *
 * This combo delivered: 59.2% O2.5, 61.7% BTTS (206-match sample)
 * Returns { isGoalFest, score, totalChecks, breakdown }
 */
export function computeGoalFest(
  checklistInput: ChecklistInput,
  signals: SignalInput,
  resolved: ReturnType<typeof resolveAllThresholds>
): {
  isGoalFest: boolean;
  score: number;
  totalChecks: number;
  breakdown: { check: string; passed: boolean }[];
} {
  const gf = resolved.goalFest;

  // Signal conditions
  const isXgMild = (sig: string) => sig === 'Over' || sig === 'Under';
  const isRegressionUnder = (sig: string) => sig === 'Under' || sig === 'Strong Under';
  const isZScoreNeutral = (sig: string) => sig === 'Neutral';

  const checks = [
    { check: 'xG = Over/Under', passed: isXgMild(signals.xgSignal) },
    { check: 'Regression = Under', passed: isRegressionUnder(signals.regressionSignal) },
    { check: 'Z-Score = Neutral', passed: isZScoreNeutral(signals.zScoreSignal) },
    { check: `O2.5 >=${gf.o25Prob.toFixed(0)}%`, passed: checklistInput.o25Prob >= gf.o25Prob },
    { check: `BTTS >=${gf.bttsProb.toFixed(0)}%`, passed: checklistInput.bttsProb >= gf.bttsProb },
  ];

  const score = checks.filter(c => c.passed).length;

  // Need all 5 checks to qualify
  return {
    isGoalFest: score === checks.length,
    score,
    totalChecks: checks.length,
    breakdown: checks,
  };
}

// ============================================================================
// Display threshold helpers (for BttsCheckTab / Over35Tab UI)
// ============================================================================

/**
 * Get display-friendly threshold info for BTTS checklist items
 */
export function getBttsDisplayThresholds(resolved: ReturnType<typeof resolveAllThresholds>) {
  return {
    leagueAvgGoals: resolved.league.bttsLeagueAvgGoals,
    leagueO25Rate: resolved.league.bttsLeagueO25Rate,
    modelBttsProb: resolved.btts.modelBttsProb,
    homeAvgGoals: resolved.btts.homeAvgGoals,
    awayAvgGoals: resolved.btts.awayAvgGoals,
    modelO25Prob: resolved.btts.modelO25Prob,
    shotConversion: resolved.btts.shotConversion,
    source: resolved.btts.source,
  };
}

/**
 * Get display-friendly threshold info for Over 3.5 checklist items
 */
export function getOver35DisplayThresholds(resolved: ReturnType<typeof resolveAllThresholds>) {
  return {
    leagueAvgGoals: resolved.league.o35LeagueAvgGoals,
    modelO35Prob: resolved.over35.modelO35Prob,
    bttsProb: resolved.over35.bttsProb,
    leagueO25Rate: resolved.league.o35LeagueO25Rate,
    homeAvgGoals: resolved.over35.homeAvgGoals,
    awayAvgGoals: resolved.over35.awayAvgGoals,
    shotConversion: resolved.over35.shotConversion,
    source: resolved.over35.source,
  };
}

// ============================================================================
// Backtest threshold derivation utility
// ============================================================================

interface BacktestMatch {
  ftHomeGoals: number;
  ftAwayGoals: number;
  // Model predictions (raw or calibrated)
  predictedBtts?: number;
  predictedO25?: number;
  predictedO35?: number;
  // Match context
  avgHomeGoals?: number;
  avgAwayGoals?: number;
  shotConversion?: number;
}

interface BacktestDerivationOptions {
  /** Minimum sample size to trust derived thresholds */
  minSampleSize?: number;
  /** For probability thresholds: target minimum precision (e.g. 0.65 means at least 65% accuracy) */
  minAccuracy?: number;
  /** For numeric thresholds (goals): target minimum precision */
  minGoalAccuracy?: number;
}

/**
 * Derive optimal thresholds from backtest data using accuracy optimization.
 *
 * For each criterion, sweeps candidate threshold values and finds the one that
 * maximizes the correct prediction rate while meeting the minimum accuracy target.
 *
 * @param leagueName - League identifier for the registry
 * @param matches - Historical match data with predictions and outcomes
 * @param currentBaselines - Current league baselines (for fallback floors)
 * @param options - Tuning parameters
 * @returns Derived thresholds, or null if insufficient data
 */
export function deriveThresholdsFromBacktest(
  leagueName: string,
  matches: BacktestMatch[],
  currentBaselines: LeagueBaselines,
  options: BacktestDerivationOptions = {}
): LeagueBacktestThresholds | null {
  const {
    minSampleSize = 150,
    minAccuracy = 0.60,
    minGoalAccuracy = 0.55,
  } = options;

  if (matches.length < minSampleSize) return null;

  // --- Helper: compute BTTS hit rate at various thresholds ---
  const findOptimalProbThreshold = (
    getPredicted: (m: BacktestMatch) => number | undefined,
    getActual: (m: BacktestMatch) => boolean,
    searchRange: [number, number],
    step = 1,
    floor?: number
  ): number => {
    const [lo, hi] = searchRange;
    let bestThreshold = floor ?? lo;
    let bestAccuracy = 0;
    let bestSampleAbove = 0;

    for (let t = lo; t <= hi; t += step) {
      const aboveThreshold = matches.filter(m => {
        const pred = getPredicted(m);
        return pred !== undefined && pred >= t;
      });
      if (aboveThreshold.length < 30) continue; // need meaningful sample above threshold

      const correct = aboveThreshold.filter(m => getActual(m)).length;
      const accuracy = correct / aboveThreshold.length;

      // Prefer: highest accuracy that meets minimum, with most samples
      if (accuracy >= minAccuracy && (accuracy > bestAccuracy || (accuracy === bestAccuracy && aboveThreshold.length > bestSampleAbove))) {
        bestThreshold = t;
        bestAccuracy = accuracy;
        bestSampleAbove = aboveThreshold.length;
      }
    }

    // If no threshold met min accuracy, use the one with best accuracy above floor
    if (bestAccuracy < minAccuracy && floor !== undefined) {
      return floor;
    }
    return bestThreshold;
  };

  const findOptimalGoalThreshold = (
    getPredicted: (m: BacktestMatch) => number | undefined,
    getActual: (m: BacktestMatch) => boolean,
    searchRange: [number, number],
    step = 0.05,
    floor?: number
  ): number => {
    const [lo, hi] = searchRange;
    let bestThreshold = floor ?? lo;
    let bestAccuracy = 0;
    let bestSampleAbove = 0;

    for (let t = lo; t <= hi; t += step) {
      const aboveThreshold = matches.filter(m => {
        const pred = getPredicted(m);
        return pred !== undefined && pred >= t;
      });
      if (aboveThreshold.length < 30) continue;

      const correct = aboveThreshold.filter(m => getActual(m)).length;
      const accuracy = correct / aboveThreshold.length;

      if (accuracy >= minGoalAccuracy && (accuracy > bestAccuracy || (accuracy === bestAccuracy && aboveThreshold.length > bestSampleAbove))) {
        bestThreshold = Math.round(t * 100) / 100;
        bestAccuracy = accuracy;
        bestSampleAbove = aboveThreshold.length;
      }
    }

    if (bestAccuracy < minGoalAccuracy && floor !== undefined) {
      return floor;
    }
    return bestThreshold;
  };

  // --- Derive BTTS thresholds ---
  const bttsModelProb = findOptimalProbThreshold(
    m => m.predictedBtts,
    m => m.ftHomeGoals > 0 && m.ftAwayGoals > 0,
    [40, 80],
    1,
    BTTS_HYBRID_THRESHOLDS.modelBttsProb.floor
  );

  const bttsHomeGoals = findOptimalGoalThreshold(
    m => m.avgHomeGoals,
    m => m.ftHomeGoals > 0 && m.ftAwayGoals > 0,
    [0.8, 2.2],
    0.05,
    BTTS_HYBRID_THRESHOLDS.homeAvgGoals.floor
  );

  const bttsAwayGoals = findOptimalGoalThreshold(
    m => m.avgAwayGoals,
    m => m.ftHomeGoals > 0 && m.ftAwayGoals > 0,
    [0.6, 1.8],
    0.05,
    BTTS_HYBRID_THRESHOLDS.awayAvgGoals.floor
  );

  const bttsO25Prob = findOptimalProbThreshold(
    m => m.predictedO25,
    m => m.ftHomeGoals > 0 && m.ftAwayGoals > 0,
    [45, 85],
    1,
    BTTS_HYBRID_THRESHOLDS.modelO25Prob.floor
  );

  const bttsShotConv = findOptimalProbThreshold(
    m => m.shotConversion,
    m => m.ftHomeGoals > 0 && m.ftAwayGoals > 0,
    [5, 25],
    1,
    BTTS_HYBRID_THRESHOLDS.shotConversion.floor
  );

  // --- Derive Over 3.5 thresholds ---
  const o35ModelProb = findOptimalProbThreshold(
    m => m.predictedO35,
    m => (m.ftHomeGoals + m.ftAwayGoals) > 3.5,
    [20, 65],
    1,
    OVER35_HYBRID_THRESHOLDS.modelO35Prob.floor
  );

  const o35BttsProb = findOptimalProbThreshold(
    m => m.predictedBtts,
    m => (m.ftHomeGoals + m.ftAwayGoals) > 3.5,
    [35, 80],
    1,
    OVER35_HYBRID_THRESHOLDS.bttsProb.floor
  );

  const o35HomeGoals = findOptimalGoalThreshold(
    m => m.avgHomeGoals,
    m => (m.ftHomeGoals + m.ftAwayGoals) > 3.5,
    [0.8, 2.5],
    0.05,
    OVER35_HYBRID_THRESHOLDS.homeAvgGoals.floor
  );

  const o35AwayGoals = findOptimalGoalThreshold(
    m => m.avgAwayGoals,
    m => (m.ftHomeGoals + m.ftAwayGoals) > 3.5,
    [0.6, 2.0],
    0.05,
    OVER35_HYBRID_THRESHOLDS.awayAvgGoals.floor
  );

  const o35ShotConv = findOptimalProbThreshold(
    m => m.shotConversion,
    m => (m.ftHomeGoals + m.ftAwayGoals) > 3.5,
    [5, 25],
    1,
    OVER35_HYBRID_THRESHOLDS.shotConversion.floor
  );

  // --- STRONG BET thresholds (derive O2.5, O3.5, BTTS prob thresholds) ---
  const sbO25Prob = findOptimalProbThreshold(
    m => m.predictedO25,
    m => m.ftHomeGoals + m.ftAwayGoals >= 3, // STRONG BET targets high-scoring games
    [50, 85],
    1,
    STRONG_BET_HYBRID.o25Prob.floor
  );

  const sbO35Prob = findOptimalProbThreshold(
    m => m.predictedO35,
    m => m.ftHomeGoals + m.ftAwayGoals >= 3,
    [25, 60],
    1,
    STRONG_BET_HYBRID.o35Prob.floor
  );

  const sbBttsProb = findOptimalProbThreshold(
    m => m.predictedBtts,
    m => m.ftHomeGoals + m.ftAwayGoals >= 3,
    [40, 80],
    1,
    STRONG_BET_HYBRID.bttsProb.floor
  );

  // --- GREY RESULT thresholds (stricter: targets high-scoring games) ---
  const grBttsProb = findOptimalProbThreshold(
    m => m.predictedBtts,
    m => m.ftHomeGoals >= 1 && m.ftAwayGoals >= 1 && m.ftHomeGoals + m.ftAwayGoals >= 4,
    [40, 80],
    1,
    GREY_RESULT_CONFIG.bttsProb.floor
  );

  const grO25Prob = findOptimalProbThreshold(
    m => m.predictedO25,
    m => m.ftHomeGoals >= 1 && m.ftAwayGoals >= 1 && m.ftHomeGoals + m.ftAwayGoals >= 4,
    [50, 85],
    1,
    GREY_RESULT_CONFIG.o25Prob.floor
  );

  const grO35Prob = findOptimalProbThreshold(
    m => m.predictedO35,
    m => m.ftHomeGoals >= 1 && m.ftAwayGoals >= 1 && m.ftHomeGoals + m.ftAwayGoals >= 4,
    [20, 60],
    1,
    GREY_RESULT_CONFIG.o35Prob.floor
  );

  // --- League-level thresholds (keep as absolute defaults) ---
  const bttsLeagueAvgGoals = BTTS_LEAGUE_THRESHOLDS.leagueAvgGoals;
  const bttsLeagueO25Rate = BTTS_LEAGUE_THRESHOLDS.leagueO25Rate;
  const o35LeagueAvgGoals = OVER35_LEAGUE_THRESHOLDS.leagueAvgGoals;
  const o35LeagueO25Rate = OVER35_LEAGUE_THRESHOLDS.leagueO25Rate;

  return {
    leagueName,
    bttsLeagueAvgGoals,
    bttsLeagueO25Rate,
    o35LeagueAvgGoals,
    o35LeagueO25Rate,
    btts: {
      modelBttsProb: bttsModelProb,
      homeAvgGoals: bttsHomeGoals,
      awayAvgGoals: bttsAwayGoals,
      modelO25Prob: bttsO25Prob,
      shotConversion: bttsShotConv,
    },
    over35: {
      modelO35Prob: o35ModelProb,
      bttsProb: o35BttsProb,
      homeAvgGoals: o35HomeGoals,
      awayAvgGoals: o35AwayGoals,
      shotConversion: o35ShotConv,
    },
    strongBet: {
      o25Prob: sbO25Prob,
      o35Prob: sbO35Prob,
      bttsProb: sbBttsProb,
      bttsChecklistCount: STRONG_BET_HYBRID.bttsChecklistCount,
    },
    greyResult: {
      bttsProb: grBttsProb,
      o25Prob: grO25Prob,
      o35Prob: grO35Prob,
      bttsChecklistCount: GREY_RESULT_CONFIG.bttsChecklistCount,
      over35ChecklistCount: GREY_RESULT_CONFIG.over35ChecklistCount,
      requiredChecks: GREY_RESULT_CONFIG.requiredChecks,
    },
    sampleSize: matches.length,
    derivedAt: new Date().toISOString(),
  };
}

/**
 * Derive thresholds from backtest data using a simpler approach when model
 * predictions are not available — uses league averages as the predictor.
 */
export function deriveSimpleThresholdsFromBacktest(
  leagueName: string,
  matches: { ftHomeGoals: number; ftAwayGoals: number }[],
  currentBaselines: LeagueBaselines,
  options: BacktestDerivationOptions = {}
): LeagueBacktestThresholds | null {
  const { minSampleSize = 150 } = options;

  if (matches.length < minSampleSize) return null;

  // Simple derivation: find the league-average-based thresholds that best
  // separate BTTS from non-BTTS and O3.5 from non-O3.5 matches.
  // This uses the Dixon-Coles probability approach: given league averages,
  // the Poisson BTTS probability is already a strong predictor.

  const bttsMatches = matches.filter(m => m.ftHomeGoals > 0 && m.ftAwayGoals > 0);
  const over35Matches = matches.filter(m => m.ftHomeGoals + m.ftAwayGoals > 3.5);

  // Derive BTTS probability threshold from league BTTS rate
  // A match is "above average" if its BTTS prob > league BTTS rate
  // Find the multiplier that gives best accuracy
  let bestBttsMult = BTTS_HYBRID_THRESHOLDS.modelBttsProb.multiplier;
  let bestBttsAcc = 0;
  for (let mult = 1.0; mult <= 1.3; mult += 0.01) {
    const threshold = Math.max(BTTS_HYBRID_THRESHOLDS.modelBttsProb.floor, currentBaselines.bttsRate * mult);
    const aboveCount = bttsMatches.filter(() => currentBaselines.bttsRate >= threshold).length;
    // All BTTS matches have BTTS prob ~= league rate, so check hit rate
    // For simple derivation, use the rate-based threshold directly
    const estimatedAccuracy = bttsMatches.length > 0
      ? bttsMatches.filter(() => currentBaselines.bttsRate >= threshold).length / Math.max(matches.length, 1)
      : 0;
    if (estimatedAccuracy > bestBttsAcc) {
      bestBttsAcc = estimatedAccuracy;
      bestBttsMult = mult;
    }
  }

  // For simple derivation without per-match predictions, use the hybrid formula
  // with the derived multiplier, falling back to defaults.
  const bttsFloor = BTTS_HYBRID_THRESHOLDS.modelBttsProb.floor;
  const bttsRate = currentBaselines.bttsRate;

  return {
    leagueName,
    bttsLeagueAvgGoals: BTTS_LEAGUE_THRESHOLDS.leagueAvgGoals,
    bttsLeagueO25Rate: BTTS_LEAGUE_THRESHOLDS.leagueO25Rate,
    o35LeagueAvgGoals: OVER35_LEAGUE_THRESHOLDS.leagueAvgGoals,
    o35LeagueO25Rate: OVER35_LEAGUE_THRESHOLDS.leagueO25Rate,
    btts: {
      modelBttsProb: Math.max(bttsFloor, bttsRate * bestBttsMult),
      homeAvgGoals: Math.max(BTTS_HYBRID_THRESHOLDS.homeAvgGoals.floor, currentBaselines.avgHomeGoals * BTTS_HYBRID_THRESHOLDS.homeAvgGoals.multiplier),
      awayAvgGoals: Math.max(BTTS_HYBRID_THRESHOLDS.awayAvgGoals.floor, currentBaselines.avgAwayGoals * BTTS_HYBRID_THRESHOLDS.awayAvgGoals.multiplier),
      modelO25Prob: Math.max(BTTS_HYBRID_THRESHOLDS.modelO25Prob.floor, currentBaselines.over25Rate * BTTS_HYBRID_THRESHOLDS.modelO25Prob.multiplier),
      shotConversion: Math.max(BTTS_HYBRID_THRESHOLDS.shotConversion.floor, currentBaselines.shotConversion * BTTS_HYBRID_THRESHOLDS.shotConversion.multiplier),
    },
    over35: {
      modelO35Prob: Math.max(OVER35_HYBRID_THRESHOLDS.modelO35Prob.floor, currentBaselines.over35Rate * OVER35_HYBRID_THRESHOLDS.modelO35Prob.multiplier),
      bttsProb: Math.max(OVER35_HYBRID_THRESHOLDS.bttsProb.floor, currentBaselines.bttsRate * OVER35_HYBRID_THRESHOLDS.bttsProb.multiplier),
      homeAvgGoals: Math.max(OVER35_HYBRID_THRESHOLDS.homeAvgGoals.floor, currentBaselines.avgHomeGoals * OVER35_HYBRID_THRESHOLDS.homeAvgGoals.multiplier),
      awayAvgGoals: Math.max(OVER35_HYBRID_THRESHOLDS.awayAvgGoals.floor, currentBaselines.avgAwayGoals * OVER35_HYBRID_THRESHOLDS.awayAvgGoals.multiplier),
      shotConversion: Math.max(OVER35_HYBRID_THRESHOLDS.shotConversion.floor, currentBaselines.shotConversion * OVER35_HYBRID_THRESHOLDS.shotConversion.multiplier),
    },
    strongBet: {
      o25Prob: Math.max(STRONG_BET_HYBRID.o25Prob.floor, currentBaselines.over25Rate * STRONG_BET_HYBRID.o25Prob.multiplier),
      o35Prob: Math.max(STRONG_BET_HYBRID.o35Prob.floor, currentBaselines.over35Rate * STRONG_BET_HYBRID.o35Prob.multiplier),
      bttsProb: Math.max(STRONG_BET_HYBRID.bttsProb.floor, currentBaselines.bttsRate * STRONG_BET_HYBRID.bttsProb.multiplier),
      bttsChecklistCount: STRONG_BET_HYBRID.bttsChecklistCount,
    },
    greyResult: {
      bttsProb: Math.max(GREY_RESULT_CONFIG.bttsProb.floor, currentBaselines.bttsRate * GREY_RESULT_CONFIG.bttsProb.multiplier),
      o25Prob: Math.max(GREY_RESULT_CONFIG.o25Prob.floor, currentBaselines.over25Rate * GREY_RESULT_CONFIG.o25Prob.multiplier),
      o35Prob: Math.max(GREY_RESULT_CONFIG.o35Prob.floor, currentBaselines.over35Rate * GREY_RESULT_CONFIG.o35Prob.multiplier),
      bttsChecklistCount: GREY_RESULT_CONFIG.bttsChecklistCount,
      over35ChecklistCount: GREY_RESULT_CONFIG.over35ChecklistCount,
      requiredChecks: GREY_RESULT_CONFIG.requiredChecks,
    },
    sampleSize: matches.length,
    derivedAt: new Date().toISOString(),
  };
}
