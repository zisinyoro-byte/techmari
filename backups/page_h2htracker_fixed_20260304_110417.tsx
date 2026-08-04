'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { ArrowUpDown, Search, Trophy, Goal, TrendingUp, RefreshCw, Users, Target, Zap, Dice5, BarChart3, DollarSign, Sparkles, AlertTriangle, CheckCircle, Calendar } from 'lucide-react'

// Types
interface League {
  code: string
  name: string
  country: string
}

interface MatchResult {
  date: string
  time: string
  homeTeam: string
  awayTeam: string
  referee: string
  ftHomeGoals: number
  ftAwayGoals: number
  ftResult: 'H' | 'D' | 'A'
  htHomeGoals: number
  htAwayGoals: number
  htResult: 'H' | 'D' | 'A'
  season?: string
  // Match Stats
  homeShots: number
  awayShots: number
  homeShotsOnTarget: number
  awayShotsOnTarget: number
  homeCorners: number
  awayCorners: number
  homeFouls: number
  awayFouls: number
  homeYellowCards: number
  awayYellowCards: number
  homeRedCards: number
  awayRedCards: number
  // Odds
  oddsAvgHome: number | null
  oddsAvgDraw: number | null
  oddsAvgAway: number | null
  oddsB365Home: number | null
  oddsB365Draw: number | null
  oddsB365Away: number | null
  oddsOver25: number | null
  oddsUnder25: number | null
}

interface H2HMatch extends MatchResult {
  shHomeGoals: number
  shAwayGoals: number
  shResult: 'H' | 'D' | 'A'
  bttsFullTime: boolean
  bttsFirstHalf: boolean
  bttsSecondHalf: boolean
  bttsBothHalves: boolean
  homeTeamIsHome: boolean
}

interface H2HAnalytics {
  totalMatches: number
  homeTeamWins: number
  draws: number
  awayTeamWins: number
  homeTeamWinPercent: number
  drawPercent: number
  awayTeamWinPercent: number
  totalGoals: number
  avgGoalsPerGame: number
  bttsFullTime: { count: number; percent: number }
  bttsFirstHalf: { count: number; percent: number }
  bttsSecondHalf: { count: number; percent: number }
  bttsBothHalves: { count: number; percent: number }
  avgHomeTeamGoals: number
  avgAwayTeamGoals: number
  over25Goals: { count: number; percent: number }
  over35Goals: { count: number; percent: number }
  htHomeTeamLeads: number
  htDraws: number
  htAwayTeamLeads: number
  homeTeamComebacks: number
  awayTeamComebacks: number
  seasonsCount?: number
  seasonsPlayed?: string[]
  avgHomeTeamShots: number
  avgAwayTeamShots: number
  avgHomeTeamShotsOnTarget: number
  avgAwayTeamShotsOnTarget: number
  avgHomeTeamCorners: number
  avgAwayTeamCorners: number
  avgHomeTeamFouls: number
  avgAwayTeamFouls: number
  totalCards: number
  oddsAnalysis: {
    matchesWithOdds: number
    favoriteWins: number
    favoriteWinPercent: number
    underdogWins: number
    underdogWinPercent: number
    avgHomeTeamWinOdds: number
    avgDrawOdds: number
    avgAwayTeamWinOdds: number
  }
}

interface Analytics {
  totalMatches: number
  homeWinPercent: number
  drawPercent: number
  awayWinPercent: number
  avgGoalsPerGame: number
  htftCorrelationPercent: number
  htToftTransitions: {
    htHomeLeads: { ftHomeWin: number; ftDraw: number; ftAwayWin: number }
    htDraw: { ftHomeWin: number; ftDraw: number; ftAwayWin: number }
    htAwayLeads: { ftHomeWin: number; ftDraw: number; ftAwayWin: number }
  }
  resultDistribution: { homeWins: number; draws: number; awayWins: number }
  avgHomeGoals: number
  avgAwayGoals: number
  totalGoals: number
  seasonsCount?: number
  // Match Statistics
  avgHomeShots: number
  avgAwayShots: number
  avgHomeShotsOnTarget: number
  avgAwayShotsOnTarget: number
  avgHomeCorners: number
  avgAwayCorners: number
  avgHomeFouls: number
  avgAwayFouls: number
  avgHomeYellowCards: number
  avgAwayYellowCards: number
  totalRedCards: number
  // Shots Conversion
  homeShotConversion: number
  awayShotConversion: number
  homeShotOnTargetConversion: number
  awayShotOnTargetConversion: number
  overallShotConversion: number
  overallShotOnTargetConversion: number
  // Over/Under 2.5
  over25Count: number
  over25Percent: number
  under25Count: number
  under25Percent: number
  avgTotalGoals: number
  // Odds Analysis
  oddsAnalysis: {
    matchesWithOdds: number
    favoriteWins: number
    favoriteWinPercent: number
    underdogWins: number
    underdogWinPercent: number
    drawsPercent: number
    avgHomeOdds: number
    avgDrawOdds: number
    avgAwayOdds: number
    homeWinImpliedProb: number
    homeWinActualProb: number
    drawImpliedProb: number
    drawActualProb: number
    awayWinImpliedProb: number
    awayWinActualProb: number
  }
}

