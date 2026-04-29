import { NextRequest, NextResponse } from 'next/server';
import { fetchSeasonData } from '@/lib/data-cache';
import type {
  BacktestConfig,
  PredictionRecord,
  ModelAccuracy,
  BacktestResult,
  LeagueAverages,
} from '@/lib/types';
import { EUROPEAN_SEASONS } from '@/lib/constants';
import { calculateSeasonWeights } from '@/lib/models/season-weighting';
import { calculateLeagueAverages, generateBacktestPredictions } from '@/lib/models/predictions';
import { saveCalibration } from '@/lib/models/calibration-store';
import {
  deriveThresholdsFromBacktest,
  registerBacktestThresholds,
} from '@/lib/betting-filters';

// Find the last H2H match before a given date
function findLastH2H(
  allData: { homeTeam: string; awayTeam: string; date: string; season: string; ftHomeGoals: number; ftAwayGoals: number; ftResult: 'H' | 'D' | 'A' }[],
  homeTeam: string,
  awayTeam: string,
  beforeDate: string,
  currentSeason: string
): { found: boolean; date?: string; season?: string; homeGoals?: number; awayGoals?: number; result?: 'H' | 'D' | 'A'; scoreline?: string } | null {
  // Parse date for comparison (DD/MM/YYYY format)
  const parseDate = (dateStr: string): Date => {
    if (!dateStr) return new Date(0);
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      let year = parseInt(parts[2], 10);
      if (year < 100) {
        year += year < 50 ? 2000 : 1900;
      }
      return new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return new Date(dateStr);
  };

  const matchDate = parseDate(beforeDate);

  // Find all matches between these two teams before this date
  const h2hMatches = allData.filter(m => {
    const isSameTeams = (m.homeTeam === homeTeam && m.awayTeam === awayTeam) ||
                        (m.homeTeam === awayTeam && m.awayTeam === homeTeam);
    const matchDateM = parseDate(m.date);
    const isBefore = matchDateM < matchDate;
    return isSameTeams && isBefore;
  });

  if (h2hMatches.length === 0) {
    return { found: false };
  }

  // Sort by date descending to get the most recent
  h2hMatches.sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());

  const lastMatch = h2hMatches[0];

  // Determine the result from perspective of the current home team
  // If the current home team was home in the H2H match, use the result as is
  // If the current home team was away, flip the result
  const currentHomeWasHome = lastMatch.homeTeam === homeTeam;

  let h2hResult: 'H' | 'D' | 'A';
  let h2hHomeGoals: number;
  let h2hAwayGoals: number;

  if (currentHomeWasHome) {
    h2hResult = lastMatch.ftResult;
    h2hHomeGoals = lastMatch.ftHomeGoals;
    h2hAwayGoals = lastMatch.ftAwayGoals;
  } else {
    // Flip the result - if original was H (home win), that's now an A (away win) from current home team's perspective
    h2hResult = lastMatch.ftResult === 'H' ? 'A' : lastMatch.ftResult === 'A' ? 'H' : 'D';
    h2hHomeGoals = lastMatch.ftAwayGoals;
    h2hAwayGoals = lastMatch.ftHomeGoals;
  }

  return {
    found: true,
    date: lastMatch.date,
    season: lastMatch.season,
    homeGoals: h2hHomeGoals,
    awayGoals: h2hAwayGoals,
    result: h2hResult,
    scoreline: `${h2hHomeGoals}-${h2hAwayGoals}`
  };
}

