/**
 * Lean Detector Validation Backtest
 * ================================
 * Validates all 6 lean detectors after noise removal:
 *   1. BTTS Checklist (4 checks, need threshold)
 *   2. Over 3.5 Checklist (4 checks, need threshold)
 *   3. STRONG BET (6 checks, 13pts, need 7+)
 *   4. GREY RESULT (7 checks, need 5+)
 *   5. GOAL FEST (6 checks, need 5+)
 *   6. BTTS-BH (3 checks, need 2+)
 *
 * For each detector measures:
 *   - Fire rate (% of matches where detector triggers)
 *   - Hit rate (P(outcome | detector fires))
 *   - Base rate (P(outcome) unconditional)
 *   - Lift (hit rate / base rate)
 *   - Sample size
 *
 * Uses the same data pipeline as the app: fetchSeasonData + generateBacktestPredictions.
 */

import { fetchSeasonData } from '../src/lib/data-cache';
import { calculateLeagueAverages, generateBacktestPredictions } from '../src/lib/models/predictions';
import { calculateSeasonWeights } from '../src/lib/models/season-weighting';
import {
  computeBttsChecklist, computeOver35Checklist,
  computeStrongBet, computeGreyResult, computeGoalFest,
  computeBTTSBothHalves, resolveAllThresholds, computeLeagueBaselines,
  BTTS_HYBRID_THRESHOLDS, OVER35_HYBRID_THRESHOLDS,
  STRONG_BET_HYBRID, GREY_RESULT_CONFIG, GOAL_FEST_CONFIG,
  BTTS_BOTH_HALVES_CONFIG, O25_IMPLIED_THRESHOLDS, ROLLING_SCORING_THRESHOLDS,
} from '../src/lib/betting-filters';
import type { ChecklistInput, SignalInput } from '../src/lib/betting-filters';
import type { MatchResult } from '../src/lib/types';
import { goalProb } from '../src/lib/models/poisson';

// --- Config ---
const EUROPEAN_SEASONS = ['2526', '2425', '2324', '2223', '2122', '2021', '1920', '1819', '1718', '1617', '1516'];

const LEAGUES = [
  { code: 'E0', name: 'Premier League' },
  { code: 'D1', name: 'Bundesliga' },
  { code: 'I1', name: 'Serie A' },
  { code: 'SP1', name: 'La Liga' },
  { code: 'F1', name: 'Ligue 1' },
  { code: 'N1', name: 'Eredivisie' },
  { code: 'P1', name: 'Primeira Liga' },
];

const TEST_SEASONS = ['2324', '2425'];

// --- Helper: compute O3.5 probability from total xG ---
function computeO35Prob(totalXg: number): number {
  const p0 = Math.exp(-totalXg);
  const p1 = totalXg * p0;
  const p2 = (totalXg * totalXg / 2) * p0;
  const p3 = (totalXg ** 3 / 6) * p0;
  return Math.round((1 - p0 - p1 - p2 - p3) * 100);
}

// --- Helper: compute rolling 5-game combined scoring ---
function getRollingCombinedScoring(results: MatchResult[], team: string, isHome: boolean, beforeDate: string): number {
  const teamMatches = results
    .filter(r => r.date < beforeDate && (isHome ? r.homeTeam === team : r.awayTeam === team))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  
  if (teamMatches.length === 0) return 0;
  return teamMatches.reduce((sum, m) => sum + (isHome ? m.ftHomeGoals : m.ftAwayGoals), 0) / teamMatches.length;
}

// --- Helper: compute xG signal (same logic as PredictionsTab) ---
function computeXGSignal(results: MatchResult[], homeTeam: string, awayTeam: string): string {
  const teamXgStats = new Map<string, { matches: number; totalXg: number; actualGoals: number }>();
  
  results.forEach(r => {
    const homeShotsOff = r.homeShots - r.homeShotsOnTarget;
    const awayShotsOff = r.awayShots - r.awayShotsOnTarget;
    const homeXg = (r.homeShotsOnTarget * 0.30) + (homeShotsOff * 0.08);
    const awayXg = (r.awayShotsOnTarget * 0.30) + (awayShotsOff * 0.08);
    
    for (const [team, xg, goals] of [[r.homeTeam, homeXg, r.ftHomeGoals], [r.awayTeam, awayXg, r.ftAwayGoals]] as const) {
      const s = teamXgStats.get(team) || { matches: 0, totalXg: 0, actualGoals: 0 };
      s.matches++; s.totalXg += xg; s.actualGoals += goals;
      teamXgStats.set(team, s);
    }
  });
  
  const hd = teamXgStats.get(homeTeam);
  const ad = teamXgStats.get(awayTeam);
  if (!hd || !ad || hd.matches < 5 || ad.matches < 5) return 'Neutral';
  
  const homeDiff = (hd.actualGoals / hd.matches) - (hd.totalXg / hd.matches);
  const awayDiff = (ad.actualGoals / ad.matches) - (ad.totalXg / ad.matches);
  const total = homeDiff + awayDiff;
  
  if (total <= -1.0) return 'Strong Over';
  if (total <= -0.5) return 'Over';
  if (total >= 1.0) return 'Strong Under';
  if (total >= 0.5) return 'Under';
  return 'Neutral';
}

