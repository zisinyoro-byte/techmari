// ============================================================================
// Shared Betting Filter Configuration — Single Source of Truth
// ============================================================================
// All checklist thresholds, STRONG BET points system, GREY RESULT criteria
// Used by: PredictionsTab, ModelsTab, BttsCheckTab, Over35Tab
// ============================================================================

// ---- BTTS Checklist (7 auto-check criteria) ----
export const BTTS_THRESHOLDS = {
  leagueAvgGoals: 2.7,       // ≥ 2.7 (was 2.5)
  leagueO25Rate: 58,          // ≥ 58% (was 50%)
  modelBttsProb: 58,          // ≥ 58% (was 53%)
  homeAvgGoals: 1.4,          // ≥ 1.4 (was 1.2)
  awayAvgGoals: 1.2,          // ≥ 1.2 (was 1.0)
  modelO25Prob: 65,           // ≥ 65% (was 68%)
  shotConversion: 13,         // ≥ 13% (was 10%)
} as const;

// ---- Over 3.5 Checklist (7 auto-check criteria) ----
export const OVER35_THRESHOLDS = {
  leagueAvgGoals: 3.0,        // ≥ 3.0 (was 2.8)
  modelO35Prob: 42,           // ≥ 42% (was 35%)
  bttsProb: 55,               // ≥ 55% (was 53%)
  leagueO25Rate: 60,          // ≥ 60% (was 55%)
  homeAvgGoals: 1.6,          // ≥ 1.6 (was 1.4)
  awayAvgGoals: 1.3,          // ≥ 1.3 (was 1.2)
  shotConversion: 14,         // ≥ 14% (was 12%)
} as const;

// ---- STRONG BET — Points-based system (need 7+ of 11) ----
export const STRONG_BET_POINTS = {
  o25: 2,                     // O2.5 ≥ 68%
  o35: 1,                     // O3.5 ≥ 45%
  btts: 1,                    // BTTS ≥ 58%
  bttsChecklist: 2,           // BTTS Checklist ≥ 6/7
  xgSignal: 2,                // xG Signal = Over or Strong Over
  regressionSignal: 2,        // Regression Signal = Over or Strong Over
  zScoreSignal: 1,            // Z-Score Signal = Over or Strong Over
  threshold: 7,               // Need 7+ points to qualify
  maxPoints: 11,
} as const;

// Thresholds used inside STRONG BET point checks
export const STRONG_BET_THRESHOLDS = {
  o25Prob: 68,
  o35Prob: 45,
  bttsProb: 58,
  bttsChecklistCount: 6,
} as const;

// ---- GREY RESULT — 8 checks, need 6+ ----
export const GREY_RESULT_THRESHOLDS = {
  bttsProb: 58,               // ≥ 58% (was 53%)
  o25Prob: 68,                // O2.5 ≥ 68%
  o35Prob: 42,                // ≥ 42% (was 35%)
  bttsChecklistCount: 5,      // BTTS Checklist ≥ 5/7
  over35ChecklistCount: 3,    // O3.5 Checklist ≥ 3/7
  requiredChecks: 6,          // Need 6+ of 8
} as const;

// ---- Signal thresholds (xG, Regression, Z-Score) ----
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

export interface SignalInput {
  xgSignal: string;
  regressionSignal: string;
  zScoreSignal: string;
}

/**
 * Compute BTTS checklist score (0-7)
 */
export function computeBttsChecklist(input: ChecklistInput): number {
  const t = BTTS_THRESHOLDS;
  let count = 0;
  if (input.avgGoalsPerGame >= t.leagueAvgGoals) count++;
  if (input.over25Percent >= t.leagueO25Rate) count++;
  if (input.bttsProb >= t.modelBttsProb) count++;
  if (input.avgHomeGoals >= t.homeAvgGoals) count++;
  if (input.avgAwayGoals >= t.awayAvgGoals) count++;
  if (input.o25Prob >= t.modelO25Prob) count++;
  if (input.overallShotConversion >= t.shotConversion) count++;
  return count;
}

/**
 * Compute BTTS checklist as array of passed labels (for CSV export)
 */
export function computeBttsChecklistLabels(input: ChecklistInput): string[] {
  const t = BTTS_THRESHOLDS;
  const checks: string[] = [];
  if (input.avgGoalsPerGame >= t.leagueAvgGoals) checks.push('League Avg Goals \u22652.7');
  if (input.over25Percent >= t.leagueO25Rate) checks.push('League O2.5 Rate \u226558%');
  if (input.bttsProb >= t.modelBttsProb) checks.push('Model BTTS Prob \u226558%');
  if (input.avgHomeGoals >= t.homeAvgGoals) checks.push('Home Avg Goals \u22651.4');
  if (input.avgAwayGoals >= t.awayAvgGoals) checks.push('Away Avg Goals \u22651.2');
  if (input.o25Prob >= t.modelO25Prob) checks.push('Model O2.5 Prob \u226565%');
  if (input.overallShotConversion >= t.shotConversion) checks.push('Shot Conversion \u226513%');
  return checks;
}

