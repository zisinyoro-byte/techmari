'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Goal, CheckCircle, AlertTriangle, BarChart3, TrendingUp } from 'lucide-react'
import type { Over35TabProps } from './types'
import { factorial } from '@/lib/utils'
import { OVER35_THRESHOLDS } from '@/lib/betting-filters'

export default function Over35Tab({
  results,
  analytics,
  prediction,
  loading,
  selectedLeagueName,
}: Over35TabProps) {
  return (
    <div className="space-y-6">
      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <Card key={i}><CardContent className="py-6"><Skeleton className="h-32 w-full" /></CardContent></Card>)}
        </div>
      ) : analytics && results.length > 0 ? (
        <>
          {/* Over 3.5 Checklist Header */}
          <Card className="shadow-md border-2 border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Goal className="w-6 h-6 text-orange-600" />
                Top 10 Over 3.5 Goals Checklist
              </CardTitle>
              <CardDescription>
                Use this checklist to evaluate if a game is likely to have 4+ total goals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Check each factor below. The more checks you have, the higher the Over 3.5 probability.
                  Based on <span className="font-bold text-foreground">{analytics.totalMatches} matches</span> from {selectedLeagueName}.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Checklist Items */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Over 3.5 Goals Indicators Checklist
              </CardTitle>
              <CardDescription>
                Tick the boxes that apply to your match. Aim for 7+ checks for high Over 3.5 confidence.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                // Calculate Over 3.5 related metrics from league data
                const lambdaHome = analytics.avgHomeGoals
                const lambdaAway = analytics.avgAwayGoals
                const rho = -0.13 - ((analytics.under25Count / analytics.totalMatches) - 0.5) * 0.1

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

                let over35Prob = 0
                let over25Prob = 0
                let over45Prob = 0
                for (let h = 0; h <= 8; h++) {
                  for (let a = 0; a <= 8; a++) {
                    const prob = dcProb(h, a)
                    if (h + a > 2.5) over25Prob += prob
                    if (h + a > 3.5) over35Prob += prob
                    if (h + a > 4.5) over45Prob += prob
                  }
                }

                // Calculate actual over 3.5 rate from results
                const actualOver35Count = results.filter(r => r.ftHomeGoals + r.ftAwayGoals > 3.5).length
                const actualOver35Percent = (actualOver35Count / results.length) * 100

                // Calculate avg goals when over 2.5 occurs
                const over25Matches = results.filter(r => r.ftHomeGoals + r.ftAwayGoals > 2.5)
                const avgGoalsWhenOver25 = over25Matches.length > 0
                  ? over25Matches.reduce((sum, r) => sum + r.ftHomeGoals + r.ftAwayGoals, 0) / over25Matches.length
                  : 0

                // Generate checklist items with dynamic values (7 auto-check criteria)
                const checklistItems = [
                  {
                    id: 1,
                    label: `League Avg Goals Per Game ≥ ${OVER35_THRESHOLDS.leagueAvgGoals}`,
                    description: `Current league average: ${analytics.avgGoalsPerGame.toFixed(2)} goals/game (need ${OVER35_THRESHOLDS.leagueAvgGoals}+ for O3.5)`,
                    passing: analytics.avgGoalsPerGame >= OVER35_THRESHOLDS.leagueAvgGoals,
                    value: analytics.avgGoalsPerGame.toFixed(2),
                    threshold: `≥ ${OVER35_THRESHOLDS.leagueAvgGoals.toFixed(2)}`
                  },
                  {
                    id: 2,
                    label: `Model Over 3.5 Probability ≥ ${OVER35_THRESHOLDS.modelO35Prob}%`,
                    description: `Model predicts ${prediction?.prediction?.over35?.toFixed(1) || 'N/A'}% Over 3.5 chance`,
                    passing: prediction?.prediction?.over35 >= OVER35_THRESHOLDS.modelO35Prob,
                    value: `${prediction?.prediction?.over35?.toFixed(1) || 'N/A'}%`,
                    threshold: `≥ ${OVER35_THRESHOLDS.modelO35Prob}%`
                  },
                  {
                    id: 3,
                    label: `BTTS Probability ≥ ${OVER35_THRESHOLDS.bttsProb}%`,
                    description: `BTTS probability indicates goal-scoring potential for O3.5`,
                    passing: prediction?.prediction?.btts >= OVER35_THRESHOLDS.bttsProb,
                    value: `${prediction?.prediction?.btts?.toFixed(1) || 'N/A'}%`,
                    threshold: `≥ ${OVER35_THRESHOLDS.bttsProb}%`
                  },
                  {
                    id: 4,
                    label: `Over 2.5 Goals Rate ≥ ${OVER35_THRESHOLDS.leagueO25Rate}%`,
                    description: `${analytics.over25Percent.toFixed(1)}% of league matches have 3+ goals (foundation for O3.5)`,
                    passing: analytics.over25Percent >= OVER35_THRESHOLDS.leagueO25Rate,
                    value: `${analytics.over25Percent.toFixed(1)}%`,
                    threshold: `≥ ${OVER35_THRESHOLDS.leagueO25Rate}%`
                  },
                  {
                    id: 5,
                    label: `Home Team Avg Goals ≥ ${OVER35_THRESHOLDS.homeAvgGoals}`,
                    description: `League home teams avg ${analytics.avgHomeGoals.toFixed(2)} goals per game`,
                    passing: analytics.avgHomeGoals >= OVER35_THRESHOLDS.homeAvgGoals,
                    value: analytics.avgHomeGoals.toFixed(2),
                    threshold: `≥ ${OVER35_THRESHOLDS.homeAvgGoals.toFixed(2)}`
                  },
                  {
                    id: 6,
                    label: `Away Team Avg Goals ≥ ${OVER35_THRESHOLDS.awayAvgGoals}`,
                    description: `League away teams avg ${analytics.avgAwayGoals.toFixed(2)} goals per game`,
                    passing: analytics.avgAwayGoals >= OVER35_THRESHOLDS.awayAvgGoals,
                    value: analytics.avgAwayGoals.toFixed(2),
                    threshold: `≥ ${OVER35_THRESHOLDS.awayAvgGoals.toFixed(2)}`
                  },
                  {
                    id: 7,
                    label: `Shot Conversion Rate ≥ ${OVER35_THRESHOLDS.shotConversion}%`,
                    description: `Overall shot conversion: ${analytics.overallShotConversion}% (higher = more clinical finishing)`,
                    passing: parseFloat(analytics.overallShotConversion) >= OVER35_THRESHOLDS.shotConversion,
                    value: `${analytics.overallShotConversion}%`,
                    threshold: `≥ ${OVER35_THRESHOLDS.shotConversion}%`
                  },
                  {
                    id: 8,
                    label: "High-Scoring H2H History",
                    description: "Check H2H tab for Over 3.5 rate between these teams",
                    passing: null, // Requires manual check
                    value: "Manual",
                    threshold: "≥ 30%"
                  },
                  {
                    id: 9,
                    label: "Both Teams Have Strong Attack",
                    description: "Check team form - both teams scoring 1.5+ goals/game recently",
                    passing: null, // Requires manual check
                    value: "Manual",
                    threshold: "Both 1.5+"
                  },
                  {
                    id: 10,
                    label: "Match Odds Suggest Open Game",
                    description: "Check if O2.5 odds < 1.60 and O3.5 odds < 2.20 (value indicators)",
                    passing: null, // Requires manual check
                    value: "Manual",
                    threshold: "Check odds"
                  }
                ]

                const passedCount = checklistItems.filter(item => item.passing === true).length
                const manualCount = checklistItems.filter(item => item.passing === null).length

                return (
                  <div className="space-y-4">
                    {/* Summary Bar */}
                    <div className="p-4 rounded-lg bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 border border-orange-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-orange-700 dark:text-orange-300">Auto-Checked Status</p>
                          <p className="text-sm text-muted-foreground">{passedCount} of {checklistItems.length - manualCount} auto-checks passed</p>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-bold text-orange-600">{passedCount}/{checklistItems.length - manualCount}</p>
                          <p className="text-xs text-muted-foreground">+ {manualCount} manual checks</p>
                        </div>
                      </div>
                      <div className="mt-3 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${passedCount >= 5 ? 'bg-green-500' : passedCount >= 3 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${(passedCount / (checklistItems.length - manualCount)) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Checklist Items */}
                    <div className="space-y-3">
                      {checklistItems.map((item) => (
                        <div
                          key={item.id}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            item.passing === true
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                              : item.passing === false
                              ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                              : 'bg-gray-50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-700'
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 mt-1">
                              {item.passing === true ? (
                                <CheckCircle className="w-6 h-6 text-green-600" />
                              ) : item.passing === false ? (
                                <AlertTriangle className="w-6 h-6 text-red-500" />
                              ) : (
                                <div className="w-6 h-6 rounded border-2 border-gray-400 flex items-center justify-center">
                                  <span className="text-xs text-gray-500">?</span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="font-semibold text-foreground">{item.id}. {item.label}</p>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className={
                                      item.passing === true
                                        ? 'border-green-500 text-green-600'
                                        : item.passing === false
                                        ? 'border-red-500 text-red-600'
                                        : 'border-gray-400 text-gray-500'
                                    }
                                  >
                                    {item.value}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">Target: {item.threshold}</span>
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Final Recommendation */}
                    <div className={`p-6 rounded-xl border-2 ${
                      passedCount >= 5
                        ? 'bg-gradient-to-r from-green-100 to-emerald-100 border-green-400 dark:from-green-900/30 dark:to-emerald-900/30'
                        : passedCount >= 3
                        ? 'bg-gradient-to-r from-yellow-100 to-amber-100 border-yellow-400 dark:from-yellow-900/30 dark:to-amber-900/30'
                        : 'bg-gradient-to-r from-red-100 to-orange-100 border-red-400 dark:from-red-900/30 dark:to-orange-900/30'
                    }`}>
                      <div className="text-center">
                        <p className="font-bold text-lg mb-2">
                          {passedCount >= 5
                            ? '✅ HIGH OVER 3.5 CONFIDENCE'
                            : passedCount >= 3
                            ? '⚠️ MODERATE OVER 3.5 CONFIDENCE'
                            : '❌ LOW OVER 3.5 CONFIDENCE'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {passedCount >= 5
                            ? 'Strong indicators suggest 4+ goals are likely. Consider this a solid betting opportunity.'
                            : passedCount >= 3
                            ? 'Mixed signals. Check the manual items and team-specific form before deciding.'
                            : 'Most indicators are negative. Over 3.5 may not be the best choice for this match.'}
                        </p>
                        <div className="mt-4 flex justify-center gap-4 text-xs">
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                            <span>Pass</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <span>Fail</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full bg-gray-400" />
                            <span>Manual</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </CardContent>
          </Card>

          {/* Quick Stats for Over 3.5 */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                League Stats for Over 3.5 Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const actualOver35Count = results.filter(r => r.ftHomeGoals + r.ftAwayGoals > 3.5).length
                const actualOver35Percent = (actualOver35Count / results.length) * 100
                const actualOver45Count = results.filter(r => r.ftHomeGoals + r.ftAwayGoals > 4.5).length
                const actualOver45Percent = (actualOver45Count / results.length) * 100
                const highScoringMatches = results.filter(r => r.ftHomeGoals + r.ftAwayGoals >= 4)
                const avgGoalsInHighScoring = highScoringMatches.length > 0
                  ? highScoringMatches.reduce((sum, r) => sum + r.ftHomeGoals + r.ftAwayGoals, 0) / highScoringMatches.length
                  : 0

                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 rounded-lg bg-orange-50 dark:bg-orange-900/30">
                      <p className="text-xs text-muted-foreground">Avg Goals/Game</p>
                      <p className="text-3xl font-bold text-orange-600">{analytics.avgGoalsPerGame.toFixed(2)}</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-amber-50 dark:bg-amber-900/30">
                      <p className="text-xs text-muted-foreground">Over 3.5 Rate</p>
                      <p className="text-3xl font-bold text-amber-600">{actualOver35Percent.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">{actualOver35Count} matches</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-900/30">
                      <p className="text-xs text-muted-foreground">Over 4.5 Rate</p>
                      <p className="text-3xl font-bold text-red-600">{actualOver45Percent.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">{actualOver45Count} matches</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/30">
                      <p className="text-xs text-muted-foreground">Avg in 4+ Goal Games</p>
                      <p className="text-3xl font-bold text-yellow-600">{avgGoalsInHighScoring.toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">goals</p>
                    </div>
                  </div>
                )
              })()}
            </CardContent>
          </Card>

          {/* Goal Distribution Chart */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-600" />
                Goal Distribution in League
              </CardTitle>
              <CardDescription>How often each goal total occurs</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const goalDistribution = new Map<number, number>()
                results.forEach(r => {
                  const total = r.ftHomeGoals + r.ftAwayGoals
                  goalDistribution.set(total, (goalDistribution.get(total) || 0) + 1)
                })

                const sortedGoals = Array.from(goalDistribution.entries())
                  .sort((a, b) => a[0] - b[0])
                  .slice(0, 9) // Show 0-8 goals

                return (
                  <div className="space-y-2">
                    {sortedGoals.map(([goals, count]) => {
                      const percent = (count / results.length) * 100
                      const isOver35 = goals >= 4
                      return (
                        <div key={goals} className="flex items-center gap-3">
                          <span className={`w-8 text-sm font-mono font-bold ${isOver35 ? 'text-orange-600' : 'text-gray-500'}`}>
                            {goals}
                          </span>
                          <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isOver35 ? 'bg-orange-500' : 'bg-gray-400'}`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="w-16 text-sm text-muted-foreground text-right">
                            {count} ({percent.toFixed(1)}%)
                          </span>
                        </div>
                      )
                    })}
                    <p className="text-xs text-muted-foreground mt-2">
                      Orange bars indicate Over 3.5 goals (4+ goals)
                    </p>
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-3" />
            <p className="text-amber-700 font-medium">No data available</p>
            <p className="text-sm text-muted-foreground mt-2">Select a league and season to view Over 3.5 checklist</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
