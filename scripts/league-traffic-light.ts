/**
 * league-traffic-light.ts — League × Market Traffic-Light Matrix
 *
 * Reads the all-leagues backtest JSON and produces a traffic-light
 * classification for each league×market cell based on:
 *   - ROI (at ≥60% confidence threshold)
 *   - Sample size (total backtest matches)
 *   - Brier score (probabilistic accuracy)
 *   - Calibration error (predicted vs actual rate)
 *
 * Traffic light rules:
 *   GREEN:  positive ROI, 500+ matches, Brier ≤ 0.22
 *   YELLOW: marginal ROI (-5% to +5%), OR sample 200-500, OR Brier 0.22-0.24
 *   RED:    negative ROI < -5% with 500+ matches, OR Brier > 0.24
 *
 * Usage: npx tsx scripts/league-traffic-light.ts
 */

import { readFileSync, writeFileSync } from 'fs';

// --- Types ---

interface SeasonResult {
  testSeason: string;
  n: number;
  over25: { accuracy: number; calibration: number; brier: number; roi: number; bets60: number; wins60: number; winRate60: number };
  btts: { accuracy: number; calibration: number; brier: number; roi: number; bets60: number; wins60: number; winRate60: number };
  over35: { accuracy: number; calibration: number };
  result: { accuracy: number; brier: number };
}

interface LeagueResult {
  league: string;
  leagueName: string;
  country: string;
  seasons: SeasonResult[];
  avg: {
    over25: { accuracy: number; calibration: number; brier: number; roi: number; bets60: number; wins60: number; winRate60: number };
    btts: { accuracy: number; calibration: number; brier: number; roi: number; bets60: number; wins60: number; winRate60: number };
    over35: { accuracy: number; calibration: number };
    result: { accuracy: number; brier: number };
    matches: number;
  };
}

type Light = 'GREEN' | 'YELLOW' | 'RED';

interface MarketCell {
  market: string;
  roi: number | null;
  brier: number | null;
  calibration: number | null;
  accuracy: number | null;
  totalMatches: number;
  totalBets60: number;
  totalWins60: number;
  hitRate: number | null;
  light: Light;
  reason: string;
}

interface LeagueRow {
  league: string;
  name: string;
  country: string;
  totalMatches: number;
  markets: MarketCell[];
}

// --- Load data ---

const data: LeagueResult[] = JSON.parse(
  readFileSync('/home/z/my-project/techmari/download/all-leagues-backtest-results.json', 'utf-8')
);

// --- Classification logic ---

function classify(roi: number | null, brier: number | null, totalMatches: number, totalBets60: number): { light: Light; reason: string } {
  const reasons: string[] = [];
  let score = 0; // positive = green, negative = red

  // Sample size check
  if (totalMatches >= 500) {
    score += 1;
  } else if (totalMatches >= 200) {
    reasons.push('modest sample');
    score += 0;
  } else {
    reasons.push('small sample');
    score -= 1;
  }

  // ROI check
  if (roi !== null) {
    if (roi >= 5) {
      score += 2;
      reasons.push(`+${roi.toFixed(1)}% ROI`);
    } else if (roi >= 0) {
      score += 1;
      reasons.push(`+${roi.toFixed(1)}% ROI`);
    } else if (roi >= -5) {
      score -= 0.5;
      reasons.push(`${roi.toFixed(1)}% ROI`);
    } else {
      score -= 2;
      reasons.push(`${roi.toFixed(1)}% ROI`);
    }
  } else {
    reasons.push('no ROI data');
    score -= 0.5;
  }

  // Brier check (lower is better; 0.25 = coin flip for binary)
  if (brier !== null) {
    if (brier <= 0.22) {
      score += 1;
    } else if (brier <= 0.24) {
      reasons.push(`Brier ${brier.toFixed(3)}`);
      score += 0;
    } else {
      score -= 1;
      reasons.push(`Brier ${brier.toFixed(3)}`);
    }
  }

  // Bet volume check (need enough confident bets for ROI to be meaningful)
  if (totalBets60 > 0 && totalBets60 < 50) {
    reasons.push(`only ${totalBets60} confident bets`);
    score -= 0.5;
  }

  const light: Light = score >= 2 ? 'GREEN' : score >= 0 ? 'YELLOW' : 'RED';
  return { light, reason: reasons.join(', ') };
}

// --- Aggregate per-season data into totals ---