// Calculate accuracy metrics and per-market calibration ratios
function calculateMetrics(predictions: PredictionRecord[]): { metrics: ModelAccuracy; calibrationRatios: { over25: number; over15: number; bttsYes: number; homeWin: number; draw: number; awayWin: number } } {
  const emptyRatios = { over25: 1, over15: 1, bttsYes: 1, homeWin: 1, draw: 1, awayWin: 1 };

  if (predictions.length === 0) {
    return {
      metrics: {
        model: 'ensemble',
        matches: 0,
        homeWinAccuracy: 0, drawAccuracy: 0, awayWinAccuracy: 0, overallAccuracy: 0,
        over15Accuracy: 0, over25Accuracy: 0, under25Accuracy: 0,
        bttsYesAccuracy: 0, bttsNoAccuracy: 0,
        avgPredictedProb: 0, avgActualRate: 0, calibration: 0,
        valueBetsFound: 0, valueBetWinRate: 0, roi: 0,
        brierScore: 0,
      },
      calibrationRatios: emptyRatios,
    };
  }

  let homeWinCorrect = 0, drawCorrect = 0, awayWinCorrect = 0;
  let over15Correct = 0, over25Correct = 0;
  let bttsYesCorrect = 0, bttsNoCorrect = 0;
  let totalBrier = 0;
  let valueBetsFound = 0, valueBetsWon = 0;

  // Accumulators for per-market calibration ratio calculation
  let sumPredictedO25 = 0, sumPredictedO15 = 0, sumPredictedBtts = 0;
  let sumPredictedHomeWin = 0, sumPredictedDraw = 0, sumPredictedAwayWin = 0;

  for (const pred of predictions) {
    // 1X2
    const predictedResult = pred.predicted.homeWin > pred.predicted.draw && pred.predicted.homeWin > pred.predicted.awayWin ? 'H' :
                           pred.predicted.awayWin > pred.predicted.draw ? 'A' : 'D';

    if (predictedResult === pred.actual.result) {
      if (pred.actual.result === 'H') homeWinCorrect++;
      else if (pred.actual.result === 'D') drawCorrect++;
      else awayWinCorrect++;
    }

    // Goals markets
    if (pred.predicted.over15 >= 50 && pred.actual.over15) over15Correct++;
    else if (pred.predicted.over15 < 50 && !pred.actual.over15) over15Correct++;

    if (pred.predicted.over25 >= 50 && pred.actual.over25) over25Correct++;
    else if (pred.predicted.over25 < 50 && !pred.actual.over25) over25Correct++;

    // BTTS
    if (pred.predicted.btts >= 50 && pred.actual.btts) bttsYesCorrect++;
    else if (pred.predicted.btts < 50 && !pred.actual.btts) bttsNoCorrect++;

    // Brier score (for result prediction)
    const actualH = pred.actual.result === 'H' ? 1 : 0;
    const actualD = pred.actual.result === 'D' ? 1 : 0;
    const actualA = pred.actual.result === 'A' ? 1 : 0;
    totalBrier += Math.pow(pred.predicted.homeWin / 100 - actualH, 2) +
                  Math.pow(pred.predicted.draw / 100 - actualD, 2) +
                  Math.pow(pred.predicted.awayWin / 100 - actualA, 2);

    // Value bets (predicted prob > implied prob at odds 1.85)
    if (pred.predicted.over25 > 60) {
      valueBetsFound++;
      if (pred.actual.over25) valueBetsWon++;
    }

    // Calibration accumulators
    sumPredictedO25 += pred.predicted.over25;
    sumPredictedO15 += pred.predicted.over15;
    sumPredictedBtts += pred.predicted.btts;
    sumPredictedHomeWin += pred.predicted.homeWin;
    sumPredictedDraw += pred.predicted.draw;
    sumPredictedAwayWin += pred.predicted.awayWin;
  }

  const n = predictions.length;
  const homeWinTotal = predictions.filter(p => p.actual.result === 'H').length;
  const drawTotal = predictions.filter(p => p.actual.result === 'D').length;
  const awayWinTotal = predictions.filter(p => p.actual.result === 'A').length;
  const bttsYesTotal = predictions.filter(p => p.actual.btts).length;
  const bttsNoTotal = n - bttsYesTotal;

  const overallCorrect = homeWinCorrect + drawCorrect + awayWinCorrect;
  const avgPredictedProb = Math.round(sumPredictedO25 / n * 10) / 10;
  const avgActualRateO25 = (predictions.filter(p => p.actual.over25).length / n) * 100;
  const avgActualRate = Math.round(avgActualRateO25 * 10) / 10;
  const calibration = avgPredictedProb > 0 ? Math.round(avgActualRateO25 / avgPredictedProb * 1000) / 1000 : 1;

  // Per-market calibration ratios: actual_rate / avg_predicted_rate
  // Ratio > 1 means model underestimates, < 1 means overestimates
  const avgPredO25 = sumPredictedO25 / n;
  const avgPredO15 = sumPredictedO15 / n;
  const avgPredBtts = sumPredictedBtts / n;
  const avgPredHomeWin = sumPredictedHomeWin / n;
  const avgPredDraw = sumPredictedDraw / n;
  const avgPredAwayWin = sumPredictedAwayWin / n;

  const calibrationRatios = {
    over25: avgPredO25 > 0 ? Math.round((avgActualRateO25 / avgPredO25) * 1000) / 1000 : 1,
    over15: avgPredO15 > 0 ? Math.round(((predictions.filter(p => p.actual.over15).length / n * 100) / avgPredO15) * 1000) / 1000 : 1,
    bttsYes: avgPredBtts > 0 ? Math.round(((bttsYesTotal / n * 100) / avgPredBtts) * 1000) / 1000 : 1,
    homeWin: avgPredHomeWin > 0 ? Math.round(((homeWinTotal / n * 100) / avgPredHomeWin) * 1000) / 1000 : 1,
    draw: avgPredDraw > 0 ? Math.round(((drawTotal / n * 100) / avgPredDraw) * 1000) / 1000 : 1,
    awayWin: avgPredAwayWin > 0 ? Math.round(((awayWinTotal / n * 100) / avgPredAwayWin) * 1000) / 1000 : 1,
  };

  const metrics: ModelAccuracy = {
    model: 'ensemble',
    matches: n,
    homeWinAccuracy: homeWinTotal > 0 ? Math.round(homeWinCorrect / homeWinTotal * 1000) / 10 : 0,
    drawAccuracy: drawTotal > 0 ? Math.round(drawCorrect / drawTotal * 1000) / 10 : 0,
    awayWinAccuracy: awayWinTotal > 0 ? Math.round(awayWinCorrect / awayWinTotal * 1000) / 10 : 0,
    overallAccuracy: Math.round(overallCorrect / n * 1000) / 10,
    over15Accuracy: Math.round(over15Correct / n * 1000) / 10,
    over25Accuracy: Math.round(over25Correct / n * 1000) / 10,
    under25Accuracy: Math.round(over25Correct / n * 1000) / 10,
    bttsYesAccuracy: bttsYesTotal > 0 ? Math.round(bttsYesCorrect / bttsYesTotal * 1000) / 10 : 0,
    bttsNoAccuracy: bttsNoTotal > 0 ? Math.round(bttsNoCorrect / bttsNoTotal * 1000) / 10 : 0,
    avgPredictedProb,
    avgActualRate,
    calibration,
    valueBetsFound,
    valueBetWinRate: valueBetsFound > 0 ? Math.round(valueBetsWon / valueBetsFound * 1000) / 10 : 0,
    roi: valueBetsFound > 0 ? Math.round((valueBetsWon * 1.85 - valueBetsFound) / valueBetsFound * 1000) / 10 : 0,
    brierScore: Math.round(totalBrier / n * 1000) / 1000,
  };

  return { metrics, calibrationRatios };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const league = searchParams.get('league');
  const testSeason = searchParams.get('testSeason');
  const trainingSeasons = searchParams.get('trainingSeasons');

  console.log(`[Backtest API] Request: league=${league}, testSeason=${testSeason}`);

  if (!league || !testSeason) {
    return NextResponse.json(
      { error: 'Missing required parameters: league and testSeason' },
      { status: 400 }
    );
  }

  // Parse training seasons
  const training = trainingSeasons ? trainingSeasons.split(',') :
    EUROPEAN_SEASONS.filter(s => s < testSeason).slice(-5); // Default: 5 seasons before test

  const config: BacktestConfig = {
    trainingSeasons: training,
    testSeason,
    league,
  };

  try {
    // Fetch training data — each season separately for weighting
    console.log(`[Backtest API] Fetching training data: ${training.join(', ')}`);
    const trainingPromises = training.map(s => fetchSeasonData(league, s));
    const trainingResults = await Promise.all(trainingPromises);
    const trainingData = trainingResults.flat();
    console.log(`[Backtest API] Training data: ${trainingData.length} matches`);

    // Apply season weights to training data
    const seasonWeights = calculateSeasonWeights(training);
    console.log(`[Backtest API] Season weights: ${JSON.stringify(Array.from(seasonWeights.entries()))}`);

    // Fetch test data
    console.log(`[Backtest API] Fetching test data: ${testSeason}`);
    const testData = await fetchSeasonData(league, testSeason);
    console.log(`[Backtest API] Test data: ${testData.length} matches`);

    if (testData.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No test data available for this season',
        config,
      });
    }

    // Calculate league averages from training data
    const leagueAvgs: LeagueAverages = calculateLeagueAverages(trainingData);

    // Combine all data for H2H lookup (training + test data before current match)
    const allData = [...trainingData, ...testData];

    // Generate predictions for each test match
    const predictions: PredictionRecord[] = [];

    for (const match of testData) {
      // Only predict if both teams have historical data
      const homeTeamInTraining = trainingData.some(m => m.homeTeam === match.homeTeam || m.awayTeam === match.homeTeam);
      const awayTeamInTraining = trainingData.some(m => m.homeTeam === match.awayTeam || m.awayTeam === match.awayTeam);

      if (!homeTeamInTraining || !awayTeamInTraining) continue;

      // Pass season weights for recency-weighted training stats
      const predicted = generateBacktestPredictions(trainingData, match.homeTeam, match.awayTeam, leagueAvgs, seasonWeights);

      // Calculate 2nd half result
      const shHomeGoals = match.ftHomeGoals - match.htHomeGoals;
      const shAwayGoals = match.ftAwayGoals - match.htAwayGoals;
      const shResult: 'H' | 'D' | 'A' = shHomeGoals > shAwayGoals ? 'H' : shHomeGoals < shAwayGoals ? 'A' : 'D';

      const actual = {
        homeGoals: match.ftHomeGoals,
        awayGoals: match.ftAwayGoals,
        result: match.ftResult,
        totalGoals: match.ftHomeGoals + match.ftAwayGoals,
        btts: match.ftHomeGoals > 0 && match.ftAwayGoals > 0,
        over15: match.ftHomeGoals + match.ftAwayGoals > 1.5,
        over25: match.ftHomeGoals + match.ftAwayGoals > 2.5,
        // New fields
        htResult: match.htResult,
        htHomeGoals: match.htHomeGoals,
        htAwayGoals: match.htAwayGoals,
        shResult,
        shHomeGoals,
        shAwayGoals,
      };

      // Find last H2H before this match
      const lastH2H = findLastH2H(allData, match.homeTeam, match.awayTeam, match.date, testSeason);

      // Determine if predictions were correct
      const predictedResult = predicted.homeWin > predicted.draw && predicted.homeWin > predicted.awayWin ? 'H' :
                             predicted.awayWin > predicted.draw ? 'A' : 'D';

      predictions.push({
        match: {
          date: match.date,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
        },
        predicted,
        actual,
        odds: {
          home: match.oddsB365Home,
          draw: match.oddsB365Draw,
          away: match.oddsB365Away,
        },
        lastH2H,
        correct: {
          result: predictedResult === actual.result,
          over15: (predicted.over15 >= 50) === actual.over15,
          over25: (predicted.over25 >= 50) === actual.over25,
          btts: (predicted.btts >= 50) === actual.btts,
        },
      });
    }

    console.log(`[Backtest API] Generated ${predictions.length} predictions`);

    // Calculate metrics
    const { metrics: ensembleMetrics, calibrationRatios } = calculateMetrics(predictions);

    // Save calibration ratios to the in-memory store for the predict route to use
    saveCalibration(league, {
      ...calibrationRatios,
      league,
      testSeason,
      matches: predictions.length,
      brierScore: ensembleMetrics.brierScore,
      timestamp: Date.now(),
    });

    // ── Derive and register backtest-based thresholds for this league ──
    try {
      // Build BacktestMatch[] from predictions + testData for threshold derivation
      const testMatchMap = new Map<string, typeof testData[0]>();
      for (const m of testData) {
        testMatchMap.set(`${m.homeTeam}-${m.awayTeam}-${m.date}`, m);
      }

      const backtestMatches = predictions.map(pred => {
        const matchKey = `${pred.match.homeTeam}-${pred.match.awayTeam}-${pred.match.date}`;
        const matchData = testMatchMap.get(matchKey);

        // Compute per-match shot conversion: goals / shots (both teams)
        const totalShots = matchData
          ? (matchData.homeShots + matchData.awayShots)
          : 0;
        const shotConv = totalShots > 0
          ? ((matchData!.ftHomeGoals + matchData!.ftAwayGoals) / totalShots) * 100
          : undefined;

        // Compute over35 probability from Poisson using totalXg
        // over35 = 1 - P(0 goals) - P(1) - P(2) - P(3)
        const totalXg = pred.predicted.totalXg;
        let over35Prob: number | undefined;
        if (totalXg > 0) {
          const p0 = Math.exp(-totalXg);
          const p1 = totalXg * Math.exp(-totalXg);
          const p2 = (totalXg * totalXg / 2) * Math.exp(-totalXg);
          const p3 = (totalXg * totalXg * totalXg / 6) * Math.exp(-totalXg);
          over35Prob = (1 - p0 - p1 - p2 - p3) * 100;
        }

        return {
          ftHomeGoals: pred.actual.homeGoals,
          ftAwayGoals: pred.actual.awayGoals,
          predictedBtts: pred.predicted.btts,
          predictedO25: pred.predicted.over25,
          predictedO35: over35Prob,
          avgHomeGoals: leagueAvgs.avgHomeGoals,
          avgAwayGoals: leagueAvgs.avgAwayGoals,
          shotConversion: shotConv,
        };
      }).filter(m => m.predictedBtts !== undefined && m.predictedO25 !== undefined);

      // Compute league baselines from test data for the derivation
      const totalGoals = testData.reduce((sum, m) => sum + m.ftHomeGoals + m.ftAwayGoals, 0);
      const bttsCount = testData.filter(m => m.ftHomeGoals > 0 && m.ftAwayGoals > 0).length;
      const over25Count = testData.filter(m => m.ftHomeGoals + m.ftAwayGoals > 2.5).length;
      const over35Count = testData.filter(m => m.ftHomeGoals + m.ftAwayGoals > 3.5).length;
      const totalShotsAll = testData.reduce((sum, m) => sum + m.homeShots + m.awayShots, 0);

      const baselines = {
        avgGoalsPerGame: totalGoals / (testData.length || 1),
        over25Rate: (over25Count / (testData.length || 1)) * 100,
        bttsRate: (bttsCount / (testData.length || 1)) * 100,
        over35Rate: (over35Count / (testData.length || 1)) * 100,
        avgHomeGoals: leagueAvgs.avgHomeGoals,
        avgAwayGoals: leagueAvgs.avgAwayGoals,
        shotConversion: totalShotsAll > 0 ? (totalGoals / totalShotsAll) * 100 : 10,
      };

      const derived = deriveThresholdsFromBacktest(
        league,
        backtestMatches,
        baselines,
        { minSampleSize: 80 } // Use 80 for backtest since it's per-season
      );

      if (derived) {
        registerBacktestThresholds(derived);
        console.log(`[Backtest API] Registered backtest thresholds for ${league}: ${derived.sampleSize} matches, source=backtest`);
      } else {
        console.log(`[Backtest API] Insufficient data for threshold derivation (${backtestMatches.length} matches, need 80+)`);
      }
    } catch (thresholdError) {
      console.error('[Backtest API] Threshold derivation failed (non-fatal):', thresholdError);
    }

    // Create calibration data
    const calibrationBuckets: { [key: string]: { predicted: number[]; actual: number[] } } = {};
    for (const pred of predictions) {
      const bucket = Math.floor(pred.predicted.over25 / 10) * 10;
      if (!calibrationBuckets[bucket]) {
        calibrationBuckets[bucket] = { predicted: [], actual: [] };
      }
      calibrationBuckets[bucket].predicted.push(pred.predicted.over25);
      calibrationBuckets[bucket].actual.push(pred.actual.over25 ? 100 : 0);
    }

    const calibrationData = Object.entries(calibrationBuckets)
      .map(([bucket, data]) => ({
        predicted: Math.round(data.predicted.reduce((a, b) => a + b, 0) / data.predicted.length),
        actual: Math.round(data.actual.reduce((a, b) => a + b, 0) / data.actual.length),
        count: data.predicted.length,
      }))
      .sort((a, b) => a.predicted - b.predicted);

    // Calculate BTTS patterns based on last H2H, HT result, and SH result
    const bttsMatches = predictions.filter(p => p.actual.btts);
    const totalBttsMatches = bttsMatches.length;

    // H2H patterns
    const lastH2HHomeWin = predictions.filter(p => p.lastH2H?.found && p.lastH2H.result === 'H');
    const lastH2HAwayWin = predictions.filter(p => p.lastH2H?.found && p.lastH2H.result === 'A');
    const lastH2HDraw = predictions.filter(p => p.lastH2H?.found && p.lastH2H.result === 'D');
    const noH2H = predictions.filter(p => !p.lastH2H?.found);

    // HT result patterns
    const htHomeWin = predictions.filter(p => p.actual.htResult === 'H');
    const htAwayWin = predictions.filter(p => p.actual.htResult === 'A');
    const htDraw = predictions.filter(p => p.actual.htResult === 'D');

    // SH result patterns
    const shHomeWin = predictions.filter(p => p.actual.shResult === 'H');
    const shAwayWin = predictions.filter(p => p.actual.shResult === 'A');
    const shDraw = predictions.filter(p => p.actual.shResult === 'D');

    // Generate insights
    const insights: string[] = [];

    // H2H insights
    if (lastH2HHomeWin.length > 0) {
      const bttsRate = lastH2HHomeWin.filter(p => p.actual.btts).length / lastH2HHomeWin.length * 100;
      if (bttsRate > 55) {
        insights.push(`When last H2H was home win, BTTS rate is ${bttsRate.toFixed(1)}% (above average)`);
      }
    }
    if (lastH2HAwayWin.length > 0) {
      const bttsRate = lastH2HAwayWin.filter(p => p.actual.btts).length / lastH2HAwayWin.length * 100;
      if (bttsRate > 55) {
        insights.push(`When last H2H was away win, BTTS rate is ${bttsRate.toFixed(1)}% (above average)`);
      }
    }
    if (lastH2HDraw.length > 0) {
      const bttsRate = lastH2HDraw.filter(p => p.actual.btts).length / lastH2HDraw.length * 100;
      if (bttsRate > 55) {
        insights.push(`When last H2H was draw, BTTS rate is ${bttsRate.toFixed(1)}% (above average)`);
      }
    }

    // HT result insights
    const htDrawBttsRate = htDraw.length > 0 ? htDraw.filter(p => p.actual.btts).length / htDraw.length * 100 : 0;
    if (htDrawBttsRate > 60) {
      insights.push(`HT draws have ${htDrawBttsRate.toFixed(1)}% BTTS rate - strong indicator`);
    }

    // SH result insights
    const shDrawBttsRate = shDraw.length > 0 ? shDraw.filter(p => p.actual.btts).length / shDraw.length * 100 : 0;
    if (shDrawBttsRate > 60) {
      insights.push(`SH draws have ${shDrawBttsRate.toFixed(1)}% BTTS rate`);
    }

    // Overall BTTS rate
    const overallBttsRate = predictions.length > 0 ? totalBttsMatches / predictions.length * 100 : 0;
    insights.push(`Overall BTTS rate: ${overallBttsRate.toFixed(1)}% across ${predictions.length} matches`);

    // Calculate H2H scoreline patterns leading to BTTS
    const scorelineMap = new Map<string, { count: number; bttsCount: number }>();
    for (const pred of predictions) {
      if (pred.lastH2H?.found && pred.lastH2H.scoreline) {
        const current = scorelineMap.get(pred.lastH2H.scoreline) || { count: 0, bttsCount: 0 };
        current.count++;
        if (pred.actual.btts) current.bttsCount++;
        scorelineMap.set(pred.lastH2H.scoreline, current);
      }
    }

    // Sort by BTTS count (most BTTS outcomes) and get top 10
    const h2hScorelines = Array.from(scorelineMap.entries())
      .map(([scoreline, data]) => ({
        scoreline,
        count: data.count,
        bttsCount: data.bttsCount,
        bttsRate: data.count > 0 ? (data.bttsCount / data.count) * 100 : 0,
      }))
      .sort((a, b) => b.bttsCount - a.bttsCount)
      .slice(0, 10);

    // Add insight for top scoreline
    if (h2hScorelines.length > 0 && h2hScorelines[0].count >= 3) {
      const top = h2hScorelines[0];
      insights.push(`Most BTTS after H2H scoreline ${top.scoreline}: ${top.bttsCount}/${top.count} (${top.bttsRate.toFixed(0)}%)`);
    }

    const bttsPatterns = {
      totalBttsMatches,
      h2hPatterns: {
        lastH2HHomeWin: {
          count: lastH2HHomeWin.length,
          bttsRate: lastH2HHomeWin.length > 0 ? lastH2HHomeWin.filter(p => p.actual.btts).length / lastH2HHomeWin.length * 100 : 0,
          avgGoals: lastH2HHomeWin.length > 0 ? lastH2HHomeWin.reduce((sum, p) => sum + p.actual.totalGoals, 0) / lastH2HHomeWin.length : 0,
        },
        lastH2HAwayWin: {
          count: lastH2HAwayWin.length,
          bttsRate: lastH2HAwayWin.length > 0 ? lastH2HAwayWin.filter(p => p.actual.btts).length / lastH2HAwayWin.length * 100 : 0,
          avgGoals: lastH2HAwayWin.length > 0 ? lastH2HAwayWin.reduce((sum, p) => sum + p.actual.totalGoals, 0) / lastH2HAwayWin.length : 0,
        },
        lastH2HDraw: {
          count: lastH2HDraw.length,
          bttsRate: lastH2HDraw.length > 0 ? lastH2HDraw.filter(p => p.actual.btts).length / lastH2HDraw.length * 100 : 0,
          avgGoals: lastH2HDraw.length > 0 ? lastH2HDraw.reduce((sum, p) => sum + p.actual.totalGoals, 0) / lastH2HDraw.length : 0,
        },
        noH2H: {
          count: noH2H.length,
          bttsRate: noH2H.length > 0 ? noH2H.filter(p => p.actual.btts).length / noH2H.length * 100 : 0,
          avgGoals: noH2H.length > 0 ? noH2H.reduce((sum, p) => sum + p.actual.totalGoals, 0) / noH2H.length : 0,
        },
      },
      h2hScorelines,
      htResultPatterns: {
        htHomeWin: {
          count: htHomeWin.length,
          bttsRate: htHomeWin.length > 0 ? htHomeWin.filter(p => p.actual.btts).length / htHomeWin.length * 100 : 0,
        },
        htAwayWin: {
          count: htAwayWin.length,
          bttsRate: htAwayWin.length > 0 ? htAwayWin.filter(p => p.actual.btts).length / htAwayWin.length * 100 : 0,
        },
        htDraw: {
          count: htDraw.length,
          bttsRate: htDrawBttsRate,
        },
      },
      shResultPatterns: {
        shHomeWin: {
          count: shHomeWin.length,
          bttsRate: shHomeWin.length > 0 ? shHomeWin.filter(p => p.actual.btts).length / shHomeWin.length * 100 : 0,
        },
        shAwayWin: {
          count: shAwayWin.length,
          bttsRate: shAwayWin.length > 0 ? shAwayWin.filter(p => p.actual.btts).length / shAwayWin.length * 100 : 0,
        },
        shDraw: {
          count: shDraw.length,
          bttsRate: shDrawBttsRate,
        },
      },
      insights,
    };

    // Build result
    const result: BacktestResult = {
      success: true,
      config,
      totalMatches: predictions.length,
      models: [ensembleMetrics], // Can be extended for multiple models
      ensemble: ensembleMetrics,
      predictions: predictions.slice(0, 100), // Return first 100 for UI
      calibrationData,
      calibrationRatios, // Include ratios so the UI can display them
      bttsPatterns,
      summary: {
        bestModel1X2: `ensemble (${ensembleMetrics.overallAccuracy}%)`,
        bestModelO25: `ensemble (${ensembleMetrics.over25Accuracy}%)`,
        bestModelBTTS: `ensemble (${ensembleMetrics.bttsYesAccuracy}%)`,
        bestOverallROI: `ensemble (${ensembleMetrics.roi > 0 ? '+' : ''}${ensembleMetrics.roi}%)`,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Backtest error:', error);
    return NextResponse.json(
      { success: false, error: 'Backtest failed', details: String(error) },
      { status: 500 }
    );
  }
}
