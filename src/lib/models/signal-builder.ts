// ============================================================================
// signal-builder.ts — Compute the 8-signal combo string from a prediction
// ============================================================================
// This is the SINGLE SOURCE OF TRUTH for combo-string construction.
// Both the PredictionsTab UI and the live Match Backtest API use this.
//
// The combo string format (matches what PredictionsTab previously built):
//   "SB:Y | GR:N | GF:Y | BTTS:Qualified | GOAL:Likely | MOM:NEUTRAL | FP1:Y | BH:Unlikely"
//
// 8 signals:
//   SB    Strong Bet (Y/N)            — 7+ points on the points-based system
//   GR    Grey Result (Y/N)           — 6+ of 10 checks pass
//   GF    Goal Fest (Y/N)             — 5+ of 6 checks pass
//   BTTS  BTTS tier                   — Strong/Qualified/Weak/Avoid
//   GOAL  Goal tier                   — Rich/Likely/Borderline/Thin/Stall
//   MOM   Momentum match signal       — LEAN OVER/OVER/NEUTRAL/UNDER/LEAN UNDER
//   FP1   FP1 signal (Y/N)            — Mixed (Over Lean) Regression + Z-Score Neutral
//   BH    BTTS-Both-Halves tier       — Strong/Qualified/Borderline/Unlikely
// ============================================================================

import type { MatchResult, Analytics, TeamStats } from '@/lib/types';
import {
  computeLeagueBaselines, resolveAllThresholds,
  computeStrongBet, computeGreyResult, computeGoalFest,
  computeBTTSQualification,
  computeMomentumSignal,
  computeBTTSBothHalves,
  classifyPerTeamRegressionSignal,
  type ChecklistInput, type SignalInput,
  type MomentumTeamInput,
} from '@/lib/betting-filters';

export interface SignalBuildContext {
  /** All matches in the league (training + test), sorted by date asc */
  allMatches: MatchResult[];
  /** League analytics (avgGoalsPerGame, over25Percent, etc.) */
  analytics: Analytics;
  /** Combined team stats (from combineWeightedTeamStats or calculateTeamStats) */
  teamStats: Map<string, TeamStats>;
  /** League code (e.g. 'E0') */
  league: string;
  /** Pre-resolved thresholds (computed once per league) */
  resolved?: ReturnType<typeof resolveAllThresholds>;
  /** Pre-computed league baselines (computed once per league) */
  baselines?: ReturnType<typeof computeLeagueBaselines>;
}

export interface MatchSignals {
  comboString: string;
  signals: {
    sb: 'Y' | 'N';
    gr: 'Y' | 'N';
    gf: 'Y' | 'N';
    btts: 'Strong' | 'Qualified' | 'Weak' | 'Avoid';
    goal: 'Rich' | 'Likely' | 'Borderline' | 'Thin' | 'Stall';
    mom: string;
    fp1: 'Y' | 'N';
    bh: 'Strong' | 'Qualified' | 'Borderline' | 'Unlikely';
  };
  /** The prediction inputs/values used to compute signals (for debugging) */
  prediction: {
    homeWin: number;
    draw: number;
    awayWin: number;
    over25: number;
    over35: number;
    btts: number;
    homeXg: number;
    awayXg: number;
  };
}

/**
 * Compute all 8 signals + combo string for a single match.
 *
 * This mirrors the logic in src/components/tabs/PredictionsTab.tsx around
 * lines 380-985, but is callable from the server (no React dependencies).
 *
 * The combo string format is:
 *   "SB:Y | GR:N | GF:Y | BTTS:Qualified | GOAL:Likely | MOM:NEUTRAL | FP1:Y | BH:Unlikely"
 *
 * @param match         The match to compute signals for (must have homeTeam, awayTeam, date)
 * @param prediction    The full PredictionResponse from generatePredictionCore
 *                      (or extractBacktestShape if from backtest)
 * @param ctx           Shared context (matches, analytics, team stats, league)
 * @param beforeDate    If set, only use matches with date < beforeDate for signal inputs
 *                      (rolling, regression, momentum) — prevents look-ahead bias in backtest
 */
