import { NextRequest, NextResponse } from 'next/server';

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

// Available seasons - European format (Aug-May, cross-year)
// 11 seasons from 2015-16 to 2025-26
const EUROPEAN_SEASONS = ['2526', '2425', '2324', '2223', '2122', '2021', '1920', '1819', '1718', '1617', '1516'];

// In-memory cache for fetched data
const cache = new Map<string, { data: MatchResult[]; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Rate limit tracking
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 500; // 500ms between requests

// Helper function to add delay
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch with retry logic for rate limiting
export async function fetchWithRetry(url: string, maxRetries = 3): Promise<{ ok: boolean; text: () => Promise<string>; status: number }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Ensure minimum interval between requests
    const timeSinceLastRequest = Date.now() - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await delay(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
    }
    lastRequestTime = Date.now();

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/csv,text/plain,*/*',
        },
      });

      if (response.ok) {
        return response;
      }

      if (response.status === 429) {
        // Rate limited - wait and retry with exponential backoff
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(`[Results API] Rate limited (429), waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
        await delay(waitTime);
        continue;
      }

      return response;
    } catch (error) {
      console.error(`[Results API] Fetch error on attempt ${attempt + 1}:`, error);
      if (attempt === maxRetries - 1) throw error;
      await delay(1000 * Math.pow(2, attempt));
    }
  }

  return { ok: false, text: async () => '', status: 429 };
}

function parseNumber(value: string | undefined): number | null {
  if (!value || value === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

export function parseCSV(csvText: string, season: string): MatchResult[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  // Find column indices from header - handle BOM character
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

    // Handle CSV with potential commas in values
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
      // Pre-Match Odds - Average
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

async function fetchSeasonData(league: string, season: string): Promise<MatchResult[]> {
  const cacheKey = `${league}-${season}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  const url = `https://www.football-data.co.uk/mmz4281/${season}/${league}.csv`;

  try {
    const response = await fetchWithRetry(url);

    if (!response.ok) {
      console.warn(`Failed to fetch ${season}: ${response.status}`);
      return [];
    }

    const csvText = await response.text();
    const results = parseCSV(csvText, season);

    // Cache the results
    cache.set(cacheKey, { data: results, timestamp: Date.now() });

    return results;
  } catch (error) {
    console.error(`Error fetching ${season}:`, error);
    return [];
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
    console.log(`[Results API] Clearing cache for refresh`);
    cache.clear();
  }

  try {
    let allResults: MatchResult[] = [];

    if (season === 'all') {
      // Fetch all seasons in parallel
      const seasonPromises = EUROPEAN_SEASONS.map(s => fetchSeasonData(league, s));
      const seasonResults = await Promise.all(seasonPromises);
      
      // Combine all results
      allResults = seasonResults.flat();
    } else {
      // Fetch single season
      allResults = await fetchSeasonData(league, season);
    }

    return NextResponse.json({ results: allResults });
  } catch (error) {
    console.error('Error fetching soccer data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch soccer data. Please check the league and season.' },
      { status: 500 }
    );
  }
}
