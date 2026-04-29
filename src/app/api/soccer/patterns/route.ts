import { NextRequest, NextResponse } from 'next/server';
import { MatchResult, parseCSV } from '../results/route';

// Types for pattern analysis
interface TeamPatternAnalysis {
  team: string;
  totalMatches: number;
  
  // Scoring Patterns
  scoringPatterns: {
    avgGoalsPerGame: number;
    avgFirstHalfGoals: number;
    avgSecondHalfGoals: number;
    goalsScoredInFirstHalf: number;  // % of matches where team scored in 1st half
    goalsScoredInSecondHalf: number; // % of matches where team scored in 2nd half
    failedToScore: number;           // % of matches where team failed to score
    scored2Plus: number;             // % of matches where team scored 2+ goals
  };
  
  // Conceding Patterns
  concedingPatterns: {
    avgConcededPerGame: number;
    cleanSheets: number;             // % of matches with clean sheet
    concededBothHalves: number;      // % of matches where conceded in both halves
    conceded2Plus: number;           // % of matches where conceded 2+ goals
  };
  
  // BTTS Patterns
  bttsPatterns: {
    bttsFullTime: number;            // % of matches with BTTS
    bttsFirstHalf: number;           // % of matches with BTTS in 1st half
    bttsSecondHalf: number;          // % of matches with BTTS in 2nd half
    bttsBothHalves: number;          // % of matches with BTTS in both halves
    bttsWin: number;                 // % of BTTS matches where team won
    bttsLoss: number;                // % of BTTS matches where team lost
  };
  
  // Over/Under Patterns
  overUnderPatterns: {
    over05: number;                  // % over 0.5 goals in match
    over15: number;                  // % over 1.5 goals in match
    over25: number;                  // % over 2.5 goals in match
    over35: number;                  // % over 3.5 goals in match
    over45: number;                  // % over 4.5 goals in match
  };
  
  // Result Patterns
  resultPatterns: {
    winPercent: number;
    drawPercent: number;
    lossPercent: number;
    winToNil: number;                // % wins with clean sheet
    lossToNil: number;               // % losses without scoring
    avgPointsPerGame: number;
  };
  
  // HT/FT Patterns
  htFtPatterns: {
    htWinFtWin: number;              // Led at HT, won at FT
    htWinFtDraw: number;             // Led at HT, drew at FT
    htWinFtLoss: number;             // Led at HT, lost at FT (throwaway)
    htDrawFtWin: number;             // Draw at HT, won at FT
    htDrawFtDraw: number;            // Draw at HT, drew at FT
    htDrawFtLoss: number;            // Draw at HT, lost at FT
    htLossFtWin: number;             // Behind at HT, won at FT (comeback)
    htLossFtDraw: number;            // Behind at HT, drew at FT
    htLossFtLoss: number;            // Behind at HT, lost at FT
  };
  
  // Form & Streaks
  formAnalysis: {
    last5: { result: string; gf: number; ga: number }[];
    currentStreak: { type: 'W' | 'D' | 'L' | 'none'; count: number };
    scoringStreak: number;           // Consecutive games scoring
    concedingStreak: number;         // Consecutive games conceding
    unbeatenStreak: number;          // Current/longest unbeaten run
  };
  
  // Home vs Away Splits
  homeAwaySplit: {
    home: {
      games: number;
      wins: number;
      draws: number;
      losses: number;
      goalsScored: number;
      goalsConceded: number;
      avgGoals: number;
      winPercent: number;
    };
    away: {
      games: number;
      wins: number;
      draws: number;
      losses: number;
      goalsScored: number;
      goalsConceded: number;
      avgGoals: number;
      winPercent: number;
    };
  };
}

interface LeaguePatterns {
  totalMatches: number;
  
  // League-wide BTTS
  bttsOverall: number;
  bttsFirstHalf: number;
  bttsSecondHalf: number;
  bttsBothHalves: number;
  
  // Goal timing
  avgFirstHalfGoals: number;
  avgSecondHalfGoals: number;
  firstHalfGoalPercent: number;
  
  // Over/Under distribution
  over25: number;
  over35: number;
  avgGoalsPerGame: number;
  
