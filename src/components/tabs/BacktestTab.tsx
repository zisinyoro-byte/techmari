'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Target, Goal, TrendingUp, RefreshCw, DollarSign, FlaskConical } from 'lucide-react'
import type { BacktestTabProps } from './types'
import { COLORS, SEASON_NAMES } from '@/lib/constants'
import { registerBacktestThresholds } from '@/lib/betting-filters'

export default function BacktestTab({ selectedLeague, setSelectedLeague, leagues }: BacktestTabProps) {
  const [backtestTraining, setBacktestTraining] = useState<string>('5')
  const [backtestTestSeason, setBacktestTestSeason] = useState<string>('2324')
  const [backtestLoading, setBacktestLoading] = useState(false)
  const [backtestResult, setBacktestResult] = useState<{
    success: boolean
    config: { trainingSeasons: string[]; testSeason: string; league: string }
    totalMatches: number
    ensemble: {
      matches: number
      homeWinAccuracy: number
      drawAccuracy: number
      awayWinAccuracy: number
      overallAccuracy: number
      over15Accuracy: number
      over25Accuracy: number
      under25Accuracy: number
      bttsYesAccuracy: number
      bttsNoAccuracy: number
      avgPredictedProb: number
      avgActualRate: number
      valueBetsFound: number
      valueBetWinRate: number
      roi: number
      brierScore: number
    }
    predictions: Array<{
      match: { date: string; homeTeam: string; awayTeam: string }
      predicted: { homeWin: number; draw: number; awayWin: number; over15: number; over25: number; btts: number }
      actual: {
        homeGoals: number
        awayGoals: number
        result: 'H' | 'D' | 'A'
        totalGoals: number
        btts: boolean
        over15: boolean
        over25: boolean
        htResult: 'H' | 'D' | 'A'
        htHomeGoals: number
        htAwayGoals: number
        shResult: 'H' | 'D' | 'A'
        shHomeGoals: number
        shAwayGoals: number
      }
      lastH2H: {
        found: boolean
        date?: string
        season?: string
        homeGoals?: number
        awayGoals?: number
        result?: 'H' | 'D' | 'A'
        scoreline?: string
      } | null
      odds: {
        home: number | null
        draw: number | null
        away: number | null
      }
      correct: { result: boolean; over15: boolean; over25: boolean; btts: boolean }
    }>
    calibrationData: Array<{ predicted: number; actual: number; count: number }>
    calibrationRatios: {
      over25: number
      over15: number
      bttsYes: number
      homeWin: number
      draw: number
      awayWin: number
    }
    bttsPatterns: {
      totalBttsMatches: number
      h2hPatterns: {
        lastH2HHomeWin: { count: number; bttsRate: number; avgGoals: number }
        lastH2HAwayWin: { count: number; bttsRate: number; avgGoals: number }
        lastH2HDraw: { count: number; bttsRate: number; avgGoals: number }
        noH2H: { count: number; bttsRate: number; avgGoals: number }
      }
      h2hScorelines: Array<{
        scoreline: string
        count: number
        bttsCount: number
        bttsRate: number
      }>
      htResultPatterns: {
        htHomeWin: { count: number; bttsRate: number }
        htAwayWin: { count: number; bttsRate: number }
        htDraw: { count: number; bttsRate: number }
      }
      shResultPatterns: {
        shHomeWin: { count: number; bttsRate: number }
        shAwayWin: { count: number; bttsRate: number }
        shDraw: { count: number; bttsRate: number }
      }
      insights: string[]
    }
    derivedThresholds?: {
      leagueName: string
      sampleSize: number
      derivedAt: string
      [key: string]: unknown
    }
  } | null>(null)

  const runBacktest = async () => {
    setBacktestLoading(true)
    setBacktestResult(null)
    try {
      const trainingSeasons = backtestTraining === 'all'
        ? '1516,1617,1718,1819,1920,2021,2122,2223'
        : backtestTraining === '5'
          ? '1819,1920,2021,2122,2223'
          : '2021,2122,2223'

      const res = await fetch(`/api/soccer/backtest?league=${selectedLeague}&testSeason=${backtestTestSeason}&trainingSeasons=${trainingSeasons}`)
      if (!res.ok) throw new Error('Backtest failed')
      const data = await res.json()
      setBacktestResult(data)
      // Register derived thresholds in client-side memory + localStorage
      if (data.derivedThresholds) {
        registerBacktestThresholds(data.derivedThresholds);
      }
    } catch (err) {
      console.error('Backtest error:', err)
    } finally {
      setBacktestLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Backtesting Configuration */}
      <Card className="shadow-md border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-purple-600" />
            Backtesting Framework
          </CardTitle>
          <CardDescription>
            Test prediction accuracy against historical data. Train models on past seasons, test on a more recent season.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Training Seasons</label>
              <Select value={backtestTraining} onValueChange={setBacktestTraining}>
                <SelectTrigger>
                  <SelectValue placeholder="Select seasons" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">Last 5 seasons before test</SelectItem>
                  <SelectItem value="3">Last 3 seasons before test</SelectItem>
                  <SelectItem value="all">All available seasons</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Test Season</label>
              <Select value={backtestTestSeason} onValueChange={setBacktestTestSeason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select season" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2324">2023-24</SelectItem>
                  <SelectItem value="2223">2022-23</SelectItem>
                  <SelectItem value="2122">2021-22</SelectItem>
                  <SelectItem value="2021">2020-21</SelectItem>
                  <SelectItem value="1920">2019-20</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">League</label>
              <Select value={selectedLeague} onValueChange={setSelectedLeague}>
                <SelectTrigger>
                  <SelectValue />
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
            <Button
              onClick={runBacktest}
              disabled={backtestLoading}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {backtestLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <FlaskConical className="w-4 h-4 mr-2" />
                  Run Backtest
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Backtest Results */}
      {backtestLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <Card key={i}><CardContent className="py-6"><Skeleton className="h-32 w-full" /></CardContent></Card>)}
        </div>
      ) : backtestResult ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="shadow-md border-2 border-green-200">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Target className="w-4 h-4" />
                  <span className="text-sm font-medium">1X2 Accuracy</span>
                </div>
                <p className="text-3xl font-bold text-green-600 mt-2">{backtestResult.ensemble.overallAccuracy}%</p>
                <p className="text-xs text-muted-foreground mt-1">Match result predictions</p>
              </CardContent>
            </Card>
            <Card className="shadow-md border-2 border-blue-200">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Goal className="w-4 h-4" />
                  <span className="text-sm font-medium">O2.5 Accuracy</span>
                </div>
                <p className="text-3xl font-bold text-blue-600 mt-2">{backtestResult.ensemble.over25Accuracy}%</p>
                <p className="text-xs text-muted-foreground mt-1">Over 2.5 goals</p>
              </CardContent>
            </Card>
            <Card className="shadow-md border-2 border-purple-200">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-medium">BTTS Accuracy</span>
                </div>
                <p className="text-3xl font-bold text-purple-600 mt-2">{backtestResult.ensemble.bttsYesAccuracy}%</p>
                <p className="text-xs text-muted-foreground mt-1">Both teams to score</p>
              </CardContent>
            </Card>
            <Card className="shadow-md border-2 border-yellow-200">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-sm font-medium">Value Bet ROI</span>
                </div>
                <p className={`text-3xl font-bold mt-2 ${backtestResult.ensemble.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {backtestResult.ensemble.roi >= 0 ? '+' : ''}{backtestResult.ensemble.roi}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">{backtestResult.ensemble.valueBetsFound} value bets found</p>
              </CardContent>
            </Card>
          </div>

          {/* Calibration Ratios - Applied to Future Predictions */}
          <Card className="shadow-md border-2 border-cyan-200 bg-gradient-to-r from-cyan-50 to-sky-50 dark:from-cyan-900/20 dark:to-sky-900/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-cyan-600" />
                Calibration Ratios
              </CardTitle>
              <CardDescription>
                These ratios are now applied to correct future predictions. Ratio &gt; 1 = model underestimates, &lt; 1 = overestimates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {[
                  { label: 'Home Win', value: backtestResult.calibrationRatios.homeWin, color: 'green' },
                  { label: 'Draw', value: backtestResult.calibrationRatios.draw, color: 'amber' },
                  { label: 'Away Win', value: backtestResult.calibrationRatios.awayWin, color: 'blue' },
                  { label: 'O1.5', value: backtestResult.calibrationRatios.over15, color: 'teal' },
                  { label: 'O2.5', value: backtestResult.calibrationRatios.over25, color: 'purple' },
                  { label: 'BTTS', value: backtestResult.calibrationRatios.bttsYes, color: 'pink' },
                ].map(item => (
                  <div key={item.label} className="text-center p-3 rounded-lg bg-white/60 dark:bg-gray-800/40 border">
                    <p className="text-xs text-muted-foreground font-medium">{item.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${
                      item.value > 1.05 ? 'text-green-600' : item.value < 0.95 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {item.value.toFixed(3)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.value > 1.05 ? 'Model underestimates' : item.value < 0.95 ? 'Model overestimates' : 'Well calibrated'}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-cyan-600 mt-3 font-medium">
                Run a backtest for your league to generate calibration ratios. These will automatically correct predictions on the Predict tab.
              </p>
            </CardContent>
          </Card>

          {/* Detailed Metrics */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Detailed Performance Metrics</CardTitle>
              <CardDescription>
                Tested {backtestResult.totalMatches} matches from {SEASON_NAMES[backtestResult.config.testSeason] || backtestResult.config.testSeason}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {/* 1X2 Market */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-green-700 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    1X2 Market
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-3 rounded bg-green-50 border">
                      <p className="text-xs text-muted-foreground">Home Win</p>
                      <p className="text-xl font-bold text-green-600">{backtestResult.ensemble.homeWinAccuracy}%</p>
                    </div>
                    <div className="text-center p-3 rounded bg-amber-50 border">
                      <p className="text-xs text-muted-foreground">Draw</p>
                      <p className="text-xl font-bold text-amber-600">{backtestResult.ensemble.drawAccuracy}%</p>
                    </div>
                    <div className="text-center p-3 rounded bg-blue-50 border">
                      <p className="text-xs text-muted-foreground">Away Win</p>
                      <p className="text-xl font-bold text-blue-600">{backtestResult.ensemble.awayWinAccuracy}%</p>
                    </div>
                  </div>
                </div>

                {/* Goals Markets */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-blue-700 flex items-center gap-2">
                    <Goal className="w-4 h-4" />
                    Goals Markets
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-3 rounded bg-emerald-50 border">
                      <p className="text-xs text-muted-foreground">O1.5</p>
                      <p className="text-xl font-bold text-emerald-600">{backtestResult.ensemble.over15Accuracy}%</p>
                    </div>
                    <div className="text-center p-3 rounded bg-teal-50 border">
                      <p className="text-xs text-muted-foreground">O2.5</p>
                      <p className="text-xl font-bold text-teal-600">{backtestResult.ensemble.over25Accuracy}%</p>
                    </div>
                    <div className="text-center p-3 rounded bg-red-50 border">
                      <p className="text-xs text-muted-foreground">U2.5</p>
                      <p className="text-xl font-bold text-red-600">{backtestResult.ensemble.under25Accuracy}%</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistical Metrics */}
              <div className="mt-6 pt-4 border-t">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Brier Score</p>
                    <p className="text-lg font-bold">{backtestResult.ensemble.brierScore}</p>
                    <p className="text-xs text-muted-foreground">Lower is better</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Predicted O2.5</p>
                    <p className="text-lg font-bold">{backtestResult.ensemble.avgPredictedProb}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Actual O2.5 Rate</p>
                    <p className="text-lg font-bold">{backtestResult.ensemble.avgActualRate}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Value Bet Win Rate</p>
                    <p className="text-lg font-bold">{backtestResult.ensemble.valueBetWinRate}%</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Calibration Chart */}
          {backtestResult.calibrationData.length > 0 && (
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">Calibration Analysis</CardTitle>
                <CardDescription>
                  How well predicted probabilities match actual outcomes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {backtestResult.calibrationData.map((bucket, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-20 text-sm text-muted-foreground">
                        {bucket.predicted}% predicted
                      </div>
                      <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden relative">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${bucket.actual}%` }}
                        />
                        <div
                          className="absolute top-0 h-full border-r-2 border-red-500"
                          style={{ left: `${bucket.predicted}%` }}
                        />
                      </div>
                      <div className="w-20 text-sm">
                        {bucket.actual}% actual
                      </div>
                      <div className="w-12 text-xs text-muted-foreground">
                        ({bucket.count})
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-3 bg-blue-500 rounded" />
                    <span>Actual rate</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-red-500" />
                    <span>Predicted</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* BTTS Pattern Analysis */}
          {backtestResult.bttsPatterns && (
            <Card className="shadow-md border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  BTTS Pattern Analysis
                </CardTitle>
                <CardDescription>
                  Relationships between Last H2H, HT/SH results and BTTS outcomes ({backtestResult.bttsPatterns.totalBttsMatches} BTTS matches)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* H2H vs BTTS Patterns */}
                  <div>
                    <h4 className="font-semibold text-sm mb-3 text-purple-700">Last H2H Result vs BTTS Rate</h4>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="text-center p-3 rounded-lg bg-green-100 dark:bg-green-900/30 border border-green-200">
                        <p className="text-xs text-muted-foreground">H2H Home Win</p>
                        <p className="text-2xl font-bold text-green-600">{backtestResult.bttsPatterns.h2hPatterns.lastH2HHomeWin.bttsRate.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">({backtestResult.bttsPatterns.h2hPatterns.lastH2HHomeWin.count} games)</p>
                        <p className="text-xs text-muted-foreground">Avg: {backtestResult.bttsPatterns.h2hPatterns.lastH2HHomeWin.avgGoals.toFixed(1)} goals</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 border border-blue-200">
                        <p className="text-xs text-muted-foreground">H2H Away Win</p>
                        <p className="text-2xl font-bold text-blue-600">{backtestResult.bttsPatterns.h2hPatterns.lastH2HAwayWin.bttsRate.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">({backtestResult.bttsPatterns.h2hPatterns.lastH2HAwayWin.count} games)</p>
                        <p className="text-xs text-muted-foreground">Avg: {backtestResult.bttsPatterns.h2hPatterns.lastH2HAwayWin.avgGoals.toFixed(1)} goals</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-200">
                        <p className="text-xs text-muted-foreground">H2H Draw</p>
                        <p className="text-2xl font-bold text-amber-600">{backtestResult.bttsPatterns.h2hPatterns.lastH2HDraw.bttsRate.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">({backtestResult.bttsPatterns.h2hPatterns.lastH2HDraw.count} games)</p>
                        <p className="text-xs text-muted-foreground">Avg: {backtestResult.bttsPatterns.h2hPatterns.lastH2HDraw.avgGoals.toFixed(1)} goals</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-gray-100 dark:bg-gray-800/50 border border-gray-200">
                        <p className="text-xs text-muted-foreground">No H2H Data</p>
                        <p className="text-2xl font-bold text-gray-600">{backtestResult.bttsPatterns.h2hPatterns.noH2H.bttsRate.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">({backtestResult.bttsPatterns.h2hPatterns.noH2H.count} games)</p>
                        <p className="text-xs text-muted-foreground">Avg: {backtestResult.bttsPatterns.h2hPatterns.noH2H.avgGoals.toFixed(1)} goals</p>
                      </div>
                    </div>
                  </div>

                  {/* H2H Scorelines Leading to BTTS */}
                  {backtestResult.bttsPatterns.h2hScorelines && backtestResult.bttsPatterns.h2hScorelines.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-3 text-purple-700">Top H2H Scorelines Leading to BTTS</h4>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">H2H Score</TableHead>
                              <TableHead className="text-center text-xs">Games</TableHead>
                              <TableHead className="text-center text-xs">BTTS</TableHead>
                              <TableHead className="text-center text-xs">BTTS Rate</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {backtestResult.bttsPatterns.h2hScorelines.slice(0, 8).map((item, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-mono font-bold text-sm">{item.scoreline}</TableCell>
                                <TableCell className="text-center text-sm">{item.count}</TableCell>
                                <TableCell className="text-center text-sm">{item.bttsCount}</TableCell>
                                <TableCell className="text-center">
                                  <Badge
                                    style={{
                                      backgroundColor: item.bttsRate >= 60 ? '#22c55e' :
                                                      item.bttsRate >= 50 ? '#f59e0b' : '#6b7280'
                                    }}
                                    className="text-white text-xs"
                                  >
                                    {item.bttsRate.toFixed(0)}%
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* HT Result vs BTTS */}
                  <div>
                    <h4 className="font-semibold text-sm mb-3 text-purple-700">Half-Time Result vs BTTS Rate</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border">
                        <p className="text-xs text-muted-foreground">HT Home Win</p>
                        <p className="text-xl font-bold text-green-600">{backtestResult.bttsPatterns.htResultPatterns.htHomeWin.bttsRate.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">({backtestResult.bttsPatterns.htResultPatterns.htHomeWin.count} games)</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border">
                        <p className="text-xs text-muted-foreground">HT Draw</p>
                        <p className="text-xl font-bold text-amber-600">{backtestResult.bttsPatterns.htResultPatterns.htDraw.bttsRate.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">({backtestResult.bttsPatterns.htResultPatterns.htDraw.count} games)</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border">
                        <p className="text-xs text-muted-foreground">HT Away Win</p>
                        <p className="text-xl font-bold text-blue-600">{backtestResult.bttsPatterns.htResultPatterns.htAwayWin.bttsRate.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">({backtestResult.bttsPatterns.htResultPatterns.htAwayWin.count} games)</p>
                      </div>
                    </div>
                  </div>

                  {/* 2nd Half Result vs BTTS */}
                  <div>
                    <h4 className="font-semibold text-sm mb-3 text-purple-700">2nd Half Result vs BTTS Rate</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border">
                        <p className="text-xs text-muted-foreground">2H Home Win</p>
                        <p className="text-xl font-bold text-green-600">{backtestResult.bttsPatterns.shResultPatterns.shHomeWin.bttsRate.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">({backtestResult.bttsPatterns.shResultPatterns.shHomeWin.count} games)</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border">
                        <p className="text-xs text-muted-foreground">2H Draw</p>
                        <p className="text-xl font-bold text-amber-600">{backtestResult.bttsPatterns.shResultPatterns.shDraw.bttsRate.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">({backtestResult.bttsPatterns.shResultPatterns.shDraw.count} games)</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border">
                        <p className="text-xs text-muted-foreground">2H Away Win</p>
                        <p className="text-xl font-bold text-blue-600">{backtestResult.bttsPatterns.shResultPatterns.shAwayWin.bttsRate.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">({backtestResult.bttsPatterns.shResultPatterns.shAwayWin.count} games)</p>
                      </div>
                    </div>
                  </div>

                  {/* Insights */}
                  {backtestResult.bttsPatterns.insights.length > 0 && (
                    <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200">
                      <h4 className="font-semibold text-sm mb-2 text-indigo-700">💡 Key Insights</h4>
                      <ul className="space-y-1">
                        {backtestResult.bttsPatterns.insights.map((insight, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                            <span className="text-indigo-500 mt-0.5">•</span>
                            {insight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sample Predictions */}
          {backtestResult.predictions.length > 0 && (
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">Sample Predictions (First 20)</CardTitle>
                <CardDescription>
                  Comparison of predicted vs actual results with H2H, HT/SH data and odds
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Match</TableHead>
                        <TableHead className="text-center text-xs">Last H2H</TableHead>
                        <TableHead className="text-center text-xs">Odds H/D/A</TableHead>
                        <TableHead className="text-center text-xs">Pred</TableHead>
                        <TableHead className="text-center text-xs">Actual FT</TableHead>
                        <TableHead className="text-center text-xs">HT</TableHead>
                        <TableHead className="text-center text-xs">2nd H</TableHead>
                        <TableHead className="text-center text-xs">O2.5</TableHead>
                        <TableHead className="text-center text-xs">BTTS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {backtestResult.predictions.slice(0, 20).map((pred, i) => (
                        <TableRow key={i} className={pred.correct.result ? 'bg-green-50/50' : 'bg-red-50/50'}>
                          <TableCell className="text-xs">{pred.match.date}</TableCell>
                          <TableCell className="text-xs">
                            <div className="flex flex-col">
                              <span className="font-medium">{pred.match.homeTeam}</span>
                              <span className="text-muted-foreground">vs {pred.match.awayTeam}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {pred.lastH2H?.found ? (
                              <div className="flex flex-col items-center">
                                <Badge
                                  style={{
                                    backgroundColor: pred.lastH2H.result === 'H' ? COLORS.homeWin :
                                                    pred.lastH2H.result === 'D' ? COLORS.draw : COLORS.awayWin
                                  }}
                                  className="text-white text-xs"
                                >
                                  {pred.lastH2H.result}
                                </Badge>
                                <span className="text-xs text-muted-foreground mt-1">{pred.lastH2H.scoreline}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {pred.odds && (pred.odds.home || pred.odds.draw || pred.odds.away) ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className={`text-xs font-mono ${pred.actual.result === 'H' ? 'text-green-600 font-bold' : 'text-muted-foreground'}`}>
                                  H: {pred.odds.home?.toFixed(2) || '-'}
                                </span>
                                <span className={`text-xs font-mono ${pred.actual.result === 'D' ? 'text-amber-600 font-bold' : 'text-muted-foreground'}`}>
                                  D: {pred.odds.draw?.toFixed(2) || '-'}
                                </span>
                                <span className={`text-xs font-mono ${pred.actual.result === 'A' ? 'text-blue-600 font-bold' : 'text-muted-foreground'}`}>
                                  A: {pred.odds.away?.toFixed(2) || '-'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-xs">
                              {pred.predicted.homeWin > pred.predicted.draw && pred.predicted.homeWin > pred.predicted.awayWin ? 'H' :
                               pred.predicted.awayWin > pred.predicted.draw ? 'A' : 'D'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge style={{ backgroundColor: pred.actual.result === 'H' ? COLORS.homeWin : pred.actual.result === 'D' ? COLORS.draw : COLORS.awayWin }} className="text-white text-xs">
                              {pred.actual.result} ({pred.actual.homeGoals}-{pred.actual.awayGoals})
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              style={{
                                backgroundColor: pred.actual.htResult === 'H' ? COLORS.homeWin :
                                                pred.actual.htResult === 'D' ? COLORS.draw : COLORS.awayWin
                              }}
                              className="text-white text-xs"
                            >
                              {pred.actual.htResult} ({pred.actual.htHomeGoals}-{pred.actual.htAwayGoals})
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              style={{
                                backgroundColor: pred.actual.shResult === 'H' ? COLORS.homeWin :
                                                pred.actual.shResult === 'D' ? COLORS.draw : COLORS.awayWin
                              }}
                              className="text-white text-xs"
                            >
                              {pred.actual.shResult} ({pred.actual.shHomeGoals}-{pred.actual.shAwayGoals})
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`text-xs ${pred.correct.over25 ? 'text-green-600' : 'text-red-600'}`}>
                              {pred.predicted.over25}%→{pred.actual.over25 ? 'O' : 'U'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`text-xs ${pred.correct.btts ? 'text-green-600' : 'text-red-600'}`}>
                              {pred.predicted.btts}%→{pred.actual.btts ? 'Y' : 'N'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Export Button */}
          <Card className="shadow-md">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Export Backtest Results</p>
                  <p className="text-sm text-muted-foreground">Download all predictions and metrics as CSV</p>
                </div>
                <Button
                  onClick={() => {
                    if (!backtestResult) return
                    const headers = ['Date', 'Home Team', 'Away Team', 'Pred H%', 'Pred D%', 'Pred A%', 'Pred O2.5%', 'Pred BTTS%', 'Actual Result', 'Actual Goals', 'Actual O2.5', 'Actual BTTS', 'Correct Result', 'Correct O2.5', 'Correct BTTS']
                    const csvRows = [headers.join(',')]
                    backtestResult.predictions.forEach(p => {
                      csvRows.push([
                        p.match.date, `"${p.match.homeTeam}"`, `"${p.match.awayTeam}"`,
                        p.predicted.homeWin, p.predicted.draw, p.predicted.awayWin,
                        p.predicted.over25, p.predicted.btts,
                        p.actual.result, `${p.actual.homeGoals}-${p.actual.awayGoals}`,
                        p.actual.over25 ? 'Yes' : 'No', p.actual.btts ? 'Yes' : 'No',
                        p.correct.result ? 'Yes' : 'No', p.correct.over25 ? 'Yes' : 'No', p.correct.btts ? 'Yes' : 'No'
                      ].join(','))
                    })
                    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `backtest_${selectedLeague}_${backtestResult.config.testSeason}.csv`
                    a.click()
                  }}
                  variant="outline"
                >
                  📥 Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="py-8 text-center">
            <FlaskConical className="w-8 h-8 mx-auto text-purple-500 mb-3" />
            <p className="text-purple-700 font-medium">Ready to Backtest</p>
            <p className="text-sm text-muted-foreground mt-2">Select a test season and click "Run Backtest" to analyze prediction accuracy</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
