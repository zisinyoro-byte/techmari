import { NextRequest, NextResponse } from 'next/server';
import { MatchResult, parseCSV } from '../results/route';

// Types
interface TeamStats {
  attack: number;          // Attack strength relative to league avg
  defense: number;         // Defense strength relative to league avg
  homeAdvantage: number;   // Home advantage factor
  avgScored: number;       // Average goals scored per game
  avgConceded: number;     // Average goals conceded per game
  homeScored: number;      // Average goals scored at home
  homeConceded: number;    // Average goals conceded at home
  awayScored: number;      // Average goals scored away
  awayConceded: number;    // Average goals conceded away
  homeGames: number;       // Games played at home
  awayGames: number;       // Games played away
  totalGames: number;      // Total games played
  wins: number;
  draws: number;
  losses: number;
  // Form (last 5 matches)
  recentForm: ('W' | 'D' | 'L')[];
  recentGoalsScored: number;
  recentGoalsConceded: number;
  // BTTS patterns
  bttsFullTime: number;    // Count of BTTS matches
  bttsFirstHalf: number;
  bttsSecondHalf: number;
  // Over/Under patterns
  over25: number;
  over35: number;
}

interface PredictionResult {
  homeWin: number;
  draw: number;
  awayWin: number;
  homeXg: number;
  awayXg: number;
  likelyScore: string;
  likelyScoreProb: number;
  over25: number;
  over35: number;
  over15: number;
  over05: number;
  btts: number;
  scoreMatrix: { score: string; prob: number }[];
  // Confidence levels
  confidence: 'high' | 'medium' | 'low';
  confidenceReason: string;
  // Halftime predictions
  htHomeWin: number;
  htDraw: number;
  htAwayWin: number;
  htHomeXg: number;
  htAwayXg: number;
  htLikelyScore: string;
  htLikelyScoreProb: number;
  htScoreMatrix: { score: string; prob: number }[];
  // Implied odds (decimal)
  impliedOdds: {
    homeWin: number;
    draw: number;
    awayWin: number;
    over25: number;
    under25: number;
    over35: number;
    under35: number;
    over15: number;
    under15: number;
    over05: number;
    under05: number;
    bttsYes: number;
    bttsNo: number;
    htHomeWin: number;
    htDraw: number;
    htAwayWin: number;
  };
}

interface PatternAnalysis {
  bttsPatterns: {
    bothHalves: number;
    firstHalfOnly: number;
    secondHalfOnly: number;
    neitherHalf: number;
  };
  goalTiming: {
    firstHalfGoals: number;
    secondHalfGoals: number;
    avgFirstHalfGoals: number;
    avgSecondHalfGoals: number;
  };
  resultTransitions: {
    htHomeLeadFtHomeWin: number;
    htHomeLeadFtDraw: number;
    htHomeLeadFtAwayWin: number;
    htDrawFtHomeWin: number;
    htDrawFtDraw: number;
    htDrawFtAwayWin: number;
    htAwayLeadFtHomeWin: number;
    htAwayLeadFtDraw: number;
    htAwayLeadFtAwayWin: number;
  };
  comebackRate: number;
  scoringStreaks: {
    currentScoringStreak: number;
    currentConcedingStreak: number;
  };
}

interface LeagueInsights {
  avgGoalsPerGame: number;
  avgHomeGoals: number;
  avgAwayGoals: number;
  homeWinPercent: number;
  drawPercent: number;
  awayWinPercent: number;
  bttsPercent: number;
  over25Percent: number;
  bestAttack: { team: string; avg: number };
  bestDefense: { team: string; avg: number };
  totalMatches: number;
}

interface PredictionResponse {
  prediction: PredictionResult;
  homeTeamStats: TeamStats | null;
  awayTeamStats: TeamStats | null;
  h2hStats: {
    totalMatches: number;
    homeTeamWins: number;
    draws: number;
    awayTeamWins: number;
    avgGoals: number;
  };
  patternAnalysis: PatternAnalysis;
  leagueInsights: LeagueInsights;
}

// Available seasons
// 11 seasons from 2015-16 to 2025-26
const ALL_SEASONS = ['2526', '2425', '2324', '2223', '2122', '2021', '1920', '1819', '1718', '1617', '1516'];

