/**
 * BTTS Both Halves Detector — Multi-League Threshold Calibration Backtest
 * 
 * Fetches 5 top European leagues x 10 seasons from football-data.co.uk,
 * computes pre-match signals for every game, labels BTTS-BH outcomes,
 * then sweeps thresholds and grid-searches for optimal detector settings.
 */

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
  oddsAvgDraw: number | null;
  oddsAvgOver25: number | null;
  season: string;
  league: string;
}

interface GameSignals {
  o25ImpliedProb: number | null;
  rollingCombinedScoring: number;
  bttsProb: number;
  o25Prob: number;
  o35Prob: number;
  drawProb: number;
  htDrawProb: number;
  avgGoalsPerGame: number;
}

// ============================================================================
// CSV Parsing
// ============================================================================
function parseCSV(text: string, season: string, league: string): MatchResult[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  const col = (h: string) => headers.indexOf(h);
  const pn = (val: string | undefined): number | null => {
    if (!val || val === '' || val === '\\N/A') return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  };

  const results: MatchResult[] = [];
  for (let i = 1; i < lines.length; i++) {
    const v = lines[i].split(',');
    const ftH = parseInt(v[col('FTHG')] || '0', 10);
    const ftA = parseInt(v[col('FTAG')] || '0', 10);
    const htH = parseInt(v[col('HTHG')] || '0', 10);
    const htA = parseInt(v[col('HTAG')] || '0', 10);
    if (isNaN(ftH) || isNaN(ftA) || isNaN(htH) || isNaN(htA)) continue;
    results.push({
      date: v[col('Date')] || '',
      homeTeam: (v[col('HomeTeam')] || '').trim(),
      awayTeam: (v[col('AwayTeam')] || '').trim(),
      ftHomeGoals: ftH, ftAwayGoals: ftA,
      htHomeGoals: htH, htAwayGoals: htA,
      oddsAvgDraw: pn(v[col('AvgD')]),
      oddsAvgOver25: pn(v[col('Avg>2.5')]),
      season, league,
    });
  }
  return results;
}

// ============================================================================
// Data Fetching
// ============================================================================
async function fetchSeason(league: string, season: string): Promise<MatchResult[]> {
  const url = 'https://www.football-data.co.uk/mmz4281/' + season + '/' + league + '.csv';
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/csv' } });
    if (!resp.ok) return [];
    return parseCSV(await resp.text(), season, league);
  } catch { return []; }
}

// ============================================================================
// Pre-match signal computation (no lookahead bias)
// ============================================================================
function computeRollingScored(results: MatchResult[], team: string, isHome: boolean, beforeDate: string, window = 5): number {
  const relevant = results
    .filter(m => (isHome ? m.homeTeam === team : m.awayTeam === team) && m.date < beforeDate)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, window);
  if (relevant.length === 0) return 1.2;
  return relevant.reduce((s, m) => s + (isHome ? m.ftHomeGoals : m.ftAwayGoals), 0) / relevant.length;
}

function computeRollingBTTSRate(results: MatchResult[], team: string, beforeDate: string, window = 10): number {
  const relevant = results
    .filter(m => (m.homeTeam === team || m.awayTeam === team) && m.date < beforeDate)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, window);
  if (relevant.length < 3) return 0.45;
  return relevant.filter(m => m.ftHomeGoals > 0 && m.ftAwayGoals > 0).length / relevant.length;
}

function computeRollingRate(results: MatchResult[], beforeDate: string, window: number, predicate: (m: MatchResult) => boolean): number {
  const relevant = results
    .filter(m => m.date < beforeDate)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, window);
  if (relevant.length < 10) return 0.30;
  return relevant.filter(predicate).length / relevant.length;
}

function computeGameSignals(results: MatchResult[], match: MatchResult): GameSignals {
  const o25ImpliedProb = match.oddsAvgOver25 && match.oddsAvgOver25 > 1.01
    ? (1 / match.oddsAvgOver25) * 100 : null;

  const homeRolling = computeRollingScored(results, match.homeTeam, true, match.date, 5);
  const awayRolling = computeRollingScored(results, match.awayTeam, false, match.date, 5);

  const homeBTTS = computeRollingBTTSRate(results, match.homeTeam, match.date, 10);
  const awayBTTS = computeRollingBTTSRate(results, match.awayTeam, match.date, 10);

  const drawProb = match.oddsAvgDraw && match.oddsAvgDraw > 1.01
    ? Math.min(60, (1 / match.oddsAvgDraw) * 100) : 25;

  const last50 = results.filter(m => m.date < match.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50);
  const avgGoals = last50.length >= 10
    ? last50.reduce((s, m) => s + m.ftHomeGoals + m.ftAwayGoals, 0) / last50.length : 2.6;

  return {
    o25ImpliedProb,
    rollingCombinedScoring: homeRolling + awayRolling,
    bttsProb: ((homeBTTS + awayBTTS) / 2) * 100,
    o25Prob: computeRollingRate(results, match.date, 30, m => m.ftHomeGoals + m.ftAwayGoals > 2.5) * 100,
    o35Prob: computeRollingRate(results, match.date, 30, m => m.ftHomeGoals + m.ftAwayGoals > 3.5) * 100,
    drawProb,
    htDrawProb: drawProb * 0.92,
    avgGoalsPerGame: avgGoals,
  };
}