export function computeMatchSignals(
  match: { homeTeam: string; awayTeam: string; date: string; season: string; },
  prediction: {
    homeWin: number; draw: number; awayWin: number;
    over25: number; over35: number; btts: number;
    homeXg: number; awayXg: number;
  },
  ctx: SignalBuildContext,
  beforeDate?: string,
): MatchSignals | null {
  const { allMatches, analytics, teamStats, league } = ctx;

  // Resolve thresholds once per league (cached on the context if provided)
  const resolved = ctx.resolved ?? resolveAllThresholds(league, ctx.baselines ?? computeLeagueBaselines(allMatches, analytics));
  const baselines = ctx.baselines ?? computeLeagueBaselines(allMatches, analytics);

  // ─── Predicted values ─────────────────────────────────────────────
  const homeStats = teamStats.get(match.homeTeam);
  const awayStats = teamStats.get(match.awayTeam);
  if (!homeStats || !awayStats) return null;

  const o25ProbValue = prediction.over25;
  const o35ProbValue = prediction.over35;
  const bttsProbValue = prediction.btts;
  const drawProbValue = prediction.draw;

  // ─── Match-scoped inputs (date-filtered for walk-forward) ─────────
  // Use matches BEFORE this match's date for signal inputs to avoid look-ahead bias.
  const beforeMs = beforeDate ? parseDate(beforeDate) : parseDate(match.date);

  const trainingMatches = allMatches.filter(m => parseDate(m.date) < beforeMs);
  if (trainingMatches.length === 0) return null;

  // ─── O2.5 implied probability from bookmaker odds ────────────────
  // Find the most recent match for this matchup that has odds (or null if none)
  const oddsMatch = trainingMatches.find(m =>
    ((m.homeTeam === match.homeTeam && m.awayTeam === match.awayTeam) ||
     (m.homeTeam === match.awayTeam && m.awayTeam === match.homeTeam)) &&
    m.oddsAvgOver25 && m.oddsAvgOver25 > 1.01
  );
  const o25ImpliedProb = oddsMatch?.oddsAvgOver25
    ? Math.round((1 / oddsMatch.oddsAvgOver25) * 100 * 10) / 10
    : null;

  // ─── Draw probability from bookmaker odds ────────────────────────
  const oddsDrawMatch = trainingMatches.find(m =>
    ((m.homeTeam === match.homeTeam && m.awayTeam === match.awayTeam) ||
     (m.homeTeam === match.awayTeam && m.awayTeam === match.homeTeam)) &&
    m.oddsAvgHome && m.oddsAvgHome > 1.01 &&
    m.oddsAvgDraw && m.oddsAvgDraw > 1.01 &&
    m.oddsAvgAway && m.oddsAvgAway > 1.01
  );
  let drawProb: number | null = null;
  if (oddsDrawMatch?.oddsAvgHome && oddsDrawMatch?.oddsAvgDraw && oddsDrawMatch?.oddsAvgAway) {
    const h = oddsDrawMatch.oddsAvgHome;
    const d = oddsDrawMatch.oddsAvgDraw;
    const a = oddsDrawMatch.oddsAvgAway;
    const overround = (1 / h) + (1 / d) + (1 / a);
    drawProb = Math.round((1 / d) / overround * 100);
  }

  // ─── Rolling 5-game scoring (per-venue) ───────────────────────────
  const sortedTraining = [...trainingMatches].sort((a, b) => parseDate(a.date) - parseDate(b.date));
  const homeHomeMatches = sortedTraining.filter(m => m.homeTeam === match.homeTeam).slice(-5);
  const awayAwayMatches = sortedTraining.filter(m => m.awayTeam === match.awayTeam).slice(-5);
  const rollingHomeScored = homeHomeMatches.length > 0
    ? homeHomeMatches.reduce((s, m) => s + m.ftHomeGoals, 0) / homeHomeMatches.length : analytics.avgHomeGoals;
  const rollingAwayScored = awayAwayMatches.length > 0
    ? awayAwayMatches.reduce((s, m) => s + m.ftAwayGoals, 0) / awayAwayMatches.length : analytics.avgAwayGoals;
  const rollingCombinedScoring = rollingHomeScored + rollingAwayScored;

  // ─── xG approximation from shots (same as PredictionsTab) ────────
  const teamXgStats = new Map<string, {
    matches: number; totalXg: number; actualGoals: number; shotsOnTarget: number;
  }>();
  for (const r of trainingMatches) {
    const homeShotsOff = r.homeShots - r.homeShotsOnTarget;
    const awayShotsOff = r.awayShots - r.awayShotsOnTarget;
    const homeXg = (r.homeShotsOnTarget * 0.30) + (homeShotsOff * 0.08);
    const awayXg = (r.awayShotsOnTarget * 0.30) + (awayShotsOff * 0.08);

    const h = teamXgStats.get(r.homeTeam) || { matches: 0, totalXg: 0, actualGoals: 0, shotsOnTarget: 0 };
    h.matches++; h.totalXg += homeXg; h.actualGoals += r.ftHomeGoals; h.shotsOnTarget += r.homeShotsOnTarget;
    teamXgStats.set(r.homeTeam, h);

    const a = teamXgStats.get(r.awayTeam) || { matches: 0, totalXg: 0, actualGoals: 0, shotsOnTarget: 0 };
    a.matches++; a.totalXg += awayXg; a.actualGoals += r.ftAwayGoals; a.shotsOnTarget += r.awayShotsOnTarget;
    teamXgStats.set(r.awayTeam, a);
  }

  const homeXgData = teamXgStats.get(match.homeTeam);
  const awayXgData = teamXgStats.get(match.awayTeam);

  let xgSignal = 'Neutral';
  if (homeXgData && awayXgData) {
    const homeXgDiff = (homeXgData.actualGoals / homeXgData.matches) - (homeXgData.totalXg / homeXgData.matches);
    const awayXgDiff = (awayXgData.actualGoals / awayXgData.matches) - (awayXgData.totalXg / awayXgData.matches);
    const totalXgDiff = homeXgDiff + awayXgDiff;
    if (totalXgDiff <= -1.0) xgSignal = 'Strong Over';
    else if (totalXgDiff <= -0.5) xgSignal = 'Over';
    else if (totalXgDiff >= 1.0) xgSignal = 'Strong Under';
    else if (totalXgDiff >= 0.5) xgSignal = 'Under';
  }

  // ─── Z-Score signal ──────────────────────────────────────────────
  const zTeamStats = new Map<string, {
    matches: number; goals: number[]; totalGoals: number; mean: number;
    stdDev: number; last3Avg: number;
  }>();
  for (const r of trainingMatches) {
    const homeKey = r.homeTeam;
    const awayKey = r.awayTeam;
    const homeGoals = r.ftHomeGoals;
    const awayGoals = r.ftAwayGoals;
    const homeTotal = r.ftHomeGoals + r.ftAwayGoals;
    const awayTotal = r.ftHomeGoals + r.ftAwayGoals;

    let h = zTeamStats.get(homeKey);
    if (!h) {
      h = { matches: 0, goals: [], totalGoals: 0, mean: 0, stdDev: 0, last3Avg: 0 };
      zTeamStats.set(homeKey, h);
    }
    h.matches++;
    h.goals.push(homeTotal);
    h.totalGoals += homeTotal;

    let a = zTeamStats.get(awayKey);
    if (!a) {
      a = { matches: 0, goals: [], totalGoals: 0, mean: 0, stdDev: 0, last3Avg: 0 };
      zTeamStats.set(awayKey, a);
    }
    a.matches++;
    a.goals.push(awayTotal);
    a.totalGoals += awayTotal;
  }
  for (const [, s] of zTeamStats) {
    s.mean = s.matches > 0 ? s.totalGoals / s.matches : 0;
    const variance = s.matches > 1
      ? s.goals.reduce((sum, g) => sum + Math.pow(g - s.mean, 2), 0) / s.matches
      : 0;
    s.stdDev = Math.sqrt(variance);
    s.last3Avg = s.goals.length >= 3
      ? s.goals.slice(-3).reduce((a, b) => a + b, 0) / 3
      : s.mean;
  }
  const homeZ = zTeamStats.get(match.homeTeam);
  const awayZ = zTeamStats.get(match.awayTeam);
  let zScoreSignal = 'Neutral';
  if (homeZ && awayZ && homeZ.matches >= 5 && awayZ.matches >= 5) {
    const homeZVal = homeZ.stdDev > 0 ? (homeZ.last3Avg - homeZ.mean) / homeZ.stdDev : 0;
    const awayZVal = awayZ.stdDev > 0 ? (awayZ.last3Avg - awayZ.mean) / awayZ.stdDev : 0;
    const combinedZ = (homeZVal + awayZVal) / 2;
    if (combinedZ >= 1.0) zScoreSignal = 'Strong Under';
    else if (combinedZ >= 0.5) zScoreSignal = 'Under';
    else if (combinedZ <= -1.0) zScoreSignal = 'Strong Over';
    else if (combinedZ <= -0.5) zScoreSignal = 'Over';
  }

  // ─── FP1 signal (specific combo) ─────────────────────────────────
  // FP1 fires when: Regression = Mixed (Over Lean) AND Z-Score = Neutral
  let fp1RegressionLabel = 'Neutral';
  if (xgSignal === 'Strong Over') fp1RegressionLabel = 'Strong Over';
  else if (xgSignal === 'Over') fp1RegressionLabel = 'Mixed (Over Lean)';
  else if (xgSignal === 'Strong Under') fp1RegressionLabel = 'Strong Under';
  else if (xgSignal === 'Under') fp1RegressionLabel = 'Mixed (Under Lean)';

  let fp1ZScoreLabel = 'Neutral';
  if (zScoreSignal === 'Strong Over') fp1ZScoreLabel = 'Strong Over';
  else if (zScoreSignal === 'Over') fp1ZScoreLabel = 'Mixed (Over Lean)';
  else if (zScoreSignal === 'Strong Under') fp1ZScoreLabel = 'Strong Under';
  else if (zScoreSignal === 'Under') fp1ZScoreLabel = 'Mixed (Under Lean)';

  const isFP1Signal = fp1RegressionLabel === 'Mixed (Over Lean)' && fp1ZScoreLabel === 'Neutral';

  // ─── Momentum signal ──────────────────────────────────────────────
  // Compute per-team last-5-goals (total goals per match) for momentum input
  const homeLast5Goals = homeHomeMatches.slice(-5).map(m => m.ftHomeGoals + m.ftAwayGoals);
  const awayLast5Goals = awayAwayMatches.slice(-5).map(m => m.ftHomeGoals + m.ftAwayGoals);

  const homeSeasonAvg = analytics.avgGoalsPerGame;
  const awaySeasonAvg = analytics.avgGoalsPerGame;

  const homeXgDiff = homeXgData && homeXgData.matches > 0
    ? (homeXgData.actualGoals / homeXgData.matches) - (homeXgData.totalXg / homeXgData.matches) : 0;
  const awayXgDiff = awayXgData && awayXgData.matches > 0
    ? (awayXgData.actualGoals / awayXgData.matches) - (awayXgData.totalXg / awayXgData.matches) : 0;

  const homeSotPerGame = homeXgData && homeXgData.matches > 0
    ? homeXgData.shotsOnTarget / homeXgData.matches : null;
  const awaySotPerGame = awayXgData && awayXgData.matches > 0
    ? awayXgData.shotsOnTarget / awayXgData.matches : null;

  const homeMomentumInput: MomentumTeamInput = {
    last5Goals: homeLast5Goals,
    seasonAvg: homeSeasonAvg,
    xgDiff: homeXgDiff,
    sotPerGame: homeSotPerGame,
  };
  const awayMomentumInput: MomentumTeamInput = {
    last5Goals: awayLast5Goals,
    seasonAvg: awaySeasonAvg,
    xgDiff: awayXgDiff,
    sotPerGame: awaySotPerGame,
  };
  const momentumResult = computeMomentumSignal(homeMomentumInput, awayMomentumInput);
  const momLabel = (momentumResult.matchSignal || 'NEUTRAL').replace('MOMENTUM ', '');

  // ─── Checklist input ──────────────────────────────────────────────
  const bttsChecklistInput: ChecklistInput = {
    avgGoalsPerGame: analytics.avgGoalsPerGame,
    over25Percent: analytics.over25Percent,
    bttsProb: bttsProbValue,
    avgHomeGoals: analytics.avgHomeGoals,
    avgAwayGoals: analytics.avgAwayGoals,
    o25Prob: o25ProbValue,
    o35Prob: o35ProbValue,
    overallShotConversion: parseFloat(analytics.overallShotConversion),
    rollingHomeScored,
    rollingAwayScored,
    rollingCombinedScoring,
    o25ImpliedProb,
    drawProb,
  };

  const signalInput: SignalInput = {
    xgSignal,
    regressionSignal: xgSignal, // In PredictionsTab these are the same
    zScoreSignal,
  };

  // ─── Signal detectors ─────────────────────────────────────────────
  const strongBetResult = computeStrongBet(bttsChecklistInput, signalInput, resolved, {
    momentumSignal: momentumResult.matchSignal,
    leagueBttsRate: baselines.bttsRate,
  });
  const isStrongBet = strongBetResult.isStrongBet;

  const greyResultData = computeGreyResult(bttsChecklistInput, signalInput, resolved);
  const isGreyResult = greyResultData.isGreyResult;

  const goalFestData = computeGoalFest(bttsChecklistInput, signalInput, resolved);
  const isGoalFest = goalFestData.isGoalFest;

  // Per-team signals for BTTS qualification
  const homeRegSignalPerTeam = classifyPerTeamRegressionSignal(homeXgDiff);
  const awayRegSignalPerTeam = classifyPerTeamRegressionSignal(awayXgDiff);

  const homeZForQualifier = homeZ && homeZ.matches >= 5 && homeZ.stdDev > 0
    ? (homeZ.last3Avg - homeZ.mean) / homeZ.stdDev : 0;
  const awayZForQualifier = awayZ && awayZ.matches >= 5 && awayZ.stdDev > 0
    ? (awayZ.last3Avg - awayZ.mean) / awayZ.stdDev : 0;

  const bttsQualification = computeBTTSQualification({
    homeRegressionSignal: homeRegSignalPerTeam,
    awayRegressionSignal: awayRegSignalPerTeam,
    homeXgDiff: homeXgDiff,
    awayXgDiff: awayXgDiff,
    homeZScore: homeZForQualifier,
    awayZScore: awayZForQualifier,
    homeSotConversion: null,
    awaySotConversion: null,
    favoriteOdds: null,
    homeMomentumSignal: momentumResult.homeSignal,
    awayMomentumSignal: momentumResult.awaySignal,
  });

  const bttsTierMap: Record<string, 'Strong' | 'Qualified' | 'Weak' | 'Avoid'> = {
    'BTTS STRONG': 'Strong',
    'BTTS QUALIFIED': 'Qualified',
    'BTTS WEAK': 'Weak',
    'BTTS AVOID': 'Avoid',
  };
  const bttsTierLabel = bttsTierMap[bttsQualification.tier] || 'Avoid';

  // Combined xG total for goal tier
  const homeXgPerGame = homeXgData && homeXgData.matches > 0 ? homeXgData.totalXg / homeXgData.matches : 0;
  const awayXgPerGame = awayXgData && awayXgData.matches > 0 ? awayXgData.totalXg / awayXgData.matches : 0;
  const combinedXgTotal = homeXgPerGame + awayXgPerGame;

  const goalTierLabel: 'Rich' | 'Likely' | 'Borderline' | 'Thin' | 'Stall' =
    combinedXgTotal > 3 ? 'Rich'
    : combinedXgTotal > 2.5 ? 'Likely'
    : combinedXgTotal > 2 ? 'Borderline'
    : combinedXgTotal > 1.5 ? 'Thin' : 'Stall';

  // ─── BTTS-Both-Halves ────────────────────────────────────────────
  const bttsBHResult = computeBTTSBothHalves({
    o25Prob: o25ProbValue,
    o35Prob: o35ProbValue,
    bttsProb: bttsProbValue,
    rollingCombinedScoring,
    o25ImpliedProb,
    drawProb: drawProbValue,
    avgGoalsPerGame: analytics.avgGoalsPerGame,
  });

  const bhTierMap: Record<string, 'Strong' | 'Qualified' | 'Borderline' | 'Unlikely'> = {
    'BTTS-BH STRONG': 'Strong',
    'BTTS-BH QUALIFIED': 'Qualified',
    'BTTS-BH BORDERLINE': 'Borderline',
    'BTTS-BH UNLIKELY': 'Unlikely',
  };
  const bhTierLabel = bhTierMap[bttsBHResult.tier] || 'Unlikely';

  // ─── Build combo string ──────────────────────────────────────────
  const comboString = [
    'SB:' + (isStrongBet ? 'Y' : 'N'),
    'GR:' + (isGreyResult ? 'Y' : 'N'),
    'GF:' + (isGoalFest ? 'Y' : 'N'),
    'BTTS:' + bttsTierLabel,
    'GOAL:' + goalTierLabel,
    'MOM:' + momLabel,
    'FP1:' + (isFP1Signal ? 'Y' : 'N'),
    'BH:' + bhTierLabel,
  ].join(' | ');

  return {
    comboString,
    signals: {
      sb: isStrongBet ? 'Y' : 'N',
      gr: isGreyResult ? 'Y' : 'N',
      gf: isGoalFest ? 'Y' : 'N',
      btts: bttsTierLabel,
      goal: goalTierLabel,
      mom: momLabel,
      fp1: isFP1Signal ? 'Y' : 'N',
      bh: bhTierLabel,
    },
    prediction: {
      homeWin: prediction.homeWin,
      draw: prediction.draw,
      awayWin: prediction.awayWin,
      over25: prediction.over25,
      over35: prediction.over35,
      btts: prediction.btts,
      homeXg: prediction.homeXg,
      awayXg: prediction.awayXg,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────
// Date parsing helper
// ──────────────────────────────────────────────────────────────────────

function parseDate(dateStr: string): number {
  if (!dateStr) return 0;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    let y = parseInt(parts[2]);
    if (y < 100) y += y < 50 ? 2000 : 1900;
    return new Date(y, parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
  }
  return new Date(dateStr).getTime();
}
