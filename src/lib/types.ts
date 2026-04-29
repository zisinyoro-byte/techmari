// ============================================================================
// Shared type definitions for techmari soccer analytics
// Canonical source: deduplicated from page.tsx, API routes, and H2H route
// ============================================================================

// --- League & Fixture Types ---

export interface League {
  code: string;
  name: string;
  country: string;
}

export interface Fixture {
  league: string;
  country: string;
  date: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  oddsHome: number | null;
  oddsDraw: number | null;
  oddsAway: number | null;
  oddsB365Home: number | null;
  oddsB365Draw: number | null;
  oddsB365Away: number | null;
  oddsOver25: number | null;
  oddsUnder25: number | null;
  asianHandicap: number | null;
  oddsAHH: number | null;
  oddsAHA: number | null;
}

export interface FixturesResponse {
  fixtures: Fixture[];
  lastUpdated: string;
  totalFixtures: number;
  leagues: { code: string; name: string; country: string; count: number }[];
}

// --- Match Result Types (canonical from results/route.ts) ---

export interface MatchResult {
  date: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  referee: string;
  // Goals
  ftHomeGoals: number;
  ftAwayGoals: number;
  ftResult: 'H' | 'D' | 'A';
  htHomeGoals: number;
  htAwayGoals: number;
  htResult: 'H' | 'D' | 'A';
  // Match Statistics
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homeCorners: number;
  awayCorners: number;
  homeFouls: number;
  awayFouls: number;
  homeYellowCards: number;
  awayYellowCards: number;
  homeRedCards: number;
  awayRedCards: number;
  // Pre-Match Odds (Match Result) - Average across bookmakers
  oddsAvgHome: number | null;
  oddsAvgDraw: number | null;
  oddsAvgAway: number | null;
  // Bet365 odds
  oddsB365Home: number | null;
  oddsB365Draw: number | null;
  oddsB365Away: number | null;
  // Over/Under 2.5 Goals Odds
  oddsOver25: number | null;
  oddsUnder25: number | null;
  oddsAvgOver25: number | null;
  // Season
  season: string;
}

// --- Head-to-Head Types (canonical from h2h/route.ts) ---

export interface H2HMatch extends MatchResult {
  shHomeGoals: number;
  shAwayGoals: number;
  shResult: 'H' | 'D' | 'A';
  bttsFullTime: boolean;
  bttsFirstHalf: boolean;
  bttsSecondHalf: boolean;
  bttsBothHalves: boolean;
  homeTeamIsHome: boolean;
}

export interface TeamGoalForm {
  last5Overall: { scored: number; conceded: number; matches: number };
  last5Home: { scored: number; conceded: number; matches: number };
  last5Away: { scored: number; conceded: number; matches: number };
  games: { date: string; opponent: string; venue: 'H' | 'A'; scored: number; conceded: number }[];
}

export interface H2HAnalytics {
  totalMatches: number;
  homeTeamWins: number;
  draws: number;
  awayTeamWins: number;
  homeTeamWinPercent: number;
  drawPercent: number;
  awayTeamWinPercent: number;
  totalGoals: number;
  avgGoalsPerGame: number;
  bttsFullTime: { count: number; percent: number };
  bttsFirstHalf: { count: number; percent: number };
  bttsSecondHalf: { count: number; percent: number };
  bttsBothHalves: { count: number; percent: number };
  avgHomeTeamGoals: number;
  avgAwayTeamGoals: number;
  over25Goals: { count: number; percent: number };
  over35Goals: { count: number; percent: number };
  htHomeTeamLeads: number;
  htDraws: number;
  htAwayTeamLeads: number;
  homeTeamComebacks: number;
  awayTeamComebacks: number;
  seasonsCount?: number;
  seasonsPlayed?: string[];
  avgHomeTeamShots: number;
  avgAwayTeamShots: number;
  avgHomeTeamShotsOnTarget: number;
  avgAwayTeamShotsOnTarget: number;
  avgHomeTeamCorners: number;
  avgAwayTeamCorners: number;
  avgHomeTeamFouls: number;
  avgAwayTeamFouls: number;
  totalCards: number;
  oddsAnalysis: {
    matchesWithOdds: number;
    favoriteWins: number;
    favoriteWinPercent: number;
    underdogWins: number;
    underdogWinPercent: number;
    avgHomeTeamWinOdds: number;
    avgDrawOdds: number;
    avgAwayTeamWinOdds: number;
  };
  // H2H Goal Averages
  h2hGoalAverages: {
    team1Home: { scored: number; conceded: number; matches: number };
    team1Away: { scored: number; conceded: number; matches: number };
    team2Home: { scored: number; conceded: number; matches: number };
    team2Away: { scored: number; conceded: number; matches: number };
    overall: { avgTotalGoals: number; avgTeam1Goals: number; avgTeam2Goals: number };
  };
  // Team Form (Goals Focus)
  team1Form: TeamGoalForm;
  team2Form: TeamGoalForm;
  // BTTS Enhanced Analysis
  goalTimingPatterns: {
    firstHalfGoals: number;
    secondHalfGoals: number;
    avgFirstHalfGoals: number;
    avgSecondHalfGoals: number;
    team1FirstHalfGoals: number;
    team1SecondHalfGoals: number;
    team2FirstHalfGoals: number;
    team2SecondHalfGoals: number;
    secondHalfRescueRate: number;
  };
  cleanSheetAnalysis: {
    team1CleanSheets: number;
    team1CleanSheetPercent: number;
    team2CleanSheets: number;
    team2CleanSheetPercent: number;
    team1FailedToScore: number;
    team1FailedToScorePercent: number;
    team2FailedToScore: number;
    team2FailedToScorePercent: number;
    bothTeamsScored: number;
    neitherTeamScored: number;
  };
  scorelineDistribution: {
    scoreline: string;
    count: number;
    percent: number;
    btts: boolean;
  }[];
  defensiveWeakness: {
    team1: {
      avgConceded: number;
      conceded0: number;
      conceded1: number;
      conceded2Plus: number;
      cleanSheetRate: number;
      avgConcededWhenConcedes: number;
    };
    team2: {
      avgConceded: number;
      conceded0: number;
      conceded1: number;
      conceded2Plus: number;
      cleanSheetRate: number;
      avgConcededWhenConcedes: number;
    };
  };
  // BTTS Distribution Analysis
  bttsHomeDistribution: {
    team1Home: { count: number; percent: number };
    team2Home: { count: number; percent: number };
  };
  bttsTimingDistribution: {
    htOnly: { count: number; percent: number; desc: string };
    shOnly: { count: number; percent: number; desc: string };
    bothHalves: { count: number; percent: number; desc: string };
    ftOnly: { count: number; percent: number; desc: string };
  };
}