function isBTTSBothHalves(m: MatchResult): boolean {
  const shHome = m.ftHomeGoals - m.htHomeGoals;
  const shAway = m.ftAwayGoals - m.htAwayGoals;
  return (m.htHomeGoals > 0 && m.htAwayGoals > 0) && (shHome > 0 && shAway > 0);
}

// ============================================================================
// Threshold Sweep
// ============================================================================
interface SweepResult { threshold: number; triggered: number; bttsBHHit: number; hitRate: number; coverage: number; lift: number; }

function sweepThreshold(games: { signals: GameSignals; isBH: boolean }[], getValue: (s: GameSignals) => number | null, min: number, max: number, step: number): SweepResult[] {
  const baseRate = games.filter(g => g.isBH).length / games.length;
  const results: SweepResult[] = [];
  for (let t = min; t <= max; t += step) {
    const triggered = games.filter(g => { const v = getValue(g.signals); return v !== null && v >= t; });
    const bhHits = triggered.filter(g => g.isBH).length;
    results.push({
      threshold: Math.round(t * 10) / 10, triggered: triggered.length, bttsBHHit: bhHits,
      hitRate: triggered.length > 0 ? bhHits / triggered.length : 0,
      coverage: triggered.length / games.length,
      lift: baseRate > 0 ? (triggered.length > 0 ? (bhHits / triggered.length) / baseRate : 0) : 0,
    });
  }
  return results;
}

// ============================================================================
// Formatting helper (avoids nested template literal issues)
// ============================================================================
function fmtRow(r: SweepResult, pct: boolean): string {
  const c1 = (pct ? (r.threshold + '%') : String(r.threshold)).padEnd(8);
  const c2 = String(r.triggered).padEnd(10);
  const c3 = String(r.bttsBHHit).padEnd(8);
  const c4 = ((r.hitRate * 100).toFixed(2) + '%').padEnd(8);
  const c5 = ((r.coverage * 100).toFixed(1) + '%').padEnd(9);
  const c6 = (r.lift.toFixed(2) + 'x').padEnd(6);
  return [c1, c2, c3, c4, c5, c6].join(' | ');
}

function fmtRow1(r: SweepResult, pct: boolean): string {
  const c1 = (pct ? (r.threshold + '%') : String(r.threshold)).padEnd(8);
  const c2 = String(r.triggered).padEnd(10);
  const c3 = String(r.bttsBHHit).padEnd(8);
  const c4 = ((r.hitRate * 100).toFixed(1) + '%').padEnd(8);
  const c5 = ((r.coverage * 100).toFixed(1) + '%').padEnd(9);
  const c6 = (r.lift.toFixed(1) + 'x').padEnd(6);
  return [c1, c2, c3, c4, c5, c6].join(' | ');
}

// ============================================================================
// Multi-Check Combo Test
// ============================================================================
interface ComboResult { requiredChecks: number; totalTriggered: number; bttsBHHits: number; hitRate: number; coverage: number; lift: number; }