// --- Helper: compute regression signal (same logic as PredictionsTab) ---
function computeRegressionSignal(results: MatchResult[], homeTeam: string, awayTeam: string): string {
  const getTeamReg = (team: string): number => {
    const matches = results.filter(r => r.homeTeam === team || r.awayTeam === team)
      .sort((a, b) => b.date.localeCompare(a.date));
    if (matches.length < 5) return 0;
    const last3 = matches.slice(0, 3);
    const seasonAvg = matches.reduce((s, m) => {
      const g = m.homeTeam === team ? m.ftHomeGoals : m.ftAwayGoals;
      return s + g;
    }, 0) / matches.length;
    const last3Avg = last3.reduce((s, m) => {
      const g = m.homeTeam === team ? m.ftHomeGoals : m.ftAwayGoals;
      return s + g;
    }, 0) / last3.length;
    return last3Avg - seasonAvg;
  };
  
  const homeReg = getTeamReg(homeTeam);
  const awayReg = getTeamReg(awayTeam);
  const totalReg = homeReg + awayReg;
  
  if (totalReg <= -0.5) return 'Under';
  if (totalReg <= -0.3) return 'Strong Under';
  if (totalReg >= 0.5) return 'Over';
  if (totalReg >= 0.3) return 'Strong Over';
  return 'Neutral';
}

// --- Helper: compute Z-Score signal (same logic as PredictionsTab) ---
function computeZScoreSignal(results: MatchResult[], homeTeam: string, awayTeam: string): string {
  const zTeamStats = new Map<string, { matches: number; goals: number[]; totalGoals: number; mean: number; stdDev: number; last3Avg: number }>();
  
  results.forEach(r => {
    for (const [team] of [[r.homeTeam], [r.awayTeam]] as const) {
      const totalGoals = r.ftHomeGoals + r.ftAwayGoals;
      const s = zTeamStats.get(team) || { matches: 0, goals: [] as number[], totalGoals: 0, mean: 0, stdDev: 0, last3Avg: 0 };
      s.matches++; s.goals.push(totalGoals); s.totalGoals += totalGoals;
      zTeamStats.set(team, s);
    }
  });
  
  zTeamStats.forEach(stats => {
    stats.mean = stats.totalGoals / stats.matches;
    const last3 = stats.goals.slice(0, 3);
    stats.last3Avg = last3.length > 0 ? last3.reduce((a, b) => a + b, 0) / last3.length : 0;
    const sqDiffs = stats.goals.map(g => (g - stats.mean) ** 2);
    stats.stdDev = Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / stats.matches);
  });
  
  const hz = zTeamStats.get(homeTeam);
  const az = zTeamStats.get(awayTeam);
  if (!hz || !az || hz.matches < 3 || az.matches < 3) return 'Neutral';
  
  const homeZ = hz.stdDev > 0 ? (hz.last3Avg - hz.mean) / hz.stdDev : 0;
  const awayZ = az.stdDev > 0 ? (az.last3Avg - az.mean) / az.stdDev : 0;
  
  let score = 0;
  if (homeZ <= -1.5) score += 2; else if (homeZ <= -1.0) score += 1;
  if (awayZ <= -1.5) score += 2; else if (awayZ <= -1.0) score += 1;
  if (homeZ >= 1.5) score -= 2; else if (homeZ >= 1.0) score -= 1;
  if (awayZ >= 1.5) score -= 2; else if (awayZ >= 1.0) score -= 1;
  
  if (score >= 4) return 'Strong Over';
  if (score >= 2.5) return 'Over';
  if (score <= -3) return 'Strong Under';
  if (score <= -1.5) return 'Under';
  return 'Neutral';
}

