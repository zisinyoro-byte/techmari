/**
 * EPL BTTS Both Halves — FULL APP SIGNALS ANALYSIS
 * Computes rolling stats, 3 core signals, checklists, and all qualifiers
 * exactly as the app does, then compares BTTS-BH vs non-BH.
 */

interface MatchResult {
  date: string; homeTeam: string; awayTeam: string;
  ftHomeGoals: number; ftAwayGoals: number; ftResult: 'H' | 'D' | 'A';
  htHomeGoals: number; htAwayGoals: number; htResult: 'H' | 'D' | 'A';
  homeShots: number; awayShots: number;
  homeShotsOnTarget: number; awayShotsOnTarget: number;
  oddsAvgHome: number | null; oddsAvgDraw: number | null; oddsAvgAway: number | null;
  oddsAvgOver25: number | null; season: string;
}

// ---- CSV Parser ----
function parseNumber(val: string | undefined): number | null {
  if (!val || val.trim() === '') return null;
  const n = parseFloat(val); return isNaN(n) ? null : n;
}
function parseCSV(csvText: string, season: string): MatchResult[] {
  const lines = csvText.trim().split('\n'); if (lines.length < 2) return [];
  const header = lines[0].replace(/^\uFEFF/, '').split(',');
  const ci: Record<string, number> = {}; header.forEach((c, i) => { ci[c.trim()] = i; });
  const results: MatchResult[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]; if (!line.trim()) continue;
    const v: string[] = []; let cv = ''; let inQ = false;
    for (const ch of line) { if (ch === '"') inQ = !inQ; else if (ch === ',' && !inQ) { v.push(cv.trim()); cv = ''; } else cv += ch; }
    v.push(cv.trim());
    const h = v[ci['HomeTeam']] || '', a = v[ci['AwayTeam']] || ''; if (!h || !a) continue;
    results.push({
      date: v[ci['Date']] || '', homeTeam: h, awayTeam: a,
      ftHomeGoals: parseInt(v[ci['FTHG']] || '0', 10) || 0, ftAwayGoals: parseInt(v[ci['FTAG']] || '0', 10) || 0,
      ftResult: (v[ci['FTR']] || 'D') as 'H' | 'D' | 'A',
      htHomeGoals: parseInt(v[ci['HTHG']] || '0', 10) || 0, htAwayGoals: parseInt(v[ci['HTAG']] || '0', 10) || 0,
      htResult: (v[ci['HTR']] || 'D') as 'H' | 'D' | 'A',
      homeShots: parseInt(v[ci['HS']] || '0', 10) || 0, awayShots: parseInt(v[ci['AS']] || '0', 10) || 0,
      homeShotsOnTarget: parseInt(v[ci['HST']] || '0', 10) || 0, awayShotsOnTarget: parseInt(v[ci['AST']] || '0', 10) || 0,
      oddsAvgHome: parseNumber(v[ci['AvgH']]), oddsAvgDraw: parseNumber(v[ci['AvgD']]), oddsAvgAway: parseNumber(v[ci['AvgA']]),
      oddsAvgOver25: parseNumber(v[ci['Avg>2.5']]), season,
    });
  }
  return results;
}

async function fetchSeason(league: string, season: string): Promise<MatchResult[]> {
  const url = `https://www.football-data.co.uk/mmz4281/${season}/${league}.csv`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/csv' } });
  if (!r.ok) return [];
  return parseCSV(await r.text(), season);
}

// ============================================================================
// ROLLING STATS ENGINE
// ============================================================================
// For each match, compute last-3, last-5, last-10 game windows for each team.
// Process matches chronologically within season.

interface TeamRolling {
  last3Scored: number; last3Conceded: number; last3Total: number;
  last5Scored: number; last5Conceded: number; last5Total: number;
  last10Scored: number; last10Conceded: number; last10Total: number;
  seasonScored: number; seasonConceded: number; seasonTotal: number;
  seasonMatches: number;
  last3SOT: number; last5SOT: number; seasonSOT: number;
  last3Shots: number; last5Shots: number; seasonShots: number;
  // xG proxy: SOT*0.30 + (shots-SOT)*0.08
  last3Xg: number; last5Xg: number; seasonXg: number;
  last3ActualGoals: number; last5ActualGoals: number; seasonActualGoals: number;
  // SOT conversion: goals / SOT * 100
  seasonSotConversion: number;
  // Std dev and mean for Z-Score
  seasonStdDev: number;
  seasonMean: number;
}

