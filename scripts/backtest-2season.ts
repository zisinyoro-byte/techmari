/**
 * 2-Season Backtest — tests using the last 2 seasons as test data
 * Compares against the original 4-season backtest results.
 * 
 * Training: 5 most recent seasons BEFORE the 2-season test window
 * Test: 2 seasons pooled (2024-25 + 2025-26)
 */

import { fetchSeasonData } from '../src/lib/data-cache';
import { calculateSeasonWeights } from '../src/lib/models/season-weighting';
import { calculateLeagueAverages, generateBacktestPredictions } from '../src/lib/models/predictions';

const EUROPEAN_SEASONS = ['2526', '2425', '2324', '2223', '2122', '2021', '1920', '1819', '1718', '1617', '1516'];

const LEAGUES: { code: string; name: string; country: string }[] = [
  { code: 'E0', name: 'Premier League', country: 'England' },
  { code: 'E1', name: 'Championship', country: 'England' },
  { code: 'E2', name: 'League One', country: 'England' },
  { code: 'E3', name: 'League Two', country: 'England' },
  { code: 'EC', name: 'National League', country: 'England' },
  { code: 'SC0', name: 'Premiership', country: 'Scotland' },
  { code: 'SC1', name: 'Championship', country: 'Scotland' },
  { code: 'D1', name: 'Bundesliga', country: 'Germany' },
  { code: 'D2', name: '2. Bundesliga', country: 'Germany' },
  { code: 'I1', name: 'Serie A', country: 'Italy' },
  { code: 'I2', name: 'Serie B', country: 'Italy' },
  { code: 'SP1', name: 'La Liga', country: 'Spain' },
  { code: 'SP2', name: 'La Liga 2', country: 'Spain' },
  { code: 'F1', name: 'Ligue 1', country: 'France' },
  { code: 'F2', name: 'Ligue 2', country: 'France' },
  { code: 'N1', name: 'Eredivisie', country: 'Netherlands' },
  { code: 'B1', name: 'Pro League', country: 'Belgium' },
  { code: 'P1', name: 'Primeira Liga', country: 'Portugal' },
  { code: 'T1', name: 'Süper Lig', country: 'Turkey' },
  { code: 'G1', name: 'Super League', country: 'Greece' },
];

// 2-season test window
const TEST_SEASONS = ['2425', '2526'];

interface LeagueResult {
  league: string;
  leagueName: string;
  country: string;
  n: number;
  perSeason: { season: string; n: number; o25Acc: number; bttsAcc: number; o35Acc: number; resultAcc: number }[];
  over25: { accuracy: number; calibration: number; brier: number; roi: number; bets60: number; wins60: number; winRate60: number };
  btts: { accuracy: number; calibration: number; brier: number; roi: number; bets60: number; wins60: number; winRate60: number };
  over35: { accuracy: number; calibration: number };
  result: { accuracy: number; brier: number };
}

