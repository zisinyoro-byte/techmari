'use client'

import type { League, MatchResult, Analytics, PredictionResponse, H2HMatch, H2HAnalytics } from '@/lib/types'

// Props for BacktestTab
export interface BacktestTabProps {
  selectedLeague: string
  setSelectedLeague: (league: string) => void
  leagues: League[]
}

// Props for BttsCheckTab
export interface BttsCheckTabProps {
  results: MatchResult[]
  analytics: Analytics | null
  prediction: PredictionResponse | null
  loading: boolean
  selectedLeagueName: string
}

// Props for Over35Tab
export interface Over35TabProps {
  results: MatchResult[]
  analytics: Analytics | null
  prediction: PredictionResponse | null
  loading: boolean
  selectedLeagueName: string
}

// Props for SummaryTab
export interface SummaryTabProps {
  results: MatchResult[]
  analytics: Analytics | null
  prediction: PredictionResponse | null
  selectedLeague: string
  selectedSeason: string
  loading: boolean
  selectedLeagueName: string
  selectedSeasonName: string
}

// Props for OverviewTab
export interface OverviewTabProps {
  results: MatchResult[]
  analytics: Analytics | null
  loading: boolean
  error: string | null
  searchTerm: string
  setSearchTerm: (term: string) => void
  sortConfig: { key: string; direction: 'asc' | 'desc' }
  handleSort: (key: string) => void
  displayLimit: number
  setDisplayLimit: (limit: number | ((prev: number) => number)) => void
  filteredResults: MatchResult[]
  selectedLeagueName: string
  selectedSeasonName: string
  isAllSeasons: boolean
  resultDistributionData: { name: string; value: number }[]
  htFtTransitionsData: { name: string; [key: string]: number | string }[]
  overUnderData: { name: string; value: number; fill: string }[]
}

// Props for HeadToHeadTab
export interface HeadToHeadTabProps {
  results: MatchResult[]
  analytics: Analytics | null
  teams: string[]
  teamsPerSeason: Record<string, number>
  team1: string
  team2: string
  setTeam1: (team: string) => void
  setTeam2: (team: string) => void
  setPredHomeTeam: (team: string) => void
  setPredAwayTeam: (team: string) => void
  h2hMatches: H2HMatch[]
  h2hAnalytics: H2HAnalytics | null
  h2hLoading: boolean
  h2hError: string | null
  fetchH2H: () => void
  selectedLeague: string
  selectedSeason: string
  isAllSeasons: boolean
  teamForm: Map<string, { form: ('W' | 'D' | 'L')[]; inForm: boolean; points: number }>
  filteredH2HResults: {
    score00: { teams: string; score: string; date: string; season?: string }[]
    score10: { teams: string; score: string; date: string; winner: string; season?: string }[]
    score20: { teams: string; score: string; date: string; winner: string; season?: string }[]
  }
  h2hTrackerSearch: string
  setH2hTrackerSearch: (search: string) => void
}

// Props for PredictionsTab
export interface PredictionsTabProps {
  results: MatchResult[]
  analytics: Analytics | null
  teams: string[]
  teamsPerSeason: Record<string, number>
  predHomeTeam: string
  predAwayTeam: string
  setPredHomeTeam: (team: string) => void
  setPredAwayTeam: (team: string) => void
  setTeam1: (team: string) => void
  setTeam2: (team: string) => void
  prediction: PredictionResponse | null
  predLoading: boolean
  predError: string | null
  bookmakerOdds15: string
  setBookmakerOdds15: (odds: string) => void
  bookmakerOddsBtts: string
  setBookmakerOddsBtts: (odds: string) => void
  fetchPrediction: () => void
  selectedLeague: string
  selectedSeason: string
  isAllSeasons: boolean
  teamForm: Map<string, { form: ('W' | 'D' | 'L')[]; inForm: boolean; points: number }>
}

// Props for ModelsTab
export interface ModelsTabProps {
  results: MatchResult[]
  analytics: Analytics | null
  prediction: PredictionResponse | null
  predHomeTeam: string
  predAwayTeam: string
  selectedLeague: string
  selectedSeason: string
  loading: boolean
}
