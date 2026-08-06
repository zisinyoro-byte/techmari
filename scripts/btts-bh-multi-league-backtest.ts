/**
 * BTTS Both Halves Detector — Multi-League Threshold Calibration Backtest
 * 
 * Fetches 5 top European leagues x 10 seasons from football-data.co.uk,
 * computes pre-match signals for every game, labels BTTS-BH outcomes,
 * then sweeps thresholds and grid-searches for optimal detector settings.
 *
 * Matches the CURRENT 8-check system in BTTS_BOTH_HALVES_CONFIG:
 *   1. O2.5 Implied >= o25Implied (CRITICAL)
 *   2. O2.5 Implied >= o25ImpliedElite (CRITICAL)
 *   3. O2.5 Model >= o25Prob (HIGH)
 *   4. Rolling Scoring >= rollingScoring (HIGH)
 *   5. O3.5 Rate >= o35Prob (MEDIUM)
 *   6. BTTS Rate >= bttsProb (MEDIUM)
 *   7. Draw Prob < drawProbMax (MEDIUM) — INVERTED
 *   8. League Avg Goals >= leagueAvgGoals (LOW)
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
// Formatting helper
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

// ============================================================================
// 8-Check Combo Test (matches current BTTS_BOTH_HALVES_CONFIG)
// ============================================================================
interface ComboResult {
  requiredChecks: number;
  totalTriggered: number;
  bttsBHHits: number;
  hitRate: number;
  coverage: number;
  lift: number;
  // Per-tier breakdown
  strong: number; qualified: number; borderline: number; unlikely: number;
  strongBH: number; qualifiedBH: number; borderlineBH: number;
}

function testCombo8(
  games: { signals: GameSignals; isBH: boolean }[],
  t: {
    o25Implied: number;
    o25ImpliedElite: number;
    rollingScoring: number;
    o35Prob: number;
    bttsProb: number;
    o25Prob: number;
    drawProbMax: number;
    leagueAvgGoals: number;
  },
  requiredChecks: number
): ComboResult {
  const baseRate = games.filter(g => g.isBH).length / games.length;
  let totalTriggered = 0, bttsBHHits = 0;
  let strong = 0, qualified = 0, borderline = 0, unlikely = 0;
  let strongBH = 0, qualifiedBH = 0, borderlineBH = 0;

  for (const g of games) {
    const s = g.signals;
    let score = 0;
    // Check 1: O2.5 Implied >= threshold (CRITICAL)
    if (s.o25ImpliedProb !== null && s.o25ImpliedProb >= t.o25Implied) score++;
    // Check 2: O2.5 Implied elite (CRITICAL)
    if (s.o25ImpliedProb !== null && s.o25ImpliedProb >= t.o25ImpliedElite) score++;
    // Check 3: O2.5 Model prob (HIGH)
    if (s.o25Prob >= t.o25Prob) score++;
    // Check 4: Rolling combined scoring (HIGH)
    if (s.rollingCombinedScoring >= t.rollingScoring) score++;
    // Check 5: O3.5 rolling rate (MEDIUM)
    if (s.o35Prob >= t.o35Prob) score++;
    // Check 6: BTTS rolling rate (MEDIUM)
    if (s.bttsProb >= t.bttsProb) score++;
    // Check 7: Draw prob INVERTED — below max (MEDIUM)
    if (s.drawProb < t.drawProbMax) score++;
    // Check 8: League avg goals (LOW)
    if (s.avgGoalsPerGame >= t.leagueAvgGoals) score++;

    // Tier classification (matching current code)
    if (score >= 7) strong++;
    else if (score >= 5) qualified++;
    else if (score >= 3) borderline++;
    else unlikely++;

    if (score >= requiredChecks) {
      totalTriggered++;
      if (g.isBH) bttsBHHits++;
    }
    if (score >= 7 && g.isBH) strongBH++;
    if (score >= 5 && score < 7 && g.isBH) qualifiedBH++;
    if (score >= 3 && score < 5 && g.isBH) borderlineBH++;
  }

  const hitRate = totalTriggered > 0 ? bttsBHHits / totalTriggered : 0;
  return {
    requiredChecks, totalTriggered, bttsBHHits, hitRate,
    coverage: totalTriggered / games.length,
    lift: baseRate > 0 ? hitRate / baseRate : 0,
    strong, qualified, borderline, unlikely,
    strongBH, qualifiedBH, borderlineBH,
  };
}

// ============================================================================
// Grid search (8-check system)
// ============================================================================
function gridSearch(games: { signals: GameSignals; isBH: boolean }[], label: string): void {
  console.log('\n' + '='.repeat(90));
  console.log('GRID SEARCH: ' + label);
  console.log('='.repeat(90));
  const baseRate = games.filter(g => g.isBH).length / games.length;
  const bhCount = games.filter(g => g.isBH).length;
  console.log('Base BTTS-BH rate: ' + (baseRate * 100).toFixed(2) + '% (' + bhCount + '/' + games.length + ')');

  const header = 'Implied | Elite | Roll | O35 | BTTS | O25 | DrawMax | LgAvg | Req | Triggered | BH | HitRate | Cover | Lift';
  console.log(header);
  console.log('-'.repeat(header.length));

  let bestLift = 0, bestCombo = '';
  let bestBalanced = 0, bestBalancedCombo = '';

  for (const imp of [60, 62, 64, 65, 66, 68, 70]) {
    for (const elite of [imp + 4, imp + 5, imp + 7, 72, 75]) {
      for (const roll of [2.5, 2.8, 3.0, 3.2, 3.5]) {
        for (const req of [4, 5, 6, 7, 8]) {
          const r = testCombo8(games, {
            o25Implied: imp, o25ImpliedElite: elite,
            rollingScoring: roll, o35Prob: 35, bttsProb: 45, o25Prob: 55,
            drawProbMax: 25, leagueAvgGoals: 2.6,
          }, req);
          if (r.coverage > 0.005 && r.lift > 1.3 && r.totalTriggered >= 10) {
            const c1 = (imp + '%').padEnd(7);
            const c2 = (elite + '%').padEnd(6);
            const c3 = String(roll).padEnd(5);
            const c4 = '35%'.padEnd(5);
            const c5 = '45%'.padEnd(6);
            const c6 = '55%'.padEnd(5);
            const c7 = '25%'.padEnd(8);
            const c8 = '2.6'.padEnd(6);
            const c9 = String(req).padEnd(4);
            const c10 = String(r.totalTriggered).padEnd(10);
            const c11 = String(r.bttsBHHits).padEnd(3);
            const c12 = ((r.hitRate * 100).toFixed(1) + '%').padEnd(8);
            const c13 = ((r.coverage * 100).toFixed(1) + '%').padEnd(7);
            const c14 = (r.lift.toFixed(2) + 'x').padEnd(6);
            console.log([c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14].join(' | '));
            if (r.lift > bestLift && r.totalTriggered >= 15) {
              bestLift = r.lift;
              bestCombo = 'Imp>=' + imp + '%, Elite>=' + elite + '%, Roll>=' + roll + ', Req=' + req + ': ' + (r.hitRate * 100).toFixed(1) + '% hit, ' + r.lift.toFixed(2) + 'x lift (' + r.totalTriggered + ' trig, ' + r.bttsBHHits + ' hits)';
            }
            // Balanced: best lift * coverage product (practical utility)
            const balance = r.lift * r.coverage;
            if (balance > bestBalanced && r.totalTriggered >= 20) {
              bestBalanced = balance;
              bestBalancedCombo = 'Imp>=' + imp + '%, Elite>=' + elite + '%, Roll>=' + roll + ', Req=' + req + ': ' + (r.hitRate * 100).toFixed(1) + '% hit, ' + r.lift.toFixed(2) + 'x lift, ' + (r.coverage * 100).toFixed(1) + '% cov (' + r.totalTriggered + ' trig)';
            }
          }
        }
      }
    }
  }
  console.log('\n>>> BEST LIFT: ' + bestCombo);
  console.log('>>> BEST BALANCED (lift x coverage): ' + bestBalancedCombo);
}

// ============================================================================
// Per-league analysis
// ============================================================================
function perLeagueAnalysis(games: { signals: GameSignals; isBH: boolean; league: string }[], name: string, code: string): void {
  const lg = games.filter(g => g.league === code);
  if (lg.length < 200) { console.log('\nSkipping ' + name + ' — only ' + lg.length + ' games'); return; }

  console.log('\n' + '#'.repeat(80));
  console.log('LEAGUE: ' + name + ' (' + lg.length + ' games)');
  console.log('#'.repeat(80));
  const bhCount = lg.filter(g => g.isBH).length;
  const baseRate = bhCount / lg.length;
  console.log('BTTS-BH: ' + bhCount + '/' + lg.length + ' (' + (baseRate * 100).toFixed(2) + '%)');

  // Individual signal sweeps
  console.log('\n--- O2.5 Implied Probability ---');
  const is_ = sweepThreshold(lg, s => s.o25ImpliedProb, 50, 80, 1);
  console.log('Thresh   | Triggered | BH_Hits | HitRate | Coverage  | Lift');
  for (const r of is_.filter(r => r.triggered >= 5)) {
    console.log(fmtRow(r, true));
  }

  console.log('\n--- Rolling Combined Scoring ---');
  const rs_ = sweepThreshold(lg, s => s.rollingCombinedScoring, 1.5, 4.5, 0.1);
  console.log('Thresh   | Triggered | BH_Hits | HitRate | Coverage  | Lift');
  for (const r of rs_.filter(r => r.triggered >= 5 && r.threshold >= 2.0 && r.threshold <= 4.0)) {
    console.log(fmtRow(r, false));
  }

  console.log('\n--- Draw Probability (INVERTED: below = good) ---');
  const ds_ = sweepThreshold(lg, s => 100 - s.drawProb, 50, 85, 1);
  console.log('(Showing 100 - drawProb, i.e. NOT-draw probability)');
  console.log('Thresh   | Triggered | BH_Hits | HitRate | Coverage  | Lift');
  for (const r of ds_.filter(r => r.triggered >= 5)) {
    console.log(fmtRow(r, true));
  }

  // Test current config on this league
  console.log('\n--- Current Config (Imp>=65%, Elite>=72%, Roll>=3.0, O35>=35%, BTTS>=45%, O25>=55%, Draw<25%, LgAvg>=2.6) ---');
  for (const req of [3, 4, 5, 6, 7, 8]) {
    const r = testCombo8(lg, {
      o25Implied: 65, o25ImpliedElite: 72, rollingScoring: 3.0,
      o35Prob: 35, bttsProb: 45, o25Prob: 55, drawProbMax: 25, leagueAvgGoals: 2.6,
    }, req);
    const tierInfo = r.totalTriggered > 0
      ? ' [S:' + r.strongBH + '/' + r.strong + ' Q:' + r.qualifiedBH + '/' + r.qualified + ' B:' + r.borderlineBH + '/' + r.borderline + ']'
      : '';
    console.log('  Req=' + req + ': ' + r.totalTriggered + ' triggered, ' + r.bttsBHHits + ' BH, ' + (r.hitRate * 100).toFixed(2) + '% hit, ' + (r.coverage * 100).toFixed(1) + '% cov, ' + r.lift.toFixed(2) + 'x lift' + tierInfo);
  }

  // Mini grid search per league
  console.log('\n--- Per-League Grid Search (top 5 by lift, min 5 triggered) ---');
  const results: { params: string; r: ComboResult }[] = [];
  for (const imp of [60, 63, 65, 68, 70]) {
    for (const roll of [2.5, 3.0, 3.5]) {
      for (const req of [4, 5, 6, 7]) {
        const r = testCombo8(lg, {
          o25Implied: imp, o25ImpliedElite: Math.max(imp + 5, 72),
          rollingScoring: roll, o35Prob: 35, bttsProb: 45, o25Prob: 55,
          drawProbMax: 25, leagueAvgGoals: 2.6,
        }, req);
        if (r.totalTriggered >= 5) {
          results.push({
            params: 'Imp>=' + imp + '%, Roll>=' + roll + ', Req=' + req,
            r,
          });
        }
      }
    }
  }
  results.sort((a, b) => b.r.lift - a.r.lift);
  for (const { params, r } of results.slice(0, 5)) {
    console.log('  ' + params + ': ' + r.totalTriggered + ' trig, ' + r.bttsBHHits + ' BH, ' + (r.hitRate * 100).toFixed(1) + '%, ' + r.lift.toFixed(2) + 'x lift, ' + (r.coverage * 100).toFixed(1) + '% cov');
  }
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
      await new Promise(r => setTimeout(r, 400));
    }
  }
  console.log('\nTotal matches fetched: ' + allResults.length);

  // Sort per league (needed for rolling computations)
  const byLeague = new Map<string, MatchResult[]>();
  for (const m of allResults) { const lg = byLeague.get(m.league) || []; lg.push(m); byLeague.set(m.league, lg); }
  for (const [, matches] of byLeague) matches.sort((a, b) => a.date.localeCompare(b.date));

  // 2. Compute signals & label
  console.log('\n=== Computing signals for every game ===');
  type LabeledGame = { signals: GameSignals; isBH: boolean; league: string };
  const labeled: LabeledGame[] = [];
  for (const [league, leagueResults] of byLeague) {
    for (const match of leagueResults) {
      labeled.push({ signals: computeGameSignals(leagueResults, match), isBH: isBTTSBothHalves(match), league });
    }
  }
  const totalBH = labeled.filter(g => g.isBH).length;
  console.log('Total: ' + labeled.length + ' games, BTTS-BH: ' + totalBH + ' (' + (totalBH / labeled.length * 100).toFixed(2) + '%)');

  // BTTS-BH distribution by score
  console.log('\n--- BTTS-BH Score Distribution ---');
  const bhGames = labeled.filter(g => g.isBH);
  const scoreDist: Record<string, number> = {};
  for (const g of bhGames) {
    // We need the actual match — re-derive from league data
    const lgMatches = byLeague.get(g.league)!;
    const idx = labeled.indexOf(g);
    // Find the match
  }
  // Simpler: compute from allResults
  const bhScores: Record<string, number> = {};
  for (const m of allResults) {
    if (isBTTSBothHalves(m)) {
      const key = m.ftHomeGoals + '-' + m.ftAwayGoals;
      bhScores[key] = (bhScores[key] || 0) + 1;
    }
  }
  const sortedScores = Object.entries(bhScores).sort((a, b) => b[1] - a[1]);
  console.log('Top 15 BTTS-BH scorelines:');
  for (const [score, count] of sortedScores.slice(0, 15)) {
    console.log('  ' + score + ': ' + count + ' (' + (count / totalBH * 100).toFixed(1) + '%)');
  }

  // 3. Overall individual signal sweeps
  console.log('\n' + '='.repeat(80));
  console.log('OVERALL SIGNAL SWEEPS (all leagues)');
  console.log('='.repeat(80));

  console.log('\n--- O2.5 Implied Probability ---');
  const impliedSweep = sweepThreshold(labeled, s => s.o25ImpliedProb, 50, 80, 1);
  console.log('Thresh   | Triggered | BH_Hits | HitRate | Coverage  | Lift');
  for (const r of impliedSweep) { if (r.triggered >= 10) console.log(fmtRow(r, true)); }

  console.log('\n--- Rolling Combined Scoring ---');
  const rollingSweep = sweepThreshold(labeled, s => s.rollingCombinedScoring, 1.5, 4.5, 0.1);
  console.log('Thresh   | Triggered | BH_Hits | HitRate | Coverage  | Lift');
  for (const r of rollingSweep) { if (r.triggered >= 10) console.log(fmtRow(r, false)); }

  console.log('\n--- BTTS Rolling Rate ---');
  const bttsSweep = sweepThreshold(labeled, s => s.bttsProb, 20, 80, 2);
  console.log('Thresh   | Triggered | BH_Hits | HitRate | Coverage  | Lift');
  for (const r of bttsSweep) { if (r.triggered >= 10) console.log(fmtRow(r, true)); }

  console.log('\n--- O3.5 Rolling Rate ---');
  const o35Sweep = sweepThreshold(labeled, s => s.o35Prob, 15, 60, 2);
  console.log('Thresh   | Triggered | BH_Hits | HitRate | Coverage  | Lift');
  for (const r of o35Sweep) { if (r.triggered >= 10) console.log(fmtRow(r, true)); }

  console.log('\n--- O2.5 Rolling Rate ---');
  const o25Sweep = sweepThreshold(labeled, s => s.o25Prob, 30, 80, 2);
  console.log('Thresh   | Triggered | BH_Hits | HitRate | Coverage  | Lift');
  for (const r of o25Sweep) { if (r.triggered >= 10) console.log(fmtRow(r, true)); }

  console.log('\n--- Draw Probability (INVERTED: 100 - drawProb) ---');
  const drawSweep = sweepThreshold(labeled, s => 100 - s.drawProb, 50, 85, 1);
  console.log('Thresh   | Triggered | BH_Hits | HitRate | Coverage  | Lift');
  for (const r of drawSweep) { if (r.triggered >= 10) console.log(fmtRow(r, true)); }

  // 4. Test CURRENT CONFIG (matching BTTS_BOTH_HALVES_CONFIG in code)
  console.log('\n' + '='.repeat(80));
  console.log('CURRENT CONFIG TEST (8-check system)');
  console.log('Config: Imp>=65%, Elite>=72%, Roll>=3.0, O35>=35%, BTTS>=45%, O25>=55%, Draw<25%, LgAvg>=2.6');
  console.log('='.repeat(80));
  const currentConfig = {
    o25Implied: 65, o25ImpliedElite: 72, rollingScoring: 3.0,
    o35Prob: 35, bttsProb: 45, o25Prob: 55, drawProbMax: 25, leagueAvgGoals: 2.6,
  };
  console.log('\nCurrent config at each required-checks level:');
  for (const req of [3, 4, 5, 6, 7, 8]) {
    const r = testCombo8(labeled, currentConfig, req);
    const tierInfo = '  Tiers → S:' + r.strong + ' (BH:' + r.strongBH + ') Q:' + r.qualified + ' (BH:' + r.qualifiedBH + ') B:' + r.borderline + ' (BH:' + r.borderlineBH + ') U:' + r.unlikely;
    console.log('  Req=' + req + ': ' + r.totalTriggered + ' triggered, ' + r.bttsBHHits + ' BH, ' + (r.hitRate * 100).toFixed(2) + '% hit, ' + (r.coverage * 100).toFixed(1) + '% cov, ' + r.lift.toFixed(2) + 'x lift');
    console.log(tierInfo);
  }

  // Per-tier hit rates (using current tier boundaries)
  console.log('\n--- Per-Tier Hit Rates (current tier boundaries) ---');
  const tiers = testCombo8(labeled, currentConfig, 0); // req=0 to get all tier counts
  const tierData = [
    { name: 'STRONG (7-8)', count: tiers.strong, bh: tiers.strongBH },
    { name: 'QUALIFIED (5-6)', count: tiers.qualified, bh: tiers.qualifiedBH },
    { name: 'BORDERLINE (3-4)', count: tiers.borderline, bh: tiers.borderlineBH },
  ];
  for (const t of tierData) {
    const rate = t.count > 0 ? (t.bh / t.count * 100).toFixed(2) : 'N/A';
    console.log('  ' + t.name + ': ' + t.count + ' games, ' + t.bh + ' BH (' + rate + '%)');
  }

  // 5. Grid search
  gridSearch(labeled, 'ALL LEAGUES COMBINED');

  // 6. Per-league analysis
  for (const league of LEAGUES) perLeagueAnalysis(labeled, league.name, league.code);

  // 7. Cross-validation: Season-by-season consistency
  console.log('\n' + '='.repeat(80));
  console.log('SEASON-BY-SEASON CONSISTENCY CHECK');
  console.log('='.repeat(80));
  for (const season of SEASONS) {
    const sg = labeled.filter(g => {
      // Find match result to get season
      const lgMatches = byLeague.get(g.league)!;
      const idx = labeled.indexOf(g);
      return false; // Can't easily get season from labeled, skip
    });
  }
  // Simpler: use allResults
  console.log('\nSeason-by-season BTTS-BH rates and detector performance (Req=5):');
  console.log('Season | Games | BH | BH%  | Triggered | BH | Hit%  | Lift');
  console.log('-'.repeat(70));
  for (const season of SEASONS) {
    const seasonMatches = allResults.filter(m => m.season === season);
    if (seasonMatches.length === 0) continue;
    const seasonBH = seasonMatches.filter(m => isBTTSBothHalves(m)).length;
    const seasonBase = seasonBH / seasonMatches.length;

    // Compute signals for this season's games using that league's data
    const seasonLabeled: { signals: GameSignals; isBH: boolean }[] = [];
    for (const league of LEAGUES) {
      const lgData = byLeague.get(league.code);
      if (!lgData) continue;
      const lgSeason = lgData.filter(m => m.season === season);
      for (const match of lgSeason) {
        seasonLabeled.push({
          signals: computeGameSignals(lgData, match),
          isBH: isBTTSBothHalves(match),
        });
      }
    }
    if (seasonLabeled.length === 0) continue;
    const r = testCombo8(seasonLabeled, currentConfig, 5);
    const s1 = season.padEnd(6);
    const s2 = String(seasonMatches.length).padEnd(6);
    const s3 = String(seasonBH).padEnd(3);
    const s4 = (seasonBase * 100).toFixed(1) + '%'.padEnd(5);
    const s5 = String(r.totalTriggered).padEnd(10);
    const s6 = String(r.bttsBHHits).padEnd(3);
    const s7 = (r.hitRate * 100).toFixed(1) + '%'.padEnd(5);
    const s8 = (r.lift.toFixed(2) + 'x').padEnd(6);
    console.log(s1 + ' | ' + s2 + ' | ' + s3 + ' | ' + s4 + ' | ' + s5 + ' | ' + s6 + ' | ' + s7 + ' | ' + s8);
  }

  // 8. FINAL SUMMARY
  console.log('\n' + '='.repeat(80));
  console.log('CALIBRATION SUMMARY & RECOMMENDATIONS');
  console.log('='.repeat(80));

  const bestImplied = impliedSweep.filter(r => r.coverage >= 0.05 && r.triggered >= 20).sort((a, b) => b.lift - a.lift)[0];
  const bestRolling = rollingSweep.filter(r => r.coverage >= 0.10 && r.triggered >= 20).sort((a, b) => b.lift - a.lift)[0];

  console.log('\n1. BEST INDIVIDUAL SIGNALS:');
  console.log('   O2.5 Implied: ' + bestImplied?.threshold + '% (lift: ' + bestImplied?.lift.toFixed(2) + 'x, coverage: ' + ((bestImplied?.coverage || 0) * 100).toFixed(1) + '%)');
  console.log('   Rolling Scoring: ' + bestRolling?.threshold + ' (lift: ' + bestRolling?.lift.toFixed(2) + 'x, coverage: ' + ((bestRolling?.coverage || 0) * 100).toFixed(1) + '%)');

  // Test if lowering drawProbMax helps
  console.log('\n2. DRAW PROB MAX SWEEP:');
  for (const dpm of [20, 22, 25, 28, 30, 35]) {
    const r = testCombo8(labeled, { ...currentConfig, drawProbMax: dpm }, 5);
    console.log('   drawProbMax=' + dpm + '%: ' + r.totalTriggered + ' trig, ' + (r.hitRate * 100).toFixed(2) + '% hit, ' + r.lift.toFixed(2) + 'x lift');
  }

  // Test if lowering bttsProb helps
  console.log('\n3. BTTS PROB FLOOR SWEEP:');
  for (const bp of [35, 40, 45, 50, 55]) {
    const r = testCombo8(labeled, { ...currentConfig, bttsProb: bp }, 5);
    console.log('   bttsProb>=' + bp + '%: ' + r.totalTriggered + ' trig, ' + (r.hitRate * 100).toFixed(2) + '% hit, ' + r.lift.toFixed(2) + 'x lift');
  }

  // Test o25Prob floor
  console.log('\n4. O2.5 MODEL PROB FLOOR SWEEP:');
  for (const op of [45, 50, 55, 60, 65]) {
    const r = testCombo8(labeled, { ...currentConfig, o25Prob: op }, 5);
    console.log('   o25Prob>=' + op + '%: ' + r.totalTriggered + ' trig, ' + (r.hitRate * 100).toFixed(2) + '% hit, ' + r.lift.toFixed(2) + 'x lift');
  }

  console.log('\n=== CALIBRATION COMPLETE ===');
}

main().catch(console.error);