// In-memory cache
const cache = new Map<string, { data: MatchResult[]; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000;

async function fetchSeasonData(league: string, season: string): Promise<MatchResult[]> {
  const cacheKey = `${league}-${season}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  const url = `https://www.football-data.co.uk/mmz4281/${season}/${league}.csv`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return [];
    }

    const csvText = await response.text();
    const results = parseCSV(csvText, season);

    cache.set(cacheKey, { data: results, timestamp: Date.now() });
    return results;
  } catch (error) {
    console.error(`Error fetching ${season}:`, error);
    return [];
  }
}

// Poisson random number generator
function poissonRandom(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  
  return k - 1;
}

// Calculate team statistics
function calculateTeamStats(matches: MatchResult[]): Map<string, TeamStats> {
  const teams = new Map<string, TeamStats>();
  
  if (matches.length === 0) return teams;
  
  // Calculate league averages
  const leagueHomeGoals = matches.reduce((sum, m) => sum + m.ftHomeGoals, 0) / matches.length;
  const leagueAwayGoals = matches.reduce((sum, m) => sum + m.ftAwayGoals, 0) / matches.length;
  const leagueAvgGoals = leagueHomeGoals + leagueAwayGoals;
  
  // Initialize team data
  const teamData = new Map<string, {
    homeGoals: number;
    homeConceded: number;
    homeGames: number;
    awayGoals: number;
    awayConceded: number;
    awayGames: number;
    wins: number;
    draws: number;
    losses: number;
    form: { result: 'W' | 'D' | 'L'; gf: number; ga: number; date: string }[];
    bttsFullTime: number;
    bttsFirstHalf: number;
    bttsSecondHalf: number;
    over25: number;
    over35: number;
  }>();
  
  for (const match of matches) {
    // Home team
    if (!teamData.has(match.homeTeam)) {
      teamData.set(match.homeTeam, {
        homeGoals: 0, homeConceded: 0, homeGames: 0,
        awayGoals: 0, awayConceded: 0, awayGames: 0,
        wins: 0, draws: 0, losses: 0,
        form: [],
        bttsFullTime: 0, bttsFirstHalf: 0, bttsSecondHalf: 0,
        over25: 0, over35: 0,
      });
    }
    
    // Away team
    if (!teamData.has(match.awayTeam)) {
      teamData.set(match.awayTeam, {
        homeGoals: 0, homeConceded: 0, homeGames: 0,
        awayGoals: 0, awayConceded: 0, awayGames: 0,
        wins: 0, draws: 0, losses: 0,
        form: [],
        bttsFullTime: 0, bttsFirstHalf: 0, bttsSecondHalf: 0,
        over25: 0, over35: 0,
      });
    }
    
    const homeData = teamData.get(match.homeTeam)!;
    const awayData = teamData.get(match.awayTeam)!;
    
    // Home stats
    homeData.homeGoals += match.ftHomeGoals;
    homeData.homeConceded += match.ftAwayGoals;
    homeData.homeGames++;
    
    // Away stats
    awayData.awayGoals += match.ftAwayGoals;
    awayData.awayConceded += match.ftHomeGoals;
    awayData.awayGames++;
    
    // Results
    if (match.ftResult === 'H') {
      homeData.wins++;
      awayData.losses++;
      homeData.form.push({ result: 'W', gf: match.ftHomeGoals, ga: match.ftAwayGoals, date: match.date });
      awayData.form.push({ result: 'L', gf: match.ftAwayGoals, ga: match.ftHomeGoals, date: match.date });
    } else if (match.ftResult === 'A') {
      awayData.wins++;
      homeData.losses++;
      homeData.form.push({ result: 'L', gf: match.ftHomeGoals, ga: match.ftAwayGoals, date: match.date });
      awayData.form.push({ result: 'W', gf: match.ftAwayGoals, ga: match.ftHomeGoals, date: match.date });
    } else {
      homeData.draws++;
      awayData.draws++;
      homeData.form.push({ result: 'D', gf: match.ftHomeGoals, ga: match.ftAwayGoals, date: match.date });
      awayData.form.push({ result: 'D', gf: match.ftAwayGoals, ga: match.ftHomeGoals, date: match.date });
    }
    
    // BTTS patterns
    const bttsFT = match.ftHomeGoals > 0 && match.ftAwayGoals > 0;
    const bttsHT = match.htHomeGoals > 0 && match.htAwayGoals > 0;
    const shHomeGoals = match.ftHomeGoals - match.htHomeGoals;
    const shAwayGoals = match.ftAwayGoals - match.htAwayGoals;
    const bttsSH = shHomeGoals > 0 && shAwayGoals > 0;
    const totalGoals = match.ftHomeGoals + match.ftAwayGoals;
    
    if (bttsFT) {
      homeData.bttsFullTime++;
      awayData.bttsFullTime++;
    }
    if (bttsHT) {
      homeData.bttsFirstHalf++;
      awayData.bttsFirstHalf++;
    }
    if (bttsSH) {
      homeData.bttsSecondHalf++;
      awayData.bttsSecondHalf++;
    }
    
    // Over/Under
    if (totalGoals > 2.5) {
      homeData.over25++;
      awayData.over25++;
    }
    if (totalGoals > 3.5) {
      homeData.over35++;
      awayData.over35++;
    }
  }
  
  // Calculate final stats
  for (const [team, data] of teamData) {
    const totalGames = data.homeGames + data.awayGames;
    const totalGoalsScored = data.homeGoals + data.awayGoals;
    const totalGoalsConceded = data.homeConceded + data.awayConceded;
    
    const avgScored = totalGoalsScored / totalGames;
    const avgConceded = totalGoalsConceded / totalGames;
    
    // Attack strength = (goals scored / games) / league avg goals
    const attack = avgScored / (leagueAvgGoals / 2);
    // Defense strength = (goals conceded / games) / league avg goals
    const defense = avgConceded / (leagueAvgGoals / 2);
    
    // Home advantage calculation
    const homeAvg = data.homeGames > 0 ? data.homeGoals / data.homeGames : avgScored;
    const awayAvg = data.awayGames > 0 ? data.awayGoals / data.awayGames : avgScored;
    const homeAdvantage = awayAvg > 0 ? homeAvg / awayAvg : 1.05;
    
    // Recent form (last 5 matches)
    const sortedForm = data.form.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    const recentForm = sortedForm.map(f => f.result);
    const recentGoalsScored = sortedForm.reduce((sum, f) => sum + f.gf, 0);
    const recentGoalsConceded = sortedForm.reduce((sum, f) => sum + f.ga, 0);
    
    teams.set(team, {
      attack: attack || 1,
      defense: defense || 1,
      homeAdvantage: Math.min(Math.max(homeAdvantage, 0.8), 1.3), // Clamp between 0.8 and 1.3
      avgScored,
      avgConceded,
      homeScored: data.homeGames > 0 ? data.homeGoals / data.homeGames : 0,
      homeConceded: data.homeGames > 0 ? data.homeConceded / data.homeGames : 0,
      awayScored: data.awayGames > 0 ? data.awayGoals / data.awayGames : 0,
      awayConceded: data.awayGames > 0 ? data.awayConceded / data.awayGames : 0,
      homeGames: data.homeGames,
      awayGames: data.awayGames,
      totalGames,
      wins: data.wins,
      draws: data.draws,
      losses: data.losses,
      recentForm,
      recentGoalsScored,
      recentGoalsConceded,
      bttsFullTime: data.bttsFullTime,
      bttsFirstHalf: data.bttsFirstHalf,
      bttsSecondHalf: data.bttsSecondHalf,
      over25: data.over25,
      over35: data.over35,
    });
  }
  
  return teams;
}

