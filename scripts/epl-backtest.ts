/**
 * Standalone EPL backtest script — bypasses Next.js dev server.
 * Runs the backtest model directly using core functions.
 */

import { fetchSeasonData } from '../src/lib/data-cache';
import { calculateSeasonWeights } from '../src/lib/models/season-weighting';
import { calculateLeagueAverages, generateBacktestPredictions } from '../src/lib/models/predictions';

const EUROPEAN_SEASONS = ['2526', '2425', '2324', '2223', '2122', '2021', '1920', '1819', '1718', '1617', '1516'];

interface Prediction {
  homeWin: number; draw: number; awayWin: number;
  over15: number; over25: number; btts: number;
  totalXg: number;
}

interface Actual {
  homeGoals: number; awayGoals: number;
  result: 'H' | 'D' | 'A'; totalGoals: number;
  btts: boolean; over15: boolean; over25: boolean;
}

interface Record {
  predicted: Prediction;
  actual: Actual;
}

async function runBacktest(testSeason: string) {
  const league = 'E0';
  const training = EUROPEAN_SEASONS.filter(s => s < testSeason).slice(-5);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`EPL Backtest: test=${testSeason}, train=[${training.join(', ')}]`);
  console.log(`${'='.repeat(60)}`);

  // Fetch data
  console.log('Fetching training data...');
  const trainingResults = await Promise.all(training.map(s => fetchSeasonData(league, s)));
  const trainingData = trainingResults.flat();
  console.log(`  Training: ${trainingData.length} matches`);

  console.log('Fetching test data...');
  const testData = await fetchSeasonData(league, testSeason);
  console.log(`  Test: ${testData.length} matches`);

  if (testData.length === 0) { console.log('  No test data!'); return; }

  const seasonWeights = calculateSeasonWeights(training);
  const leagueAvgs = calculateLeagueAverages(trainingData);

  console.log(`  League avgs: home=${leagueAvgs.avgHomeGoals.toFixed(2)}, away=${leagueAvgs.avgAwayGoals.toFixed(2)}, total=${leagueAvgs.avgTotalGoals.toFixed(2)}`);

  // Generate predictions
  const records: Record[] = [];
  for (const match of testData) {
    const homeInTraining = trainingData.some(m => m.homeTeam === match.homeTeam || m.awayTeam === match.homeTeam);
    const awayInTraining = trainingData.some(m => m.homeTeam === match.awayTeam || m.awayTeam === match.awayTeam);
    if (!homeInTraining || !awayInTraining) continue;

    const predicted = generateBacktestPredictions(trainingData, match.homeTeam, match.awayTeam, leagueAvgs, seasonWeights);
    records.push({
      predicted,
      actual: {
        homeGoals: match.ftHomeGoals,
        awayGoals: match.ftAwayGoals,
        result: match.ftResult,
        totalGoals: match.ftHomeGoals + match.ftAwayGoals,
        btts: match.ftHomeGoals > 0 && match.ftAwayGoals > 0,
        over15: match.ftHomeGoals + match.ftAwayGoals > 1.5,
        over25: match.ftHomeGoals + match.ftAwayGoals > 2.5,
      },
    });
  }

  console.log(`  Predictions generated: ${records.length}`);

  // ── Calculate metrics ──
  const n = records.length;

  // O2.5 accuracy
  let o25Correct = 0;
  for (const r of records) {
    const predOver = r.predicted.over25 >= 50;
    if (predOver === r.actual.over25) o25Correct++;
  }

  // O2.5 calibration
  const avgPredO25 = records.reduce((s, r) => s + r.predicted.over25, 0) / n;
  const actualO25Rate = records.filter(r => r.actual.over25).length / n * 100;
  const o25Calibration = actualO25Rate / avgPredO25;

  // O2.5 Brier score
  let o25Brier = 0;
  for (const r of records) {
    const prob = r.predicted.over25 / 100;
    const actual = r.actual.over25 ? 1 : 0;
    o25Brier += (prob - actual) ** 2;
  }
  o25Brier /= n;

  // O2.5 when predicted >= 60% (confident overs)
  const confidentO25 = records.filter(r => r.predicted.over25 >= 60);
  const confidentO25Correct = confidentO25.filter(r => r.actual.over25).length;

  // O2.5 when predicted >= 65%
  const strongO25 = records.filter(r => r.predicted.over25 >= 65);
  const strongO25Correct = strongO25.filter(r => r.actual.over25).length;

  // BTTS accuracy
  let bttsCorrect = 0;
  for (const r of records) {
    const predBtts = r.predicted.btts >= 50;
    if (predBtts === r.actual.btts) bttsCorrect++;
  }

  // BTTS calibration
  const avgPredBtts = records.reduce((s, r) => s + r.predicted.btts, 0) / n;
  const actualBttsRate = records.filter(r => r.actual.btts).length / n * 100;
  const bttsCalibration = actualBttsRate / avgPredBtts;

  // BTTS Brier score
  let bttsBrier = 0;
  for (const r of records) {
    const prob = r.predicted.btts / 100;
    const actual = r.actual.btts ? 1 : 0;
    bttsBrier += (prob - actual) ** 2;
  }
  bttsBrier /= n;

  // BTTS when predicted >= 60%
  const confidentBtts = records.filter(r => r.predicted.btts >= 60);
  const confidentBttsCorrect = confidentBtts.filter(r => r.actual.btts).length;

  // BTTS when predicted >= 65%
  const strongBtts = records.filter(r => r.predicted.btts >= 65);
  const strongBttsCorrect = strongBtts.filter(r => r.actual.btts).length;

  // O3.5 accuracy (computed from totalXg)
  let o35Correct = 0;
  let sumPredO35 = 0;
  for (const r of records) {
    const txg = r.predicted.totalXg;
    if (txg > 0) {
      const p0 = Math.exp(-txg);
      const p1 = txg * p0;
      const p2 = (txg * txg / 2) * p0;
      const p3 = (txg * txg * txg / 6) * p0;
      const o35Prob = (1 - p0 - p1 - p2 - p3) * 100;
      sumPredO35 += o35Prob;
      const predOver = o35Prob >= 50;
      const actualOver = r.actual.totalGoals > 3.5;
      if (predOver === actualOver) o35Correct++;
    }
  }
  const avgPredO35 = sumPredO35 / n;
  const actualO35Rate = records.filter(r => r.actual.totalGoals > 3.5).length / n * 100;
  const o35Calibration = avgPredO35 > 0 ? actualO35Rate / avgPredO35 : 1;

  // 1X2 accuracy
  let hCorrect = 0, dCorrect = 0, aCorrect = 0;
  for (const r of records) {
    const predResult = r.predicted.homeWin > r.predicted.draw && r.predicted.homeWin > r.predicted.awayWin ? 'H' :
                       r.predicted.awayWin > r.predicted.draw ? 'A' : 'D';
    if (predResult === r.actual.result) {
      if (predResult === 'H') hCorrect++;
      else if (predResult === 'D') dCorrect++;
      else aCorrect++;
    }
  }

  // Brier for 1X2
  let resultBrier = 0;
  for (const r of records) {
    const pH = r.predicted.homeWin / 100;
    const pD = r.predicted.draw / 100;
    const pA = r.predicted.awayWin / 100;
    resultBrier += (pH - (r.actual.result === 'H' ? 1 : 0)) ** 2
              + (pD - (r.actual.result === 'D' ? 1 : 0)) ** 2
              + (pA - (r.actual.result === 'A' ? 1 : 0)) ** 2;
  }
  resultBrier /= n;

  // ROI simulation (flat stake on O2.5 when predicted >= 60%, odds 1.85)
  const o25Bets = confidentO25.length;
  const o25Wins = confidentO25Correct;
  const o25ROI = o25Bets > 0 ? ((o25Wins * 1.85 - o25Bets) / o25Bets * 100) : 0;

  // ROI simulation on BTTS when predicted >= 60%, odds 1.80
  const bttsBets = confidentBtts.length;
  const bttsWins = confidentBttsCorrect;
  const bttsROI = bttsBets > 0 ? ((bttsWins * 1.80 - bttsBets) / bttsBets * 100) : 0;

  // Print results
  console.log(`\n── OVER 2.5 GOALS ──`);
  console.log(`  Accuracy (≥50% threshold): ${o25Correct}/${n} = ${(o25Correct/n*100).toFixed(1)}%`);
  console.log(`  Accuracy (≥60% threshold): ${confidentO25Correct}/${confidentO25.length} = ${confidentO25.length > 0 ? (confidentO25Correct/confidentO25.length*100).toFixed(1) : 0}% (${confidentO25.length} bets)`);
  console.log(`  Accuracy (≥65% threshold): ${strongO25Correct}/${strongO25.length} = ${strongO25.length > 0 ? (strongO25Correct/strongO25.length*100).toFixed(1) : 0}% (${strongO25.length} bets)`);
  console.log(`  Avg predicted: ${avgPredO25.toFixed(1)}% | Actual rate: ${actualO25Rate.toFixed(1)}%`);
  console.log(`  Calibration ratio: ${o25Calibration.toFixed(3)} (${o25Calibration > 1 ? 'underestimates' : 'overestimates'})`);
  console.log(`  Brier score: ${o25Brier.toFixed(4)} (lower = better, 0.25 = coin flip)`);
  console.log(`  ROI @1.85 odds (≥60%): ${o25ROI > 0 ? '+' : ''}${o25ROI.toFixed(1)}%`);

  console.log(`\n── BTTS ──`);
  console.log(`  Accuracy (≥50% threshold): ${bttsCorrect}/${n} = ${(bttsCorrect/n*100).toFixed(1)}%`);
  console.log(`  Accuracy (≥60% threshold): ${confidentBttsCorrect}/${confidentBtts.length} = ${confidentBtts.length > 0 ? (confidentBttsCorrect/confidentBtts.length*100).toFixed(1) : 0}% (${confidentBtts.length} bets)`);
  console.log(`  Accuracy (≥65% threshold): ${strongBttsCorrect}/${strongBtts.length} = ${strongBtts.length > 0 ? (strongBttsCorrect/strongBtts.length*100).toFixed(1) : 0}% (${strongBtts.length} bets)`);
  console.log(`  Avg predicted: ${avgPredBtts.toFixed(1)}% | Actual rate: ${actualBttsRate.toFixed(1)}%`);
  console.log(`  Calibration ratio: ${bttsCalibration.toFixed(3)} (${bttsCalibration > 1 ? 'underestimates' : 'overestimates'})`);
  console.log(`  Brier score: ${bttsBrier.toFixed(4)} (lower = better, 0.25 = coin flip)`);
  console.log(`  ROI @1.80 odds (≥60%): ${bttsROI > 0 ? '+' : ''}${bttsROI.toFixed(1)}%`);

  console.log(`\n── OVER 3.5 GOALS ──`);
  console.log(`  Accuracy (≥50% threshold): ${o35Correct}/${n} = ${(o35Correct/n*100).toFixed(1)}%`);
  console.log(`  Avg predicted: ${avgPredO35.toFixed(1)}% | Actual rate: ${actualO35Rate.toFixed(1)}%`);
  console.log(`  Calibration ratio: ${o35Calibration.toFixed(3)}`);

  console.log(`\n── 1X2 RESULT ──`);
  console.log(`  Overall accuracy: ${(hCorrect + dCorrect + aCorrect)}/${n} = ${((hCorrect+dCorrect+aCorrect)/n*100).toFixed(1)}%`);
  console.log(`  Brier score: ${resultBrier.toFixed(4)}`);

  return {
    testSeason, n,
    over25: { accuracy: o25Correct/n*100, calibration: o25Calibration, brier: o25Brier, roi: o25ROI, bets60: confidentO25.length, wins60: confidentO25Correct },
    btts: { accuracy: bttsCorrect/n*100, calibration: bttsCalibration, brier: bttsBrier, roi: bttsROI, bets60: confidentBtts.length, wins60: confidentBttsCorrect },
    over35: { accuracy: o35Correct/n*100, calibration: o35Calibration },
    result: { accuracy: (hCorrect+dCorrect+aCorrect)/n*100, brier: resultBrier },
  };
}

