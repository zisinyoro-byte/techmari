/**
 * BTTS Diagnostic — pinpoints exactly WHERE the underestimation happens.
 * Runs on EPL 2526 season to get concrete numbers.
 */

import { fetchSeasonData } from '../src/lib/data-cache';
import { calculateSeasonWeights } from '../src/lib/models/season-weighting';
import { calculateLeagueAverages, generateBacktestPredictions } from '../src/lib/models/predictions';
import { goalProb, estimateDispersion } from '../src/lib/models/poisson';

const EUROPEAN_SEASONS = ['2526', '2425', '2324', '2223', '2122', '2021', '1920', '1819', '1718', '1617', '1516'];

async function main() {
  const league = 'E0';
  const testSeason = '2526';
  const training = EUROPEAN_SEASONS.filter(s => s < testSeason).slice(-5);

  const trainingResults = await Promise.all(training.map(s => fetchSeasonData(league, s)));
  const trainingData = trainingResults.flat();
  const testData = await fetchSeasonData(league, testSeason);

  const seasonWeights = calculateSeasonWeights(training);
  const leagueAvgs = calculateLeagueAverages(trainingData);

  console.log(`\nEPL 2025-26 BTTS Diagnostic`);
  console.log(`League avgs: home=${leagueAvgs.avgHomeGoals.toFixed(3)}, away=${leagueAvgs.avgAwayGoals.toFixed(3)}`);

  // Check distribution of raw BTTS before and after clamping
  let rawBttsBelow30 = 0, rawBttsAbove80 = 0, rawBttsNormal = 0;
  let sumRaw = 0, sumClamped = 0, sumActual = 0;
  let actualBttsCount = 0;
  let n = 0;

  // Also track the "theoretical" BTTS from independent Poisson
  let sumTheoretical = 0;
  const allGoals = trainingData.map(m => m.ftHomeGoals + m.ftAwayGoals);
  const dispersion = estimateDispersion(allGoals);
  console.log(`Dispersion: ${dispersion}`);

  for (const match of testData) {
    const homeInTraining = trainingData.some(m => m.homeTeam === match.homeTeam || m.awayTeam === match.homeTeam);
    const awayInTraining = trainingData.some(m => m.homeTeam === match.awayTeam || m.awayTeam === match.awayTeam);
    if (!homeInTraining || !awayInTraining) continue;

    const predicted = generateBacktestPredictions(trainingData, match.homeTeam, match.awayTeam, leagueAvgs, seasonWeights);
    const actual = match.ftHomeGoals > 0 && match.ftAwayGoals > 0;

    // To see raw BTTS before clamping, we need to recompute it
    // Recompute xG (same formula as generateBacktestPredictions)
    // ... skip for now, use the clamped output but analyze distribution

    if (predicted.btts < 30) rawBttsBelow30++;
    else if (predicted.btts > 80) rawBttsAbove80++;
    else rawBttsNormal++;

    sumClamped += predicted.btts;
    if (actual) actualBttsCount++;
    n++;
  }

  const avgClamped = sumClamped / n;
  const actualRate = actualBttsCount / n * 100;

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`CLAMPING ANALYSIS (${n} matches)`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`  Predictions below 30% (hit floor): ${rawBttsBelow30} (${(rawBttsBelow30/n*100).toFixed(1)}%)`);
  console.log(`  Predictions above 80% (hit ceiling): ${rawBttsAbove80} (${(rawBttsAbove80/n*100).toFixed(1)}%)`);
  console.log(`  Predictions in normal range: ${rawBttsNormal} (${(rawBttsNormal/n*100).toFixed(1)}%)`);
  console.log(`  Avg clamped BTTS: ${avgClamped.toFixed(1)}%`);
  console.log(`  Actual BTTS rate: ${actualRate.toFixed(1)}%`);
  console.log(`  Calibration ratio (clamped): ${(actualRate / avgClamped).toFixed(3)}`);

  // Now compute RAW BTTS (before clamping) by re-running the math
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`RAW BTTS ANALYSIS (recomputing without clamps)`);
  console.log(`${'─'.repeat(60)}`);

  let sumRawBtts = 0;
  let rawBttsBelow30Unclamped = 0;
  let rawBttsAbove80Unclamped = 0;

  // We need to access the internal calculation. Let's do it inline.
  const { calculateBidirectionalHomeAdvantage } = await import('../src/lib/models/home-advantage');

  for (const match of testData) {
    const homeInTraining = trainingData.some(m => m.homeTeam === match.homeTeam || m.awayTeam === match.homeTeam);
    const awayInTraining = trainingData.some(m => m.homeTeam === match.awayTeam || m.awayTeam === match.awayTeam);
    if (!homeInTraining || !awayInTraining) continue;

    // Replicate the xG calculation from generateBacktestPredictions
    const homeGames = trainingData.filter(m => m.homeTeam === match.homeTeam);
    const awayGames = trainingData.filter(m => m.awayTeam === match.awayTeam);
    const homeScored = homeGames.reduce((s, m) => s + m.ftHomeGoals, 0);
    const homeConceded = homeGames.reduce((s, m) => s + m.ftAwayGoals, 0);
    const awayScored = awayGames.reduce((s, m) => s + m.ftAwayGoals, 0);
    const awayConceded = awayGames.reduce((s, m) => s + m.ftHomeGoals, 0);

    const ha = calculateBidirectionalHomeAdvantage(
      homeGames.length > 0 ? homeScored / homeGames.length : leagueAvgs.avgHomeGoals,
      homeGames.length > 0 ? homeConceded / homeGames.length : leagueAvgs.avgAwayGoals,
      awayGames.length > 0 ? awayScored / awayGames.length : leagueAvgs.avgAwayGoals,
      awayGames.length > 0 ? awayConceded / awayGames.length : leagueAvgs.avgHomeGoals,
      leagueAvgs.avgHomeGoals,
      leagueAvgs.avgAwayGoals
    );

    const halfAvgTotal = leagueAvgs.avgTotalGoals / 2;
    const homeAttackRatio = halfAvgTotal > 0
      ? (homeGames.length > 0 ? homeScored / homeGames.length : leagueAvgs.avgHomeGoals) / halfAvgTotal : 1;
    const awayDefenseRatio = halfAvgTotal > 0
      ? (awayGames.length > 0 ? awayConceded / awayGames.length : leagueAvgs.avgHomeGoals) / halfAvgTotal : 1;
    const awayAttackRatio = halfAvgTotal > 0
      ? (awayGames.length > 0 ? awayScored / awayGames.length : leagueAvgs.avgAwayGoals) / halfAvgTotal : 1;
    const homeDefenseRatio = halfAvgTotal > 0
      ? (homeGames.length > 0 ? homeConceded / homeGames.length : leagueAvgs.avgAwayGoals) / halfAvgTotal : 1;

    const homeXg = homeAttackRatio * awayDefenseRatio * leagueAvgs.avgHomeGoals * ha.scoringAdvantage;
    const awayXg = awayAttackRatio * homeDefenseRatio * leagueAvgs.avgAwayGoals * ha.defensiveAdvantage;

    // Compute raw BTTS from 7x7 matrix (no clamping)
    let rawBtts = 0;
    for (let i = 1; i <= 7; i++) {
      for (let j = 1; j <= 7; j++) {
        rawBtts += goalProb(homeXg, i, dispersion) * goalProb(awayXg, j, dispersion);
      }
    }

    sumRawBtts += rawBtts * 100;
    if (rawBtts * 100 < 30) rawBttsBelow30Unclamped++;
    if (rawBtts * 100 > 80) rawBttsAbove80Unclamped++;
  }

  const avgRawBtts = sumRawBtts / n;
  console.log(`  Avg RAW BTTS (no clamping): ${avgRawBtts.toFixed(1)}%`);
  console.log(`  Raw values below 30%: ${rawBttsBelow30Unclamped} (${(rawBttsBelow30Unclamped/n*100).toFixed(1)}%)`);
  console.log(`  Raw values above 80%: ${rawBttsAbove80Unclamped} (${(rawBttsAbove80Unclamped/n*100).toFixed(1)}%)`);
  console.log(`  Calibration ratio (raw): ${(actualRate / avgRawBtts).toFixed(3)}`);
  console.log(`  Clamping effect: ${(avgRawBtts - avgClamped).toFixed(1)}% absolute shift`);

  // Theoretical BTTS for "average" lambdas
  const pHome0 = Math.exp(-leagueAvgs.avgHomeGoals);
  const pAway0 = Math.exp(-leagueAvgs.avgAwayGoals);
  const theoreticalBtts = (1 - pHome0) * (1 - pAway0) * 100;
  console.log(`\n  Theoretical BTTS at league avg lambdas: ${theoreticalBtts.toFixed(1)}%`);
  console.log(`  (P(home≠0)=${(100-pHome0*100).toFixed(1)}%, P(away≠0)=${(100-pAway0*100).toFixed(1)}%)`);

  // BTTS from actual training data
  const trainBttsRate = trainingData.filter(m => m.ftHomeGoals > 0 && m.ftAwayGoals > 0).length / trainingData.length * 100;
  console.log(`  Actual BTTS rate in training data: ${trainBttsRate.toFixed(1)}%`);
  console.log(`  Actual BTTS rate in test data: ${actualRate.toFixed(1)}%`);

  // Key insight: where does the gap come from?
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`ROOT CAUSE ANALYSIS`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`  Gap (raw model vs actual): ${(actualRate - avgRawBtts).toFixed(1)}%`);
  console.log(`  Gap from clamping: ${(avgRawBtts - avgClamped).toFixed(1)}%`);
  console.log(`  Total gap (clamped vs actual): ${(actualRate - avgClamped).toFixed(1)}%`);
  console.log(``);
  console.log(`  If gap is from raw model: Poisson independence assumption`);
  console.log(`  If gap is from clamping: Math.min(80)/Math.max(30) is destructive`);
}

main().catch(console.error);
