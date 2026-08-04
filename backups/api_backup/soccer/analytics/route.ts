import { NextRequest, NextResponse } from 'next/server';
import { MatchResult, parseCSV, fetchWithRetry } from '../results/route';

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

// Available seasons - European format
// 11 seasons from 2015-16 to 2025-26
const EUROPEAN_SEASONS = ['2526', '2425', '2324', '2223', '2122', '2021', '1920', '1819', '1718', '1617', '1516'];

// In-memory cache for analytics
const analyticsCache = new Map<string, { data: Analytics; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// In-memory cache for raw data
const dataCache = new Map<string, { data: MatchResult[]; timestamp: number }>();

async function fetchSeasonData(league: string, season: string): Promise<MatchResult[]> {
  const cacheKey = `${league}-${season}`;
  const cached = dataCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  const url = `https://www.football-data.co.uk/mmz4281/${season}/${league}.csv`;

  try {
    const response = await fetchWithRetry(url);

    if (!response.ok) {
      return [];
    }

    const csvText = await response.text();
    const results = parseCSV(csvText, season);

    dataCache.set(cacheKey, { data: results, timestamp: Date.now() });
    return results;
  } catch (error) {
    console.error(`Error fetching ${season}:`, error);
    return [];
  }
}

function calculateAnalytics(results: MatchResult[], seasonsCount?: number): Analytics {
  const totalMatches = results.length;

  const emptyAnalytics: Analytics = {
    totalMatches: 0,
    homeWinPercent: 0,
    drawPercent: 0,
    awayWinPercent: 0,
    avgGoalsPerGame: 0,
    htftCorrelationPercent: 0,
    htToftTransitions: {
      htHomeLeads: { ftHomeWin: 0, ftDraw: 0, ftAwayWin: 0 },
      htDraw: { ftHomeWin: 0, ftDraw: 0, ftAwayWin: 0 },
      htAwayLeads: { ftHomeWin: 0, ftDraw: 0, ftAwayWin: 0 },
    },
    resultDistribution: { homeWins: 0, draws: 0, awayWins: 0 },
    avgHomeGoals: 0,
    avgAwayGoals: 0,
    totalGoals: 0,
    seasonsCount,
    avgHomeShots: 0,
    avgAwayShots: 0,
    avgHomeShotsOnTarget: 0,
    avgAwayShotsOnTarget: 0,
    avgHomeCorners: 0,
    avgAwayCorners: 0,
    avgHomeFouls: 0,
    avgAwayFouls: 0,
    avgHomeYellowCards: 0,
    avgAwayYellowCards: 0,
    totalRedCards: 0,
    homeShotConversion: 0,
    awayShotConversion: 0,
    homeShotOnTargetConversion: 0,
    awayShotOnTargetConversion: 0,
    overallShotConversion: 0,
    overallShotOnTargetConversion: 0,
    over25Count: 0,
    over25Percent: 0,
    under25Count: 0,
    under25Percent: 0,
    avgTotalGoals: 0,
    oddsAnalysis: {
      matchesWithOdds: 0,
      favoriteWins: 0,
      favoriteWinPercent: 0,
      underdogWins: 0,
      underdogWinPercent: 0,
      drawsPercent: 0,
      avgHomeOdds: 0,
      avgDrawOdds: 0,
      avgAwayOdds: 0,
      homeWinImpliedProb: 0,
      homeWinActualProb: 0,
      drawImpliedProb: 0,
      drawActualProb: 0,
      awayWinImpliedProb: 0,
      awayWinActualProb: 0,
    },
  };

  if (totalMatches === 0) {
    return emptyAnalytics;
  }

  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let totalGoals = 0;
  let totalHomeGoals = 0;
  let totalAwayGoals = 0;
  let htftMatches = 0;

  // Match stats
  let totalHomeShots = 0;
  let totalAwayShots = 0;
  let totalHomeShotsOnTarget = 0;
  let totalAwayShotsOnTarget = 0;
  let totalHomeCorners = 0;
  let totalAwayCorners = 0;
  let totalHomeFouls = 0;
  let totalAwayFouls = 0;
  let totalHomeYellowCards = 0;
  let totalAwayYellowCards = 0;
  let totalRedCards = 0;

  // Over/Under
  let over25Count = 0;
  let under25Count = 0;

  // Odds analysis
  let favoriteWins = 0;
  let underdogWins = 0;
  let totalHomeOdds = 0;
  let totalDrawOdds = 0;
  let totalAwayOdds = 0;
  let oddsCount = 0;

  const transitions = {
    htHomeLeads: { ftHomeWin: 0, ftDraw: 0, ftAwayWin: 0 },
    htDraw: { ftHomeWin: 0, ftDraw: 0, ftAwayWin: 0 },
    htAwayLeads: { ftHomeWin: 0, ftDraw: 0, ftAwayWin: 0 },
  };

  for (const match of results) {
    // Result counts
    if (match.ftResult === 'H') homeWins++;
    else if (match.ftResult === 'D') draws++;
    else awayWins++;

    // Goals
    totalGoals += match.ftHomeGoals + match.ftAwayGoals;
    totalHomeGoals += match.ftHomeGoals;
    totalAwayGoals += match.ftAwayGoals;

    // HT/FT correlation
    if (match.htResult === match.ftResult) {
      htftMatches++;
    }

    // Transitions
    if (match.htResult === 'H') {
      if (match.ftResult === 'H') transitions.htHomeLeads.ftHomeWin++;
      else if (match.ftResult === 'D') transitions.htHomeLeads.ftDraw++;
      else transitions.htHomeLeads.ftAwayWin++;
    } else if (match.htResult === 'D') {
      if (match.ftResult === 'H') transitions.htDraw.ftHomeWin++;
      else if (match.ftResult === 'D') transitions.htDraw.ftDraw++;
      else transitions.htDraw.ftAwayWin++;
    } else {
      if (match.ftResult === 'H') transitions.htAwayLeads.ftHomeWin++;
      else if (match.ftResult === 'D') transitions.htAwayLeads.ftDraw++;
      else transitions.htAwayLeads.ftAwayWin++;
    }

    // Match Statistics
    totalHomeShots += match.homeShots;
    totalAwayShots += match.awayShots;
    totalHomeShotsOnTarget += match.homeShotsOnTarget;
    totalAwayShotsOnTarget += match.awayShotsOnTarget;
    totalHomeCorners += match.homeCorners;
    totalAwayCorners += match.awayCorners;
    totalHomeFouls += match.homeFouls;
    totalAwayFouls += match.awayFouls;
    totalHomeYellowCards += match.homeYellowCards;
    totalAwayYellowCards += match.awayYellowCards;
    totalRedCards += match.homeRedCards + match.awayRedCards;

    // Over/Under 2.5
    const totalMatchGoals = match.ftHomeGoals + match.ftAwayGoals;
    if (totalMatchGoals > 2.5) over25Count++;
    else under25Count++;

    // Odds Analysis
    if (match.oddsAvgHome && match.oddsAvgDraw && match.oddsAvgAway) {
      oddsCount++;
      totalHomeOdds += match.oddsAvgHome;
      totalDrawOdds += match.oddsAvgDraw;
      totalAwayOdds += match.oddsAvgAway;

      // Determine favorite (lowest odds)
      const minOdds = Math.min(match.oddsAvgHome, match.oddsAvgDraw, match.oddsAvgAway);
      
      if (minOdds === match.oddsAvgHome && match.ftResult === 'H') {
        favoriteWins++;
      } else if (minOdds === match.oddsAvgDraw && match.ftResult === 'D') {
        favoriteWins++;
      } else if (minOdds === match.oddsAvgAway && match.ftResult === 'A') {
        favoriteWins++;
      } else if (match.ftResult !== 'D') {
        // Underdog win (not draw, and not favorite winning)
        const homeIsFavorite = match.oddsAvgHome < match.oddsAvgDraw && match.oddsAvgHome < match.oddsAvgAway;
        const awayIsFavorite = match.oddsAvgAway < match.oddsAvgDraw && match.oddsAvgAway < match.oddsAvgHome;
        
        if ((homeIsFavorite && match.ftResult === 'A') || (awayIsFavorite && match.ftResult === 'H')) {
          underdogWins++;
        }
      }
    }
  }

  // Calculate averages
  const avgHomeOdds = oddsCount > 0 ? totalHomeOdds / oddsCount : 0;
  const avgDrawOdds = oddsCount > 0 ? totalDrawOdds / oddsCount : 0;
  const avgAwayOdds = oddsCount > 0 ? totalAwayOdds / oddsCount : 0;

  return {
    totalMatches,
    homeWinPercent: Math.round((homeWins / totalMatches) * 1000) / 10,
    drawPercent: Math.round((draws / totalMatches) * 1000) / 10,
    awayWinPercent: Math.round((awayWins / totalMatches) * 1000) / 10,
    avgGoalsPerGame: Math.round((totalGoals / totalMatches) * 100) / 100,
    htftCorrelationPercent: Math.round((htftMatches / totalMatches) * 1000) / 10,
    htToftTransitions: transitions,
    resultDistribution: { homeWins, draws, awayWins },
    avgHomeGoals: Math.round((totalHomeGoals / totalMatches) * 100) / 100,
    avgAwayGoals: Math.round((totalAwayGoals / totalMatches) * 100) / 100,
    totalGoals,
    seasonsCount,
    // Match Statistics
    avgHomeShots: Math.round((totalHomeShots / totalMatches) * 10) / 10,
    avgAwayShots: Math.round((totalAwayShots / totalMatches) * 10) / 10,
    avgHomeShotsOnTarget: Math.round((totalHomeShotsOnTarget / totalMatches) * 10) / 10,
    avgAwayShotsOnTarget: Math.round((totalAwayShotsOnTarget / totalMatches) * 10) / 10,
    avgHomeCorners: Math.round((totalHomeCorners / totalMatches) * 10) / 10,
    avgAwayCorners: Math.round((totalAwayCorners / totalMatches) * 10) / 10,
    avgHomeFouls: Math.round((totalHomeFouls / totalMatches) * 10) / 10,
    avgAwayFouls: Math.round((totalAwayFouls / totalMatches) * 10) / 10,
    avgHomeYellowCards: Math.round((totalHomeYellowCards / totalMatches) * 100) / 100,
    avgAwayYellowCards: Math.round((totalAwayYellowCards / totalMatches) * 100) / 100,
    totalRedCards,
    // Shots Conversion
    homeShotConversion: totalHomeShots > 0 ? Math.round((totalHomeGoals / totalHomeShots) * 1000) / 10 : 0,
    awayShotConversion: totalAwayShots > 0 ? Math.round((totalAwayGoals / totalAwayShots) * 1000) / 10 : 0,
    homeShotOnTargetConversion: totalHomeShotsOnTarget > 0 ? Math.round((totalHomeGoals / totalHomeShotsOnTarget) * 1000) / 10 : 0,
    awayShotOnTargetConversion: totalAwayShotsOnTarget > 0 ? Math.round((totalAwayGoals / totalAwayShotsOnTarget) * 1000) / 10 : 0,
    overallShotConversion: (totalHomeShots + totalAwayShots) > 0 ? Math.round((totalGoals / (totalHomeShots + totalAwayShots)) * 1000) / 10 : 0,
    overallShotOnTargetConversion: (totalHomeShotsOnTarget + totalAwayShotsOnTarget) > 0 ? Math.round((totalGoals / (totalHomeShotsOnTarget + totalAwayShotsOnTarget)) * 1000) / 10 : 0,
    // Over/Under 2.5
    over25Count,
    over25Percent: Math.round((over25Count / totalMatches) * 1000) / 10,
    under25Count,
    under25Percent: Math.round((under25Count / totalMatches) * 1000) / 10,
    avgTotalGoals: Math.round((totalGoals / totalMatches) * 100) / 100,
    // Odds Analysis
    oddsAnalysis: {
      matchesWithOdds: oddsCount,
      favoriteWins,
      favoriteWinPercent: oddsCount > 0 ? Math.round((favoriteWins / oddsCount) * 1000) / 10 : 0,
      underdogWins,
      underdogWinPercent: oddsCount > 0 ? Math.round((underdogWins / oddsCount) * 1000) / 10 : 0,
      drawsPercent: oddsCount > 0 ? Math.round((draws / oddsCount) * 1000) / 10 : 0,
      avgHomeOdds: Math.round(avgHomeOdds * 100) / 100,
      avgDrawOdds: Math.round(avgDrawOdds * 100) / 100,
      avgAwayOdds: Math.round(avgAwayOdds * 100) / 100,
      // Implied probability = 1/odds
      homeWinImpliedProb: avgHomeOdds > 0 ? Math.round((1 / avgHomeOdds) * 1000) / 10 : 0,
      homeWinActualProb: Math.round((homeWins / totalMatches) * 1000) / 10,
      drawImpliedProb: avgDrawOdds > 0 ? Math.round((1 / avgDrawOdds) * 1000) / 10 : 0,
      drawActualProb: Math.round((draws / totalMatches) * 1000) / 10,
      awayWinImpliedProb: avgAwayOdds > 0 ? Math.round((1 / avgAwayOdds) * 1000) / 10 : 0,
      awayWinActualProb: Math.round((awayWins / totalMatches) * 1000) / 10,
    },
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const league = searchParams.get('league');
  const season = searchParams.get('season');

  console.log(`[Analytics API] Request: league=${league}, season=${season}`);

  if (!league || !season) {
    return NextResponse.json(
      { error: 'Missing required parameters: league and season' },
      { status: 400 }
    );
  }

  const cacheKey = `${league}-${season}-analytics`;
  const cached = analyticsCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`[Analytics API] Returning cached data for ${league} ${season}`);
    return NextResponse.json({ analytics: cached.data });
  }

  try {
    let allResults: MatchResult[] = [];
    let seasonsCount: number | undefined;

    if (season === 'all') {
      console.log(`[Analytics API] Fetching ALL seasons for ${league}`);
      const seasonPromises = EUROPEAN_SEASONS.map(s => fetchSeasonData(league, s));
      const seasonResults = await Promise.all(seasonPromises);
      allResults = seasonResults.flat();
      seasonsCount = EUROPEAN_SEASONS.length;
      console.log(`[Analytics API] ALL SEASONS: ${allResults.length} total matches`);
    } else {
      console.log(`[Analytics API] Fetching SINGLE season ${season} for ${league}`);
      allResults = await fetchSeasonData(league, season);
      console.log(`[Analytics API] SINGLE SEASON: ${allResults.length} matches`);
    }

    const analytics = calculateAnalytics(allResults, seasonsCount);
    console.log(`[Analytics API] Calculated analytics: totalMatches=${analytics.totalMatches}`);

    analyticsCache.set(cacheKey, { data: analytics, timestamp: Date.now() });

    return NextResponse.json({ analytics });
  } catch (error) {
    console.error('Error fetching soccer analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch soccer analytics.' },
      { status: 500 }
    );
  }
}
