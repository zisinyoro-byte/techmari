/**
 * BTTS Diagnostic Part 2 — WHY are the lambdas too low?
 */

import { fetchSeasonData } from '../src/lib/data-cache';
import { calculateSeasonWeights } from '../src/lib/models/season-weighting';
import { calculateLeagueAverages } from '../src/lib/models/predictions';
import { calculateBidirectionalHomeAdvantage } from '../src/lib/models/home-advantage';

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

  const halfAvg = leagueAvgs.avgTotalGoals / 2;

  console.log(`\nEPL 2025-26 xG Lambda Diagnostic`);
  console.log(`League avgs: home=${leagueAvgs.avgHomeGoals.toFixed(3)}, away=${leagueAvgs.avgAwayGoals.toFixed(3)}, total=${leagueAvgs.avgTotalGoals.toFixed(3)}, half=${halfAvg.toFixed(3)}`);

  let sumHomeXg = 0, sumAwayXg = 0, sumTotalXg = 0;
  let n = 0;

  // Also compute what BTTS would be if we used league-average lambdas for every match
  let bttsAtActualLambdas = 0;
  let bttsAtLeagueAvgLambdas = 0;
  const pHome0League = Math.exp(-leagueAvgs.avgHomeGoals);
  const pAway0League = Math.exp(-leagueAvgs.avgAwayGoals);
  const bttsLeagueAvg = (1 - pHome0League) * (1 - pAway0League);

  for (const match of testData) {
    const homeInTraining = trainingData.some(m => m.homeTeam === match.homeTeam || m.awayTeam === match.homeTeam);
    const awayInTraining = trainingData.some(m => m.homeTeam === match.awayTeam || m.awayTeam === match.awayTeam);
    if (!homeInTraining || !awayInTraining) continue;

    // Replicate the exact xG calculation from generateBacktestPredictions
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

    const homeAttackRatio = halfAvg > 0
      ? (homeGames.length > 0 ? homeScored / homeGames.length : leagueAvgs.avgHomeGoals) / halfAvg : 1;
    const awayDefenseRatio = halfAvg > 0
      ? (awayGames.length > 0 ? awayConceded / awayGames.length : leagueAvgs.avgHomeGoals) / halfAvg : 1;
    const awayAttackRatio = halfAvg > 0
      ? (awayGames.length > 0 ? awayScored / awayGames.length : leagueAvgs.avgAwayGoals) / halfAvg : 1;
    const homeDefenseRatio = halfAvg > 0
      ? (homeGames.length > 0 ? homeConceded / homeGames.length : leagueAvgs.avgAwayGoals) / halfAvg : 1;

    const homeXg = homeAttackRatio * awayDefenseRatio * leagueAvgs.avgHomeGoals * ha.scoringAdvantage;
    const awayXg = awayAttackRatio * homeDefenseRatio * leagueAvgs.avgAwayGoals * ha.defensiveAdvantage;
    
    sumHomeXg += homeXg;
    sumAwayXg += awayXg;
    sumTotalXg += homeXg + awayXg;
    n++;

    // BTTS at actual lambdas
    const ph0 = Math.exp(-homeXg);
    const pa0 = Math.exp(-awayXg);
    bttsAtActualLambdas += (1 - ph0) * (1 - pa0);

    // BTTS at league avg lambdas (same for all matches)
    bttsAtLeagueAvgLambdas += bttsLeagueAvg;
  }

  const avgHomeXg = sumHomeXg / n;
  const avgAwayXg = sumAwayXg / n;
  const avgTotalXg = sumTotalXg / n;

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`AVERAGE LAMBDAS ACROSS ${n} MATCHES`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`  Avg homeXg: ${avgHomeXg.toFixed(3)} (league avg: ${leagueAvgs.avgHomeGoals.toFixed(3)})`);
  console.log(`  Avg awayXg: ${avgAwayXg.toFixed(3)} (league avg: ${leagueAvgs.avgAwayGoals.toFixed(3)})`);
  console.log(`  Avg totalXg: ${avgTotalXg.toFixed(3)} (league avg: ${leagueAvgs.avgTotalGoals.toFixed(3)})`);
  console.log(`  Home Xg deficit: ${(leagueAvgs.avgHomeGoals - avgHomeXg).toFixed(3)} (${((1 - avgHomeXg/leagueAvgs.avgHomeGoals)*100).toFixed(1)}% lower)`);
  console.log(`  Away Xg deficit: ${(leagueAvgs.avgAwayGoals - avgAwayXg).toFixed(3)} (${((1 - avgAwayXg/leagueAvgs.avgAwayGoals)*100).toFixed(1)}% lower)`);
  console.log(`  Total Xg deficit: ${(leagueAvgs.avgTotalGoals - avgTotalXg).toFixed(3)} (${((1 - avgTotalXg/leagueAvgs.avgTotalGoals)*100).toFixed(1)}% lower)`);

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`BTTS COMPARISON`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`  BTTS at model's actual lambdas: ${(bttsAtActualLambdas/n*100).toFixed(1)}%`);
  console.log(`  BTTS at league-average lambdas: ${(bttsAtLeagueAvgLambdas/n*100).toFixed(1)}%`);
  console.log(`  Actual BTTS rate: ${testData.filter(m => m.ftHomeGoals > 0 && m.ftAwayGoals > 0).length / testData.length * 100}%`);
  console.log(``);
  console.log(`  BTTS lost to lambda deflation: ${((bttsAtLeagueAvgLambdas - bttsAtActualLambdas)/n*100).toFixed(1)}%`);

  // Now check: why is the average product of ratios < 1?
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`RATIO ANALYSIS`);
  console.log(`${'─'.repeat(60)}`);
  
  let sumHomeAttackRatio = 0, sumAwayDefenseRatio = 0;
  let sumAwayAttackRatio = 0, sumHomeDefenseRatio = 0;
  let sumScoringAdv = 0, sumDefensiveAdv = 0;
  let sumProduct1 = 0, sumProduct2 = 0;
  let count = 0;

  for (const match of testData) {
    const homeInTraining = trainingData.some(m => m.homeTeam === match.homeTeam || m.awayTeam === match.homeTeam);
    const awayInTraining = trainingData.some(m => m.homeTeam === match.awayTeam || m.awayTeam === match.awayTeam);
    if (!homeInTraining || !awayInTraining) continue;

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

    const har = halfAvg > 0 ? (homeGames.length > 0 ? homeScored / homeGames.length : leagueAvgs.avgHomeGoals) / halfAvg : 1;
    const adr = halfAvg > 0 ? (awayGames.length > 0 ? awayConceded / awayGames.length : leagueAvgs.avgHomeGoals) / halfAvg : 1;
    const aar = halfAvg > 0 ? (awayGames.length > 0 ? awayScored / awayGames.length : leagueAvgs.avgAwayGoals) / halfAvg : 1;
    const hdr = halfAvg > 0 ? (homeGames.length > 0 ? homeConceded / homeGames.length : leagueAvgs.avgAwayGoals) / halfAvg : 1;

    sumHomeAttackRatio += har;
    sumAwayDefenseRatio += adr;
    sumAwayAttackRatio += aar;
    sumHomeDefenseRatio += hdr;
    sumScoringAdv += ha.scoringAdvantage;
    sumDefensiveAdv += ha.defensiveAdvantage;
    sumProduct1 += har * adr;
    sumProduct2 += aar * hdr;
    count++;
  }

  console.log(`  Avg homeAttackRatio: ${sumHomeAttackRatio/count.toFixed(3)} (should be ~1.0)`);
  console.log(`  Avg awayDefenseRatio: ${sumAwayDefenseRatio/count.toFixed(3)} (should be ~1.0)`);
  console.log(`  Avg product (homeAtk × awayDef): ${(sumProduct1/count).toFixed(3)} ← if <1, this is the problem`);
  console.log(`  Avg product (awayAtk × homeDef): ${(sumProduct2/count).toFixed(3)}`);
  console.log(`  Avg scoringAdvantage: ${sumScoringAdv/count.toFixed(3)}`);
  console.log(`  Avg defensiveAdvantage: ${sumDefensiveAdv/count.toFixed(3)}`);
  
  // E[X*Y] vs E[X]*E[Y] — Jensen's inequality check
  console.log(`\n  E[homeAtk × awayDef] = ${(sumProduct1/count).toFixed(3)}`);
  console.log(`  E[homeAtk] × E[awayDef] = ${(sumHomeAttackRatio/count * sumAwayDefenseRatio/count).toFixed(3)}`);
  console.log(`  Difference (Jensen gap): ${(sumProduct1/count - sumHomeAttackRatio/count * sumAwayDefenseRatio/count).toFixed(3)}`);
}

main().catch(console.error);
