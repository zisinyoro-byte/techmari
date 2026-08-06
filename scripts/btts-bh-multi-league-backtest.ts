/**
 * BTTS Both Halves — Multi-League Threshold Calibration Backtest
 *
 * Fetches historical data from football-data.co.uk for major European leagues,
 * computes the 8 BTTS-BH checks for every game, sweeps key thresholds to find
 * optimal calibration, and reports league-by-league and aggregate results.
 *
 * Standalone script (no project imports).
 * Caches CSVs to /tmp/btts-bh-cache/ to avoid re-fetching.
 *
 * Usage: npx tsx scripts/btts-bh-multi-league-backtest.ts
 */

import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

// ============================================================================
// Types
// ============================================================================

interface MatchResult {
  date: string;
  homeTeam: string;
  awayTeam: string;
  ftHomeGoals: number;
  ftAwayGoals: number;
  htHomeGoals: number;
  htAwayGoals: number;
  oddsAvgHome: number | null;
  oddsAvgDraw: number | null;
  oddsAvgAway: number | null;
  oddsAvgOver25: number | null;
  oddsOver25: number | null;
  season: string;
  league: string;
}

interface GameCheckData {
  isBTTSBH: boolean;
  o25ImpliedProb: number | null;
  o25Prob: number;
  o35Prob: number;
  bttsProb: number;
  rollingCombinedScoring: number;
  drawProb: number;
  avgGoalsPerGame: number;
  checkResults: boolean[];
}

// ============================================================================
// Config
// ============================================================================

const LEAGUES = [
  { code: 'E0', name: 'EPL' },
  { code: 'SP1', name: 'La Liga' },
  { code: 'D1', name: 'Bundesliga' },
  { code: 'I1', name: 'Serie A' },
  { code: 'F1', name: 'Ligue 1' },
  { code: 'N1', name: 'Eredivisie' },
  { code: 'P1', name: 'Primeira Liga' },
];

const SEASONS = ['1516', '1617', '1718', '1819', '1920', '2021', '2122', '2223', '2324', '2425'];
const CACHE_DIR = '/tmp/btts-bh-cache';

// ============================================================================
// CSV Fetching with disk cache
// ============================================================================

function fetchCSV(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 8000,
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        if (res.headers.location) {
          fetchCSV(res.headers.location).then(resolve).catch(reject);
          return;
        }
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchLeagueSeasonCached(league: string, season: string): Promise<MatchResult[]> {
  const cacheFile = path.join(CACHE_DIR, `${league}_${season}.json`);

  // Check cache
  if (fs.existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      return cached;
    } catch {}
  }

  const url = `https://www.football-data.co.uk/mmz4281/${season}/${league}.csv`;
  try {
    const csv = await fetchCSV(url);
    const records: any[] = parse(csv, { columns: true, skip_empty_lines: true, relax_quotes: true, bom: true });
    const matches = records.map((r: any) => ({
      date: r.Date || '',
      homeTeam: (r.HomeTeam || '').trim(),
      awayTeam: (r.AwayTeam || '').trim(),
      ftHomeGoals: parseInt(r.FTHG) || 0,
      ftAwayGoals: parseInt(r.FTAG) || 0,
      htHomeGoals: parseInt(r.HTHG) || 0,
      htAwayGoals: parseInt(r.HTAG) || 0,
      oddsAvgHome: parseFloat(r['AvgH']) || null,
      oddsAvgDraw: parseFloat(r['AvgD']) || null,
      oddsAvgAway: parseFloat(r['AvgA']) || null,
      oddsAvgOver25: parseFloat(r['Avg>2.5']) || null,
      oddsOver25: parseFloat(r['B365>2.5']) || null,
      season,
      league,
    })).filter((m: MatchResult) => m.homeTeam && m.awayTeam);

    // Save to cache
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(matches));
    return matches;
  } catch (e: any) {
    console.warn(`    WARN: ${league} ${season}: ${e.message}`);
    return [];
  }
}

