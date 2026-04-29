// ============================================================================
// Centralized data fetching and caching layer
// Single source of truth for football-data.co.uk CSV fetching
// Eliminates duplicate caches across API routes (results, predict, backtest,
// analytics, h2h, patterns, teams)
// ============================================================================

import type { MatchResult } from './types';
import { parseNumber } from './utils';

// ---------------------------------------------------------------------------
// Rate-limit tracking
// ---------------------------------------------------------------------------
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 500; // 500 ms between requests

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// fetchWithRetry – fetch with rate-limiting and exponential back-off
// ---------------------------------------------------------------------------
export async function fetchWithRetry(
  url: string,
  maxRetries = 3,
): Promise<{ ok: boolean; text: () => Promise<string>; status: number }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Enforce minimum interval between requests
    const timeSinceLastRequest = Date.now() - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await delay(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
    }
    lastRequestTime = Date.now();

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/csv,text/plain,*/*',
        },
      });

      if (response.ok) return response;

      if (response.status === 429) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(
          `[DataCache] Rate limited (429), waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`,
        );
        await delay(waitTime);
        continue;
      }

      return response;
    } catch (error) {
      console.error(`[DataCache] Fetch error on attempt ${attempt + 1}:`, error);
      if (attempt === maxRetries - 1) throw error;
      await delay(1000 * Math.pow(2, attempt));
    }
  }

  return { ok: false, text: async () => '', status: 429 };
}

// ---------------------------------------------------------------------------
// parseCSV – turn a football-data.co.uk CSV string into MatchResult[]
// ---------------------------------------------------------------------------
export function parseCSV(csvText: string, season: string): MatchResult[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  // Handle BOM character
  const headerLine = lines[0].replace(/^\uFEFF/, '');
  const header = headerLine.split(',');
  const colIndex: Record<string, number> = {};

  header.forEach((col, idx) => {
    colIndex[col.trim()] = idx;
  });

  const results: MatchResult[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Handle CSV with potential commas in quoted values
    const values: string[] = [];
    let currentValue = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim());

    const homeTeam = values[colIndex['HomeTeam']] || '';
    const awayTeam = values[colIndex['AwayTeam']] || '';

    // Skip incomplete records
    if (!homeTeam || !awayTeam) continue;

    results.push({
      date: values[colIndex['Date']] || '',
      time: values[colIndex['Time']] || '',
      homeTeam,
      awayTeam,
      referee: values[colIndex['Referee']] || '',
      // Goals
      ftHomeGoals: parseInt(values[colIndex['FTHG']] || '0', 10) || 0,
      ftAwayGoals: parseInt(values[colIndex['FTAG']] || '0', 10) || 0,
      ftResult: (values[colIndex['FTR']] || 'D') as 'H' | 'D' | 'A',
      htHomeGoals: parseInt(values[colIndex['HTHG']] || '0', 10) || 0,
      htAwayGoals: parseInt(values[colIndex['HTAG']] || '0', 10) || 0,
      htResult: (values[colIndex['HTR']] || 'D') as 'H' | 'D' | 'A',
      // Match Statistics
      homeShots: parseInt(values[colIndex['HS']] || '0', 10) || 0,
      awayShots: parseInt(values[colIndex['AS']] || '0', 10) || 0,
      homeShotsOnTarget: parseInt(values[colIndex['HST']] || '0', 10) || 0,
      awayShotsOnTarget: parseInt(values[colIndex['AST']] || '0', 10) || 0,
      homeCorners: parseInt(values[colIndex['HC']] || '0', 10) || 0,
      awayCorners: parseInt(values[colIndex['AC']] || '0', 10) || 0,
      homeFouls: parseInt(values[colIndex['HF']] || '0', 10) || 0,
      awayFouls: parseInt(values[colIndex['AF']] || '0', 10) || 0,
      homeYellowCards: parseInt(values[colIndex['HY']] || '0', 10) || 0,
      awayYellowCards: parseInt(values[colIndex['AY']] || '0', 10) || 0,
      homeRedCards: parseInt(values[colIndex['HR']] || '0', 10) || 0,
      awayRedCards: parseInt(values[colIndex['AR']] || '0', 10) || 0,
      // Pre-Match Odds – Average
      oddsAvgHome: parseNumber(values[colIndex['AvgH']]),
      oddsAvgDraw: parseNumber(values[colIndex['AvgD']]),
      oddsAvgAway: parseNumber(values[colIndex['AvgA']]),
      // Bet365 odds
      oddsB365Home: parseNumber(values[colIndex['B365H']]),
      oddsB365Draw: parseNumber(values[colIndex['B365D']]),
      oddsB365Away: parseNumber(values[colIndex['B365A']]),
      // Over/Under 2.5
      oddsOver25: parseNumber(values[colIndex['B365>2.5']]),
      oddsUnder25: parseNumber(values[colIndex['B365<2.5']]),
      oddsAvgOver25: parseNumber(values[colIndex['Avg>2.5']]),
      // Season
      season,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Centralized in-memory cache
// ---------------------------------------------------------------------------
const cache = new Map<string, { data: MatchResult[]; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// ---------------------------------------------------------------------------
// fetchSeasonData – fetch (with cache) a single season's CSV
// ---------------------------------------------------------------------------
export async function fetchSeasonData(
  league: string,
  season: string,
): Promise<MatchResult[]> {
  const cacheKey = `${league}-${season}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  const url = `https://www.football-data.co.uk/mmz4281/${season}/${league}.csv`;

  try {
    const response = await fetchWithRetry(url);
    if (!response.ok) {
      console.warn(
        `[DataCache] Failed to fetch ${league} ${season}: ${response.status}`,
      );
      return [];
    }

    const csvText = await response.text();
    const results = parseCSV(csvText, season);

    cache.set(cacheKey, { data: results, timestamp: Date.now() });
    return results;
  } catch (error) {
    console.error(`[DataCache] Error fetching ${league} ${season}:`, error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// fetchAllSeasons – fetch multiple seasons in parallel
// ---------------------------------------------------------------------------
export async function fetchAllSeasons(
  league: string,
  seasons: string[],
): Promise<MatchResult[]> {
  const seasonPromises = seasons.map(s => fetchSeasonData(league, s));
  const seasonResults = await Promise.all(seasonPromises);
  return seasonResults.flat();
}

// ---------------------------------------------------------------------------
// clearCache – invalidate all cached data
// ---------------------------------------------------------------------------
export function clearCache(): void {
  cache.clear();
  console.log('[DataCache] Cache cleared');
}