// Calculate implied odds from probability
function calculateImpliedOdds(probability: number): number {
  if (probability <= 0) return 999;
  if (probability >= 100) return 1;
  return Math.round((100 / probability) * 100) / 100;
}

// Run Monte Carlo simulation
function runMonteCarlo(
  lambdaHome: number,
  lambdaAway: number,
  iterations: number = 100000
): PredictionResult {
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let over05Count = 0;
  let over15Count = 0;
  let over25Count = 0;
  let over35Count = 0;
  let bttsCount = 0;
  
  const scoreCounts = new Map<string, number>();
  
  // Halftime simulation (typically ~45% of full-time goals)
  const htLambdaHome = lambdaHome * 0.45;
  const htLambdaAway = lambdaAway * 0.45;
  
  let htHomeWins = 0;
  let htDraws = 0;
  let htAwayWins = 0;
  const htScoreCounts = new Map<string, number>();
  
  for (let i = 0; i < iterations; i++) {
    // Full-time simulation
    const homeGoals = poissonRandom(lambdaHome);
    const awayGoals = poissonRandom(lambdaAway);
    
    if (homeGoals > awayGoals) homeWins++;
    else if (awayGoals > homeGoals) awayWins++;
    else draws++;
    
    const totalGoals = homeGoals + awayGoals;
    if (totalGoals > 0.5) over05Count++;
    if (totalGoals > 1.5) over15Count++;
    if (totalGoals > 2.5) over25Count++;
    if (totalGoals > 3.5) over35Count++;
    if (homeGoals > 0 && awayGoals > 0) bttsCount++;
    
    const scoreKey = `${homeGoals}-${awayGoals}`;
    scoreCounts.set(scoreKey, (scoreCounts.get(scoreKey) || 0) + 1);
    
    // Halftime simulation
    const htHomeGoals = poissonRandom(htLambdaHome);
    const htAwayGoals = poissonRandom(htLambdaAway);
    
    if (htHomeGoals > htAwayGoals) htHomeWins++;
    else if (htAwayGoals > htHomeGoals) htAwayWins++;
    else htDraws++;
    
    const htScoreKey = `${htHomeGoals}-${htAwayGoals}`;
    htScoreCounts.set(htScoreKey, (htScoreCounts.get(htScoreKey) || 0) + 1);
  }
  
  // Find most likely full-time score
  let likelyScore = '0-0';
  let maxCount = 0;
  for (const [score, count] of scoreCounts) {
    if (count > maxCount) {
      maxCount = count;
      likelyScore = score;
    }
  }
  
  // Find most likely halftime score
  let htLikelyScore = '0-0';
  let htMaxCount = 0;
  for (const [score, count] of htScoreCounts) {
    if (count > htMaxCount) {
      htMaxCount = count;
      htLikelyScore = score;
    }
  }
  
  // Get top scores
  const sortedScores = Array.from(scoreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([score, count]) => ({
      score,
      prob: Math.round((count / iterations) * 1000) / 10,
    }));
  
  const htSortedScores = Array.from(htScoreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([score, count]) => ({
      score,
      prob: Math.round((count / iterations) * 1000) / 10,
    }));
  
  // Calculate probabilities
  const homeWinProb = (homeWins / iterations) * 100;
  const drawProb = (draws / iterations) * 100;
  const awayWinProb = (awayWins / iterations) * 100;
  const over05Prob = (over05Count / iterations) * 100;
  const over15Prob = (over15Count / iterations) * 100;
  const over25Prob = (over25Count / iterations) * 100;
  const over35Prob = (over35Count / iterations) * 100;
  const bttsProb = (bttsCount / iterations) * 100;
  const htHomeWinProb = (htHomeWins / iterations) * 100;
  const htDrawProb = (htDraws / iterations) * 100;
  const htAwayWinProb = (htAwayWins / iterations) * 100;
  
  // Calculate confidence
  let confidence: 'high' | 'medium' | 'low' = 'low';
  let confidenceReason = '';
  
  const maxProb = Math.max(homeWinProb, drawProb, awayWinProb);
  
  if (maxProb > 55) {
    confidence = 'high';
    confidenceReason = maxProb === homeWinProb ? 'Strong home win probability based on statistical analysis' : 'Strong away win probability based on statistical analysis';
  } else if (maxProb > 45) {
    confidence = 'medium';
    confidenceReason = 'Moderate confidence - one outcome has a notable edge';
  } else {
    confidence = 'low';
    confidenceReason = 'Close matchup - outcomes are relatively evenly distributed';
  }
  
  return {
    homeWin: Math.round(homeWinProb * 10) / 10,
    draw: Math.round(drawProb * 10) / 10,
    awayWin: Math.round(awayWinProb * 10) / 10,
    homeXg: Math.round(lambdaHome * 100) / 100,
    awayXg: Math.round(lambdaAway * 100) / 100,
    likelyScore,
    likelyScoreProb: Math.round((maxCount / iterations) * 1000) / 10,
    over25: Math.round(over25Prob * 10) / 10,
    over35: Math.round(over35Prob * 10) / 10,
    over15: Math.round(over15Prob * 10) / 10,
    over05: Math.round(over05Prob * 10) / 10,
    btts: Math.round(bttsProb * 10) / 10,
    scoreMatrix: sortedScores,
    confidence,
    confidenceReason,
    // Halftime predictions
    htHomeWin: Math.round(htHomeWinProb * 10) / 10,
    htDraw: Math.round(htDrawProb * 10) / 10,
    htAwayWin: Math.round(htAwayWinProb * 10) / 10,
    htHomeXg: Math.round(htLambdaHome * 100) / 100,
    htAwayXg: Math.round(htLambdaAway * 100) / 100,
    htLikelyScore,
    htLikelyScoreProb: Math.round((htMaxCount / iterations) * 1000) / 10,
    htScoreMatrix: htSortedScores,
    // Implied odds
    impliedOdds: {
      homeWin: calculateImpliedOdds(homeWinProb),
      draw: calculateImpliedOdds(drawProb),
      awayWin: calculateImpliedOdds(awayWinProb),
      over25: calculateImpliedOdds(over25Prob),
      under25: calculateImpliedOdds(100 - over25Prob),
      over35: calculateImpliedOdds(over35Prob),
      under35: calculateImpliedOdds(100 - over35Prob),
      over15: calculateImpliedOdds(over15Prob),
      under15: calculateImpliedOdds(100 - over15Prob),
      over05: calculateImpliedOdds(over05Prob),
      under05: calculateImpliedOdds(100 - over05Prob),
      bttsYes: calculateImpliedOdds(bttsProb),
      bttsNo: calculateImpliedOdds(100 - bttsProb),
      htHomeWin: calculateImpliedOdds(htHomeWinProb),
      htDraw: calculateImpliedOdds(htDrawProb),
      htAwayWin: calculateImpliedOdds(htAwayWinProb),
    },
  };
}

