/**
 * All-leagues backtest — runs backtests across every supported league
 * to assess O2.5, O3.5, BTTS, and 1X2 reliability.
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

interface SeasonResult {
  testSeason: string;
  n: number;
  over25: { accuracy: number; calibration: number; brier: number; roi: number; bets60: number; wins60: number; winRate60: number };
  btts: { accuracy: number; calibration: number; brier: number; roi: number; bets60: number; wins60: number; winRate60: number };
  over35: { accuracy: number; calibration: number };
  result: { accuracy: number; brier: number };
}

async function runBacktest(leagueCode: string, testSeason: string): Promise<SeasonResult | null> {
  const training = EUROPEAN_SEASONS.filter(s => s < testSeason).slice(-5);

  // Fetch data
  const trainingResults = await Promise.all(training.map(s => fetchSeasonData(leagueCode, s)));
  const trainingData = trainingResults.flat();
  const testData = await fetchSeasonData(leagueCode, testSeason);

  if (testData.length === 0) return null;

  const seasonWeights = calculateSeasonWeights(training);
  const leagueAvgs = calculateLeagueAverages(trainingData);

  // Generate predictions
  const records: { predicted: any; actual: any }[] = [];
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

  const n = records.length;
  if (n === 0) return null;

  // O2.5
  let o25Correct = 0, sumPredO25 = 0, o25Brier = 0;
  const confidentO25 = records.filter(r => r.predicted.over25 >= 60);
  const strongO25 = records.filter(r => r.predicted.over25 >= 65);
  for (const r of records) {
    const predOver = r.predicted.over25 >= 50;
    if (predOver === r.actual.over25) o25Correct++;
    sumPredO25 += r.predicted.over25;
    o25Brier += (r.predicted.over25 / 100 - (r.actual.over25 ? 1 : 0)) ** 2;
  }
  o25Brier /= n;
  const avgPredO25 = sumPredO25 / n;
  const actualO25Rate = records.filter(r => r.actual.over25).length / n * 100;
  const o25Calibration = actualO25Rate / avgPredO25;
  const confidentO25Correct = confidentO25.filter(r => r.actual.over25).length;
  const strongO25Correct = strongO25.filter(r => r.actual.over25).length;
  const o25ROI = confidentO25.length > 0 ? ((confidentO25Correct * 1.85 - confidentO25.length) / confidentO25.length * 100) : 0;

  // BTTS
  let bttsCorrect = 0, sumPredBtts = 0, bttsBrier = 0;
  const confidentBtts = records.filter(r => r.predicted.btts >= 60);
  const strongBtts = records.filter(r => r.predicted.btts >= 65);
  for (const r of records) {
    const predBtts = r.predicted.btts >= 50;
    if (predBtts === r.actual.btts) bttsCorrect++;
    sumPredBtts += r.predicted.btts;
    bttsBrier += (r.predicted.btts / 100 - (r.actual.btts ? 1 : 0)) ** 2;
  }
  bttsBrier /= n;
  const avgPredBtts = sumPredBtts / n;
  const actualBttsRate = records.filter(r => r.actual.btts).length / n * 100;
  const bttsCalibration = actualBttsRate / avgPredBtts;
  const confidentBttsCorrect = confidentBtts.filter(r => r.actual.btts).length;
  const strongBttsCorrect = strongBtts.filter(r => r.actual.btts).length;
  const bttsROI = confidentBtts.length > 0 ? ((confidentBttsCorrect * 1.80 - confidentBtts.length) / confidentBtts.length * 100) : 0;

  // O3.5
  let o35Correct = 0, sumPredO35 = 0;
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

  // 1X2
  let hCorrect = 0, dCorrect = 0, aCorrect = 0, resultBrier = 0;
  for (const r of records) {
    const predResult = r.predicted.homeWin > r.predicted.draw && r.predicted.homeWin > r.predicted.awayWin ? 'H' :
                       r.predicted.awayWin > r.predicted.draw ? 'A' : 'D';
    if (predResult === r.actual.result) {
      if (predResult === 'H') hCorrect++;
      else if (predResult === 'D') dCorrect++;
      else aCorrect++;
    }
    resultBrier += (r.predicted.homeWin / 100 - (r.actual.result === 'H' ? 1 : 0)) ** 2
              + (r.predicted.draw / 100 - (r.actual.result === 'D' ? 1 : 0)) ** 2
              + (r.predicted.awayWin / 100 - (r.actual.result === 'A' ? 1 : 0)) ** 2;
  }
  resultBrier /= n;

  return {
    testSeason, n,
    over25: { accuracy: o25Correct/n*100, calibration: o25Calibration, brier: o25Brier, roi: o25ROI, bets60: confidentO25.length, wins60: confidentO25Correct, winRate60: confidentO25.length > 0 ? confidentO25Correct/confidentO25.length*100 : 0 },
    btts: { accuracy: bttsCorrect/n*100, calibration: bttsCalibration, brier: bttsBrier, roi: bttsROI, bets60: confidentBtts.length, wins60: confidentBttsCorrect, winRate60: confidentBtts.length > 0 ? confidentBttsCorrect/confidentBtts.length*100 : 0 },
    over35: { accuracy: o35Correct/n*100, calibration: o35Calibration },
    result: { accuracy: (hCorrect+dCorrect+aCorrect)/n*100, brier: resultBrier },
  };
}

async function runLeague(leagueCode: string, leagueName: string, country: string): Promise<LeagueResult | null> {
  const seasons = ['2223', '2324', '2425', '2526'];
  const results: SeasonResult[] = [];

  for (const s of seasons) {
    try {
      const r = await runBacktest(leagueCode, s);
      if (r) results.push(r);
    } catch (e: any) {
      // Skip failed seasons (likely no data for that league/season)
      console.log(`  [${leagueCode}/${s}] Skipped: ${e?.message?.substring(0, 60)}`);
    }
  }

  if (results.length === 0) return null;

  const avg = (field: string) => results.reduce((sum, r) => sum + (r as any)[field], 0) / results.length;
  const avgNested = (key: string, field: string) => results.reduce((sum, r) => sum + (r as any)[key][field], 0) / results.length;
  const avgMatches = results.reduce((sum, r) => sum + r.n, 0) / results.length;

  return {
    league: leagueCode,
    leagueName,
    country,
    seasons: results,
    avg: {
      over25: { accuracy: avgNested('over25', 'accuracy'), calibration: avgNested('over25', 'calibration'), brier: avgNested('over25', 'brier'), roi: avgNested('over25', 'roi'), bets60: avgNested('over25', 'bets60'), wins60: avgNested('over25', 'wins60'), winRate60: avgNested('over25', 'winRate60') },
      btts: { accuracy: avgNested('btts', 'accuracy'), calibration: avgNested('btts', 'calibration'), brier: avgNested('btts', 'brier'), roi: avgNested('btts', 'roi'), bets60: avgNested('btts', 'bets60'), wins60: avgNested('btts', 'wins60'), winRate60: avgNested('btts', 'winRate60') },
      over35: { accuracy: avgNested('over35', 'accuracy'), calibration: avgNested('over35', 'calibration') },
      result: { accuracy: avgNested('result', 'accuracy'), brier: avgNested('result', 'brier') },
      matches: avgMatches,
    },
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
    default:
      return '-';
  }
}

async function main() {
  console.log('\n' + '='.repeat(100));
  console.log('TECHMARI ALL-LEAGUES BACKTEST');
  console.log('Testing: O2.5, O3.5, BTTS, 1X2 across all supported leagues');
  console.log('Seasons tested: 2022-23, 2023-24, 2024-25, 2025-26');
  console.log('Training: 5 most recent prior seasons with exponential decay weighting');
  console.log('='.repeat(100));

  const allResults: LeagueResult[] = [];

  for (const lg of LEAGUES) {
    console.log(`\n[${lg.code}] ${lg.country} - ${lg.name}...`);
    const r = await runLeague(lg.code, lg.name, lg.country);
    if (r) {
      allResults.push(r);
      console.log(`  OK — ${r.seasons.length} seasons, avg ${r.avg.matches.toFixed(0)} matches/season`);
    } else {
      console.log('  NO DATA');
    }
  }

  // =======================================================================
  // MASTER SUMMARY TABLE
  // =======================================================================
  console.log('\n' + '═'.repeat(110));
  console.log('MASTER SUMMARY — All Leagues, Averaged Across 2022-2026');
  console.log('═'.repeat(110));
  console.log(`
${'League'.padEnd(6)} ${'Name'.padEnd(16)} ${'Matches'.padEnd(8)} | ${'O2.5 Acc'.padEnd(8)} ${'O2.5 Cal'.padEnd(8)} ${'O2.5 Brier'.padEnd(9)} ${'O2.5 ROI'.padEnd(8)} | ${'BTTS Acc'.padEnd(9)} ${'BTTS Cal'.padEnd(8)} ${'BTTS Brier'.padEnd(9)} ${'BTTS ROI'.padEnd(8)} | ${'O3.5 Cal'.padEnd(8)} | ${'1X2 Acc'.padEnd(8)} ${'1X2 Brier'.padEnd(9)}`);
  console.log('─'.repeat(110));

  for (const r of allResults) {
    const a = r.avg;
    console.log(
      `${r.league.padEnd(6)} ${r.leagueName.padEnd(16)} ${a.matches.toFixed(0).padEnd(8)} | ${(a.over25.accuracy.toFixed(1)+'%').padEnd(8)} ${a.over25.calibration.toFixed(3).padEnd(8)} ${a.over25.brier.toFixed(4).padEnd(9)} ${(a.over25.roi > 0 ? '+' : '') + a.over25.roi.toFixed(1) + '%'.padEnd(8)} | ${(a.btts.accuracy.toFixed(1)+'%').padEnd(9)} ${a.btts.calibration.toFixed(3).padEnd(8)} ${a.btts.brier.toFixed(4).padEnd(9)} ${(a.btts.roi > 0 ? '+' : '') + a.btts.roi.toFixed(1) + '%'.padEnd(8)} | ${a.over35.calibration.toFixed(3).padEnd(8)} | ${(a.result.accuracy.toFixed(1)+'%').padEnd(8)} ${a.result.brier.toFixed(4).padEnd(9)}`
    );
  }

  // Global averages
  const gAvg = (key: string, field: string) => allResults.reduce((s, r) => s + (r.avg as any)[key][field], 0) / allResults.length;
  const gMatches = allResults.reduce((s, r) => s + r.avg.matches, 0) / allResults.length;
  console.log('─'.repeat(110));
  console.log(
    `${'GLOBAL'.padEnd(6)} ${'AVERAGE'.padEnd(16)} ${gMatches.toFixed(0).padEnd(8)} | ${(gAvg('over25','accuracy').toFixed(1)+'%').padEnd(8)} ${gAvg('over25','calibration').toFixed(3).padEnd(8)} ${gAvg('over25','brier').toFixed(4).padEnd(9)} ${(gAvg('over25','roi') > 0 ? '+' : '') + gAvg('over25','roi').toFixed(1) + '%'.padEnd(8)} | ${(gAvg('btts','accuracy').toFixed(1)+'%').padEnd(9)} ${gAvg('btts','calibration').toFixed(3).padEnd(8)} ${gAvg('btts','brier').toFixed(4).padEnd(9)} ${(gAvg('btts','roi') > 0 ? '+' : '') + gAvg('btts','roi').toFixed(1) + '%'.padEnd(8)} | ${gAvg('over35','calibration').toFixed(3).padEnd(8)} | ${(gAvg('result','accuracy').toFixed(1)+'%').padEnd(8)} ${gAvg('result','brier').toFixed(4).padEnd(9)}`
  );

  // =======================================================================
  // CALIBRATION QUALITY ANALYSIS
  // =======================================================================
  console.log('\n' + '═'.repeat(80));
  console.log('CALIBRATION QUALITY — How well predicted probabilities match reality');
  console.log('Ratio = 1.000 is perfect; >1 = underestimates; <1 = overestimates');
  console.log('═'.repeat(80));
  console.log(`
${'League'.padEnd(6)} ${'Name'.padEnd(16)} | ${'O2.5 Grade'.padEnd(10)} ${'O2.5 Ratio'.padEnd(10)} | ${'BTTS Grade'.padEnd(10)} ${'BTTS Ratio'.padEnd(10)} | ${'O3.5 Grade'.padEnd(10)} ${'O3.5 Ratio'.padEnd(10)}`);
  console.log('─'.repeat(80));

  for (const r of allResults) {
    const o25g = grade('calibration', r.avg.over25.calibration);
    const bttsg = grade('calibration', r.avg.btts.calibration);
    const o35g = grade('calibration', r.avg.over35.calibration);
    console.log(
      `${r.league.padEnd(6)} ${r.leagueName.padEnd(16)} | ${o25g.padEnd(10)} ${r.avg.over25.calibration.toFixed(3).padEnd(10)} | ${bttsg.padEnd(10)} ${r.avg.btts.calibration.toFixed(3).padEnd(10)} | ${o35g.padEnd(10)} ${r.avg.over35.calibration.toFixed(3).padEnd(10)}`
    );
  }

  // =======================================================================
  // BETTING VALUE ANALYSIS (≥60% confidence, flat stake)
  // =======================================================================
  console.log('\n' + '═'.repeat(90));
  console.log('BETTING VALUE — ROI at ≥60% confidence, flat £1 stake');
  console.log('O2.5 odds @1.85, BTTS odds @1.80 (typical market prices)');
  console.log('═'.repeat(90));
  console.log(`
${'League'.padEnd(6)} ${'Name'.padEnd(16)} | ${'O2.5 Bets'.padEnd(9)} ${'O2.5 W%'.padEnd(8)} ${'O2.5 ROI'.padEnd(10)} ${'O2.5 Grade'.padEnd(10)} | ${'BTTS Bets'.padEnd(9)} ${'BTTS W%'.padEnd(8)} ${'BTTS ROI'.padEnd(10)} ${'BTTS Grade'.padEnd(10)}`);
  console.log('─'.repeat(90));

  let profitableO25 = 0, profitableBtts = 0;
  for (const r of allResults) {
    const o25g = grade('roi', r.avg.over25.roi);
    const bttsg = grade('roi', r.avg.btts.roi);
    if (r.avg.over25.roi > 0) profitableO25++;
    if (r.avg.btts.roi > 0) profitableBtts++;
    console.log(
      `${r.league.padEnd(6)} ${r.leagueName.padEnd(16)} | ${r.avg.over25.bets60.toFixed(0).padEnd(9)} ${r.avg.over25.winRate60.toFixed(1)+'%'.padEnd(8)} ${(r.avg.over25.roi > 0 ? '+' : '') + r.avg.over25.roi.toFixed(1) + '%'.padEnd(10)} ${o25g.padEnd(10)} | ${r.avg.btts.bets60.toFixed(0).padEnd(9)} ${r.avg.btts.winRate60.toFixed(1)+'%'.padEnd(8)} ${(r.avg.btts.roi > 0 ? '+' : '') + r.avg.btts.roi.toFixed(1) + '%'.padEnd(10)} ${bttsg.padEnd(10)}`
    );
  }
  console.log('─'.repeat(90));
  console.log(`  Profitable leagues (positive ROI): O2.5 = ${profitableO25}/${allResults.length}, BTTS = ${profitableBtts}/${allResults.length}`);

  // =======================================================================
  // PER-SEASON BREAKDOWN (TOP 5 LEAGUES)
  // =======================================================================
  const topLeagues = [...allResults].sort((a, b) => b.avg.matches - a.avg.matches).slice(0, 7);

  for (const lg of topLeagues) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`${lg.country} — ${lg.leagueName} (${lg.league})`);
    console.log(`${'─'.repeat(70)}`);
    console.log(`
${'Season'.padEnd(8)} | ${'Matches'.padEnd(7)} | ${'O2.5 Acc'.padEnd(9)} ${'O2.5 Cal'.padEnd(9)} ${'O2.5 ROI'.padEnd(9)} | ${'BTTS Acc'.padEnd(9)} ${'BTTS Cal'.padEnd(9)} ${'BTTS ROI'.padEnd(9)} | ${'1X2 Acc'.padEnd(9)} ${'1X2 Brier'.padEnd(9)}`);
    console.log('─'.repeat(70));

    for (const s of lg.seasons) {
      console.log(
        `${s.testSeason.padEnd(8)} | ${String(s.n).padEnd(7)} | ${(s.over25.accuracy.toFixed(1)+'%').padEnd(9)} ${s.over25.calibration.toFixed(3).padEnd(9)} ${(s.over25.roi > 0 ? '+' : '') + s.over25.roi.toFixed(1) + '%'.padEnd(9)} | ${(s.btts.accuracy.toFixed(1)+'%').padEnd(9)} ${s.btts.calibration.toFixed(3).padEnd(9)} ${(s.btts.roi > 0 ? '+' : '') + s.btts.roi.toFixed(1) + '%'.padEnd(9)} | ${(s.result.accuracy.toFixed(1)+'%').padEnd(9)} ${s.result.brier.toFixed(4).padEnd(9)}`
      );
    }
  }

  // =======================================================================
  // KEY FINDINGS
  // =======================================================================
  console.log('\n' + '═'.repeat(80));
  console.log('KEY FINDINGS & HONEST ASSESSMENT');
  console.log('═'.repeat(80));

  // Best leagues for O2.5
  const bestO25 = [...allResults].sort((a, b) => b.avg.over25.accuracy - a.avg.over25.accuracy).slice(0, 3);
  const worstO25 = [...allResults].sort((a, b) => a.avg.over25.accuracy - b.avg.over25.accuracy).slice(0, 3);
  console.log(`\n  BEST O2.5 Accuracy: ${bestO25.map(l => `${l.leagueName} (${l.avg.over25.accuracy.toFixed(1)}%)`).join(', ')}`);
  console.log(`  WORST O2.5 Accuracy: ${worstO25.map(l => `${l.leagueName} (${l.avg.over25.accuracy.toFixed(1)}%)`).join(', ')}`);

  // Best leagues for BTTS
  const bestBtts = [...allResults].sort((a, b) => b.avg.btts.accuracy - a.avg.btts.accuracy).slice(0, 3);
  const worstBtts = [...allResults].sort((a, b) => a.avg.btts.accuracy - b.avg.btts.accuracy).slice(0, 3);
  console.log(`\n  BEST BTTS Accuracy: ${bestBtts.map(l => `${l.leagueName} (${l.avg.btts.accuracy.toFixed(1)}%)`).join(', ')}`);
  console.log(`  WORST BTTS Accuracy: ${worstBtts.map(l => `${l.leagueName} (${l.avg.btts.accuracy.toFixed(1)}%)`).join(', ')}`);

  // Most/least calibrated
  const bestCalO25 = [...allResults].sort((a, b) => Math.abs(b.avg.over25.calibration - 1) - Math.abs(a.avg.over25.calibration - 1)).slice(0, 3);
  const worstCalO25 = [...allResults].sort((a, b) => Math.abs(a.avg.over25.calibration - 1) - Math.abs(b.avg.over25.calibration - 1)).slice(0, 3);
  console.log(`\n  BEST O2.5 Calibration: ${bestCalO25.map(l => `${l.leagueName} (${l.avg.over25.calibration.toFixed(3)})`).join(', ')}`);
  console.log(`  WORST O2.5 Calibration: ${worstCalO25.map(l => `${l.leagueName} (${l.avg.over25.calibration.toFixed(3)})`).join(', ')}`);

  const bestCalBtts = [...allResults].sort((a, b) => Math.abs(b.avg.btts.calibration - 1) - Math.abs(a.avg.btts.calibration - 1)).slice(0, 3);
  const worstCalBtts = [...allResults].sort((a, b) => Math.abs(a.avg.btts.calibration - 1) - Math.abs(b.avg.btts.calibration - 1)).slice(0, 3);
  console.log(`  BEST BTTS Calibration: ${bestCalBtts.map(l => `${l.leagueName} (${l.avg.btts.calibration.toFixed(3)})`).join(', ')}`);
  console.log(`  WORST BTTS Calibration: ${worstCalBtts.map(l => `${l.leagueName} (${l.avg.btts.calibration.toFixed(3)})`).join(', ')}`);

  // Betting value
  const bestO25ROI = [...allResults].filter(l => l.avg.over25.bets60 > 0).sort((a, b) => b.avg.over25.roi - a.avg.over25.roi).slice(0, 3);
  const bestBttsROI = [...allResults].filter(l => l.avg.btts.bets60 > 0).sort((a, b) => b.avg.btts.roi - a.avg.btts.roi).slice(0, 3);
  if (bestO25ROI.length > 0) {
    console.log(`\n  BEST O2.5 ROI (≥60%): ${bestO25ROI.map(l => `${l.leagueName} (${l.avg.over25.roi > 0 ? '+' : ''}${l.avg.over25.roi.toFixed(1)}%, ${l.avg.over25.winRate60.toFixed(0)}% hit rate)`).join(', ')}`);
  }
  if (bestBttsROI.length > 0) {
    console.log(`  BEST BTTS ROI (≥60%): ${bestBttsROI.map(l => `${l.leagueName} (${l.avg.btts.roi > 0 ? '+' : ''}${l.avg.btts.roi.toFixed(1)}%, ${l.avg.btts.winRate60.toFixed(0)}% hit rate)`).join(', ')}`);
  }

  // Overall assessment
  const gO25Acc = gAvg('over25', 'accuracy');
  const gBttsAcc = gAvg('btts', 'accuracy');
  const gO25Brier = gAvg('over25', 'brier');
  const gBttsBrier = gAvg('btts', 'brier');
  const gO25Cal = gAvg('over25', 'calibration');
  const gBttsCal = gAvg('btts', 'calibration');

  console.log(`\n  GLOBAL O2.5 BRIER: ${gO25Brier.toFixed(4)} (baseline ~0.250 for coin flip, ~0.215 for always-predict-over)`);
  console.log(`  GLOBAL BTTS BRIER: ${gBttsBrier.toFixed(4)}`);
  console.log(`  GLOBAL O2.5 CALIBRATION: ${gO25Cal.toFixed(3)} (1.000 = perfect)`);
  console.log(`  GLOBAL BTTS CALIBRATION: ${gBttsCal.toFixed(3)} (1.000 = perfect)`);

  // Output JSON for potential charting
  const jsonPath = '/home/z/my-project/download/all-leagues-backtest-results.json';
  const { writeFile } = await import('fs/promises');
  await writeFile(jsonPath, JSON.stringify(allResults, null, 2));
  console.log(`\n  Full results saved to: ${jsonPath}`);
}

main().catch(console.error);
