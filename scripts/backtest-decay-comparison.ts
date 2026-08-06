/**
 * Decay Factor Comparison Backtest
 * Tests 3 decay factors: 0.65 (current), 0.50 (steep), 0.40 (very steep)
 * Same 2-season test window (2024-25 + 2025-26), 5 training seasons before
 */

import { fetchSeasonData } from '../src/lib/data-cache';
import { calculateLeagueAverages, generateBacktestPredictions } from '../src/lib/models/predictions';

const EUROPEAN_SEASONS = ['2526', '2425', '2324', '2223', '2122', '2021', '1920', '1819', '1718', '1617', '1516'];

const LEAGUES = [
  { code: 'E0', name: 'Premier League' },
  { code: 'E1', name: 'Championship' },
  { code: 'E2', name: 'League One' },
  { code: 'E3', name: 'League Two' },
  { code: 'EC', name: 'National League' },
  { code: 'SC0', name: 'Premiership' },
  { code: 'SC1', name: 'Scot Champ' },
  { code: 'D1', name: 'Bundesliga' },
  { code: 'D2', name: '2. Bundesliga' },
  { code: 'I1', name: 'Serie A' },
  { code: 'I2', name: 'Serie B' },
  { code: 'SP1', name: 'La Liga' },
  { code: 'SP2', name: 'La Liga 2' },
  { code: 'F1', name: 'Ligue 1' },
  { code: 'F2', name: 'Ligue 2' },
  { code: 'N1', name: 'Eredivisie' },
  { code: 'B1', name: 'Pro League' },
  { code: 'P1', name: 'Primeira Liga' },
  { code: 'T1', name: 'Süper Lig' },
  { code: 'G1', name: 'Super League' },
];

const TEST_SEASONS = ['2425', '2526'];
const DECAY_FACTORS = [0.65, 0.50, 0.40];

function makeSeasonWeights(seasons: string[], decay: number): Map<string, number> {
  const weights = new Map<string, number>();
  const sorted = [...seasons].sort();
  let w = 1.0, total = 0;
  for (const s of sorted) { weights.set(s, w); total += w; w *= decay; }
  for (const [s, v] of weights) weights.set(s, v / total);
  return weights;
}

function showWeights(seasons: string[], decay: number) {
  const sorted = [...seasons].sort();
  let w = 1.0, total = 0;
  const raw: { s: string; w: number }[] = [];
  for (const s of sorted) { raw.push({ s, w }); total += w; w *= decay; }
  console.log(`    Decay ${decay}: ${raw.map(r => `${r.s}=${(r.w/total*100).toFixed(1)}%`).join(', ')}`);
}

interface Metrics {
  n: number;
  o25Acc: number; o25Cal: number; o25Brier: number; o25ROI: number; o25Bets60: number; o25Win60: number;
  bttsAcc: number; bttsCal: number; bttsBrier: number; bttsROI: number; bttsBets60: number; bttsWin60: number;
  o35Cal: number;
  resultAcc: number; resultBrier: number;
}