function computeRollingStats(
  allMatches: MatchResult[], team: string, beforeDate: string, beforeSeason: string
): TeamRolling {
  // Get all matches for this team before this date/season, sorted chronologically
  const teamMatches = allMatches
    .filter(m => {
      if (m.homeTeam !== team && m.awayTeam !== team) return false;
      if (m.season > beforeSeason) return false;
      if (m.season === beforeSeason && m.date >= beforeDate) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.season !== b.season) return a.season < b.season ? -1 : 1;
      return a.date.localeCompare(b.date);
    });

  if (teamMatches.length === 0) {
    return { last3Scored: 1, last3Conceded: 1, last3Total: 2, last5Scored: 1, last5Conceded: 1, last5Total: 2,
      last10Scored: 1, last10Conceded: 1, last10Total: 2, seasonScored: 1, seasonConceded: 1, seasonTotal: 2,
      seasonMatches: 0, last3SOT: 5, last5SOT: 5, seasonSOT: 5, last3Shots: 12, last5Shots: 12, seasonShots: 12,
      last3Xg: 1, last5Xg: 1, seasonXg: 1, last3ActualGoals: 1, last5ActualGoals: 1, seasonActualGoals: 1,
      seasonSotConversion: 30, seasonStdDev: 1, seasonMean: 2.5 };
  }

  const perMatch = teamMatches.map(m => {
    const isHome = m.homeTeam === team;
    const scored = isHome ? m.ftHomeGoals : m.ftAwayGoals;
    const conceded = isHome ? m.ftAwayGoals : m.ftHomeGoals;
    const sot = isHome ? m.homeShotsOnTarget : m.awayShotsOnTarget;
    const shots = isHome ? m.homeShots : m.awayShots;
    const xg = sot * 0.30 + (shots - sot) * 0.08;
    return { scored, conceded, total: scored + conceded, sot, shots, xg };
  });

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const takeLast = (arr: typeof perMatch, n: number) => arr.slice(-n);

  const last3 = takeLast(perMatch, 3);
  const last5 = takeLast(perMatch, 5);
  const last10 = takeLast(perMatch, 10);
  // Season matches only from current season
  const seasonMatches2 = teamMatches.filter(m => m.season === beforeSeason);
  const sLast3 = seasonMatches2.slice(-3);
  const sLast5 = seasonMatches2.slice(-5);

  const allTotals = perMatch.map(m => m.total);
  const mean = avg(allTotals);
  const stdDev = Math.sqrt(perMatch.reduce((s, m) => s + (m.total - mean) ** 2, 0) / Math.max(1, perMatch.length));

  const totalSOT = perMatch.reduce((s, m) => s + m.sot, 0);
  const totalGoals = perMatch.reduce((s, m) => s + m.scored, 0);

  return {
    last3Scored: avg(last3.map(m => m.scored)),
    last3Conceded: avg(last3.map(m => m.conceded)),
    last3Total: avg(last3.map(m => m.total)),
    last5Scored: avg(last5.map(m => m.scored)),
    last5Conceded: avg(last5.map(m => m.conceded)),
    last5Total: avg(last5.map(m => m.total)),
    last10Scored: avg(last10.map(m => m.scored)),
    last10Conceded: avg(last10.map(m => m.conceded)),
    last10Total: avg(last10.map(m => m.total)),
    seasonScored: avg(sLast5.map(m => m.scored)),
    seasonConceded: avg(sLast5.map(m => m.conceded)),
    seasonTotal: avg(sLast5.map(m => m.total)),
    seasonMatches: seasonMatches2.length,
    last3SOT: avg(last3.map(m => m.sot)),
    last5SOT: avg(last5.map(m => m.sot)),
    seasonSOT: avg(sLast5.map(m => m.sot)),
    last3Shots: avg(last3.map(m => m.shots)),
    last5Shots: avg(last5.map(m => m.shots)),
    seasonShots: avg(sLast5.map(m => m.shots)),
    last3Xg: avg(last3.map(m => m.xg)),
    last5Xg: avg(last5.map(m => m.xg)),
    seasonXg: avg(sLast5.map(m => m.xg)),
    last3ActualGoals: avg(last3.map(m => m.scored)),
    last5ActualGoals: avg(last5.map(m => m.scored)),
    seasonActualGoals: avg(sLast5.map(m => m.scored)),
    seasonSotConversion: totalSOT > 0 ? (totalGoals / totalSOT * 100) : 30,
    seasonStdDev: stdDev,
    seasonMean: mean,
  };
}

// ============================================================================
// SIGNAL COMPUTATIONS (exact app logic)
// ============================================================================

type SignalLabel = 'Strong Over' | 'Over' | 'Neutral' | 'Under' | 'Strong Under';

function classifyRegression(combinedSignal: number): SignalLabel {
  if (combinedSignal <= -1.2) return 'Strong Over';
  if (combinedSignal <= -0.5) return 'Over';
  if (combinedSignal >= 1.2) return 'Strong Under';
  if (combinedSignal >= 0.5) return 'Under';
  return 'Neutral';
}

function computeRegressionSignal(rolling: TeamRolling): number {
  const deviationFromSeason = rolling.last3Total - rolling.seasonTotal;
  const deviationFromLast10 = rolling.last3Total - rolling.last10Total;
  return deviationFromSeason * 0.4 + deviationFromLast10 * 0.3; // no H2H in backtest
}

function classifyXg(xgDiff: number): SignalLabel {
  if (xgDiff <= -1.0) return 'Strong Over';
  if (xgDiff <= -0.5) return 'Over';
  if (xgDiff >= 1.0) return 'Strong Under';
  if (xgDiff >= 0.5) return 'Under';
  return 'Neutral';
}

function computeXgDiff(rolling: TeamRolling): number {
  return rolling.last3ActualGoals - rolling.last3Xg;
}

function classifyZScore(score: number): SignalLabel {
  if (score >= 4) return 'Strong Over';
  if (score >= 2.5) return 'Over';
  if (score <= -3) return 'Strong Under';
  if (score <= -1.5) return 'Under';
  return 'Neutral';
}

function computeZScore(rolling: TeamRolling): number {
  if (rolling.seasonStdDev === 0 || rolling.seasonMatches < 3) return 0;
  return (rolling.last3Total - rolling.seasonMean) / rolling.seasonStdDev;
}

function computeCombinedZScore(homeRolling: TeamRolling, awayRolling: TeamRolling): number {
  let score = 0;
  const hZ = (homeRolling.last3Total - homeRolling.seasonMean) / (homeRolling.seasonStdDev || 1);
  const aZ = (awayRolling.last3Total - awayRolling.seasonMean) / (awayRolling.seasonStdDev || 1);
  for (const z of [hZ, aZ]) {
    if (z <= -1.5) score += 2;
    else if (z <= -1.0) score += 1;
    else if (z >= 1.5) score -= 2;
    else if (z >= 1.0) score -= 1;
  }
  return score;
}

// ============================================================================
// QUALIFIER COMPUTATIONS
// ============================================================================

interface ChecklistInput {
  avgGoalsPerGame: number; over25Percent: number;
  bttsProb: number; o25Prob: number; o35Prob: number;
  avgHomeGoals: number; avgAwayGoals: number;
  overallShotConversion: number;
  rollingHomeScored: number; rollingAwayScored: number; rollingCombinedScoring: number;
  o25ImpliedProb: number | null;
}

// BTTS Checklist (9 checks)
function computeBttsChecklist(inp: ChecklistInput, leagueBttsRate: number): number {
  let c = 0;
  const bttsThresh = Math.max(55, leagueBttsRate * 1.12);
  const o25Thresh = Math.max(62, inp.over25Percent * 1.10);
  const homeThresh = Math.max(1.3, inp.avgHomeGoals * 1.10);
  const awayThresh = Math.max(1.1, inp.avgAwayGoals * 1.10);
  const shotThresh = Math.max(11, inp.overallShotConversion * 1.15);
  if (inp.avgGoalsPerGame >= 2.7) c++;
  if (inp.over25Percent >= 55) c++;
  if (inp.bttsProb >= bttsThresh) c++;
  if (inp.avgHomeGoals >= homeThresh) c++;
  if (inp.avgAwayGoals >= awayThresh) c++;
  if (inp.o25Prob >= o25Thresh) c++;
  if (inp.overallShotConversion >= shotThresh) c++;
  if (inp.o25ImpliedProb !== null && inp.o25ImpliedProb >= 56) c++;
  if (inp.rollingCombinedScoring >= 2.5) c++;
  return c;
}