// --- Helper: draw probability from odds ---
function drawProbFromOdds(oddsAvgHome: number | null, oddsAvgDraw: number | null, oddsAvgAway: number | null): number {
  if (!oddsAvgHome || !oddsAvgDraw || !oddsAvgAway) return 50;
  const impliedHome = 1 / oddsAvgHome;
  const impliedDraw = 1 / oddsAvgDraw;
  const impliedAway = 1 / oddsAvgAway;
  const total = impliedHome + impliedDraw + impliedAway;
  return Math.round((impliedDraw / total) * 100);
}

// --- Per-match record ---
interface MatchRecord {
  league: string;
  season: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  // Actual outcomes
  totalGoals: number;
  btts: boolean;
  over25: boolean;
  over35: boolean;
  // Detector results
  bttsChecklistScore: number;
  over35ChecklistScore: number;
  isStrongBet: boolean;
  strongBetPoints: number;
  isGreyResult: boolean;
  greyResultScore: number;
  isGoalFest: boolean;
  goalFestScore: number;
  isBttsBH: boolean;
  bttsBHScore: number;
  bttsBH_actual: boolean;
}

async function runLeagueBacktest(leagueCode: string, testSeason: string): Promise<MatchRecord[]> {
  const training = EUROPEAN_SEASONS.filter(s => s < testSeason).slice(-5);
  
  // Fetch data
  const trainingResults = await Promise.all(training.map(s => fetchSeasonData(leagueCode, s)));
  const trainingData = trainingResults.flat();
  const testData = await fetchSeasonData(leagueCode, testSeason);
  
  if (testData.length === 0) return [];
  
  // Combine for signal computation (signals need full history)
  const allData = [...trainingData, ...testData].sort((a, b) => a.date.localeCompare(b.date));
  
  const seasonWeights = calculateSeasonWeights(training);
  const leagueAvgs = calculateLeagueAverages(trainingData);
  
  // Compute league baselines for threshold resolution
  const analyticsForBaseline = {
    avgGoalsPerGame: leagueAvgs.avgTotalGoals,
    over25Percent: leagueAvgs.over25Rate * 100,
    avgHomeGoals: leagueAvgs.avgHomeGoals,
    avgAwayGoals: leagueAvgs.avgAwayGoals,
    overallShotConversion: '10',
  };
  const baselines = computeLeagueBaselines(trainingData, analyticsForBaseline);
  const resolved = resolveAllThresholds(leagueCode, baselines);
  
  const records: MatchRecord[] = [];
  
  for (const match of testData) {
    // Skip if either team lacks training history
    const homeInTraining = trainingData.some(m => m.homeTeam === match.homeTeam || m.awayTeam === match.homeTeam);
    const awayInTraining = trainingData.some(m => m.homeTeam === match.awayTeam || m.awayTeam === match.awayTeam);
    if (!homeInTraining || !awayInTraining) continue;
    
    // Generate predictions
    const pred = generateBacktestPredictions(trainingData, match.homeTeam, match.awayTeam, leagueAvgs, seasonWeights);
    const o35Prob = computeO35Prob(pred.totalXg);
    
    // Compute detector inputs
    const homeRollingScored = getRollingCombinedScoring(allData, match.homeTeam, true, match.date);
    const awayRollingScored = getRollingCombinedScoring(allData, match.awayTeam, false, match.date);
    const rollingCombined = homeRollingScored + awayRollingScored;
    const o25ImpliedProb = match.oddsAvgOver25 ? (1 / match.oddsAvgOver25) * 100 : null;
    
    // Compute signals (using all data before this match for Z-Score/regression)
    const beforeThisMatch = allData.filter(r => r.date < match.date);
    const xgSignal = computeXGSignal(beforeThisMatch, match.homeTeam, match.awayTeam);
    const regressionSignal = computeRegressionSignal(beforeThisMatch, match.homeTeam, match.awayTeam);
    const zScoreSignal = computeZScoreSignal(beforeThisMatch, match.homeTeam, match.awayTeam);
    
    const signalInput: SignalInput = { xgSignal, regressionSignal, zScoreSignal };
    
    const bttsChecklistInput: ChecklistInput = {
      avgGoalsPerGame: leagueAvgs.avgTotalGoals,
      over25Percent: leagueAvgs.over25Rate * 100,
      bttsProb: pred.btts,
      avgHomeGoals: leagueAvgs.avgHomeGoals,
      avgAwayGoals: leagueAvgs.avgAwayGoals,
      o25Prob: pred.over25,
      o35Prob: o35Prob,
      overallShotConversion: 10,
      rollingHomeScored: homeRollingScored,
      rollingAwayScored: awayRollingScored,
      rollingCombinedScoring: rollingCombined,
      o25ImpliedProb,
    };
    
    // Run all detectors
    const bttsScore = computeBttsChecklist(bttsChecklistInput, resolved);
    const o35Score = computeOver35Checklist(bttsChecklistInput, resolved);
    const strongBet = computeStrongBet(bttsChecklistInput, signalInput, resolved);
    const greyResult = computeGreyResult(bttsChecklistInput, signalInput, resolved);
    const goalFest = computeGoalFest(bttsChecklistInput, signalInput, resolved);
    const drawProb = drawProbFromOdds(match.oddsAvgHome, match.oddsAvgDraw, match.oddsAvgAway);
    const bttsBH = computeBTTSBothHalves({
      o25Prob: pred.over25,
      o35Prob,
      bttsProb: pred.btts,
      rollingCombinedScoring: rollingCombined,
      o25ImpliedProb,
      drawProb,
      avgGoalsPerGame: leagueAvgs.avgTotalGoals,
    });
    
    // Actual outcomes
    const totalGoals = match.ftHomeGoals + match.ftAwayGoals;
    const btts = match.ftHomeGoals > 0 && match.ftAwayGoals > 0;
    const over25 = totalGoals > 2.5;
    const over35 = totalGoals > 3.5;
    // BTTS-BH: both teams score in EACH half
    const shHomeGoals = match.ftHomeGoals - match.htHomeGoals;
    const shAwayGoals = match.ftAwayGoals - match.htAwayGoals;
    const bttsBH_actual = match.htHomeGoals > 0 && match.htAwayGoals > 0 && shHomeGoals > 0 && shAwayGoals > 0;

    records.push({
      league: leagueCode,
      season: testSeason,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      date: match.date,
      totalGoals,
      btts,
      over25,
      over35,
      bttsChecklistScore: bttsScore,
      over35ChecklistScore: o35Score,
      isStrongBet: strongBet.isStrongBet,
      strongBetPoints: strongBet.points,
      isGreyResult: greyResult.isGreyResult,
      greyResultScore: greyResult.score,
      isGoalFest: goalFest.isGoalFest,
      goalFestScore: goalFest.score,
      isBttsBH: bttsBH.isBTTSBothHalves,
      bttsBHScore: bttsBH.score,
      bttsBH_actual,
    });
  }
  
  return records;
}