function computeMetrics(records: { predicted: any; actual: any }[]): Metrics {
  const n = records.length;
  if (n === 0) return { n:0, o25Acc:0, o25Cal:0, o25Brier:0, o25ROI:0, o25Bets60:0, o25Win60:0, bttsAcc:0, bttsCal:0, bttsBrier:0, bttsROI:0, bttsBets60:0, bttsWin60:0, o35Cal:0, resultAcc:0, resultBrier:0 };

  let o25c=0, sumPO25=0, o25b=0;
  const cO25 = records.filter(r => r.predicted.over25 >= 60);
  const cO25w = cO25.filter(r => r.actual.over25).length;
  for (const r of records) {
    if ((r.predicted.over25 >= 50) === r.actual.over25) o25c++;
    sumPO25 += r.predicted.over25;
    o25b += (r.predicted.over25/100 - (r.actual.over25?1:0))**2;
  }
  o25b /= n;
  const aO25 = records.filter(r => r.actual.over25).length/n*100;

  let btc=0, sumPBtts=0, btb=0;
  const cBtts = records.filter(r => r.predicted.btts >= 60);
  const cBttsw = cBtts.filter(r => r.actual.btts).length;
  for (const r of records) {
    if ((r.predicted.btts >= 50) === r.actual.btts) btc++;
    sumPBtts += r.predicted.btts;
    btb += (r.predicted.btts/100 - (r.actual.btts?1:0))**2;
  }
  btb /= n;
  const aBtts = records.filter(r => r.actual.btts).length/n*100;

  let o35n=0, sumPO35=0;
  const aO35 = records.filter(r => r.actual.totalGoals > 3.5).length/n*100;
  for (const r of records) {
    const txg = r.predicted.totalXg;
    if (txg > 0) { const p0=Math.exp(-txg),p1=txg*p0,p2=(txg*txg/2)*p0,p3=(txg*txg*txg/6)*p0; sumPO35+=(1-p0-p1-p2-p3)*100; o35n++; }
  }
  const avgPO35 = o35n>0 ? sumPO35/n : 0;

  let rc=0, rb=0;
  for (const r of records) {
    const p = r.predicted.homeWin>r.predicted.draw&&r.predicted.homeWin>r.predicted.awayWin?'H':r.predicted.awayWin>r.predicted.draw?'A':'D';
    if (p===r.actual.result) rc++;
    rb += (r.predicted.homeWin/100-(r.actual.result==='H'?1:0))**2+(r.predicted.draw/100-(r.actual.result==='D'?1:0))**2+(r.predicted.awayWin/100-(r.actual.result==='A'?1:0))**2;
  }
  rb /= n;

  return {
    n,
    o25Acc: o25c/n*100, o25Cal: sumPO25>0?aO25/(sumPO25/n):1, o25Brier: o25b,
    o25ROI: cO25.length>0?((cO25w*1.85-cO25.length)/cO25.length*100):0,
    o25Bets60: cO25.length, o25Win60: cO25w,
    bttsAcc: btc/n*100, bttsCal: sumPBtts>0?aBtts/(sumPBtts/n):1, bttsBrier: btb,
    bttsROI: cBtts.length>0?((cBttsw*1.80-cBtts.length)/cBtts.length*100):0,
    bttsBets60: cBtts.length, bttsWin60: cBttsw,
    o35Cal: avgPO35>0?aO35/avgPO35:1,
    resultAcc: rc/n*100, resultBrier: rb,
  };
}

