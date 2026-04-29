// ============================================================================
// Shared Betting Filter Configuration — Single Source of Truth
// ============================================================================
// Hybrid threshold system: threshold = max(absoluteFloor, leagueBaseline * multiplier)
// League-level criteria use absolute thresholds (screen the league itself)
// Match-level criteria adapt to each league's profile
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
    overallShotConversion: string;
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
    shotConversion: parseFloat(analytics.overallShotConversion),
  };
}

// ============================================================================
// Hybrid threshold config
// Each match-level criterion has: { floor, multiplier }
// threshold = max(floor, leagueBaseline * multiplier)
// ============================================================================

// ---- BTTS Checklist criteria ----
// League-level (absolute): screen the league environment
export const BTTS_LEAGUE_THRESHOLDS = {
  leagueAvgGoals: 2.7,       // absolute floor — league must average 2.7+ goals
  leagueO25Rate: 55,          // absolute floor — league must have 55%+ O2.5 rate
} as const;

// Match-level (hybrid): adapt to each league's profile
export const BTTS_HYBRID_THRESHOLDS = {
  modelBttsProb:  { floor: 55, multiplier: 1.12 },  // BTTS ≥ max(55%, leagueBTTS*1.12)
  homeAvgGoals:   { floor: 1.3, multiplier: 1.10 },  // Home ≥ max(1.3, leagueHomeAvg*1.10)
  awayAvgGoals:   { floor: 1.1, multiplier: 1.10 },  // Away ≥ max(1.1, leagueAwayAvg*1.10)
  modelO25Prob:   { floor: 62, multiplier: 1.10 },  // O2.5 ≥ max(62%, leagueO25*1.10)
  shotConversion: { floor: 11, multiplier: 1.15 },  // Shot conv ≥ max(11%, leagueConv*1.15)
} as const;

// ---- Over 3.5 Checklist criteria ----
// League-level (absolute): screen the league environment
export const OVER35_LEAGUE_THRESHOLDS = {
  leagueAvgGoals: 2.8,       // absolute floor — league must average 2.8+ goals
  leagueO25Rate: 52,          // absolute floor — league must have 52%+ O2.5 rate
} as const;

// Match-level (hybrid): adapt to each league's profile
export const OVER35_HYBRID_THRESHOLDS = {
  modelO35Prob:   { floor: 40, multiplier: 1.20 },  // O3.5 ≥ max(40%, leagueO35*1.20)
  bttsProb:       { floor: 52, multiplier: 1.10 },  // BTTS ≥ max(52%, leagueBTTS*1.10)
  homeAvgGoals:   { floor: 1.4, multiplier: 1.12 },  // Home ≥ max(1.4, leagueHomeAvg*1.12)
  awayAvgGoals:   { floor: 1.2, multiplier: 1.10 },  // Away ≥ max(1.2, leagueAwayAvg*1.10)
  shotConversion: { floor: 12, multiplier: 1.15 },  // Shot conv ≥ max(12%, leagueConv*1.15)
} as const;

// ---- STRONG BET — Points-based system (need 7+ of 11) ----
export const STRONG_BET_POINTS = {
  o25: 2,                     // O2.5 check
  o35: 1,                     // O3.5 check
  btts: 1,                    // BTTS check
  bttsChecklist: 2,           // BTTS Checklist ≥ 6/7
  xgSignal: 2,                // xG Signal = Over or Strong Over
  regressionSignal: 2,        // Regression Signal = Over or Strong Over
  zScoreSignal: 1,            // Z-Score Signal = Over or Strong Over
  threshold: 7,               // Need 7+ points to qualify
  maxPoints: 11,
} as const;

// STRONG BET match-level hybrid thresholds
export const STRONG_BET_HYBRID = {
  o25Prob:   { floor: 65, multiplier: 1.10 },  // O2.5 ≥ max(65%, leagueO25*1.10)
  o35Prob:   { floor: 42, multiplier: 1.25 },  // O3.5 ≥ max(42%, leagueO35*1.25)
  bttsProb:  { floor: 55, multiplier: 1.12 },  // BTTS ≥ max(55%, leagueBTTS*1.12)
  bttsChecklistCount: 6,                         // BTTS Checklist ≥ 6/7 (absolute)
} as const;

