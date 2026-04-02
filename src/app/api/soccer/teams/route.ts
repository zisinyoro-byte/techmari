import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, MatchResult, fetchWithRetry } from '../results/route';

// Available seasons - European format (Aug-May, cross-year)
// 11 seasons from 2015-16 to 2025-26
const EUROPEAN_SEASONS = ['2526', '2425', '2324', '2223', '2122', '2021', '1920', '1819', '1718', '1617', '1516'];

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// In-memory cache
const cache = new Map<string, { data: { teams: string[]; seasonsFetched: string[]; totalMatches: number; teamsPerSeason: Record<string, number> }; timestamp: number }>();

const dataCache = new Map<string, { data: MatchResult[]; timestamp: number }>();

async function fetchSeasonData(league: string, season: string): Promise<{ matches: MatchResult[]; success: boolean; teamCount: number }> {
  const cacheKey = `${league}-${season}`;
  const cached = dataCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    const teams = new Set<string>();
    for (const match of cached.data) {
      if (match.homeTeam) teams.add(match.homeTeam);
      if (match.awayTeam) teams.add(match.awayTeam);
    }
    return { matches: cached.data, success: cached.data.length > 0, teamCount: teams.size };
  }

  const url = `https://www.football-data.co.uk/mmz4281/${season}/${league}.csv`;

  try {
    const response = await fetchWithRetry(url);

    if (!response.ok) {
      console.warn(`[Teams API] Failed to fetch ${league} ${season}: HTTP ${response.status}`);
      return { matches: [], success: false, teamCount: 0 };
    }

    const csvText = await response.text();
    
    if (!csvText || csvText.trim().length < 50) {
      console.warn(`[Teams API] Empty or invalid CSV for ${league} ${season}`);
      return { matches: [], success: false, teamCount: 0 };
    }

    const results = parseCSV(csvText, season);
    
    // Count unique teams in this season
    const teams = new Set<string>();
    for (const match of results) {
      if (match.homeTeam) teams.add(match.homeTeam);
      if (match.awayTeam) teams.add(match.awayTeam);
    }

    dataCache.set(cacheKey, { data: results, timestamp: Date.now() });
    console.log(`[Teams API] Fetched ${league} ${season}: ${results.length} matches, ${teams.size} teams`);
    
    return { matches: results, success: results.length > 0, teamCount: teams.size };
  } catch (error) {
    console.error(`[Teams API] Error fetching ${league} ${season}:`, error);
    return { matches: [], success: false, teamCount: 0 };
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const league = searchParams.get('league');
  const season = searchParams.get('season');
  const refresh = searchParams.get('refresh');

  if (!league || !season) {
    return NextResponse.json(
      { error: 'Missing required parameters: league and season' },
      { status: 400 }
    );
  }

  // Clear cache if refresh is requested
  if (refresh === 'true') {
    console.log(`[Teams API] Clearing all caches for refresh`);
    cache.clear();
    dataCache.clear();
  }

  const cacheKey = `${league}-${season}-teams`;
  const cached = cache.get(cacheKey);

  // Use cache if available and not forcing refresh
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION && refresh !== 'true') {
    console.log(`[Teams API] Returning cached data for ${league} ${season}`);
    return NextResponse.json({ 
      teams: cached.data.teams,
      seasonsFetched: cached.data.seasonsFetched,
      totalMatches: cached.data.totalMatches,
      teamsPerSeason: cached.data.teamsPerSeason
    });
  }

  try {
    let teams: string[];
    let seasonsFetched: string[] = [];
    let totalMatches = 0;
    let teamsPerSeason: Record<string, number> = {};

    if (season === 'all') {
      // Fetch all seasons in parallel
      console.log(`[Teams API] Fetching ALL seasons for league ${league}...`);
      const seasonPromises = EUROPEAN_SEASONS.map(s => fetchSeasonData(league, s));
      const seasonResults = await Promise.all(seasonPromises);

      // Combine all teams - track which seasons had data
      const allTeams = new Set<string>();
      EUROPEAN_SEASONS.forEach((s, index) => {
        const { matches, success, teamCount } = seasonResults[index];
        if (success && matches.length > 0) {
          seasonsFetched.push(s);
          totalMatches += matches.length;
          teamsPerSeason[s] = teamCount;
          
          for (const match of matches) {
            if (match.homeTeam) allTeams.add(match.homeTeam);
            if (match.awayTeam) allTeams.add(match.awayTeam);
          }
        } else {
          teamsPerSeason[s] = 0;
        }
      });

      teams = Array.from(allTeams).sort((a, b) => a.localeCompare(b));
      
      console.log(`[Teams API] ALL SEASONS Summary for ${league}:`);
      console.log(`  - Total unique teams: ${teams.length}`);
      console.log(`  - Seasons with data: ${seasonsFetched.join(', ')}`);
      console.log(`  - Total matches: ${totalMatches}`);
    } else {
      const { matches, success, teamCount } = await fetchSeasonData(league, season);
      const teamSet = new Set<string>();
      
      if (success && matches.length > 0) {
        seasonsFetched.push(season);
        totalMatches = matches.length;
        teamsPerSeason[season] = teamCount;
        for (const match of matches) {
          if (match.homeTeam) teamSet.add(match.homeTeam);
          if (match.awayTeam) teamSet.add(match.awayTeam);
        }
      }
      
      teams = Array.from(teamSet).sort((a, b) => a.localeCompare(b));
    }

    cache.set(cacheKey, { data: { teams, seasonsFetched, totalMatches, teamsPerSeason }, timestamp: Date.now() });

    return NextResponse.json({ 
      teams,
      seasonsFetched,
      totalMatches,
      teamsPerSeason
    });
  } catch (error) {
    console.error('[Teams API] Error fetching teams:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teams.' },
      { status: 500 }
    );
  }
}