function testCombo(games: { signals: GameSignals; isBH: boolean }[], t: {
  o25Implied: number; o25ImpliedElite: number; rollingScoring: number;
  o35Prob: number; bttsProb: number; o25Prob: number;
  drawLower: number; drawUpper: number; htDraw: number; leagueAvg: number;
}, requiredChecks: number): ComboResult {
  const baseRate = games.filter(g => g.isBH).length / games.length;
  let totalTriggered = 0, bttsBHHits = 0;
  for (const g of games) {
    const s = g.signals;
    let score = 0;
    if (s.o25ImpliedProb !== null && s.o25ImpliedProb >= t.o25Implied) score++;
    if (s.o35Prob >= t.o35Prob) score++;
    if (s.bttsProb >= t.bttsProb) score++;
    if (s.o25Prob >= t.o25Prob) score++;
    if (s.rollingCombinedScoring >= t.rollingScoring) score++;
    if (s.drawProb >= t.drawLower && s.drawProb <= t.drawUpper) score++;
    if (s.htDrawProb >= t.htDraw) score++;
    if (s.avgGoalsPerGame >= t.leagueAvg) score++;
    if (s.bttsProb >= t.bttsProb && s.rollingCombinedScoring >= t.rollingScoring) score++;
    if (s.o25ImpliedProb !== null && s.o25ImpliedProb >= t.o25ImpliedElite) score++;
    if (score >= requiredChecks) { totalTriggered++; if (g.isBH) bttsBHHits++; }
  }
  const hitRate = totalTriggered > 0 ? bttsBHHits / totalTriggered : 0;
  return { requiredChecks, totalTriggered, bttsBHHits, hitRate, coverage: totalTriggered / games.length, lift: baseRate > 0 ? hitRate / baseRate : 0 };
}

// ============================================================================
// Grid search
// ============================================================================
function gridSearch(games: { signals: GameSignals; isBH: boolean }[], label: string): void {
  console.log('\n' + '='.repeat(90));
  console.log('GRID SEARCH: ' + label);
  console.log('='.repeat(90));
  const baseRate = games.filter(g => g.isBH).length / games.length;
  console.log('Base BTTS-BH rate: ' + (baseRate * 100).toFixed(1) + '% (' + games.filter(g => g.isBH).length + '/' + games.length + ')');

  const fixed = { o35Prob: 38, bttsProb: 50, o25Prob: 60, drawLower: 20, drawUpper: 40, htDraw: 25, leagueAvg: 2.7 };
  let bestLift = 0, bestCombo = '';

  const header = 'Implied | Rolling | Req | Triggered | BH | HitRate | Cover | Lift';
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const imp of [55, 58, 60, 62, 65, 67, 70]) {
    for (const roll of [2.5, 2.8, 3.0, 3.2, 3.5]) {
      for (const req of [5, 6, 7, 8]) {
        const r = testCombo(games, { ...fixed, o25Implied: imp, o25ImpliedElite: Math.max(imp + 5, 70), rollingScoring: roll }, req);
        if (r.coverage > 0.005 && r.lift > 1.5 && r.totalTriggered >= 5) {
          const c1 = (imp + '%').padEnd(8);
          const c2 = String(roll).padEnd(8);
          const c3 = String(req).padEnd(4);
          const c4 = String(r.totalTriggered).padEnd(10);
          const c5 = String(r.bttsBHHits).padEnd(3);
          const c6 = ((r.hitRate * 100).toFixed(1) + '%').padEnd(8);
          const c7 = ((r.coverage * 100).toFixed(1) + '%').padEnd(7);
          const c8 = (r.lift.toFixed(1) + 'x').padEnd(6);
          console.log([c1, c2, c3, c4, c5, c6, c7, c8].join(' | '));
          if (r.lift > bestLift && r.totalTriggered >= 10) {
            bestLift = r.lift;
            bestCombo = 'Implied>=' + imp + '%, Rolling>=' + roll + ', Req=' + req + ': ' + (r.hitRate * 100).toFixed(1) + '% hit, ' + r.lift.toFixed(1) + 'x lift (' + r.totalTriggered + ' triggered, ' + r.bttsBHHits + ' hits)';
          }
        }
      }
    }
  }
  console.log('\n>>> BEST: ' + bestCombo);
}

