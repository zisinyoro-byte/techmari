// ============================================================================
// Shared Betting Filter Configuration — Single Source of Truth
// ============================================================================
// Lean indicator system — only checks with proven lift survive.
// Removed noise: league-level constants (zero match discrimination),
// season-average goals (stale vs rolling), shot conversion (unverified),
// xG/Z-Score/Regression mild states (fire 60-90% = no selectivity).
//
// Surviving signals:
//   BTTS/O2.5/O3.5 model probabilities (direct target market)
//   O2.5 implied probability from bookmaker odds (strongest single predictor)
//   Rolling combined scoring (recent form, independent of model)
//   Draw probability inverted (structural, independent for BTTS-BH)
//   Signal divergence (xG Over + Regression Under = specific pattern)
//   BTTS probability band (selective constraint for Grey Result)
// =============================================================================

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

/** Thresholds for each BTTS checklist criterion (lean 4-check) */
export interface BttsCriterionThresholds {
  modelBttsProb: number;   // %
  modelO25Prob: number;    // %
}

/** Thresholds for each Over 3.5 checklist criterion (lean 4-check) */
export interface Over35CriterionThresholds {
  modelO35Prob: number;    // %
  bttsProb: number;        // %
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
  bttsProb: number;              // % (lower bound)
  bttsProbMax: number;           // % (upper bound)
  o25Prob: number;               // %
  o35Prob: number;               // %
  bttsChecklistCount: number;    // absolute count
  over35ChecklistCount: number;  // absolute count
  requiredChecks: number;        // absolute count
}

