import { NextRequest, NextResponse } from 'next/server';
import { fetchSeasonData, clearCache } from '@/lib/data-cache';
import type { MatchResult } from '@/lib/types';
import { EUROPEAN_SEASONS } from '@/lib/constants';

const TEAMS_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// In-memory cache for teams API results (derived data)
const teamsCache = new Map<string, { data: { teams: string[]; seasonsFetched: string[]; totalMatches: number; teamsPerSeason: Record<string, number> }; timestamp: number }>();

/**
 * Fetch a single season and return enriched result with team count.
 * Uses the shared data-cache for raw data, then computes team metrics.
 */
async function fetchSeasonWithTeams(
  league: string,
  season: string,
): Promise<{ matches: MatchResult[]; success: boolean; teamCount: number }> {
  const matches = await fetchSeasonData(league, season);
  const teams = new Set<string>();
  for (const match of matches) {
    if (match.homeTeam) teams.add(match.homeTeam);
    if (match.awayTeam) teams.add(match.awayTeam);
  }
  return { matches, success: matches.length > 0, teamCount: teams.size };
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
    teamsCache.clear();
    clearCache();
  }

  const cacheKey = `${league}-${season}-teams`;
  const cached = teamsCache.get(cacheKey);

  // Use cache if available and not forcing refresh
  if (cached && Date.now() - cached.timestamp < TEAMS_CACHE_DURATION && refresh !== 'true') {
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
      const seasonPromises = EUROPEAN_SEASONS.map(s => fetchSeasonWithTeams(league, s));
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
      const { matches, success, teamCount } = await fetchSeasonWithTeams(league, season);
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

    teamsCache.set(cacheKey, { data: { teams, seasonsFetched, totalMatches, teamsPerSeason }, timestamp: Date.now() });

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
