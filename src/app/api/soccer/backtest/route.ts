import { NextRequest, NextResponse } from 'next/server';
import { MatchResult, parseCSV, fetchWithRetry } from '../results/route';

// Types
interface BacktestConfig {
  trainingSeasons: string[];
  testSeason: string;
  league: string;
}

interface PredictionRecord {
  match: {
    date: string;
    homeTeam: string;
    awayTeam: string;
  };
  predicted: {
    homeWin: number;
    draw: number;
    awayWin: number;
    over15: number;
    over25: number;
    btts: number;
    totalXg: number;
  };
  actual: {
    homeGoals: number;
    awayGoals: number;
    result: 'H' | 'D' | 'A';
    totalGoals: number;
    btts: boolean;
    over15: boolean;
    over25: boolean;
  };
  correct: {
    result: boolean;
    over15: boolean;
    over25: boolean;
    btts: boolean;
  };
}

interface ModelAccuracy {
  model: string;
  matches: number;
  // 1X2 Market
  homeWinAccuracy: number;
  drawAccuracy: number;
  awayWinAccuracy: number;
  overallAccuracy: number;
  // Goals Markets
  over15Accuracy: number;
  over25Accuracy: number;
  under25Accuracy: number;
  // BTTS
  bttsYesAccuracy: number;
  bttsNoAccuracy: number;
  // Calibration
  avgPredictedProb: number;
  avgActualRate: number;
  calibration: number;
  // Value Betting
  valueBetsFound: number;
  valueBetWinRate: number;
  roi: number;
  // Statistical
  brierScore: number;
}

interface BacktestResult {
  success: boolean;
  config: BacktestConfig;
  totalMatches: number;
  models: ModelAccuracy[];
  ensemble: ModelAccuracy;
  predictions: PredictionRecord[];
  calibrationData: { predicted: number; actual: number; count: number }[];
  summary: {
    bestModel1X2: string;
    bestModelO25: string;
    bestModelBTTS: string;
    bestOverallROI: string;
  };
}

// Available seasons
const EUROPEAN_SEASONS = ['2526', '2425', '2324', '2223', '2122', '2021', '1920', '1819', '1718', '1617', '1516'];

