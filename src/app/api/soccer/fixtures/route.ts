import { NextRequest, NextResponse } from 'next/server';

// Types
interface Fixture {
  league: string;
  country: string;
  date: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  // Pre-match odds
  oddsHome: number | null;
  oddsDraw: number | null;
  oddsAway: number | null;
  oddsB365Home: number | null;
  oddsB365Draw: number | null;
  oddsB365Away: number | null;
  // Over/Under odds
  oddsOver25: number | null;
  oddsUnder25: number | null;
  // Asian Handicap
  asianHandicap: number | null;
  oddsAHH: number | null;
  oddsAHA: number | null;
}

interface FixturesResponse {
  fixtures: Fixture[];
  lastUpdated: string;
  totalFixtures: number;
  leagues: { code: string; name: string; country: string; count: number }[];
}

// League mapping
const LEAGUE_MAP: Record<string, { name: string; country: string }> = {
  'E0': { name: 'Premier League', country: 'England' },
  'E1': { name: 'Championship', country: 'England' },
  'E2': { name: 'League 1', country: 'England' },
  'E3': { name: 'League 2', country: 'England' },
  'EC': { name: 'National League', country: 'England' },
  'SC0': { name: 'Premier League', country: 'Scotland' },
  'SC1': { name: 'Championship', country: 'Scotland' },
  'D1': { name: 'Bundesliga', country: 'Germany' },
  'D2': { name: '2. Bundesliga', country: 'Germany' },
  'I1': { name: 'Serie A', country: 'Italy' },
  'I2': { name: 'Serie B', country: 'Italy' },
  'SP1': { name: 'La Liga', country: 'Spain' },
  'SP2': { name: 'La Liga 2', country: 'Spain' },
  'F1': { name: 'Ligue 1', country: 'France' },
  'F2': { name: 'Ligue 2', country: 'France' },
  'N1': { name: 'Eredivisie', country: 'Netherlands' },
  'B1': { name: 'First Division A', country: 'Belgium' },
  'P1': { name: 'Primeira Liga', country: 'Portugal' },
  'T1': { name: 'Super Lig', country: 'Turkey' },
  'G1': { name: 'Super League', country: 'Greece' },
};

// In-memory cache
let cachedFixtures: { data: Fixture[]; timestamp: number; lastUpdated: string } | null = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

function parseNumber(value: string | undefined): number | null {
  if (!value || value === '' || value === 'NA') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

function parseCSV(csvText: string): Fixture[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  // Find column indices from header
  const headerLine = lines[0].replace(/^\uFEFF/, '');
  const header = headerLine.split(',');
  const colIndex: Record<string, number> = {};

  header.forEach((col, idx) => {
    colIndex[col.trim()] = idx;
  });

  const fixtures: Fixture[] = [];

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

    const leagueCode = values[colIndex['Div']] || '';
    const homeTeam = values[colIndex['HomeTeam']] || '';
    const awayTeam = values[colIndex['AwayTeam']] || '';

    // Skip incomplete records
    if (!leagueCode || !homeTeam || !awayTeam) continue;

    const leagueInfo = LEAGUE_MAP[leagueCode] || { name: leagueCode, country: 'Unknown' };

    fixtures.push({
      league: leagueInfo.name,
      country: leagueInfo.country,
      date: values[colIndex['Date']] || '',
      time: values[colIndex['Time']] || '',
      homeTeam,
      awayTeam,
      // Average odds
      oddsHome: parseNumber(values[colIndex['AvgH']]),
      oddsDraw: parseNumber(values[colIndex['AvgD']]),
      oddsAway: parseNumber(values[colIndex['AvgA']]),
      // Bet365 odds
      oddsB365Home: parseNumber(values[colIndex['B365H']]),
      oddsB365Draw: parseNumber(values[colIndex['B365D']]),
      oddsB365Away: parseNumber(values[colIndex['B365A']]),
      // Over/Under 2.5
      oddsOver25: parseNumber(values[colIndex['B365>2.5']]),
      oddsUnder25: parseNumber(values[colIndex['B365<2.5']]),
      // Asian Handicap
      asianHandicap: parseNumber(values[colIndex['AHh']]),
      oddsAHH: parseNumber(values[colIndex['B365AHH']]),
      oddsAHA: parseNumber(values[colIndex['B365AHA']]),
    });
  }

  return fixtures;
}

async function fetchFixtures(): Promise<{ fixtures: Fixture[]; lastUpdated: string }> {
  // Check cache
  if (cachedFixtures && Date.now() - cachedFixtures.timestamp < CACHE_DURATION) {
    return { fixtures: cachedFixtures.data, lastUpdated: cachedFixtures.lastUpdated };
  }

  const url = 'https://www.football-data.co.uk/fixtures.csv';

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch fixtures: ${response.status}`);
    }

    const csvText = await response.text();
    const fixtures = parseCSV(csvText);

    // Get last updated timestamp
    const lastUpdated = new Date().toISOString();

    // Update cache
    cachedFixtures = {
      data: fixtures,
      timestamp: Date.now(),
      lastUpdated,
    };

    return { fixtures, lastUpdated };
  } catch (error) {
    console.error('Error fetching fixtures:', error);
    
    // Return cached data if available, even if expired
    if (cachedFixtures) {
      return { fixtures: cachedFixtures.data, lastUpdated: cachedFixtures.lastUpdated };
    }
    
    return { fixtures: [], lastUpdated: '' };
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const league = searchParams.get('league');
  const country = searchParams.get('country');

  try {
    const { fixtures, lastUpdated } = await fetchFixtures();

    // Filter by league if specified
    let filteredFixtures = fixtures;
    
    if (league && league !== 'all') {
      const leagueInfo = LEAGUE_MAP[league];
      if (leagueInfo) {
        filteredFixtures = fixtures.filter(f => f.league === leagueInfo.name);
      }
    }

    if (country && country !== 'all') {
      filteredFixtures = filteredFixtures.filter(f => f.country === country);
    }

    // Get unique leagues with counts
    const leagueCounts = new Map<string, { code: string; name: string; country: string; count: number }>();
    
    for (const fixture of fixtures) {
      const key = fixture.league;
      const existing = leagueCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        // Find the league code
        const code = Object.entries(LEAGUE_MAP).find(([_, info]) => info.name === fixture.league)?.[0] || '';
        leagueCounts.set(key, {
          code,
          name: fixture.league,
          country: fixture.country,
          count: 1,
        });
      }
    }

    const response: FixturesResponse = {
      fixtures: filteredFixtures,
      lastUpdated,
      totalFixtures: filteredFixtures.length,
      leagues: Array.from(leagueCounts.values()).sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name)),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error processing fixtures:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fixtures' },
      { status: 500 }
    );
  }
}