async function fetchAllData(): Promise<{ league: string; name: string; matches: MatchResult[] }[]> {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

  const results: { league: string; name: string; matches: MatchResult[] }[] = [];

  for (const lg of LEAGUES) {
    console.log(`\nFetching ${lg.name} (${lg.code})...`);
    let allMatches: MatchResult[] = [];

    for (const season of SEASONS) {
      process.stdout.write(`  ${season}... `);
      const matches = await fetchLeagueSeasonCached(lg.code, season);
      console.log(`${matches.length} matches`);
      allMatches = allMatches.concat(matches);
      await delay(300);
    }

    console.log(`  ${lg.name} total: ${allMatches.length} matches`);
    results.push({ league: lg.code, name: lg.name, matches: allMatches });
  }

  return results;
}

// ============================================================================
// BTTS-BH Detection & Check Computation
// ============================================================================

function isBTTSBothHalves(m: MatchResult): boolean {
  const htBTTS = m.htHomeGoals > 0 && m.htAwayGoals > 0;
  const shHomeGoals = m.ftHomeGoals - m.htHomeGoals;
  const shAwayGoals = m.ftAwayGoals - m.htAwayGoals;
  const shBTTS = shHomeGoals > 0 && shAwayGoals > 0;
  return htBTTS && shBTTS;
}

function computeO25ImpliedProb(m: MatchResult): number | null {
  const odds = m.oddsAvgOver25 ?? m.oddsOver25;
  if (!odds || odds <= 1.01) return null;
  return (1 / odds) * 100;
}

function computeDrawProb(m: MatchResult): number {
  const h = m.oddsAvgHome, d = m.oddsAvgDraw, a = m.oddsAvgAway;
  if (!h || !d || !a || h < 1.01 || d < 1.01 || a < 1.01) return 99;
  const overround = (1 / h) + (1 / d) + (1 / a);
  return (1 / d) / overround * 100;
}

interface TeamRolling {
  avgScored: number;
  avgConceded: number;
  o25Rate: number;
  bttsRate: number;
  o35Rate: number;
}

function computeTeamRolling(matches: MatchResult[], team: string, upToIndex: number): TeamRolling {
  const teamGames: { scored: number; conceded: number; totalGoals: number }[] = [];

  for (let i = upToIndex - 1; i >= 0 && teamGames.length < 5; i--) {
    const m = matches[i];
    let scored = 0, conceded = 0;
    if (m.homeTeam === team) {
      scored = m.ftHomeGoals; conceded = m.ftAwayGoals;
    } else if (m.awayTeam === team) {
      scored = m.ftAwayGoals; conceded = m.ftHomeGoals;
    } else {
      continue;
    }
    teamGames.push({ scored, conceded, totalGoals: scored + conceded });
  }

  if (teamGames.length === 0) return { avgScored: 0, avgConceded: 0, o25Rate: 0, bttsRate: 0, o35Rate: 0 };

  const n = teamGames.length;
  const avgScored = teamGames.reduce((s, g) => s + g.scored, 0) / n;
  const o25Count = teamGames.filter(g => g.totalGoals > 2.5).length;
  const o35Count = teamGames.filter(g => g.totalGoals > 3.5).length;
  const bttsCount = teamGames.filter(g => g.scored > 0 && g.conceded > 0).length;

  return {
    avgScored,
    avgConceded: teamGames.reduce((s, g) => s + g.conceded, 0) / n,
    o25Rate: (o25Count / n) * 100,
    bttsRate: (bttsCount / n) * 100,
    o35Rate: (o35Count / n) * 100,
  };
}

function computeLeagueAvgGoals(matches: MatchResult[], upToIndex: number): number {
 const count = Math.min(upToIndex, 50);
  if (count < 5) return 2.6;
  const slice = matches.slice(0, count);
  return slice.reduce((s, m) => s + m.ftHomeGoals + m.ftAwayGoals, 0) / slice.length;
}