// ---- GREY RESULT — 8 checks, need 6+ ----
export const GREY_RESULT_CONFIG = {
  bttsProb:  { floor: 55, multiplier: 1.12 },   // BTTS ≥ max(55%, leagueBTTS*1.12)
  o25Prob:   { floor: 65, multiplier: 1.10 },   // O2.5 ≥ max(65%, leagueO25*1.10)
  o35Prob:   { floor: 40, multiplier: 1.20 },   // O3.5 ≥ max(40%, leagueO35*1.20)
  bttsChecklistCount: 5,                          // BTTS Checklist ≥ 5/7 (absolute)
  over35ChecklistCount: 3,                        // O3.5 Checklist ≥ 3/7 (absolute)
  requiredChecks: 6,                              // Need 6+ of 8
} as const;

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
// Hybrid threshold helper
// ============================================================================
function hybridThreshold(floor: number, baseline: number, multiplier: number): number {
  return Math.max(floor, baseline * multiplier);
}

function hybridThresholdLabel(floor: number, baseline: number, multiplier: number): string {
  const effective = Math.max(floor, baseline * multiplier);
  return `${effective.toFixed(0)}% (floor ${floor}%)`;
}

function hybridThresholdNumLabel(floor: number, baseline: number, multiplier: number): string {
  const effective = Math.max(floor, baseline * multiplier);
  return `${effective.toFixed(2)} (floor ${floor})`;
}

// ============================================================================
// Filter computation functions
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

export interface ResolvedThresholds {
  modelBttsProb: number;
  homeAvgGoals: number;
  awayAvgGoals: number;
  modelO25Prob: number;
  shotConversion: number;
}

export interface ResolvedOver35Thresholds {
  modelO35Prob: number;
  bttsProb: number;
  homeAvgGoals: number;
  awayAvgGoals: number;
  shotConversion: number;
}

export interface SignalInput {
  xgSignal: string;
  regressionSignal: string;
  zScoreSignal: string;
}

/**
 * Resolve BTTS match-level thresholds against league baselines
 */
export function resolveBttsThresholds(baselines: LeagueBaselines): ResolvedThresholds {
  const t = BTTS_HYBRID_THRESHOLDS;
  return {
    modelBttsProb: hybridThreshold(t.modelBttsProb.floor, baselines.bttsRate, t.modelBttsProb.multiplier),
    homeAvgGoals: hybridThreshold(t.homeAvgGoals.floor, baselines.avgHomeGoals, t.homeAvgGoals.multiplier),
    awayAvgGoals: hybridThreshold(t.awayAvgGoals.floor, baselines.avgAwayGoals, t.awayAvgGoals.multiplier),
    modelO25Prob: hybridThreshold(t.modelO25Prob.floor, baselines.over25Rate, t.modelO25Prob.multiplier),
    shotConversion: hybridThreshold(t.shotConversion.floor, baselines.shotConversion, t.shotConversion.multiplier),
  };
}

/**
 * Resolve Over 3.5 match-level thresholds against league baselines
 */
export function resolveOver35Thresholds(baselines: LeagueBaselines): ResolvedOver35Thresholds {
  const t = OVER35_HYBRID_THRESHOLDS;
  return {
    modelO35Prob: hybridThreshold(t.modelO35Prob.floor, baselines.over35Rate, t.modelO35Prob.multiplier),
    bttsProb: hybridThreshold(t.bttsProb.floor, baselines.bttsRate, t.bttsProb.multiplier),
    homeAvgGoals: hybridThreshold(t.homeAvgGoals.floor, baselines.avgHomeGoals, t.homeAvgGoals.multiplier),
    awayAvgGoals: hybridThreshold(t.awayAvgGoals.floor, baselines.avgAwayGoals, t.awayAvgGoals.multiplier),
    shotConversion: hybridThreshold(t.shotConversion.floor, baselines.shotConversion, t.shotConversion.multiplier),
  };
}

/**
 * Resolve STRONG BET thresholds against league baselines
 */
export function resolveStrongBetThresholds(baselines: LeagueBaselines) {
  const t = STRONG_BET_HYBRID;
  return {
    o25Prob: hybridThreshold(t.o25Prob.floor, baselines.over25Rate, t.o25Prob.multiplier),
    o35Prob: hybridThreshold(t.o35Prob.floor, baselines.over35Rate, t.o35Prob.multiplier),
    bttsProb: hybridThreshold(t.bttsProb.floor, baselines.bttsRate, t.bttsProb.multiplier),
    bttsChecklistCount: t.bttsChecklistCount,
  };
}

/**
 * Resolve GREY RESULT thresholds against league baselines
 */
export function resolveGreyResultThresholds(baselines: LeagueBaselines) {
  const t = GREY_RESULT_CONFIG;
  return {
    bttsProb: hybridThreshold(t.bttsProb.floor, baselines.bttsRate, t.bttsProb.multiplier),
    o25Prob: hybridThreshold(t.o25Prob.floor, baselines.over25Rate, t.o25Prob.multiplier),
    o35Prob: hybridThreshold(t.o35Prob.floor, baselines.over35Rate, t.o35Prob.multiplier),
    bttsChecklistCount: t.bttsChecklistCount,
    over35ChecklistCount: t.over35ChecklistCount,
    requiredChecks: t.requiredChecks,
  };
}