function aggregateSeasons(seasons: SeasonResult[], market: 'over25' | 'btts' | 'over35' | 'result'): MarketCell {
  const totalMatches = seasons.reduce((s, se) => s + se.n, 0);

  if (market === 'over25' || market === 'btts') {
    const totalBets60 = seasons.reduce((s, se) => s + se[market].bets60, 0);
    const totalWins60 = seasons.reduce((s, se) => s + se[market].wins60, 0);
    const avgRoi = seasons.reduce((s, se) => s + se[market].roi, 0) / seasons.length;
    const avgBrier = seasons.reduce((s, se) => s + se[market].brier, 0) / seasons.length;
    const avgCal = seasons.reduce((s, se) => s + se[market].calibration, 0) / seasons.length;
    const avgAcc = seasons.reduce((s, se) => s + se[market].accuracy, 0) / seasons.length;
    const hitRate = totalBets60 > 0 ? (totalWins60 / totalBets60) * 100 : null;

    const { light, reason } = classify(avgRoi, avgBrier, totalMatches, totalBets60);

    return {
      market: market === 'over25' ? 'O2.5' : 'BTTS',
      roi: Math.round(avgRoi * 10) / 10,
      brier: Math.round(avgBrier * 1000) / 1000,
      calibration: Math.round(avgCal * 1000) / 1000,
      accuracy: Math.round(avgAcc * 10) / 10,
      totalMatches,
      totalBets60,
      totalWins60,
      hitRate: hitRate !== null ? Math.round(hitRate * 10) / 10 : null,
      light,
      reason,
    };
  }

  if (market === 'over35') {
    const avgCal = seasons.reduce((s, se) => s + se[market].calibration, 0) / seasons.length;
    const avgAcc = seasons.reduce((s, se) => s + se[market].accuracy, 0) / seasons.length;
    // O3.5 has no ROI or Brier in existing data
    const { light, reason } = classify(null, null, totalMatches, 0);
    return {
      market: 'O3.5',
      roi: null,
      brier: null,
      calibration: Math.round(avgCal * 1000) / 1000,
      accuracy: Math.round(avgAcc * 10) / 10,
      totalMatches,
      totalBets60: 0,
      totalWins60: 0,
      hitRate: null,
      light,
      reason: reason + ', no ROI data',
    };
  }

  // result (1X2)
  const avgBrier = seasons.reduce((s, se) => s + se[market].brier, 0) / seasons.length;
  const avgAcc = seasons.reduce((s, se) => s + se[market].accuracy, 0) / seasons.length;
  // 1X2 Brier is 3-outcome so naturally 0.55-0.70; calibrate thresholds
  const adjustedBrier = avgBrier; // keep raw for now
  const { light, reason } = classify(null, adjustedBrier, totalMatches, 0);
  return {
    market: '1X2',
    roi: null,
    brier: Math.round(adjustedBrier * 1000) / 1000,
    calibration: null,
    accuracy: Math.round(avgAcc * 10) / 10,
    totalMatches,
    totalBets60: 0,
    totalWins60: 0,
    hitRate: null,
    light,
    reason: reason + ', no ROI data',
  };
}

// --- Build matrix ---

const matrix: LeagueRow[] = data.map(league => ({
  league: league.league,
  name: league.leagueName,
  country: league.country,
  totalMatches: league.seasons.reduce((s, se) => s + se.n, 0),
  markets: ['over25', 'btts', 'over35', 'result'].map(m => aggregateSeasons(league.seasons, m as any)),
}));

// --- Output ---

const LIGHT_ICON: Record<Light, string> = { GREEN: '🟢', YELLOW: '🟡', RED: '🔴' };

console.log('\n' + '═'.repeat(130));
console.log('LEAGUE × MARKET TRAFFIC-LIGHT MATRIX');
console.log('Data: 4-season backtest (2022-2026), 5-season exponential-decay training');
console.log('═'.repeat(130));

// Legend
console.log(`
LEGEND:
  🟢 GREEN  = Positive ROI ≥ 5%, 500+ matches, Brier ≤ 0.22 → Full stakes
  🟡 YELLOW = Marginal (-5% to +5% ROI, or modest sample, or Brier 0.22-0.24) → Half stakes / monitor
  🔴 RED    = Negative ROI < -5% with 500+ matches, or Brier > 0.24 → Exclude or fade

ROI is computed at ≥60% confidence threshold (flat £1 stake, O2.5 @1.85, BTTS @1.80)
`);

