// API-Football Client Library
// https://www.api-football.com/documentation

const API_FOOTBALL_BASE_URL = 'https://v3.football.api-sports.io';

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 400; // API-Football allows ~25 requests/second on free tier

// In-memory cache
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function rateLimit() {
  const timeSinceLastRequest = Date.now() - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await delay(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
  }
  lastRequestTime = Date.now();
}

export interface APIFootballResponse<T> {
  response: T[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  parameters: Record<string, string>;
  errors: Record<string, string>;
}

// Generic fetch function for API-Football
export async function fetchFromAPIFootball<T>(
  endpoint: string,
  params: Record<string, string | number>
): Promise<APIFootballResponse<T> | null> {
  const apiKey = process.env.API_FOOTBALL_API_KEY;
  
  if (!apiKey) {
    console.error('API-Football API key not configured');
    return null;
  }

  const cacheKey = `${endpoint}-${JSON.stringify(params)}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as APIFootballResponse<T>;
  }

  await rateLimit();

  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.append(key, String(value));
    }
  });

  const url = `${API_FOOTBALL_BASE_URL}/${endpoint}?${queryParams.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
      },
    });

    if (!response.ok) {
      console.error(`API-Football error: ${response.status} ${response.statusText}`);
      if (response.status === 429) {
        console.warn('Rate limited by API-Football');
      }
      return null;
    }

    const data = await response.json();
    cache.set(cacheKey, { data, timestamp: Date.now() });

    return data as APIFootballResponse<T>;
  } catch (error) {
    console.error('API-Football fetch error:', error);
    return null;
  }
}

// Fixture/Match Types
export interface Fixture {
  id: number;
  referee: string;
  timezone: string;
  date: string;
  timestamp: number;
  periods: {
    first: number;
    second: number;
  };
  venue: {
    id: number;
    name: string;
    city: string;
  };
  status: {
    long: string;
    short: string;
    elapsed: number;
  };
}

export interface Team {
  id: number;
  name: string;
  logo: string;
  winner: boolean | null;
}

export interface Goals {
  home: number | null;
  away: number | null;
}

export interface Score {
  halftime: Goals;
  fulltime: Goals;
  extratime: Goals;
  penalty: Goals;
}

export interface FixtureMatch {
  fixture: Fixture;
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string;
    season: number;
    round: string;
  };
  teams: {
    home: Team;
    away: Team;
  };
  goals: Goals;
  score: Score;
}

// Available leagues with their API-Football IDs
export const API_FOOTBALL_LEAGUES = [
  { id: 39, code: 'E0', name: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 140, code: 'SP1', name: 'La Liga', country: 'Spain', flag: '🇪🇸' },
  { id: 135, code: 'I1', name: 'Serie A', country: 'Italy', flag: '🇮🇹' },
  { id: 78, code: 'D1', name: 'Bundesliga', country: 'Germany', flag: '🇩🇪' },
  { id: 61, code: 'F1', name: 'Ligue 1', country: 'France', flag: '🇫🇷' },
  { id: 144, code: 'SP2', name: 'La Liga 2', country: 'Spain', flag: '🇪🇸' },
  { id: 136, code: 'I2', name: 'Serie B', country: 'Italy', flag: '🇮🇹' },
  { id: 79, code: 'D2', name: '2. Bundesliga', country: 'Germany', flag: '🇩🇪' },
  { id: 62, code: 'F2', name: 'Ligue 2', country: 'France', flag: '🇫🇷' },
  { id: 40, code: 'E1', name: 'Championship', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 41, code: 'E2', name: 'League One', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 42, code: 'E3', name: 'League Two', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 88, code: 'N1', name: 'Eredivisie', country: 'Netherlands', flag: '🇳🇱' },
  { id: 94, code: 'P1', name: 'Primeira Liga', country: 'Portugal', flag: '🇵🇹' },
  { id: 203, code: 'T1', name: 'Super Lig', country: 'Turkey', flag: '🇹🇷' },
  { id: 71, code: 'B1', name: 'Jupiler Pro League', country: 'Belgium', flag: '🇧🇪' },
  { id: 113, code: 'SC1', name: 'Scottish Premiership', country: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  { id: 72, code: 'G1', name: 'Super League', country: 'Greece', flag: '🇬🇷' },
  { id: 318, code: 'AU1', name: 'A-League', country: 'Australia', flag: '🇦🇺' },
  { id: 253, code: 'USA1', name: 'MLS', country: 'USA', flag: '🇺🇸' },
  { id: 128, code: 'ARG1', name: 'Primera Division', country: 'Argentina', flag: '🇦🇷' },
  { id: 71, code: 'BRA1', name: 'Brasileirao', country: 'Brazil', flag: '🇧🇷' },
  { id: 13, code: 'COPA', name: 'Copa Libertadores', country: 'South America', flag: '🌎' },
  { id: 2, code: 'UCL', name: 'Champions League', country: 'Europe', flag: '🇪🇺' },
  { id: 3, code: 'UEL', name: 'Europa League', country: 'Europe', flag: '🇪🇺' },
];

// Season mapping (API-Football uses year as season)
export const API_FOOTBALL_SEASONS = [
  { year: 2025, code: '2526', name: '2025-26' },
  { year: 2024, code: '2425', name: '2024-25' },
  { year: 2023, code: '2324', name: '2023-24' },
  { year: 2022, code: '2223', name: '2022-23' },
  { year: 2021, code: '2122', name: '2021-22' },
  { year: 2020, code: '2021', name: '2020-21' },
  { year: 2019, code: '1920', name: '2019-20' },
  { year: 2018, code: '1819', name: '2018-19' },
  { year: 2017, code: '1718', name: '2017-18' },
  { year: 2016, code: '1617', name: '2016-17' },
  { year: 2015, code: '1516', name: '2015-16' },
];

export function getLeagueId(code: string): number {
  const league = API_FOOTBALL_LEAGUES.find(l => l.code === code);
  return league?.id || 39;
}

export function getSeasonYear(code: string): number {
  const season = API_FOOTBALL_SEASONS.find(s => s.code === code);
  return season?.year || 2024;
}
