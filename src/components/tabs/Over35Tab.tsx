'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Goal, CheckCircle, AlertTriangle, BarChart3, TrendingUp } from 'lucide-react'
import type { Over35TabProps } from './types'
import { factorial } from '@/lib/utils'
import { computeLeagueBaselines, resolveAllThresholds, getOver35DisplayThresholds, O25_IMPLIED_THRESHOLDS, ROLLING_SCORING_THRESHOLDS } from '@/lib/betting-filters'

export default function Over35Tab({
  results,
  analytics,
  prediction,
  loading,
  selectedLeague,
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
          <Card className="shadow-md border-2 border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Goal className="w-6 h-6 text-orange-600" />
                Over 3.5 Goals Checklist (4 Proven Checks)
              </CardTitle>
              <CardDescription>
                Each check has proven lift. The more that pass, the higher the Over 3.5 probability.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Based on <span className="font-bold text-foreground">{analytics.totalMatches} matches</span> from {selectedLeagueName}.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Over 3.5 Indicators
              </CardTitle>
              <CardDescription>
                Aim for 3+ checks for high Over 3.5 confidence.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const baselines = computeLeagueBaselines(results, analytics);
                const resolved = resolveAllThresholds(selectedLeague, baselines);
                const displayT = getOver35DisplayThresholds(resolved);

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
                for (let h = 0; h <= 8; h++) {
                  for (let a = 0; a <= 8; a++) {
                    const prob = dcProb(h, a)
                    if (h + a > 2.5) over25Prob += prob
                    if (h + a > 3.5) over35Prob += prob
                  }
                }

                const actualOver35Count = results.filter(r => r.ftHomeGoals + r.ftAwayGoals > 3.5).length
                const actualOver35Percent = (actualOver35Count / results.length) * 100

                // O2.5 implied probability
                const homeOdds25 = results.filter(r => r.homeTeam && r.oddsAvgOver25)
                  .sort((a, b) => b.date.localeCompare(a.date))[0]?.oddsAvgOver25
                const o25ImpliedProb = homeOdds25 ? (1 / homeOdds25) * 100 : null

                // Rolling stats
                const rollingStats = (prediction as any)?.rollingStats
                const rollingCombinedScoring = rollingStats?.rollingCombinedScoring ?? (analytics.avgHomeGoals + analytics.avgAwayGoals)

                const checklistItems = [
                  {
                    id: 1,
                    label: 'Model Over 3.5 Probability >= ' + displayT.modelO35Prob.toFixed(0) + '%',
                    description: 'Model predicts ' + ((prediction?.prediction?.calibrated?.over35 ?? prediction?.prediction?.over35) ?? 0).toFixed(1) + '% Over 3.5 chance',
                    passing: (prediction?.prediction?.calibrated?.over35 ?? prediction?.prediction?.over35 ?? 0) >= displayT.modelO35Prob,
                    value: ((prediction?.prediction?.calibrated?.over35 ?? prediction?.prediction?.over35) ?? 0).toFixed(1) + '%',
                    threshold: '>= ' + displayT.modelO35Prob.toFixed(0) + '%',
                  },
                  {
                    id: 2,
                    label: 'BTTS Probability >= ' + displayT.bttsProb.toFixed(0) + '%',
                    description: 'BTTS probability indicates goal-scoring potential for O3.5',
                    passing: (prediction?.prediction?.calibrated?.btts ?? prediction?.prediction?.btts ?? 0) >= displayT.bttsProb,
                    value: ((prediction?.prediction?.calibrated?.btts ?? prediction?.prediction?.btts) ?? 0).toFixed(1) + '%',
                    threshold: '>= ' + displayT.bttsProb.toFixed(0) + '%',
                  },
                  {
                    id: 3,
                    label: 'O2.5 Implied Probability >= ' + O25_IMPLIED_THRESHOLDS.over35 + '%',
                    description: 'Bookmaker odds imply ' + (o25ImpliedProb ? o25ImpliedProb.toFixed(1) + '% O2.5' : 'no odds available'),
                    passing: o25ImpliedProb !== null && o25ImpliedProb >= O25_IMPLIED_THRESHOLDS.over35,
                    value: o25ImpliedProb ? o25ImpliedProb.toFixed(1) + '%' : 'N/A',
                    threshold: '>= ' + O25_IMPLIED_THRESHOLDS.over35 + '%',
                  },
                  {
                    id: 4,
                    label: 'Rolling Combined Scoring >= ' + ROLLING_SCORING_THRESHOLDS.over35,
                    description: 'Both teams recent scoring form: ' + rollingCombinedScoring.toFixed(1) + ' combined goals (last 5)',
                    passing: rollingCombinedScoring >= ROLLING_SCORING_THRESHOLDS.over35,
                    value: rollingCombinedScoring.toFixed(1),
                    threshold: '>= ' + ROLLING_SCORING_THRESHOLDS.over35,
                  },
                ]

                const passedCount = checklistItems.filter(item => item.passing === true).length

                return (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 border border-orange-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-orange-700 dark:text-orange-300">Over 3.5 Checklist Status</p>
                          <p className="text-sm text-muted-foreground">{passedCount} of {checklistItems.length} checks passed</p>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-bold text-orange-600">{passedCount}/{checklistItems.length}</p>
                        </div>
                      </div>
                      <div className="mt-3 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={'h-full rounded-full transition-all ' + (passedCount >= 3 ? 'bg-green-500' : passedCount >= 2 ? 'bg-yellow-500' : 'bg-red-500')}
                          style={{ width: (passedCount / checklistItems.length) * 100 + '%' }}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      {checklistItems.map((item) => (
                        <div
                          key={item.id}
                          className={'p-4 rounded-lg border-2 transition-all ' + (
                            item.passing === true
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                              : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                          )}
                        >
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 mt-1">
                              {item.passing === true ? (
                                <CheckCircle className="w-6 h-6 text-green-600" />
                              ) : (
                                <AlertTriangle className="w-6 h-6 text-red-500" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="font-semibold text-foreground">{item.id}. {item.label}</p>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={item.passing ? 'border-green-500 text-green-600' : 'border-red-500 text-red-600'}>{item.value}</Badge>
                                  <span className="text-xs text-muted-foreground">Target: {item.threshold}</span>
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className={'p-6 rounded-xl border-2 ' + (
                      passedCount >= 3
                        ? 'bg-gradient-to-r from-green-100 to-emerald-100 border-green-400 dark:from-green-900/30 dark:to-emerald-900/30'
                        : passedCount >= 2
                        ? 'bg-gradient-to-r from-yellow-100 to-amber-100 border-yellow-400 dark:from-yellow-900/30 dark:to-amber-900/30'
                        : 'bg-gradient-to-r from-red-100 to-orange-100 border-red-400 dark:from-red-900/30 dark:to-orange-900/30'
                    )}>
                      <div className="text-center">
                        <p className="font-bold text-lg mb-2">
                          {passedCount >= 3 ? 'HIGH OVER 3.5 CONFIDENCE' : passedCount >= 2 ? 'MODERATE OVER 3.5 CONFIDENCE' : 'LOW OVER 3.5 CONFIDENCE'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {passedCount >= 3
                            ? 'Strong indicators suggest 4+ goals are likely.'
                            : passedCount >= 2
                            ? 'Mixed signals. Check team-specific form before deciding.'
                            : 'Most indicators are negative. Over 3.5 may not be the best choice.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </CardContent>
          </Card>

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
                      <p className="text-xs text-muted-foreground">O2.5 Rate</p>
                      <p className="text-3xl font-bold text-yellow-600">{analytics.over25Percent.toFixed(1)}%</p>
                    </div>
                  </div>
                )
              })()}
            </CardContent>
          </Card>

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
                  .slice(0, 9)

                return (
                  <div className="space-y-2">
                    {sortedGoals.map(([goals, count]) => {
                      const percent = (count / results.length) * 100
                      const isOver35 = goals >= 4
                      return (
                        <div key={goals} className="flex items-center gap-3">
                          <span className={'w-8 text-sm font-mono font-bold ' + (isOver35 ? 'text-orange-600' : 'text-gray-500')}>
                            {goals}
                          </span>
                          <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={'h-full rounded-full ' + (isOver35 ? 'bg-orange-500' : 'bg-gray-400')}
                              style={{ width: percent + '%' }}
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
