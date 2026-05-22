'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { FlaskConical, Target, TrendingUp, AlertTriangle, BarChart3, ChevronRight, Search } from 'lucide-react'
import type { SummaryTabProps } from './types'

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

export default function SummaryTab({
  prediction,
  comboString,
  selectedLeagueName,
  selectedSeasonName,
}: SummaryTabProps) {
  const [backtestData, setBacktestData] = useState<BacktestResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<'all' | 'exact' | 'o25' | 'btts'>('all')
  const fetchRef = useRef(comboString)

  // Update ref when combo changes and trigger fetch
  useEffect(() => {
    if (comboString !== fetchRef.current) {
      fetchRef.current = comboString
      if (comboString) {
        setLoading(true)
        setError(null)
        fetch(`/api/soccer/backtest-single?combo=${encodeURIComponent(comboString)}`)
          .then(res => {
            if (!res.ok) throw new Error('Failed to fetch backtest data')
            return res.json()
          })
          .then(data => setBacktestData(data))
          .catch(err => setError(err instanceof Error ? err.message : 'Failed to load backtest data'))
          .finally(() => setLoading(false))
      } else {
        setBacktestData(null)
        setError(null)
      }
    }
  }, [comboString])

  const filteredMatches = backtestData?.matches.filter(m => {
    if (activeFilter === 'exact') return m.predicted === m.score
    if (activeFilter === 'o25') {
      const predOver = m.o25 > 50
      const actOver = m.total > 2
      return predOver === actOver
    }
    if (activeFilter === 'btts') {
      const predBTTS = m.btts > 50
      const ps = m.predicted.split('-')
      const predBoth = parseInt(ps[0]) > 0 && parseInt(ps[1]) > 0
      const as2 = m.score.split('-')
      const actBoth = parseInt(as2[0]) > 0 && parseInt(as2[1]) > 0
      return predBoth === actBoth
    }
    return true
  }) || []

  // No prediction yet — show prompt
  if (!comboString) {
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
              <span>Go to Predictions tab and click &quot;Predict&quot;</span>
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
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
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

  if (!backtestData) return null

  const { stats, topScores, goalBuckets, totalMatches, isFuzzy, requestedCombo, combo: matchedCombo } = backtestData

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
                {matchedCombo.split(' | ').map((part, i) => (
                  <Badge key={i} variant={part.includes(':Y') ? 'default' : 'secondary'} className="text-xs">
                    {part}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span><strong className="text-foreground">{totalMatches}</strong> historical matches found</span>
              <span className="text-xs">({selectedLeagueName} {selectedSeasonName})</span>
              {isFuzzy && (
                <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                  Fuzzy match — exact combo had fewer than 5 matches
                </Badge>
              )}
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
        {/* Most Common Scorelines */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-500" />
              Most Common Scorelines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topScores.map((s, i) => (
                <div key={s.score} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-4">#{i + 1}</span>
                  <span className="font-mono font-semibold text-sm w-10">{s.score}</span>
                  <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: `${s.pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-16 text-right">
                    {s.count}x ({s.pct}%)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Total Goals Distribution */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-orange-500" />
              Total Goals Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-40">
              {Object.entries(goalBuckets).map(([label, count]) => {
                const maxCount = Math.max(...Object.values(goalBuckets))
                const height = maxCount > 0 ? (count / maxCount) * 100 : 0
                const pct = totalMatches > 0 ? ((count / totalMatches) * 100).toFixed(0) : '0'
                return (
                  <div key={label} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-muted-foreground">{pct}%</span>
                    <div
                      className="w-full bg-orange-500 rounded-t-sm transition-all"
                      style={{ height: `${height}%`, minHeight: count > 0 ? '4px' : '0' }}
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
              {(['all', 'exact', 'o25', 'btts'] as const).map(filter => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    activeFilter === filter
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-muted-foreground hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {filter === 'all' ? 'All' : filter === 'exact' ? 'Exact Score' : filter === 'o25' ? 'O2.5 Hit' : 'BTTS Hit'}
                </button>
              ))}
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
                {filteredMatches.map((m, i) => {
                  const isExact = m.predicted === m.score
                  const predOver = m.o25 > 50
                  const actOver = m.total > 2
                  const o25Hit = predOver === actOver
                  const ps = m.predicted.split('-')
                  const predBoth = parseInt(ps[0]) > 0 && parseInt(ps[1]) > 0
                  const as2 = m.score.split('-')
                  const actBoth = parseInt(as2[0]) > 0 && parseInt(as2[1]) > 0
                  const bttsHit = predBoth === actBoth

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
                      <td className={`px-3 py-2 text-center font-mono text-xs font-semibold ${isExact ? 'text-emerald-600' : ''}`}>
                        {m.score}
                        {isExact && <span className="ml-1 text-emerald-500">✓</span>}
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
                {filteredMatches.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground text-sm">
                      No matches found for this filter
                    </td>
                  </tr>
                )}
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
              Historical backtest based on simplified Poisson model signals across EPL, Bundesliga, Serie A, La Liga, and Ligue 1 (2023-25).
              Signal thresholds match the app&apos;s deployed logic. Past performance does not guarantee future results.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