// ============================================================================
// Checklist computation (with resolved thresholds)
// ============================================================================

/**
 * Compute BTTS checklist score (0-7) using league-adapted thresholds
 */
export function computeBttsChecklist(input: ChecklistInput, baselines: LeagueBaselines): number {
  const lt = BTTS_LEAGUE_THRESHOLDS;
  const rt = resolveBttsThresholds(baselines);
  let count = 0;
  if (input.avgGoalsPerGame >= lt.leagueAvgGoals) count++;
  if (input.over25Percent >= lt.leagueO25Rate) count++;
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
export function computeBttsChecklistLabels(input: ChecklistInput, baselines: LeagueBaselines): string[] {
  const lt = BTTS_LEAGUE_THRESHOLDS;
  const rt = resolveBttsThresholds(baselines);
  const checks: string[] = [];
  if (input.avgGoalsPerGame >= lt.leagueAvgGoals) checks.push(`League Avg Goals \u2265${lt.leagueAvgGoals}`);
  if (input.over25Percent >= lt.leagueO25Rate) checks.push(`League O2.5 Rate \u2265${lt.leagueO25Rate}%`);
  if (input.bttsProb >= rt.modelBttsProb) checks.push(`Model BTTS Prob \u2265${rt.modelBttsProb.toFixed(0)}%`);
  if (input.avgHomeGoals >= rt.homeAvgGoals) checks.push(`Home Avg Goals \u2265${rt.homeAvgGoals.toFixed(2)}`);
  if (input.avgAwayGoals >= rt.awayAvgGoals) checks.push(`Away Avg Goals \u2265${rt.awayAvgGoals.toFixed(2)}`);
  if (input.o25Prob >= rt.modelO25Prob) checks.push(`Model O2.5 Prob \u2265${rt.modelO25Prob.toFixed(0)}%`);
  if (input.overallShotConversion >= rt.shotConversion) checks.push(`Shot Conversion \u2265${rt.shotConversion.toFixed(0)}%`);
  return checks;
}

/**
 * Compute Over 3.5 checklist score (0-7) using league-adapted thresholds
 */
export function computeOver35Checklist(input: ChecklistInput, baselines: LeagueBaselines): number {
  const lt = OVER35_LEAGUE_THRESHOLDS;
  const rt = resolveOver35Thresholds(baselines);
  let count = 0;
  if (input.avgGoalsPerGame >= lt.leagueAvgGoals) count++;
  if (input.o35Prob >= rt.modelO35Prob) count++;
  if (input.bttsProb >= rt.bttsProb) count++;
  if (input.over25Percent >= lt.leagueO25Rate) count++;
  if (input.avgHomeGoals >= rt.homeAvgGoals) count++;
  if (input.avgAwayGoals >= rt.awayAvgGoals) count++;
  if (input.overallShotConversion >= rt.shotConversion) count++;
  return count;
}

/**
 * Compute Over 3.5 checklist labels (for CSV export)
 */
export function computeOver35ChecklistLabels(input: ChecklistInput, baselines: LeagueBaselines): string[] {
  const lt = OVER35_LEAGUE_THRESHOLDS;
  const rt = resolveOver35Thresholds(baselines);
  const checks: string[] = [];
  if (input.avgGoalsPerGame >= lt.leagueAvgGoals) checks.push(`League Avg Goals \u2265${lt.leagueAvgGoals}`);
  if (input.o35Prob >= rt.modelO35Prob) checks.push(`Model O3.5 Prob \u2265${rt.modelO35Prob.toFixed(0)}%`);
  if (input.bttsProb >= rt.bttsProb) checks.push(`BTTS Prob \u2265${rt.bttsProb.toFixed(0)}%`);
  if (input.over25Percent >= lt.leagueO25Rate) checks.push(`O2.5 Rate \u2265${lt.leagueO25Rate}%`);
  if (input.avgHomeGoals >= rt.homeAvgGoals) checks.push(`Home Avg Goals \u2265${rt.homeAvgGoals.toFixed(2)}`);
  if (input.avgAwayGoals >= rt.awayAvgGoals) checks.push(`Away Avg Goals \u2265${rt.awayAvgGoals.toFixed(2)}`);
  if (input.overallShotConversion >= rt.shotConversion) checks.push(`Shot Conversion \u2265${rt.shotConversion.toFixed(0)}%`);
  return checks;
}

/**
 * Compute STRONG BET using points-based system with league-adapted thresholds.
 * Returns { isStrongBet, points, maxPoints, breakdown }
 */
export function computeStrongBet(
  checklistInput: ChecklistInput,
  signals: SignalInput,
  baselines: LeagueBaselines
): {
  isStrongBet: boolean;
  points: number;
  maxPoints: number;
  breakdown: { check: string; points: number; passed: boolean }[];
} {
  const st = resolveStrongBetThresholds(baselines);
  const p = STRONG_BET_POINTS;

  const bttsCount = computeBttsChecklist(checklistInput, baselines);
  const isOverSignal = (sig: string) => sig === 'Over' || sig === 'Strong Over';

  const checks = [
    { check: `O2.5 \u2265${st.o25Prob.toFixed(0)}%`, points: p.o25, passed: checklistInput.o25Prob >= st.o25Prob },
    { check: `O3.5 \u2265${st.o35Prob.toFixed(0)}%`, points: p.o35, passed: checklistInput.o35Prob >= st.o35Prob },
    { check: `BTTS \u2265${st.bttsProb.toFixed(0)}%`, points: p.btts, passed: checklistInput.bttsProb >= st.bttsProb },
    { check: `BTTS Checklist \u2265${st.bttsChecklistCount}/7`, points: p.bttsChecklist, passed: bttsCount >= st.bttsChecklistCount },
    { check: 'xG Signal = Over', points: p.xgSignal, passed: isOverSignal(signals.xgSignal) },
    { check: 'Regression Signal = Over', points: p.regressionSignal, passed: isOverSignal(signals.regressionSignal) },
    { check: 'Z-Score Signal = Over', points: p.zScoreSignal, passed: isOverSignal(signals.zScoreSignal) },
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
 * Compute GREY RESULT using league-adapted thresholds.
 * Returns { isGreyResult, score, totalChecks, breakdown }
 */
export function computeGreyResult(
  checklistInput: ChecklistInput,
  signals: SignalInput,
  baselines: LeagueBaselines
): {
  isGreyResult: boolean;
  score: number;
  totalChecks: number;
  breakdown: { check: string; passed: boolean }[];
} {
  const gt = resolveGreyResultThresholds(baselines);
  const bttsCount = computeBttsChecklist(checklistInput, baselines);
  const o35Count = computeOver35Checklist(checklistInput, baselines);

  const checks = [
    { check: 'Regression = Strong Over', passed: signals.regressionSignal === 'Strong Over' },
    { check: 'Z-Score = Strong Over', passed: signals.zScoreSignal === 'Strong Over' },
    { check: 'xG = Strong Over', passed: signals.xgSignal === 'Strong Over' },
    { check: `BTTS Checklist \u2265${gt.bttsChecklistCount}/7`, passed: bttsCount >= gt.bttsChecklistCount },
    { check: `BTTS \u2265${gt.bttsProb.toFixed(0)}%`, passed: checklistInput.bttsProb >= gt.bttsProb },
    { check: `O2.5 \u2265${gt.o25Prob.toFixed(0)}%`, passed: checklistInput.o25Prob >= gt.o25Prob },
    { check: `O3.5 Checklist \u2265${gt.over35ChecklistCount}/7`, passed: o35Count >= gt.over35ChecklistCount },
    { check: `O3.5 \u2265${gt.o35Prob.toFixed(0)}%`, passed: checklistInput.o35Prob >= gt.o35Prob },
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
 * Get display-friendly threshold info for BTTS checklist items (for BttsCheckTab UI)
 */
export function getBttsDisplayThresholds(baselines: LeagueBaselines) {
  const lt = BTTS_LEAGUE_THRESHOLDS;
  const rt = resolveBttsThresholds(baselines);
  return {
    leagueAvgGoals: lt.leagueAvgGoals,
    leagueO25Rate: lt.leagueO25Rate,
    modelBttsProb: rt.modelBttsProb,
    homeAvgGoals: rt.homeAvgGoals,
    awayAvgGoals: rt.awayAvgGoals,
    modelO25Prob: rt.modelO25Prob,
    shotConversion: rt.shotConversion,
  };
}

/**
 * Get display-friendly threshold info for Over 3.5 checklist items (for Over35Tab UI)
 */
export function getOver35DisplayThresholds(baselines: LeagueBaselines) {
  const lt = OVER35_LEAGUE_THRESHOLDS;
  const rt = resolveOver35Thresholds(baselines);
  return {
    leagueAvgGoals: lt.leagueAvgGoals,
    modelO35Prob: rt.modelO35Prob,
    bttsProb: rt.bttsProb,
    leagueO25Rate: lt.leagueO25Rate,
    homeAvgGoals: rt.homeAvgGoals,
    awayAvgGoals: rt.awayAvgGoals,
    shotConversion: rt.shotConversion,
  };
}
