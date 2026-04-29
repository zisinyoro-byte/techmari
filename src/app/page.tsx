'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Trophy, Goal, TrendingUp, RefreshCw, Users, Target, Zap, Dice5, Sparkles, FlaskConical } from 'lucide-react'

// Error boundary for graceful crash handling
import ErrorBoundary from '@/components/ErrorBoundary'

// Extracted tab components
import OverviewTab from '@/components/tabs/OverviewTab'
import HeadToHeadTab from '@/components/tabs/HeadToHeadTab'
import PredictionsTab from '@/components/tabs/PredictionsTab'
import ModelsTab from '@/components/tabs/ModelsTab'
import BacktestTab from '@/components/tabs/BacktestTab'
import BttsCheckTab from '@/components/tabs/BttsCheckTab'
import Over35Tab from '@/components/tabs/Over35Tab'
import SummaryTab from '@/components/tabs/SummaryTab'

import type { League, MatchResult, Analytics, PredictionResponse, H2HMatch, H2HAnalytics } from '@/lib/types'
import { seasons, COLORS, PIE_COLORS } from '@/lib/constants'
import { parseDateSafe, factorial } from '@/lib/utils'

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

  // Display limit for results table
  const [displayLimit, setDisplayLimit] = useState(100)
  
  // H2H Tracker filter
  const [h2hTrackerSearch, setH2hTrackerSearch] = useState('')

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
      setDisplayLimit(100)
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
      if (!resultsRes.ok || !analyticsRes.ok) throw new Error('Failed to fetch data')
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
        if (team1 && !newTeams.includes(team1)) setTeam1('')
        if (team2 && !newTeams.includes(team2)) setTeam2('')
        if (predHomeTeam && !newTeams.includes(predHomeTeam)) setPredHomeTeam('')
        if (predAwayTeam && !newTeams.includes(predAwayTeam)) setPredAwayTeam('')
        setPrediction(null)
      }
    } catch (err) {
      console.error('Failed to fetch teams:', err)
    }
  }

  const fetchH2H = async () => {
    if (!team1 || !team2) { setH2hError('Please select both teams'); return }
    if (team1 === team2) { setH2hError('Please select different teams'); return }
    setH2hLoading(true)
    setH2hError(null)
    try {
      const res = await fetch(`/api/soccer/h2h?league=${selectedLeague}&season=${selectedSeason}&team1=${encodeURIComponent(team1)}&team2=${encodeURIComponent(team2)}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${res.status}: Failed to fetch H2H data`)
      }
      const data = await res.json()
      setH2hMatches(data.matches || [])
      setH2hAnalytics(data.analytics || null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load H2H data'
      setH2hError(errorMessage)
      console.error('H2H fetch error:', err)
    } finally {
      setH2hLoading(false)
    }
  }

  const fetchPrediction = async () => {
    if (!predHomeTeam || !predAwayTeam) { setPredError('Please select both teams'); return }
    if (predHomeTeam === predAwayTeam) { setPredError('Please select different teams'); return }
    setPredLoading(true)
    setPredError(null)
    setPrediction(null) // Clear previous prediction
    try {
      const res = await fetch(`/api/soccer/predict?league=${selectedLeague}&season=${selectedSeason}&homeTeam=${encodeURIComponent(predHomeTeam)}&awayTeam=${encodeURIComponent(predAwayTeam)}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || `Prediction failed (${res.status})`)
      }
      const data = await res.json()
      // Validate response structure before setting state
      if (!data?.prediction) {
        throw new Error('Invalid prediction response from server')
      }
      setPrediction(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate prediction'
      setPredError(errorMessage)
      console.error('Prediction error:', err)
    } finally {
      setPredLoading(false)
    }
  }

  // Filter and sort results
  const filteredResults = useMemo(() => {
    let filtered = results
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(match => match.homeTeam.toLowerCase().includes(term) || match.awayTeam.toLowerCase().includes(term))
    }
    return [...filtered].sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''
      switch (sortConfig.key) {
        case 'date':
          const parseDate = (dateStr: string) => {
            if (!dateStr) return new Date(0)
            const parts = dateStr.split('/')
            if (parts.length === 3) {
              let year = parseInt(parts[2], 10)
              if (year < 100) year += year < 50 ? 2000 : 1900
              return new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]))
            }
            return new Date(dateStr)
          }
          aVal = parseDate(a.date).getTime()
          bVal = parseDate(b.date).getTime()
          break
        case 'homeTeam': aVal = a.homeTeam; bVal = b.homeTeam; break
        case 'awayTeam': aVal = a.awayTeam; bVal = b.awayTeam; break
        case 'ftGoals': aVal = a.ftHomeGoals + a.ftAwayGoals; bVal = b.ftHomeGoals + b.ftAwayGoals; break
        default: return 0
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [results, searchTerm, sortConfig])

  const handleSort = (key: string) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }))
  }

  // Prepare chart data
  const resultDistributionData = analytics ? [
    { name: 'Home Wins', value: analytics.resultDistribution.homeWins },
    { name: 'Draws', value: analytics.resultDistribution.draws },
    { name: 'Away Wins', value: analytics.resultDistribution.awayWins },
  ] : []

  const htFtTransitionsData = analytics ? [
    { name: 'HT Home Lead', 'FT Home Win': analytics.htToftTransitions.htHomeLeads.ftHomeWin, 'FT Draw': analytics.htToftTransitions.htHomeLeads.ftDraw, 'FT Away Win': analytics.htToftTransitions.htHomeLeads.ftAwayWin },
    { name: 'HT Draw', 'FT Home Win': analytics.htToftTransitions.htDraw.ftHomeWin, 'FT Draw': analytics.htToftTransitions.htDraw.ftDraw, 'FT Away Win': analytics.htToftTransitions.htDraw.ftAwayWin },
    { name: 'HT Away Lead', 'FT Home Win': analytics.htToftTransitions.htAwayLeads.ftHomeWin, 'FT Draw': analytics.htToftTransitions.htAwayLeads.ftDraw, 'FT Away Win': analytics.htToftTransitions.htAwayLeads.ftAwayWin },
  ] : []

  const overUnderData = analytics ? [
    { name: 'Over 2.5', value: analytics.over25Count, fill: COLORS.over },
    { name: 'Under 2.5', value: analytics.under25Count, fill: COLORS.under },
  ] : []

  // Calculate last H2H results for each unique team pair
  const lastH2HResults = useMemo(() => {
    if (results.length === 0) return { score00: [], score10: [], score20: [] }
    const h2hMap = new Map<string, { homeTeam: string; awayTeam: string; homeGoals: number; awayGoals: number; date: string; season?: string }>()
    const sortedResults = [...results].sort((a, b) => parseDateSafe(b.date).getTime() - parseDateSafe(a.date).getTime())
    for (const match of sortedResults) {
      const pairKey = [match.homeTeam, match.awayTeam].sort().join(' vs ')
      if (!h2hMap.has(pairKey)) {
        h2hMap.set(pairKey, { homeTeam: match.homeTeam, awayTeam: match.awayTeam, homeGoals: match.ftHomeGoals, awayGoals: match.ftAwayGoals, date: match.date, season: match.season })
      }
    }
    const score00: { teams: string; score: string; date: string; season?: string }[] = []
    const score10: { teams: string; score: string; date: string; winner: string; season?: string }[] = []
    const score20: { teams: string; score: string; date: string; winner: string; season?: string }[] = []
    h2hMap.forEach((match, pairKey) => {
      const { homeTeam, awayTeam, homeGoals, awayGoals, date, season } = match
      const totalGoals = homeGoals + awayGoals
      if (homeGoals === 0 && awayGoals === 0) score00.push({ teams: pairKey, score: '0-0', date, season })
      else if (totalGoals === 1) score10.push({ teams: pairKey, score: `${homeGoals}-${awayGoals}`, date, winner: homeGoals === 1 ? homeTeam : awayTeam, season })
      else if (totalGoals === 2 && (homeGoals === 0 || awayGoals === 0)) score20.push({ teams: pairKey, score: `${homeGoals}-${awayGoals}`, date, winner: homeGoals === 2 ? homeTeam : awayTeam, season })
    })
    const sortByDate = (a: { date: string }, b: { date: string }) => parseDateSafe(b.date).getTime() - parseDateSafe(a.date).getTime()
    return { score00: score00.sort(sortByDate), score10: score10.sort(sortByDate), score20: score20.sort(sortByDate) }
  }, [results])

  const filteredH2HResults = useMemo(() => {
    if (!h2hTrackerSearch.trim()) return lastH2HResults
    const searchLower = h2hTrackerSearch.toLowerCase()
    return {
      score00: lastH2HResults.score00.filter(m => m.teams.toLowerCase().includes(searchLower)),
      score10: lastH2HResults.score10.filter(m => m.teams.toLowerCase().includes(searchLower)),
      score20: lastH2HResults.score20.filter(m => m.teams.toLowerCase().includes(searchLower))
    }
  }, [lastH2HResults, h2hTrackerSearch])

  // Calculate team form based on last 5 matches
  const teamForm = useMemo(() => {
    if (results.length === 0) return new Map<string, { form: ('W' | 'D' | 'L')[]; inForm: boolean; points: number }>()
    const teamMatches = new Map<string, Array<{ date: string; isHome: boolean; goalsFor: number; goalsAgainst: number; result: 'W' | 'D' | 'L' }>>()
    const sortedResults = [...results].sort((a, b) => parseDateSafe(b.date).getTime() - parseDateSafe(a.date).getTime())
    for (const match of sortedResults) {
      const homeMatches = teamMatches.get(match.homeTeam) || []
      homeMatches.push({ date: match.date, isHome: true, goalsFor: match.ftHomeGoals, goalsAgainst: match.ftAwayGoals, result: match.ftResult === 'H' ? 'W' : match.ftResult === 'D' ? 'D' : 'L' })
      teamMatches.set(match.homeTeam, homeMatches)
      const awayMatches = teamMatches.get(match.awayTeam) || []
      awayMatches.push({ date: match.date, isHome: false, goalsFor: match.ftAwayGoals, goalsAgainst: match.ftHomeGoals, result: match.ftResult === 'A' ? 'W' : match.ftResult === 'D' ? 'D' : 'L' })
      teamMatches.set(match.awayTeam, awayMatches)
    }
    const formMap = new Map<string, { form: ('W' | 'D' | 'L')[]; inForm: boolean; points: number }>()
    teamMatches.forEach((matches, team) => {
      const last5 = matches.slice(0, 5)
      const form = last5.map(m => m.result)
      const points = last5.reduce((acc, m) => acc + (m.result === 'W' ? 3 : m.result === 'D' ? 1 : 0), 0)
      formMap.set(team, { form, inForm: points >= 7, points })
    })
    return formMap
  }, [results])

  const selectedLeagueName = leagues.find(l => l.code === selectedLeague)?.name || 'Premier League'
  const selectedSeasonName = selectedSeason === 'all' ? 'All Seasons' : (seasons.find(s => s.code === selectedSeason)?.name || '2025-26')
  const isAllSeasons = selectedSeason === 'all'

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
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
        <Card className="mb-6 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Select League & Season</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">League</label>
                <Select value={selectedLeague} onValueChange={setSelectedLeague}>
                  <SelectTrigger><SelectValue placeholder="Select league" /></SelectTrigger>
                  <SelectContent>
                    {leagues.map(league => (
                      <SelectItem key={league.code} value={league.code}>{league.country} - {league.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Season</label>
                <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                  <SelectTrigger><SelectValue placeholder="Select season" /></SelectTrigger>
                  <SelectContent>
                    {seasons.map(season => (
                      <SelectItem key={season.code} value={season.code}>{season.name}</SelectItem>
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

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-8 max-w-5xl mx-auto">
            <TabsTrigger value="overview" className="flex items-center gap-2"><Trophy className="w-4 h-4" />League Overview</TabsTrigger>
            <TabsTrigger value="h2h" className="flex items-center gap-2"><Users className="w-4 h-4" />Head to Head</TabsTrigger>
            <TabsTrigger value="predict" className="flex items-center gap-2"><Sparkles className="w-4 h-4" />Predictions</TabsTrigger>
            <TabsTrigger value="models" className="flex items-center gap-2"><Dice5 className="w-4 h-4" />Models</TabsTrigger>
            <TabsTrigger value="backtest" className="flex items-center gap-2"><FlaskConical className="w-4 h-4" />Backtest</TabsTrigger>
            <TabsTrigger value="btts-checklist" className="flex items-center gap-2"><Target className="w-4 h-4" />BTTS Check</TabsTrigger>
            <TabsTrigger value="over35-checklist" className="flex items-center gap-2"><Goal className="w-4 h-4" />Over 3.5</TabsTrigger>
            <TabsTrigger value="summary" className="flex items-center gap-2"><Zap className="w-4 h-4" />Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <OverviewTab results={results} analytics={analytics} loading={loading} error={error} searchTerm={searchTerm} setSearchTerm={setSearchTerm} sortConfig={sortConfig} handleSort={handleSort} displayLimit={displayLimit} setDisplayLimit={setDisplayLimit} filteredResults={filteredResults} selectedLeagueName={selectedLeagueName} selectedSeasonName={selectedSeasonName} isAllSeasons={isAllSeasons} resultDistributionData={resultDistributionData} htFtTransitionsData={htFtTransitionsData} overUnderData={overUnderData} />
          </TabsContent>

          <TabsContent value="h2h" className="space-y-6">
            <HeadToHeadTab results={results} analytics={analytics} teams={teams} teamsPerSeason={teamsPerSeason} team1={team1} team2={team2} setTeam1={setTeam1} setTeam2={setTeam2} setPredHomeTeam={setPredHomeTeam} setPredAwayTeam={setPredAwayTeam} h2hMatches={h2hMatches} h2hAnalytics={h2hAnalytics} h2hLoading={h2hLoading} h2hError={h2hError} fetchH2H={fetchH2H} selectedLeague={selectedLeague} selectedSeason={selectedSeason} isAllSeasons={isAllSeasons} teamForm={teamForm} filteredH2HResults={filteredH2HResults} h2hTrackerSearch={h2hTrackerSearch} setH2hTrackerSearch={setH2hTrackerSearch} />
          </TabsContent>

          <TabsContent value="predict" className="space-y-6">
            <ErrorBoundary>
              <PredictionsTab results={results} analytics={analytics} teams={teams} teamsPerSeason={teamsPerSeason} predHomeTeam={predHomeTeam} predAwayTeam={predAwayTeam} setPredHomeTeam={setPredHomeTeam} setPredAwayTeam={setPredAwayTeam} setTeam1={setTeam1} setTeam2={setTeam2} prediction={prediction} predLoading={predLoading} predError={predError} bookmakerOdds15={bookmakerOdds15} setBookmakerOdds15={setBookmakerOdds15} bookmakerOddsBtts={bookmakerOddsBtts} setBookmakerOddsBtts={setBookmakerOddsBtts} fetchPrediction={fetchPrediction} selectedLeague={selectedLeague} selectedSeason={selectedSeason} isAllSeasons={isAllSeasons} teamForm={teamForm} />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="models" className="space-y-6">
            <ModelsTab results={results} analytics={analytics} prediction={prediction} predHomeTeam={predHomeTeam} predAwayTeam={predAwayTeam} selectedLeague={selectedLeague} selectedSeason={selectedSeason} loading={loading} />
          </TabsContent>

          <TabsContent value="backtest" className="space-y-6">
            <BacktestTab selectedLeague={selectedLeague} setSelectedLeague={setSelectedLeague} leagues={leagues} />
          </TabsContent>

          <TabsContent value="btts-checklist" className="space-y-6">
            <BttsCheckTab results={results} analytics={analytics} prediction={prediction} loading={loading} selectedLeagueName={selectedLeagueName} />
          </TabsContent>

          <TabsContent value="over35-checklist" className="space-y-6">
            <Over35Tab results={results} analytics={analytics} prediction={prediction} loading={loading} selectedLeagueName={selectedLeagueName} />
          </TabsContent>

          <TabsContent value="summary" className="space-y-6">
            <SummaryTab results={results} analytics={analytics} prediction={prediction} selectedLeague={selectedLeague} selectedSeason={selectedSeason} loading={loading} selectedLeagueName={selectedLeagueName} selectedSeasonName={selectedSeasonName} />
          </TabsContent>
        </Tabs>

        <footer className="mt-8 text-center text-muted-foreground text-sm">
          <p>Data sourced from <a href="https://www.football-data.co.uk" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">football-data.co.uk</a></p>
          <p className="mt-1">Historical data includes major European leagues from 2018-2026</p>
        </footer>
      </main>
    </div>
  )
}