async function runTwoSeasonBacktest(leagueCode: string): Promise<LeagueResult | null> {
  // Training: 5 seasons before the earliest test season
  const trainingSeasons = EUROPEAN_SEASONS.filter(s => s < TEST_SEASONS[0]).slice(-5);

  // Fetch training data
  const trainingResults = await Promise.all(trainingSeasons.map(s => fetchSeasonData(leagueCode, s)));
  const trainingData = trainingResults.flat();

  if (trainingData.length === 0) {
    console.log(`  No training data for ${leagueCode}`);
    return null;
  }

  const seasonWeights = calculateSeasonWeights(trainingSeasons);
  const leagueAvgs = calculateLeagueAverages(trainingData);

  // Generate predictions for each test season
  const allRecords: { predicted: any; actual: any; season: string }[] = [];
  const perSeason: LeagueResult['perSeason'] = [];

  for (const testSeason of TEST_SEASONS) {
    const testData = await fetchSeasonData(leagueCode, testSeason);
    if (testData.length === 0) {
      console.log(`  No test data for ${leagueCode}/${testSeason}`);
      continue;
    }

    const seasonRecords: { predicted: any; actual: any }[] = [];

    for (const match of testData) {
      const homeInTraining = trainingData.some(m => m.homeTeam === match.homeTeam || m.awayTeam === match.homeTeam);
      const awayInTraining = trainingData.some(m => m.homeTeam === match.awayTeam || m.awayTeam === match.awayTeam);
      if (!homeInTraining || !awayInTraining) continue;

      const predicted = generateBacktestPredictions(trainingData, match.homeTeam, match.awayTeam, leagueAvgs, seasonWeights);
      seasonRecords.push({
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
      allRecords.push({ ...seasonRecords[seasonRecords.length - 1], season: testSeason });
    }

    // Per-season metrics
    const sn = seasonRecords.length;
    if (sn > 0) {
      const sO25 = seasonRecords.filter(r => (r.predicted.over25 >= 50) === r.actual.over25).length / sn * 100;
      const sBtts = seasonRecords.filter(r => (r.predicted.btts >= 50) === r.actual.btts).length / sn * 100;
      let sO35n = 0, sO35c = 0;
      for (const r of seasonRecords) {
        const txg = r.predicted.totalXg;
        if (txg > 0) {
          const p0 = Math.exp(-txg), p1 = txg * p0, p2 = (txg*txg/2)*p0, p3 = (txg*txg*txg/6)*p0;
          const o35Prob = (1 - p0 - p1 - p2 - p3) * 100;
          if ((o35Prob >= 50) === (r.actual.totalGoals > 3.5)) sO35c++;
          sO35n++;
        }
      }
      const sO35 = sO35n > 0 ? sO35c / sO35n * 100 : 0;
      const sResult = seasonRecords.filter(r => {
        const pred = r.predicted.homeWin > r.predicted.draw && r.predicted.homeWin > r.predicted.awayWin ? 'H' :
                    r.predicted.awayWin > r.predicted.draw ? 'A' : 'D';
        return pred === r.actual.result;
      }).length / sn * 100;

      perSeason.push({ season: testSeason, n: sn, o25Acc: sO25, bttsAcc: sBtts, o35Acc: sO35, resultAcc: sResult });
    }
  }

  const n = allRecords.length;
  if (n === 0) return null;

  // ===== O2.5 =====
  let o25Correct = 0, sumPredO25 = 0, o25Brier = 0;
  const confidentO25 = allRecords.filter(r => r.predicted.over25 >= 60);
  const strongO25 = allRecords.filter(r => r.predicted.over25 >= 65);
  for (const r of allRecords) {
    const predOver = r.predicted.over25 >= 50;
    if (predOver === r.actual.over25) o25Correct++;
    sumPredO25 += r.predicted.over25;
    o25Brier += (r.predicted.over25 / 100 - (r.actual.over25 ? 1 : 0)) ** 2;
  }
  o25Brier /= n;
  const avgPredO25 = sumPredO25 / n;
  const actualO25Rate = allRecords.filter(r => r.actual.over25).length / n * 100;
  const o25Calibration = actualO25Rate / avgPredO25;
  const confidentO25Correct = confidentO25.filter(r => r.actual.over25).length;
  const o25ROI = confidentO25.length > 0 ? ((confidentO25Correct * 1.85 - confidentO25.length) / confidentO25.length * 100) : 0;

  // ===== BTTS =====
  let bttsCorrect = 0, sumPredBtts = 0, bttsBrier = 0;
  const confidentBtts = allRecords.filter(r => r.predicted.btts >= 60);
  const strongBtts = allRecords.filter(r => r.predicted.btts >= 65);
  for (const r of allRecords) {
    const predBtts = r.predicted.btts >= 50;
    if (predBtts === r.actual.btts) bttsCorrect++;
    sumPredBtts += r.predicted.btts;
    bttsBrier += (r.predicted.btts / 100 - (r.actual.btts ? 1 : 0)) ** 2;
  }
  bttsBrier /= n;
  const avgPredBtts = sumPredBtts / n;
  const actualBttsRate = allRecords.filter(r => r.actual.btts).length / n * 100;
  const bttsCalibration = actualBttsRate / avgPredBtts;
  const confidentBttsCorrect = confidentBtts.filter(r => r.actual.btts).length;
  const bttsROI = confidentBtts.length > 0 ? ((confidentBttsCorrect * 1.80 - confidentBtts.length) / confidentBtts.length * 100) : 0;

  // ===== O3.5 =====
  let o35Correct = 0, o35n = 0, sumPredO35 = 0;
  for (const r of allRecords) {
    const txg = r.predicted.totalXg;
    if (txg > 0) {
      const p0 = Math.exp(-txg), p1 = txg * p0, p2 = (txg*txg/2)*p0, p3 = (txg*txg*txg/6)*p0;
      const o35Prob = (1 - p0 - p1 - p2 - p3) * 100;
      sumPredO35 += o35Prob;
      o35n++;
      const predOver = o35Prob >= 50;
      const actualOver = r.actual.totalGoals > 3.5;
      if (predOver === actualOver) o35Correct++;
    }
  }
  const avgPredO35 = o35n > 0 ? sumPredO35 / n : 0;
  const actualO35Rate = allRecords.filter(r => r.actual.totalGoals > 3.5).length / n * 100;
  const o35Calibration = avgPredO35 > 0 ? actualO35Rate / avgPredO35 : 1;

  // ===== 1X2 =====
  let resultCorrect = 0, resultBrier = 0;
  for (const r of allRecords) {
    const predResult = r.predicted.homeWin > r.predicted.draw && r.predicted.homeWin > r.predicted.awayWin ? 'H' :
                       r.predicted.awayWin > r.predicted.draw ? 'A' : 'D';
    if (predResult === r.actual.result) resultCorrect++;
    resultBrier += (r.predicted.homeWin / 100 - (r.actual.result === 'H' ? 1 : 0)) ** 2
              + (r.predicted.draw / 100 - (r.actual.result === 'D' ? 1 : 0)) ** 2
              + (r.predicted.awayWin / 100 - (r.actual.result === 'A' ? 1 : 0)) ** 2;
  }
  resultBrier /= n;

  return {
    league: '',
    leagueName: '',
    country: '',
    n,
    perSeason,
    over25: {
      accuracy: o25Correct/n*100, calibration: o25Calibration, brier: o25Brier, roi: o25ROI,
      bets60: confidentO25.length, wins60: confidentO25Correct,
      winRate60: confidentO25.length > 0 ? confidentO25Correct/confidentO25.length*100 : 0
    },
    btts: {
      accuracy: bttsCorrect/n*100, calibration: bttsCalibration, brier: bttsBrier, roi: bttsROI,
      bets60: confidentBtts.length, wins60: confidentBttsCorrect,
      winRate60: confidentBtts.length > 0 ? confidentBttsCorrect/confidentBtts.length*100 : 0
    },
    over35: { accuracy: o35n > 0 ? o35Correct/o35n*100 : 0, calibration: o35Calibration },
    result: { accuracy: resultCorrect/n*100, brier: resultBrier },
  };
}

function grade(metric: string, value: number): string {
  switch (metric) {
    case 'accuracy':
      if (value >= 62) return 'A';
      if (value >= 58) return 'B+';
      if (value >= 55) return 'B';
      if (value >= 52) return 'C+';
      if (value >= 50) return 'C';
      return 'D';
    case 'brier':
      if (value <= 0.190) return 'A';
      if (value <= 0.200) return 'B+';
      if (value <= 0.210) return 'B';
      if (value <= 0.220) return 'C+';
      if (value <= 0.235) return 'C';
      return 'D';
    case 'calibration':
      if (value >= 0.95 && value <= 1.05) return 'A';
      if (value >= 0.90 && value <= 1.10) return 'B+';
      if (value >= 0.85 && value <= 1.15) return 'B';
      if (value >= 0.80 && value <= 1.20) return 'C';
      return 'D';
    case 'roi':
      if (value >= 5) return 'A';
      if (value >= 0) return 'B';
      if (value >= -5) return 'C';
      return 'D';
    default: return '-';
  }
}

async function main() {
  console.log('\n' + '='.repeat(110));
  console.log('TECHMARI 2-SEASON BACKTEST');
  console.log(`Test window: 2024-25 + 2025-26 (${TEST_SEASONS.join(', ')})`);
  console.log('Training: 5 seasons before 2024-25 (19-20 through 23-24)');
  console.log('Purpose: Compare 2-season pooled test vs original 4-season per-season test');
  console.log('='.repeat(110));

  const allResults: (LeagueResult & { league: string; leagueName: string; country: string })[] = [];

  for (const lg of LEAGUES) {
    console.log(`\n[${lg.code}] ${lg.country} - ${lg.name}...`);
    try {
      const r = await runTwoSeasonBacktest(lg.code);
      if (r) {
        allResults.push({ ...r, league: lg.code, leagueName: lg.name, country: lg.country });
        console.log(`  OK — ${r.n} matches (${r.perSeason.map(s => `${s.season}: ${s.n}`).join(', ')})`);
      } else {
        console.log('  NO DATA');
      }
    } catch (e: any) {
      console.log(`  ERROR: ${e?.message?.substring(0, 80)}`);
    }
  }

  if (allResults.length === 0) {
    console.log('\nNo results obtained.');
    return;
  }

  // =======================================================================
  // MASTER SUMMARY TABLE
  // =======================================================================
  console.log('\n' + '═'.repeat(115));
  console.log('2-SEASON BACKTEST RESULTS — Test: 2024-25 + 2025-26 pooled');
  console.log('═'.repeat(115));
  console.log(`
${'League'.padEnd(6)} ${'Name'.padEnd(16)} ${'Matches'.padEnd(8)} | ${'O2.5 Acc'.padEnd(8)} ${'O2.5 Cal'.padEnd(8)} ${'O2.5 Brier'.padEnd(9)} ${'O2.5 ROI'.padEnd(8)} | ${'BTTS Acc'.padEnd(9)} ${'BTTS Cal'.padEnd(8)} ${'BTTS Brier'.padEnd(9)} ${'BTTS ROI'.padEnd(8)} | ${'O3.5 Cal'.padEnd(8)} | ${'1X2 Acc'.padEnd(8)} ${'1X2 Brier'.padEnd(9)}`);
  console.log('─'.repeat(115));

  for (const r of allResults) {
    console.log(
      `${r.league.padEnd(6)} ${r.leagueName.padEnd(16)} ${String(r.n).padEnd(8)} | ${(r.over25.accuracy.toFixed(1)+'%').padEnd(8)} ${r.over25.calibration.toFixed(3).padEnd(8)} ${r.over25.brier.toFixed(4).padEnd(9)} ${(r.over25.roi > 0 ? '+' : '') + r.over25.roi.toFixed(1) + '%'.padEnd(8)} | ${(r.btts.accuracy.toFixed(1)+'%').padEnd(9)} ${r.btts.calibration.toFixed(3).padEnd(8)} ${r.btts.brier.toFixed(4).padEnd(9)} ${(r.btts.roi > 0 ? '+' : '') + r.btts.roi.toFixed(1) + '%'.padEnd(8)} | ${r.over35.calibration.toFixed(3).padEnd(8)} | ${(r.result.accuracy.toFixed(1)+'%').padEnd(8)} ${r.result.brier.toFixed(4).padEnd(9)}`
    );
  }

  // Global averages
  const gAvg = (key: string, field: string) => allResults.reduce((s, r) => s + (r as any)[key][field], 0) / allResults.length;
  const gMatches = allResults.reduce((s, r) => s + r.n, 0);
  console.log('─'.repeat(115));
  console.log(
    `TOTAL   ${allResults.length} leagues    ${String(gMatches).padEnd(8)} | ${(gAvg('over25','accuracy').toFixed(1)+'%').padEnd(8)} ${gAvg('over25','calibration').toFixed(3).padEnd(8)} ${gAvg('over25','brier').toFixed(4).padEnd(9)} ${(gAvg('over25','roi') > 0 ? '+' : '') + gAvg('over25','roi').toFixed(1) + '%'.padEnd(8)} | ${(gAvg('btts','accuracy').toFixed(1)+'%').padEnd(9)} ${gAvg('btts','calibration').toFixed(3).padEnd(8)} ${gAvg('btts','brier').toFixed(4).padEnd(9)} ${(gAvg('btts','roi') > 0 ? '+' : '') + gAvg('btts','roi').toFixed(1) + '%'.padEnd(8)} | ${gAvg('over35','calibration').toFixed(3).padEnd(8)} | ${(gAvg('result','accuracy').toFixed(1)+'%').padEnd(8)} ${gAvg('result','brier').toFixed(4).padEnd(9)}`
  );

  // =======================================================================
  // CALIBRATION QUALITY
  // =======================================================================
  console.log('\n' + '═'.repeat(80));
  console.log('CALIBRATION QUALITY (Ratio = 1.000 is perfect)');
  console.log('═'.repeat(80));
  console.log(`
${'League'.padEnd(6)} ${'Name'.padEnd(16)} | ${'O2.5 Grade'.padEnd(10)} ${'O2.5 Ratio'.padEnd(10)} | ${'BTTS Grade'.padEnd(10)} ${'BTTS Ratio'.padEnd(10)} | ${'O3.5 Grade'.padEnd(10)} ${'O3.5 Ratio'.padEnd(10)}`);
  console.log('─'.repeat(80));

  for (const r of allResults) {
    console.log(
      `${r.league.padEnd(6)} ${r.leagueName.padEnd(16)} | ${grade('calibration', r.over25.calibration).padEnd(10)} ${r.over25.calibration.toFixed(3).padEnd(10)} | ${grade('calibration', r.btts.calibration).padEnd(10)} ${r.btts.calibration.toFixed(3).padEnd(10)} | ${grade('calibration', r.over35.calibration).padEnd(10)} ${r.over35.calibration.toFixed(3).padEnd(10)}`
    );
  }

  // =======================================================================
  // BETTING VALUE (≥60% confidence)
  // =======================================================================
  console.log('\n' + '═'.repeat(95));
  console.log('BETTING VALUE — ROI at ≥60% confidence, flat £1 stake');
  console.log('O2.5 odds @1.85, BTTS odds @1.80');
  console.log('═'.repeat(95));
  console.log(`
${'League'.padEnd(6)} ${'Name'.padEnd(16)} | ${'O2.5 Bets'.padEnd(9)} ${'O2.5 W%'.padEnd(8)} ${'O2.5 ROI'.padEnd(10)} ${'O2.5 Gr'.padEnd(8)} | ${'BTTS Bets'.padEnd(9)} ${'BTTS W%'.padEnd(8)} ${'BTTS ROI'.padEnd(10)} ${'BTTS Gr'.padEnd(8)}`);
  console.log('─'.repeat(95));

  let profitableO25 = 0, profitableBtts = 0;
  for (const r of allResults) {
    if (r.over25.roi > 0) profitableO25++;
    if (r.btts.roi > 0) profitableBtts++;
    console.log(
      `${r.league.padEnd(6)} ${r.leagueName.padEnd(16)} | ${r.over25.bets60.toFixed(0).padEnd(9)} ${r.over25.winRate60.toFixed(1)+'%'.padEnd(8)} ${(r.over25.roi > 0 ? '+' : '') + r.over25.roi.toFixed(1) + '%'.padEnd(10)} ${grade('roi', r.over25.roi).padEnd(8)} | ${r.btts.bets60.toFixed(0).padEnd(9)} ${r.btts.winRate60.toFixed(1)+'%'.padEnd(8)} ${(r.btts.roi > 0 ? '+' : '') + r.btts.roi.toFixed(1) + '%'.padEnd(10)} ${grade('roi', r.btts.roi).padEnd(8)}`
    );
  }
  console.log('─'.repeat(95));
  console.log(`  Profitable leagues: O2.5 = ${profitableO25}/${allResults.length}, BTTS = ${profitableBtts}/${allResults.length}`);

  // =======================================================================
  // PER-SEASON BREAKDOWN (TOP 7 leagues by matches)
  // =======================================================================
  const topLeagues = [...allResults].sort((a, b) => b.n - a.n).slice(0, 7);

  console.log('\n' + '═'.repeat(90));
  console.log('PER-SEASON BREAKDOWN — Top 7 Leagues');
  console.log('═'.repeat(90));

  for (const lg of topLeagues) {
    console.log(`\n  ${lg.country} — ${lg.leagueName} (${lg.league})`);
    console.log(`  ${'Season'.padEnd(8)} | ${'Matches'.padEnd(7)} | ${'O2.5 Acc'.padEnd(9)} ${'BTTS Acc'.padEnd(9)} ${'O3.5 Acc'.padEnd(9)} | ${'1X2 Acc'.padEnd(9)}`);
    console.log('  ' + '─'.repeat(70));
    for (const s of lg.perSeason) {
      console.log(`  ${s.season.padEnd(8)} | ${String(s.n).padEnd(7)} | ${(s.o25Acc.toFixed(1)+'%').padEnd(9)} ${(s.bttsAcc.toFixed(1)+'%').padEnd(9)} ${(s.o35Acc.toFixed(1)+'%').padEnd(9)} | ${(s.resultAcc.toFixed(1)+'%').padEnd(9)}`);
    }
    console.log(`  ${'POOLED'.padEnd(8)} | ${String(lg.n).padEnd(7)} | ${(lg.over25.accuracy.toFixed(1)+'%').padEnd(9)} ${(lg.btts.accuracy.toFixed(1)+'%').padEnd(9)} ${(lg.over35.accuracy.toFixed(1)+'%').padEnd(9)} | ${(lg.result.accuracy.toFixed(1)+'%').padEnd(9)}`);
  }

  // =======================================================================
  // KEY FINDINGS
  // =======================================================================
  console.log('\n' + '═'.repeat(80));
  console.log('KEY FINDINGS');
  console.log('═'.repeat(80));

  const bestO25 = [...allResults].sort((a, b) => b.over25.accuracy - a.over25.accuracy).slice(0, 3);
  const worstO25 = [...allResults].sort((a, b) => a.over25.accuracy - b.over25.accuracy).slice(0, 3);
  console.log(`\n  BEST O2.5 Accuracy: ${bestO25.map(l => `${l.leagueName} (${l.over25.accuracy.toFixed(1)}%)`).join(', ')}`);
  console.log(`  WORST O2.5 Accuracy: ${worstO25.map(l => `${l.leagueName} (${l.over25.accuracy.toFixed(1)}%)`).join(', ')}`);

  const bestBtts = [...allResults].sort((a, b) => b.btts.accuracy - a.btts.accuracy).slice(0, 3);
  const worstBtts = [...allResults].sort((a, b) => a.btts.accuracy - b.btts.accuracy).slice(0, 3);
  console.log(`\n  BEST BTTS Accuracy: ${bestBtts.map(l => `${l.leagueName} (${l.btts.accuracy.toFixed(1)}%)`).join(', ')}`);
  console.log(`  WORST BTTS Accuracy: ${worstBtts.map(l => `${l.leagueName} (${l.btts.accuracy.toFixed(1)}%)`).join(', ')}`);

  // Global summary
  console.log(`\n  TOTAL MATCHES TESTED: ${gMatches} across ${allResults.length} leagues`);
  console.log(`  GLOBAL O2.5 ACCURACY:  ${gAvg('over25','accuracy').toFixed(1)}%`);
  console.log(`  GLOBAL BTTS ACCURACY:  ${gAvg('btts','accuracy').toFixed(1)}%`);
  console.log(`  GLOBAL O2.5 BRIER:     ${gAvg('over25','brier').toFixed(4)}`);
  console.log(`  GLOBAL BTTS BRIER:     ${gAvg('btts','brier').toFixed(4)}`);
  console.log(`  GLOBAL O2.5 CALIB:     ${gAvg('over25','calibration').toFixed(3)}`);
  console.log(`  GLOBAL BTTS CALIB:     ${gAvg('btts','calibration').toFixed(3)}`);
  console.log(`  GLOBAL 1X2 ACCURACY:  ${gAvg('result','accuracy').toFixed(1)}%`);
  console.log(`  GLOBAL 1X2 BRIER:     ${gAvg('result','brier').toFixed(4)}`);

  // Save results
  const { writeFile } = await import('fs/promises');
  const jsonPath = '/home/z/my-project/download/backtest-2season-results.json';
  await writeFile(jsonPath, JSON.stringify(allResults, null, 2));
  console.log(`\n  Full results saved to: ${jsonPath}`);
}

main().catch(console.error);