// ============================================================================
// Per-league analysis
// ============================================================================
function perLeagueSweep(games: { signals: GameSignals; isBH: boolean; league: string }[], name: string, code: string): void {
  const lg = games.filter(g => g.league === code);
  if (lg.length < 200) { console.log('\nSkipping ' + name + ' — only ' + lg.length + ' games'); return; }

  console.log('\n' + '#'.repeat(80));
  console.log('LEAGUE: ' + name + ' (' + lg.length + ' games)');
  console.log('#'.repeat(80));
  const bhCount = lg.filter(g => g.isBH).length;
  console.log('BTTS-BH: ' + bhCount + '/' + lg.length + ' (' + (bhCount / lg.length * 100).toFixed(1) + '%)');

  console.log('\n--- O2.5 Implied ---');
  const is_ = sweepThreshold(lg, s => s.o25ImpliedProb, 45, 80, 1);
  console.log('Thresh   | Triggered | BH_Hits | HitRate | Coverage  | Lift');
  for (const r of is_.filter(r => r.triggered >= 5)) console.log(fmtRow1(r, true));

  console.log('\n--- Rolling Scoring ---');
  const rs_ = sweepThreshold(lg, s => s.rollingCombinedScoring, 1.5, 4.5, 0.1);
  console.log('Thresh   | Triggered | BH_Hits | HitRate | Coverage  | Lift');
  for (const r of rs_.filter(r => r.triggered >= 5)) console.log(fmtRow1(r, false));

  console.log('\n--- Draw Prob ---');
  const ds_ = sweepThreshold(lg, s => s.drawProb, 15, 45, 1);
  console.log('Thresh   | Triggered | BH_Hits | HitRate | Coverage  | Lift');
  for (const r of ds_.filter(r => r.triggered >= 5)) console.log(fmtRow1(r, true));

  gridSearch(lg, name);
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  const LEAGUES = [
    { code: 'E0', name: 'Premier League' },
    { code: 'SP1', name: 'La Liga' },
    { code: 'I1', name: 'Serie A' },
    { code: 'D1', name: 'Bundesliga' },
    { code: 'F1', name: 'Ligue 1' },
  ];
  const SEASONS = ['2425', '2324', '2223', '2122', '2021', '1920', '1819', '1718', '1617', '1516'];

  // 1. Fetch
  console.log('=== Fetching 5 leagues x 10 seasons ===');
  const allResults: MatchResult[] = [];
  for (const league of LEAGUES) {
    console.log('\n--- ' + league.name + ' (' + league.code + ') ---');
    for (const season of SEASONS) {
      const data = await fetchSeason(league.code, season);
      allResults.push(...data);
      console.log('  ' + season + ': ' + data.length + ' matches');
      await new Promise(r => setTimeout(r, 500));
    }
  }
  console.log('\nTotal matches: ' + allResults.length);

  // Sort per league
  const byLeague = new Map<string, MatchResult[]>();
  for (const m of allResults) { const lg = byLeague.get(m.league) || []; lg.push(m); byLeague.set(m.league, lg); }
  for (const [, matches] of byLeague) matches.sort((a, b) => a.date.localeCompare(b.date));

  // 2. Compute signals & label
  console.log('\n=== Computing signals ===');
  type LG = { signals: GameSignals; isBH: boolean; league: string };
  const labeled: LG[] = [];
  for (const [league, leagueResults] of byLeague) {
    for (const match of leagueResults) {
      labeled.push({ signals: computeGameSignals(leagueResults, match), isBH: isBTTSBothHalves(match), league });
    }
  }
  const totalBH = labeled.filter(g => g.isBH).length;
  console.log('Total: ' + labeled.length + ', BTTS-BH: ' + totalBH + ' (' + (totalBH / labeled.length * 100).toFixed(2) + '%)');

  // 3. Overall sweeps
  console.log('\n' + '='.repeat(80));
  console.log('OVERALL SIGNAL SWEEPS');
  console.log('='.repeat(80));

  console.log('\n--- O2.5 Implied Probability ---');
  const impliedSweep = sweepThreshold(labeled, s => s.o25ImpliedProb, 45, 80, 1);
  console.log('Thresh   | Triggered | BH_Hits | HitRate | Coverage  | Lift');
  for (const r of impliedSweep) { if (r.triggered >= 10) console.log(fmtRow(r, true)); }

  console.log('\n--- Rolling Combined Scoring ---');
  const rollingSweep = sweepThreshold(labeled, s => s.rollingCombinedScoring, 1.5, 4.5, 0.1);
  console.log('Thresh   | Triggered | BH_Hits | HitRate | Coverage  | Lift');
  for (const r of rollingSweep) { if (r.triggered >= 10) console.log(fmtRow(r, false)); }

  console.log('\n--- Draw Probability ---');
  const drawSweep = sweepThreshold(labeled, s => s.drawProb, 15, 45, 1);
  console.log('Thresh   | Triggered | BH_Hits | HitRate | Coverage  | Lift');
  for (const r of drawSweep) { if (r.triggered >= 10) console.log(fmtRow(r, true)); }

  console.log('\n--- BTTS Rolling Rate ---');
  const bttsSweep = sweepThreshold(labeled, s => s.bttsProb, 20, 80, 2);
  console.log('Thresh   | Triggered | BH_Hits | HitRate | Coverage  | Lift');
  for (const r of bttsSweep) { if (r.triggered >= 10) console.log(fmtRow(r, true)); }

  console.log('\n--- O3.5 Rolling Rate ---');
  const o35Sweep = sweepThreshold(labeled, s => s.o35Prob, 15, 60, 2);
  console.log('Thresh   | Triggered | BH_Hits | HitRate | Coverage  | Lift');
  for (const r of o35Sweep) { if (r.triggered >= 10) console.log(fmtRow(r, true)); }

  // 4. Overall grid search
  gridSearch(labeled, 'ALL LEAGUES');

  // 5. Per-league
  for (const league of LEAGUES) perLeagueSweep(labeled, league.name, league.code);

  // 6. Test current defaults
  console.log('\n' + '='.repeat(80));
  console.log('CURRENT DEFAULTS TEST');
  console.log('='.repeat(80));
  const currentDefaults = { o25Implied: 65, o25ImpliedElite: 70, rollingScoring: 3.0, o35Prob: 38, bttsProb: 50, o25Prob: 60, drawLower: 20, drawUpper: 40, htDraw: 25, leagueAvg: 2.7 };
  console.log('\nCurrent defaults at Req = 5,6,7,8:');
  for (const req of [5, 6, 7, 8]) {
    const r = testCombo(labeled, currentDefaults, req);
    console.log('  Req=' + req + ': ' + r.totalTriggered + ' triggered, ' + r.bttsBHHits + ' BH, ' + (r.hitRate * 100).toFixed(2) + '% hit, ' + (r.coverage * 100).toFixed(1) + '% coverage, ' + r.lift.toFixed(2) + 'x lift');
  }

  // 7. Find best overall combo
  console.log('\n' + '='.repeat(80));
  console.log('CALIBRATION SUMMARY');
  console.log('='.repeat(80));

  const bestImplied = impliedSweep.filter(r => r.coverage >= 0.05).sort((a, b) => b.lift - a.lift)[0];
  const bestRolling = rollingSweep.filter(r => r.coverage >= 0.10).sort((a, b) => b.lift - a.lift)[0];
  const bestDraw = drawSweep.filter(r => r.coverage >= 0.10).sort((a, b) => b.lift - a.lift)[0];

  console.log('\nBest O2.5 Implied: ' + bestImplied?.threshold + '% (lift: ' + bestImplied?.lift.toFixed(2) + 'x, coverage: ' + (bestImplied?.coverage * 100).toFixed(1) + '%)');
  console.log('Best Rolling Scoring: ' + bestRolling?.threshold + ' (lift: ' + bestRolling?.lift.toFixed(2) + 'x, coverage: ' + (bestRolling?.coverage * 100).toFixed(1) + '%)');
  console.log('Best Draw Prob start: ' + bestDraw?.threshold + '% (lift: ' + bestDraw?.lift.toFixed(2) + 'x, coverage: ' + (bestDraw?.coverage * 100).toFixed(1) + '%)');

  let bestOverallLift = 0;
  let bestOverallResult: ComboResult | null = null;
  let bestOverallParams = '';

  for (const imp of [55, 58, 60, 62, 65, 67, 70]) {
    for (const roll of [2.5, 2.8, 3.0, 3.2, 3.5]) {
      for (const req of [4, 5, 6, 7, 8]) {
        for (const o35 of [30, 35, 38, 42]) {
          for (const dL of [16, 18, 20, 22]) {
            for (const dU of [38, 40, 42, 45]) {
              const r = testCombo(labeled, {
                o25Implied: imp, o25ImpliedElite: Math.max(imp + 5, 70),
                rollingScoring: roll, o35Prob: o35, bttsProb: 48, o25Prob: 58,
                drawLower: dL, drawUpper: dU, htDraw: 23, leagueAvg: 2.6,
              }, req);
              if (r.totalTriggered >= 20 && r.lift > bestOverallLift) {
                bestOverallLift = r.lift;
                bestOverallResult = r;
                bestOverallParams = 'Implied>=' + imp + '%, Elite>=' + Math.max(imp + 5, 70) + '%, Rolling>=' + roll + ', O35>=' + o35 + '%, BTTS>=48%, O25>=58%, Draw ' + dL + '-' + dU + '%, HTDraw>=23%, LeagueAvg>=2.6, Req=' + req;
              }
            }
          }
        }
      }
    }
  }

  if (bestOverallResult) {
    console.log('\n>>> BEST OVERALL COMBO <<<');
    console.log('Params: ' + bestOverallParams);
    console.log('Result: ' + bestOverallResult.totalTriggered + ' triggered, ' + bestOverallResult.bttsBHHits + ' BH hits, ' + (bestOverallResult.hitRate * 100).toFixed(2) + '% hit rate, ' + (bestOverallResult.coverage * 100).toFixed(1) + '% coverage, ' + bestOverallResult.lift.toFixed(2) + 'x lift');
  }

  console.log('\n=== CALIBRATION COMPLETE ===');
}

main().catch(console.error);