// Cache
const dataCache = new Map<string, { data: MatchResult[]; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000;

async function fetchSeasonData(league: string, season: string): Promise<MatchResult[]> {
  const cacheKey = `${league}-${season}`;
  const cached = dataCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  const url = `https://www.football-data.co.uk/mmz4281/${season}/${league}.csv`;

  try {
    const response = await fetchWithRetry(url);
    if (!response.ok) return [];
    const csvText = await response.text();
    const results = parseCSV(csvText, season);
    dataCache.set(cacheKey, { data: results, timestamp: Date.now() });
    return results;
  } catch (error) {
    console.error(`Error fetching ${season}:`, error);
    return [];
  }
}

// Calculate team statistics from historical data
function calculateTeamStats(results: MatchResult[], team: string) {
  const homeGames = results.filter(m => m.homeTeam === team);
  const awayGames = results.filter(m => m.awayTeam === team);
  
  const homeScored = homeGames.reduce((sum, m) => sum + m.ftHomeGoals, 0);
  const homeConceded = homeGames.reduce((sum, m) => sum + m.ftAwayGoals, 0);
  const awayScored = awayGames.reduce((sum, m) => sum + m.ftAwayGoals, 0);
  const awayConceded = awayGames.reduce((sum, m) => sum + m.ftHomeGoals, 0);
  
  const homeWins = homeGames.filter(m => m.ftResult === 'H').length;
  const awayWins = awayGames.filter(m => m.ftResult === 'A').length;
  const draws = homeGames.filter(m => m.ftResult === 'D').length + awayGames.filter(m => m.ftResult === 'D').length;
  
  const totalGames = homeGames.length + awayGames.length;
  
  return {
    homeGames: homeGames.length,
    awayGames: awayGames.length,
    totalGames,
    avgHomeScored: homeGames.length > 0 ? homeScored / homeGames.length : 0,
    avgHomeConceded: homeGames.length > 0 ? homeConceded / homeGames.length : 0,
    avgAwayScored: awayGames.length > 0 ? awayScored / awayGames.length : 0,
    avgAwayConceded: awayGames.length > 0 ? awayConceded / awayGames.length : 0,
    attackStrength: totalGames > 0 ? (homeScored + awayScored) / totalGames : 0,
    defenseStrength: totalGames > 0 ? (homeConceded + awayConceded) / totalGames : 0,
    form: totalGames > 0 ? (homeWins + awayWins + 0.5 * draws) / totalGames : 0.5,
    wins: homeWins + awayWins,
    draws,
    losses: totalGames - homeWins - awayWins - draws,
    bttsRate: totalGames > 0 ? 
      [...homeGames, ...awayGames].filter(m => m.ftHomeGoals > 0 && m.ftAwayGoals > 0).length / totalGames : 0.5,
    over25Rate: totalGames > 0 ?
      [...homeGames, ...awayGames].filter(m => m.ftHomeGoals + m.ftAwayGoals > 2.5).length / totalGames : 0.5,
  };
}

// Calculate league averages
function calculateLeagueAverages(results: MatchResult[]) {
  if (results.length === 0) {
    return { avgHomeGoals: 1.5, avgAwayGoals: 1.2, avgTotalGoals: 2.7, homeWinRate: 0.45, drawRate: 0.25, awayWinRate: 0.30 };
  }
  
  const totalHomeGoals = results.reduce((sum, m) => sum + m.ftHomeGoals, 0);
  const totalAwayGoals = results.reduce((sum, m) => sum + m.ftAwayGoals, 0);
  const homeWins = results.filter(m => m.ftResult === 'H').length;
  const draws = results.filter(m => m.ftResult === 'D').length;
  const awayWins = results.filter(m => m.ftResult === 'A').length;
  
  return {
    avgHomeGoals: totalHomeGoals / results.length,
    avgAwayGoals: totalAwayGoals / results.length,
    avgTotalGoals: (totalHomeGoals + totalAwayGoals) / results.length,
    homeWinRate: homeWins / results.length,
    drawRate: draws / results.length,
    awayWinRate: awayWins / results.length,
  };
}

// Poisson probability
function poissonProb(lambda: number, k: number): number {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

// Generate predictions using multiple models
function generatePredictions(
  trainingData: MatchResult[],
  homeTeam: string,
  awayTeam: string,
  leagueAvgs: ReturnType<typeof calculateLeagueAverages>
): { homeWin: number; draw: number; awayWin: number; over15: number; over25: number; btts: number; totalXg: number } {
  
  const homeStats = calculateTeamStats(trainingData, homeTeam);
  const awayStats = calculateTeamStats(trainingData, awayTeam);
  
  // Expected goals based on attack/defense
  const homeXg = (homeStats.avgHomeScored + awayStats.avgAwayConceded) / 2 || leagueAvgs.avgHomeGoals;
  const awayXg = (awayStats.avgAwayScored + homeStats.avgHomeConceded) / 2 || leagueAvgs.avgAwayGoals;
  const totalXg = homeXg + awayXg;
  
  // Poisson-based probabilities
  const homeWinProb = poissonProb(homeXg, 1) * poissonProb(awayXg, 0) + 
                      poissonProb(homeXg, 2) * poissonProb(awayXg, 0) +
                      poissonProb(homeXg, 2) * poissonProb(awayXg, 1) +
                      poissonProb(homeXg, 3) * poissonProb(awayXg, 0) +
                      poissonProb(homeXg, 3) * poissonProb(awayXg, 1) +
                      poissonProb(homeXg, 3) * poissonProb(awayXg, 2);
  
  const awayWinProb = poissonProb(awayXg, 1) * poissonProb(homeXg, 0) + 
                      poissonProb(awayXg, 2) * poissonProb(homeXg, 0) +
                      poissonProb(awayXg, 2) * poissonProb(homeXg, 1) +
                      poissonProb(awayXg, 3) * poissonProb(homeXg, 0) +
                      poissonProb(awayXg, 3) * poissonProb(homeXg, 1) +
                      poissonProb(awayXg, 3) * poissonProb(homeXg, 2);
  
  // Adjust probabilities
  let drawProb = 1 - homeWinProb - awayWinProb;
  
  // Form adjustment
  const formAdjustment = (homeStats.form - awayStats.form) * 0.1;
  const adjustedHomeWin = Math.max(0.1, Math.min(0.8, homeWinProb + formAdjustment));
  const adjustedAwayWin = Math.max(0.1, Math.min(0.8, awayWinProb - formAdjustment));
  drawProb = Math.max(0.15, Math.min(0.4, 1 - adjustedHomeWin - adjustedAwayWin));
  
  // Normalize
  const total = adjustedHomeWin + drawProb + adjustedAwayWin;
  const finalHomeWin = adjustedHomeWin / total;
  const finalDraw = drawProb / total;
  const finalAwayWin = adjustedAwayWin / total;
  
  // Goals markets
  const p0 = Math.exp(-totalXg);
  const p1 = totalXg * Math.exp(-totalXg);
  const p2 = (totalXg * totalXg / 2) * Math.exp(-totalXg);
  const over15Prob = 1 - p0 - p1;
  const over25Prob = 1 - p0 - p1 - p2;
  
  // BTTS
  const homeScoresProb = 1 - Math.exp(-homeXg);
  const awayScoresProb = 1 - Math.exp(-awayXg);
  const bttsProb = homeScoresProb * awayScoresProb;
  
  return {
    homeWin: Math.round(finalHomeWin * 100),
    draw: Math.round(finalDraw * 100),
    awayWin: Math.round(finalAwayWin * 100),
    over15: Math.round(Math.min(95, Math.max(40, over15Prob * 100))),
    over25: Math.round(Math.min(85, Math.max(35, over25Prob * 100))),
    btts: Math.round(Math.min(80, Math.max(30, bttsProb * 100))),
    totalXg: Math.round(totalXg * 100) / 100,
  };
}

// Calculate accuracy metrics
function calculateMetrics(predictions: PredictionRecord[]): ModelAccuracy {
  if (predictions.length === 0) {
    return {
      model: 'ensemble',
      matches: 0,
      homeWinAccuracy: 0, drawAccuracy: 0, awayWinAccuracy: 0, overallAccuracy: 0,
      over15Accuracy: 0, over25Accuracy: 0, under25Accuracy: 0,
      bttsYesAccuracy: 0, bttsNoAccuracy: 0,
      avgPredictedProb: 0, avgActualRate: 0, calibration: 0,
      valueBetsFound: 0, valueBetWinRate: 0, roi: 0,
      brierScore: 0,
    };
  }
  
  let homeWinCorrect = 0, drawCorrect = 0, awayWinCorrect = 0;
  let over15Correct = 0, over25Correct = 0, under25Correct = 0;
  let bttsYesCorrect = 0, bttsNoCorrect = 0;
  let totalBrier = 0;
  let valueBetsFound = 0, valueBetsWon = 0;
  
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
    else if (pred.predicted.over25 < 50 && !pred.actual.over25) under25Correct++;
    
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
  }
  
  const homeWinTotal = predictions.filter(p => p.actual.result === 'H').length;
  const drawTotal = predictions.filter(p => p.actual.result === 'D').length;
  const awayWinTotal = predictions.filter(p => p.actual.result === 'A').length;
  const bttsYesTotal = predictions.filter(p => p.actual.btts).length;
  const bttsNoTotal = predictions.length - bttsYesTotal;
  
  const overallCorrect = homeWinCorrect + drawCorrect + awayWinCorrect;
  
  return {
    model: 'ensemble',
    matches: predictions.length,
    homeWinAccuracy: homeWinTotal > 0 ? Math.round(homeWinCorrect / homeWinTotal * 1000) / 10 : 0,
    drawAccuracy: drawTotal > 0 ? Math.round(drawCorrect / drawTotal * 1000) / 10 : 0,
    awayWinAccuracy: awayWinTotal > 0 ? Math.round(awayWinCorrect / awayWinTotal * 1000) / 10 : 0,
    overallAccuracy: Math.round(overallCorrect / predictions.length * 1000) / 10,
    over15Accuracy: Math.round(over15Correct / predictions.length * 1000) / 10,
    over25Accuracy: Math.round(over25Correct / predictions.length * 1000) / 10,
    under25Accuracy: Math.round(under25Correct / predictions.length * 1000) / 10,
    bttsYesAccuracy: bttsYesTotal > 0 ? Math.round(bttsYesCorrect / bttsYesTotal * 1000) / 10 : 0,
    bttsNoAccuracy: bttsNoTotal > 0 ? Math.round(bttsNoCorrect / bttsNoTotal * 1000) / 10 : 0,
    avgPredictedProb: Math.round(predictions.reduce((sum, p) => sum + p.predicted.over25, 0) / predictions.length * 10) / 10,
    avgActualRate: Math.round(predictions.filter(p => p.actual.over25).length / predictions.length * 1000) / 10,
    calibration: 0, // Calculated separately
    valueBetsFound,
    valueBetWinRate: valueBetsFound > 0 ? Math.round(valueBetsWon / valueBetsFound * 1000) / 10 : 0,
    roi: valueBetsFound > 0 ? Math.round((valueBetsWon * 1.85 - valueBetsFound) / valueBetsFound * 1000) / 10 : 0,
    brierScore: Math.round(totalBrier / predictions.length * 1000) / 1000,
  };
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
    // Fetch training data
    console.log(`[Backtest API] Fetching training data: ${training.join(', ')}`);
    const trainingPromises = training.map(s => fetchSeasonData(league, s));
    const trainingResults = await Promise.all(trainingPromises);
    const trainingData = trainingResults.flat();
    console.log(`[Backtest API] Training data: ${trainingData.length} matches`);

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
    const leagueAvgs = calculateLeagueAverages(trainingData);

    // Generate predictions for each test match
    const predictions: PredictionRecord[] = [];
    
    for (const match of testData) {
      // Only predict if both teams have historical data
      const homeTeamInTraining = trainingData.some(m => m.homeTeam === match.homeTeam || m.awayTeam === match.homeTeam);
      const awayTeamInTraining = trainingData.some(m => m.homeTeam === match.awayTeam || m.awayTeam === match.awayTeam);
      
      if (!homeTeamInTraining || !awayTeamInTraining) continue;

      const predicted = generatePredictions(trainingData, match.homeTeam, match.awayTeam, leagueAvgs);
      
      const actual = {
        homeGoals: match.ftHomeGoals,
        awayGoals: match.ftAwayGoals,
        result: match.ftResult,
        totalGoals: match.ftHomeGoals + match.ftAwayGoals,
        btts: match.ftHomeGoals > 0 && match.ftAwayGoals > 0,
        over15: match.ftHomeGoals + match.ftAwayGoals > 1.5,
        over25: match.ftHomeGoals + match.ftAwayGoals > 2.5,
      };

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
    const ensembleMetrics = calculateMetrics(predictions);

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

    // Build result
    const result: BacktestResult = {
      success: true,
      config,
      totalMatches: predictions.length,
      models: [ensembleMetrics], // Can be extended for multiple models
      ensemble: ensembleMetrics,
      predictions: predictions.slice(0, 100), // Return first 100 for UI
      calibrationData,
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