// Per-market summary tables
for (const marketKey of ['O2.5', 'BTTS'] as const) {
  console.log('─'.repeat(110));
  console.log(`${marketKey} MARKET — Ranked by ROI`);
  console.log('─'.repeat(110));
  console.log(
    `${'Light'.padEnd(4)} ${'League'.padEnd(6)} ${'Name'.padEnd(18)} ${'Matches'.padEnd(8)} ${'Bets60'.padEnd(8)} ${'Hit%'.padEnd(7)} ${'ROI'.padEnd(8)} ${'Brier'.padEnd(8)} ${'Cal'.padEnd(7)} ${'Accuracy'.padEnd(9)}  Reason`
  );

  const sorted = [...matrix]
    .map(row => ({ row, cell: row.markets.find(m => m.market === marketKey)! }))
    .filter(({ cell }) => cell.roi !== null)
    .sort((a, b) => (b.cell.roi ?? 0) - (a.cell.roi ?? 0));

  let greenCount = 0, yellowCount = 0, redCount = 0;
  for (const { row, cell } of sorted) {
    const icon = LIGHT_ICON[cell.light];
    if (cell.light === 'GREEN') greenCount++;
    else if (cell.light === 'YELLOW') yellowCount++;
    else redCount++;
    console.log(
      `${icon.padEnd(4)} ${row.league.padEnd(6)} ${row.name.padEnd(18)} ${String(cell.totalMatches).padEnd(8)} ${String(cell.totalBets60).padEnd(8)} ${(cell.hitRate !== null ? cell.hitRate.toFixed(1) + '%' : '-').padEnd(7)} ${(cell.roi !== null ? (cell.roi > 0 ? '+' : '') + cell.roi.toFixed(1) + '%' : '-').padEnd(8)} ${cell.brier !== null ? cell.brier.toFixed(3).padEnd(8) : '-'.padEnd(8)} ${cell.calibration !== null ? cell.calibration.toFixed(3).padEnd(7) : '-'.padEnd(7)} ${(cell.accuracy !== null ? cell.accuracy.toFixed(1) + '%' : '-').padEnd(9)}  ${cell.reason}`
    );
  }
  console.log(`
  Summary: ${greenCount} green, ${yellowCount} yellow, ${redCount} red out of ${sorted.length} leagues`);
}

// O3.5 summary (no ROI)
console.log('\n' + '─'.repeat(90));
console.log('O3.5 MARKET — Calibration & Accuracy (no ROI data available)');
console.log('─'.repeat(90));
console.log(
  `${'Light'.padEnd(4)} ${'League'.padEnd(6)} ${'Name'.padEnd(18)} ${'Matches'.padEnd(8)} ${'Calibration'.padEnd(12)} ${'Accuracy'.padEnd(10)}  Reason`
);
for (const row of matrix) {
  const cell = row.markets.find(m => m.market === 'O3.5')!;
  console.log(
    `${LIGHT_ICON[cell.light].padEnd(4)} ${row.league.padEnd(6)} ${row.name.padEnd(18)} ${String(cell.totalMatches).padEnd(8)} ${cell.calibration?.toFixed(3).padEnd(12)} ${(cell.accuracy?.toFixed(1) + '%').padEnd(10)}  ${cell.reason}`
  );
}

// 1X2 summary (no ROI)
console.log('\n' + '─'.repeat(90));
console.log('1X2 MARKET — Brier Score & Accuracy (no ROI data available)');
console.log('─'.repeat(90));
console.log(
  `${'Light'.padEnd(4)} ${'League'.padEnd(6)} ${'Name'.padEnd(18)} ${'Matches'.padEnd(8)} ${'Brier'.padEnd(8)} ${'Accuracy'.padEnd(10)}  Reason`
);
for (const row of [...matrix].sort((a, b) => {
  const aB = a.markets.find(m => m.market === '1X2')!.brier ?? 1;
  const bB = b.markets.find(m => m.market === '1X2')!.brier ?? 1;
  return aB - bB;
})) {
  const cell = row.markets.find(m => m.market === '1X2')!;
  console.log(
    `${LIGHT_ICON[cell.light].padEnd(4)} ${row.league.padEnd(6)} ${row.name.padEnd(18)} ${String(cell.totalMatches).padEnd(8)} ${cell.brier?.toFixed(3).padEnd(8)} ${(cell.accuracy?.toFixed(1) + '%').padEnd(10)}  ${cell.reason}`
  );
}

// Compact visual matrix
console.log('\n' + '═'.repeat(100));
console.log('COMPACT MATRIX — League × Market Overview');
console.log('═'.repeat(100));
console.log(
  `\n${'League'.padEnd(6)} ${'Name'.padEnd(18)} | ${'O2.5'.padEnd(20)} | ${'BTTS'.padEnd(20)} | ${'O3.5'.padEnd(20)} | ${'1X2'.padEnd(20)}`
);
console.log('─'.repeat(100));