/**
 * Compute Over 3.5 checklist score (0-7)
 */
export function computeOver35Checklist(input: ChecklistInput): number {
  const t = OVER35_THRESHOLDS;
  let count = 0;
  if (input.avgGoalsPerGame >= t.leagueAvgGoals) count++;
  if (input.o35Prob >= t.modelO35Prob) count++;
  if (input.bttsProb >= t.bttsProb) count++;
  if (input.over25Percent >= t.leagueO25Rate) count++;
  if (input.avgHomeGoals >= t.homeAvgGoals) count++;
  if (input.avgAwayGoals >= t.awayAvgGoals) count++;
  if (input.overallShotConversion >= t.shotConversion) count++;
  return count;
}

/**
 * Compute Over 3.5 checklist as array of passed labels (for CSV export)
 */
export function computeOver35ChecklistLabels(input: ChecklistInput): string[] {
  const t = OVER35_THRESHOLDS;
  const checks: string[] = [];
  if (input.avgGoalsPerGame >= t.leagueAvgGoals) checks.push('League Avg Goals \u22653.0');
  if (input.o35Prob >= t.modelO35Prob) checks.push('Model O3.5 Prob \u226542%');
  if (input.bttsProb >= t.bttsProb) checks.push('BTTS Prob \u226555%');
  if (input.over25Percent >= t.leagueO25Rate) checks.push('O2.5 Rate \u226560%');
  if (input.avgHomeGoals >= t.homeAvgGoals) checks.push('Home Avg Goals \u22651.6');
  if (input.avgAwayGoals >= t.awayAvgGoals) checks.push('Away Avg Goals \u22651.3');
  if (input.overallShotConversion >= t.shotConversion) checks.push('Shot Conversion \u226514%');
  return checks;
}

/**
 * Compute STRONG BET using the new points-based system.
 * Returns { isStrongBet, points, maxPoints, breakdown }
 */
export function computeStrongBet(
  checklistInput: ChecklistInput,
  signals: SignalInput
): {
  isStrongBet: boolean;
  points: number;
  maxPoints: number;
  breakdown: { check: string; points: number; passed: boolean }[];
} {
  const t = STRONG_BET_THRESHOLDS;
  const p = STRONG_BET_POINTS;

  const bttsCount = computeBttsChecklist(checklistInput);
  const isOverSignal = (sig: string) => sig === 'Over' || sig === 'Strong Over';

  const checks = [
    { check: 'O2.5 \u226568%', points: p.o25, passed: checklistInput.o25Prob >= t.o25Prob },
    { check: 'O3.5 \u226545%', points: p.o35, passed: checklistInput.o35Prob >= t.o35Prob },
    { check: 'BTTS \u226558%', points: p.btts, passed: checklistInput.bttsProb >= t.bttsProb },
    { check: 'BTTS Checklist \u22656/7', points: p.bttsChecklist, passed: bttsCount >= t.bttsChecklistCount },
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
 * Compute GREY RESULT using tightened criteria.
 * Returns { isGreyResult, score, totalChecks, breakdown }
 */
export function computeGreyResult(
  checklistInput: ChecklistInput,
  signals: SignalInput
): {
  isGreyResult: boolean;
  score: number;
  totalChecks: number;
  breakdown: { check: string; passed: boolean }[];
} {
  const t = GREY_RESULT_THRESHOLDS;
  const bttsCount = computeBttsChecklist(checklistInput);
  const o35Count = computeOver35Checklist(checklistInput);

  const checks = [
    { check: 'Regression = Strong Over', passed: signals.regressionSignal === 'Strong Over' },
    { check: 'Z-Score = Strong Over', passed: signals.zScoreSignal === 'Strong Over' },
    { check: 'xG = Strong Over', passed: signals.xgSignal === 'Strong Over' },
    { check: `BTTS Checklist \u2265${t.bttsChecklistCount}/7`, passed: bttsCount >= t.bttsChecklistCount },
    { check: `BTTS Prob \u2265${t.bttsProb}%`, passed: checklistInput.bttsProb >= t.bttsProb },
    { check: `O2.5 \u2265${t.o25Prob}%`, passed: checklistInput.o25Prob >= t.o25Prob },
    { check: `O3.5 Checklist \u2265${t.over35ChecklistCount}/7`, passed: o35Count >= t.over35ChecklistCount },
    { check: `O3.5 Prob \u2265${t.o35Prob}%`, passed: checklistInput.o35Prob >= t.o35Prob },
  ];

  const score = checks.filter(c => c.passed).length;

  return {
    isGreyResult: score >= t.requiredChecks,
    score,
    totalChecks: checks.length,
    breakdown: checks,
  };
}