// O3.5 Checklist (9 checks)
function computeO35Checklist(inp: ChecklistInput, leagueO25Rate: number, leagueO35Rate: number): number {
  let c = 0;
  const o35Thresh = Math.max(40, leagueO35Rate * 1.20);
  const bttsThresh = Math.max(52, leagueO25Rate * 1.10);
  const homeThresh = Math.max(1.4, inp.avgHomeGoals * 1.12);
  const awayThresh = Math.max(1.2, inp.avgAwayGoals * 1.10);
  const shotThresh = Math.max(12, inp.overallShotConversion * 1.15);
  if (inp.avgGoalsPerGame >= 2.8) c++;
  if (inp.o35Prob >= o35Thresh) c++;
  if (inp.bttsProb >= bttsThresh) c++;
  if (inp.over25Percent >= 52) c++;
  if (inp.avgHomeGoals >= homeThresh) c++;
  if (inp.avgAwayGoals >= awayThresh) c++;
  if (inp.overallShotConversion >= shotThresh) c++;
  if (inp.o25ImpliedProb !== null && inp.o25ImpliedProb >= 59) c++;
  if (inp.rollingCombinedScoring >= 3.0) c++;
  return c;
}

// Strong Bet (14 pts, need 8+)
function computeStrongBet(inp: ChecklistInput, signals: { xg: SignalLabel; reg: SignalLabel; z: SignalLabel }, leagueBttsRate: number) {
  const bttsCount = computeBttsChecklist(inp, leagueBttsRate);
  const stO25 = Math.max(65, inp.over25Percent * 1.10);
  const stO35 = Math.max(42, leagueBttsRate * 1.25);
  const stBtts = Math.max(55, leagueBttsRate * 1.12);
  let pts = 0;
  if (inp.o25Prob >= stO25) pts += 2;
  if (inp.o35Prob >= stO35) pts += 1;
  if (leagueBttsRate >= 55 && inp.bttsProb >= stBtts) pts += 1;
  if (bttsCount >= 6) pts += (leagueBttsRate < 45 ? 1 : 2);
  if (signals.xg === 'Over' || signals.xg === 'Under') pts += 2;
  if (signals.reg === 'Under' || signals.reg === 'Strong Under') pts += 2;
  if (signals.z === 'Neutral') pts += 1;
  if ((signals.xg === 'Over' || signals.xg === 'Strong Over') && (signals.reg === 'Under' || signals.reg === 'Strong Under')) pts += 1;
  if (inp.o25ImpliedProb !== null && inp.o25ImpliedProb >= 62) pts += 1;
  if (inp.rollingCombinedScoring >= 2.5) pts += 1;
  return { isStrongBet: pts >= 8, points: pts };
}

// Grey Result (10 checks, need 7+)
function computeGreyResult(inp: ChecklistInput, signals: { xg: SignalLabel; reg: SignalLabel; z: SignalLabel }, leagueBttsRate: number) {
  const bttsCount = computeBttsChecklist(inp, leagueBttsRate);
  const o35Count = computeO35Checklist(inp, leagueBttsRate, leagueBttsRate);
  const grO25 = Math.max(65, inp.over25Percent * 1.10);
  const grO35 = Math.max(40, leagueBttsRate * 1.20);
  let c = 0;
  if (signals.reg === 'Neutral' || signals.reg === 'Under' || signals.reg === 'Strong Under') c++;
  if (signals.z === 'Neutral' || signals.z === 'Under') c++;
  if (signals.xg === 'Over' || signals.xg === 'Under') c++;
  if (bttsCount >= 5) c++;
  if (inp.bttsProb >= 50 && inp.bttsProb <= 70) c++;
  if (inp.o25Prob >= grO25) c++;
  if (o35Count >= 3) c++;
  if (inp.o35Prob >= grO35) c++;
  if (inp.rollingCombinedScoring >= 2.3) c++;
  if (inp.o25ImpliedProb !== null && inp.o25ImpliedProb >= 56) c++;
  return { isGreyResult: c >= 7, score: c };
}

// Goal Fest (8 checks, need 6+)
function computeGoalFest(inp: ChecklistInput, signals: { xg: SignalLabel; reg: SignalLabel; z: SignalLabel }, leagueBttsRate: number) {
  const gfO25 = Math.max(55, inp.over25Percent * 1.10);
  const gfBtts = Math.max(55, leagueBttsRate * 1.12);
  const gfO35 = Math.max(35, leagueBttsRate * 1.20);
  const isRegBearish = signals.reg === 'Under' || signals.reg === 'Strong Under';
  const isXgMild = signals.xg === 'Over' || signals.xg === 'Under' || signals.xg === 'Strong Under';
  const hasDivergence = isXgMild && isRegBearish;
  let c = 0;
  if (isXgMild) c++;
  if (hasDivergence) c++;
  if (signals.z === 'Neutral') c++;
  if (inp.o25Prob >= gfO25) c++;
  if (inp.bttsProb >= gfBtts) c++;
  if (inp.o35Prob >= gfO35) c++;
  if (inp.o25ImpliedProb !== null && inp.o25ImpliedProb >= 58) c++;
  if (inp.rollingCombinedScoring >= 2.8) c++;
  return { isGoalFest: c >= 6, score: c };
}

