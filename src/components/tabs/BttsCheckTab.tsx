'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Target, CheckCircle, AlertTriangle, BarChart3 } from 'lucide-react'
import type { BttsCheckTabProps } from './types'
import { factorial } from '@/lib/utils'
import { BTTS_THRESHOLDS } from '@/lib/betting-filters'

export default function BttsCheckTab({
  results,
  analytics,
  prediction,
  loading,
  selectedLeagueName,
}: BttsCheckTabProps) {
  return (
    <div className="space-y-6">
      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <Card key={i}><CardContent className="py-6"><Skeleton className="h-32 w-full" /></CardContent></Card>)}
        </div>
      ) : analytics && results.length > 0 ? (
        <>
          {/* BTTS Checklist Header */}
          <Card className="shadow-md border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Target className="w-6 h-6 text-purple-600" />
                Top 10 BTTS Checklist
              </CardTitle>
              <CardDescription>
                Use this checklist to evaluate if a game is likely to have Both Teams To Score (BTTS)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Check each factor below. The more checks you have, the higher the BTTS probability.
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
                BTTS Indicators Checklist
              </CardTitle>
              <CardDescription>
                Tick the boxes that apply to your match. Aim for 7+ checks for high BTTS confidence.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                // Calculate BTTS-related metrics from league data
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

                let bttsProb = 0
                let over25Prob = 0
                let over15Prob = 0
                for (let h = 0; h <= 6; h++) {
                  for (let a = 0; a <= 6; a++) {
                    const prob = dcProb(h, a)
                    if (h > 0 && a > 0) bttsProb += prob
                    if (h + a > 2.5) over25Prob += prob
                    if (h + a > 1.5) over15Prob += prob
                  }
                }

                // Generate checklist items with dynamic values
                const checklistItems = [
                  {
                    id: 1,
                    label: `League Avg Goals Per Game ≥ ${BTTS_THRESHOLDS.leagueAvgGoals}`,
                    description: `Current league average: ${analytics.avgGoalsPerGame.toFixed(2)} goals/game`,
                    passing: analytics.avgGoalsPerGame >= BTTS_THRESHOLDS.leagueAvgGoals,
                    value: analytics.avgGoalsPerGame.toFixed(2),
                    threshold: `≥ ${BTTS_THRESHOLDS.leagueAvgGoals.toFixed(2)}`
                  },
                  {
                    id: 2,
                    label: `Over 2.5 Goals Rate ≥ ${BTTS_THRESHOLDS.leagueO25Rate}%`,
                    description: `${analytics.over25Percent.toFixed(1)}% of league matches have 3+ goals`,
                    passing: analytics.over25Percent >= BTTS_THRESHOLDS.leagueO25Rate,
                    value: `${analytics.over25Percent.toFixed(1)}%`,
                    threshold: `≥ ${BTTS_THRESHOLDS.leagueO25Rate}%`
                  },
                  {
                    id: 3,
                    label: `Model BTTS Probability ≥ ${BTTS_THRESHOLDS.modelBttsProb}%`,
                    description: `Model predicts ${(bttsProb * 100).toFixed(1)}% BTTS chance`,
                    passing: bttsProb >= BTTS_THRESHOLDS.modelBttsProb / 100,
                    value: `${(bttsProb * 100).toFixed(1)}%`,
                    threshold: `≥ ${BTTS_THRESHOLDS.modelBttsProb}%`
                  },
                  {
                    id: 4,
                    label: "Both Teams Score in H2H History",
                    description: "Check H2H tab for historical BTTS rate between these teams",
                    passing: null, // Requires manual check
                    value: "Manual",
                    threshold: "≥ 50%"
                  },
                  {
                    id: 5,
                    label: `Home Team Avg Goals Scored ≥ ${BTTS_THRESHOLDS.homeAvgGoals}`,
                    description: `League home teams avg ${analytics.avgHomeGoals.toFixed(2)} goals`,
                    passing: analytics.avgHomeGoals >= BTTS_THRESHOLDS.homeAvgGoals,
                    value: analytics.avgHomeGoals.toFixed(2),
                    threshold: `≥ ${BTTS_THRESHOLDS.homeAvgGoals.toFixed(2)}`
                  },
                  {
                    id: 6,
                    label: `Away Team Avg Goals Scored ≥ ${BTTS_THRESHOLDS.awayAvgGoals}`,
                    description: `League away teams avg ${analytics.avgAwayGoals.toFixed(2)} goals`,
                    passing: analytics.avgAwayGoals >= BTTS_THRESHOLDS.awayAvgGoals,
                    value: analytics.avgAwayGoals.toFixed(2),
                    threshold: `≥ ${BTTS_THRESHOLDS.awayAvgGoals.toFixed(2)}`
                  },
                  {
                    id: 7,
                    label: `Model O2.5 Probability ≥ ${BTTS_THRESHOLDS.modelO25Prob}%`,
                    description: `Model predicts ${prediction?.prediction?.over25?.toFixed(1) || 'N/A'}% O2.5 chance`,
                    passing: prediction?.prediction?.over25 >= BTTS_THRESHOLDS.modelO25Prob,
                    value: `${prediction?.prediction?.over25?.toFixed(1) || 'N/A'}%`,
                    threshold: `≥ ${BTTS_THRESHOLDS.modelO25Prob}%`
                  },
                  {
                    id: 8,
                    label: "Last H2H Was NOT 0-0",
                    description: "Check H2H Tracker - 0-0 last meeting reduces BTTS chance",
                    passing: null, // Requires manual check
                    value: "Manual",
                    threshold: "Not 0-0"
                  },
                  {
                    id: 9,
                    label: `Both Teams Have Decent Shot Conversion (≥ ${BTTS_THRESHOLDS.shotConversion}%)`,
                    description: `League avg: ${analytics.overallShotConversion}% shot conversion`,
                    passing: parseFloat(analytics.overallShotConversion) >= BTTS_THRESHOLDS.shotConversion,
                    value: `${analytics.overallShotConversion}%`,
                    threshold: `≥ ${BTTS_THRESHOLDS.shotConversion}%`
                  },
                  {
                    id: 10,
                    label: "Match Odds Suggest Open Game",
                    description: "Check if O2.5 odds < 1.75 and BTTS odds < 1.80 (value indicators)",
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
                    <div className="p-4 rounded-lg bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 border border-purple-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-purple-700 dark:text-purple-300">Auto-Checked Status</p>
                          <p className="text-sm text-muted-foreground">{passedCount} of {checklistItems.length - manualCount} auto-checks passed</p>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-bold text-purple-600">{passedCount}/{checklistItems.length - manualCount}</p>
                          <p className="text-xs text-muted-foreground">+ {manualCount} manual checks</p>
                        </div>
                      </div>
                      <div className="mt-3 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${passedCount >= 6 ? 'bg-green-500' : passedCount >= 4 ? 'bg-yellow-500' : 'bg-red-500'}`}
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
                      passedCount >= 6
                        ? 'bg-gradient-to-r from-green-100 to-emerald-100 border-green-400 dark:from-green-900/30 dark:to-emerald-900/30'
                        : passedCount >= 4
                        ? 'bg-gradient-to-r from-yellow-100 to-amber-100 border-yellow-400 dark:from-yellow-900/30 dark:to-amber-900/30'
                        : 'bg-gradient-to-r from-red-100 to-orange-100 border-red-400 dark:from-red-900/30 dark:to-orange-900/30'
                    }`}>
                      <div className="text-center">
                        <p className="font-bold text-lg mb-2">
                          {passedCount >= 6
                            ? '✅ HIGH BTTS CONFIDENCE'
                            : passedCount >= 4
                            ? '⚠️ MODERATE BTTS CONFIDENCE'
                            : '❌ LOW BTTS CONFIDENCE'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {passedCount >= 6
                            ? 'Strong indicators suggest BTTS is likely. Consider this a solid betting opportunity.'
                            : passedCount >= 4
                            ? 'Mixed signals. Check the manual items and team-specific form before deciding.'
                            : 'Most indicators are negative. BTTS may not be the best choice for this match.'}
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

          {/* Quick Stats for BTTS */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                League Stats for BTTS Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-900/30">
                  <p className="text-xs text-muted-foreground">Avg Goals/Game</p>
                  <p className="text-3xl font-bold text-purple-600">{analytics.avgGoalsPerGame.toFixed(2)}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-pink-50 dark:bg-pink-900/30">
                  <p className="text-xs text-muted-foreground">Home Team Goals</p>
                  <p className="text-3xl font-bold text-pink-600">{analytics.avgHomeGoals.toFixed(2)}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/30">
                  <p className="text-xs text-muted-foreground">Away Team Goals</p>
                  <p className="text-3xl font-bold text-indigo-600">{analytics.avgAwayGoals.toFixed(2)}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-orange-50 dark:bg-orange-900/30">
                  <p className="text-xs text-muted-foreground">O2.5 Rate</p>
                  <p className="text-3xl font-bold text-orange-600">{analytics.over25Percent.toFixed(1)}%</p>
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
            <p className="text-sm text-muted-foreground mt-2">Select a league and season to view BTTS checklist</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