// Calculate pattern analysis
function calculatePatterns(matches: MatchResult[]): PatternAnalysis {
  let bothHalves = 0;
  let firstHalfOnly = 0;
  let secondHalfOnly = 0;
  let neitherHalf = 0;
  let firstHalfGoals = 0;
  let secondHalfGoals = 0;
  
  // HT/FT transitions
  let htHomeLeadFtHomeWin = 0;
  let htHomeLeadFtDraw = 0;
  let htHomeLeadFtAwayWin = 0;
  let htDrawFtHomeWin = 0;
  let htDrawFtDraw = 0;
  let htDrawFtAwayWin = 0;
  let htAwayLeadFtHomeWin = 0;
  let htAwayLeadFtDraw = 0;
  let htAwayLeadFtAwayWin = 0;
  
  let comebacks = 0;
  
  for (const match of matches) {
    const bttsHT = match.htHomeGoals > 0 && match.htAwayGoals > 0;
    const shHomeGoals = match.ftHomeGoals - match.htHomeGoals;
    const shAwayGoals = match.ftAwayGoals - match.htAwayGoals;
    const bttsSH = shHomeGoals > 0 && shAwayGoals > 0;
    
    if (bttsHT && bttsSH) bothHalves++;
    else if (bttsHT) firstHalfOnly++;
    else if (bttsSH) secondHalfOnly++;
    else neitherHalf++;
    
    firstHalfGoals += match.htHomeGoals + match.htAwayGoals;
    secondHalfGoals += shHomeGoals + shAwayGoals;
    
    // HT/FT transitions
    if (match.htResult === 'H') {
      if (match.ftResult === 'H') htHomeLeadFtHomeWin++;
      else if (match.ftResult === 'D') htHomeLeadFtDraw++;
      else htHomeLeadFtAwayWin++;
    } else if (match.htResult === 'D') {
      if (match.ftResult === 'H') htDrawFtHomeWin++;
      else if (match.ftResult === 'D') htDrawFtDraw++;
      else htDrawFtAwayWin++;
    } else {
      if (match.ftResult === 'H') htAwayLeadFtHomeWin++;
      else if (match.ftResult === 'D') htAwayLeadFtDraw++;
      else htAwayLeadFtAwayWin++;
    }
    
    // Comebacks (HT lead changes to FT opposite)
    if ((match.htResult === 'H' && match.ftResult === 'A') ||
        (match.htResult === 'A' && match.ftResult === 'H')) {
      comebacks++;
    }
  }
  
  const total = matches.length || 1;
  
  return {
    bttsPatterns: {
      bothHalves: Math.round((bothHalves / total) * 1000) / 10,
      firstHalfOnly: Math.round((firstHalfOnly / total) * 1000) / 10,
      secondHalfOnly: Math.round((secondHalfOnly / total) * 1000) / 10,
      neitherHalf: Math.round((neitherHalf / total) * 1000) / 10,
    },
    goalTiming: {
      firstHalfGoals,
      secondHalfGoals,
      avgFirstHalfGoals: Math.round((firstHalfGoals / total) * 100) / 100,
      avgSecondHalfGoals: Math.round((secondHalfGoals / total) * 100) / 100,
    },
    resultTransitions: {
      htHomeLeadFtHomeWin: Math.round((htHomeLeadFtHomeWin / total) * 1000) / 10,
      htHomeLeadFtDraw: Math.round((htHomeLeadFtDraw / total) * 1000) / 10,
      htHomeLeadFtAwayWin: Math.round((htHomeLeadFtAwayWin / total) * 1000) / 10,
      htDrawFtHomeWin: Math.round((htDrawFtHomeWin / total) * 1000) / 10,
      htDrawFtDraw: Math.round((htDrawFtDraw / total) * 1000) / 10,
      htDrawFtAwayWin: Math.round((htDrawFtAwayWin / total) * 1000) / 10,
      htAwayLeadFtHomeWin: Math.round((htAwayLeadFtHomeWin / total) * 1000) / 10,
      htAwayLeadFtDraw: Math.round((htAwayLeadFtDraw / total) * 1000) / 10,
      htAwayLeadFtAwayWin: Math.round((htAwayLeadFtAwayWin / total) * 1000) / 10,
    },
    comebackRate: Math.round((comebacks / total) * 1000) / 10,
    scoringStreaks: {
      currentScoringStreak: 0, // Would need match-by-match analysis
      currentConcedingStreak: 0,
    },
  };
}