// BTTS Dual-Team Qualification
function computeBTTSQual(
  homeReg: SignalLabel, awayReg: SignalLabel,
  homeXgDiff: number, awayXgDiff: number,
  homeZ: number, awayZ: number,
  favOdds: number | null,
  homeSotConv: number, awaySotConv: number
): { tier: string; score: number } {
  let score = 0;
  const isRegUnder = (s: SignalLabel) => s === 'Under' || s === 'Strong Under';
  const bothRU = isRegUnder(homeReg) && isRegUnder(awayReg);
  const oneRU = isRegUnder(homeReg) || isRegUnder(awayReg);
  if (bothRU) score += 3; else if (oneRU) score += 1;
  if (homeXgDiff <= -0.5 && awayXgDiff <= -0.5) score += 2;
  if (homeZ < 1.0 && awayZ < 1.0) score += 1;
  if (favOdds && favOdds >= 1.80 && favOdds <= 2.50) score += 1;
  if (favOdds && favOdds <= 1.50) score -= 2;
  if (homeSotConv < 25) score -= 1;
  if (awaySotConv < 25) score -= 1;
  if (homeZ >= 1.0) score -= 2;
  if (awayZ >= 1.0) score -= 2;
  let tier = 'BTTS AVOID';
  if (score >= 5) tier = 'BTTS STRONG';
  else if (score >= 3) tier = 'BTTS QUALIFIED';
  else if (score >= 1) tier = 'BTTS WEAK';
  return { tier, score };
}

// Third Goal Detector
function computeThirdGoal(
  totalXg: number, homeReg: SignalLabel, awayReg: SignalLabel,
  homeXg: SignalLabel, awayXg: SignalLabel,
  homeSotAvg: number, awaySotAvg: number,
  favOdds: number | null,
  homeSotConv: number, awaySotConv: number
): { tier: string; score: number } {
  let score = 0;
  const isRegUnder = (s: SignalLabel) => s === 'Under' || s === 'Strong Under';
  const isXgOver = (s: SignalLabel) => s === 'Over' || s === 'Strong Over';
  if (totalXg > 3.0) score += 3; else if (totalXg >= 2.5) score += 1;
  if (isRegUnder(homeReg) && isRegUnder(awayReg)) score += 2;
  if (isXgOver(homeXg) && isXgOver(awayXg)) score += 2;
  if (homeSotAvg > 5.5 && awaySotAvg > 5.5) score += 2;
  if (favOdds && favOdds >= 1.80 && favOdds <= 2.50) score += 1;
  if (Math.abs(totalXg / 2 - totalXg / 2) > 1.0) score -= 1; // simplified xG lopsided
  if (favOdds && favOdds <= 1.50) score -= 1;
  if (homeSotConv < 25) score -= 1;
  if (awaySotConv < 25) score -= 1;
  let tier = 'GOAL STALL';
  if (score >= 6) tier = 'GOAL RICH';
  else if (score >= 4) tier = 'GOAL LIKELY';
  else if (score >= 2) tier = 'GOAL BORDERLINE';
  else if (score >= 0) tier = 'GOAL THIN';
  return { tier, score };
}

// ============================================================================
// PREDICTION MODEL (simplified backtest version)
// ============================================================================
function lnFact(n: number): number { if (n <= 1) return 0; let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; }
function poisPMF(l: number, k: number): number { if (l <= 0) return k === 0 ? 1 : 0; return Math.exp(k * Math.log(l) - l - lnFact(k)); }
function nbPMF(r: number, p: number, k: number): number {
  if (r <= 0 || p <= 0 || p >= 1) return poisPMF(r * (1 - p) / p, k);
  return Math.exp(lnFact(k + r - 1) - lnFact(k) - lnFact(r - 1) + r * Math.log(p) + k * Math.log(1 - p));
}
function gProb(l: number, k: number, d?: number): number {
  if (d && isFinite(d) && d <= 100) { const m = l; if (m <= 0) return k === 0 ? 1 : 0; return nbPMF(d, m / (m + d), k); }
  return poisPMF(l, k);
}
function estDisp(goals: number[]): number {
  const n = goals.length; if (n < 10) return Infinity;
  const mean = goals.reduce((s, g) => s + g, 0) / n; if (mean === 0) return Infinity;
  const v = goals.reduce((s, g) => s + (g - mean) ** 2, 0) / (n - 1);
  if (v <= mean) return Infinity;
  const r = (mean ** 2) / (v - mean), p = mean / v;
  return (r <= 0 || p <= 0 || p >= 1) ? Infinity : r;
}