async function main() {
  const trainingSeasons = EUROPEAN_SEASONS.filter(s => s < TEST_SEASONS[0]).slice(-5);

  console.log('\n' + '='.repeat(110));
  console.log('DECAY FACTOR COMPARISON BACKTEST');
  console.log(`Test: ${TEST_SEASONS.join(' + ')} | Training: ${trainingSeasons.join(', ')} | 20 leagues`);
  console.log('='.repeat(110));

  // Show weight distributions
  console.log('\nWeight distributions (oldest → newest):');
  for (const d of DECAY_FACTORS) showWeights(trainingSeasons, d);

  // Results: decay -> league -> metrics
  const results = new Map<number, Map<string, Metrics>>();
  for (const d of DECAY_FACTORS) results.set(d, new Map());

  for (const lg of LEAGUES) {
    try {
      const trainingResults = await Promise.all(trainingSeasons.map(s => fetchSeasonData(lg.code, s)));
      const trainingData = trainingResults.flat();
      if (trainingData.length === 0) continue;
      const leagueAvgs = calculateLeagueAverages(trainingData);

      for (const decay of DECAY_FACTORS) {
        const seasonWeights = makeSeasonWeights(trainingSeasons, decay);
        const records: { predicted: any; actual: any }[] = [];

        for (const testSeason of TEST_SEASONS) {
          const testData = await fetchSeasonData(lg.code, testSeason);
          if (testData.length === 0) continue;
          for (const match of testData) {
            const h = trainingData.some(m => m.homeTeam===match.homeTeam||m.awayTeam===match.homeTeam);
            const a = trainingData.some(m => m.homeTeam===match.awayTeam||m.awayTeam===match.awayTeam);
            if (!h || !a) continue;
            const predicted = generateBacktestPredictions(trainingData, match.homeTeam, match.awayTeam, leagueAvgs, seasonWeights);
            records.push({ predicted, actual: {
              homeGoals: match.ftHomeGoals, awayGoals: match.ftAwayGoals, result: match.ftResult,
              totalGoals: match.ftHomeGoals+match.ftAwayGoals,
              btts: match.ftHomeGoals>0&&match.ftAwayGoals>0,
              over15: match.ftHomeGoals+match.ftAwayGoals>1.5,
              over25: match.ftHomeGoals+match.ftAwayGoals>2.5,
            }});
          }
        }

        if (records.length > 0) {
          results.get(decay)!.set(lg.code, computeMetrics(records));
        }
      }
      process.stdout.write('.');
    } catch (e: any) {
      process.stdout.write('x');
    }
  }
  console.log(' done!');

  // =======================================================================
  // COMPARISON TABLE: Global averages across all leagues
  // =======================================================================
  console.log('\n' + '═'.repeat(100));
  console.log('GLOBAL AVERAGES — Across all 20 leagues');
  console.log('═'.repeat(100));

  const gAvg = (decay: number, field: keyof Metrics) => {
    const map = results.get(decay)!;
    const vals = [...map.values()].map(m => m[field] as number).filter(v => !isNaN(v));
    return vals.length > 0 ? vals.reduce((a,b) => a+b, 0) / vals.length : 0;
  };
  const gTotal = (decay: number) => [...results.get(decay)!.values()].reduce((s,m) => s+m.n, 0);

  console.log(`\n${'Metric'.padEnd(22)} | ${'0.65 (current)'.padEnd(16)} | ${'0.50 (steep)'.padEnd(16)} | ${'0.40 (v.steep)'.padEnd(16)} | Best`);
  console.log('─'.repeat(100));

  const metrics: { label: string; key: keyof Metrics; lowerBetter?: boolean; suffix?: string }[] = [
    { label: 'Total Matches', key: 'n', suffix: '' },
    { label: 'O2.5 Accuracy', key: 'o25Acc', suffix: '%' },
    { label: 'O2.5 Brier', key: 'o25Brier', lowerBetter: true },
    { label: 'O2.5 Calibration', key: 'o25Cal' },
    { label: 'O2.5 ROI (≥60%)', key: 'o25ROI', suffix: '%' },
    { label: 'O2.5 Bets (≥60%)', key: 'o25Bets60' },
    { label: 'BTTS Accuracy', key: 'bttsAcc', suffix: '%' },
    { label: 'BTTS Brier', key: 'bttsBrier', lowerBetter: true },
    { label: 'BTTS Calibration', key: 'bttsCal' },
    { label: 'BTTS ROI (≥60%)', key: 'bttsROI', suffix: '%' },
    { label: 'O3.5 Calibration', key: 'o35Cal' },
    { label: '1X2 Accuracy', key: 'resultAcc', suffix: '%' },
    { label: '1X2 Brier', key: 'resultBrier', lowerBetter: true },
  ];

  for (const m of metrics) {
    const vals = DECAY_FACTORS.map(d => ({ decay: d, val: m.key === 'n' ? gTotal(d) : gAvg(d, m.key) }));
    const best = m.lowerBetter
      ? vals.reduce((a,b) => a.val < b.val ? a : b)
      : vals.reduce((a,b) => a.val > b.val ? a : b);
    const fmt = (v: number) => m.suffix ? v.toFixed(1) + m.suffix : v.toFixed(m.key==='n'?0:3);
    console.log(
      `${m.label.padEnd(22)} | ${fmt(vals[0].val).padEnd(16)} | ${fmt(vals[1].val).padEnd(16)} | ${fmt(vals[2].val).padEnd(16)} | ${best.decay} ${m.lowerBetter ? '↓' : '↑'}`
    );
  }

  // =======================================================================
  // PER-LEAGUE COMPARISON (top leagues)
  // =======================================================================
  console.log('\n' + '═'.repeat(110));
  console.log('PER-LEAGUE: O2.5 Accuracy | O2.5 Brier | O2.5 ROI | BTTS Accuracy | BTTS Brier | BTTS ROI');
  console.log('═'.repeat(110));

  for (const lg of LEAGUES) {
    const m65 = results.get(0.65)?.get(lg.code);
    const m50 = results.get(0.50)?.get(lg.code);
    const m40 = results.get(0.40)?.get(lg.code);
    if (!m65 || !m50 || !m40) continue;

    const o25Best = [m65,m50,m40].reduce((a,b) => a.o25Acc > b.o25Acc ? a : b);
    const bttsBest = [m65,m50,m40].reduce((a,b) => a.bttsAcc > b.bttsAcc ? a : b);

    console.log(
      `${lg.code.padEnd(5)} ${lg.name.padEnd(15)} | ` +
      `${(m65.o25Acc.toFixed(1)+'%').padEnd(7)} ${(m50.o25Acc.toFixed(1)+'%').padEnd(7)} ${(m40.o25Acc.toFixed(1)+'%').padEnd(7)} ${o25Best===m65?'0.65':o25Best===m50?'0.50':'0.40'} | ` +
      `${m65.o25Brier.toFixed(4).padEnd(8)} ${m50.o25Brier.toFixed(4).padEnd(8)} ${m40.o25Brier.toFixed(4).padEnd(8)} | ` +
      `${(m65.o25ROI>0?'+':'')+m65.o25ROI.toFixed(1).padEnd(7)} ${(m50.o25ROI>0?'+':'')+m50.o25ROI.toFixed(1).padEnd(7)} ${(m40.o25ROI>0?'+':'')+m40.o25ROI.toFixed(1).padEnd(7)} | ` +
      `${(m65.bttsAcc.toFixed(1)+'%').padEnd(7)} ${(m50.bttsAcc.toFixed(1)+'%').padEnd(7)} ${(m40.bttsAcc.toFixed(1)+'%').padEnd(7)} ${bttsBest===m65?'0.65':bttsBest===m50?'0.50':'0.40'}`
    );
  }

  // =======================================================================
  // WIN COUNT: How many leagues does each decay win?
  // =======================================================================
  console.log('\n' + '═'.repeat(70));
  console.log('WIN COUNT — How many leagues each decay factor wins');
  console.log('═'.repeat(70));

  const allLeagueCodes = LEAGUES.filter(lg => {
    return results.get(0.65)?.has(lg.code) && results.get(0.50)?.has(lg.code) && results.get(0.40)?.has(lg.code);
  }).map(lg => lg.code);

  const winCount = (key: keyof Metrics, lowerBetter: boolean) => {
    const wins = [0, 0, 0];
    for (const code of allLeagueCodes) {
      const vals = DECAY_FACTORS.map(d => results.get(d)!.get(code)![key] as number);
      const bestIdx = lowerBetter
        ? vals.indexOf(Math.min(...vals))
        : vals.indexOf(Math.max(...vals));
      wins[bestIdx]++;
    }
    return wins;
  };

  console.log(`\n${'Metric'.padEnd(25)} | ${'0.65'.padEnd(8)} | ${'0.50'.padEnd(8)} | ${'0.40'.padEnd(8)}`);
  console.log('─'.repeat(60));
  const comps = [
    ['O2.5 Accuracy', 'o25Acc', false],
    ['O2.5 Brier', 'o25Brier', true],
    ['O2.5 ROI', 'o25ROI', false],
    ['BTTS Accuracy', 'bttsAcc', false],
    ['BTTS Brier', 'bttsBrier', true],
    ['BTTS ROI', 'bttsROI', false],
    ['1X2 Accuracy', 'resultAcc', false],
    ['1X2 Brier', 'resultBrier', true],
  ] as [string, keyof Metrics, boolean][];

  for (const [label, key, lb] of comps) {
    const w = winCount(key, lb);
    const total = allLeagueCodes.length;
    console.log(`${label.padEnd(25)} | ${w[0]}/${total}`.padEnd(12) + ` | ${w[1]}/${total}`.padEnd(12) + ` | ${w[2]}/${total}`.padEnd(12));
  }

  // =======================================================================
  // VERDICT
  // =======================================================================
  console.log('\n' + '═'.repeat(70));
  console.log('VERDICT');
  console.log('═'.repeat(70));

  const o25Acc65 = gAvg(0.65, 'o25Acc'), o25Acc50 = gAvg(0.50, 'o25Acc'), o25Acc40 = gAvg(0.40, 'o25Acc');
  const bttsAcc65 = gAvg(0.65, 'bttsAcc'), bttsAcc50 = gAvg(0.50, 'bttsAcc'), bttsAcc40 = gAvg(0.40, 'bttsAcc');
  const o25Brier65 = gAvg(0.65, 'o25Brier'), o25Brier50 = gAvg(0.50, 'o25Brier'), o25Brier40 = gAvg(0.40, 'o25Brier');
  const bttsBrier65 = gAvg(0.65, 'bttsBrier'), bttsBrier50 = gAvg(0.50, 'bttsBrier'), bttsBrier40 = gAvg(0.40, 'bttsBrier');

  // Find overall best
  let bestDecay = 0.65;
  let bestScore = o25Acc65 + bttsAcc65 - o25Brier65*100 - bttsBrier65*100;
  for (const d of [0.50, 0.40]) {
    const score = gAvg(d, 'o25Acc') + gAvg(d, 'bttsAcc') - gAvg(d, 'o25Brier')*100 - gAvg(d, 'bttsBrier')*100;
    if (score > bestScore) { bestScore = score; bestDecay = d; }
  }

  console.log(`\n  Composite score (accuracy - brier*100):`);
  for (const d of DECAY_FACTORS) {
    const s = gAvg(d, 'o25Acc') + gAvg(d, 'bttsAcc') - gAvg(d, 'o25Brier')*100 - gAvg(d, 'bttsBrier')*100;
    const marker = d === bestDecay ? ' ← BEST' : '';
    console.log(`    Decay ${d}: ${s.toFixed(2)}${marker}`);
  }

  console.log(`\n  O2.5 Accuracy:  0.65=${o25Acc65.toFixed(1)}%  0.50=${o25Acc50.toFixed(1)}%  0.40=${o25Acc40.toFixed(1)}%`);
  console.log(`  BTTS Accuracy: 0.65=${bttsAcc65.toFixed(1)}%  0.50=${bttsAcc50.toFixed(1)}%  0.40=${bttsAcc40.toFixed(1)}%`);
  console.log(`  O2.5 Brier:    0.65=${o25Brier65.toFixed(4)}  0.50=${o25Brier50.toFixed(4)}  0.40=${o25Brier40.toFixed(4)}`);
  console.log(`  BTTS Brier:    0.65=${bttsBrier65.toFixed(4)}  0.50=${bttsBrier50.toFixed(4)}  0.40=${bttsBrier40.toFixed(4)}`);

  // Save
  const { writeFile } = await import('fs/promises');
  const out: any = {};
  for (const d of DECAY_FACTORS) {
    out[String(d)] = {};
    for (const [code, m] of results.get(d)!) out[String(d)][code] = m;
  }
  await writeFile('/home/z/my-project/download/decay-comparison-results.json', JSON.stringify(out, null, 2));
  console.log(`\n  Saved to /home/z/my-project/download/decay-comparison-results.json`);
}

main().catch(console.error);