// --- Analysis ---
interface DetectorMetrics {
  detector: string;
  outcome: string;
  totalMatches: number;
  fired: number;
  fireRate: number;
  hits: number;
  hitRate: number;
  baseRate: number;
  lift: number;
}

function analyzeDetector(records: MatchRecord[], detector: string, outcome: 'btts' | 'over25' | 'over35' | 'o3goals' | 'grey4goals', filterFn: (r: MatchRecord) => boolean): DetectorMetrics {
  const total = records.length;
  const fired = records.filter(filterFn);
  
  let baseRate: number;
  let hits: number;
  
  switch (outcome) {
    case 'btts':
      baseRate = records.filter(r => r.btts).length / total;
      hits = fired.filter(r => r.btts).length;
      break;
    case 'over25':
      baseRate = records.filter(r => r.over25).length / total;
      hits = fired.filter(r => r.over25).length;
      break;
    case 'over35':
      baseRate = records.filter(r => r.over35).length / total;
      hits = fired.filter(r => r.over35).length;
      break;
    case 'o3goals':
      baseRate = records.filter(r => r.totalGoals >= 3).length / total;
      hits = fired.filter(r => r.totalGoals >= 3).length;
      break;
    case 'grey4goals':
      baseRate = records.filter(r => r.totalGoals >= 4).length / total;
      hits = fired.filter(r => r.totalGoals >= 4).length;
      break;
    case 'bttsBH':
      baseRate = records.filter(r => r.bttsBH_actual).length / total;
      hits = fired.filter(r => r.bttsBH_actual).length;
      break;
  }
  
  return {
    detector,
    outcome,
    totalMatches: total,
    fired: fired.length,
    fireRate: fired.length / total,
    hitRate: fired.length > 0 ? hits / fired.length : 0,
    baseRate: baseRate!,
    lift: fired.length > 0 ? (hits / fired.length) / baseRate! : 0,
  };
}

// --- Formatting ---
function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

function fmtLift(n: number): string {
  const color = n >= 1.15 ? '✅' : n >= 1.05 ? '🟢' : n >= 0.95 ? '🟡' : '🔴';
  return `${n.toFixed(2)}x ${color}`;
}