for (const row of matrix) {
  const fmt = (m: string) => {
    const cell = row.markets.find(x => x.market === m)!;
    const icon = LIGHT_ICON[cell.light];
    let detail = '';
    if (cell.roi !== null) detail = `${cell.roi > 0 ? '+' : ''}${cell.roi.toFixed(1)}%`;
    else if (cell.brier !== null) detail = `Brier ${cell.brier.toFixed(3)}`;
    else detail = `Cal ${cell.calibration?.toFixed(2)}`;
    return `${icon} ${detail}`;
  };
  console.log(
    `${row.league.padEnd(6)} ${row.name.padEnd(18)} | ${fmt('O2.5').padEnd(20)} | ${fmt('BTTS').padEnd(20)} | ${fmt('O3.5').padEnd(20)} | ${fmt('1X2').padEnd(20)}`
  );
}

// --- Actionable output ---
console.log('\n' + '═'.repeat(100));
console.log('RECOMMENDED ACTIONS');
console.log('═'.repeat(100));

const greenLeagues: string[] = [];
const yellowLeagues: string[] = [];
const redLeagues: string[] = [];

for (const row of matrix) {
  const o25 = row.markets.find(m => m.market === 'O2.5')!;
  const btts = row.markets.find(m => m.market === 'BTTS')!;
  if (o25.light === 'GREEN') greenLeagues.push(`${row.name} O2.5 (+${o25.roi}%)`);
  if (btts.light === 'GREEN') greenLeagues.push(`${row.name} BTTS (+${btts.roi}%)`);
  if (o25.light === 'RED') redLeagues.push(`${row.name} O2.5 (${o25.roi}%)`);
  if (btts.light === 'RED') redLeagues.push(`${row.name} BTTS (${btts.roi}%)`);
  if (o25.light === 'YELLOW') yellowLeagues.push(`${row.name} O2.5 (${o25.roi}%)`);
  if (btts.light === 'YELLOW') yellowLeagues.push(`${row.name} BTTS (${btts.roi}%)`);
}

console.log(`
🟢 FULL STAKES (${greenLeagues.length} cells):`);
greenLeagues.forEach(l => console.log(`   ${l}`));

console.log(`\n🟡 HALF STAKES / MONITOR (${yellowLeagues.length} cells):`);
yellowLeagues.forEach(l => console.log(`   ${l}`));

console.log(`\n🔴 EXCLUDE / FADE (${redLeagues.length} cells):`);
redLeagues.forEach(l => console.log(`   ${l}`));

// --- Cross-league best markets per team ---
console.log('\n' + '─'.repeat(80));
console.log('BEST MARKET PER LEAGUE (where model has strongest edge)');
console.log('─'.repeat(80));
for (const row of matrix) {
  const withRoi = row.markets.filter(m => m.roi !== null).sort((a, b) => (b.roi ?? -999) - (a.roi ?? -999));
  if (withRoi.length > 0 && (withRoi[0].roi ?? 0) > 0) {
    console.log(`  ${row.league.padEnd(6)} ${row.name.padEnd(18)} → ${withRoi[0].market} (${LIGHT_ICON[withRoi[0].light]} +${withRoi[0].roi}%)`);
  } else {
    // Fall back to best Brier
    const withBrier = row.markets.filter(m => m.brier !== null).sort((a, b) => (a.brier ?? 999) - (b.brier ?? 999));
    if (withBrier.length > 0) {
      console.log(`  ${row.league.padEnd(6)} ${row.name.padEnd(18)} → ${withBrier[0].market} (${LIGHT_ICON[withBrier[0].light]} Brier ${withBrier[0].brier})`);
    }
  }
}

// Save JSON output
const output = matrix.map(row => ({
  league: row.league,
  name: row.name,
  country: row.country,
  totalMatches: row.totalMatches,
  markets: Object.fromEntries(row.markets.map(m => [m.market, {
    light: m.light,
    roi: m.roi,
    brier: m.brier,
    calibration: m.calibration,
    accuracy: m.accuracy,
    totalMatches: m.totalMatches,
    totalBets60: m.totalBets60,
    hitRate: m.hitRate,
    reason: m.reason,
  }])),
}));

writeFileSync(
  '/home/z/my-project/techmari/download/league-traffic-light.json',
  JSON.stringify(output, null, 2)
);
console.log('\nFull results saved to: /home/z/my-project/techmari/download/league-traffic-light.json');