async function main() {
  const seasons = ['2223', '2324', '2425', '2526'];
  const results: Awaited<ReturnType<typeof runBacktest>>[] = [];

  for (const s of seasons) {
    try {
      const r = await runBacktest(s);
      if (r) results.push(r);
    } catch (e) {
      console.error(`Failed for ${s}:`, e);
    }
  }

  // Summary table
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`EPL BACKTEST SUMMARY — 4 SEASONS (2022-2026)`);
  console.log(`${'═'.repeat(80)}`);
  console.log(`
${'Season'.padEnd(10)} | ${'O2.5 Acc'.padEnd(10)} | ${'O2.5 Cal'.padEnd(10)} | ${'O2.5 Brier'.padEnd(10)} | ${'BTTS Acc'.padEnd(10)} | ${'BTTS Cal'.padEnd(10)} | ${'BTTS Brier'.padEnd(10)} | ${'1X2 Acc'.padEnd(10)}`);
  console.log(`${'─'.repeat(10)}─┼─${'─'.repeat(10)}─┼─${'─'.repeat(10)}─┼─${'─'.repeat(10)}─┼─${'─'.repeat(10)}─┼─${'─'.repeat(10)}─┼─${'─'.repeat(10)}─┼─${'─'.repeat(10)}`);

  for (const r of results) {
    console.log(
      `${r.testSeason.padEnd(10)} | ${(r.over25.accuracy.toFixed(1) + '%').padEnd(10)} | ${r.over25.calibration.toFixed(3).padEnd(10)} | ${r.over25.brier.toFixed(4).padEnd(10)} | ${(r.btts.accuracy.toFixed(1) + '%').padEnd(10)} | ${r.btts.calibration.toFixed(3).padEnd(10)} | ${r.btts.brier.toFixed(4).padEnd(10)} | ${(r.result.accuracy.toFixed(1) + '%').padEnd(10)}`
    );
  }

  // Averages
  const avg = (key: string, field: string) => {
    const vals = results.map(r => (r as any)[key][field]);
    return vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
  };

  console.log(`${'─'.repeat(10)}─┼─${'─'.repeat(10)}─┼─${'─'.repeat(10)}─┼─${'─'.repeat(10)}─┼─${'─'.repeat(10)}─┼─${'─'.repeat(10)}─┼─${'─'.repeat(10)}─┼─${'─'.repeat(10)}`);
  console.log(
    `${'AVERAGE'.padEnd(10)} | ${(avg('over25','accuracy').toFixed(1) + '%').padEnd(10)} | ${avg('over25','calibration').toFixed(3).padEnd(10)} | ${avg('over25','brier').toFixed(4).padEnd(10)} | ${(avg('btts','accuracy').toFixed(1) + '%').padEnd(10)} | ${avg('btts','calibration').toFixed(3).padEnd(10)} | ${avg('btts','brier').toFixed(4).padEnd(10)} | ${(avg('result','accuracy').toFixed(1) + '%').padEnd(10)}`
  );

  // Betting value assessment
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`BETTING VALUE ASSESSMENT (≥60% confidence, flat £1 stakes)`);
  console.log(`${'═'.repeat(80)}`);
  console.log(`
${'Season'.padEnd(10)} | ${'O2.5 Bets'.padEnd(10)} | ${'O2.5 Wins'.padEnd(10)} | ${'O2.5 ROI'.padEnd(10)} | ${'BTTS Bets'.padEnd(10)} | ${'BTTS Wins'.padEnd(10)} | ${'BTTS ROI'.padEnd(10)}`);
  console.log(`${'─'.repeat(10)}─┼─${'─'.repeat(10)}─┼─${'─'.repeat(10)}─┼─${'─'.repeat(10)}─┼─${'─'.repeat(10)}─┼─${'─'.repeat(10)}─┼─${'─'.repeat(10)}`);

  for (const r of results) {
    console.log(
      `${r.testSeason.padEnd(10)} | ${String(r.over25.bets60).padEnd(10)} | ${String(r.over25.wins60).padEnd(10)} | ${(r.over25.roi > 0 ? '+' : '') + (r.over25.roi.toFixed(1) + '%').padEnd(10)} | ${String(r.btts.bets60).padEnd(10)} | ${String(r.btts.wins60).padEnd(10)} | ${(r.btts.roi > 0 ? '+' : '') + (r.btts.roi.toFixed(1) + '%').padEnd(10)}`
    );
  }
}

main().catch(console.error);