// --- Main ---
async function main() {
  console.log('\n' + '='.repeat(110));
  console.log('LEAN DETECTOR VALIDATION BACKTEST');
  console.log('Validating all 6 detectors after noise removal');
  console.log(`Leagues: ${LEAGUES.map(l => l.name).join(', ')}`);
  console.log(`Test seasons: ${TEST_SEASONS.join(', ')}`);
  console.log('Training: 5 most recent prior seasons with exponential decay');
  console.log('='.repeat(110));
  
  // Collect all records
  const allRecords: MatchRecord[] = [];
  const leagueRecords: Map<string, MatchRecord[]> = new Map();
  
  for (const lg of LEAGUES) {
    console.log(`\n[${lg.code}] ${lg.name}...`);
    const leagueRecs: MatchRecord[] = [];
    
    for (const season of TEST_SEASONS) {
      try {
        const recs = await runLeagueBacktest(lg.code, season);
        if (recs.length > 0) {
          console.log(`  ${season}: ${recs.length} matches`);
          leagueRecs.push(...recs);
        }
      } catch (e: any) {
        console.log(`  ${season}: Skipped (${e?.message?.substring(0, 50)})`);
      }
    }
    
    if (leagueRecs.length > 0) {
      leagueRecords.set(lg.code, leagueRecs);
      allRecords.push(...leagueRecs);
      console.log(`  Total: ${leagueRecs.length} matches`);
    }
  }
  
  if (allRecords.length === 0) {
    console.log('\n❌ No matches found. Check API access.');
    return;
  }
  
  // ================================================================
  // SECTION 1: GLOBAL DETECTOR PERFORMANCE
  // ================================================================
  console.log('\n' + '═'.repeat(110));
  console.log('SECTION 1: GLOBAL DETECTOR PERFORMANCE (all leagues combined)');
  console.log('═'.repeat(110));
  
  const globalMetrics: DetectorMetrics[] = [
    // BTTS Checklist at different thresholds
    analyzeDetector(allRecords, 'BTTS Checklist ≥2/4', 'btts', r => r.bttsChecklistScore >= 2),
    analyzeDetector(allRecords, 'BTTS Checklist ≥3/4', 'btts', r => r.bttsChecklistScore >= 3),
    analyzeDetector(allRecords, 'BTTS Checklist 4/4', 'btts', r => r.bttsChecklistScore >= 4),
    // O3.5 Checklist
    analyzeDetector(allRecords, 'O3.5 Checklist ≥2/4', 'over35', r => r.over35ChecklistScore >= 2),
    analyzeDetector(allRecords, 'O3.5 Checklist ≥3/4', 'over35', r => r.over35ChecklistScore >= 3),
    analyzeDetector(allRecords, 'O3.5 Checklist 4/4', 'over35', r => r.over35ChecklistScore >= 4),
    // Strong Bet
    analyzeDetector(allRecords, 'STRONG BET', 'o3goals', r => r.isStrongBet),
    analyzeDetector(allRecords, 'STRONG BET', 'over25', r => r.isStrongBet),
    // Grey Result
    analyzeDetector(allRecords, 'GREY RESULT', 'grey4goals', r => r.isGreyResult),
    analyzeDetector(allRecords, 'GREY RESULT', 'over25', r => r.isGreyResult),
    // Goal Fest
    analyzeDetector(allRecords, 'GOAL FEST', 'over35', r => r.isGoalFest),
    analyzeDetector(allRecords, 'GOAL FEST', 'over25', r => r.isGoalFest),
    // BTTS-BH (measured against actual BTTS-BH outcome)
    analyzeDetector(allRecords, 'BTTS-BH (≥2/3)', 'bttsBH', r => r.isBttsBH),
    analyzeDetector(allRecords, 'BTTS-BH QUALIFIED', 'bttsBH', r => r.bttsBHScore >= 2),
    analyzeDetector(allRecords, 'BTTS-BH STRONG (3/3)', 'bttsBH', r => r.bttsBHScore >= 3),
  ];
  
  console.log(`
${'Detector'.padEnd(30)} ${'Outcome'.padEnd(10)} ${'Matches'.padEnd(8)} ${'Fired'.padEnd(7)} ${'Fire%'.padEnd(8)} ${'Hit%'.padEnd(8)} ${'Base%'.padEnd(8)} ${'Lift'.padEnd(10)} ${'Grade'.padEnd(6)}`);
  console.log('─'.repeat(110));
  
  for (const m of globalMetrics) {
    const grade = m.lift >= 1.20 ? 'A' : m.lift >= 1.10 ? 'B+' : m.lift >= 1.05 ? 'B' : m.lift >= 0.98 ? 'C' : 'D';
    console.log(
      `${m.detector.padEnd(30)} ${m.outcome.padEnd(10)} ${String(m.totalMatches).padEnd(8)} ${String(m.fired).padEnd(7)} ${fmtPct(m.fireRate).padEnd(8)} ${fmtPct(m.hitRate).padEnd(8)} ${fmtPct(m.baseRate).padEnd(8)} ${fmtLift(m.lift).padEnd(10)} ${grade.padEnd(6)}`
    );
  }
  
  // ================================================================
  // SECTION 2: PER-LEAGUE BREAKDOWN
  // ================================================================
  console.log('\n' + '═'.repeat(110));
  console.log('SECTION 2: PER-LEAGUE BREAKDOWN (key detectors)');
  console.log('═'.repeat(110));
  
  const keyDetectors = [
    { name: 'BTTS ≥3/4', outcome: 'btts' as const, fn: (r: MatchRecord) => r.bttsChecklistScore >= 3 },
    { name: 'O3.5 ≥3/4', outcome: 'over35' as const, fn: (r: MatchRecord) => r.over35ChecklistScore >= 3 },
    { name: 'STRONG BET', outcome: 'o3goals' as const, fn: (r: MatchRecord) => r.isStrongBet },
    { name: 'GREY RESULT', outcome: 'over25' as const, fn: (r: MatchRecord) => r.isGreyResult },
    { name: 'GOAL FEST', outcome: 'over35' as const, fn: (r: MatchRecord) => r.isGoalFest },
    { name: 'BTTS-BH ≥2/3', outcome: 'bttsBH' as const, fn: (r: MatchRecord) => r.isBttsBH },
  ];
  
  for (const lg of LEAGUES) {
    const recs = leagueRecords.get(lg.code);
    if (!recs || recs.length === 0) continue;
    
    console.log(`\n  ${lg.name} (${lg.code}) — ${recs.length} matches`);
    console.log(`  ${'Detector'.padEnd(20)} ${'Fired'.padEnd(7)} ${'Fire%'.padEnd(8)} ${'Hit%'.padEnd(8)} ${'Base%'.padEnd(8)} ${'Lift'.padEnd(10)}`);
    console.log('  ' + '─'.repeat(60));
    
    for (const det of keyDetectors) {
      const m = analyzeDetector(recs, det.name, det.outcome, det.fn);
      console.log(`  ${det.name.padEnd(20)} ${String(m.fired).padEnd(7)} ${fmtPct(m.fireRate).padEnd(8)} ${fmtPct(m.hitRate).padEnd(8)} ${fmtPct(m.baseRate).padEnd(8)} ${fmtLift(m.lift).padEnd(10)}`);
    }
  }
  
  // ================================================================
  // SECTION 3: THRESHOLD SENSITIVITY (BTTS Checklist)
  // ================================================================
  console.log('\n' + '═'.repeat(110));
  console.log('SECTION 3: BTTS CHECKLIST THRESHOLD SENSITIVITY');
  console.log('═'.repeat(110));
  
  console.log(`\n  ${'Threshold'.padEnd(15)} ${'Fired'.padEnd(7)} ${'Fire%'.padEnd(8)} ${'BTTS Hit%'.padEnd(10)} ${'Base%'.padEnd(8)} ${'Lift'.padEnd(10)}`);
  console.log('  ' + '─'.repeat(60));
  
  for (let t = 1; t <= 4; t++) {
    const m = analyzeDetector(allRecords, `BTTS ≥${t}/4`, 'btts', r => r.bttsChecklistScore >= t);
    console.log(`  ${(`≥${t}/4`).padEnd(15)} ${String(m.fired).padEnd(7)} ${fmtPct(m.fireRate).padEnd(8)} ${fmtPct(m.hitRate).padEnd(10)} ${fmtPct(m.baseRate).padEnd(8)} ${fmtLift(m.lift).padEnd(10)}`);
  }
  
  // ================================================================
  // SECTION 4: THRESHOLD SENSITIVITY (O3.5 Checklist)
  // ================================================================
  console.log('\n' + '═'.repeat(110));
  console.log('SECTION 4: OVER 3.5 CHECKLIST THRESHOLD SENSITIVITY');
  console.log('═'.repeat(110));
  
  console.log(`\n  ${'Threshold'.padEnd(15)} ${'Fired'.padEnd(7)} ${'Fire%'.padEnd(8)} ${'O3.5 Hit%'.padEnd(10)} ${'Base%'.padEnd(8)} ${'Lift'.padEnd(10)}`);
  console.log('  ' + '─'.repeat(60));
  
  for (let t = 1; t <= 4; t++) {
    const m = analyzeDetector(allRecords, `O3.5 ≥${t}/4`, 'over35', r => r.over35ChecklistScore >= t);
    console.log(`  ${(`≥${t}/4`).padEnd(15)} ${String(m.fired).padEnd(7)} ${fmtPct(m.fireRate).padEnd(8)} ${fmtPct(m.hitRate).padEnd(10)} ${fmtPct(m.baseRate).padEnd(8)} ${fmtLift(m.lift).padEnd(10)}`);
  }
  
  // ================================================================
  // SECTION 5: STRONG BET POINTS DISTRIBUTION
  // ================================================================
  console.log('\n' + '═'.repeat(110));
  console.log('SECTION 5: STRONG BET POINTS DISTRIBUTION');
  console.log('═'.repeat(110));
  
  const sbPoints: Map<number, { total: number; o3hits: number; o25hits: number }> = new Map();
  for (const r of allRecords) {
    const bucket = r.strongBetPoints;
    const s = sbPoints.get(bucket) || { total: 0, o3hits: 0, o25hits: 0 };
    s.total++;
    if (r.totalGoals >= 3) s.o3hits++;
    if (r.over25) s.o25hits++;
    sbPoints.set(bucket, s);
  }
  
  console.log(`\n  ${'Points'.padEnd(8)} ${'Count'.padEnd(7)} ${'%of Total'.padEnd(10)} ${'O3+ Hit%'.padEnd(10)} ${'O2.5 Hit%'.padEnd(10)}`);
  console.log('  ' + '─'.repeat(50));
  
  const totalMatches = allRecords.length;
  const o3Base = allRecords.filter(r => r.totalGoals >= 3).length / totalMatches;
  const o25Base = allRecords.filter(r => r.over25).length / totalMatches;
  
  for (const [pts, s] of [...sbPoints.entries()].sort((a, b) => a[0] - b[0])) {
    const o3Lift = s.total > 0 ? (s.o3hits / s.total) / o3Base : 0;
    const o25Lift = s.total > 0 ? (s.o25hits / s.total) / o25Base : 0;
    console.log(`  ${String(pts).padEnd(8)} ${String(s.total).padEnd(7)} ${fmtPct(s.total / totalMatches).padEnd(10)} ${fmtPct(s.o3hits / s.total).padEnd(10)} ${fmtLift(o3Lift).padEnd(10)}`);
  }
  
  // ================================================================
  // SECTION 6: ASSESSMENT & RECOMMENDATIONS
  // ================================================================
  console.log('\n' + '═'.repeat(110));
  console.log('SECTION 6: ASSESSMENT & RECOMMENDATIONS');
  console.log('═'.repeat(110));
  
  const btts3 = analyzeDetector(allRecords, 'BTTS ≥3/4', 'btts', r => r.bttsChecklistScore >= 3);
  const o353 = analyzeDetector(allRecords, 'O3.5 ≥3/4', 'over35', r => r.over35ChecklistScore >= 3);
  const sb = analyzeDetector(allRecords, 'STRONG BET', 'o3goals', r => r.isStrongBet);
  const gr = analyzeDetector(allRecords, 'GREY RESULT', 'over25', r => r.isGreyResult);
  const gf = analyzeDetector(allRecords, 'GOAL FEST', 'over35', r => r.isGoalFest);
  const bh = analyzeDetector(allRecords, 'BTTS-BH', 'bttsBH', r => r.isBttsBH);
  
  console.log(`\n  BASE RATES:`);
  console.log(`    BTTS:       ${fmtPct(allRecords.filter(r => r.btts).length / totalMatches)}`);
  console.log(`    Over 2.5:   ${fmtPct(allRecords.filter(r => r.over25).length / totalMatches)}`);
  console.log(`    Over 3.5:   ${fmtPct(allRecords.filter(r => r.over35).length / totalMatches)}`);
  console.log(`    3+ Goals:   ${fmtPct(allRecords.filter(r => r.totalGoals >= 3).length / totalMatches)}`);
  console.log(`    BTTS-BH:    ${fmtPct(allRecords.filter(r => r.bttsBH_actual).length / totalMatches)}`);
  
  console.log(`\n  DETECTOR SUMMARY:`);
  console.log(`    BTTS ≥3/4:     Fire ${fmtPct(btts3.fireRate)}, Hit ${fmtPct(btts3.hitRate)}, Lift ${btts3.lift.toFixed(2)}x`);
  console.log(`    O3.5 ≥3/4:     Fire ${fmtPct(o353.fireRate)}, Hit ${fmtPct(o353.hitRate)}, Lift ${o353.lift.toFixed(2)}x`);
  console.log(`    STRONG BET:    Fire ${fmtPct(sb.fireRate)}, Hit ${fmtPct(sb.hitRate)}, Lift ${sb.lift.toFixed(2)}x`);
  console.log(`    GREY RESULT:   Fire ${fmtPct(gr.fireRate)}, Hit ${fmtPct(gr.hitRate)}, Lift ${gr.lift.toFixed(2)}x`);
  console.log(`    GOAL FEST:     Fire ${fmtPct(gf.fireRate)}, Hit ${fmtPct(gf.hitRate)}, Lift ${gf.lift.toFixed(2)}x`);
  console.log(`    BTTS-BH:       Fire ${fmtPct(bh.fireRate)}, Hit ${fmtPct(bh.hitRate)}, Lift ${bh.lift.toFixed(2)}x`);
  
  // Recommendations
  console.log(`\n  THRESHOLD RECOMMENDATIONS:`);
  
  if (btts3.lift >= 1.10) {
    console.log(`    ✅ BTTS ≥3/4: GOOD lift (${btts3.lift.toFixed(2)}x). Keep threshold at 3.`);
  } else if (btts3.lift >= 1.05) {
    console.log(`    🟡 BTTS ≥3/4: MARGINAL lift (${btts3.lift.toFixed(2)}x). Consider tightening to 4/4.`);
  } else {
    console.log(`    🔴 BTTS ≥3/4: NO lift (${btts3.lift.toFixed(2)}x). Threshold needs adjustment.`);
  }
  
  if (o353.lift >= 1.10) {
    console.log(`    ✅ O3.5 ≥3/4: GOOD lift (${o353.lift.toFixed(2)}x). Keep threshold at 3.`);
  } else if (o353.lift >= 1.05) {
    console.log(`    🟡 O3.5 ≥3/4: MARGINAL lift (${o353.lift.toFixed(2)}x). Consider tightening.`);
  } else {
    console.log(`    🔴 O3.5 ≥3/4: NO lift (${o353.lift.toFixed(2)}x). Threshold needs adjustment.`);
  }
  
  if (sb.lift >= 1.15) {
    console.log(`    ✅ STRONG BET: STRONG lift (${sb.lift.toFixed(2)}x). Threshold at 7 is well-calibrated.`);
  } else if (sb.lift >= 1.05) {
    console.log(`    🟡 STRONG BET: MARGINAL lift (${sb.lift.toFixed(2)}x). Consider raising threshold.`);
  } else {
    console.log(`    🔴 STRONG BET: NO lift (${sb.lift.toFixed(2)}x). Consider raising from 7 to 8+.`);
  }
  
  if (gf.lift >= 1.15) {
    console.log(`    ✅ GOAL FEST: STRONG lift (${gf.lift.toFixed(2)}x). 5/6 threshold is well-calibrated.`);
  } else if (gf.lift >= 1.05) {
    console.log(`    🟡 GOAL FEST: MARGINAL lift (${gf.lift.toFixed(2)}x). Consider tightening.`);
  } else {
    console.log(`    🔴 GOAL FEST: NO lift (${gf.lift.toFixed(2)}x). Consider raising threshold.`);
  }
  
  if (bh.lift >= 1.15) {
    console.log(`    ✅ BTTS-BH: STRONG lift (${bh.lift.toFixed(2)}x). 2/3 threshold is well-calibrated.`);
  } else if (bh.lift >= 1.05) {
    console.log(`    🟡 BTTS-BH: MARGINAL lift (${bh.lift.toFixed(2)}x). Monitor.`);
  } else {
    console.log(`    🔴 BTTS-BH: NO lift (${bh.lift.toFixed(2)}x). Needs investigation.`);
  }
  
  // Save results
  const { writeFile } = await import('fs/promises');
  const jsonPath = '/home/z/my-project/download/lean-detector-validation.json';
  await writeFile(jsonPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalMatches: allRecords.length,
    leagues: LEAGUES.filter(l => leagueRecords.has(l.code)).map(l => ({ code: l.code, name: l.name, matches: leagueRecords.get(l.code)!.length })),
    globalMetrics,
    baseRates: {
      btts: allRecords.filter(r => r.btts).length / totalMatches,
      over25: allRecords.filter(r => r.over25).length / totalMatches,
      over35: allRecords.filter(r => r.over35).length / totalMatches,
    },
  }, null, 2));
  console.log(`\n  Full results saved to: ${jsonPath}`);
}

main().catch(console.error);
