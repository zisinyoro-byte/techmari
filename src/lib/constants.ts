// ============================================================================
// Shared constants for techmari soccer analytics
// Extracted from page.tsx, predict/route.ts, backtest/route.ts, analytics/route.ts, results/route.ts
// ============================================================================

// Season dropdown options for the UI
export const seasons = [
  { code: 'all', name: '📋 All Seasons (2015-2026)' },
  { code: '2526', name: '2025-26 (Current)' },
  { code: '2425', name: '2024-25' },
  { code: '2324', name: '2023-24' },
  { code: '2223', name: '2022-23' },
  { code: '2122', name: '2021-22' },
  { code: '2021', name: '2020-21' },
  { code: '1920', name: '2019-20' },
  { code: '1819', name: '2018-19' },
  { code: '1718', name: '2017-18' },
  { code: '1617', name: '2016-17' },
  { code: '1516', name: '2015-16' },
]

// Season code to display name mapping
export const SEASON_NAMES: Record<string, string> = {
  '2526': '2025-26',
  '2425': '2024-25',
  '2324': '2023-24',
  '2223': '2022-23',
  '2122': '2021-22',
  '2021': '2020-21',
  '1920': '2019-20',
  '1819': '2018-19',
  '1718': '2017-18',
  '1617': '2016-17',
  '1516': '2015-16',
}

// European football seasons (Aug-May, cross-year format)
// 11 seasons from 2015-16 to 2025-26
export const EUROPEAN_SEASONS = ['2526', '2425', '2324', '2223', '2122', '2021', '1920', '1819', '1718', '1617', '1516'];

// Alias used in predict/route.ts
export const ALL_SEASONS = EUROPEAN_SEASONS;

// Chart colors
export const COLORS = {
  homeWin: '#22c55e',
  draw: '#f59e0b',
  awayWin: '#3b82f6',
  btts: '#8b5cf6',
  noBtts: '#6b7280',
  over: '#10b981',
  under: '#ef4444',
}

// Pie chart colors (Home Win, Draw, Away Win)
export const PIE_COLORS = ['#22c55e', '#f59e0b', '#3b82f6']