// Calculate league insights
function calculateLeagueInsights(matches: MatchResult[], teamStats: Map<string, TeamStats>): LeagueInsights {
  const totalGoals = matches.reduce((sum, m) => sum + m.ftHomeGoals + m.ftAwayGoals, 0);
  const homeGoals = matches.reduce((sum, m) => sum + m.ftHomeGoals, 0);
  const awayGoals = matches.reduce((sum, m) => sum + m.ftAwayGoals, 0);
  const homeWins = matches.filter(m => m.ftResult === 'H').length;
  const draws = matches.filter(m => m.ftResult === 'D').length;
  const awayWins = matches.filter(m => m.ftResult === 'A').length;
  const btts = matches.filter(m => m.ftHomeGoals > 0 && m.ftAwayGoals > 0).length;
  const over25 = matches.filter(m => m.ftHomeGoals + m.ftAwayGoals > 2.5).length;
  
  const total = matches.length || 1;
  
  // Find best attack/defense
  let bestAttack = { team: '', avg: 0 };
  let bestDefense = { team: '', avg: Infinity };
  
  for (const [team, stats] of teamStats) {
    if (stats.totalGames >= 5) { // At least 5 games
      if (stats.avgScored > bestAttack.avg) {
        bestAttack = { team, avg: stats.avgScored };
      }
      if (stats.avgConceded < bestDefense.avg) {
        bestDefense = { team, avg: stats.avgConceded };
      }
    }
  }
  
  return {
    avgGoalsPerGame: Math.round((totalGoals / total) * 100) / 100,
    avgHomeGoals: Math.round((homeGoals / total) * 100) / 100,
    avgAwayGoals: Math.round((awayGoals / total) * 100) / 100,
    homeWinPercent: Math.round((homeWins / total) * 1000) / 10,
    drawPercent: Math.round((draws / total) * 1000) / 10,
    awayWinPercent: Math.round((awayWins / total) * 1000) / 10,
    bttsPercent: Math.round((btts / total) * 1000) / 10,
    over25Percent: Math.round((over25 / total) * 1000) / 10,
    bestAttack,
    bestDefense,
    totalMatches: matches.length,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const league = searchParams.get('league');
  const season = searchParams.get('season');
  const homeTeam = searchParams.get('homeTeam');
  const awayTeam = searchParams.get('awayTeam');

  if (!league || !season) {
    return NextResponse.json(
      { error: 'Missing required parameters: league and season' },
      { status: 400 }
    );
  }

  if (!homeTeam || !awayTeam) {
    return NextResponse.json(
      { error: 'Missing required parameters: homeTeam and awayTeam' },
      { status: 400 }
    );
  }

  if (homeTeam === awayTeam) {
    return NextResponse.json(
      { error: 'Home team and away team must be different' },
      { status: 400 }
    );
  }

  try {
    // Fetch all match data
    let allMatches: MatchResult[] = [];
    
    if (season === 'all') {
      const seasonPromises = ALL_SEASONS.map(s => fetchSeasonData(league, s));
      const seasonResults = await Promise.all(seasonPromises);
      allMatches = seasonResults.flat();
    } else {
      allMatches = await fetchSeasonData(league, season);
    }

    if (allMatches.length === 0) {
      return NextResponse.json(
        { error: 'No match data available for the selected league and season' },
        { status: 404 }
      );
    }

    // Calculate team statistics
    const teamStats = calculateTeamStats(allMatches);
    
    const homeStats = teamStats.get(homeTeam);
    const awayStats = teamStats.get(awayTeam);
    
    if (!homeStats || !awayStats) {
      return NextResponse.json(
        { error: `Team not found: ${!homeStats ? homeTeam : awayTeam}` },
        { status: 404 }
      );
    }

    // Calculate league averages for xG calculation
    const leagueHomeAvg = allMatches.reduce((sum, m) => sum + m.ftHomeGoals, 0) / allMatches.length;
    const leagueAwayAvg = allMatches.reduce((sum, m) => sum + m.ftAwayGoals, 0) / allMatches.length;

    // Calculate expected goals using attack/defense strengths
    // λ_home = home_attack * away_defense * league_home_avg * home_advantage
    const lambdaHome = homeStats.attack * awayStats.defense * leagueHomeAvg * homeStats.homeAdvantage;
    // λ_away = away_attack * home_defense * league_away_avg
    const lambdaAway = awayStats.attack * homeStats.defense * leagueAwayAvg;

    // Run Monte Carlo simulation
    const prediction = runMonteCarlo(lambdaHome, lambdaAway, 100000);

    // H2H stats
    const h2hMatches = allMatches.filter(
      m => (m.homeTeam === homeTeam && m.awayTeam === awayTeam) ||
           (m.homeTeam === awayTeam && m.awayTeam === homeTeam)
    );
    
    let homeTeamWins = 0;
    let draws = 0;
    let awayTeamWins = 0;
    
    for (const m of h2hMatches) {
      if (m.ftResult === 'D') {
        draws++;
      } else if (m.homeTeam === homeTeam) {
        if (m.ftResult === 'H') homeTeamWins++;
        else awayTeamWins++;
      } else {
        if (m.ftResult === 'A') homeTeamWins++;
        else awayTeamWins++;
      }
    }
    
    const h2hStats = {
      totalMatches: h2hMatches.length,
      homeTeamWins,
      draws,
      awayTeamWins,
      avgGoals: h2hMatches.length > 0 
        ? Math.round((h2hMatches.reduce((sum, m) => sum + m.ftHomeGoals + m.ftAwayGoals, 0) / h2hMatches.length) * 100) / 100
        : 0,
    };

    // Pattern analysis
    const patternAnalysis = calculatePatterns(allMatches);
    
    // League insights
    const leagueInsights = calculateLeagueInsights(allMatches, teamStats);

    const response: PredictionResponse = {
      prediction,
      homeTeamStats: homeStats,
      awayTeamStats: awayStats,
      h2hStats,
      patternAnalysis,
      leagueInsights,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error generating prediction:', error);
    return NextResponse.json(
      { error: 'Failed to generate prediction' },
      { status: 500 }
    );
  }
}