// --- Analytics Types (canonical from analytics/route.ts) ---

export interface Analytics {
  totalMatches: number;
  homeWinPercent: number;
  drawPercent: number;
  awayWinPercent: number;
  avgGoalsPerGame: number;
  htftCorrelationPercent: number;
  htToftTransitions: {
    htHomeLeads: { ftHomeWin: number; ftDraw: number; ftAwayWin: number };
    htDraw: { ftHomeWin: number; ftDraw: number; ftAwayWin: number };
    htAwayLeads: { ftHomeWin: number; ftDraw: number; ftAwayWin: number };
  };
  resultDistribution: {
    homeWins: number;
    draws: number;
    awayWins: number;
  };
  avgHomeGoals: number;
  avgAwayGoals: number;
  totalGoals: number;
  seasonsCount?: number;
  // Match Statistics
  avgHomeShots: number;
  avgAwayShots: number;
  avgHomeShotsOnTarget: number;
  avgAwayShotsOnTarget: number;
  avgHomeCorners: number;
  avgAwayCorners: number;
  avgHomeFouls: number;
  avgAwayFouls: number;
  avgHomeYellowCards: number;
  avgAwayYellowCards: number;
  totalRedCards: number;
  // Shots Conversion
  homeShotConversion: number;
  awayShotConversion: number;
  homeShotOnTargetConversion: number;
  awayShotOnTargetConversion: number;
  overallShotConversion: number;
  overallShotOnTargetConversion: number;
  // Over/Under 2.5 Analysis
  over25Count: number;
  over25Percent: number;
  under25Count: number;
  under25Percent: number;
  avgTotalGoals: number;
  // Odds Analysis (Value Betting)
  oddsAnalysis: {
    matchesWithOdds: number;
    favoriteWins: number;
    favoriteWinPercent: number;
    underdogWins: number;
    underdogWinPercent: number;
    drawsPercent: number;
    avgHomeOdds: number;
    avgDrawOdds: number;
    avgAwayOdds: number;
    // Implied probability vs actual
    homeWinImpliedProb: number;
    homeWinActualProb: number;
    drawImpliedProb: number;
    drawActualProb: number;
    awayWinImpliedProb: number;
    awayWinActualProb: number;
  };
}

// --- Prediction Types (canonical from predict/route.ts) ---

export interface TeamStats {
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

export interface PredictionResult {
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

export interface PatternAnalysis {
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

export interface LeagueInsights {
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

export interface PredictionResponse {
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

// --- League Averages (used by backtest prediction model) ---

export interface LeagueAverages {
  avgHomeGoals: number;
  avgAwayGoals: number;
  avgTotalGoals: number;
  homeWinRate: number;
  drawRate: number;
  awayWinRate: number;
}

// --- Backtest Types (canonical from backtest/route.ts) ---

export interface BacktestConfig {
  trainingSeasons: string[];
  testSeason: string;
  league: string;
}

export interface PredictionRecord {
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
    // New fields
    htResult: 'H' | 'D' | 'A';
    htHomeGoals: number;
    htAwayGoals: number;
    shResult: 'H' | 'D' | 'A';
    shHomeGoals: number;
    shAwayGoals: number;
  };
  // Odds from the match
  odds: {
    home: number | null;
    draw: number | null;
    away: number | null;
  };
  // Last H2H before this match
  lastH2H: {
    found: boolean;
    date?: string;
    season?: string;
    homeGoals?: number;
    awayGoals?: number;
    result?: 'H' | 'D' | 'A';
    scoreline?: string;
  } | null;
  correct: {
    result: boolean;
    over15: boolean;
    over25: boolean;
    btts: boolean;
  };
}

export interface ModelAccuracy {
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

export interface BacktestResult {
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
  // BTTS Pattern Analysis
  bttsPatterns: {
    totalBttsMatches: number;
    h2hPatterns: {
      lastH2HHomeWin: { count: number; bttsRate: number; avgGoals: number };
      lastH2HAwayWin: { count: number; bttsRate: number; avgGoals: number };
      lastH2HDraw: { count: number; bttsRate: number; avgGoals: number };
      noH2H: { count: number; bttsRate: number; avgGoals: number };
    };
    // Most frequent H2H scorelines that led to BTTS
    h2hScorelines: {
      scoreline: string;
      count: number;
      bttsCount: number;
      bttsRate: number;
    }[];
    htResultPatterns: {
      htHomeWin: { count: number; bttsRate: number };
      htAwayWin: { count: number; bttsRate: number };
      htDraw: { count: number; bttsRate: number };
    };
    shResultPatterns: {
      shHomeWin: { count: number; bttsRate: number };
      shAwayWin: { count: number; bttsRate: number };
      shDraw: { count: number; bttsRate: number };
    };
    insights: string[];
  };
}
