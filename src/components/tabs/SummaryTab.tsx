'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { FlaskConical, Target, TrendingUp, AlertTriangle, BarChart3, ChevronRight, Search } from 'lucide-react'

interface BacktestResult {
  combo: string
  isFuzzy: boolean
  requestedCombo: string
  totalMatches: number
  stats: {
    exactScoreline: { hits: number; total: number; pct: string }
    over25: { hits: number; total: number; pct: string }
    btts: { hits: number; total: number; pct: string }
    results: { homeWins: number; draws: number; awayWins: number }
  }
  topScores: { score: string; count: number; pct: string }[]
  goalBuckets: Record<string, number>
  matches: {
    date: string
    league: string
    home: string
    away: string
    score: string
    ftr: string
    predicted: string
    total: number
    o25: number
    btts: number
  }[]
}

interface SummaryTabProps {
  prediction: {
    prediction?: {
      homeWin: number
      draw: number
      awayWin: number
      homeXg: number
      awayXg: number
      over25: number
      over35: number
      over15: number
      btts: number
      likelyScore: string
    } | null
    homeTeamStats?: Record<string, unknown> | null
    awayTeamStats?: Record<string, unknown> | null
  } | null
  comboString: string | null
  selectedLeagueName?: string
  selectedSeasonName?: string
}

// Compute a signal combo string from the prediction data
function computeCombo(pred: NonNullable<SummaryTabProps['prediction']>): string {
  const p = pred.prediction
  if (!p) return ''
  const o25 = p.over25 || 0
  const o35 = p.over35 || 0
  const btts = p.btts || 0
  const homeXg = p.homeXg || 1.3
  const awayXg = p.awayXg || 1.0
  const combXg = homeXg + awayXg

  // Strong Bet signal (simplified threshold)
  let sbPts = 0
  if (o25 >= 65) sbPts += 2
  if (o35 >= 42) sbPts += 1
  if (btts >= 55) sbPts += 1
  if (combXg >= 2.0) sbPts += 2
  if (o25 >= 55 && btts >= 50) sbPts += 2
  sbPts += 1 // neutral z-score baseline
  if (combXg >= 2.0 && o25 >= 55 && btts >= 50) sbPts += 1
  const isSB = sbPts >= 7

  // Grey Result signal
  let grChecks = 0
  if (o25 >= 55 || true) grChecks++
  if (true) grChecks++ // z-score neutral
  if (combXg >= 2.0) grChecks++
  if (btts >= 45) grChecks++
  if (btts >= 55) grChecks++
  if (o25 >= 65) grChecks++
  if (o35 >= 40) grChecks++
  if (o35 >= 40) grChecks++
  const isGR = grChecks >= 7

  // Goal Fest signal
  let gfChecks = 0
  if (combXg >= 2.0) gfChecks++
  if (o25 >= 55 && btts >= 50) gfChecks++
  if (true) gfChecks++
  if (o25 >= 55) gfChecks++
  if (btts >= 55) gfChecks++
  if (o35 >= 35) gfChecks++
  const isGF = gfChecks >= 5

  // BTTS tier
  const bttsTier = btts >= 62 ? 'Strong' : btts >= 55 ? 'Qualified' : btts >= 45 ? 'Weak' : 'Avoid'

  // Goal Detector tier
  const goalTier = combXg > 3 ? 'Rich' : combXg > 2.5 ? 'Likely' : combXg > 2 ? 'Borderline' : combXg > 1.5 ? 'Thin' : 'Stall'

  // Momentum: always NEUTRAL (form data not available in prediction response)
  const momTier = 'NEUTRAL'

  // FP1: default false
  const isFP1 = false

  return [
    'SB:' + (isSB ? 'Y' : 'N'),
    'GR:' + (isGR ? 'Y' : 'N'),
    'GF:' + (isGF ? 'Y' : 'N'),
    'BTTS:' + bttsTier,
    'GOAL:' + goalTier,
    'MOM:' + momTier,
    'FP1:' + (isFP1 ? 'Y' : 'N'),
  ].join(' | ')
}