/** Complete threshold set for one league (backtest-derived) */
export interface LeagueBacktestThresholds {
  leagueName: string;
  // Match-level (lean — only proven predictors)
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

// ---- BTTS Checklist criteria (lean 4-check) ----
export const BTTS_HYBRID_THRESHOLDS = {
  modelBttsProb:  { floor: 55, multiplier: 1.12 },
  modelO25Prob:   { floor: 62, multiplier: 1.10 },
} as const;

// O2.5 implied probability thresholds (from 10K-match analysis)
// 65%+ implied → 68.2% O2.5 hit rate (strongest single predictor)
export const O25_IMPLIED_THRESHOLDS = {
  btts: 56,    // BTTS check: odds imply O2.5 is likely
  over35: 59,  // O3.5 check: higher bar
  strongBet: 62, // Strong Bet: significant market confidence
  goalFest: 58, // Goal Fest: moderate market confidence
  bttsBothHalves: 65, // BTTS-BH: high market confidence in goals (90% of BTTS-BH have O2.5 odds < 2.0)
} as const;

// Rolling combined scoring thresholds (from 10K-match analysis)
// Rolling combined scoring adds ~20pp discrimination vs season averages
export const ROLLING_SCORING_THRESHOLDS = {
  btts: 2.5,       // BTTS: both teams scoring recently
  over35: 3.0,     // O3.5: high combined recent scoring
  strongBet: 2.5,  // Strong Bet: moderate recent scoring
  goalFest: 2.8,   // Goal Fest: strong recent scoring
  greyResult: 2.3, // Grey Result: mild recent scoring
  bttsBothHalves: 3.0, // BTTS-BH: both teams must be hot scorers
} as const;

// ---- Over 3.5 Checklist criteria (lean 4-check) ----
export const OVER35_HYBRID_THRESHOLDS = {
  modelO35Prob:   { floor: 40, multiplier: 1.20 },
  bttsProb:       { floor: 52, multiplier: 1.10 },
} as const;

// ---- STRONG BET — Lean points-based system ----
// Only proven predictors: model probabilities, market implied, rolling form,
// checklist composites, and signal divergence (the only selective signal check).
// Removed: xG mild (fires 60-90%), Z-Score neutral (~50-60%), Regression Under
// (overlaps with rolling scoring), BTTS standalone (redundant with O2.5).
export const STRONG_BET_POINTS = {
  o25: 3,
  o35: 2,
  bttsChecklist: 2,
  signalDivergence: 2,
  o25Implied: 2,
  rollingScoring: 2,
  threshold: 7,     // 7 of 13 max — selective but achievable
  maxPoints: 13,
} as const;

export const STRONG_BET_HYBRID = {
  o25Prob:   { floor: 65, multiplier: 1.10 },
  o35Prob:   { floor: 42, multiplier: 1.25 },
  bttsProb:  { floor: 55, multiplier: 1.12 },
  bttsChecklistCount: 3,  // was 6/9, now 3/4 (proportionally equivalent)
} as const;

// ---- GREY RESULT — Lean 7-check system ----
// Targets the "ambiguous zone" — goals are likely but not overwhelmingly bullish.
// Removed noise: Regression neutral/under (75% fire rate), Z-Score neutral/under,
// xG mild (all fire too often to discriminate).
// BTTS band 50-70%: sweet spot where BTTS is likely but not dominant.
export const GREY_RESULT_CONFIG = {
  bttsProb:  { min: 50, max: 70 },
  o25Prob:   { floor: 65, multiplier: 1.10 },
  o35Prob:   { floor: 40, multiplier: 1.20 },
  bttsChecklistCount: 3,    // was 5/9, now 3/4
  over35ChecklistCount: 2,  // was 3/9, now 2/4
  requiredChecks: 5,       // 5 of 7 — lean but selective
} as const;

// ---- GOAL FEST — Lean 6-check combo detector ----
// Removed noise: xG mild (fires ~85-90%), Z-Score neutral (~50-60%).
// Signal divergence is the only selective signal check — it captures a real pattern.
// The remaining checks are all proven probability/form signals.
export const GOAL_FEST_CONFIG = {
  o25Prob:   { floor: 55, multiplier: 1.10 },
  bttsProb:  { floor: 55, multiplier: 1.10 },
  o35Prob:   { floor: 35, multiplier: 1.20 },
  requiredChecks: 5, // 5 of 6 must pass
} as const;

// ---- BTTS BOTH HALVES — Lean 3-check detector ----
// BTTS-BH requires BOTH teams to score in EACH half (minimum 4 goals).
// Base rate: ~5.2% across 7 European leagues (1,249/24,057). Average 5.5 goals.
//
// Calibrated on 24,057 matches (EPL, La Liga, Serie A, Bundesliga, Ligue 1,
// Eredivisie, Primeira Liga) × 10 seasons (2015-16 → 2024-25).
//
// Multi-league sweep confirmed only 3 of 8 original checks have discriminative
// power. The other 5 (BTTS rolling, O3.5 rolling, O2.5 rolling, league avg,
// elite O2.5) are flat (0.99-1.06x lift) across 24K games.
//
// Surviving checks (individual lift at stated threshold):
//   1. O2.5 implied >= 65%: 1.38x lift — bookmaker odds, THE primary signal
//   2. Draw prob < 25%:      1.21x lift — structural: low draw = open play
//   3. Rolling scoring >= 3.0: 1.10x lift — recent form, marginal but independent
//
// Tier system (3 checks, need 2 to qualify):
//   STRONG (3/3):    All signals aligned — rare, highest confidence
//   QUALIFIED (2/3): Core checks pass — actionable signal
//   BORDERLINE (1/3): Weak — one indicator only, watch list
//   UNLIKELY (0/3):  Insufficient evidence
//
// Current config achieves 6.20% hit rate (1.19x lift) at req=5/8.
// The 3-check system with req=2/3 achieves comparable discrimination
// with less noise and a cleaner mental model.
export const BTTS_BOTH_HALVES_CONFIG = {
  o25Implied: 65,        // O2.5 implied probability — PRIMARY signal (1.38x lift at 65%)
  drawProbMax: 25,       // Draw prob BELOW this — low draw = open play (1.21x lift)
  rollingScoring: 3.0,   // Rolling combined scoring — recent form (1.10x lift)
  requiredChecks: 2,     // 2 of 3 must pass to qualify
} as const;

/** Resolved GOAL FEST thresholds */
export interface ResolvedGoalFestThresholds {
  o25Prob: number;
  bttsProb: number;
  o35Prob: number;
  requiredChecks: number;
  source: 'backtest' | 'hybrid';
}

// ---- Signal thresholds (xG, Regression, Z-Score) ----
// xG thresholds tightened from ±0.3/±0.7 to ±0.5/±1.0 based on live results analysis.
// Old thresholds fired 89% of the time (no discrimination). New thresholds target ~30-40%.
export const XG_THRESHOLDS = {
  strongOver: -1.0,
  over: -0.5,
  strongUnder: 1.0,
  under: 0.5,
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

/** Resolved BTTS match-level thresholds (lean 2-field) */
export interface ResolvedThresholds {
  modelBttsProb: number;
  modelO25Prob: number;
  source: 'backtest' | 'hybrid';
}

/** Resolved Over 3.5 match-level thresholds (lean 2-field) */
export interface ResolvedOver35Thresholds {
  modelO35Prob: number;
  bttsProb: number;
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
  bttsProbMax: number;
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

  const src: 'backtest' | 'hybrid' = useBacktest ? 'backtest' : 'hybrid';

  // BTTS match-level thresholds (lean 2-check)
  const btts: ResolvedThresholds = useBacktest
    ? { modelBttsProb: bt!.btts.modelBttsProb, modelO25Prob: bt!.btts.modelO25Prob, source: 'backtest' as const }
    : {
        modelBttsProb: hybridThreshold(BTTS_HYBRID_THRESHOLDS.modelBttsProb.floor, baselines.bttsRate, BTTS_HYBRID_THRESHOLDS.modelBttsProb.multiplier),
        modelO25Prob: hybridThreshold(BTTS_HYBRID_THRESHOLDS.modelO25Prob.floor, baselines.over25Rate, BTTS_HYBRID_THRESHOLDS.modelO25Prob.multiplier),
        source: 'hybrid' as const,
      };

  // Over 3.5 match-level thresholds (lean 2-check)
  const over35: ResolvedOver35Thresholds = useBacktest
    ? { modelO35Prob: bt!.over35.modelO35Prob, bttsProb: bt!.over35.bttsProb, source: 'backtest' as const }
    : {
        modelO35Prob: hybridThreshold(OVER35_HYBRID_THRESHOLDS.modelO35Prob.floor, baselines.over35Rate, OVER35_HYBRID_THRESHOLDS.modelO35Prob.multiplier),
        bttsProb: hybridThreshold(OVER35_HYBRID_THRESHOLDS.bttsProb.floor, baselines.bttsRate, OVER35_HYBRID_THRESHOLDS.bttsProb.multiplier),
        source: 'hybrid' as const,
      };

  // STRONG BET thresholds
  const strongBet: ResolvedStrongBetThresholds = useBacktest
    ? { ...bt!.strongBet, source: 'backtest' }
    : {
        o25Prob: hybridThreshold(STRONG_BET_HYBRID.o25Prob.floor, baselines.over25Rate, STRONG_BET_HYBRID.o25Prob.multiplier),
        o35Prob: hybridThreshold(STRONG_BET_HYBRID.o35Prob.floor, baselines.over35Rate, STRONG_BET_HYBRID.o35Prob.multiplier),
        bttsProb: hybridThreshold(STRONG_BET_HYBRID.bttsProb.floor, baselines.bttsRate, STRONG_BET_HYBRID.bttsProb.multiplier),
        bttsChecklistCount: STRONG_BET_HYBRID.bttsChecklistCount,
        source: 'hybrid' as const,
      };

  // GREY RESULT thresholds
  const greyResult: ResolvedGreyResultThresholds = useBacktest
    ? {
        ...bt!.greyResult,
        bttsProbMax: (bt!.greyResult as any).bttsProbMax ?? GREY_RESULT_CONFIG.bttsProb.max,
        source: 'backtest' as const,
      }
    : {
        bttsProb: GREY_RESULT_CONFIG.bttsProb.min,
        bttsProbMax: GREY_RESULT_CONFIG.bttsProb.max,
        o25Prob: hybridThreshold(GREY_RESULT_CONFIG.o25Prob.floor, baselines.over25Rate, GREY_RESULT_CONFIG.o25Prob.multiplier),
        o35Prob: hybridThreshold(GREY_RESULT_CONFIG.o35Prob.floor, baselines.over35Rate, GREY_RESULT_CONFIG.o35Prob.multiplier),
        bttsChecklistCount: GREY_RESULT_CONFIG.bttsChecklistCount,
        over35ChecklistCount: GREY_RESULT_CONFIG.over35ChecklistCount,
        requiredChecks: GREY_RESULT_CONFIG.requiredChecks,
        source: 'hybrid' as const,
      };

  // GOAL FEST thresholds (lean 6-check)
  const goalFest: ResolvedGoalFestThresholds = useBacktest
    ? {
        o25Prob: bt!.strongBet.o25Prob,
        bttsProb: bt!.strongBet.bttsProb,
        o35Prob: bt!.over35.modelO35Prob,
        requiredChecks: GOAL_FEST_CONFIG.requiredChecks,
        source: 'backtest' as const,
      }
    : {
        o25Prob: hybridThreshold(GOAL_FEST_CONFIG.o25Prob.floor, baselines.over25Rate, GOAL_FEST_CONFIG.o25Prob.multiplier),
        bttsProb: hybridThreshold(GOAL_FEST_CONFIG.bttsProb.floor, baselines.bttsRate, GOAL_FEST_CONFIG.bttsProb.multiplier),
        o35Prob: hybridThreshold(GOAL_FEST_CONFIG.o35Prob.floor, baselines.over35Rate, GOAL_FEST_CONFIG.o35Prob.multiplier),
        requiredChecks: GOAL_FEST_CONFIG.requiredChecks,
        source: 'hybrid' as const,
      };

  return { btts, over35, strongBet, greyResult, goalFest, source: src };
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
  // Rolling 5-game window features (replaces season-level averages)
  rollingHomeScored: number;     // home team's last 5 home games avg scored
  rollingAwayScored: number;     // away team's last 5 away games avg scored
  rollingCombinedScoring: number; // rollingHomeScored + rollingAwayScored
  // O2.5 market implied probability (from bookmaker odds)
  o25ImpliedProb: number | null;  // 1 / oddsAvgOver25 * 100, or null if no odds
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
 * Compute BTTS checklist score (0-4) using resolved thresholds.
 * Lean 4-check system: only proven discriminators survive.
 */
export function computeBttsChecklist(
  input: ChecklistInput,
  resolved: ReturnType<typeof resolveAllThresholds>
): number {
  const rt = resolved.btts;
  let count = 0;
  if (input.bttsProb >= rt.modelBttsProb) count++;
  if (input.o25Prob >= rt.modelO25Prob) count++;
  if (input.o25ImpliedProb !== null && input.o25ImpliedProb >= O25_IMPLIED_THRESHOLDS.btts) count++;
  if (input.rollingCombinedScoring >= ROLLING_SCORING_THRESHOLDS.btts) count++;
  return count;
}

/**
 * Compute BTTS checklist labels (for CSV export)
 */
export function computeBttsChecklistLabels(
  input: ChecklistInput,
  resolved: ReturnType<typeof resolveAllThresholds>
): string[] {
  const rt = resolved.btts;
  const checks: string[] = [];
  if (input.bttsProb >= rt.modelBttsProb) checks.push('Model BTTS Prob >=' + rt.modelBttsProb.toFixed(0) + '%');
  if (input.o25Prob >= rt.modelO25Prob) checks.push('Model O2.5 Prob >=' + rt.modelO25Prob.toFixed(0) + '%');
  if (input.o25ImpliedProb !== null && input.o25ImpliedProb >= O25_IMPLIED_THRESHOLDS.btts) checks.push('O2.5 Implied Prob >=' + O25_IMPLIED_THRESHOLDS.btts + '%');
  if (input.rollingCombinedScoring >= ROLLING_SCORING_THRESHOLDS.btts) checks.push('Rolling Combined Scoring >=' + ROLLING_SCORING_THRESHOLDS.btts);
  return checks;
}

/**
 * Compute Over 3.5 checklist score (0-4) using resolved thresholds.
 * Lean 4-check system: only proven discriminators survive.
 */
export function computeOver35Checklist(
  input: ChecklistInput,
  resolved: ReturnType<typeof resolveAllThresholds>
): number {
  const rt = resolved.over35;
  let count = 0;
  if (input.o35Prob >= rt.modelO35Prob) count++;
  if (input.bttsProb >= rt.bttsProb) count++;
  if (input.o25ImpliedProb !== null && input.o25ImpliedProb >= O25_IMPLIED_THRESHOLDS.over35) count++;
  if (input.rollingCombinedScoring >= ROLLING_SCORING_THRESHOLDS.over35) count++;
  return count;
}

/**
 * Compute Over 3.5 checklist labels (for CSV export)
 */
export function computeOver35ChecklistLabels(
  input: ChecklistInput,
  resolved: ReturnType<typeof resolveAllThresholds>
): string[] {
  const rt = resolved.over35;
  const checks: string[] = [];
  if (input.o35Prob >= rt.modelO35Prob) checks.push('Model O3.5 Prob >=' + rt.modelO35Prob.toFixed(0) + '%');
  if (input.bttsProb >= rt.bttsProb) checks.push('BTTS Prob >=' + rt.bttsProb.toFixed(0) + '%');
  if (input.o25ImpliedProb !== null && input.o25ImpliedProb >= O25_IMPLIED_THRESHOLDS.over35) checks.push('O2.5 Implied Prob >=' + O25_IMPLIED_THRESHOLDS.over35 + '%');
  if (input.rollingCombinedScoring >= ROLLING_SCORING_THRESHOLDS.over35) checks.push('Rolling Combined Scoring >=' + ROLLING_SCORING_THRESHOLDS.over35);
  return checks;
}

/**
 * Compute STRONG BET using lean points-based system.
 * Only proven predictors: model probs, market implied, rolling form,
 * checklist composites, and signal divergence.
 */
export function computeStrongBet(
  checklistInput: ChecklistInput,
  signals: SignalInput,
  resolved: ReturnType<typeof resolveAllThresholds>,
  options?: { momentumSignal?: string; leagueBttsRate?: number }
): {
  isStrongBet: boolean;
  points: number;
  maxPoints: number;
  breakdown: { check: string; points: number; passed: boolean }[];
} {
  const st = resolved.strongBet;
  const p = STRONG_BET_POINTS;

  const bttsCount = computeBttsChecklist(checklistInput, resolved);

  // Signal divergence: xG Over + Regression Under = high-variance game
  const isRegressionUnder = (sig: string) => sig === 'Under' || sig === 'Strong Under';
  const hasSignalDivergence = (xg: string, reg: string) =>
    (xg === 'Over' || xg === 'Strong Over') && isRegressionUnder(reg);

  const checks = [
    { check: 'O2.5 >=' + st.o25Prob.toFixed(0) + '%', points: p.o25, passed: checklistInput.o25Prob >= st.o25Prob },
    { check: 'O3.5 >=' + st.o35Prob.toFixed(0) + '%', points: p.o35, passed: checklistInput.o35Prob >= st.o35Prob },
    { check: 'BTTS Checklist >=' + st.bttsChecklistCount + '/4', points: p.bttsChecklist, passed: bttsCount >= st.bttsChecklistCount },
    { check: 'Signal Divergence (xG vs Reg)', points: p.signalDivergence, passed: hasSignalDivergence(signals.xgSignal, signals.regressionSignal) },
    { check: 'O2.5 Implied >=' + O25_IMPLIED_THRESHOLDS.strongBet + '%', points: p.o25Implied, passed: checklistInput.o25ImpliedProb !== null && checklistInput.o25ImpliedProb >= O25_IMPLIED_THRESHOLDS.strongBet },
    { check: 'Rolling Scoring >=' + ROLLING_SCORING_THRESHOLDS.strongBet, points: p.rollingScoring, passed: checklistInput.rollingCombinedScoring >= ROLLING_SCORING_THRESHOLDS.strongBet },
  ];

  const totalPoints = checks.reduce((sum, c) => sum + (c.passed ? c.points : 0), 0);
  const maxPoints = checks.reduce((sum, c) => sum + c.points, 0);

  return {
    isStrongBet: totalPoints >= p.threshold,
    points: totalPoints,
    maxPoints,
    breakdown: checks,
  };
}

/**
 * Compute GREY RESULT using lean 7-check system.
 * Removed noise signal checks (Regression neutral/under 75%, Z-Score neutral/under,
 * xG mild ~85%). Only proven probability/form checks remain.
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

  const checks = [
    { check: 'BTTS Checklist >=' + gt.bttsChecklistCount + '/4', passed: bttsCount >= gt.bttsChecklistCount },
    { check: 'BTTS ' + gt.bttsProb.toFixed(0) + '-' + gt.bttsProbMax.toFixed(0) + '%', passed: checklistInput.bttsProb >= gt.bttsProb && checklistInput.bttsProb <= gt.bttsProbMax },
    { check: 'O2.5 >=' + gt.o25Prob.toFixed(0) + '%', passed: checklistInput.o25Prob >= gt.o25Prob },
    { check: 'O3.5 Checklist >=' + gt.over35ChecklistCount + '/4', passed: o35Count >= gt.over35ChecklistCount },
    { check: 'O3.5 >=' + gt.o35Prob.toFixed(0) + '%', passed: checklistInput.o35Prob >= gt.o35Prob },
    { check: 'Rolling Scoring >=' + ROLLING_SCORING_THRESHOLDS.greyResult, passed: checklistInput.rollingCombinedScoring >= ROLLING_SCORING_THRESHOLDS.greyResult },
    { check: 'O2.5 Implied >=' + O25_IMPLIED_THRESHOLDS.btts + '%', passed: checklistInput.o25ImpliedProb !== null && checklistInput.o25ImpliedProb >= O25_IMPLIED_THRESHOLDS.btts },
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
 * Compute GOAL FEST indicator — lean 6-check combo detector.
 * Removed noise: xG mild (fires ~85-90%), Z-Score neutral (~50-60%).
 * Signal divergence is the only selective signal check.
 * 6 checks, need 5 to qualify.
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

  // Signal divergence: xG and Regression point opposite directions
  const isRegressionBearish = (sig: string) => sig === 'Under' || sig === 'Strong Under';
  const hasSignalDivergence = (xg: string, reg: string) =>
    (xg === 'Over' || xg === 'Strong Over') && isRegressionBearish(reg);

  const checks = [
    { check: 'Signal Divergence (xG vs Reg)', passed: hasSignalDivergence(signals.xgSignal, signals.regressionSignal) },
    { check: 'O2.5 >=' + gf.o25Prob.toFixed(0) + '%', passed: checklistInput.o25Prob >= gf.o25Prob },
    { check: 'BTTS >=' + gf.bttsProb.toFixed(0) + '%', passed: checklistInput.bttsProb >= gf.bttsProb },
    { check: 'O3.5 >=' + gf.o35Prob.toFixed(0) + '%', passed: checklistInput.o35Prob >= gf.o35Prob },
    { check: 'O2.5 Implied >=' + O25_IMPLIED_THRESHOLDS.goalFest + '%', passed: checklistInput.o25ImpliedProb !== null && checklistInput.o25ImpliedProb >= O25_IMPLIED_THRESHOLDS.goalFest },
    { check: 'Rolling Scoring >=' + ROLLING_SCORING_THRESHOLDS.goalFest, passed: checklistInput.rollingCombinedScoring >= ROLLING_SCORING_THRESHOLDS.goalFest },
  ];

  const score = checks.filter(c => c.passed).length;

  return {
    isGoalFest: score >= gf.requiredChecks,
    score,
    totalChecks: checks.length,
    breakdown: checks,
  };
}

// ============================================================================
// Display threshold helpers (for BttsCheckTab / Over35Tab UI)
// ============================================================================

/**
 * Get display-friendly threshold info for BTTS checklist items.
 * Returns lean 2-field thresholds + O2.5 implied + rolling scoring (constant thresholds).
 */
export function getBttsDisplayThresholds(resolved: ReturnType<typeof resolveAllThresholds>) {
  return {
    modelBttsProb: resolved.btts.modelBttsProb,
    modelO25Prob: resolved.btts.modelO25Prob,
    o25ImpliedThreshold: O25_IMPLIED_THRESHOLDS.btts,
    rollingScoringThreshold: ROLLING_SCORING_THRESHOLDS.btts,
    source: resolved.btts.source,
  };
}

/**
 * Get display-friendly threshold info for Over 3.5 checklist items.
 */
export function getOver35DisplayThresholds(resolved: ReturnType<typeof resolveAllThresholds>) {
  return {
    modelO35Prob: resolved.over35.modelO35Prob,
    bttsProb: resolved.over35.bttsProb,
    o25ImpliedThreshold: O25_IMPLIED_THRESHOLDS.over35,
    rollingScoringThreshold: ROLLING_SCORING_THRESHOLDS.over35,
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

  // --- Derive BTTS thresholds (lean 2-check) ---
  const bttsModelProb = findOptimalProbThreshold(
    m => m.predictedBtts,
    m => m.ftHomeGoals > 0 && m.ftAwayGoals > 0,
    [40, 80],
    1,
    BTTS_HYBRID_THRESHOLDS.modelBttsProb.floor
  );

  const bttsO25Prob = findOptimalProbThreshold(
    m => m.predictedO25,
    m => m.ftHomeGoals > 0 && m.ftAwayGoals > 0,
    [45, 85],
    1,
    BTTS_HYBRID_THRESHOLDS.modelO25Prob.floor
  );

  // --- Derive Over 3.5 thresholds (lean 2-check) ---
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

  // --- STRONG BET thresholds (derive O2.5, O3.5, BTTS prob thresholds) ---
  const sbO25Prob = findOptimalProbThreshold(
    m => m.predictedO25,
    m => m.ftHomeGoals + m.ftAwayGoals >= 3,
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

  // --- GREY RESULT thresholds ---
  const grBttsProb = findOptimalProbThreshold(
    m => m.predictedBtts,
    m => m.ftHomeGoals >= 1 && m.ftAwayGoals >= 1 && m.ftHomeGoals + m.ftAwayGoals >= 4,
    [40, 80],
    1,
    GREY_RESULT_CONFIG.bttsProb.min
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

  return {
    leagueName,
    btts: {
      modelBttsProb: bttsModelProb,
      modelO25Prob: bttsO25Prob,
    },
    over35: {
      modelO35Prob: o35ModelProb,
      bttsProb: o35BttsProb,
    },
    strongBet: {
      o25Prob: sbO25Prob,
      o35Prob: sbO35Prob,
      bttsProb: sbBttsProb,
      bttsChecklistCount: STRONG_BET_HYBRID.bttsChecklistCount,
    },
    greyResult: {
      bttsProb: grBttsProb,
      bttsProbMax: GREY_RESULT_CONFIG.bttsProb.max,
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
      bttsProb: GREY_RESULT_CONFIG.bttsProb.min,
      bttsProbMax: GREY_RESULT_CONFIG.bttsProb.max,
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

// ============================================================================
// Bookie Odds Dampener — Heavy Favorite Adjustment
// ============================================================================
// Based on live results analysis: when bookie odds for one side are <=1.70,
// the model systematically overestimates O2.5 probability by 10-15%.
// Heavy favorites tend to win tight, controlling games (1-0, 2-0) rather
// than high-scoring shootouts. This dampener accounts for that pattern.
// ============================================================================

/** Heavy favorite odds threshold (decimal odds) */
const HEAVY_FAVORITE_ODDS = 1.70;

/** Maximum dampener amount (percentage points to subtract) */
const HEAVY_FAVORITE_DAMPENER = 10;

/**
 * Apply bookie odds dampener to goal market probabilities.
 * When either team is a heavy favorite (avg odds <=1.70), reduce O2.5/O3.5/BTTS
 * probabilities to account for the "park the bus" effect.
 *
 * Only applies when valid odds are available (non-null, positive).
 *
 * @param over25Prob  - Model O2.5 probability (%)
 * @param over35Prob  - Model O3.5 probability (%)
 * @param bttsProb    - Model BTTS probability (%)
 * @param homeAvgOdds - Home team average odds (decimal)
 * @param awayAvgOdds - Away team average odds (decimal)
 * @returns Adjusted probabilities with dampener applied
 */
export function applyBookieOddsDampener(
  over25Prob: number,
  over35Prob: number,
  bttsProb: number,
  homeAvgOdds: number | null | undefined,
  awayAvgOdds: number | null | undefined,
  leagueAvgGoalsPerGame?: number
): { over25: number; over35: number; btts: number; dampened: boolean; reason: string } {
  if (!homeAvgOdds || !awayAvgOdds || homeAvgOdds <= 0 || awayAvgOdds <= 0) {
    return { over25: over25Prob, over35: over35Prob, btts: bttsProb, dampened: false, reason: '' };
  }

  // League-adaptive: gentler dampener in high-variance leagues
  const variance = leagueAvgGoalsPerGame ? classifyLeagueVariance(leagueAvgGoalsPerGame) : 'low';
  const heavyThreshold = variance === 'high' ? 1.40 : variance === 'medium' ? 1.60 : HEAVY_FAVORITE_ODDS;
  const maxDampener = variance === 'high' ? 5 : variance === 'medium' ? 7 : HEAVY_FAVORITE_DAMPENER;

  const homeIsHeavy = homeAvgOdds <= heavyThreshold;
  const awayIsHeavy = awayAvgOdds <= heavyThreshold;

  if (!homeIsHeavy && !awayIsHeavy) {
    return { over25: over25Prob, over35: over35Prob, btts: bttsProb, dampened: false, reason: '' };
  }

  const heavyOdds = Math.min(homeAvgOdds, awayAvgOdds);
  // Scale dampener: heavier favorite = bigger reduction
  // At 1.17 (PSG level): full dampener
  // At threshold: minimal 2% dampener
  const minDampener = variance === 'high' ? 2 : 3;
  const scale = Math.max(0, 1 - (heavyOdds - 1.17) / (heavyThreshold - 1.17));
  const dampener = Math.round(minDampener + (maxDampener - minDampener) * scale);

  const leagueLabel = variance.charAt(0).toUpperCase() + variance.slice(1);
  const reason = homeIsHeavy
    ? `${leagueLabel}-variance: Heavy home favorite (${homeAvgOdds.toFixed(2)}): -${dampener}% dampener`
    : `${leagueLabel}-variance: Heavy away favorite (${awayAvgOdds.toFixed(2)}): -${dampener}% dampener`;

  return {
    over25: Math.max(30, over25Prob - dampener),
    over35: Math.max(20, over35Prob - dampener),
    btts: Math.max(25, bttsProb - Math.round(dampener * 0.5)), // BTTS dampened less
    dampened: true,
    reason,
  };
}

/**
 * Compute average bookie odds for a team from match results.
 * Averages odds across all matches for that team.
 *
 * @param matches - Match results with odds data
 * @param team    - Team name
 * @returns Average decimal odds, or null if insufficient data
 */
export function computeTeamAvgOdds(
  matches: { homeTeam: string; awayTeam: string; oddsAvgHome: number | null; oddsAvgAway: number | null }[],
  team: string
): number | null {
  const teamOdds: number[] = [];

  for (const m of matches) {
    const odds = m.homeTeam === team ? m.oddsAvgHome : (m.awayTeam === team ? m.oddsAvgAway : null);
    if (odds && odds > 1 && odds < 20) {
      teamOdds.push(odds);
    }
  }

  if (teamOdds.length < 3) return null;

  return teamOdds.reduce((s, o) => s + o, 0) / teamOdds.length;
}

// ============================================================================
// League Variance Classification — Used by blowout/dampener adaptivity
// ============================================================================
// Classifies a league by its historical goal variance so that blowout and
// dampener thresholds can be calibrated to the league's natural scoring profile.
// High-variance leagues (2. Bundesliga, Eredivisie) see more goal explosions
// from heavy favorites, so suppression mechanisms should be gentler.

export type LeagueVariance = 'high' | 'medium' | 'low';

export function classifyLeagueVariance(avgGoalsPerGame: number): LeagueVariance {
  if (avgGoalsPerGame >= 3.0) return 'high';
  if (avgGoalsPerGame >= 2.5) return 'medium';
  return 'low';
}

// ============================================================================
// Blowout Risk Qualifier — Override Under signals in massive quality gaps
// ============================================================================
// Based on live results analysis: when there's a huge quality gap (favorite's
// avg odds <= 1.50), the Regression "Under" signal is unreliable. Heavy favorites
// tend to dominate regardless of recent form — a "cooling off" period doesn't
// matter when you're 2-3 quality tiers above the opponent.
//
// This qualifier prevents the "Under" regression signal from canceling out
// legitimate "Over" signals (xG, Z-Score) in STRONG BET / GREY RESULT / GOAL FEST.
//
// Example: Man City (odds 1.20) vs Luton — Regression says "Under" (City only
// scored 1 goal last 3 games), but City will likely score 3-4 regardless.
// Without this qualifier, the Under signal would block 2 points in STRONG BET.
// ============================================================================

/** Blowout threshold: favorite's average odds at or below this triggers override */
const BLOWOUT_ODDS_THRESHOLD = 1.50;

/**
 * Apply blowout risk qualifier to regression signal.
 * When either team is a massive favorite (avg odds <= 1.50), override
 * Regression "Under"/"Strong Under" to "Neutral" because quality advantage
 * outweighs recent form in one-sided matchups.
 *
 * @param signals      - Current signal set (xgSignal, regressionSignal, zScoreSignal)
 * @param homeAvgOdds  - Home team average odds (decimal)
 * @param awayAvgOdds  - Away team average odds (decimal)
 * @returns Modified signals (regression may be overridden to Neutral)
 */
export function applyBlowoutQualifier(
  signals: SignalInput,
  homeAvgOdds: number | null | undefined,
  awayAvgOdds: number | null | undefined,
  leagueAvgGoalsPerGame?: number
): { signals: SignalInput; blowoutOverride: boolean; reason: string } {
  // Only applies when valid odds are available
  if (!homeAvgOdds || !awayAvgOdds || homeAvgOdds <= 0 || awayAvgOdds <= 0) {
    return { signals, blowoutOverride: false, reason: '' };
  }

  // League-adaptive threshold: gentler in high-variance leagues
  const variance = leagueAvgGoalsPerGame ? classifyLeagueVariance(leagueAvgGoalsPerGame) : 'low';
  const blowoutThreshold = variance === 'high' ? 1.25 : variance === 'medium' ? 1.40 : BLOWOUT_ODDS_THRESHOLD;

  const homeIsMassiveFavorite = homeAvgOdds <= blowoutThreshold;
  const awayIsMassiveFavorite = awayAvgOdds <= blowoutThreshold;

  // Only trigger when one team is a massive favorite
  if (!homeIsMassiveFavorite && !awayIsMassiveFavorite) {
    return { signals, blowoutOverride: false, reason: '' };
  }

  // In high-variance leagues, only override Strong Under (keep mild signals intact)
  // because hot favorites in goal-rich leagues often score freely
  const shouldOverride = variance === 'high'
    ? signals.regressionSignal === 'Strong Under'
    : signals.regressionSignal === 'Under' || signals.regressionSignal === 'Strong Under';
  if (!shouldOverride) {
    return { signals, blowoutOverride: false, reason: '' };
  }

  const favoriteOdds = Math.min(homeAvgOdds, awayAvgOdds);
  const favorite = homeIsMassiveFavorite ? 'Home' : 'Away';
  const reason = `Blowout qualifier (${variance}-variance): ${favorite} favorite (${favoriteOdds.toFixed(2)} <= ${blowoutThreshold}) — Regression "${signals.regressionSignal}" overridden to Neutral`;

  return {
    signals: {
      ...signals,
      regressionSignal: 'Neutral',
    },
    blowoutOverride: true,
    reason,
  };
}

// ============================================================================
// BTTS Dual-Team Qualification System
// ============================================================================
// BTTS requires BOTH teams to score — the match-level signal combo (Regression
// Under + Z-Score Neutral + xG Over) correctly identifies "goals are coming"
// but tends to surface ONE-SIDED regressions (one team due for a breakout).
// This system evaluates each team independently and produces a BTTS-specific
// conviction tier that is separate from the Over goal thesis.
// ============================================================================

/** BTTS qualification tiers */
export type BttsQualificationTier = 'BTTS STRONG' | 'BTTS QUALIFIED' | 'BTTS WEAK' | 'BTTS AVOID';

/** Per-team signal data for BTTS qualification */
export interface BttsQualificationInput {
  /** Home team regression signal (Under/Strong Under/Neutral/Over/Strong Over) */
  homeRegressionSignal: string;
  /** Away team regression signal */
  awayRegressionSignal: string;
  /** Home team xG overperformance diff (positive = overperforming, negative = underperforming) */
  homeXgDiff: number;
  /** Away team xG overperformance diff */
  awayXgDiff: number;
  /** Home team Z-Score (negative = underperforming, positive = overperforming) */
  homeZScore: number;
  /** Away team Z-Score */
  awayZScore: number;
  /** Home team SOT conversion rate (%) */
  homeSotConversion: number | null;
  /** Away team SOT conversion rate (%) */
  awaySotConversion: number | null;
  /** Favorite odds (decimal) — lower = bigger favorite */
  favoriteOdds: number | null;
  /** Home team momentum signal (optional — enables momentum-aware scoring) */
  homeMomentumSignal?: string;
  /** Away team momentum signal (optional) */
  awayMomentumSignal?: string;
}

/** BTTS qualification result */
export interface BttsQualificationResult {
  tier: BttsQualificationTier;
  score: number;
  breakdown: { check: string; points: number; passed: boolean }[];
  bttsCap: number; // Max BTTS probability allowed at this tier
}

/**
 * Classify a per-team regression deviation into a signal label.
 * Uses the same thresholds as REGRESSION_THRESHOLDS.perTeam.
 */
export function classifyPerTeamRegressionSignal(combinedSignal: number): string {
  if (combinedSignal <= -0.8) return 'Strong Over';
  if (combinedSignal <= -0.3) return 'Over';
  if (combinedSignal >= 0.8) return 'Strong Under';
  if (combinedSignal >= 0.3) return 'Under';
  return 'Neutral';
}

/**
 * Classify a per-team xG diff into a signal label.
 * Uses the same thresholds as XG_THRESHOLDS applied per-team.
 */
export function classifyPerTeamXgSignal(xgDiff: number): string {
  if (xgDiff <= -1.0) return 'Strong Over';
  if (xgDiff <= -0.5) return 'Over';
  if (xgDiff >= 1.0) return 'Strong Under';
  if (xgDiff >= 0.5) return 'Under';
  return 'Neutral';
}

/**
 * Classify a per-team Z-Score into a signal label.
 * Negative Z = underperforming recently (goals expected to rise).
 */
export function classifyPerTeamZScoreSignal(zScore: number): string {
  if (zScore <= -1.5) return 'Strong Over';
  if (zScore <= -1.0) return 'Over';
  if (zScore >= 1.5) return 'Strong Under';
  if (zScore >= 1.0) return 'Under';
  return 'Neutral';
}

// ============================================================================
// Momentum Signal — Parallel track to Regression (form continuation)
// ============================================================================
// While Regression asks "is this team due to bounce back?", Momentum asks
// "is this team on a sustained hot streak that will continue?"
// Both tracks run simultaneously; a match can qualify through either pathway.

export interface MomentumTeamInput {
  last5Goals: number[];    // total goals per match in last 5
  seasonAvg: number;       // season avg total goals per game
  xgDiff: number;          // actualGoals/matches - totalXg/matches (positive = overperforming)
  sotPerGame: number | null;
}

export interface MomentumResult {
  homeSignal: string;      // 'Strong Momentum' | 'Momentum' | 'Neutral' | 'Cooling' | 'Cold'
  awaySignal: string;
  matchSignal: string;     // 'MOMENTUM OVER' | 'MOMENTUM LEAN OVER' | 'MOMENTUM NEUTRAL' | 'MOMENTUM LEAN UNDER' | 'MOMENTUM UNDER'
}

function classifyTeamMomentum(team: MomentumTeamInput): string {
  if (team.last5Goals.length < 3) return 'Neutral';

  const last5Avg = team.last5Goals.reduce((s, g) => s + g, 0) / team.last5Goals.length;
  const last3 = team.last5Goals.slice(0, Math.min(3, team.last5Goals.length));
  const last3Avg = last3.reduce((s, g) => s + g, 0) / last3.length;

  // Consistency: coefficient of variation of last 5
  const mean = last5Avg;
  const variance = team.last5Goals.reduce((s, g) => s + (g - mean) ** 2, 0) / team.last5Goals.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 999;

  // Sustained: 5+ game window above season average by meaningful margin
  const sustained = last5Avg > team.seasonAvg * 1.15;

  // Accelerating: last 3 even hotter than last 5
  const accelerating = last3Avg > last5Avg * 1.05;

  // xG sustainability: overperforming xG with shot volume to back it
  const xgSustainable = team.xgDiff > 0 && team.sotPerGame !== null && team.sotPerGame > 5.0;

  // Strong Momentum: sustained + consistent + high output
  if (sustained && cv < 0.5 && last5Avg >= 2.0) return 'Strong Momentum';
  // Momentum: sustained with moderate variance, or recent surge with sustainable backing
  if (sustained && cv < 0.65) return 'Momentum';
  if (last5Avg > team.seasonAvg * 1.15 && accelerating && (xgSustainable || team.xgDiff <= 0)) return 'Momentum';
  // Cold: declining output
  if (last5Avg < team.seasonAvg * 0.75) {
    return last3Avg < last5Avg * 0.8 ? 'Cold' : 'Cooling';
  }
  return 'Neutral';
}

export function computeMomentumSignal(home: MomentumTeamInput, away: MomentumTeamInput): MomentumResult {
  const homeSignal = classifyTeamMomentum(home);
  const awaySignal = classifyTeamMomentum(away);

  const isOver = (s: string) => s === 'Strong Momentum' || s === 'Momentum';
  const isUnder = (s: string) => s === 'Cold' || s === 'Cooling';

  let matchSignal: string;
  if (isOver(homeSignal) && isOver(awaySignal)) matchSignal = 'MOMENTUM OVER';
  else if ((isOver(homeSignal) || isOver(awaySignal)) && !isUnder(homeSignal) && !isUnder(awaySignal)) matchSignal = 'MOMENTUM LEAN OVER';
  else if (isUnder(homeSignal) && isUnder(awaySignal)) matchSignal = 'MOMENTUM UNDER';
  else if (isUnder(homeSignal) || isUnder(awaySignal)) matchSignal = 'MOMENTUM LEAN UNDER';
  else matchSignal = 'MOMENTUM NEUTRAL';

  return { homeSignal, awaySignal, matchSignal };
}

// ============================================================================
// BTTS Dual-Team Qualification System
// ============================================================================
// Evaluates each team independently to determine whether BOTH teams are likely
// to score. Returns a tier that caps BTTS probability independently from the
// Over goal thesis.
//
// Now supports TWO qualification pathways:
//   1. Regression Under: both teams underperforming → due to bounce back
//   2. Momentum Over: both teams on hot streaks → likely to keep scoring
//
// Tier mapping:
//   5+ → BTTS STRONG   (cap 70%) — both teams individually qualify
//   3–4 → BTTS QUALIFIED (cap 55%) — mild BTTS confidence
//   1–2 → BTTS WEAK     (cap 40%) — one-sided regression likely
//   ≤0  → BTTS AVOID    (cap 25%) — do not bet BTTS
// ============================================================================
export function computeBTTSQualification(input: BttsQualificationInput): BttsQualificationResult {
  let score = 0;
  const checks: { check: string; points: number; passed: boolean }[] = [];

  const isRegressionUnder = (sig: string) => sig === 'Under' || sig === 'Strong Under';
  const isXgOver = (diff: number) => diff <= -0.5; // underperforming xG = goals due
  const isZCold = (z: number) => z >= 1.0; // overperforming Z = cold streak coming
  const isZNeutralOrBetter = (z: number) => z < 1.0; // not overheated

  // Momentum helpers
  const isMomentum = (s: string | undefined) => s === 'Strong Momentum' || s === 'Momentum';
  const homeMom = isMomentum(input.homeMomentumSignal);
  const awayMom = isMomentum(input.awayMomentumSignal);
  const bothMom = homeMom && awayMom;
  const oneMom = homeMom || awayMom;

  // Check 1: Regression Under OR Momentum Over — dual qualification pathway
  const bothRegUnder = isRegressionUnder(input.homeRegressionSignal) && isRegressionUnder(input.awayRegressionSignal);
  const oneRegUnder = isRegressionUnder(input.homeRegressionSignal) || isRegressionUnder(input.awayRegressionSignal);

  if (bothRegUnder && bothMom) {
    // Supercharged: both signals agree from both sides
    score += 5;
    checks.push({ check: 'Both Regression Under AND Momentum Over (supercharged)', points: 5, passed: true });
  } else if (bothRegUnder || bothMom) {
    score += 3;
    checks.push({ check: bothRegUnder ? 'Both teams Regression Under/StrongUnder' : 'Both teams Momentum Over (hot streak)', points: 3, passed: true });
  } else if ((oneRegUnder && oneMom)) {
    score += 2; // Mixed but both signal types point to goals
    checks.push({ check: 'One Regression Under + One Momentum Over', points: 2, passed: true });
  } else if (oneRegUnder || oneMom) {
    score += 1;
    checks.push({ check: oneRegUnder ? 'One team Regression Under' : 'One team Momentum Over', points: 1, passed: true });
  } else {
    checks.push({ check: 'No Regression Under or Momentum Over', points: 3, passed: false });
  }

  // Check 2: BOTH teams xG Over (underperforming xG = creating chances, finishing due)
  const bothXgOver = isXgOver(input.homeXgDiff) && isXgOver(input.awayXgDiff);
  if (bothXgOver) {
    score += 2;
    checks.push({ check: 'Both teams xG Over (underperforming)', points: 2, passed: true });
  } else {
    checks.push({ check: 'Both teams xG Over (underperforming)', points: 2, passed: false });
  }

  // Check 3: BOTH teams Z-Score not overheated
  const bothZOk = isZNeutralOrBetter(input.homeZScore) && isZNeutralOrBetter(input.awayZScore);
  if (bothZOk) {
    score += 1;
    checks.push({ check: 'Both teams Z-Score Neutral/better', points: 1, passed: true });
  } else {
    checks.push({ check: 'Both teams Z-Score Neutral/better', points: 1, passed: false });
  }

  // Check 4: Competitive matchup (favorite odds 1.80–2.50)
  if (input.favoriteOdds && input.favoriteOdds >= 1.80 && input.favoriteOdds <= 2.50) {
    score += 1;
    checks.push({ check: 'Competitive matchup (odds 1.80-2.50)', points: 1, passed: true });
  } else {
    checks.push({ check: 'Competitive matchup (odds 1.80-2.50)', points: 1, passed: false });
  }

  // Penalty 5: Massive favorite (≤1.50) — one side dominates, BTTS unlikely
  if (input.favoriteOdds && input.favoriteOdds <= 1.50) {
    score -= 2;
    checks.push({ check: 'Massive favorite (odds ≤1.50)', points: -2, passed: true });
  } else {
    checks.push({ check: 'Massive favorite (odds ≤1.50)', points: -2, passed: false });
  }

  // Penalty 6: Either team can't finish (SOT conversion <25%)
  const homeCantFinish = input.homeSotConversion !== null && input.homeSotConversion < 25;
  const awayCantFinish = input.awaySotConversion !== null && input.awaySotConversion < 25;
  if (homeCantFinish) score -= 1;
  if (awayCantFinish) score -= 1;
  checks.push({
    check: `Home SOT conversion ${homeCantFinish ? '< 25%' : '≥ 25%'}${input.homeSotConversion !== null ? ` (${input.homeSotConversion.toFixed(0)}%)` : ' (N/A)'}`,
    points: -1,
    passed: !homeCantFinish,
  });
  checks.push({
    check: `Away SOT conversion ${awayCantFinish ? '< 25%' : '≥ 25%'}${input.awaySotConversion !== null ? ` (${input.awaySotConversion.toFixed(0)}%)` : ' (N/A)'}`,
    points: -1,
    passed: !awayCantFinish,
  });

  // Penalty 7: Either team in a strong cold Z-Score streak
  const homeCold = isZCold(input.homeZScore);
  const awayCold = isZCold(input.awayZScore);
  if (homeCold) score -= 2;
  if (awayCold) score -= 2;
  checks.push({
    check: `Home Z-Score ${homeCold ? 'cold (≥1.0)' : 'ok'}`,
    points: -2,
    passed: !homeCold,
  });
  checks.push({
    check: `Away Z-Score ${awayCold ? 'cold (≥1.0)' : 'ok'}`,
    points: -2,
    passed: !awayCold,
  });

  // Determine tier
  let tier: BttsQualificationTier;
  let bttsCap: number;
  if (score >= 5) {
    tier = 'BTTS STRONG';
    bttsCap = 70;
  } else if (score >= 3) {
    tier = 'BTTS QUALIFIED';
    bttsCap = 55;
  } else if (score >= 1) {
    tier = 'BTTS WEAK';
    bttsCap = 40;
  } else {
    tier = 'BTTS AVOID';
    bttsCap = 25;
  }

  return { tier, score, breakdown: checks, bttsCap };
}

// ============================================================================
// Third Goal (2-Goal Ceiling) Detector
// ============================================================================
// 85.7% Over 1.5 but only 57.1% Over 2.5 — the 28.6pp gap means ~1 in 3
// qualified picks stall at exactly 2 goals. This qualifier identifies whether
// there's enough sustained pressure on BOTH sides to break through the 2-goal
// ceiling and reach 3+ goals.
// ============================================================================

/** Goal tier classification */
export type GoalTier = 'GOAL RICH' | 'GOAL LIKELY' | 'GOAL BORDERLINE' | 'GOAL THIN' | 'GOAL STALL';

/** Input for Third Goal qualifier */
export interface ThirdGoalQualifierInput {
  /** Combined xG total per game (home xG/game + away xG/game) */
  combinedXgTotal: number;
  /** Home team regression signal */
  homeRegressionSignal: string;
  /** Away team regression signal */
  awayRegressionSignal: string;
  /** Home team xG signal label */
  homeXgSignal: string;
  /** Away team xG signal label */
  awayXgSignal: string;
  /** Home team average SOT per game */
  homeAvgSot: number | null;
  /** Away team average SOT per game */
  awayAvgSot: number | null;
  /** Favorite odds (decimal) — lower = bigger favorite */
  favoriteOdds: number | null;
  /** Home team SOT conversion rate (%) */
  homeSotConversion: number | null;
  /** Away team SOT conversion rate (%) */
  awaySotConversion: number | null;
}

/** Third Goal qualifier result */
export interface ThirdGoalQualifierResult {
  tier: GoalTier;
  score: number;
  breakdown: { check: string; points: number; passed: boolean }[];
  recommendation: string;
}

/**
 * Compute Third Goal qualifier — distinguishes "2-goal games" from "3+ goal games"
 * within pre-filtered selections.
 *
 * Tier mapping:
 *   6+  → GOAL RICH      — Full confidence on Over 2.5, consider Over 3.5
 *   4–5 → GOAL LIKELY    — Solid Over 2.5 bet
 *   2–3 → GOAL BORDERLINE — Over 1.5 strong, Over 2.5 cautious
 *   0–1 → GOAL THIN      — Over 1.5 only, skip Over 2.5
 *   <0  → GOAL STALL     — Likely 1-2 goals, avoid Over markets above 1.5
 */
export function computeThirdGoalQualifier(input: ThirdGoalQualifierInput): ThirdGoalQualifierResult {
  let score = 0;
  const checks: { check: string; points: number; passed: boolean }[] = [];

  const isRegressionUnder = (sig: string) => sig === 'Under' || sig === 'Strong Under';
  const isXgOver = (sig: string) => sig === 'Over' || sig === 'Strong Over';

  // Check 1: Combined xG > 3.0 (very high chance creation)
  if (input.combinedXgTotal > 3.0) {
    score += 3;
    checks.push({ check: `Combined xG ${input.combinedXgTotal.toFixed(2)} > 3.0`, points: 3, passed: true });
  } else if (input.combinedXgTotal >= 2.5) {
    score += 1;
    checks.push({ check: `Combined xG ${input.combinedXgTotal.toFixed(2)} in 2.5-3.0`, points: 1, passed: true });
  } else {
    checks.push({ check: `Combined xG ${input.combinedXgTotal.toFixed(2)} < 2.5`, points: 3, passed: false });
  }

  // Check 2: BOTH teams Regression Under (double regression)
  const bothRegUnder = isRegressionUnder(input.homeRegressionSignal) && isRegressionUnder(input.awayRegressionSignal);
  if (bothRegUnder) {
    score += 2;
    checks.push({ check: 'Both teams Regression Under', points: 2, passed: true });
  } else {
    checks.push({ check: 'Both teams Regression Under', points: 2, passed: false });
  }

  // Check 3: BOTH teams xG Over (both creating chances)
  const bothXgOver = isXgOver(input.homeXgSignal) && isXgOver(input.awayXgSignal);
  if (bothXgOver) {
    score += 2;
    checks.push({ check: 'Both teams xG Over', points: 2, passed: true });
  } else {
    checks.push({ check: 'Both teams xG Over', points: 2, passed: false });
  }

  // Check 4: BOTH teams average SOT > 5.5 (sustained pressure)
  const homeHighSot = input.homeAvgSot !== null && input.homeAvgSot > 5.5;
  const awayHighSot = input.awayAvgSot !== null && input.awayAvgSot > 5.5;
  if (homeHighSot && awayHighSot) {
    score += 2;
    checks.push({ check: `Both teams SOT > 5.5 (${input.homeAvgSot?.toFixed(1)} / ${input.awayAvgSot?.toFixed(1)})`, points: 2, passed: true });
  } else if (homeHighSot || awayHighSot) {
    checks.push({ check: `One team SOT > 5.5 (${input.homeAvgSot?.toFixed(1) ?? 'N/A'} / ${input.awayAvgSot?.toFixed(1) ?? 'N/A'})`, points: 2, passed: false });
  } else {
    checks.push({ check: `Neither team SOT > 5.5 (${input.homeAvgSot?.toFixed(1) ?? 'N/A'} / ${input.awayAvgSot?.toFixed(1) ?? 'N/A'})`, points: 2, passed: false });
  }

  // Check 5: Balanced xG (within 0.8 of each other) — competitive game
  // We check if xG signals are similar (not one-sided)
  const xgBalanced = isXgOver(input.homeXgSignal) === isXgOver(input.awayXgSignal);
  if (xgBalanced) {
    score += 1;
    checks.push({ check: 'xG signals balanced (both teams similar)', points: 1, passed: true });
  } else {
    checks.push({ check: 'xG signals lopsided (one-sided)', points: 1, passed: false });
  }

  // Check 6: Favorite odds 1.80–2.50 (open competitive game)
  if (input.favoriteOdds && input.favoriteOdds >= 1.80 && input.favoriteOdds <= 2.50) {
    score += 1;
    checks.push({ check: 'Competitive matchup (odds 1.80-2.50)', points: 1, passed: true });
  } else {
    checks.push({ check: 'Not a competitive matchup', points: 1, passed: false });
  }

  // Penalty 7: Lopsided xG (one team xG Over, other not)
  if (!xgBalanced) {
    score -= 1;
    // Already counted in check 5 as non-passed, no duplicate
  }

  // Penalty 8: Massive favorite (≤1.50) — might be controlled 2-0
  if (input.favoriteOdds && input.favoriteOdds <= 1.50) {
    score -= 1;
    checks.push({ check: 'Massive favorite (odds ≤1.50) — controlled game risk', points: -1, passed: true });
  } else {
    checks.push({ check: 'Massive favorite risk', points: -1, passed: false });
  }

  // Penalty 9: Either team can't finish (SOT conversion <25%)
  const homeCantFinish = input.homeSotConversion !== null && input.homeSotConversion < 25;
  const awayCantFinish = input.awaySotConversion !== null && input.awaySotConversion < 25;
  if (homeCantFinish) score -= 1;
  if (awayCantFinish) score -= 1;
  checks.push({
    check: `Home SOT conversion ${homeCantFinish ? '< 25%' : '≥ 25%'}${input.homeSotConversion !== null ? ` (${input.homeSotConversion.toFixed(0)}%)` : ' (N/A)'}`,
    points: -1,
    passed: !homeCantFinish,
  });
  checks.push({
    check: `Away SOT conversion ${awayCantFinish ? '< 25%' : '≥ 25%'}${input.awaySotConversion !== null ? ` (${input.awaySotConversion.toFixed(0)}%)` : ' (N/A)'}`,
    points: -1,
    passed: !awayCantFinish,
  });

  // Determine tier
  let tier: GoalTier;
  let recommendation: string;
  if (score >= 6) {
    tier = 'GOAL RICH';
    recommendation = 'Full confidence on Over 2.5, consider Over 3.5';
  } else if (score >= 4) {
    tier = 'GOAL LIKELY';
    recommendation = 'Solid Over 2.5 bet';
  } else if (score >= 2) {
    tier = 'GOAL BORDERLINE';
    recommendation = 'Over 1.5 strong, Over 2.5 cautious';
  } else if (score >= 0) {
    tier = 'GOAL THIN';
    recommendation = 'Over 1.5 only, skip Over 2.5';
  } else {
    tier = 'GOAL STALL';
    recommendation = 'Likely 1-2 goals, avoid Over markets above 1.5';
  }

  return { tier, score, breakdown: checks, recommendation };
}

// ============================================================================
// Dominant Team Qualifier — Flags one-sided demolition games
// ============================================================================
// Catches games where one team is overwhelmingly stronger and likely to score
// 3+ goals regardless of opponent contribution. This is the anti-BTTS card —
// it identifies Elversberg 3-0, Furth 3-0, AZ 3-3 type profiles where Over
// markets hit but BTTS does NOT.

export interface DominantTeamInput {
  favoriteOdds: number;
  favoriteAvgGoalsPerGame: number;
  underdogAvgConcededPerGame: number;
  favoriteXgPerGame: number;
  underdogXgPerGame: number;
  favoriteLast5Avg: number;
  favoriteSotPerGame: number | null;
  leagueAvgGoalsPerGame: number;
  underdogAwayBttsRate: number | null;
  favoriteLast3AllLow: boolean;  // true if last 3 games all < 1.5 total goals
}

export type DominantTier = 'DOMINANT EXPECTED' | 'DOMINANT LIKELY' | 'DOMINANT POSSIBLE' | 'NOT DOMINANT';

export interface DominantTeamResult {
  tier: DominantTier;
  score: number;
  breakdown: { check: string; points: number; passed: boolean }[];
  over25Rec: string;
  bttsRec: string;
}

export function computeDominantTeamQualifier(input: DominantTeamInput): DominantTeamResult {
  let score = 0;
  const checks: { check: string; points: number; passed: boolean }[] = [];

  // Positive checks
  const favOddsLow = input.favoriteOdds <= 1.40;
  if (favOddsLow) { score += 2; }
  checks.push({ check: `Favorite odds ${input.favoriteOdds.toFixed(2)} ${favOddsLow ? '<= 1.40' : '> 1.40'}`, points: 2, passed: favOddsLow });

  const favHighAvg = input.favoriteAvgGoalsPerGame > 2.0;
  if (favHighAvg) { score += 2; }
  checks.push({ check: `Favorite avg ${input.favoriteAvgGoalsPerGame.toFixed(1)} goals/game ${favHighAvg ? '> 2.0' : '<= 2.0'}`, points: 2, passed: favHighAvg });

  const underdogLeaks = input.underdogAvgConcededPerGame > 1.5;
  if (underdogLeaks) { score += 1; }
  checks.push({ check: `Underdog concedes ${input.underdogAvgConcededPerGame.toFixed(1)}/game ${underdogLeaks ? '> 1.5' : '<= 1.5'}`, points: 1, passed: underdogLeaks });

  const xgGap = input.favoriteXgPerGame - input.underdogXgPerGame;
  const hugeXgGap = xgGap > 1.0;
  if (hugeXgGap) { score += 2; }
  checks.push({ check: `xG gap ${xgGap.toFixed(1)} ${hugeXgGap ? '> 1.0' : '<= 1.0'}`, points: 2, passed: hugeXgGap });

  const favLast5Hot = input.favoriteLast5Avg > 2.0;
  if (favLast5Hot) { score += 1; }
  checks.push({ check: `Favorite last 5 avg ${input.favoriteLast5Avg.toFixed(1)} ${favLast5Hot ? '> 2.0' : '<= 2.0'}`, points: 1, passed: favLast5Hot });

  const favHighSot = input.favoriteSotPerGame !== null && input.favoriteSotPerGame > 6.0;
  if (favHighSot) { score += 1; }
  checks.push({ check: `Favorite SOT ${input.favoriteSotPerGame?.toFixed(1) ?? 'N/A'}/game ${favHighSot ? '> 6.0' : '<= 6.0'}`, points: 1, passed: favHighSot });

  const variance = classifyLeagueVariance(input.leagueAvgGoalsPerGame);
  const isHighVar = variance === 'high';
  if (isHighVar) { score += 1; }
  checks.push({ check: `High-variance league (${input.leagueAvgGoalsPerGame.toFixed(1)} avg)`, points: 1, passed: isHighVar });

  const underdogBttsPoor = input.underdogAwayBttsRate !== null && input.underdogAwayBttsRate < 40;
  if (underdogBttsPoor) { score += 1; }
  checks.push({ check: `Underdog away BTTS ${input.underdogAwayBttsRate !== null ? `${input.underdogAwayBttsRate.toFixed(0)}%` : 'N/A'} ${underdogBttsPoor ? '< 40%' : '>= 40%'}`, points: 1, passed: underdogBttsPoor });

  // Penalties
  if (input.favoriteLast3AllLow) { score -= 2; }
  checks.push({ check: 'Favorite cooling off (last 3 < 1.5 goals)', points: -2, passed: input.favoriteLast3AllLow });

  // Determine tier
  let tier: DominantTier;
  let over25Rec: string;
  let bttsRec: string;
  if (score >= 6) {
    tier = 'DOMINANT EXPECTED'; over25Rec = 'Strong Over 2.5'; bttsRec = 'BTTS NO (one-sided)';
  } else if (score >= 4) {
    tier = 'DOMINANT LIKELY'; over25Rec = 'Over 2.5'; bttsRec = 'BTTS NO';
  } else if (score >= 2) {
    tier = 'DOMINANT POSSIBLE'; over25Rec = 'Lean Over 2.5'; bttsRec = 'Depends on opponent';
  } else {
    tier = 'NOT DOMINANT'; over25Rec = 'N/A'; bttsRec = 'N/A';
  }

  return { tier, score, breakdown: checks, over25Rec, bttsRec };
}

// ============================================================================
// BTTS BOTH HALVES DETECTOR
// ============================================================================
// Dedicated detector for "Both Teams Score in Both Halves" (BTTS-BH).
// This is the rarest and most profitable goal pattern — ~5.2% base rate.
//
// Design: Lean 3-check system, calibrated on 24,057 matches across 7 leagues.
// Only signals with proven discriminative power survive:
//   1. O2.5 implied probability (bookmaker odds) — 1.38x lift, PRIMARY
//   2. Draw probability < 25% — 1.21x lift, SECONDARY
//   3. Rolling combined scoring >= 3.0 — 1.10x lift, TERTIARY
//
// All other model-derived signals (BTTS rate, O3.5 rate, O2.5 model rate,
// league avg goals, elite O2.5) were tested and found flat (0.99-1.06x)
// across 24K games. They were removed to reduce noise.
//
// Need 2 of 3 checks to qualify.
// ============================================================================

export type BTTSBothHalvesTier =
  | 'BTTS-BH STRONG'
  | 'BTTS-BH QUALIFIED'
  | 'BTTS-BH BORDERLINE'
  | 'BTTS-BH UNLIKELY';

export interface BTTSBothHalvesInput {
  o25Prob: number;              // O2.5 model/rolling probability (unused — kept for interface compat)
  o35Prob: number;              // O3.5 rolling rate (unused — kept for interface compat)
  bttsProb: number;             // BTTS rolling rate (unused — kept for interface compat)
  rollingCombinedScoring: number;
  o25ImpliedProb: number | null; // from bookmaker O2.5 odds
  drawProb: number;             // draw probability from odds
  avgGoalsPerGame: number;      // league average goals (unused — kept for interface compat)
}

export interface BTTSBothHalvesResult {
  isBTTSBothHalves: boolean;
  tier: BTTSBothHalvesTier;
  score: number;
  totalChecks: number;
  breakdown: { check: string; passed: boolean; weight: string }[];
  reasoning: string[];
}

/**
 * Compute BTTS Both Halves indicator.
 *
 * Calibrated on 24,057 matches across 7 European leagues (10 seasons each).
 * 1,249 BTTS-BH games (5.19% base rate).
 *
 * 3-check system — only signals with proven lift survive:
 *   - O2.5 implied >= 65%: 1.38x lift (strongest single predictor)
 *   - Draw prob < 25%:      1.21x lift (low draw = open, balanced play)
 *   - Rolling scoring >= 3.0: 1.10x lift (recent form, independent)
 *
 * Tier system:
 *   STRONG (3/3):    All signals aligned — rare, highest confidence
 *   QUALIFIED (2/3): Core checks pass — actionable signal
 *   BORDERLINE (1/3): One indicator only — watch list
 *   UNLIKELY (0/3):  Insufficient evidence
 */
export function computeBTTSBothHalves(input: BTTSBothHalvesInput): BTTSBothHalvesResult {
  const cfg = BTTS_BOTH_HALVES_CONFIG;
  const reasoning: string[] = [];

  const checks: { check: string; passed: boolean; weight: string }[] = [
    // CHECK 1: O2.5 implied probability — THE strongest predictor (1.38x lift at 65%)
    {
      check: 'O2.5 Implied >= ' + cfg.o25Implied + '%',
      passed: input.o25ImpliedProb !== null && input.o25ImpliedProb >= cfg.o25Implied,
      weight: 'CRITICAL',
    },

    // CHECK 2: Draw probability INVERTED — lower draw = better for BTTS-BH
    // Multi-league calibration: draw < 25% gives 1.21x lift
    {
      check: 'Draw Prob < ' + cfg.drawProbMax + '%',
      passed: input.drawProb < cfg.drawProbMax,
      weight: 'HIGH',
    },

    // CHECK 3: Rolling combined scoring — both teams scoring recently
    // 1.10x lift at 3.0, marginal but independent of bookmaker signals
    {
      check: 'Rolling Scoring >= ' + cfg.rollingScoring,
      passed: input.rollingCombinedScoring >= cfg.rollingScoring,
      weight: 'MEDIUM',
    },
  ];

  const score = checks.filter(c => c.passed).length;

  // Build reasoning
  if (input.o25ImpliedProb !== null && input.o25ImpliedProb >= cfg.o25Implied) {
    reasoning.push('Bookmakers imply high goal expectation (' + input.o25ImpliedProb.toFixed(0) + '% O2.5). This is the strongest BTTS-BH predictor (1.38x lift across 24K games).');
  }
  if (input.drawProb < cfg.drawProbMax) {
    reasoning.push('Low draw probability (' + input.drawProb.toFixed(0) + '%) — balanced matchup favors open play over defensive draws (1.21x lift).');
  }
  if (input.rollingCombinedScoring >= cfg.rollingScoring) {
    reasoning.push('Both teams showing recent scoring form (' + input.rollingCombinedScoring.toFixed(1) + ' combined goals last 5).');
  }
  if (reasoning.length === 0) {
    reasoning.push('Insufficient signal alignment for BTTS in both halves. O2.5 implied probability is the primary gate.');
  }

  // Determine tier
  let tier: BTTSBothHalvesTier;
  if (score >= 3) {
    tier = 'BTTS-BH STRONG';
  } else if (score >= 2) {
    tier = 'BTTS-BH QUALIFIED';
  } else if (score >= 1) {
    tier = 'BTTS-BH BORDERLINE';
  } else {
    tier = 'BTTS-BH UNLIKELY';
  }

  return {
    isBTTSBothHalves: score >= cfg.requiredChecks,
    tier,
    score,
    totalChecks: checks.length,
    breakdown: checks,
    reasoning,
  };
}