function computeGameChecks(m: MatchResult, matches: MatchResult[], index: number): GameCheckData {
  const bttsBH = isBTTSBothHalves(m);
  const o25Implied = computeO25ImpliedProb(m);
  const drawProb = computeDrawProb(m);

  const homeRolling = computeTeamRolling(matches, m.homeTeam, index);
  const awayRolling = computeTeamRolling(matches, m.awayTeam, index);
  const rollingCombinedScoring = homeRolling.avgScored + awayRolling.avgScored;

  const o25Prob = (homeRolling.o25Rate + awayRolling.o25Rate) / 2;
  const o35Prob = (homeRolling.o35Rate + awayRolling.o35Rate) / 2;
  const bttsProb = (homeRolling.bttsRate + awayRolling.bttsRate) / 2;
  const avgGoalsPerGame = computeLeagueAvgGoals(matches, index);

  const CURRENT = { o25Implied: 65, o25ImpliedElite: 72, o25Prob: 55, rollingScoring: 3.0, o35Prob: 35, bttsProb: 45, drawProbMax: 25, leagueAvgGoals: 2.6 };

  const checkResults = [
    o25Implied !== null && o25Implied >= CURRENT.o25Implied,
    o25Implied !== null && o25Implied >= CURRENT.o25ImpliedElite,
    o25Prob >= CURRENT.o25Prob,
    rollingCombinedScoring >= CURRENT.rollingScoring,
    o35Prob >= CURRENT.o35Prob,
    bttsProb >= CURRENT.bttsProb,
    drawProb < CURRENT.drawProbMax,
    avgGoalsPerGame >= CURRENT.leagueAvgGoals,
  ];

  return { isBTTSBH: bttsBH, o25ImpliedProb: o25Implied, o25Prob, o35Prob, bttsProb, rollingCombinedScoring, drawProb, avgGoalsPerGame, checkResults };
}

// ============================================================================
// Threshold Sweep
// ============================================================================

interface SweepResult {
  threshold: string; value: number; sampleSize: number; bttsBHCount: number;
  passRate: number; bttsBHRate: number; baseRate: number; lift: number; coverage: number;
}

interface ComboResult {
  thresholds: Record<string, number>; requiredChecks: number;
  totalGames: number; passing: number; bttsBHAmongPassing: number;
  bttsBHRate: number; baseRate: number; lift: number; coverage: number; score: number;
}

function sweepThreshold(games: GameCheckData[], field: string, label: string, values: number[], direction: 'above' | 'below', baseRate: number): SweepResult[] {
  const totalBTTSBH = games.filter(g => g.isBTTSBH).length;
  const total = games.length;

  return values.map(v => {
    let passing: GameCheckData[];
    if (field === 'o25ImpliedProb') {
      passing = direction === 'above'
        ? games.filter(g => g.o25ImpliedProb !== null && g.o25ImpliedProb >= v)
        : games.filter(g => g.o25ImpliedProb !== null && g.o25ImpliedProb < v);
    } else if (direction === 'below') {
      passing = games.filter((g: any) => g[field] < v);
    } else {
      passing = games.filter((g: any) => g[field] >= v);
    }

    const bh = passing.filter(g => g.isBTTSBH).length;
    const rate = passing.length > 0 ? (bh / passing.length) * 100 : 0;
    const lift = baseRate > 0 ? rate / baseRate : 0;
    const cov = totalBTTSBH > 0 ? (bh / totalBTTSBH) * 100 : 0;
    return { threshold: label, value: v, sampleSize: passing.length, bttsBHCount: bh, passRate: (passing.length / total) * 100, bttsBHRate: rate, baseRate, lift, coverage: cov };
  });
}

