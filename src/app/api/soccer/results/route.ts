import { NextRequest, NextResponse } from 'next/server';

// Centralized data fetching & caching layer
import {
  fetchSeasonData,
  fetchAllSeasons,
  fetchWithRetry,
  parseCSV,
  clearCache,
} from '@/lib/data-cache';

// Re-exports for backward compatibility (other routes may still import from here)
export { fetchWithRetry, parseCSV };
export type { MatchResult } from '@/lib/types';

import type { MatchResult } from '@/lib/types';
import { EUROPEAN_SEASONS } from '@/lib/constants';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const league = searchParams.get('league');
  const season = searchParams.get('season');
  const refresh = searchParams.get('refresh');

  if (!league || !season) {
    return NextResponse.json(
      { error: 'Missing required parameters: league and season' },
      { status: 400 },
    );
  }

  // Clear cache if refresh is requested
  if (refresh === 'true') {
    console.log(`[Results API] Clearing cache for refresh`);
    clearCache();
  }

  try {
    let allResults: MatchResult[] = [];

    if (season === 'all') {
      allResults = await fetchAllSeasons(league, EUROPEAN_SEASONS);
    } else {
      allResults = await fetchSeasonData(league, season);
    }

    return NextResponse.json({ results: allResults });
  } catch (error) {
    console.error('Error fetching soccer data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch soccer data. Please check the league and season.' },
      { status: 500 },
    );
  }
}