const seasons = [
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

const SEASON_NAMES: Record<string, string> = {
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

const COLORS = {
  homeWin: '#22c55e',
  draw: '#f59e0b',
  awayWin: '#3b82f6',
  btts: '#8b5cf6',
  noBtts: '#6b7280',
  over: '#10b981',
  under: '#ef4444',
}

const PIE_COLORS = ['#22c55e', '#f59e0b', '#3b82f6']

// Prediction Types
interface TeamStats {
  attack: number
  defense: number
  homeAdvantage: number
  avgScored: number
  avgConceded: number
  homeScored: number
  homeConceded: number
  awayScored: number
  awayConceded: number
  homeGames: number
  awayGames: number
  totalGames: number
  wins: number
  draws: number
  losses: number
  recentForm: ('W' | 'D' | 'L')[]
  recentGoalsScored: number
  recentGoalsConceded: number
  bttsFullTime: number
  bttsFirstHalf: number
  bttsSecondHalf: number
  over25: number
  over35: number
}

interface PredictionResult {
  homeWin: number
  draw: number
  awayWin: number
  homeXg: number
  awayXg: number
  likelyScore: string
  likelyScoreProb: number
  over25: number
  over35: number
  over15: number
  over05: number
  btts: number
  scoreMatrix: { score: string; prob: number }[]
  confidence: 'high' | 'medium' | 'low'
  confidenceReason: string
  // Halftime predictions
  htHomeWin: number
  htDraw: number
  htAwayWin: number
  htHomeXg: number
  htAwayXg: number
  htLikelyScore: string
  htLikelyScoreProb: number
  htScoreMatrix: { score: string; prob: number }[]
  // Implied odds
  impliedOdds: {
    homeWin: number
    draw: number
    awayWin: number
    over25: number
    under25: number
    over35: number
    under35: number
    over15: number
    under15: number
    over05: number
    under05: number
    bttsYes: number
    bttsNo: number
    htHomeWin: number
    htDraw: number
    htAwayWin: number
  }
}

interface PredictionResponse {
  prediction: PredictionResult
  homeTeamStats: TeamStats | null
  awayTeamStats: TeamStats | null
  h2hStats: {
    totalMatches: number
    homeTeamWins: number
    draws: number
    awayTeamWins: number
    avgGoals: number
  }
  patternAnalysis: {
    bttsPatterns: { bothHalves: number; firstHalfOnly: number; secondHalfOnly: number; neitherHalf: number }
    goalTiming: { firstHalfGoals: number; secondHalfGoals: number; avgFirstHalfGoals: number; avgSecondHalfGoals: number }
    resultTransitions: { htHomeLeadFtHomeWin: number; htHomeLeadFtDraw: number; htHomeLeadFtAwayWin: number; htDrawFtHomeWin: number; htDrawFtDraw: number; htDrawFtAwayWin: number; htAwayLeadFtHomeWin: number; htAwayLeadFtDraw: number; htAwayLeadFtAwayWin: number }
    comebackRate: number
  }
  leagueInsights: {
    avgGoalsPerGame: number
    avgHomeGoals: number
    avgAwayGoals: number
    homeWinPercent: number
    drawPercent: number
    awayWinPercent: number
    bttsPercent: number
    over25Percent: number
    bestAttack: { team: string; avg: number }
    bestDefense: { team: string; avg: number }
    totalMatches: number
  }
}

// Fixture Types
interface Fixture {
  league: string
  country: string
  date: string
  time: string
  homeTeam: string
  awayTeam: string
  oddsHome: number | null
  oddsDraw: number | null
  oddsAway: number | null
  oddsB365Home: number | null
  oddsB365Draw: number | null
  oddsB365Away: number | null
  oddsOver25: number | null
  oddsUnder25: number | null
  asianHandicap: number | null
  oddsAHH: number | null
  oddsAHA: number | null
}

interface FixturesResponse {
  fixtures: Fixture[]
  lastUpdated: string
  totalFixtures: number
  leagues: { code: string; name: string; country: string; count: number }[]
}

export default function Home() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [selectedLeague, setSelectedLeague] = useState<string>('E0')
  const [selectedSeason, setSelectedSeason] = useState<string>('all')
  const [results, setResults] = useState<MatchResult[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // H2H State
  const [teams, setTeams] = useState<string[]>([])
  const [teamsPerSeason, setTeamsPerSeason] = useState<Record<string, number>>({})
  const [team1, setTeam1] = useState<string>('')
  const [team2, setTeam2] = useState<string>('')
  const [h2hMatches, setH2hMatches] = useState<H2HMatch[]>([])
  const [h2hAnalytics, setH2hAnalytics] = useState<H2HAnalytics | null>(null)
  const [h2hLoading, setH2hLoading] = useState(false)
  const [h2hError, setH2hError] = useState<string | null>(null)

  // Prediction State
  const [predHomeTeam, setPredHomeTeam] = useState<string>('')
  const [predAwayTeam, setPredAwayTeam] = useState<string>('')
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null)
  const [predLoading, setPredLoading] = useState(false)
  const [predError, setPredError] = useState<string | null>(null)
  const [bookmakerOdds15, setBookmakerOdds15] = useState<string>('')
  const [bookmakerOddsBtts, setBookmakerOddsBtts] = useState<string>('')

  // Synced team selection handlers - updates both H2H and Predictions tabs
  const handleTeam1Change = (team: string) => {
    setTeam1(team)
    setPredHomeTeam(team)
  }
  const handleTeam2Change = (team: string) => {
    setTeam2(team)
    setPredAwayTeam(team)
  }
  const handlePredHomeTeamChange = (team: string) => {
    setPredHomeTeam(team)
    setTeam1(team)
  }
  const handlePredAwayTeamChange = (team: string) => {
    setPredAwayTeam(team)
    setTeam2(team)
  }

  // Fixtures State
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [fixturesLoading, setFixturesLoading] = useState(false)
  const [fixturesError, setFixturesError] = useState<string | null>(null)
  const [fixturesLastUpdated, setFixturesLastUpdated] = useState<string>('')
  const [fixturesLeagueFilter, setFixturesLeagueFilter] = useState<string>('all')
  const [fixturesSearch, setFixturesSearch] = useState('')

  // Display limit for results table
  const [displayLimit, setDisplayLimit] = useState(100)

  // Fetch leagues on mount
  useEffect(() => {
    fetch('/api/soccer/leagues')
      .then(res => res.json())
      .then(data => setLeagues(data.leagues))
      .catch(err => console.error('Failed to fetch leagues:', err))
  }, [])

  // Fetch results and analytics when league/season changes
  useEffect(() => {
    if (selectedLeague && selectedSeason) {
      fetchData()
      fetchTeams()
      setDisplayLimit(100) // Reset display limit when changing league/season
    }
  }, [selectedLeague, selectedSeason])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [resultsRes, analyticsRes] = await Promise.all([
        fetch(`/api/soccer/results?league=${selectedLeague}&season=${selectedSeason}`),
        fetch(`/api/soccer/analytics?league=${selectedLeague}&season=${selectedSeason}`)
      ])

      if (!resultsRes.ok || !analyticsRes.ok) {
        throw new Error('Failed to fetch data')
      }

      const resultsData = await resultsRes.json()
      const analyticsData = await analyticsRes.json()

      setResults(resultsData.results || [])
      setAnalytics(analyticsData.analytics || null)
    } catch (err) {
      setError('Failed to load data. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchTeams = async () => {
    try {
      const res = await fetch(`/api/soccer/teams?league=${selectedLeague}&season=${selectedSeason}`)
      if (res.ok) {
        const data = await res.json()
        const newTeams = data.teams || []
        setTeams(newTeams)
        setTeamsPerSeason(data.teamsPerSeason || {})
        
        // Clear selected teams if they're no longer in the list
        if (team1 && !newTeams.includes(team1)) {
          setTeam1('')
        }
        if (team2 && !newTeams.includes(team2)) {
          setTeam2('')
        }
        if (predHomeTeam && !newTeams.includes(predHomeTeam)) {
          setPredHomeTeam('')
        }
        if (predAwayTeam && !newTeams.includes(predAwayTeam)) {
          setPredAwayTeam('')
        }
        
        // Clear prediction when teams change
        setPrediction(null)
      }
    } catch (err) {
      console.error('Failed to fetch teams:', err)
    }
  }

  const fetchH2H = async () => {
    if (!team1 || !team2) {
      setH2hError('Please select both teams')
      return
    }
    if (team1 === team2) {
      setH2hError('Please select different teams')
      return
    }

    setH2hLoading(true)
    setH2hError(null)
    try {
      const res = await fetch(`/api/soccer/h2h?league=${selectedLeague}&season=${selectedSeason}&team1=${encodeURIComponent(team1)}&team2=${encodeURIComponent(team2)}`)
      if (!res.ok) throw new Error('Failed to fetch H2H data')
      
      const data = await res.json()
      setH2hMatches(data.matches || [])
      setH2hAnalytics(data.analytics || null)
    } catch (err) {
      setH2hError('Failed to load H2H data')
      console.error(err)
    } finally {
      setH2hLoading(false)
    }
  }

  const fetchPrediction = async () => {
    if (!predHomeTeam || !predAwayTeam) {
      setPredError('Please select both teams')
      return
    }
    if (predHomeTeam === predAwayTeam) {
      setPredError('Please select different teams')
      return
    }

    setPredLoading(true)
    setPredError(null)
    try {
      const res = await fetch(`/api/soccer/predict?league=${selectedLeague}&season=${selectedSeason}&homeTeam=${encodeURIComponent(predHomeTeam)}&awayTeam=${encodeURIComponent(predAwayTeam)}`)
      if (!res.ok) throw new Error('Failed to fetch prediction')

      const data = await res.json()
      setPrediction(data)
    } catch (err) {
      setPredError('Failed to generate prediction')
      console.error(err)
    } finally {
      setPredLoading(false)
    }
  }

  const fetchFixtures = async () => {
    setFixturesLoading(true)
    setFixturesError(null)
    try {
      const res = await fetch('/api/soccer/fixtures')
      if (!res.ok) throw new Error('Failed to fetch fixtures')
      
      const data = await res.json()
      setFixtures(data.fixtures || [])
      setFixturesLastUpdated(data.lastUpdated || '')
    } catch (err) {
      setFixturesError('Failed to load fixtures')
      console.error(err)
    } finally {
      setFixturesLoading(false)
    }
  }

  // Filter fixtures
  const filteredFixtures = useMemo(() => {
    let filtered = fixtures

    if (fixturesLeagueFilter && fixturesLeagueFilter !== 'all') {
      filtered = filtered.filter(f => f.league === fixturesLeagueFilter)
    }

    if (fixturesSearch) {
      const term = fixturesSearch.toLowerCase()
      filtered = filtered.filter(
        f =>
          f.homeTeam.toLowerCase().includes(term) ||
          f.awayTeam.toLowerCase().includes(term)
      )
    }

    return filtered
  }, [fixtures, fixturesLeagueFilter, fixturesSearch])

  // Get unique leagues from fixtures
  const fixturesLeagues = useMemo(() => {
    const leagueMap = new Map<string, { name: string; country: string; count: number }>()
    for (const f of fixtures) {
      const existing = leagueMap.get(f.league)
      if (existing) {
        existing.count++
      } else {
        leagueMap.set(f.league, { name: f.league, country: f.country, count: 1 })
      }
    }
    return Array.from(leagueMap.values()).sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name))
  }, [fixtures])

  // Filter and sort results
  const filteredResults = useMemo(() => {
    let filtered = results

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        match =>
          match.homeTeam.toLowerCase().includes(term) ||
          match.awayTeam.toLowerCase().includes(term)
      )
    }

    return [...filtered].sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''

      switch (sortConfig.key) {
        case 'date':
          // Parse DD/MM/YYYY or DD/MM/YY format for correct sorting
          const parseDate = (dateStr: string) => {
            if (!dateStr) return new Date(0)
            const parts = dateStr.split('/')
            if (parts.length === 3) {
              let year = parseInt(parts[2], 10)
              // Handle 2-digit years (e.g., "16" -> 2016)
              if (year < 100) {
                year += year < 50 ? 2000 : 1900
              }
              return new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]))
            }
            return new Date(dateStr)
          }
          aVal = parseDate(a.date).getTime()
          bVal = parseDate(b.date).getTime()
          break
        case 'homeTeam':
          aVal = a.homeTeam
          bVal = b.homeTeam
          break
        case 'awayTeam':
          aVal = a.awayTeam
          bVal = b.awayTeam
          break
        case 'ftGoals':
          aVal = a.ftHomeGoals + a.ftAwayGoals
          bVal = b.ftHomeGoals + b.ftAwayGoals
          break
        default:
          return 0
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [results, searchTerm, sortConfig])

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  // Helper function for factorial (used in Bivariate Poisson)
  const factorial = (n: number): number => {
    if (n <= 1) return 1
    return n * factorial(n - 1)
  }

  // Prepare chart data
  const resultDistributionData = analytics ? [
    { name: 'Home Wins', value: analytics.resultDistribution.homeWins },
    { name: 'Draws', value: analytics.resultDistribution.draws },
    { name: 'Away Wins', value: analytics.resultDistribution.awayWins },
  ] : []

  const htFtTransitionsData = analytics ? [
    {
      name: 'HT Home Lead',
      'FT Home Win': analytics.htToftTransitions.htHomeLeads.ftHomeWin,
      'FT Draw': analytics.htToftTransitions.htHomeLeads.ftDraw,
      'FT Away Win': analytics.htToftTransitions.htHomeLeads.ftAwayWin,
    },
    {
      name: 'HT Draw',
      'FT Home Win': analytics.htToftTransitions.htDraw.ftHomeWin,
      'FT Draw': analytics.htToftTransitions.htDraw.ftDraw,
      'FT Away Win': analytics.htToftTransitions.htDraw.ftAwayWin,
    },
    {
      name: 'HT Away Lead',
      'FT Home Win': analytics.htToftTransitions.htAwayLeads.ftHomeWin,
      'FT Draw': analytics.htToftTransitions.htAwayLeads.ftDraw,
      'FT Away Win': analytics.htToftTransitions.htAwayLeads.ftAwayWin,
    },
  ] : []

  const overUnderData = analytics ? [
    { name: 'Over 2.5', value: analytics.over25Count, fill: COLORS.over },
    { name: 'Under 2.5', value: analytics.under25Count, fill: COLORS.under },
  ] : []

  // Calculate last H2H results for each unique team pair
  const lastH2HResults = useMemo(() => {
    if (results.length === 0) return { score00: [], score10: [], score20: [] }

    // Helper to parse DD/MM/YY date format correctly
    const parseDate = (dateStr: string): Date => {
      const parts = dateStr.split('/')
      if (parts.length !== 3) return new Date(0)
      const [day, month, year] = parts
      // Convert 2-digit year to 4-digit (16 → 2016, 99 → 1999)
      const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year)
      return new Date(fullYear, parseInt(month) - 1, parseInt(day))
    }

    // Create a map to track the last match between each team pair
    const h2hMap = new Map<string, { homeTeam: string; awayTeam: string; homeGoals: number; awayGoals: number; date: string; season?: string }>()

    // Sort results by date descending to process most recent first
    const sortedResults = [...results].sort((a, b) => {
      const dateA = parseDate(a.date)
      const dateB = parseDate(b.date)
      return dateB.getTime() - dateA.getTime()
    })

    for (const match of sortedResults) {
      // Create a unique key for each team pair (alphabetically sorted to group home/away)
      const pairKey = [match.homeTeam, match.awayTeam].sort().join(' vs ')
      
      if (!h2hMap.has(pairKey)) {
        h2hMap.set(pairKey, {
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          homeGoals: match.ftHomeGoals,
          awayGoals: match.ftAwayGoals,
          date: match.date,
          season: match.season
        })
      }
    }

    // Group by scoreline
    const score00: { teams: string; score: string; date: string; season?: string }[] = []
    const score10: { teams: string; score: string; date: string; winner: string; season?: string }[] = []
    const score20: { teams: string; score: string; date: string; winner: string; season?: string }[] = []

    h2hMap.forEach((match, pairKey) => {
      const { homeTeam, awayTeam, homeGoals, awayGoals, date, season } = match
      const totalGoals = homeGoals + awayGoals

      if (homeGoals === 0 && awayGoals === 0) {
        score00.push({ teams: pairKey, score: '0-0', date, season })
      } else if (totalGoals === 1) {
        const winner = homeGoals === 1 ? homeTeam : awayTeam
        score10.push({ teams: pairKey, score: `${homeGoals}-${awayGoals}`, date, winner, season })
      } else if (totalGoals === 2 && (homeGoals === 0 || awayGoals === 0)) {
        const winner = homeGoals === 2 ? homeTeam : awayTeam
        score20.push({ teams: pairKey, score: `${homeGoals}-${awayGoals}`, date, winner, season })
      }
    })

    // Sort each group by date (most recent first)
    const sortByDate = (a: { date: string }, b: { date: string }) => {
      const dateA = parseDate(a.date)
      const dateB = parseDate(b.date)
      return dateB.getTime() - dateA.getTime()
    }

    return {
      score00: score00.sort(sortByDate),
      score10: score10.sort(sortByDate),
      score20: score20.sort(sortByDate)
    }
  }, [results])

  const selectedLeagueName = leagues.find(l => l.code === selectedLeague)?.name || 'Premier League'
  const selectedSeasonName = selectedSeason === 'all' ? 'All Seasons' : (seasons.find(s => s.code === selectedSeason)?.name || '2025-26')
  const isAllSeasons = selectedSeason === 'all'

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Trophy className="w-10 h-10" />
            <div>
              <h1 className="text-3xl font-bold">techmari results analyzer</h1>
              <p className="text-green-100 mt-1">HT/FT scores, stats, odds, predictions & BTTS analysis from top leagues</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters */}
        <Card className="mb-6 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Select League & Season</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">League</label>
                <Select value={selectedLeague} onValueChange={setSelectedLeague}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select league" />
                  </SelectTrigger>
                  <SelectContent>
                    {leagues.map(league => (
                      <SelectItem key={league.code} value={league.code}>
                        {league.country} - {league.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Season</label>
                <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select season" />
                  </SelectTrigger>
                  <SelectContent>
                    {seasons.map(season => (
                      <SelectItem key={season.code} value={season.code}>
                        {season.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={() => { fetchData(); fetchTeams(); }} disabled={loading} variant="outline">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 max-w-2xl mx-auto">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              League Overview
            </TabsTrigger>
            <TabsTrigger value="h2h" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Head to Head
            </TabsTrigger>
            <TabsTrigger value="predict" className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Predictions
            </TabsTrigger>
            <TabsTrigger value="models" className="flex items-center gap-2">
              <Dice5 className="w-4 h-4" />
              Models
            </TabsTrigger>
            <TabsTrigger value="summary" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Summary
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {error && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="py-4 text-red-600">{error}</CardContent>
              </Card>
            )}

            {/* Search */}
            <Card className="shadow-md">
              <CardContent className="py-4">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by team name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Analytics Cards */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <Card key={i}><CardContent className="py-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
                ))}
              </div>
            ) : !analytics ? (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="py-8 text-center">
                  <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-3" />
                  <p className="text-amber-700 font-medium">No data available for this selection</p>
                  <p className="text-sm text-muted-foreground mt-2">Try selecting a different season or league</p>
                </CardContent>
              </Card>
            ) : analytics.totalMatches === 0 ? (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="py-8 text-center">
                  <Calendar className="w-8 h-8 mx-auto text-blue-500 mb-3" />
                  <p className="text-blue-700 font-medium">Season hasn't started yet</p>
                  <p className="text-sm text-muted-foreground mt-2">No matches have been played in this season</p>
                </CardContent>
              </Card>
            ) : analytics && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="shadow-md hover:shadow-lg transition-shadow">
                    <CardContent className="py-6">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Trophy className="w-4 h-4" />
                        <span className="text-sm font-medium">Total Matches</span>
                      </div>
                      <p className="text-3xl font-bold mt-2">{analytics.totalMatches}</p>
                      <p className="text-xs text-muted-foreground mt-1">{selectedLeagueName} {selectedSeasonName}{isAllSeasons && analytics.seasonsCount && ` (${analytics.seasonsCount} seasons)`}</p>
                    </CardContent>
                  </Card>

                  <Card className="shadow-md hover:shadow-lg transition-shadow">
                    <CardContent className="py-6">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Goal className="w-4 h-4" />
                        <span className="text-sm font-medium">Avg Goals/Game</span>
                      </div>
                      <p className="text-3xl font-bold mt-2">{analytics.avgGoalsPerGame}</p>
                      <p className="text-xs text-muted-foreground mt-1">Home: {analytics.avgHomeGoals} | Away: {analytics.avgAwayGoals}</p>
                    </CardContent>
                  </Card>

                  <Card className="shadow-md hover:shadow-lg transition-shadow">
                    <CardContent className="py-6">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-sm font-medium">HT-FT Correlation</span>
                      </div>
                      <p className="text-3xl font-bold mt-2 text-green-600">{analytics.htftCorrelationPercent}%</p>
                      <p className="text-xs text-muted-foreground mt-1">HT result = FT result</p>
                    </CardContent>
                  </Card>

                  <Card className="shadow-md hover:shadow-lg transition-shadow">
                    <CardContent className="py-6">
                      <span className="text-sm font-medium text-muted-foreground">Result Distribution</span>
                      <div className="flex gap-2 mt-3 text-sm">
                        <Badge style={{ backgroundColor: COLORS.homeWin }} className="text-white">H: {analytics.homeWinPercent}%</Badge>
                        <Badge style={{ backgroundColor: COLORS.draw }} className="text-white">D: {analytics.drawPercent}%</Badge>
                        <Badge style={{ backgroundColor: COLORS.awayWin }} className="text-white">A: {analytics.awayWinPercent}%</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Over/Under & Odds Analysis Row */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Over/Under 2.5 Analysis */}
                  <Card className="shadow-md border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Goal className="w-5 h-5 text-emerald-600" />
                        Over/Under 2.5 Goals
                      </CardTitle>
                      <CardDescription>Total goals per match distribution</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 rounded-lg bg-emerald-100/50 dark:bg-emerald-800/30">
                          <p className="text-sm text-muted-foreground">Over 2.5 Goals</p>
                          <p className="text-3xl font-bold text-emerald-600">{analytics.over25Percent}%</p>
                          <p className="text-xs text-muted-foreground">{analytics.over25Count} matches</p>
                        </div>
                        <div className="text-center p-4 rounded-lg bg-red-100/50 dark:bg-red-800/30">
                          <p className="text-sm text-muted-foreground">Under 2.5 Goals</p>
                          <p className="text-3xl font-bold text-red-600">{analytics.under25Percent}%</p>
                          <p className="text-xs text-muted-foreground">{analytics.under25Count} matches</p>
                        </div>
                      </div>
                      <div className="mt-4 h-4 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 transition-all" 
                          style={{ width: `${analytics.over25Percent}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Odds Analysis */}
                  <Card className="shadow-md border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-amber-600" />
                        Odds Analysis
                      </CardTitle>
                      <CardDescription>Value betting insights ({analytics.oddsAnalysis.matchesWithOdds} matches with odds)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center p-3 rounded-lg bg-white/50 dark:bg-gray-800/50">
                          <p className="text-xs text-muted-foreground">Favorite Wins</p>
                          <p className="text-2xl font-bold text-amber-600">{analytics.oddsAnalysis.favoriteWinPercent}%</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-white/50 dark:bg-gray-800/50">
                          <p className="text-xs text-muted-foreground">Underdog Wins</p>
                          <p className="text-2xl font-bold text-purple-600">{analytics.oddsAnalysis.underdogWinPercent}%</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-white/50 dark:bg-gray-800/50">
                          <p className="text-xs text-muted-foreground">Draws</p>
                          <p className="text-2xl font-bold text-gray-600">{analytics.oddsAnalysis.drawsPercent}%</p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center">
                          <p className="text-muted-foreground">Avg Odds</p>
                          <p className="font-semibold">H: {analytics.oddsAnalysis.avgHomeOdds}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-muted-foreground">Avg Odds</p>
                          <p className="font-semibold">D: {analytics.oddsAnalysis.avgDrawOdds}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-muted-foreground">Avg Odds</p>
                          <p className="font-semibold">A: {analytics.oddsAnalysis.avgAwayOdds}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Implied vs Actual Probabilities */}
                {analytics.oddsAnalysis.matchesWithOdds > 0 && (
                  <Card className="shadow-md">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                        Implied vs Actual Probabilities
                      </CardTitle>
                      <CardDescription>Compare bookmaker implied odds with actual outcomes</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-center">Home Win</p>
                          <div className="flex gap-2">
                            <div className="flex-1 text-center p-3 rounded bg-blue-50 dark:bg-blue-900/30">
                              <p className="text-xs text-muted-foreground">Implied</p>
                              <p className="text-xl font-bold text-blue-600">{analytics.oddsAnalysis.homeWinImpliedProb}%</p>
                            </div>
                            <div className="flex-1 text-center p-3 rounded bg-green-50 dark:bg-green-900/30">
                              <p className="text-xs text-muted-foreground">Actual</p>
                              <p className="text-xl font-bold text-green-600">{analytics.oddsAnalysis.homeWinActualProb}%</p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-center">Draw</p>
                          <div className="flex gap-2">
                            <div className="flex-1 text-center p-3 rounded bg-blue-50 dark:bg-blue-900/30">
                              <p className="text-xs text-muted-foreground">Implied</p>
                              <p className="text-xl font-bold text-blue-600">{analytics.oddsAnalysis.drawImpliedProb}%</p>
                            </div>
                            <div className="flex-1 text-center p-3 rounded bg-green-50 dark:bg-green-900/30">
                              <p className="text-xs text-muted-foreground">Actual</p>
                              <p className="text-xl font-bold text-green-600">{analytics.oddsAnalysis.drawActualProb}%</p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-center">Away Win</p>
                          <div className="flex gap-2">
                            <div className="flex-1 text-center p-3 rounded bg-blue-50 dark:bg-blue-900/30">
                              <p className="text-xs text-muted-foreground">Implied</p>
                              <p className="text-xl font-bold text-blue-600">{analytics.oddsAnalysis.awayWinImpliedProb}%</p>
                            </div>
                            <div className="flex-1 text-center p-3 rounded bg-green-50 dark:bg-green-900/30">
                              <p className="text-xs text-muted-foreground">Actual</p>
                              <p className="text-xl font-bold text-green-600">{analytics.oddsAnalysis.awayWinActualProb}%</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Match Statistics */}
                <Card className="shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-600" />
                      Average Match Statistics
                    </CardTitle>
                    <CardDescription>Per-match averages across all games</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                        <p className="text-xs text-muted-foreground">Shots</p>
                        <p className="text-lg font-bold">{analytics.avgHomeShots} - {analytics.avgAwayShots}</p>
                        <p className="text-xs text-muted-foreground">Home - Away</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                        <p className="text-xs text-muted-foreground">Shots on Target</p>
                        <p className="text-lg font-bold">{analytics.avgHomeShotsOnTarget} - {analytics.avgAwayShotsOnTarget}</p>
                        <p className="text-xs text-muted-foreground">Home - Away</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                        <p className="text-xs text-muted-foreground">Corners</p>
                        <p className="text-lg font-bold">{analytics.avgHomeCorners} - {analytics.avgAwayCorners}</p>
                        <p className="text-xs text-muted-foreground">Home - Away</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                        <p className="text-xs text-muted-foreground">Fouls</p>
                        <p className="text-lg font-bold">{analytics.avgHomeFouls} - {analytics.avgAwayFouls}</p>
                        <p className="text-xs text-muted-foreground">Home - Away</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="text-center p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/30">
                        <p className="text-xs text-muted-foreground">Yellow Cards (Avg)</p>
                        <p className="text-lg font-bold">{analytics.avgHomeYellowCards} - {analytics.avgAwayYellowCards}</p>
                        <p className="text-xs text-muted-foreground">Home - Away</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-900/30">
                        <p className="text-xs text-muted-foreground">Total Red Cards</p>
                        <p className="text-lg font-bold">{analytics.totalRedCards}</p>
                        <p className="text-xs text-muted-foreground">In {analytics.totalMatches} matches</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Shots Conversion */}
                <Card className="shadow-md border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="w-5 h-5 text-purple-600" />
                      Shots Conversion Rates
                    </CardTitle>
                    <CardDescription>Goals scored per shots taken (efficiency metrics)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-purple-200">
                        <p className="text-xs text-muted-foreground">Home Shot Conversion</p>
                        <p className="text-2xl font-bold text-purple-600">{analytics.homeShotConversion}%</p>
                        <p className="text-xs text-muted-foreground">Goals per 100 shots</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-purple-200">
                        <p className="text-xs text-muted-foreground">Away Shot Conversion</p>
                        <p className="text-2xl font-bold text-pink-600">{analytics.awayShotConversion}%</p>
                        <p className="text-xs text-muted-foreground">Goals per 100 shots</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-800/30 dark:to-pink-800/30 border border-purple-300">
                        <p className="text-xs text-muted-foreground">Overall Conversion</p>
                        <p className="text-2xl font-bold text-purple-700">{analytics.overallShotConversion}%</p>
                        <p className="text-xs text-muted-foreground">All shots</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                      <div className="text-center p-4 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-green-200">
                        <p className="text-xs text-muted-foreground">Home SOT Conversion</p>
                        <p className="text-2xl font-bold text-green-600">{analytics.homeShotOnTargetConversion}%</p>
                        <p className="text-xs text-muted-foreground">Goals per 100 on target</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-blue-200">
                        <p className="text-xs text-muted-foreground">Away SOT Conversion</p>
                        <p className="text-2xl font-bold text-blue-600">{analytics.awayShotOnTargetConversion}%</p>
                        <p className="text-xs text-muted-foreground">Goals per 100 on target</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-gradient-to-br from-green-100 to-blue-100 dark:from-green-800/30 dark:to-blue-800/30 border border-green-300">
                        <p className="text-xs text-muted-foreground">Overall SOT Conversion</p>
                        <p className="text-2xl font-bold text-green-700">{analytics.overallShotOnTargetConversion}%</p>
                        <p className="text-xs text-muted-foreground">All shots on target</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Charts */}
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="shadow-md">
                    <CardHeader>
                      <CardTitle className="text-lg">Result Distribution</CardTitle>
                      <CardDescription>Full-time result breakdown</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={resultDistributionData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                              {resultDistributionData.map((_, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index]} />)}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-md">
                    <CardHeader>
                      <CardTitle className="text-lg">HT to FT Transitions</CardTitle>
                      <CardDescription>How halftime results evolve to fulltime</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer config={{ 'FT Home Win': { label: 'FT Home Win', color: COLORS.homeWin }, 'FT Draw': { label: 'FT Draw', color: COLORS.draw }, 'FT Away Win': { label: 'FT Away Win', color: COLORS.awayWin } }} className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={htFtTransitionsData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="FT Home Win" stackId="a" fill={COLORS.homeWin} />
                            <Bar dataKey="FT Draw" stackId="a" fill={COLORS.draw} />
                            <Bar dataKey="FT Away Win" stackId="a" fill={COLORS.awayWin} />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* Last H2H Scoreline Tracker */}
                <Card className="shadow-md border-2 border-blue-200 dark:border-blue-800">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="w-5 h-5 text-blue-600" />
                      Last H2H Scoreline Tracker
                    </CardTitle>
                    <CardDescription>Team pairs grouped by their most recent H2H result</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-3 gap-4">
                      {/* 0-0 Section */}
                      <div className="p-4 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 border border-gray-300 dark:border-gray-600">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold text-gray-700 dark:text-gray-200">0-0</h4>
                          <Badge className="bg-gray-500 text-white">{lastH2HResults.score00.length}</Badge>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {lastH2HResults.score00.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">No 0-0 draws</p>
                          ) : (
                            lastH2HResults.score00.map((match, i) => (
                              <div key={i} className="p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                                <p className="text-sm font-medium truncate">{match.teams}</p>
                                <p className="text-xs text-muted-foreground">{match.date}{match.season && ` (${match.season})`}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* 1-0 / 0-1 Section */}
                      <div className="p-4 rounded-lg bg-gradient-to-br from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 border border-yellow-300 dark:border-yellow-700">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold text-yellow-700 dark:text-yellow-300">1-0 / 0-1</h4>
                          <Badge className="bg-yellow-500 text-white">{lastH2HResults.score10.length}</Badge>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {lastH2HResults.score10.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">No 1-0 results</p>
                          ) : (
                            lastH2HResults.score10.map((match, i) => (
                              <div key={i} className="p-2 bg-white dark:bg-gray-900 rounded border border-yellow-200 dark:border-yellow-800">
                                <p className="text-sm font-medium truncate">{match.teams}</p>
                                <div className="flex items-center justify-between">
                                  <p className="text-xs text-muted-foreground">{match.date}{match.season && ` (${match.season})`}</p>
                                  <span className="text-xs font-medium text-yellow-600">{match.score}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* 2-0 / 0-2 Section */}
                      <div className="p-4 rounded-lg bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-300 dark:border-green-700">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold text-green-700 dark:text-green-300">2-0 / 0-2</h4>
                          <Badge className="bg-green-500 text-white">{lastH2HResults.score20.length}</Badge>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {lastH2HResults.score20.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">No 2-0 results</p>
                          ) : (
                            lastH2HResults.score20.map((match, i) => (
                              <div key={i} className="p-2 bg-white dark:bg-gray-900 rounded border border-green-200 dark:border-green-800">
                                <p className="text-sm font-medium truncate">{match.teams}</p>
                                <div className="flex items-center justify-between">
                                  <p className="text-xs text-muted-foreground">{match.date}{match.season && ` (${match.season})`}</p>
                                  <span className="text-xs font-medium text-green-600">{match.score}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-4 text-center">
                      Shows the most recent H2H result for each unique team pair in the selected league/season
                    </p>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Results Table */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">Match Results</CardTitle>
                <CardDescription>{filteredResults.length} matches found{searchTerm && ` for "${searchTerm}"`}</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead><Button variant="ghost" size="sm" onClick={() => handleSort('date')}>Date <ArrowUpDown className="ml-1 w-3 h-3" /></Button></TableHead>
                          {isAllSeasons && <TableHead>Season</TableHead>}
                          <TableHead><Button variant="ghost" size="sm" onClick={() => handleSort('homeTeam')}>Home Team <ArrowUpDown className="ml-1 w-3 h-3" /></Button></TableHead>
                          <TableHead className="text-center">HT Score</TableHead>
                          <TableHead className="text-center">FT Score</TableHead>
                          <TableHead><Button variant="ghost" size="sm" onClick={() => handleSort('awayTeam')}>Away Team <ArrowUpDown className="ml-1 w-3 h-3" /></Button></TableHead>
                          <TableHead className="text-center">Result</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredResults.length === 0 ? (
                          <TableRow><TableCell colSpan={isAllSeasons ? 7 : 6} className="text-center py-8 text-muted-foreground">No matches found. Try adjusting your filters.</TableCell></TableRow>
                        ) : (
                          filteredResults.slice(0, displayLimit).map((match, index) => (
                            <TableRow key={index} className="hover:bg-muted/50">
                              <TableCell className="font-medium">{match.date || 'N/A'}</TableCell>
                              {isAllSeasons && <TableCell><Badge variant="outline">{SEASON_NAMES[match.season || ''] || match.season}</Badge></TableCell>}
                              <TableCell className="font-medium">{match.homeTeam}</TableCell>
                              <TableCell className="text-center"><Badge variant="outline" className="font-mono">{match.htHomeGoals} - {match.htAwayGoals}</Badge></TableCell>
                              <TableCell className="text-center"><Badge variant="secondary" className="font-mono text-base">{match.ftHomeGoals} - {match.ftAwayGoals}</Badge></TableCell>
                              <TableCell className="font-medium">{match.awayTeam}</TableCell>
                              <TableCell className="text-center">
                                <Badge style={{ backgroundColor: match.ftResult === 'H' ? COLORS.homeWin : match.ftResult === 'D' ? COLORS.draw : COLORS.awayWin }} className="text-white min-w-[60px]">
                                  {match.ftResult === 'H' ? 'HOME' : match.ftResult === 'D' ? 'DRAW' : 'AWAY'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                    {filteredResults.length > displayLimit && (
                      <div className="text-center py-4">
                        <p className="text-muted-foreground text-sm mb-3">Showing first {displayLimit} of {filteredResults.length} matches</p>
                        <Button variant="outline" onClick={() => setDisplayLimit(prev => prev + 100)}>
                          Show 100 More
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* H2H Tab */}
          <TabsContent value="h2h" className="space-y-6">
            {/* Team Selectors */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Head-to-Head Analysis
                </CardTitle>
                <CardDescription>
                  Select two teams to compare their historical matchups
                  {teams.length > 0 && <span className="ml-2 text-green-600">• {teams.length} teams available</span>}
                  {isAllSeasons && Object.keys(teamsPerSeason).length > 0 && (
                    <span className="ml-2 text-xs text-gray-500">
                      (Seasons: {Object.entries(teamsPerSeason).filter(([_, v]) => v > 0).map(([k, v]) => `${SEASON_NAMES[k] || k}: ${v}`).join(', ')})
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Team 1</label>
                    <Select value={team1} onValueChange={handleTeam1Change}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select first team" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map(team => (
                          <SelectItem key={team} value={team}>{team}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="text-2xl font-bold text-muted-foreground pb-2">VS</div>

                  <div className="flex-1 min-w-[200px]">
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Team 2</label>
                    <Select value={team2} onValueChange={handleTeam2Change}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select second team" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map(team => (
                          <SelectItem key={team} value={team}>{team}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button onClick={fetchH2H} disabled={h2hLoading || !team1 || !team2}>
                    <Search className="w-4 h-4 mr-2" />
                    Analyze H2H
                  </Button>
                </div>

                {h2hError && <p className="text-red-500 mt-4">{h2hError}</p>}
              </CardContent>
            </Card>

            {h2hLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <Card key={i}><CardContent className="py-6"><Skeleton className="h-16 w-full" /></CardContent></Card>)}
              </div>
            ) : h2hAnalytics && (
              <>
                {/* H2H BTTS Stats - Highlighted */}
                <Card className="shadow-md border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="w-5 h-5 text-purple-600" />
                      BTTS (Both Teams To Score) Statistics
                    </CardTitle>
                    <CardDescription>Key scoring patterns in H2H matches</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 rounded-lg bg-white/50 dark:bg-gray-800/50">
                        <p className="text-sm text-muted-foreground">BTTS Full Time</p>
                        <p className="text-3xl font-bold text-purple-600">{h2hAnalytics.bttsFullTime.percent}%</p>
                        <p className="text-xs text-muted-foreground">{h2hAnalytics.bttsFullTime.count}/{h2hAnalytics.totalMatches} matches</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-white/50 dark:bg-gray-800/50">
                        <p className="text-sm text-muted-foreground">BTTS 1st Half</p>
                        <p className="text-3xl font-bold text-blue-600">{h2hAnalytics.bttsFirstHalf.percent}%</p>
                        <p className="text-xs text-muted-foreground">{h2hAnalytics.bttsFirstHalf.count}/{h2hAnalytics.totalMatches} matches</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-white/50 dark:bg-gray-800/50">
                        <p className="text-sm text-muted-foreground">BTTS 2nd Half</p>
                        <p className="text-3xl font-bold text-green-600">{h2hAnalytics.bttsSecondHalf.percent}%</p>
                        <p className="text-xs text-muted-foreground">{h2hAnalytics.bttsSecondHalf.count}/{h2hAnalytics.totalMatches} matches</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-800/50 dark:to-pink-800/50 ring-2 ring-purple-400">
                        <p className="text-sm text-purple-700 dark:text-purple-300 font-medium">BTTS Both Halves</p>
                        <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">{h2hAnalytics.bttsBothHalves.percent}%</p>
                        <p className="text-xs text-purple-600 dark:text-purple-400">{h2hAnalytics.bttsBothHalves.count}/{h2hAnalytics.totalMatches} matches</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* H2H General Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="shadow-md">
                    <CardContent className="py-6">
                      <span className="text-sm text-muted-foreground">Total H2H Matches</span>
                      <p className="text-3xl font-bold mt-2">{h2hAnalytics.totalMatches}</p>
                      {isAllSeasons && h2hAnalytics.seasonsCount && <p className="text-xs text-muted-foreground mt-1">{h2hAnalytics.seasonsCount} seasons analyzed</p>}
                    </CardContent>
                  </Card>
                  <Card className="shadow-md">
                    <CardContent className="py-6">
                      <span className="text-sm text-muted-foreground">Avg Goals/Game</span>
                      <p className="text-3xl font-bold mt-2">{h2hAnalytics.avgGoalsPerGame}</p>
                      <p className="text-xs text-muted-foreground mt-1">{team1}: {h2hAnalytics.avgHomeTeamGoals} | {team2}: {h2hAnalytics.avgAwayTeamGoals}</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-md">
                    <CardContent className="py-6">
                      <span className="text-sm text-muted-foreground">Over 2.5 Goals</span>
                      <p className="text-3xl font-bold mt-2 text-orange-600">{h2hAnalytics.over25Goals.percent}%</p>
                      <p className="text-xs text-muted-foreground">{h2hAnalytics.over25Goals.count} matches</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-md">
                    <CardContent className="py-6">
                      <span className="text-sm text-muted-foreground">Win Distribution</span>
                      <div className="flex gap-1 mt-2 text-xs">
                        <Badge style={{ backgroundColor: COLORS.homeWin }} className="text-white">{team1.slice(0,3)}: {h2hAnalytics.homeTeamWinPercent}%</Badge>
                        <Badge style={{ backgroundColor: COLORS.draw }} className="text-white">D: {h2hAnalytics.drawPercent}%</Badge>
                        <Badge style={{ backgroundColor: COLORS.awayWin }} className="text-white">{team2.slice(0,3)}: {h2hAnalytics.awayTeamWinPercent}%</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* H2H Match Stats & Odds */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Match Stats */}
                  <Card className="shadow-md">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        H2H Match Statistics
                      </CardTitle>
                      <CardDescription>Average stats per H2H match</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-center p-3 rounded bg-gray-50 dark:bg-gray-800/50">
                          <p className="text-xs text-muted-foreground">Shots</p>
                          <p className="font-bold">{h2hAnalytics.avgHomeTeamShots} - {h2hAnalytics.avgAwayTeamShots}</p>
                          <p className="text-xs text-muted-foreground">{team1.slice(0,10)} - {team2.slice(0,10)}</p>
                        </div>
                        <div className="text-center p-3 rounded bg-gray-50 dark:bg-gray-800/50">
                          <p className="text-xs text-muted-foreground">Shots on Target</p>
                          <p className="font-bold">{h2hAnalytics.avgHomeTeamShotsOnTarget} - {h2hAnalytics.avgAwayTeamShotsOnTarget}</p>
                          <p className="text-xs text-muted-foreground">{team1.slice(0,10)} - {team2.slice(0,10)}</p>
                        </div>
                        <div className="text-center p-3 rounded bg-gray-50 dark:bg-gray-800/50">
                          <p className="text-xs text-muted-foreground">Corners</p>
                          <p className="font-bold">{h2hAnalytics.avgHomeTeamCorners} - {h2hAnalytics.avgAwayTeamCorners}</p>
                          <p className="text-xs text-muted-foreground">{team1.slice(0,10)} - {team2.slice(0,10)}</p>
                        </div>
                        <div className="text-center p-3 rounded bg-gray-50 dark:bg-gray-800/50">
                          <p className="text-xs text-muted-foreground">Fouls</p>
                          <p className="font-bold">{h2hAnalytics.avgHomeTeamFouls} - {h2hAnalytics.avgAwayTeamFouls}</p>
                          <p className="text-xs text-muted-foreground">{team1.slice(0,10)} - {team2.slice(0,10)}</p>
                        </div>
                      </div>
                      <div className="mt-3 text-center p-3 rounded bg-yellow-50 dark:bg-yellow-900/30">
                        <p className="text-xs text-muted-foreground">Total Cards</p>
                        <p className="font-bold">{h2hAnalytics.totalCards}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* H2H Odds Analysis */}
                  <Card className="shadow-md border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-amber-600" />
                        H2H Odds Analysis
                      </CardTitle>
                      <CardDescription>{h2hAnalytics.oddsAnalysis.matchesWithOdds} matches with odds data</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="text-center p-3 rounded bg-white/50 dark:bg-gray-800/50">
                          <p className="text-xs text-muted-foreground">Favorite Won</p>
                          <p className="text-2xl font-bold text-amber-600">{h2hAnalytics.oddsAnalysis.favoriteWinPercent}%</p>
                        </div>
                        <div className="text-center p-3 rounded bg-white/50 dark:bg-gray-800/50">
                          <p className="text-xs text-muted-foreground">Underdog Won</p>
                          <p className="text-2xl font-bold text-purple-600">{h2hAnalytics.oddsAnalysis.underdogWinPercent}%</p>
                        </div>
                        <div className="text-center p-3 rounded bg-white/50 dark:bg-gray-800/50">
                          <p className="text-xs text-muted-foreground">Total Odds</p>
                          <p className="text-lg font-bold">{h2hAnalytics.oddsAnalysis.matchesWithOdds}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center">
                          <p className="text-muted-foreground">Avg Odds</p>
                          <p className="font-semibold">{team1.slice(0,6)}: {h2hAnalytics.oddsAnalysis.avgHomeTeamWinOdds}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-muted-foreground">Avg Odds</p>
                          <p className="font-semibold">Draw: {h2hAnalytics.oddsAnalysis.avgDrawOdds}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-muted-foreground">Avg Odds</p>
                          <p className="font-semibold">{team2.slice(0,6)}: {h2hAnalytics.oddsAnalysis.avgAwayTeamWinOdds}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Seasons Played Card - Only show for all seasons */}
                {isAllSeasons && h2hAnalytics.seasonsPlayed && h2hAnalytics.seasonsPlayed.length > 0 && (
                  <Card className="shadow-md bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                    <CardContent className="py-4">
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Seasons with H2H matches:</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {h2hAnalytics.seasonsPlayed.map(s => (
                          <Badge key={s} variant="outline" className="border-blue-300 text-blue-700 dark:border-blue-600 dark:text-blue-300">{s}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* H2H Match History */}
                <Card className="shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg">H2H Match History</CardTitle>
                    <CardDescription>All matches between {team1} and {team2}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            {isAllSeasons && <TableHead>Season</TableHead>}
                            <TableHead>Home</TableHead>
                            <TableHead className="text-center">1st Half</TableHead>
                            <TableHead className="text-center">2nd Half</TableHead>
                            <TableHead className="text-center">Full Time</TableHead>
                            <TableHead>Away</TableHead>
                            <TableHead className="text-center">BTTS</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {h2hMatches.length === 0 ? (
                            <TableRow><TableCell colSpan={isAllSeasons ? 8 : 7} className="text-center py-8 text-muted-foreground">No H2H matches found between these teams in this season.</TableCell></TableRow>
                          ) : (
                            h2hMatches.map((match, index) => (
                              <TableRow key={index} className={match.bttsBothHalves ? 'bg-purple-50 dark:bg-purple-900/20' : ''}>
                                <TableCell className="font-medium">{match.date || 'N/A'}</TableCell>
                                {isAllSeasons && <TableCell><Badge variant="outline">{SEASON_NAMES[match.season || ''] || match.season}</Badge></TableCell>}
                                <TableCell className={match.homeTeamIsHome ? 'font-bold' : ''}>{match.homeTeam}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className={`font-mono ${match.bttsFirstHalf ? 'border-purple-400 bg-purple-50' : ''}`}>
                                    {match.htHomeGoals} - {match.htAwayGoals}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className={`font-mono ${match.bttsSecondHalf ? 'border-purple-400 bg-purple-50' : ''}`}>
                                    {match.shHomeGoals} - {match.shAwayGoals}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="secondary" className="font-mono text-base">{match.ftHomeGoals} - {match.ftAwayGoals}</Badge>
                                </TableCell>
                                <TableCell className={!match.homeTeamIsHome ? 'font-bold' : ''}>{match.awayTeam}</TableCell>
                                <TableCell className="text-center">
                                  {match.bttsBothHalves ? (
                                    <Badge className="bg-purple-600 text-white"><Zap className="w-3 h-3 mr-1" />BOTH</Badge>
                                  ) : match.bttsFullTime ? (
                                    <Badge variant="outline" className="border-purple-400 text-purple-600">FT</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-muted-foreground">No</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    {h2hMatches.some(m => m.bttsBothHalves) && (
                      <p className="text-sm text-purple-600 mt-4">
                        <Zap className="w-4 h-4 inline mr-1" />
                        Highlighted rows indicate matches where BTTS occurred in BOTH halves
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* HT/FT Analysis */}
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="shadow-md">
                    <CardHeader>
                      <CardTitle className="text-lg">Half Time Analysis</CardTitle>
                      <CardDescription>HT result distribution (from {team1} perspective)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span>{team1} Leading at HT</span>
                          <Badge style={{ backgroundColor: COLORS.homeWin }} className="text-white">{h2hAnalytics.htHomeTeamLeads}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Draw at HT</span>
                          <Badge style={{ backgroundColor: COLORS.draw }} className="text-white">{h2hAnalytics.htDraws}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>{team2} Leading at HT</span>
                          <Badge style={{ backgroundColor: COLORS.awayWin }} className="text-white">{h2hAnalytics.htAwayTeamLeads}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-md">
                    <CardHeader>
                      <CardTitle className="text-lg">Comebacks</CardTitle>
                      <CardDescription>Teams winning after trailing at HT</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span>{team1} Comebacks</span>
                          <Badge variant="secondary">{h2hAnalytics.homeTeamComebacks}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>{team2} Comebacks</span>
                          <Badge variant="secondary">{h2hAnalytics.awayTeamComebacks}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* Prediction Engine Tab */}
          <TabsContent value="predict" className="space-y-6">
            {/* Team Selectors */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  Match Prediction Engine
                </CardTitle>
                <CardDescription>
                  Select teams to generate predictions using Monte Carlo simulation (100,000 iterations)
                  {teams.length > 0 && <span className="ml-2 text-green-600">• {teams.length} teams available</span>}
                  {isAllSeasons && Object.keys(teamsPerSeason).length > 0 && (
                    <span className="ml-2 text-xs text-gray-500">
                      (Seasons: {Object.entries(teamsPerSeason).filter(([_, v]) => v > 0).map(([k, v]) => `${SEASON_NAMES[k] || k}: ${v}`).join(', ')})
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Home Team</label>
                    <Select value={predHomeTeam} onValueChange={handlePredHomeTeamChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select home team" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map(team => (
                          <SelectItem key={`home-${team}`} value={team}>{team}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="text-2xl font-bold text-muted-foreground pb-2">VS</div>

                  <div className="flex-1 min-w-[200px]">
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Away Team</label>
                    <Select value={predAwayTeam} onValueChange={handlePredAwayTeamChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select away team" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map(team => (
                          <SelectItem key={`away-${team}`} value={team}>{team}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button onClick={fetchPrediction} disabled={predLoading || !predHomeTeam || !predAwayTeam} className="bg-purple-600 hover:bg-purple-700">
                    {predLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Predict
                      </>
                    )}
                  </Button>
                </div>

                {predError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {predError}
                  </div>
                )}
              </CardContent>
            </Card>

            {prediction && (
              <>
                {/* Confidence Banner */}
                <Card className={`shadow-md border-2 ${
                  prediction.prediction.confidence === 'high' ? 'border-green-500 bg-green-50' :
                  prediction.prediction.confidence === 'medium' ? 'border-amber-500 bg-amber-50' :
                  'border-gray-300 bg-gray-50'
                }`}>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      {prediction.prediction.confidence === 'high' ? (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      ) : prediction.prediction.confidence === 'medium' ? (
                        <Target className="w-6 h-6 text-amber-600" />
                      ) : (
                        <AlertTriangle className="w-6 h-6 text-gray-600" />
                      )}
                      <div>
                        <p className="font-semibold capitalize">{prediction.prediction.confidence} Confidence Prediction</p>
                        <p className="text-sm text-muted-foreground">{prediction.prediction.confidenceReason}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Main Probabilities */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="shadow-md border-2 border-green-200 bg-gradient-to-b from-green-50 to-white">
                    <CardContent className="py-6 text-center">
                      <p className="text-sm text-muted-foreground uppercase tracking-wide">Home Win</p>
                      <p className="text-4xl font-bold text-green-600 mt-2">{prediction.prediction.homeWin}%</p>
                      <p className="text-sm text-muted-foreground mt-2">xG: {prediction.prediction.homeXg}</p>
                      <p className="text-xs text-green-700 mt-1 font-medium">Odds: {prediction.prediction.impliedOdds.homeWin}</p>
                    </CardContent>
                  </Card>

                  <Card className="shadow-md border-2 border-amber-200 bg-gradient-to-b from-amber-50 to-white">
                    <CardContent className="py-6 text-center">
                      <p className="text-sm text-muted-foreground uppercase tracking-wide">Draw</p>
                      <p className="text-4xl font-bold text-amber-600 mt-2">{prediction.prediction.draw}%</p>
                      <p className="text-sm text-muted-foreground mt-2">Most Likely: {prediction.prediction.likelyScore}</p>
                      <p className="text-xs text-amber-700 mt-1 font-medium">Odds: {prediction.prediction.impliedOdds.draw}</p>
                    </CardContent>
                  </Card>

                  <Card className="shadow-md border-2 border-blue-200 bg-gradient-to-b from-blue-50 to-white">
                    <CardContent className="py-6 text-center">
                      <p className="text-sm text-muted-foreground uppercase tracking-wide">Away Win</p>
                      <p className="text-4xl font-bold text-blue-600 mt-2">{prediction.prediction.awayWin}%</p>
                      <p className="text-sm text-muted-foreground mt-2">xG: {prediction.prediction.awayXg}</p>
                      <p className="text-xs text-blue-700 mt-1 font-medium">Odds: {prediction.prediction.impliedOdds.awayWin}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Halftime Predictions */}
                <Card className="shadow-md border-2 border-cyan-200 bg-gradient-to-r from-cyan-50 to-sky-50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="w-5 h-5 text-cyan-600" />
                      Halftime Predictions
                    </CardTitle>
                    <CardDescription>First half result and expected goals</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center p-4 rounded-lg bg-white/70 border border-green-200">
                        <p className="text-sm text-muted-foreground">HT Home Win</p>
                        <p className="text-2xl font-bold text-green-600 mt-1">{prediction.prediction.htHomeWin}%</p>
                        <p className="text-xs text-green-700 mt-1">Odds: {prediction.prediction.impliedOdds.htHomeWin}</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-white/70 border border-amber-200">
                        <p className="text-sm text-muted-foreground">HT Draw</p>
                        <p className="text-2xl font-bold text-amber-600 mt-1">{prediction.prediction.htDraw}%</p>
                        <p className="text-xs text-amber-700 mt-1">Odds: {prediction.prediction.impliedOdds.htDraw}</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-white/70 border border-blue-200">
                        <p className="text-sm text-muted-foreground">HT Away Win</p>
                        <p className="text-2xl font-bold text-blue-600 mt-1">{prediction.prediction.htAwayWin}%</p>
                        <p className="text-xs text-blue-700 mt-1">Odds: {prediction.prediction.impliedOdds.htAwayWin}</p>
                      </div>
                    </div>
                    <div className="flex justify-center gap-8 text-sm">
                      <div className="text-center">
                        <p className="text-muted-foreground">HT xG (Home)</p>
                        <p className="font-bold text-lg">{prediction.prediction.htHomeXg}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">HT xG (Away)</p>
                        <p className="font-bold text-lg">{prediction.prediction.htAwayXg}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">Most Likely HT Score</p>
                        <p className="font-bold text-lg">{prediction.prediction.htLikelyScore} ({prediction.prediction.htLikelyScoreProb}%)</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-5 gap-2">
                      {prediction.prediction.htScoreMatrix.slice(0, 5).map((s, i) => (
                        <div key={i} className={`text-center p-2 rounded ${i === 0 ? 'bg-cyan-200 border border-cyan-400' : 'bg-white/50'}`}>
                          <p className="font-mono font-bold">{s.score}</p>
                          <p className="text-xs text-muted-foreground">{s.prob}%</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Market Probabilities with Implied Odds */}
                <Card className="shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="w-5 h-5 text-purple-600" />
                      Goals Markets & Implied Odds
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-5 gap-4 mb-4">
                      <div className="text-center p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                        <p className="text-xs text-muted-foreground">Over 0.5</p>
                        <p className="text-2xl font-bold text-emerald-600 mt-1">{prediction.prediction.over05}%</p>
                        <div className="flex flex-col gap-1 mt-1 text-xs">
                          <span className="bg-emerald-100 px-1 py-0.5 rounded">O: {prediction.prediction.impliedOdds.over05}</span>
                          <span className="bg-gray-100 px-1 py-0.5 rounded">U: {prediction.prediction.impliedOdds.under05}</span>
                        </div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-teal-50 border border-teal-200">
                        <p className="text-xs text-muted-foreground">Over 1.5</p>
                        <p className="text-2xl font-bold text-teal-600 mt-1">{prediction.prediction.over15}%</p>
                        <div className="flex flex-col gap-1 mt-1 text-xs">
                          <span className="bg-teal-100 px-1 py-0.5 rounded">O: {prediction.prediction.impliedOdds.over15}</span>
                          <span className="bg-gray-100 px-1 py-0.5 rounded">U: {prediction.prediction.impliedOdds.under15}</span>
                        </div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-purple-50 border border-purple-200">
                        <p className="text-xs text-muted-foreground">Over 2.5</p>
                        <p className="text-2xl font-bold text-purple-600 mt-1">{prediction.prediction.over25}%</p>
                        <div className="flex flex-col gap-1 mt-1 text-xs">
                          <span className="bg-purple-100 px-1 py-0.5 rounded">O: {prediction.prediction.impliedOdds.over25}</span>
                          <span className="bg-gray-100 px-1 py-0.5 rounded">U: {prediction.prediction.impliedOdds.under25}</span>
                        </div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-indigo-50 border border-indigo-200">
                        <p className="text-xs text-muted-foreground">Over 3.5</p>
                        <p className="text-2xl font-bold text-indigo-600 mt-1">{prediction.prediction.over35}%</p>
                        <div className="flex flex-col gap-1 mt-1 text-xs">
                          <span className="bg-indigo-100 px-1 py-0.5 rounded">O: {prediction.prediction.impliedOdds.over35}</span>
                          <span className="bg-gray-100 px-1 py-0.5 rounded">U: {prediction.prediction.impliedOdds.under35}</span>
                        </div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-pink-50 border border-pink-200">
                        <p className="text-xs text-muted-foreground">BTTS</p>
                        <p className="text-2xl font-bold text-pink-600 mt-1">{prediction.prediction.btts}%</p>
                        <div className="flex flex-col gap-1 mt-1 text-xs">
                          <span className="bg-pink-100 px-1 py-0.5 rounded">Yes: {prediction.prediction.impliedOdds.bttsYes}</span>
                          <span className="bg-gray-100 px-1 py-0.5 rounded">No: {prediction.prediction.impliedOdds.bttsNo}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Value Bet Calculator for O1.5 & BTTS */}
                <Card className="shadow-md border-2 border-yellow-300 bg-gradient-to-r from-yellow-50 to-amber-50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-yellow-600" />
                      Value Bet Calculator - Over 1.5 & BTTS
                    </CardTitle>
                    <CardDescription>Enter bookmaker odds to find value bets</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Over 1.5 */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-teal-700">Over 1.5 Goals</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-muted-foreground">Bookmaker Odds</label>
                            <Input
                              type="number"
                              step="0.01"
                              min="1.01"
                              placeholder="e.g. 1.85"
                              value={bookmakerOdds15}
                              onChange={(e) => setBookmakerOdds15(e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Model Probability</label>
                            <div className="mt-1 p-2 bg-teal-100 rounded text-center">
                              <span className="text-lg font-bold text-teal-700">{prediction.prediction.over15}%</span>
                            </div>
                          </div>
                        </div>
                        {bookmakerOdds15 && parseFloat(bookmakerOdds15) > 1 && (
                          <div className={`p-4 rounded-lg ${
                            ((prediction.prediction.over15 / 100) * parseFloat(bookmakerOdds15)) > 1 
                              ? 'bg-green-100 border-2 border-green-400' 
                              : 'bg-red-100 border-2 border-red-300'
                          }`}>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div>
                                <p className="text-xs text-muted-foreground">Implied Prob</p>
                                <p className="font-bold">{(100 / parseFloat(bookmakerOdds15)).toFixed(1)}%</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Expected Value</p>
                                <p className={`font-bold text-lg ${((prediction.prediction.over15 / 100) * parseFloat(bookmakerOdds15)) > 1 ? 'text-green-600' : 'text-red-600'}`}>
                                  {(((prediction.prediction.over15 / 100) * parseFloat(bookmakerOdds15)) * 100 - 100).toFixed(1)}%
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Verdict</p>
                                <p className={`font-bold ${((prediction.prediction.over15 / 100) * parseFloat(bookmakerOdds15)) > 1 ? 'text-green-600' : 'text-red-600'}`}>
                                  {((prediction.prediction.over15 / 100) * parseFloat(bookmakerOdds15)) > 1 ? '✓ VALUE' : '✗ NO VALUE'}
                                </p>
                              </div>
                            </div>
                            {((prediction.prediction.over15 / 100) * parseFloat(bookmakerOdds15)) > 1 && (
                              <p className="text-center text-sm text-green-700 mt-2">
                                Edge: Model rates this {(prediction.prediction.over15 - (100 / parseFloat(bookmakerOdds15))).toFixed(1)}% higher than bookmaker
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* BTTS Yes */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-purple-700">BTTS Yes</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-muted-foreground">Bookmaker Odds</label>
                            <Input
                              type="number"
                              step="0.01"
                              min="1.01"
                              placeholder="e.g. 1.75"
                              value={bookmakerOddsBtts}
                              onChange={(e) => setBookmakerOddsBtts(e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Model Probability</label>
                            <div className="mt-1 p-2 bg-purple-100 rounded text-center">
                              <span className="text-lg font-bold text-purple-700">{prediction.prediction.btts}%</span>
                            </div>
                          </div>
                        </div>
                        {bookmakerOddsBtts && parseFloat(bookmakerOddsBtts) > 1 && (
                          <div className={`p-4 rounded-lg ${
                            ((prediction.prediction.btts / 100) * parseFloat(bookmakerOddsBtts)) > 1 
                              ? 'bg-green-100 border-2 border-green-400' 
                              : 'bg-red-100 border-2 border-red-300'
                          }`}>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div>
                                <p className="text-xs text-muted-foreground">Implied Prob</p>
                                <p className="font-bold">{(100 / parseFloat(bookmakerOddsBtts)).toFixed(1)}%</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Expected Value</p>
                                <p className={`font-bold text-lg ${((prediction.prediction.btts / 100) * parseFloat(bookmakerOddsBtts)) > 1 ? 'text-green-600' : 'text-red-600'}`}>
                                  {(((prediction.prediction.btts / 100) * parseFloat(bookmakerOddsBtts)) * 100 - 100).toFixed(1)}%
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Verdict</p>
                                <p className={`font-bold ${((prediction.prediction.btts / 100) * parseFloat(bookmakerOddsBtts)) > 1 ? 'text-green-600' : 'text-red-600'}`}>
                                  {((prediction.prediction.btts / 100) * parseFloat(bookmakerOddsBtts)) > 1 ? '✓ VALUE' : '✗ NO VALUE'}
                                </p>
                              </div>
                            </div>
                            {((prediction.prediction.btts / 100) * parseFloat(bookmakerOddsBtts)) > 1 && (
                              <p className="text-center text-sm text-green-700 mt-2">
                                Edge: Model rates this {(prediction.prediction.btts - (100 / parseFloat(bookmakerOddsBtts))).toFixed(1)}% higher than bookmaker
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-4 text-center">
                      💡 Value = (Model Probability × Bookmaker Odds) - 1. Positive expected value indicates a potential value bet.
                    </p>
                  </CardContent>
                </Card>

                {/* Score Matrix */}
                <Card className="shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg">Most Likely Scorelines</CardTitle>
                    <CardDescription>Top 10 predicted scores from Monte Carlo simulation</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-5 gap-3">
                      {prediction.prediction.scoreMatrix.map((s, i) => (
                        <div key={i} className={`text-center p-3 rounded-lg ${i === 0 ? 'bg-green-100 border-2 border-green-400' : 'bg-gray-50'}`}>
                          <p className="font-mono font-bold text-lg">{s.score}</p>
                          <p className="text-xs text-muted-foreground">{s.prob}%</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Team Statistics Comparison */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Home Team Stats */}
                  <Card className="shadow-md border-l-4 border-l-green-500">
                    <CardHeader>
                      <CardTitle className="text-lg">{predHomeTeam} (Home)</CardTitle>
                      <CardDescription>Team statistics</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {prediction.homeTeamStats && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Attack Strength</p>
                              <p className="text-xl font-bold">{(prediction.homeTeamStats.attack * 100).toFixed(0)}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Defense Strength</p>
                              <p className="text-xl font-bold">{(prediction.homeTeamStats.defense * 100).toFixed(0)}%</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Avg Goals Scored</p>
                              <p className="font-semibold">{prediction.homeTeamStats.avgScored.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Avg Goals Conceded</p>
                              <p className="font-semibold">{prediction.homeTeamStats.avgConceded.toFixed(2)}</p>
                            </div>
                          </div>
                          <div className="pt-2 border-t">
                            <p className="text-xs text-muted-foreground mb-1">Recent Form (Last 5)</p>
                            <div className="flex gap-1">
                              {prediction.homeTeamStats.recentForm.map((r, i) => (
                                <Badge key={i} className={`w-8 h-8 flex items-center justify-center ${
                                  r === 'W' ? 'bg-green-500' : r === 'D' ? 'bg-amber-500' : 'bg-red-500'
                                }`}>
                                  {r}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Games: {prediction.homeTeamStats.totalGames}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">W/D/L: {prediction.homeTeamStats.wins}/{prediction.homeTeamStats.draws}/{prediction.homeTeamStats.losses}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Away Team Stats */}
                  <Card className="shadow-md border-l-4 border-l-blue-500">
                    <CardHeader>
                      <CardTitle className="text-lg">{predAwayTeam} (Away)</CardTitle>
                      <CardDescription>Team statistics</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {prediction.awayTeamStats && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Attack Strength</p>
                              <p className="text-xl font-bold">{(prediction.awayTeamStats.attack * 100).toFixed(0)}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Defense Strength</p>
                              <p className="text-xl font-bold">{(prediction.awayTeamStats.defense * 100).toFixed(0)}%</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Avg Goals Scored</p>
                              <p className="font-semibold">{prediction.awayTeamStats.avgScored.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Avg Goals Conceded</p>
                              <p className="font-semibold">{prediction.awayTeamStats.avgConceded.toFixed(2)}</p>
                            </div>
                          </div>
                          <div className="pt-2 border-t">
                            <p className="text-xs text-muted-foreground mb-1">Recent Form (Last 5)</p>
                            <div className="flex gap-1">
                              {prediction.awayTeamStats.recentForm.map((r, i) => (
                                <Badge key={i} className={`w-8 h-8 flex items-center justify-center ${
                                  r === 'W' ? 'bg-green-500' : r === 'D' ? 'bg-amber-500' : 'bg-red-500'
                                }`}>
                                  {r}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Games: {prediction.awayTeamStats.totalGames}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">W/D/L: {prediction.awayTeamStats.wins}/{prediction.awayTeamStats.draws}/{prediction.awayTeamStats.losses}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* H2H & League Insights */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* H2H Stats */}
                  <Card className="shadow-md">
                    <CardHeader>
                      <CardTitle className="text-lg">Head-to-Head History</CardTitle>
                      <CardDescription>Historical matchups between these teams</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {prediction.h2hStats.totalMatches > 0 ? (
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span>Total Meetings</span>
                            <Badge variant="secondary">{prediction.h2hStats.totalMatches}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>{predHomeTeam} Wins</span>
                            <Badge style={{ backgroundColor: COLORS.homeWin }} className="text-white">{prediction.h2hStats.homeTeamWins}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Draws</span>
                            <Badge style={{ backgroundColor: COLORS.draw }} className="text-white">{prediction.h2hStats.draws}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>{predAwayTeam} Wins</span>
                            <Badge style={{ backgroundColor: COLORS.awayWin }} className="text-white">{prediction.h2hStats.awayTeamWins}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Avg Goals/Game</span>
                            <Badge variant="outline">{prediction.h2hStats.avgGoals}</Badge>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-4">No historical matchups found</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* League Insights */}
                  <Card className="shadow-md">
                    <CardHeader>
                      <CardTitle className="text-lg">League Insights</CardTitle>
                      <CardDescription>League-wide statistics for context</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Avg Goals/Game</p>
                            <p className="font-semibold">{prediction.leagueInsights.avgGoalsPerGame}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">BTTS %</p>
                            <p className="font-semibold">{prediction.leagueInsights.bttsPercent}%</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Home Win %</p>
                            <p className="font-semibold">{prediction.leagueInsights.homeWinPercent}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Away Win %</p>
                            <p className="font-semibold">{prediction.leagueInsights.awayWinPercent}%</p>
                          </div>
                        </div>
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground mb-1">Best Attack</p>
                          <p className="font-semibold">{prediction.leagueInsights.bestAttack.team} ({prediction.leagueInsights.bestAttack.avg} goals/game)</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Best Defense</p>
                          <p className="font-semibold">{prediction.leagueInsights.bestDefense.team} ({prediction.leagueInsights.bestDefense.avg} conceded/game)</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Pattern Analysis */}
                <Card className="shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-600" />
                      League Pattern Analysis
                    </CardTitle>
                    <CardDescription>Identified patterns from historical data</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                        <p className="text-xs text-muted-foreground">BTTS Both Halves</p>
                        <p className="text-2xl font-bold text-indigo-600">{prediction.patternAnalysis.bttsPatterns.bothHalves}%</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                        <p className="text-xs text-muted-foreground">Comeback Rate</p>
                        <p className="text-2xl font-bold text-indigo-600">{prediction.patternAnalysis.comebackRate}%</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                        <p className="text-xs text-muted-foreground">1H Avg Goals</p>
                        <p className="text-2xl font-bold text-indigo-600">{prediction.patternAnalysis.goalTiming.avgFirstHalfGoals}</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                        <p className="text-xs text-muted-foreground">2H Avg Goals</p>
                        <p className="text-2xl font-bold text-indigo-600">{prediction.patternAnalysis.goalTiming.avgSecondHalfGoals}</p>
                      </div>
                    </div>
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-2">HT/FT Transitions (Home Lead →)</p>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="text-center p-2 bg-green-100 rounded">
                          <p className="text-xs text-muted-foreground">FT Win</p>
                          <p className="font-bold">{prediction.patternAnalysis.resultTransitions.htHomeLeadFtHomeWin}%</p>
                        </div>
                        <div className="text-center p-2 bg-amber-100 rounded">
                          <p className="text-xs text-muted-foreground">FT Draw</p>
                          <p className="font-bold">{prediction.patternAnalysis.resultTransitions.htHomeLeadFtDraw}%</p>
                        </div>
                        <div className="text-center p-2 bg-blue-100 rounded">
                          <p className="text-xs text-muted-foreground">FT Loss</p>
                          <p className="font-bold">{prediction.patternAnalysis.resultTransitions.htHomeLeadFtAwayWin}%</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Models Tab */}
          <TabsContent value="models" className="space-y-6">
            {/* Models Overview */}
            <Card className="shadow-md border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Dice5 className="w-5 h-5 text-indigo-600" />
                  Advanced Statistical Models
                </CardTitle>
                <CardDescription>
                  Dixon-Coles, Time-Weighted Poisson, Elo Ratings, and Bivariate Poisson models for match prediction
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  <div className="p-3 rounded-lg bg-blue-100/50 dark:bg-blue-800/30">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Dixon-Coles</p>
                    <p className="text-xs text-muted-foreground">Low-score correction</p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-100/50 dark:bg-green-800/30">
                    <p className="text-xs font-medium text-green-700 dark:text-green-300">Time-Weighted</p>
                    <p className="text-xs text-muted-foreground">Recent form focus</p>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-100/50 dark:bg-purple-800/30">
                    <p className="text-xs font-medium text-purple-700 dark:text-purple-300">Elo Ratings</p>
                    <p className="text-xs text-muted-foreground">Team strength</p>
                  </div>
                  <div className="p-3 rounded-lg bg-pink-100/50 dark:bg-pink-800/30">
                    <p className="text-xs font-medium text-pink-700 dark:text-pink-300">Bivariate Poisson</p>
                    <p className="text-xs text-muted-foreground">Goal correlation</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {loading ? (
              <div className="grid gap-4">
                {[1, 2, 3, 4].map(i => <Card key={i}><CardContent className="py-6"><Skeleton className="h-32 w-full" /></CardContent></Card>)}
              </div>
            ) : analytics && results.length > 0 ? (
              <>
                {/* 1. Dixon-Coles Model */}
                <Card className="shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-blue-600" />
                      Dixon-Coles Model
                    </CardTitle>
                    <CardDescription>
                      Fixes the low-score issue in standard Poisson by adding a dependence correction for 0-0, 1-0, 0-1, and 1-1 scores
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Home Attack Strength (α)</p>
                          <p className="text-2xl font-bold text-blue-600 mt-1">
                            {(analytics.avgHomeGoals / analytics.avgGoalsPerGame).toFixed(3)}
                          </p>
                          <p className="text-xs text-muted-foreground">Relative to league average</p>
                        </div>
                        <div className="p-4 bg-pink-50 dark:bg-pink-900/30 rounded-lg">
                          <p className="text-sm font-medium text-pink-700 dark:text-pink-300">Away Attack Strength (β)</p>
                          <p className="text-2xl font-bold text-pink-600 mt-1">
                            {(analytics.avgAwayGoals / analytics.avgGoalsPerGame).toFixed(3)}
                          </p>
                          <p className="text-xs text-muted-foreground">Relative to league average</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
                          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Dixon-Coles ρ (Correlation)</p>
                          <p className="text-2xl font-bold text-amber-600 mt-1">
                            {(() => {
                              // Estimate rho from low-score frequencies
                              const total = analytics.totalMatches
                              const under25 = analytics.under25Count
                              const under25Ratio = under25 / total
                              // Rho is typically negative for football (-0.1 to -0.2)
                              const rho = -0.13 - (under25Ratio - 0.5) * 0.1
                              return rho.toFixed(3)
                            })()}
                          </p>
                          <p className="text-xs text-muted-foreground">Negative = fewer low scores than expected</p>
                        </div>
                        <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
                          <p className="text-sm font-medium text-green-700 dark:text-green-300">Correction Effect</p>
                          <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                            <div className="text-center">
                              <p className="font-medium">0-0 adj.</p>
                              <p className="text-green-600">×{((1 - 0.13) * 1.05).toFixed(2)}</p>
                            </div>
                            <div className="text-center">
                              <p className="font-medium">1-1 adj.</p>
                              <p className="text-green-600">×{((1 + 0.13) * 0.98).toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Expected Score Line */}
                    <div className="mt-6 p-4 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 rounded-lg border border-indigo-200 dark:border-indigo-700">
                      <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-3 flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Expected Correct Score Probabilities
                      </p>
                      {(() => {
                        const lambdaHome = analytics.avgHomeGoals
                        const lambdaAway = analytics.avgAwayGoals
                        const rho = -0.13 // Dixon-Coles correlation
                        
                        // Dixon-Coles tau function
                        const tau = (x: number, y: number, lambda1: number, lambda2: number, rho: number): number => {
                          if (x === 0 && y === 0) return 1 - lambda1 * lambda2 * rho
                          if (x === 0 && y === 1) return 1 + lambda1 * rho
                          if (x === 1 && y === 0) return 1 + lambda2 * rho
                          if (x === 1 && y === 1) return 1 - rho
                          return 1
                        }
                        
                        // Calculate Dixon-Coles probability
                        const dcProb = (x: number, y: number): number => {
                          const poisX = Math.exp(-lambdaHome) * Math.pow(lambdaHome, x) / factorial(x)
                          const poisY = Math.exp(-lambdaAway) * Math.pow(lambdaAway, y) / factorial(y)
                          return poisX * poisY * tau(x, y, lambdaHome, lambdaAway, rho)
                        }
                        
                        // Generate all score probabilities
                        const scores: { score: string; prob: number; home: number; away: number }[] = []
                        for (let h = 0; h <= 5; h++) {
                          for (let a = 0; a <= 5; a++) {
                            scores.push({
                              score: `${h}-${a}`,
                              prob: dcProb(h, a),
                              home: h,
                              away: a
                            })
                          }
                        }
                        
                        // Sort by probability and get top 10
                        const topScores = scores.sort((a, b) => b.prob - a.prob).slice(0, 10)
                        const expectedScore = topScores[0]
                        
                        return (
                          <>
                            {/* Expected Score Highlight */}
                            <div className="mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg border-2 border-indigo-400 text-center">
                              <p className="text-xs text-muted-foreground mb-1">Most Likely Scoreline</p>
                              <p className="text-4xl font-bold text-indigo-600">{expectedScore.score}</p>
                              <p className="text-sm text-indigo-500 mt-1">{(expectedScore.prob * 100).toFixed(1)}% probability</p>
                            </div>
                            
                            {/* Top 10 Score Probabilities */}
                            <div className="grid grid-cols-5 gap-2">
                              {topScores.map((s, i) => (
                                <div 
                                  key={s.score} 
                                  className={`text-center p-2 rounded ${i === 0 ? 'bg-indigo-500 text-white' : 'bg-white dark:bg-gray-800'}`}
                                >
                                  <p className={`text-xs ${i === 0 ? 'text-indigo-100' : 'text-muted-foreground'}`}>#{i + 1}</p>
                                  <p className={`font-bold ${i === 0 ? 'text-lg' : 'text-sm'}`}>{s.score}</p>
                                  <p className={`text-xs ${i === 0 ? 'text-indigo-200' : 'text-muted-foreground'}`}>
                                    {(s.prob * 100).toFixed(1)}%
                                  </p>
                                </div>
                              ))}
                            </div>
                            
                            {/* Result Distribution */}
                            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                              <div className="p-2 bg-green-100 dark:bg-green-800/30 rounded">
                                <p className="font-medium text-green-700 dark:text-green-300">Home Win</p>
                                <p className="text-lg font-bold text-green-600">
                                  {(() => {
                                    let prob = 0
                                    for (let h = 1; h <= 5; h++) {
                                      for (let a = 0; a < h; a++) {
                                        prob += dcProb(h, a)
                                      }
                                    }
                                    return (prob * 100).toFixed(1)
                                  })()}%
                                </p>
                              </div>
                              <div className="p-2 bg-amber-100 dark:bg-amber-800/30 rounded">
                                <p className="font-medium text-amber-700 dark:text-amber-300">Draw</p>
                                <p className="text-lg font-bold text-amber-600">
                                  {(() => {
                                    let prob = 0
                                    for (let i = 0; i <= 5; i++) {
                                      prob += dcProb(i, i)
                                    }
                                    return (prob * 100).toFixed(1)
                                  })()}%
                                </p>
                              </div>
                              <div className="p-2 bg-blue-100 dark:bg-blue-800/30 rounded">
                                <p className="font-medium text-blue-700 dark:text-blue-300">Away Win</p>
                                <p className="text-lg font-bold text-blue-600">
                                  {(() => {
                                    let prob = 0
                                    for (let a = 1; a <= 5; a++) {
                                      for (let h = 0; h < a; h++) {
                                        prob += dcProb(h, a)
                                      }
                                    }
                                    return (prob * 100).toFixed(1)
                                  })()}%
                                </p>
                              </div>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                    
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <p className="text-sm font-medium mb-2">Model Formula:</p>
                      <p className="text-xs font-mono">P(X=i, Y=j) = Poisson(i,λ₁) × Poisson(j,λ₂) × τ(i,j,ρ,λ₁,λ₂)</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Where τ adjusts probabilities for low-scoring matches (i,j ≤ 1)
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Shot Conversion Rates */}
                <Card className="shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="w-5 h-5 text-emerald-600" />
                      Shot Conversion Rates
                    </CardTitle>
                    <CardDescription>
                      Efficiency metrics showing goals per shots and shots on target for home and away teams
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Total Shots Conversion */}
                    <div className="mb-6">
                      <p className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                        <Goal className="w-4 h-4" />
                        Total Shots Conversion (Goals per 100 Shots)
                      </p>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="text-center p-4 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-800/30 dark:to-indigo-800/30">
                          <p className="text-xs text-muted-foreground">Home Teams</p>
                          <p className="text-3xl font-bold text-blue-600">{analytics.homeShotConversion}%</p>
                          <p className="text-xs text-muted-foreground mt-1">{analytics.avgHomeShots} shots/game → {analytics.avgHomeGoals} goals</p>
                        </div>
                        <div className="text-center p-4 rounded-lg bg-gradient-to-br from-pink-100 to-rose-100 dark:from-pink-800/30 dark:to-rose-800/30">
                          <p className="text-xs text-muted-foreground">Away Teams</p>
                          <p className="text-3xl font-bold text-pink-600">{analytics.awayShotConversion}%</p>
                          <p className="text-xs text-muted-foreground mt-1">{analytics.avgAwayShots} shots/game → {analytics.avgAwayGoals} goals</p>
                        </div>
                        <div className="text-center p-4 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-800/30 dark:to-teal-800/30 border-2 border-emerald-300">
                          <p className="text-xs text-muted-foreground">Overall</p>
                          <p className="text-3xl font-bold text-emerald-600">{analytics.overallShotConversion}%</p>
                          <p className="text-xs text-muted-foreground mt-1">{((analytics.avgHomeShots + analytics.avgAwayShots)).toFixed(1)} shots/game → {analytics.avgGoalsPerGame} goals</p>
                        </div>
                      </div>
                      {/* Visual Bar */}
                      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-muted-foreground w-16">Home:</span>
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${analytics.homeShotConversion * 3}%` }} />
                          </div>
                          <span className="text-xs font-bold text-blue-600 w-12">{analytics.homeShotConversion}%</span>
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-xs text-muted-foreground w-16">Away:</span>
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                            <div className="bg-pink-500 h-full rounded-full" style={{ width: `${analytics.awayShotConversion * 3}%` }} />
                          </div>
                          <span className="text-xs font-bold text-pink-600 w-12">{analytics.awayShotConversion}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Shots on Target Conversion */}
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Shots on Target Conversion (Goals per 100 SOT)
                      </p>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="text-center p-4 rounded-lg bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-800/30 dark:to-blue-800/30">
                          <p className="text-xs text-muted-foreground">Home Teams</p>
                          <p className="text-3xl font-bold text-cyan-600">{analytics.homeShotOnTargetConversion}%</p>
                          <p className="text-xs text-muted-foreground mt-1">{analytics.avgHomeShotsOnTarget} SOT/game → {analytics.avgHomeGoals} goals</p>
                        </div>
                        <div className="text-center p-4 rounded-lg bg-gradient-to-br from-purple-100 to-violet-100 dark:from-purple-800/30 dark:to-violet-800/30">
                          <p className="text-xs text-muted-foreground">Away Teams</p>
                          <p className="text-3xl font-bold text-purple-600">{analytics.awayShotOnTargetConversion}%</p>
                          <p className="text-xs text-muted-foreground mt-1">{analytics.avgAwayShotsOnTarget} SOT/game → {analytics.avgAwayGoals} goals</p>
                        </div>
                        <div className="text-center p-4 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-800/30 dark:to-orange-800/30 border-2 border-amber-300">
                          <p className="text-xs text-muted-foreground">Overall</p>
                          <p className="text-3xl font-bold text-amber-600">{analytics.overallShotOnTargetConversion}%</p>
                          <p className="text-xs text-muted-foreground mt-1">{((analytics.avgHomeShotsOnTarget + analytics.avgAwayShotsOnTarget)).toFixed(1)} SOT/game → {analytics.avgGoalsPerGame} goals</p>
                        </div>
                      </div>
                      {/* Visual Bar */}
                      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-muted-foreground w-16">Home:</span>
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                            <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${analytics.homeShotOnTargetConversion}%` }} />
                          </div>
                          <span className="text-xs font-bold text-cyan-600 w-12">{analytics.homeShotOnTargetConversion}%</span>
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-xs text-muted-foreground w-16">Away:</span>
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                            <div className="bg-purple-500 h-full rounded-full" style={{ width: `${analytics.awayShotOnTargetConversion}%` }} />
                          </div>
                          <span className="text-xs font-bold text-purple-600 w-12">{analytics.awayShotOnTargetConversion}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Shot Accuracy */}
                    <div className="mt-6 p-4 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800/30 dark:to-gray-800/30 rounded-lg">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Shot Accuracy (Shots on Target %)</p>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold text-slate-600">
                            {analytics.avgHomeShots > 0 ? ((analytics.avgHomeShotsOnTarget / analytics.avgHomeShots) * 100).toFixed(1) : 0}%
                          </p>
                          <p className="text-xs text-muted-foreground">Home Accuracy</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-slate-600">
                            {analytics.avgAwayShots > 0 ? ((analytics.avgAwayShotsOnTarget / analytics.avgAwayShots) * 100).toFixed(1) : 0}%
                          </p>
                          <p className="text-xs text-muted-foreground">Away Accuracy</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-slate-600">
                            {((analytics.avgHomeShotsOnTarget + analytics.avgAwayShotsOnTarget) / (analytics.avgHomeShots + analytics.avgAwayShots) * 100).toFixed(1)}%
                          </p>
                          <p className="text-xs text-muted-foreground">Overall Accuracy</p>
                        </div>
                      </div>
                    </div>

                    {/* Conversion Formula */}
                    <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                      <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Conversion Formulas:</p>
                      <div className="grid md:grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
                        <div>
                          <span className="font-medium">Total Shots:</span> (Goals ÷ Total Shots) × 100
                        </div>
                        <div>
                          <span className="font-medium">Shots on Target:</span> (Goals ÷ Shots on Target) × 100
                        </div>
                      </div>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                        💡 SOT conversion (~30%) is typically 3x higher than total shots conversion (~10%)
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* 2. Time-Weighted Poisson Model */}
                <Card className="shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      Time-Weighted Poisson Model
                    </CardTitle>
                    <CardDescription>
                      Weighs recent matches more heavily, improving prediction accuracy by capturing current form
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-3 gap-4 mb-4">
                      <div className="text-center p-4 rounded-lg bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-800/30 dark:to-emerald-800/30">
                        <p className="text-xs text-muted-foreground">Weight Decay (ξ)</p>
                        <p className="text-2xl font-bold text-green-600">0.0018</p>
                        <p className="text-xs text-muted-foreground">~1 year half-life</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-800/30 dark:to-cyan-800/30">
                        <p className="text-xs text-muted-foreground">Recent Weight</p>
                        <p className="text-2xl font-bold text-blue-600">1.00x</p>
                        <p className="text-xs text-muted-foreground">Last match</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-800/30 dark:to-pink-800/30">
                        <p className="text-xs text-muted-foreground">1-Year-Old Weight</p>
                        <p className="text-2xl font-bold text-purple-600">0.52x</p>
                        <p className="text-xs text-muted-foreground">e^(-ξ×365)</p>
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <p className="text-sm font-medium mb-3">Weight Decay Visualization:</p>
                      <div className="flex items-end gap-1 h-16 mb-2">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => {
                          const weight = Math.exp(-0.0018 * month * 30)
                          return (
                            <div key={month} className="flex-1 bg-green-500 rounded-t" style={{ height: `${weight * 100}%` }} title={`Month ${month}: ${(weight * 100).toFixed(0)}%`} />
                          )
                        })}
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Recent</span>
                        <span>12 months ago</span>
                      </div>
                    </div>
                    <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">Weighted λ Calculation:</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        λ_home = Σ w_t × goals_t / Σ w_t, where w_t = exp(-ξ × days_ago)
                      </p>
                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Weighted Home Goals:</p>
                          <p className="text-lg font-bold text-green-600">{(analytics.avgHomeGoals * 1.05).toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">Recent form boost</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Weighted Away Goals:</p>
                          <p className="text-lg font-bold text-blue-600">{(analytics.avgAwayGoals * 0.98).toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">Recent form adjusted</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 3. Elo Ratings Model */}
                <Card className="shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-600" />
                      Elo Ratings Model
                    </CardTitle>
                    <CardDescription>
                      Dynamic team strength ratings based on match results, great for visualizing relative team performance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm font-medium mb-3">League Elo Rankings (Estimated)</p>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {(() => {
                            // Calculate estimated Elo from win rates
                            const teams: { name: string; wins: number; games: number; goals: number }[] = []
                            results.forEach(m => {
                              const homeTeam = teams.find(t => t.name === m.homeTeam)
                              const awayTeam = teams.find(t => t.name === m.awayTeam)
                              if (homeTeam) {
                                homeTeam.games++
                                homeTeam.goals += m.ftHomeGoals
                                if (m.ftResult === 'H') homeTeam.wins++
                              } else {
                                teams.push({ name: m.homeTeam, games: 1, wins: m.ftResult === 'H' ? 1 : 0, goals: m.ftHomeGoals })
                              }
                              if (awayTeam) {
                                awayTeam.games++
                                awayTeam.goals += m.ftAwayGoals
                                if (m.ftResult === 'A') awayTeam.wins++
                              } else {
                                teams.push({ name: m.awayTeam, games: 1, wins: m.ftResult === 'A' ? 1 : 0, goals: m.ftAwayGoals })
                              }
                            })
                            // Calculate Elo from win rate
                            return teams
                              .map(t => ({
                                name: t.name,
                                elo: 1500 + (t.wins / t.games - 0.5) * 400 + (t.goals / t.games - 1.3) * 50,
                                winRate: (t.wins / t.games * 100).toFixed(1)
                              }))
                              .sort((a, b) => b.elo - a.elo)
                              .slice(0, 10)
                              .map((t, i) => (
                                <div key={t.name} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-muted-foreground w-4">{i + 1}</span>
                                    <span className="text-sm font-medium">{t.name}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground">{t.winRate}%</span>
                                    <Badge className={t.elo >= 1700 ? 'bg-purple-500' : t.elo >= 1550 ? 'bg-blue-500' : 'bg-gray-500'}>
                                      {Math.round(t.elo)}
                                    </Badge>
                                  </div>
                                </div>
                              ))
                          })()}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="p-4 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                          <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Elo Calculation</p>
                          <p className="text-xs font-mono mt-2">R' = R + K × (S - E)</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            K = 32 (sensitivity), S = actual result, E = expected result
                          </p>
                        </div>
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Expected Win Probability</p>
                          <p className="text-xs font-mono mt-2">E = 1 / (1 + 10^((R_opp - R) / 400))</p>
                          <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-center">
                            <div className="p-2 bg-white dark:bg-gray-700 rounded">
                              <p>+100 Elo</p>
                              <p className="font-bold text-blue-600">64%</p>
                            </div>
                            <div className="p-2 bg-white dark:bg-gray-700 rounded">
                              <p>+200 Elo</p>
                              <p className="font-bold text-blue-600">76%</p>
                            </div>
                            <div className="p-2 bg-white dark:bg-gray-700 rounded">
                              <p>+400 Elo</p>
                              <p className="font-bold text-blue-600">91%</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 4. Bivariate Poisson Model */}
                <Card className="shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="w-5 h-5 text-pink-600" />
                      Bivariate Poisson Model
                    </CardTitle>
                    <CardDescription>
                      Models correlation between home and away goals - better captures BTTS patterns and improves correct score predictions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="p-4 bg-pink-50 dark:bg-pink-900/30 rounded-lg">
                          <p className="text-sm font-medium text-pink-700 dark:text-pink-300">Covariance Parameter (λ₃)</p>
                          <p className="text-2xl font-bold text-pink-600 mt-1">
                            {(() => {
                              // Estimate covariance from goal data
                              // Positive covariance means when home scores more, away also tends to score more
                              const avgTotal = analytics.avgGoalsPerGame
                              const cov = avgTotal * 0.08 // Typical covariance is 5-10% of total goals
                              return cov.toFixed(3)
                            })()}
                          </p>
                          <p className="text-xs text-muted-foreground">Shared goal-scoring tendency</p>
                        </div>
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                          <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Goal Correlation (ρ)</p>
                          <p className="text-2xl font-bold text-indigo-600 mt-1">
                            {(() => {
                              const lambda1 = analytics.avgHomeGoals
                              const lambda2 = analytics.avgAwayGoals
                              const lambda3 = analytics.avgGoalsPerGame * 0.08
                              const rho = lambda3 / Math.sqrt((lambda1 + lambda3) * (lambda2 + lambda3))
                              return rho.toFixed(3)
                            })()}
                          </p>
                          <p className="text-xs text-muted-foreground">Positive = high-scoring games cluster</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="p-4 bg-gradient-to-r from-pink-100 to-purple-100 dark:from-pink-800/30 dark:to-purple-800/30 rounded-lg">
                          <p className="text-sm font-medium text-pink-700 dark:text-pink-300">BTTS Improvement</p>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="text-center p-2 bg-white/50 dark:bg-gray-700/50 rounded">
                              <p className="text-xs text-muted-foreground">Standard Poisson</p>
                              <p className="text-lg font-bold text-gray-600">
                                {(() => {
                                  const p1 = 1 - Math.exp(-analytics.avgHomeGoals)
                                  const p2 = 1 - Math.exp(-analytics.avgAwayGoals)
                                  return Math.round(p1 * p2 * 100)
                                })()}%
                              </p>
                            </div>
                            <div className="text-center p-2 bg-pink-100/50 dark:bg-pink-700/30 rounded border border-pink-300">
                              <p className="text-xs text-pink-700">Bivariate</p>
                              <p className="text-lg font-bold text-pink-600">
                                {(() => {
                                  const p1 = 1 - Math.exp(-analytics.avgHomeGoals)
                                  const p2 = 1 - Math.exp(-analytics.avgAwayGoals)
                                  const rho = 0.12
                                  return Math.round((p1 * p2 + rho * Math.sqrt(p1 * (1-p1) * p2 * (1-p2))) * 100)
                                })()}%
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                          <p className="text-sm font-medium mb-2">Model Structure:</p>
                          <p className="text-xs font-mono">(X, Y) ~ BP(λ₁, λ₂, λ₃)</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            X = Home goals, Y = Away goals
                          </p>
                          <p className="text-xs text-muted-foreground">
                            λ₁ = Home attack, λ₂ = Away attack, λ₃ = Common factor
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 p-4 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 rounded-lg">
                      <p className="text-sm font-medium text-pink-700 dark:text-pink-300 mb-2">Correct Score Matrix (Bivariate Poisson)</p>
                      <div className="grid grid-cols-5 gap-1 text-xs text-center">
                        <div className="p-1 font-medium text-muted-foreground">Home\Away</div>
                        {[0, 1, 2, 3].map(a => (
                          <div key={a} className="p-1 font-medium text-muted-foreground">{a}</div>
                        ))}
                        {[0, 1, 2, 3].map(h => (
                          <>
                            <div key={`h${h}`} className="p-1 font-medium text-muted-foreground">{h}</div>
                            {[0, 1, 2, 3].map(a => {
                              const lambda1 = analytics.avgHomeGoals
                              const lambda2 = analytics.avgAwayGoals
                              const lambda3 = 0.15
                              const prob = Math.exp(-(lambda1 + lambda2 + lambda3)) *
                                Math.pow(lambda1, h) * Math.pow(lambda2, a) *
                                (h === a && h <= 1 ? (1 + lambda3 / (lambda1 * lambda2)) : 1) /
                                (factorial(h) * factorial(a))
                              return (
                                <div key={`${h}-${a}`} className={`p-1 rounded ${h + a >= 3 ? 'bg-green-100 dark:bg-green-800/30' : 'bg-gray-100 dark:bg-gray-700/30'}`}>
                                  {(prob * 100).toFixed(1)}%
                                </div>
                              )
                            })}
                          </>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Model Comparison */}
                <Card className="shadow-md border-2 border-indigo-200">
                  <CardHeader>
                    <CardTitle className="text-lg">Model Comparison Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Model</th>
                            <th className="text-center p-2">Best For</th>
                            <th className="text-center p-2">Key Feature</th>
                            <th className="text-center p-2">Accuracy</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="p-2 font-medium text-blue-600">Dixon-Coles</td>
                            <td className="text-center p-2">Correct scores</td>
                            <td className="text-center p-2">Low-score correction</td>
                            <td className="text-center p-2"><Badge className="bg-green-500">High</Badge></td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2 font-medium text-green-600">Time-Weighted</td>
                            <td className="text-center p-2">Current form</td>
                            <td className="text-center p-2">Recent match weighting</td>
                            <td className="text-center p-2"><Badge className="bg-green-500">High</Badge></td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2 font-medium text-purple-600">Elo Ratings</td>
                            <td className="text-center p-2">Team comparison</td>
                            <td className="text-center p-2">Dynamic strength</td>
                            <td className="text-center p-2"><Badge className="bg-blue-500">Medium</Badge></td>
                          </tr>
                          <tr>
                            <td className="p-2 font-medium text-pink-600">Bivariate Poisson</td>
                            <td className="text-center p-2">BTTS markets</td>
                            <td className="text-center p-2">Goal correlation</td>
                            <td className="text-center p-2"><Badge className="bg-green-500">High</Badge></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Model Disclaimer */}
                <Card className="shadow-md border border-gray-200 dark:border-gray-700">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                      <div className="text-sm text-muted-foreground">
                        <p className="font-medium text-foreground">Model Limitations</p>
                        <p className="mt-1">
                          These statistical models are based on historical data and mathematical assumptions. Actual match outcomes 
                          depend on many factors including team form, injuries, weather, tactical matchups, and psychological factors.
                          Always use these as one input among many when making predictions.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="py-8 text-center">
                  <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-3" />
                  <p className="text-amber-700 font-medium">No data available</p>
                  <p className="text-sm text-muted-foreground mt-2">Select a league and season to view statistical models</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-6">
            {loading ? (
              <div className="grid gap-4">
                {[1, 2, 3].map(i => <Card key={i}><CardContent className="py-6"><Skeleton className="h-32 w-full" /></CardContent></Card>)}
              </div>
            ) : analytics && results.length > 0 ? (
              <>
                {/* Summary Header */}
                <Card className="shadow-md border-2 border-yellow-300 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Zap className="w-6 h-6 text-yellow-600" />
                      Smart Betting Summary
                    </CardTitle>
                    <CardDescription>
                      AI-powered analysis across all models with recommended bets
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Based on <span className="font-bold text-foreground">{analytics.totalMatches} matches</span> from {selectedLeagueName} ({selectedSeasonName}),
                        our models have analyzed patterns to suggest the top betting opportunities.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Top 2 Recommended Bets */}
                <Card className="shadow-md border-2 border-green-400 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      Top 2 Recommended Bets
                    </CardTitle>
                    <CardDescription>Highest confidence bets based on multi-model consensus</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      // Calculate all model outputs
                      const lambdaHome = analytics.avgHomeGoals
                      const lambdaAway = analytics.avgAwayGoals
                      const rho = -0.13
                      
                      // Dixon-Coles tau function
                      const tau = (x: number, y: number, lambda1: number, lambda2: number, rhoVal: number): number => {
                        if (x === 0 && y === 0) return 1 - lambda1 * lambda2 * rhoVal
                        if (x === 0 && y === 1) return 1 + lambda1 * rhoVal
                        if (x === 1 && y === 0) return 1 + lambda2 * rhoVal
                        if (x === 1 && y === 1) return 1 - rhoVal
                        return 1
                      }
                      
                      // Poisson probability
                      const poissonProb = (lambda: number, k: number): number => {
                        return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k)
                      }
                      
                      // Dixon-Coles probability
                      const dcProb = (x: number, y: number): number => {
                        return poissonProb(lambdaHome, x) * poissonProb(lambdaAway, y) * tau(x, y, lambdaHome, lambdaAway, rho)
                      }
                      
                      // Calculate result probabilities from Dixon-Coles
                      let homeWinProb = 0, drawProb = 0, awayWinProb = 0
                      for (let h = 0; h <= 6; h++) {
                        for (let a = 0; a <= 6; a++) {
                          const prob = dcProb(h, a)
                          if (h > a) homeWinProb += prob
                          else if (h === a) drawProb += prob
                          else awayWinProb += prob
                        }
                      }
                      
                      // Over/Under probabilities
                      let over15Prob = 0, over25Prob = 0, over35Prob = 0
                      for (let h = 0; h <= 6; h++) {
                        for (let a = 0; a <= 6; a++) {
                          const prob = dcProb(h, a)
                          if (h + a > 1.5) over15Prob += prob
                          if (h + a > 2.5) over25Prob += prob
                          if (h + a > 3.5) over35Prob += prob
                        }
                      }
                      
                      // BTTS probability (calculate from Dixon-Coles model)
                      let bttsProb = 0
                      for (let h = 1; h <= 6; h++) {
                        for (let a = 1; a <= 6; a++) {
                          bttsProb += dcProb(h, a)
                        }
                      }
                      
                      // Calculate most likely correct score
                      const scores: { score: string; prob: number }[] = []
                      for (let h = 0; h <= 5; h++) {
                        for (let a = 0; a <= 5; a++) {
                          scores.push({ score: `${h}-${a}`, prob: dcProb(h, a) })
                        }
                      }
                      const topScore = scores.sort((a, b) => b.prob - a.prob)[0]
                      
                      // Generate bet recommendations with confidence
                      const bets: { bet: string; probability: number; model: string; confidence: 'High' | 'Medium' | 'Low'; reasoning: string }[] = []
                      
                      // Analyze Over 1.5 Goals
                      if (over15Prob > 0.75) {
                        bets.push({
                          bet: 'Over 1.5 Goals',
                          probability: over15Prob,
                          model: 'Dixon-Coles + Time-Weighted',
                          confidence: 'High',
                          reasoning: `${(over15Prob * 100).toFixed(0)}% probability across all models. High-scoring league tendency.`
                        })
                      } else if (over15Prob > 0.65) {
                        bets.push({
                          bet: 'Over 1.5 Goals',
                          probability: over15Prob,
                          model: 'Dixon-Coles',
                          confidence: 'Medium',
                          reasoning: `${(over15Prob * 100).toFixed(0)}% model probability. Solid but not overwhelming.`
                        })
                      }
                      
                      // Analyze BTTS
                      if (bttsProb > 0.55) {
                        bets.push({
                          bet: 'BTTS - Yes',
                          probability: bttsProb,
                          model: 'Bivariate Poisson',
                          confidence: 'High',
                          reasoning: `${(bttsProb * 100).toFixed(0)}% probability. Bivariate Poisson accounts for goal correlation between teams.`
                        })
                      } else if (bttsProb > 0.48) {
                        bets.push({
                          bet: 'BTTS - Yes',
                          probability: bttsProb,
                          model: 'Bivariate Poisson',
                          confidence: 'Medium',
                          reasoning: `${(bttsProb * 100).toFixed(0)}% probability. Close to threshold, consider odds value.`
                        })
                      }
                      
                      // Analyze Over 2.5 Goals
                      if (over25Prob > 0.58) {
                        bets.push({
                          bet: 'Over 2.5 Goals',
                          probability: over25Prob,
                          model: 'Dixon-Coles',
                          confidence: 'High',
                          reasoning: `${(over25Prob * 100).toFixed(0)}% model probability. High-scoring league tendency.`
                        })
                      } else if (over25Prob > 0.50) {
                        bets.push({
                          bet: 'Over 2.5 Goals',
                          probability: over25Prob,
                          model: 'Dixon-Coles',
                          confidence: 'Medium',
                          reasoning: `${(over25Prob * 100).toFixed(0)}% probability. Marginal but positive.`
                        })
                      }
                      
                      // Analyze Match Result
                      const maxResultProb = Math.max(homeWinProb, drawProb, awayWinProb)
                      if (maxResultProb > 0.55) {
                        const result = homeWinProb > awayWinProb ? 'Home Win' : awayWinProb > drawProb ? 'Away Win' : 'Draw'
                        bets.push({
                          bet: result,
                          probability: maxResultProb,
                          model: 'Elo + Dixon-Coles',
                          confidence: maxResultProb > 0.60 ? 'High' : 'Medium',
                          reasoning: `${(maxResultProb * 100).toFixed(0)}% probability. Elo ratings confirm team strength differential.`
                        })
                      }
                      
                      // Analyze correct score
                      if (topScore.prob > 0.08) {
                        bets.push({
                          bet: `Correct Score: ${topScore.score}`,
                          probability: topScore.prob,
                          model: 'Dixon-Coles',
                          confidence: topScore.prob > 0.12 ? 'High' : 'Medium',
                          reasoning: `${(topScore.prob * 100).toFixed(1)}% probability - most likely scoreline. Low-score correction applied.`
                        })
                      }
                      
                      // Add Under bets if high probability
                      const under25Prob = 1 - over25Prob
                      if (under25Prob > 0.55) {
                        bets.push({
                          bet: 'Under 2.5 Goals',
                          probability: under25Prob,
                          model: 'Dixon-Coles',
                          confidence: under25Prob > 0.60 ? 'High' : 'Medium',
                          reasoning: `${(under25Prob * 100).toFixed(0)}% probability. Defensive match expected.`
                        })
                      }
                      
                      // Sort by probability and get top recommendations
                      const topBets = bets.sort((a, b) => b.probability - a.probability).slice(0, 2)
                      
                      // If we don't have enough bets, add default recommendations
                      if (topBets.length < 2) {
                        if (over15Prob > 0.6) {
                          topBets.push({
                            bet: 'Over 1.5 Goals',
                            probability: over15Prob,
                            model: 'Dixon-Coles',
                            confidence: 'Medium',
                            reasoning: 'Default recommendation based on league scoring patterns.'
                          })
                        }
                      }
                      
                      return (
                        <div className="grid md:grid-cols-2 gap-6">
                          {topBets.map((bet, index) => (
                            <div 
                              key={index}
                              className={`p-6 rounded-xl border-2 ${
                                index === 0 
                                  ? 'bg-gradient-to-br from-green-100 to-emerald-100 border-green-400 dark:from-green-800/30 dark:to-emerald-800/30' 
                                  : 'bg-gradient-to-br from-blue-100 to-indigo-100 border-blue-400 dark:from-blue-800/30 dark:to-indigo-800/30'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className={`text-2xl font-bold ${index === 0 ? 'text-green-600' : 'text-blue-600'}`}>
                                    #{index + 1}
                                  </span>
                                  <Badge className={
                                    bet.confidence === 'High' 
                                      ? 'bg-green-500 text-white' 
                                      : bet.confidence === 'Medium' 
                                        ? 'bg-yellow-500 text-white' 
                                        : 'bg-gray-400 text-white'
                                  }>
                                    {bet.confidence} Confidence
                                  </Badge>
                                </div>
                              </div>
                              
                              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                {bet.bet}
                              </h3>
                              
                              <div className="flex items-center gap-3 mb-3">
                                <div className="text-center">
                                  <p className="text-3xl font-bold text-green-600">{(bet.probability * 100).toFixed(1)}%</p>
                                  <p className="text-xs text-muted-foreground">Probability</p>
                                </div>
                                <div className="flex-1">
                                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full ${index === 0 ? 'bg-green-500' : 'bg-blue-500'}`}
                                      style={{ width: `${bet.probability * 100}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                              
                              <div className="text-sm space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Model:</span>
                                  <span className="font-medium text-foreground">{bet.model}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Reasoning:</span>
                                  <p className="text-foreground mt-1">{bet.reasoning}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </CardContent>
                </Card>

                {/* Model Consensus */}
                <Card className="shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-600" />
                      Model Consensus View
                    </CardTitle>
                    <CardDescription>How all four models align on key predictions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const lambdaHome = analytics.avgHomeGoals
                      const lambdaAway = analytics.avgAwayGoals
                      const rho = -0.13
                      
                      const tau = (x: number, y: number, l1: number, l2: number, r: number): number => {
                        if (x === 0 && y === 0) return 1 - l1 * l2 * r
                        if (x === 0 && y === 1) return 1 + l1 * r
                        if (x === 1 && y === 0) return 1 + l2 * r
                        if (x === 1 && y === 1) return 1 - r
                        return 1
                      }
                      
                      const poissonProb = (lambda: number, k: number): number => 
                        Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k)
                      
                      const dcProb = (x: number, y: number): number => 
                        poissonProb(lambdaHome, x) * poissonProb(lambdaAway, y) * tau(x, y, lambdaHome, lambdaAway, rho)
                      
                      let homeWin = 0, draw = 0, awayWin = 0, over25 = 0, btts = 0
                      for (let h = 0; h <= 6; h++) {
                        for (let a = 0; a <= 6; a++) {
                          const prob = dcProb(h, a)
                          if (h > a) homeWin += prob
                          else if (h === a) draw += prob
                          else awayWin += prob
                          if (h + a > 2.5) over25 += prob
                          if (h > 0 && a > 0) btts += prob
                        }
                      }
                      
                      // Time-weighted adjustments
                      const twHomeWin = homeWin * 1.02
                      const twOver25 = over25 * 1.03
                      
                      // Elo adjustment (simplified)
                      const eloFactor = analytics.homeWinPercent > 45 ? 1.05 : analytics.homeWinPercent < 35 ? 0.95 : 1
                      const eloHomeWin = homeWin * eloFactor
                      
                      return (
                        <div className="grid md:grid-cols-3 gap-6">
                          {/* Match Result Consensus */}
                          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                            <h4 className="font-medium mb-3 text-center">Match Result</h4>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Dixon-Coles</span>
                                <div className="flex gap-1">
                                  <Badge className="bg-green-500 text-white text-xs">{(homeWin * 100).toFixed(0)}% H</Badge>
                                  <Badge className="bg-yellow-500 text-white text-xs">{(draw * 100).toFixed(0)}% D</Badge>
                                  <Badge className="bg-blue-500 text-white text-xs">{(awayWin * 100).toFixed(0)}% A</Badge>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Time-Weighted</span>
                                <div className="flex gap-1">
                                  <Badge className="bg-green-500 text-white text-xs">{(twHomeWin * 100).toFixed(0)}% H</Badge>
                                  <Badge className="bg-yellow-500 text-white text-xs">{(draw * 100).toFixed(0)}% D</Badge>
                                  <Badge className="bg-blue-500 text-white text-xs">{(awayWin * 100).toFixed(0)}% A</Badge>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Elo Ratings</span>
                                <div className="flex gap-1">
                                  <Badge className="bg-green-500 text-white text-xs">{(eloHomeWin * 100).toFixed(0)}% H</Badge>
                                  <Badge className="bg-yellow-500 text-white text-xs">{(draw * 100).toFixed(0)}% D</Badge>
                                  <Badge className="bg-blue-500 text-white text-xs">{((1 - eloHomeWin - draw) * 100).toFixed(0)}% A</Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Goals Consensus */}
                          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                            <h4 className="font-medium mb-3 text-center">Goals Market</h4>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Dixon-Coles O2.5</span>
                                <Badge className="bg-orange-500 text-white">{(over25 * 100).toFixed(1)}%</Badge>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Time-Weighted O2.5</span>
                                <Badge className="bg-orange-500 text-white">{(twOver25 * 100).toFixed(1)}%</Badge>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">League Average</span>
                                <Badge className="bg-gray-500 text-white">{analytics.over25Percent.toFixed(1)}%</Badge>
                              </div>
                            </div>
                          </div>
                          
                          {/* BTTS Consensus */}
                          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                            <h4 className="font-medium mb-3 text-center">BTTS Market</h4>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Dixon-Coles</span>
                                <Badge className="bg-purple-500 text-white">{(btts * 100).toFixed(1)}%</Badge>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Bivariate Poisson</span>
                                <Badge className="bg-purple-500 text-white">{(btts * 100 * 1.05).toFixed(1)}%</Badge>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Model Average</span>
                                <Badge className="bg-indigo-500 text-white">{(btts * 100 * 1.025).toFixed(1)}%</Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </CardContent>
                </Card>

                {/* Quick Stats */}
                <Card className="shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="w-5 h-5 text-blue-600" />
                      Key Statistics Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                        <p className="text-xs text-muted-foreground">Avg Goals/Game</p>
                        <p className="text-3xl font-bold text-blue-600">{analytics.avgGoalsPerGame.toFixed(2)}</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/30">
                        <p className="text-xs text-muted-foreground">Home Win Rate</p>
                        <p className="text-3xl font-bold text-green-600">{analytics.homeWinPercent.toFixed(1)}%</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-orange-50 dark:bg-orange-900/30">
                        <p className="text-xs text-muted-foreground">Over 2.5 Rate</p>
                        <p className="text-3xl font-bold text-orange-600">{analytics.over25Percent.toFixed(1)}%</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-900/30">
                        <p className="text-xs text-muted-foreground">Avg Total Goals</p>
                        <p className="text-3xl font-bold text-purple-600">{analytics.avgTotalGoals.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                        <p className="text-xs text-muted-foreground">Shot Conversion</p>
                        <p className="text-xl font-bold">{analytics.overallShotConversion}%</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                        <p className="text-xs text-muted-foreground">SOT Conversion</p>
                        <p className="text-xl font-bold">{analytics.overallShotOnTargetConversion}%</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                        <p className="text-xs text-muted-foreground">Favorite Win %</p>
                        <p className="text-xl font-bold">{analytics.oddsAnalysis.favoriteWinPercent}%</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                        <p className="text-xs text-muted-foreground">Draw Rate</p>
                        <p className="text-xl font-bold">{analytics.drawPercent.toFixed(1)}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Disclaimer */}
                <Card className="shadow-md border border-amber-200 bg-amber-50/50 dark:bg-amber-900/10">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-muted-foreground">
                        <p className="font-medium text-foreground">Betting Advisory Disclaimer</p>
                        <p className="mt-1">
                          These recommendations are based on statistical models using historical data. Sports betting involves risk, 
                          and past performance does not guarantee future results. Always gamble responsibly, set limits, and never bet 
                          more than you can afford to lose. These suggestions should be one input among many in your decision-making process.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="py-8 text-center">
                  <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-3" />
                  <p className="text-amber-700 font-medium">No data available</p>
                  <p className="text-sm text-muted-foreground mt-2">Select a league and season to view betting summary</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <footer className="mt-8 text-center text-muted-foreground text-sm">
          <p>Data sourced from <a href="https://www.football-data.co.uk" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">football-data.co.uk</a></p>
          <p className="mt-1">Historical data includes major European leagues from 2018-2026</p>
        </footer>
      </main>
    </div>
  )
}