function evalCombo(games: GameCheckData[], o25Imp: number, o25Elite: number, o25P: number, roll: number, o35P: number, bttsP: number, drawMax: number, leagueAvg: number, req: number, baseRate: number): ComboResult {
  const passing = games.filter(g => {
    const checks = [
      g.o25ImpliedProb !== null && g.o25ImpliedProb >= o25Imp,
      g.o25ImpliedProb !== null && g.o25ImpliedProb >= o25Elite,
      g.o25Prob >= o25P,
      g.rollingCombinedScoring >= roll,
      g.o35Prob >= o35P,
      g.bttsProb >= bttsP,
      g.drawProb < drawMax,
      g.avgGoalsPerGame >= leagueAvg,
    ];
    return checks.filter(c => c).length >= req;
  });

  const totalBH = games.filter(g => g.isBTTSBH).length;
  const bh = passing.filter(g => g.isBTTSBH).length;
  const rate = passing.length > 0 ? (bh / passing.length) * 100 : 0;
  const lift = baseRate > 0 ? rate / baseRate : 0;
  const cov = totalBH > 0 ? (bh / totalBH) * 100 : 0;
  return { thresholds: { o25Implied: o25Imp, o25ImpliedElite: o25Elite, o25Prob: o25P, rollingScoring: roll, o35Prob: o35P, bttsProb: bttsP, drawProbMax: drawMax, leagueAvgGoals: leagueAvg }, requiredChecks: req, totalGames: games.length, passing: passing.length, bttsBHAmongPassing: bh, bttsBHRate: rate, baseRate, lift, coverage: cov, score: lift * Math.sqrt(cov / 100) };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log('BTTS BOTH HALVES — MULTI-LEAGUE THRESHOLD CALIBRATION');
  console.log('='.repeat(80));

  const leagueData = await fetchAllData();

  // === Phase 1: Base rates ===
  console.log('\n' + '='.repeat(80));
  console.log('PHASE 1: BTTS-BH BASE RATES BY LEAGUE');
  console.log('='.repeat(80));

  let allGames: GameCheckData[] = [];
  const leagueGameMap: Map<string, GameCheckData[]> = new Map();

  for (const ld of leagueData) {
    if (ld.matches.length === 0) continue;
    ld.matches.sort((a, b) => a.date.localeCompare(b.date));
    const games: GameCheckData[] = ld.matches.map((m, i) => computeGameChecks(m, ld.matches, i));
    const bhCount = games.filter(g => g.isBTTSBH).length;
    const rate = (bhCount / games.length) * 100;
    console.log(`\n  ${ld.name.padEnd(20)} ${ld.matches.length} games, ${bhCount} BTTS-BH (${rate.toFixed(2)}%)`);

    // Score distribution
    const byScore: Record<number, { t: number; bh: number }> = {};
    for (const g of games) {
      const s = g.checkResults.filter(c => c).length;
      if (!byScore[s]) byScore[s] = { t: 0, bh: 0 };
      byScore[s].t++; if (g.isBTTSBH) byScore[s].bh++;
    }
    for (const [s, d] of Object.entries(byScore).sort((a, b) => Number(b[0]) - Number(a[0]))) {
      console.log(`    Score ${s}: ${d.t} games, ${d.bh} BTTS-BH (${(d.bh/d.t*100).toFixed(1)}%)`);
    }

    allGames = allGames.concat(games);
    leagueGameMap.set(ld.league, games);
  }

  const totalAll = allGames.length;
  const bhAll = allGames.filter(g => g.isBTTSBH).length;
  const baseAll = (bhAll / totalAll) * 100;
  console.log(`\n  AGGREGATE: ${totalAll} games, ${bhAll} BTTS-BH (${baseAll.toFixed(2)}%)`);

  // === Phase 2: Individual threshold sweep ===
  console.log('\n' + '='.repeat(80));
  console.log('PHASE 2: INDIVIDUAL THRESHOLD SWEEP (ALL LEAGUES)');
  console.log('='.repeat(80));

  function printSweep(results: SweepResult[], minSample = 50) {
    for (const r of results) {
      if (r.sampleSize < minSample) continue;
      const dir = r.threshold === 'drawProbMax' ? '<' : '>=';
      console.log(`    ${r.threshold} ${dir} ${r.value}: ${r.sampleSize} games (${r.passRate.toFixed(1)}%), ${r.bttsBHCount} BTTS-BH (${r.bttsBHRate.toFixed(2)}%), lift ${r.lift.toFixed(2)}x, cov ${r.coverage.toFixed(1)}%`);
    }
  }

  console.log('\n  --- O2.5 Implied Probability ---');
  printSweep(sweepThreshold(allGames, 'o25ImpliedProb', 'o25Implied', [50, 55, 58, 60, 62, 63, 64, 65, 66, 67, 68, 70, 72, 75, 80], 'above', baseAll));

  console.log('\n  --- Rolling Combined Scoring ---');
  printSweep(sweepThreshold(allGames, 'rollingCombinedScoring', 'rollingScoring', [1.5, 2.0, 2.5, 2.8, 3.0, 3.2, 3.5, 4.0], 'above', baseAll));

  console.log('\n  --- O3.5 Rolling Rate ---');
  printSweep(sweepThreshold(allGames, 'o35Prob', 'o35Prob', [10, 15, 20, 25, 30, 35, 40, 45, 50], 'above', baseAll));

  console.log('\n  --- BTTS Rolling Rate ---');
  printSweep(sweepThreshold(allGames, 'bttsProb', 'bttsProb', [20, 25, 30, 35, 40, 45, 50, 55, 60], 'above', baseAll));

  console.log('\n  --- Draw Probability (INVERTED: below = better) ---');
  printSweep(sweepThreshold(allGames, 'drawProb', 'drawProbMax', [15, 18, 20, 22, 25, 27, 28, 30, 35], 'below', baseAll));

  console.log('\n  --- O2.5 Rolling Rate ---');
  printSweep(sweepThreshold(allGames, 'o25Prob', 'o25Prob', [30, 35, 40, 45, 50, 55, 60, 65], 'above', baseAll));

  // === Phase 3: Per-league O2.5 implied lift ===
  console.log('\n' + '='.repeat(80));
  console.log('PHASE 3: O2.5 IMPLIED LIFT BY LEAGUE');
  console.log('='.repeat(80));

  for (const ld of leagueData) {
    if (ld.matches.length === 0) continue;
    const games = leagueGameMap.get(ld.league)!;
    const localBH = games.filter(g => g.isBTTSBH).length;
    const localBase = (localBH / games.length) * 100;
    let line = `  ${ld.name.padEnd(20)} base=${localBase.toFixed(2)}% (${games.length} games)`;
    for (const t of [60, 65, 70, 75]) {
      const p = games.filter(g => g.o25ImpliedProb !== null && g.o25ImpliedProb >= t);
      const bh = p.filter(g => g.isBTTSBH).length;
      const rate = p.length > 0 ? (bh / p.length) * 100 : 0;
      const lift = localBase > 0 ? rate / localBase : 0;
      line += ` | ${t}%: ${lift.toFixed(2)}x (${p.length})`;
    }
    console.log(line);
  }

  // === Phase 4: Required checks sweep ===
  console.log('\n' + '='.repeat(80));
  console.log('PHASE 4: REQUIRED CHECKS SWEEP (current thresholds)');
  console.log('='.repeat(80));

  for (const req of [3, 4, 5, 6, 7, 8]) {
    const c = evalCombo(allGames, 65, 72, 55, 3.0, 35, 45, 25, 2.6, req, baseAll);
    console.log(`  Req=${req}: ${c.passing} pass (${(c.passing/c.totalGames*100).toFixed(1)}%), ${c.bttsBHAmongPassing} BTTS-BH (${c.bttsBHRate.toFixed(2)}%), lift ${c.lift.toFixed(2)}x, cov ${c.coverage.toFixed(1)}%, score ${c.score.toFixed(3)}`);
  }

  // === Phase 5: Grid search ===
  console.log('\n' + '='.repeat(80));
  console.log('PHASE 5: COMBO GRID SEARCH');
  console.log('='.repeat(80));

  let best: ComboResult | null = null;
  const topN: ComboResult[] = [];
  let iters = 0;

  const o25Vals = [58, 60, 62, 63, 64, 65, 66, 67, 68, 70];
  const eliteVals = [65, 68, 70, 72, 75, 78];
  const rollVals = [2.0, 2.5, 2.8, 3.0, 3.2, 3.5];
  const reqVals = [3, 4, 5, 6, 7];

  for (const o25 of o25Vals) {
    for (const elite of eliteVals) {
      if (elite <= o25) continue;
      for (const roll of rollVals) {
        for (const req of reqVals) {
          iters++;
          const c = evalCombo(allGames, o25, elite, 55, roll, 35, 45, 25, 2.6, req, baseAll);
          if (c.passing >= 50 && c.lift >= 1.2 && c.bttsBHRate >= 5) {
            topN.push(c);
            if (!best || c.score > best.score) best = c;
          }
        }
      }
    }
  }

  console.log(`\n  Searched ${iters} combinations, ${topN.length} viable`);

  topN.sort((a, b) => b.score - a.score);
  console.log('\n  --- TOP 15 COMBOS ---');
  console.log(`  ${'#'.padEnd(4)} ${'O2.5'.padEnd(5)} ${'Elite'.padEnd(6)} ${'Roll'.padEnd(6)} ${'Req'.padEnd(4)} ${'Pass'.padEnd(6)} ${'BH'.padEnd(5)} ${'Rate'.padEnd(8)} ${'Lift'.padEnd(6)} ${'Cov'.padEnd(6)} ${'Score'.padEnd(7)}`);

  for (let i = 0; i < Math.min(15, topN.length); i++) {
    const c = topN[i];
    console.log(`  ${(i+1).toString().padEnd(4)} ${c.thresholds.o25Implied.toString().padEnd(5)} ${c.thresholds.o25ImpliedElite.toString().padEnd(6)} ${c.thresholds.rollingScoring.toFixed(1).padEnd(6)} ${c.requiredChecks.toString().padEnd(4)} ${c.passing.toString().padEnd(6)} ${c.bttsBHAmongPassing.toString().padEnd(5)} ${c.bttsBHRate.toFixed(2)}%`.padEnd(8) + ` ${c.lift.toFixed(2)}x`.padEnd(6) + ` ${c.coverage.toFixed(1)}%`.padEnd(6) + ` ${c.score.toFixed(3)}`.padEnd(7));
  }

  // === Phase 6: League-by-league validation of best ===
  console.log('\n' + '='.repeat(80));
  console.log('PHASE 6: LEAGUE VALIDATION (best combo)');
  console.log('='.repeat(80));

  if (best) {
    const t = best.thresholds;
    const req = best.requiredChecks;
    console.log(`\n  Best: O2.5>=${t.o25Implied}%, Elite>=${t.o25ImpliedElite}%, Roll>=${t.rollingScoring}, Req=${req}`);
    console.log(`  Aggregate: ${best.passing} games, ${best.bttsBHAmongPassing} BTTS-BH (${best.bttsBHRate.toFixed(2)}%), lift ${best.lift.toFixed(2)}x`);
    console.log(`\n  ${'League'.padEnd(20)} ${'Total'.padEnd(6)} ${'Pass'.padEnd(6)} ${'BH'.padEnd(5)} ${'Rate'.padEnd(8)} ${'Lift'.padEnd(6)} ${'Base'.padEnd(7)}`);

    for (const ld of leagueData) {
      if (ld.matches.length === 0) continue;
      const games = leagueGameMap.get(ld.league)!;
      const localBH = games.filter(g => g.isBTTSBH).length;
      const localBase = (localBH / games.length) * 100;
      const passing = games.filter(g => {
        const checks = [
          g.o25ImpliedProb !== null && g.o25ImpliedProb >= t.o25Implied,
          g.o25ImpliedProb !== null && g.o25ImpliedProb >= t.o25ImpliedElite,
          g.o25Prob >= 55, g.rollingCombinedScoring >= t.rollingScoring,
          g.o35Prob >= 35, g.bttsProb >= 45, g.drawProb < 25, g.avgGoalsPerGame >= 2.6,
        ];
        return checks.filter(c => c).length >= req;
      });
      const bh = passing.filter(g => g.isBTTSBH).length;
      const rate = passing.length > 0 ? (bh / passing.length) * 100 : 0;
      const lift = localBase > 0 ? rate / localBase : 0;
      console.log(`  ${ld.name.padEnd(20)} ${games.length.toString().padEnd(6)} ${passing.length.toString().padEnd(6)} ${bh.toString().padEnd(5)} ${rate.toFixed(2)}%`.padEnd(8) + ` ${lift.toFixed(2)}x`.padEnd(6) + ` ${localBase.toFixed(2)}%`.padEnd(7));
    }

    // === Phase 7: Current vs Optimal ===
    console.log('\n' + '='.repeat(80));
    console.log('PHASE 7: CURRENT vs OPTIMAL');
    console.log('='.repeat(80));

    const cur = evalCombo(allGames, 65, 72, 55, 3.0, 35, 45, 25, 2.6, 5, baseAll);
    console.log(`\n  CURRENT (o25>=65%, elite>=72%, roll>=3.0, req=5):`);
    console.log(`    ${cur.passing} games (${(cur.passing/cur.totalGames*100).toFixed(1)}%), ${cur.bttsBHAmongPassing} BTTS-BH (${cur.bttsBHRate.toFixed(2)}%), lift ${cur.lift.toFixed(2)}x, cov ${cur.coverage.toFixed(1)}%`);

    console.log(`\n  OPTIMAL (o25>=${t.o25Implied}%, elite>=${t.o25ImpliedElite}%, roll>=${t.rollingScoring}, req=${req}):`);
    console.log(`    ${best.passing} games (${(best.passing/best.totalGames*100).toFixed(1)}%), ${best.bttsBHAmongPassing} BTTS-BH (${best.bttsBHRate.toFixed(2)}%), lift ${best.lift.toFixed(2)}x, cov ${best.coverage.toFixed(1)}%`);

    const rateDelta = best.bttsBHRate - cur.bttsBHRate;
    const liftDelta = best.lift - cur.lift;
    console.log(`\n  DELTA: Rate ${rateDelta >= 0 ? '+' : ''}${rateDelta.toFixed(2)}pp, Lift ${liftDelta >= 0 ? '+' : ''}${liftDelta.toFixed(2)}x, Cov ${best.coverage - cur.coverage >= 0 ? '+' : ''}${(best.coverage - cur.coverage).toFixed(1)}pp`);
  }

  // === Summary ===
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`  ${totalAll} games, ${bhAll} BTTS-BH (${baseAll.toFixed(2)}% base rate)`);

  if (best) {
    console.log(`  Best combo: O2.5>=${best.thresholds.o25Implied}%, Elite>=${best.thresholds.o25ImpliedElite}%, Roll>=${best.thresholds.rollingScoring}, Req=${best.requiredChecks}`);
    console.log(`  Hit rate: ${best.bttsBHRate.toFixed(2)}% (${best.lift.toFixed(2)}x lift), Coverage: ${best.coverage.toFixed(1)}%`);
  }

  // Per-league base rates
  console.log('\n  Per-league base rates:');
  for (const ld of leagueData) {
    if (ld.matches.length === 0) continue;
    const games = leagueGameMap.get(ld.league)!;
    const bh = games.filter(g => g.isBTTSBH).length;
    console.log(`    ${ld.name.padEnd(20)} ${(bh/games.length*100).toFixed(2)}% (${bh}/${games.length})`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('DONE');
  console.log('='.repeat(80));
}

main().catch(e => { console.error(e); process.exit(1); });