  // Result distribution
  homeWinPercent: number;
  drawPercent: number;
  awayWinPercent: number;
  
  // HT/FT patterns
  htFtCorrelation: number;           // % where HT result = FT result
  comebackRate: number;              // % of matches with comeback
  
  // Cards & Fouls
  avgCards: number;
  avgFouls: number;
  
  // Top patterns
  mostBttsTeams: { team: string; percent: number }[];
  mostOver25Teams: { team: string; percent: number }[];
  bestComebackTeams: { team: string; rate: number }[];
}

interface PatternResponse {
  teamPatterns: TeamPatternAnalysis[];
  leaguePatterns: LeaguePatterns;
  // Pattern Alerts (interesting findings)
  alerts: {
    type: 'info' | 'warning' | 'opportunity';
    title: string;
    description: string;
    team?: string;
  }[];
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

    if (!response.ok) return [];

    const csvText = await response.text();
    const results = parseCSV(csvText, season);

    cache.set(cacheKey, { data: results, timestamp: Date.now() });
    return results;
  } catch (error) {
    console.error(`Error fetching ${season}:`, error);
    return [];
  }
}

function analyzeTeamPatterns(matches: MatchResult[], team: string): TeamPatternAnalysis {
  const teamMatches = matches.filter(m => m.homeTeam === team || m.awayTeam === team);
  const totalMatches = teamMatches.length;
  
  if (totalMatches === 0) {
    return createEmptyTeamPattern(team);
  }
  
  let totalGoalsScored = 0;
  let totalGoalsConceded = 0;
  let firstHalfGoalsScored = 0;
  let firstHalfGoalsConceded = 0;
  let secondHalfGoalsScored = 0;
  let secondHalfGoalsConceded = 0;
  
  let scoredInFirstHalf = 0;
  let scoredInSecondHalf = 0;
  let failedToScore = 0;
  let scored2Plus = 0;
  
  let cleanSheets = 0;
  let concededBothHalves = 0;
  let conceded2Plus = 0;
  
  let bttsFullTime = 0;
  let bttsFirstHalf = 0;
  let bttsSecondHalf = 0;
  let bttsBothHalves = 0;
  let bttsWins = 0;
  let bttsLosses = 0;
  
  let over05 = 0, over15 = 0, over25 = 0, over35 = 0, over45 = 0;
  
  let wins = 0, draws = 0, losses = 0;
  let winToNil = 0, lossToNil = 0;
  
  let htWinFtWin = 0, htWinFtDraw = 0, htWinFtLoss = 0;
  let htDrawFtWin = 0, htDrawFtDraw = 0, htDrawFtLoss = 0;
  let htLossFtWin = 0, htLossFtDraw = 0, htLossFtLoss = 0;
  
  const form: { result: string; gf: number; ga: number; date: string }[] = [];
  
  // Home/Away splits
  let homeGames = 0, homeWins = 0, homeDraws = 0, homeLosses = 0;
  let homeGoalsScored = 0, homeGoalsConceded = 0;
  let awayGames = 0, awayWins = 0, awayDraws = 0, awayLosses = 0;
  let awayGoalsScored = 0, awayGoalsConceded = 0;
  
  for (const match of teamMatches) {
    const isHome = match.homeTeam === team;
    
    const goalsScored = isHome ? match.ftHomeGoals : match.ftAwayGoals;
    const goalsConceded = isHome ? match.ftAwayGoals : match.ftHomeGoals;
    const htGoalsScored = isHome ? match.htHomeGoals : match.htAwayGoals;
    const htGoalsConceded = isHome ? match.htAwayGoals : match.htHomeGoals;
    const shGoalsScored = goalsScored - htGoalsScored;
    const shGoalsConceded = goalsConceded - htGoalsConceded;
    
    totalGoalsScored += goalsScored;
    totalGoalsConceded += goalsConceded;
    firstHalfGoalsScored += htGoalsScored;
    firstHalfGoalsConceded += htGoalsConceded;
    secondHalfGoalsScored += shGoalsScored;
    secondHalfGoalsConceded += shGoalsConceded;
    
    // Scoring patterns
    if (htGoalsScored > 0) scoredInFirstHalf++;
    if (shGoalsScored > 0) scoredInSecondHalf++;
    if (goalsScored === 0) failedToScore++;
    if (goalsScored >= 2) scored2Plus++;
    
    // Conceding patterns
    if (goalsConceded === 0) cleanSheets++;
    if (htGoalsConceded > 0 && shGoalsConceded > 0) concededBothHalves++;
    if (goalsConceded >= 2) conceded2Plus++;
    
    // BTTS
    const matchBtts = goalsScored > 0 && goalsConceded > 0;
    const matchBttsHT = htGoalsScored > 0 && htGoalsConceded > 0;
    const matchBttsSH = shGoalsScored > 0 && shGoalsConceded > 0;
    
    if (matchBtts) bttsFullTime++;
    if (matchBttsHT) bttsFirstHalf++;
    if (matchBttsSH) bttsSecondHalf++;
    if (matchBttsHT && matchBttsSH) bttsBothHalves++;
    
    // Over/Under
    const totalGoals = goalsScored + goalsConceded;
    if (totalGoals > 0.5) over05++;
    if (totalGoals > 1.5) over15++;
    if (totalGoals > 2.5) over25++;
    if (totalGoals > 3.5) over35++;
    if (totalGoals > 4.5) over45++;
    
    // Result
    const result = isHome ? match.ftResult : (match.ftResult === 'H' ? 'A' : match.ftResult === 'A' ? 'H' : 'D');
    const htResult = isHome ? match.htResult : (match.htResult === 'H' ? 'A' : match.htResult === 'A' ? 'H' : 'D');
    
    if (result === 'H') {
      wins++;
      form.push({ result: 'W', gf: goalsScored, ga: goalsConceded, date: match.date });
      if (goalsConceded === 0) winToNil++;
      if (matchBtts) bttsWins++;
    } else if (result === 'D') {
      draws++;
      form.push({ result: 'D', gf: goalsScored, ga: goalsConceded, date: match.date });
    } else {
      losses++;
      form.push({ result: 'L', gf: goalsScored, ga: goalsConceded, date: match.date });
      if (goalsScored === 0) lossToNil++;
      if (matchBtts) bttsLosses++;
    }
    
    // HT/FT
    if (htResult === 'H') {
      if (result === 'H') htWinFtWin++;
      else if (result === 'D') htWinFtDraw++;
      else htWinFtLoss++;
    } else if (htResult === 'D') {
      if (result === 'H') htDrawFtWin++;
      else if (result === 'D') htDrawFtDraw++;
      else htDrawFtLoss++;
    } else {
      if (result === 'H') htLossFtWin++;
      else if (result === 'D') htLossFtDraw++;
      else htLossFtLoss++;
    }
    
    // Home/Away
    if (isHome) {
      homeGames++;
      homeGoalsScored += goalsScored;
      homeGoalsConceded += goalsConceded;
      if (result === 'H') homeWins++;
      else if (result === 'D') homeDraws++;
      else homeLosses++;
    } else {
      awayGames++;
      awayGoalsScored += goalsScored;
      awayGoalsConceded += goalsConceded;
      if (result === 'H') awayWins++;
      else if (result === 'D') awayDraws++;
      else awayLosses++;
    }
  }
  
  // Sort form by date (parse DD/MM/YY or DD/MM/YYYY format correctly)
  const parseFormDate = (d: string) => {
    if (!d) return 0;
    const parts = d.split('/');
    if (parts.length === 3) {
      let y = parseInt(parts[2]);
      if (y < 100) y += y < 50 ? 2000 : 1900;
      return new Date(y, parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
    }
    return new Date(d).getTime();
  };
  form.sort((a, b) => parseFormDate(b.date) - parseFormDate(a.date));
  const last5 = form.slice(0, 5);
  
  // Calculate streaks
  let currentStreakType: 'W' | 'D' | 'L' | 'none' = 'none';
  let currentStreakCount = 0;
  
  for (const f of form) {
    if (currentStreakType === 'none') {
      currentStreakType = f.result as 'W' | 'D' | 'L';
      currentStreakCount = 1;
    } else if (f.result === currentStreakType) {
      currentStreakCount++;
    } else {
      break;
    }
  }
  
  // Calculate scoring/conceding streaks
  let scoringStreak = 0;
  let concedingStreak = 0;
  
  for (const f of form) {
    if (f.gf > 0) scoringStreak++;
    else break;
  }
  
  for (const f of form) {
    if (f.ga > 0) concedingStreak++;
    else break;
  }
  
  const t = totalMatches;
  
  return {
    team,
    totalMatches,
    scoringPatterns: {
      avgGoalsPerGame: Math.round((totalGoalsScored / t) * 100) / 100,
      avgFirstHalfGoals: Math.round((firstHalfGoalsScored / t) * 100) / 100,
      avgSecondHalfGoals: Math.round((secondHalfGoalsScored / t) * 100) / 100,
      goalsScoredInFirstHalf: Math.round((scoredInFirstHalf / t) * 1000) / 10,
      goalsScoredInSecondHalf: Math.round((scoredInSecondHalf / t) * 1000) / 10,
      failedToScore: Math.round((failedToScore / t) * 1000) / 10,
      scored2Plus: Math.round((scored2Plus / t) * 1000) / 10,
    },
    concedingPatterns: {
      avgConcededPerGame: Math.round((totalGoalsConceded / t) * 100) / 100,
      cleanSheets: Math.round((cleanSheets / t) * 1000) / 10,
      concededBothHalves: Math.round((concededBothHalves / t) * 1000) / 10,
      conceded2Plus: Math.round((conceded2Plus / t) * 1000) / 10,
    },
    bttsPatterns: {
      bttsFullTime: Math.round((bttsFullTime / t) * 1000) / 10,
      bttsFirstHalf: Math.round((bttsFirstHalf / t) * 1000) / 10,
      bttsSecondHalf: Math.round((bttsSecondHalf / t) * 1000) / 10,
      bttsBothHalves: Math.round((bttsBothHalves / t) * 1000) / 10,
      bttsWin: bttsFullTime > 0 ? Math.round((bttsWins / bttsFullTime) * 1000) / 10 : 0,
      bttsLoss: bttsFullTime > 0 ? Math.round((bttsLosses / bttsFullTime) * 1000) / 10 : 0,
    },
    overUnderPatterns: {
      over05: Math.round((over05 / t) * 1000) / 10,
      over15: Math.round((over15 / t) * 1000) / 10,
      over25: Math.round((over25 / t) * 1000) / 10,
      over35: Math.round((over35 / t) * 1000) / 10,
      over45: Math.round((over45 / t) * 1000) / 10,
    },
    resultPatterns: {
      winPercent: Math.round((wins / t) * 1000) / 10,
      drawPercent: Math.round((draws / t) * 1000) / 10,
      lossPercent: Math.round((losses / t) * 1000) / 10,
      winToNil: Math.round((winToNil / t) * 1000) / 10,
      lossToNil: Math.round((lossToNil / t) * 1000) / 10,
      avgPointsPerGame: Math.round(((wins * 3 + draws) / t) * 100) / 100,
    },
    htFtPatterns: {
      htWinFtWin: Math.round((htWinFtWin / t) * 1000) / 10,
      htWinFtDraw: Math.round((htWinFtDraw / t) * 1000) / 10,
      htWinFtLoss: Math.round((htWinFtLoss / t) * 1000) / 10,
      htDrawFtWin: Math.round((htDrawFtWin / t) * 1000) / 10,
      htDrawFtDraw: Math.round((htDrawFtDraw / t) * 1000) / 10,
      htDrawFtLoss: Math.round((htDrawFtLoss / t) * 1000) / 10,
      htLossFtWin: Math.round((htLossFtWin / t) * 1000) / 10,
      htLossFtDraw: Math.round((htLossFtDraw / t) * 1000) / 10,
      htLossFtLoss: Math.round((htLossFtLoss / t) * 1000) / 10,
    },
    formAnalysis: {
      last5: last5.map(f => ({ result: f.result, gf: f.gf, ga: f.ga })),
      currentStreak: { type: currentStreakType, count: currentStreakCount },
      scoringStreak,
      concedingStreak,
      unbeatenStreak: currentStreakType === 'W' || currentStreakType === 'D' ? currentStreakCount : 0,
    },
    homeAwaySplit: {
      home: {
        games: homeGames,
        wins: homeWins,
        draws: homeDraws,
        losses: homeLosses,
        goalsScored: homeGoalsScored,
        goalsConceded: homeGoalsConceded,
        avgGoals: homeGames > 0 ? Math.round((homeGoalsScored / homeGames) * 100) / 100 : 0,
        winPercent: homeGames > 0 ? Math.round((homeWins / homeGames) * 1000) / 10 : 0,
      },
      away: {
        games: awayGames,
        wins: awayWins,
        draws: awayDraws,
        losses: awayLosses,
        goalsScored: awayGoalsScored,
        goalsConceded: awayGoalsConceded,
        avgGoals: awayGames > 0 ? Math.round((awayGoalsScored / awayGames) * 100) / 100 : 0,
        winPercent: awayGames > 0 ? Math.round((awayWins / awayGames) * 1000) / 10 : 0,
      },
    },
  };
}

function createEmptyTeamPattern(team: string): TeamPatternAnalysis {
  return {
    team,
    totalMatches: 0,
    scoringPatterns: {
      avgGoalsPerGame: 0, avgFirstHalfGoals: 0, avgSecondHalfGoals: 0,
      goalsScoredInFirstHalf: 0, goalsScoredInSecondHalf: 0, failedToScore: 0, scored2Plus: 0,
    },
    concedingPatterns: {
      avgConcededPerGame: 0, cleanSheets: 0, concededBothHalves: 0, conceded2Plus: 0,
    },
    bttsPatterns: {
      bttsFullTime: 0, bttsFirstHalf: 0, bttsSecondHalf: 0, bttsBothHalves: 0, bttsWin: 0, bttsLoss: 0,
    },
    overUnderPatterns: { over05: 0, over15: 0, over25: 0, over35: 0, over45: 0 },
    resultPatterns: { winPercent: 0, drawPercent: 0, lossPercent: 0, winToNil: 0, lossToNil: 0, avgPointsPerGame: 0 },
    htFtPatterns: {
      htWinFtWin: 0, htWinFtDraw: 0, htWinFtLoss: 0,
      htDrawFtWin: 0, htDrawFtDraw: 0, htDrawFtLoss: 0,
      htLossFtWin: 0, htLossFtDraw: 0, htLossFtLoss: 0,
    },
    formAnalysis: {
      last5: [], currentStreak: { type: 'none', count: 0 }, scoringStreak: 0, concedingStreak: 0, unbeatenStreak: 0,
    },
    homeAwaySplit: {
      home: { games: 0, wins: 0, draws: 0, losses: 0, goalsScored: 0, goalsConceded: 0, avgGoals: 0, winPercent: 0 },
      away: { games: 0, wins: 0, draws: 0, losses: 0, goalsScored: 0, goalsConceded: 0, avgGoals: 0, winPercent: 0 },
    },
  };
}

function analyzeLeaguePatterns(matches: MatchResult[]): LeaguePatterns {
  const total = matches.length || 1;
  
  let bttsCount = 0;
  let bttsHTCount = 0;
  let bttsSHCount = 0;
  let bttsBothCount = 0;
  
  let firstHalfGoals = 0;
  let secondHalfGoals = 0;
  
  let over25Count = 0;
  let over35Count = 0;
  let totalGoals = 0;
  
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  
  let htFtCorrelation = 0;
  let comebacks = 0;
  
  let totalCards = 0;
  let totalFouls = 0;
  
  for (const match of matches) {
    const fhGoals = match.htHomeGoals + match.htAwayGoals;
    const shGoals = (match.ftHomeGoals - match.htHomeGoals) + (match.ftAwayGoals - match.htAwayGoals);
    const matchGoals = match.ftHomeGoals + match.ftAwayGoals;
    
    // BTTS
    const bttsFT = match.ftHomeGoals > 0 && match.ftAwayGoals > 0;
    const bttsHT = match.htHomeGoals > 0 && match.htAwayGoals > 0;
    const bttsSH = (match.ftHomeGoals - match.htHomeGoals) > 0 && (match.ftAwayGoals - match.htAwayGoals) > 0;
    
    if (bttsFT) bttsCount++;
    if (bttsHT) bttsHTCount++;
    if (bttsSH) bttsSHCount++;
    if (bttsHT && bttsSH) bttsBothCount++;
    
    firstHalfGoals += fhGoals;
    secondHalfGoals += shGoals;
    totalGoals += matchGoals;
    
    if (matchGoals > 2.5) over25Count++;
    if (matchGoals > 3.5) over35Count++;
    
    if (match.ftResult === 'H') homeWins++;
    else if (match.ftResult === 'D') draws++;
    else awayWins++;
    
    if (match.htResult === match.ftResult) htFtCorrelation++;
    
    if ((match.htResult === 'H' && match.ftResult === 'A') ||
        (match.htResult === 'A' && match.ftResult === 'H')) {
      comebacks++;
    }
    
    totalCards += match.homeYellowCards + match.awayYellowCards + match.homeRedCards + match.awayRedCards;
    totalFouls += match.homeFouls + match.awayFouls;
  }
  
  // Get team patterns for top lists
  const teamSet = new Set<string>();
  matches.forEach(m => { teamSet.add(m.homeTeam); teamSet.add(m.awayTeam); });
  
  const teamBtts: { team: string; percent: number }[] = [];
  const teamOver25: { team: string; percent: number }[] = [];
  const teamComeback: { team: string; rate: number }[] = [];
  
  for (const team of teamSet) {
    const teamMatches = matches.filter(m => m.homeTeam === team || m.awayTeam === team);
    const tm = teamMatches.length;
    
    if (tm >= 5) {
      const btts = teamMatches.filter(m => m.ftHomeGoals > 0 && m.ftAwayGoals > 0).length;
      const over25 = teamMatches.filter(m => m.ftHomeGoals + m.ftAwayGoals > 2.5).length;
      
      // Comebacks
      let comebackCount = 0;
      for (const m of teamMatches) {
        const isHome = m.homeTeam === team;
        const htResult = isHome ? m.htResult : (m.htResult === 'H' ? 'A' : m.htResult === 'A' ? 'H' : 'D');
        const ftResult = isHome ? m.ftResult : (m.ftResult === 'H' ? 'A' : m.ftResult === 'A' ? 'H' : 'D');
        
        if (htResult === 'A' && ftResult === 'H') comebackCount++;
      }
      
      teamBtts.push({ team, percent: Math.round((btts / tm) * 1000) / 10 });
      teamOver25.push({ team, percent: Math.round((over25 / tm) * 1000) / 10 });
      teamComeback.push({ team, rate: Math.round((comebackCount / tm) * 1000) / 10 });
    }
  }
  
  return {
    totalMatches: matches.length,
    bttsOverall: Math.round((bttsCount / total) * 1000) / 10,
    bttsFirstHalf: Math.round((bttsHTCount / total) * 1000) / 10,
    bttsSecondHalf: Math.round((bttsSHCount / total) * 1000) / 10,
    bttsBothHalves: Math.round((bttsBothCount / total) * 1000) / 10,
    avgFirstHalfGoals: Math.round((firstHalfGoals / total) * 100) / 100,
    avgSecondHalfGoals: Math.round((secondHalfGoals / total) * 100) / 100,
    firstHalfGoalPercent: Math.round((firstHalfGoals / (firstHalfGoals + secondHalfGoals)) * 1000) / 10,
    over25: Math.round((over25Count / total) * 1000) / 10,
    over35: Math.round((over35Count / total) * 1000) / 10,
    avgGoalsPerGame: Math.round((totalGoals / total) * 100) / 100,
    homeWinPercent: Math.round((homeWins / total) * 1000) / 10,
    drawPercent: Math.round((draws / total) * 1000) / 10,
    awayWinPercent: Math.round((awayWins / total) * 1000) / 10,
    htFtCorrelation: Math.round((htFtCorrelation / total) * 1000) / 10,
    comebackRate: Math.round((comebacks / total) * 1000) / 10,
    avgCards: Math.round((totalCards / total) * 100) / 100,
    avgFouls: Math.round((totalFouls / total) * 100) / 100,
    mostBttsTeams: teamBtts.sort((a, b) => b.percent - a.percent).slice(0, 5),
    mostOver25Teams: teamOver25.sort((a, b) => b.percent - a.percent).slice(0, 5),
    bestComebackTeams: teamComeback.sort((a, b) => b.rate - a.rate).slice(0, 5),
  };
}

function generateAlerts(teamPatterns: TeamPatternAnalysis[], leaguePatterns: LeaguePatterns): PatternResponse['alerts'] {
  const alerts: PatternResponse['alerts'] = [];
  
  for (const team of teamPatterns) {
    // High BTTS both halves
    if (team.bttsPatterns.bttsBothHalves > 25) {
      alerts.push({
        type: 'opportunity',
        title: 'High BTTS Both Halves',
        description: `${team.team} has BTTS in both halves in ${team.bttsPatterns.bttsBothHalves}% of matches - well above average`,
        team: team.team,
      });
    }
    
    // Strong home advantage
    if (team.homeAwaySplit.home.winPercent > 70 && team.homeAwaySplit.home.games >= 5) {
      alerts.push({
        type: 'info',
        title: 'Strong Home Form',
        description: `${team.team} has a ${team.homeAwaySplit.home.winPercent}% win rate at home`,
        team: team.team,
      });
    }
    
    // Poor away form
    if (team.homeAwaySplit.away.winPercent < 20 && team.homeAwaySplit.away.games >= 5) {
      alerts.push({
        type: 'warning',
        title: 'Poor Away Form',
        description: `${team.team} has only a ${team.homeAwaySplit.away.winPercent}% win rate away`,
        team: team.team,
      });
    }
    
    // Comeback specialists
    if (team.htFtPatterns.htLossFtWin > 15) {
      alerts.push({
        type: 'info',
        title: 'Comeback Specialists',
        description: `${team.team} wins ${team.htFtPatterns.htLossFtWin}% of matches after being behind at halftime`,
        team: team.team,
      });
    }
    
    // High scoring team
    if (team.scoringPatterns.avgGoalsPerGame > 2.0) {
      alerts.push({
        type: 'info',
        title: 'High Scoring Team',
        description: `${team.team} averages ${team.scoringPatterns.avgGoalsPerGame} goals per game`,
        team: team.team,
      });
    }
    
    // Solid defense
    if (team.concedingPatterns.cleanSheets > 40) {
      alerts.push({
        type: 'info',
        title: 'Solid Defense',
        description: `${team.team} keeps a clean sheet in ${team.concedingPatterns.cleanSheets}% of matches`,
        team: team.team,
      });
    }
  }
  
  return alerts;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const league = searchParams.get('league');
  const season = searchParams.get('season');
  const team = searchParams.get('team');

  if (!league || !season) {
    return NextResponse.json(
      { error: 'Missing required parameters: league and season' },
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

    // Get unique teams
    const teamSet = new Set<string>();
    allMatches.forEach(m => { teamSet.add(m.homeTeam); teamSet.add(m.awayTeam); });
    
    // Analyze patterns
    let teamPatterns: TeamPatternAnalysis[];
    
    if (team) {
      // Single team analysis
      teamPatterns = [analyzeTeamPatterns(allMatches, team)];
    } else {
      // All teams analysis
      teamPatterns = Array.from(teamSet).map(t => analyzeTeamPatterns(allMatches, t));
    }
    
    const leaguePatterns = analyzeLeaguePatterns(allMatches);
    const alerts = generateAlerts(teamPatterns, leaguePatterns);

    const response: PatternResponse = {
      teamPatterns,
      leaguePatterns,
      alerts,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error analyzing patterns:', error);
    return NextResponse.json(
      { error: 'Failed to analyze patterns' },
      { status: 500 }
    );
  }
}
