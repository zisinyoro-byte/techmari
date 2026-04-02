import { NextResponse } from 'next/server';

export interface League {
  code: string;
  name: string;
  country: string;
  seasonFormat: 'european' | 'calendar';
}

const leagues: League[] = [
  // ========== LEAGUES WITH FULL STATISTICS (Available on football-data.co.uk) ==========
  
  // England
  { code: 'E0', name: 'Premier League', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England', seasonFormat: 'european' },
  { code: 'E1', name: 'Championship', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England', seasonFormat: 'european' },
  { code: 'E2', name: 'League One', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England', seasonFormat: 'european' },
  { code: 'E3', name: 'League Two', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England', seasonFormat: 'european' },
  { code: 'EC', name: 'National League', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England', seasonFormat: 'european' },
  
  // Scotland
  { code: 'SC0', name: 'Premiership', country: '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scotland', seasonFormat: 'european' },
  { code: 'SC1', name: 'Championship', country: '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scotland', seasonFormat: 'european' },
  { code: 'SC2', name: 'League One', country: '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scotland', seasonFormat: 'european' },
  { code: 'SC3', name: 'League Two', country: '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scotland', seasonFormat: 'european' },
  
  // Germany
  { code: 'D1', name: 'Bundesliga', country: '🇩🇪 Germany', seasonFormat: 'european' },
  { code: 'D2', name: '2. Bundesliga', country: '🇩🇪 Germany', seasonFormat: 'european' },
  
  // Italy
  { code: 'I1', name: 'Serie A', country: '🇮🇹 Italy', seasonFormat: 'european' },
  { code: 'I2', name: 'Serie B', country: '🇮🇹 Italy', seasonFormat: 'european' },
  
  // Spain
  { code: 'SP1', name: 'La Liga', country: '🇪🇸 Spain', seasonFormat: 'european' },
  { code: 'SP2', name: 'La Liga 2', country: '🇪🇸 Spain', seasonFormat: 'european' },
  
  // France
  { code: 'F1', name: 'Ligue 1', country: '🇫🇷 France', seasonFormat: 'european' },
  { code: 'F2', name: 'Ligue 2', country: '🇫🇷 France', seasonFormat: 'european' },
  
  // Netherlands
  { code: 'N1', name: 'Eredivisie', country: '🇳🇱 Netherlands', seasonFormat: 'european' },
  
  // Belgium
  { code: 'B1', name: 'Pro League', country: '🇧🇪 Belgium', seasonFormat: 'european' },
  
  // Portugal
  { code: 'P1', name: 'Primeira Liga', country: '🇵🇹 Portugal', seasonFormat: 'european' },
  
  // Turkey
  { code: 'T1', name: 'Süper Lig', country: '🇹🇷 Turkey', seasonFormat: 'european' },
  
  // Greece
  { code: 'G1', name: 'Super League', country: '🇬🇷 Greece', seasonFormat: 'european' },
];

export async function GET() {
  return NextResponse.json({ leagues });
}