export default function SummaryTab({
  prediction,
  selectedLeagueName,
  selectedSeasonName,
}: SummaryTabProps) {
  const [backtestData, setBacktestData] = useState<BacktestResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<'all' | 'exact' | 'o25' | 'btts'>('all')
  const fetchRef = useRef<string | null>(null)

  // Derive combo from prediction data directly
  const combo = useMemo(() => {
    if (!prediction?.prediction) return null
    try {
      return computeCombo(prediction)
    } catch {
      return null
    }
  }, [prediction])

  // Fetch backtest data when combo changes
  useEffect(() => {
    if (combo && combo !== fetchRef.current) {
      fetchRef.current = combo
      setLoading(true)
      setError(null)
      setBacktestData(null)
      fetch('/api/soccer/backtest-single?combo=' + encodeURIComponent(combo))
        .then(function(res) {
          if (!res.ok) throw new Error('Failed to fetch backtest data')
          return res.json()
        })
        .then(function(data) { setBacktestData(data) })
        .catch(function(err) { setError(err instanceof Error ? err.message : 'Failed to load backtest data') })
        .finally(function() { setLoading(false) })
    } else if (!combo) {
      fetchRef.current = null
      setBacktestData(null)
      setError(null)
    }
  }, [combo])

  const filteredMatches = backtestData ? backtestData.matches.filter(function(m) {
    if (activeFilter === 'exact') return m.predicted === m.score
    if (activeFilter === 'o25') {
      return (m.o25 > 50) === (m.total > 2)
    }
    if (activeFilter === 'btts') {
      var ps = m.predicted.split('-')
      var predBoth = parseInt(ps[0]) > 0 && parseInt(ps[1]) > 0
      var as2 = m.score.split('-')
      var actBoth = parseInt(as2[0]) > 0 && parseInt(as2[1]) > 0
      return predBoth === actBoth
    }
    return true
  }) : []

  // No prediction yet
  if (!prediction?.prediction || !combo) {
    return (
      <div className="space-y-6">
        <Card className="border-2 border-dashed border-gray-300 bg-gray-50/50 dark:bg-gray-800/30">
          <CardContent className="py-12 text-center">
            <FlaskConical className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Match Backtest</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Run a prediction from the Predictions tab first. This tab will then show how matches
              with the same signal combination have performed historically across all top 5 leagues.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <ChevronRight className="w-4 h-4" />
              <span>Go to Predictions tab and click Predict</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="shadow-md">
          <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1,2,3,4].map(function(i) { return <Skeleton key={i} className="h-24 rounded-lg" /> })}
            </div>
            <Skeleton className="h-64 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto text-red-500 mb-3" />
            <p className="text-red-700 font-medium">Backtest Error</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // If combo is set but data has not loaded yet
  if (!backtestData) {
    return (
      <div className="space-y-6">
        <Card className="shadow-md">
          <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1,2,3,4].map(function(i) { return <Skeleton key={i} className="h-24 rounded-lg" /> })}
            </div>
            <Skeleton className="h-64 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    )
  }

  var stats = backtestData.stats
  var topScores = backtestData.topScores
  var goalBuckets = backtestData.goalBuckets
  var totalMatches = backtestData.totalMatches
  var isFuzzy = backtestData.isFuzzy
  var matchedCombo = backtestData.combo

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="shadow-md border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-emerald-600" />
            Match Backtest Results
          </CardTitle>
          <CardDescription>
            Historical performance of matches with the same signal combination
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-white/60 dark:bg-gray-800/40 rounded-lg space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">Combo:</span>
              <div className="flex flex-wrap gap-1">
                {matchedCombo.split(' | ').map(function(part, i) {
                  return (
                    <Badge key={i} variant={part.includes(':Y') ? 'default' : 'secondary'} className="text-xs">
                      {part}
                    </Badge>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span><strong className="text-foreground">{totalMatches}</strong> historical matches found</span>
              {isFuzzy ? (
                <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                  Fuzzy match
                </Badge>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-purple-500" />
              <p className="text-xs text-muted-foreground">Exact Scoreline</p>
            </div>
            <p className="text-2xl font-bold text-purple-600">{stats.exactScoreline.pct}%</p>
            <p className="text-xs text-muted-foreground">{stats.exactScoreline.hits}/{stats.exactScoreline.total} matches</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-orange-500" />
              <p className="text-xs text-muted-foreground">Over 2.5 Rate</p>
            </div>
            <p className="text-2xl font-bold text-orange-600">{stats.over25.pct}%</p>
            <p className="text-xs text-muted-foreground">{stats.over25.hits}/{stats.over25.total} matches</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              <p className="text-xs text-muted-foreground">BTTS Rate</p>
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats.btts.pct}%</p>
            <p className="text-xs text-muted-foreground">{stats.btts.hits}/{stats.btts.total} matches</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-green-500" />
              <p className="text-xs text-muted-foreground">H / D / A</p>
            </div>
            <div className="flex gap-2">
              <span className="text-lg font-bold text-green-600">{stats.results.homeWins}</span>
              <span className="text-lg font-bold text-yellow-600">{stats.results.draws}</span>
              <span className="text-lg font-bold text-red-600">{stats.results.awayWins}</span>
            </div>
            <p className="text-xs text-muted-foreground">Home / Draw / Away</p>
          </CardContent>
        </Card>
      </div>

      {/* Two-column layout: Top Scores + Goal Distribution */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-500" />
              Most Common Scorelines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topScores.map(function(s, i) {
                return (
                  <div key={s.score} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-4">#{i + 1}</span>
                    <span className="font-mono font-semibold text-sm w-10">{s.score}</span>
                    <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all"
                        style={{ width: s.pct + '%' }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-16 text-right">
                      {s.count}x ({s.pct}%)
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-orange-500" />
              Total Goals Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-40">
              {Object.entries(goalBuckets).map(function(entry) {
                var label = entry[0]
                var count = entry[1]
                var maxCount = Math.max.apply(null, Object.values(goalBuckets))
                var height = maxCount > 0 ? (count / maxCount) * 100 : 0
                var pct = totalMatches > 0 ? ((count / totalMatches) * 100).toFixed(0) : '0'
                return (
                  <div key={label} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-muted-foreground">{pct}%</span>
                    <div
                      className="w-full bg-orange-500 rounded-t-sm transition-all"
                      style={{ height: height + '%', minHeight: count > 0 ? '4px' : '0' }}
                    />
                    <span className="text-xs font-medium">{label}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Match-by-Match Results */}
      <Card className="shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-500" />
              Match-by-Match Results
              <span className="text-sm font-normal text-muted-foreground">
                ({filteredMatches.length} of {totalMatches})
              </span>
            </CardTitle>
            <div className="flex gap-1">
              {['all', 'exact', 'o25', 'btts'].map(function(filter) {
                var label = filter === 'all' ? 'All' : filter === 'exact' ? 'Exact Score' : filter === 'o25' ? 'O2.5 Hit' : 'BTTS Hit'
                return (
                  <button
                    key={filter}
                    onClick={function() { setActiveFilter(filter as 'all' | 'exact' | 'o25' | 'btts') }}
                    className={'px-3 py-1 text-xs rounded-full transition-colors ' + (
                      activeFilter === filter
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-muted-foreground hover:bg-gray-200 dark:hover:bg-gray-600'
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">League</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Match</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Predicted</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Actual</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">O2.5</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">BTTS</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredMatches.map(function(m, i) {
                  var isExact = m.predicted === m.score
                  var predOver = m.o25 > 50
                  var actOver = m.total > 2
                  var o25Hit = predOver === actOver
                  var ps = m.predicted.split('-')
                  var predBoth = parseInt(ps[0]) > 0 && parseInt(ps[1]) > 0
                  var as2 = m.score.split('-')
                  var actBoth = parseInt(as2[0]) > 0 && parseInt(as2[1]) > 0
                  var bttsHit = predBoth === actBoth

                  return (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-3 py-2 text-xs text-muted-foreground">{m.league}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{m.date}</td>
                      <td className="px-3 py-2 text-xs">
                        <span className="font-medium">{m.home}</span>
                        <span className="text-muted-foreground mx-1">vs</span>
                        <span className="font-medium">{m.away}</span>
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-xs">{m.predicted}</td>
                      <td className={'px-3 py-2 text-center font-mono text-xs font-semibold ' + (isExact ? 'text-emerald-600' : '')}>
                        {m.score}
                        {isExact ? <span className="ml-1 text-emerald-500">OK</span> : null}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant={o25Hit ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0">
                          {actOver ? 'OVER' : 'UNDER'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant={bttsHit ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0">
                          {actBoth ? 'YES' : 'NO'}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
                {filteredMatches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground text-sm">
                      No matches found for this filter
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <Card className="shadow-sm border border-amber-200 bg-amber-50/50 dark:bg-amber-900/10">
        <CardContent className="py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Historical backtest based on Poisson model signals across EPL, Bundesliga, Serie A, La Liga, and Ligue 1 (2023-25).
              Past performance does not guarantee future results.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