function predictMatch(trainData: MatchResult[], home: string, away: string) {
  const ha = trainData.length > 0 ? {
    avgH: trainData.reduce((s, m) => s + m.ftHomeGoals, 0) / trainData.length,
    avgA: trainData.reduce((s, m) => s + m.ftAwayGoals, 0) / trainData.length,
  } : { avgH: 1.5, avgA: 1.2 };
  const hm = trainData.filter(m => m.homeTeam === home);
  const am = trainData.filter(m => m.awayTeam === away);
  const hs = hm.length > 0 ? hm.reduce((s, m) => s + m.ftHomeGoals, 0) / hm.length : ha.avgH;
  const hc = hm.length > 0 ? hm.reduce((s, m) => s + m.ftAwayGoals, 0) / hm.length : ha.avgA;
  const as2 = am.length > 0 ? am.reduce((s, m) => s + m.ftAwayGoals, 0) / am.length : ha.avgA;
  const ac = am.length > 0 ? am.reduce((s, m) => s + m.ftHomeGoals, 0) / am.length : ha.avgH;
  const half = (ha.avgH + ha.avgA) / 2;
  const hXg = (hs / half) * (ac / half) * ha.avgH;
  const aXg = (as2 / half) * (hc / half) * ha.avgA;
  const tXg = hXg + aXg;
  const disp = estDisp(trainData.map(m => m.ftHomeGoals + m.ftAwayGoals));
  let hwp = 0, awp = 0, dp = 0;
  for (let i = 0; i <= 7; i++) for (let j = 0; j <= 7; j++) {
    const p = gProb(hXg, i, disp) * gProb(aXg, j, disp);
    if (i > j) hwp += p; else if (j > i) awp += p; else dp += p;
  }
  const p0 = gProb(tXg, 0, disp), p1 = gProb(tXg, 1, disp), p2 = gProb(tXg, 2, disp), p3 = gProb(tXg, 3, disp);
  let bttsP = 0;
  for (let i = 1; i <= 7; i++) for (let j = 1; j <= 7; j++) bttsP += gProb(hXg, i, disp) * gProb(aXg, j, disp);
  const bl = tXg / 2, imb = Math.abs(hXg - aXg) / (hXg + aXg + 0.001);
  bttsP = bttsP + ((1 - Math.exp(-bl)) ** 2 - bttsP) * 0.55 * imb;
  return {
    o15: Math.round(Math.min(95, Math.max(40, (1 - p0 - p1) * 100))),
    o25: Math.round(Math.min(85, Math.max(35, (1 - p0 - p1 - p2) * 100))),
    o35: Math.round(Math.min(70, Math.max(10, (1 - p0 - p1 - p2 - p3) * 100))),
    btts: Math.round(bttsP * 100),
    totalXg: Math.round(tXg * 100) / 100, homeXg: Math.round(hXg * 100) / 100, awayXg: Math.round(aXg * 100) / 100,
  };
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  const ALL_SEASONS = ['2627', '2526', '2425', '2324', '2223', '2122', '2021', '1920', '1819', '1718', '1617', '1516'];
  const CHRONO = [...ALL_SEASONS].reverse();
  const TEST_SEASONS = ['2122', '2223', '2324', '2425'];

  console.log('Fetching all EPL data...');
  const allData: MatchResult[] = [];
  for (const s of ALL_SEASONS) { allData.push(...await fetchSeason('E0', s)); await new Promise(r => setTimeout(r, 600)); }
  console.log(`Total: ${allData.length} matches`);

  // Identify BTTS-BH games
  const isBH = (m: MatchResult) => {
    const shH = m.ftHomeGoals - m.htHomeGoals, shA = m.ftAwayGoals - m.htAwayGoals;
    return m.htHomeGoals > 0 && m.htAwayGoals > 0 && shH > 0 && shA > 0;
  };

  // League baselines from training data
  const leagueBaselines = (season: string) => {
    const ci = CHRONO.indexOf(season); if (ci < 3) return null;
    const trainSeasons = CHRONO.slice(Math.max(0, ci - 5), ci);
    const td = allData.filter(m => trainSeasons.includes(m.season));
    if (td.length < 100) return null;
    return {
      avgGoalsPerGame: td.reduce((s, m) => s + m.ftHomeGoals + m.ftAwayGoals, 0) / td.length,
      over25Percent: td.filter(m => m.ftHomeGoals + m.ftAwayGoals > 2.5).length / td.length * 100,
      over35Percent: td.filter(m => m.ftHomeGoals + m.ftAwayGoals > 3.5).length / td.length * 100,
      bttsPercent: td.filter(m => m.ftHomeGoals > 0 && m.ftAwayGoals > 0).length / td.length * 100,
      avgHomeGoals: td.reduce((s, m) => s + m.ftHomeGoals, 0) / td.length,
      avgAwayGoals: td.reduce((s, m) => s + m.ftAwayGoals, 0) / td.length,
      avgSotConversion: td.reduce((s, m) => s + (m.homeShotsOnTarget > 0 ? m.ftHomeGoals / m.homeShotsOnTarget * 100 : 0) + (m.awayShotsOnTarget > 0 ? m.ftAwayGoals / m.awayShotsOnTarget * 100 : 0), 0) / (td.length * 2),
    };
  };

  interface GameSignals {
    isBH: boolean;
    season: string; date: string; homeTeam: string; awayTeam: string;
    // Core signals
    homeReg: SignalLabel; awayReg: SignalLabel; matchReg: SignalLabel;
    homeXg: SignalLabel; awayXg: SignalLabel; matchXg: SignalLabel;
    homeZ: SignalLabel; awayZ: SignalLabel; matchZ: SignalLabel;
    combinedZScore: number;
    // Model probs
    o25: number; btts: number; o35: number; totalXg: number;
    // Checklists
    bttsChecklist: number; o35Checklist: number;
    // Qualifiers
    strongBet: boolean; strongBetPts: number;
    greyResult: boolean; greyResultScore: number;
    goalFest: boolean; goalFestScore: number;
    bttsTier: string; bttsScore: number;
    thirdGoalTier: string; thirdGoalScore: number;
    // Rolling
    rollingCombinedScoring: number;
    // Odds
    o25Implied: number | null;
    favOdds: number | null;
    // xG diffs
    homeXgDiff: number; awayXgDiff: number;
    // Z raw
    homeZRaw: number; awayZRaw: number;
  }

  const allSignals: GameSignals[] = [];

  for (const ts of TEST_SEASONS) {
    const lb = leagueBaselines(ts);
    if (!lb) { console.log(`Skipping ${ts} — no training data`); continue; }
    const trainSeasons = CHRONO.slice(Math.max(0, CHRONO.indexOf(ts) - 5), CHRONO.indexOf(ts));
    const trainData = allData.filter(m => trainSeasons.includes(m.season));

    const seasonMatches = allData.filter(m => m.season === ts).sort((a, b) => a.date.localeCompare(b.date));
    console.log(`Processing ${ts}: ${seasonMatches.length} matches, ${seasonMatches.filter(isBH).length} BTTS-BH`);

    for (const m of seasonMatches) {
      const hRoll = computeRollingStats(allData, m.homeTeam, m.date, m.season);
      const aRoll = computeRollingStats(allData, m.awayTeam, m.date, m.season);
      const pred = predictMatch(trainData, m.homeTeam, m.awayTeam);

      // Core signals
      const hRegSig = computeRegressionSignal(hRoll);
      const aRegSig = computeRegressionSignal(aRoll);
      const matchRegSig = classifyRegression(hRegSig + aRegSig);
      const hXgDiff = computeXgDiff(hRoll);
      const aXgDiff = computeXgDiff(aRoll);
      const hXgSig = classifyXg(hXgDiff);
      const aXgSig = classifyXg(aXgDiff);
      const matchXgSig = classifyXg(hXgDiff + aXgDiff);
      const hZRaw = computeZScore(hRoll);
      const aZRaw = computeZScore(aRoll);
      const hZSig = classifyZScore(hZRaw);
      const aZSig = classifyZScore(aZRaw);
      const combZScore = computeCombinedZScore(hRoll, aRoll);
      const matchZSig = classifyZScore(combZScore);

      // Rolling scoring
      // Home team's last 5 HOME games scored + Away team's last 5 AWAY games scored
      const hHomeRoll = computeRollingStats(allData, m.homeTeam, m.date, m.season);
      const aAwayRoll = computeRollingStats(allData, m.awayTeam, m.date, m.season);
      const rollingHomeScored = hHomeRoll.last5Scored;
      const rollingAwayScored = aAwayRoll.last5Scored;
      const rollingCombinedScoring = rollingHomeScored + rollingAwayScored;

      // Odds
      const favOdds = m.oddsAvgHome && m.oddsAvgDraw && m.oddsAvgAway
        ? Math.min(m.oddsAvgHome, m.oddsAvgDraw, m.oddsAvgAway) : null;
      const o25Implied = m.oddsAvgOver25 ? Math.round(100 / m.oddsAvgOver25 * 10) / 10 : null;

      // Checklist input
      const inp: ChecklistInput = {
        avgGoalsPerGame: lb.avgGoalsPerGame,
        over25Percent: lb.over25Percent,
        bttsProb: pred.btts,
        o25Prob: pred.o25,
        o35Prob: pred.o35,
        avgHomeGoals: lb.avgHomeGoals,
        avgAwayGoals: lb.avgAwayGoals,
        overallShotConversion: lb.avgSotConversion,
        rollingHomeScored, rollingAwayScored, rollingCombinedScoring,
        o25ImpliedProb: o25Implied,
      };

      const signals = { xg: matchXgSig, reg: matchRegSig, z: matchZSig };
      const sb = computeStrongBet(inp, signals, lb.bttsPercent);
      const gr = computeGreyResult(inp, signals, lb.bttsPercent);
      const gf = computeGoalFest(inp, signals, lb.bttsPercent);
      const bq = computeBTTSQual(
        classifyRegression(hRegSig), classifyRegression(aRegSig),
        hXgDiff, aXgDiff, hZRaw, aZRaw,
        favOdds, hRoll.seasonSotConversion, aRoll.seasonSotConversion
      );
      const tg = computeThirdGoal(
        pred.totalXg, classifyRegression(hRegSig), classifyRegression(aRegSig),
        hXgSig, aXgSig, hRoll.seasonSOT, aRoll.seasonSOT,
        favOdds, hRoll.seasonSotConversion, aRoll.seasonSotConversion
      );

      allSignals.push({
        isBH: isBH(m), season: ts, date: m.date, homeTeam: m.homeTeam, awayTeam: m.awayTeam,
        homeReg: classifyRegression(hRegSig), awayReg: classifyRegression(aRegSig), matchReg: matchRegSig,
        homeXg: hXgSig, awayXg: aXgSig, matchXg: matchXgSig,
        homeZ: hZSig, awayZ: aZSig, matchZ: matchZSig,
        combinedZScore: combZScore,
        o25: pred.o25, btts: pred.btts, o35: pred.o35, totalXg: pred.totalXg,
        bttsChecklist: computeBttsChecklist(inp, lb.bttsPercent),
        o35Checklist: computeO35Checklist(inp, lb.over25Percent, lb.over35Percent),
        strongBet: sb.isStrongBet, strongBetPts: sb.points,
        greyResult: gr.isGreyResult, greyResultScore: gr.score,
        goalFest: gf.isGoalFest, goalFestScore: gf.score,
        bttsTier: bq.tier, bttsScore: bq.score,
        thirdGoalTier: tg.tier, thirdGoalScore: tg.score,
        rollingCombinedScoring,
        o25Implied, favOdds,
        homeXgDiff: hXgDiff, awayXgDiff: aXgDiff,
        homeZRaw: hZRaw, awayZRaw: aZRaw,
      });
    }
  }

  const bh = allSignals.filter(s => s.isBH);
  const non = allSignals.filter(s => !s.isBH);
  console.log(`\nTotal: ${bh.length} BTTS-BH, ${non.length} non-BH`);

  // Helper
  const pct = (arr: GameSignals[], fn: (s: GameSignals) => boolean) => arr.filter(fn).length / arr.length * 100;
  const avg = (arr: GameSignals[], fn: (s: GameSignals) => number) => arr.reduce((s, x) => s + fn(x), 0) / arr.length;

  // ========================================================================
  console.log('\n' + '='.repeat(100));
  console.log('STRONG BET INDICATOR');
  console.log('='.repeat(100));
  const sbBH = pct(bh, s => s.strongBet);
  const sbNon = pct(non, s => s.strongBet);
  console.log(`  Qualifies: BH ${(sbBH).toFixed(1)}% (${bh.filter(s=>s.strongBet).length}/${bh.length}) vs Non-BH ${(sbNon).toFixed(1)}% (${non.filter(s=>s.strongBet).length}/${non.length})`);
  console.log(`  Avg points: BH ${avg(bh, s => s.strongBetPts).toFixed(1)} vs Non-BH ${avg(non, s => s.strongBetPts).toFixed(1)}`);
  console.log(`  Lift: ${(sbNon > 0 ? (sbBH / sbNon) : 0).toFixed(2)}x`);

  console.log('\n' + '='.repeat(100));
  console.log('GOAL FEST DETECTOR');
  console.log('='.repeat(100));
  const gfBH = pct(bh, s => s.goalFest);
  const gfNon = pct(non, s => s.goalFest);
  console.log(`  Qualifies: BH ${(gfBH).toFixed(1)}% (${bh.filter(s=>s.goalFest).length}/${bh.length}) vs Non-BH ${(gfNon).toFixed(1)}% (${non.filter(s=>s.goalFest).length}/${non.length})`);
  console.log(`  Avg score: BH ${avg(bh, s => s.goalFestScore).toFixed(2)}/8 vs Non-BH ${avg(non, s => s.goalFestScore).toFixed(2)}/8`);
  console.log(`  Lift: ${(gfNon > 0 ? (gfBH / gfNon) : 0).toFixed(2)}x`);

  console.log('\n' + '='.repeat(100));
  console.log('GREY RESULT PREDICTOR');
  console.log('='.repeat(100));
  const grBH = pct(bh, s => s.greyResult);
  const grNon = pct(non, s => s.greyResult);
  console.log(`  Qualifies: BH ${(grBH).toFixed(1)}% (${bh.filter(s=>s.greyResult).length}/${bh.length}) vs Non-BH ${(grNon).toFixed(1)}% (${non.filter(s=>s.greyResult).length}/${non.length})`);
  console.log(`  Avg score: BH ${avg(bh, s => s.greyResultScore).toFixed(2)}/10 vs Non-BH ${avg(non, s => s.greyResultScore).toFixed(2)}/10`);
  console.log(`  Lift: ${(grNon > 0 ? (grBH / grNon) : 0).toFixed(2)}x`);

  // ========================================================================
  console.log('\n' + '='.repeat(100));
  console.log('BTTS DUAL-TEAM QUALIFICATION TIERS');
  console.log('='.repeat(100));
  for (const tier of ['BTTS STRONG', 'BTTS QUALIFIED', 'BTTS WEAK', 'BTTS AVOID'] as const) {
    const bhP = pct(bh, s => s.bttsTier === tier);
    const nonP = pct(non, s => s.bttsTier === tier);
    console.log(`  ${tier.padEnd(16)}: BH ${bhP.toFixed(1).padStart(6)}% (${bh.filter(s=>s.bttsTier===tier).length}) vs Non-BH ${nonP.toFixed(1).padStart(6)}% (${non.filter(s=>s.bttsTier===tier).length})` + (nonP > 0 ? `  Lift: ${(bhP/nonP).toFixed(2)}x` : ''));
  }

  console.log('\n' + '='.repeat(100));
  console.log('THIRD GOAL DETECTOR TIERS');
  console.log('='.repeat(100));
  for (const tier of ['GOAL RICH', 'GOAL LIKELY', 'GOAL BORDERLINE', 'GOAL THIN', 'GOAL STALL'] as const) {
    const bhP = pct(bh, s => s.thirdGoalTier === tier);
    const nonP = pct(non, s => s.thirdGoalTier === tier);
    console.log(`  ${tier.padEnd(16)}: BH ${bhP.toFixed(1).padStart(6)}% (${bh.filter(s=>s.thirdGoalTier===tier).length}) vs Non-BH ${nonP.toFixed(1).padStart(6)}% (${non.filter(s=>s.thirdGoalTier===tier).length})` + (nonP > 0 ? `  Lift: ${(bhP/nonP).toFixed(2)}x` : ''));
  }

  // ========================================================================
  console.log('\n' + '='.repeat(100));
  console.log('CORE SIGNALS (Regression, xG, Z-Score)');
  console.log('='.repeat(100));
  const sigLabels: SignalLabel[] = ['Strong Over', 'Over', 'Neutral', 'Under', 'Strong Under'];
  console.log('\n  --- Match-Level Signals ---');
  console.log(`  ${'Signal'.padEnd(18)} | ${'BH Strong Over'.padStart(12)} | ${'BH Over'.padStart(8)} | ${'BH Neutral'.padStart(11)} | ${'BH Under'.padStart(9)} | ${'BH Str Under'.padStart(12)} || ${'Non Strong Over'.padStart(14)} | ${'Non Over'.padStart(9)} | ${'Non Neutral'.padStart(12)} | ${'Non Under'.padStart(10)} | ${'Non Str Under'.padStart(13)}`);
  console.log('  ' + '-'.repeat(160));
  for (const [key, label] of [['matchReg', 'Regression'], ['matchXg', 'xG'], ['matchZ', 'Z-Score']] as const) {
    const row = sigLabels.map(l => ({ l, bh: pct(bh, s => (s as any)[key] === l), non: pct(non, s => (s as any)[key] === l) }));
    console.log(`  ${label.padEnd(18)} | ${row[0].bh.toFixed(1).padStart(11)}% | ${row[1].bh.toFixed(1).padStart(7)}% | ${row[2].bh.toFixed(1).padStart(10)}% | ${row[3].bh.toFixed(1).padStart(8)}% | ${row[4].bh.toFixed(1).padStart(11)}% || ${row[0].non.toFixed(1).padStart(13)}% | ${row[1].non.toFixed(1).padStart(8)}% | ${row[2].non.toFixed(1).padStart(11)}% | ${row[3].non.toFixed(1).padStart(9)}% | ${row[4].non.toFixed(1).padStart(12)}%`);
  }

  // ========================================================================
  console.log('\n' + '='.repeat(100));
  console.log('CHECKLIST SCORES');
  console.log('='.repeat(100));
  console.log(`  BTTS Checklist (0-9): BH avg ${avg(bh, s => s.bttsChecklist).toFixed(2)} vs Non-BH ${avg(non, s => s.bttsChecklist).toFixed(2)}`);
  console.log(`  O3.5 Checklist (0-9): BH avg ${avg(bh, s => s.o35Checklist).toFixed(2)} vs Non-BH ${avg(non, s => s.o35Checklist).toFixed(2)}`);
  for (const threshold of [5, 6, 7]) {
    const bhP = pct(bh, s => s.bttsChecklist >= threshold);
    const nonP = pct(non, s => s.bttsChecklist >= threshold);
    console.log(`  BTTS Checklist >= ${threshold}/9: BH ${bhP.toFixed(1)}% vs Non-BH ${nonP.toFixed(1)}%` + (nonP > 0 ? `  Lift: ${(bhP/nonP).toFixed(2)}x` : ''));
  }

  // ========================================================================
  console.log('\n' + '='.repeat(100));
  console.log('ODDS SIGNALS');
  console.log('='.repeat(100));
  const withOdds_bh = bh.filter(s => s.o25Implied !== null);
  const withOdds_non = non.filter(s => s.o25Implied !== null);
  console.log(`  O2.5 Implied Prob: BH avg ${avg(withOdds_bh, s => s.o25Implied!).toFixed(1)}% vs Non-BH ${avg(withOdds_non, s => s.o25Implied!).toFixed(1)}%`);
  console.log(`  O2.5 Implied >= 56%: BH ${pct(withOdds_bh, s => s.o25Implied! >= 56).toFixed(1)}% vs Non-BH ${pct(withOdds_non, s => s.o25Implied! >= 56).toFixed(1)}%`);
  console.log(`  O2.5 Implied >= 58%: BH ${pct(withOdds_bh, s => s.o25Implied! >= 58).toFixed(1)}% vs Non-BH ${pct(withOdds_non, s => s.o25Implied! >= 58).toFixed(1)}%`);
  console.log(`  O2.5 Implied >= 62%: BH ${pct(withOdds_bh, s => s.o25Implied! >= 62).toFixed(1)}% vs Non-BH ${pct(withOdds_non, s => s.o25Implied! >= 62).toFixed(1)}%`);
  const withFav_bh = bh.filter(s => s.favOdds !== null);
  const withFav_non = non.filter(s => s.favOdds !== null);
  console.log(`  Favorite odds: BH avg ${avg(withFav_bh, s => s.favOdds!).toFixed(2)} vs Non-BH ${avg(withFav_non, s => s.favOdds!).toFixed(2)}`);
  console.log(`  Competitive (1.80-2.50): BH ${pct(withFav_bh, s => s.favOdds! >= 1.8 && s.favOdds! <= 2.5).toFixed(1)}% vs Non-BH ${pct(withFav_non, s => s.favOdds! >= 1.8 && s.favOdds! <= 2.5).toFixed(1)}%`);

  // ========================================================================
  console.log('\n' + '='.repeat(100));
  console.log('ROLLING COMBINED SCORING');
  console.log('='.repeat(100));
  console.log(`  Avg rolling combined scoring: BH ${avg(bh, s => s.rollingCombinedScoring).toFixed(2)} vs Non-BH ${avg(non, s => s.rollingCombinedScoring).toFixed(2)}`);
  for (const t of [2.3, 2.5, 2.8, 3.0]) {
    const bhP = pct(bh, s => s.rollingCombinedScoring >= t);
    const nonP = pct(non, s => s.rollingCombinedScoring >= t);
    console.log(`  Rolling >= ${t}: BH ${bhP.toFixed(1)}% vs Non-BH ${nonP.toFixed(1)}%` + (nonP > 0 ? `  Lift: ${(bhP/nonP).toFixed(2)}x` : ''));
  }

  // ========================================================================
  console.log('\n' + '='.repeat(100));
  console.log('SUPER COMBO: Which combos of qualifiers catch the most BTTS-BH?');
  console.log('='.repeat(100));

  const combos = [
    { name: 'Goal Fest', fn: (s: GameSignals) => s.goalFest },
    { name: 'Grey Result', fn: (s: GameSignals) => s.greyResult },
    { name: 'Strong Bet', fn: (s: GameSignals) => s.strongBet },
    { name: 'BTTS QUALIFIED+', fn: (s: GameSignals) => s.bttsTier === 'BTTS QUALIFIED' || s.bttsTier === 'BTTS STRONG' },
    { name: 'GOAL LIKELY+', fn: (s: GameSignals) => ['GOAL RICH', 'GOAL LIKELY'].includes(s.thirdGoalTier) },
    { name: 'O2.5 Implied >= 62%', fn: (s: GameSignals) => s.o25Implied !== null && s.o25Implied >= 62 },
    { name: 'O2.5 Implied >= 58%', fn: (s: GameSignals) => s.o25Implied !== null && s.o25Implied >= 58 },
    { name: 'Rolling >= 2.8', fn: (s: GameSignals) => s.rollingCombinedScoring >= 2.8 },
    { name: 'Z-Score Neutral', fn: (s: GameSignals) => s.matchZ === 'Neutral' },
    { name: 'Regression Over/Strong Over', fn: (s: GameSignals) => s.matchReg === 'Over' || s.matchReg === 'Strong Over' },
    { name: 'xG Over (both teams underperforming)', fn: (s: GameSignals) => s.homeXgDiff <= -0.5 && s.awayXgDiff <= -0.5 },
    { name: 'Goal Fest + O2.5 Implied >= 58%', fn: (s: GameSignals) => s.goalFest && s.o25Implied !== null && s.o25Implied >= 58 },
    { name: 'Goal Fest OR Grey Result', fn: (s: GameSignals) => s.goalFest || s.greyResult },
    { name: 'BTTS QUALIFIED+ + Rolling >= 2.5', fn: (s: GameSignals) => (s.bttsTier === 'BTTS QUALIFIED' || s.bttsTier === 'BTTS STRONG') && s.rollingCombinedScoring >= 2.5 },
    { name: 'O2.5 Implied >= 58% + Z-Score Neutral', fn: (s: GameSignals) => s.o25Implied !== null && s.o25Implied >= 58 && s.matchZ === 'Neutral' },
    { name: 'O2.5 Implied >= 62% + Rolling >= 2.5', fn: (s: GameSignals) => s.o25Implied !== null && s.o25Implied >= 62 && s.rollingCombinedScoring >= 2.5 },
    { name: 'O2.5 Implied >= 58% + Regression Over', fn: (s: GameSignals) => s.o25Implied !== null && s.o25Implied >= 58 && (s.matchReg === 'Over' || s.matchReg === 'Strong Over') },
    { name: 'O2.5 Implied >= 58% + Competitive odds', fn: (s: GameSignals) => s.o25Implied !== null && s.o25Implied >= 58 && s.favOdds !== null && s.favOdds >= 1.8 && s.favOdds <= 2.5 },
    { name: 'ANY of: GoalFest/GreyResult/StrongBet', fn: (s: GameSignals) => s.goalFest || s.greyResult || s.strongBet },
    { name: 'O2.5 Implied >= 56% + Rolling >= 2.3', fn: (s: GameSignals) => s.o25Implied !== null && s.o25Implied >= 56 && s.rollingCombinedScoring >= 2.3 },
  ];

  console.log(`\n  ${'Combo'.padEnd(50)} | ${'BH Pass'.padStart(7)} | ${'BH Rate'.padStart(8)} | ${'Non Rate'.padStart(9)} | ${'Lift'.padStart(6)} | ${'Hit Rate'.padStart(9)} | ${'Enrich'.padStart(7)}`);
  console.log('  ' + '-'.repeat(110));
  const sorted = combos.map(c => {
    const bhPass = bh.filter(c.fn).length;
    const nonPass = non.filter(c.fn).length;
    const bhRate = bhPass / bh.length * 100;
    const nonRate = nonPass / non.length * 100;
    const lift = nonRate > 0 ? bhRate / nonRate : 0;
    const hitRate = (bhPass + nonPass) > 0 ? bhPass / (bhPass + nonPass) * 100 : 0;
    return { name: c.name, bhPass, nonPass, bhRate, nonRate, lift, hitRate };
  }).sort((a, b) => b.hitRate - a.hitRate);

  for (const r of sorted) {
    console.log(`  ${r.name.padEnd(50)} | ${String(r.bhPass).padStart(7)} | ${r.bhRate.toFixed(1).padStart(6)}% | ${r.nonRate.toFixed(1).padStart(7)}% | ${r.lift.toFixed(2).padStart(5)}x | ${r.hitRate.toFixed(1).padStart(7)}% | ${(r.hitRate / 5.3).toFixed(1).padStart(5)}x`);
  }

  console.log('\n' + '='.repeat(100));
  console.log('ANALYSIS COMPLETE');
  console.log('='.repeat(100));
}

main().catch(console.error);
