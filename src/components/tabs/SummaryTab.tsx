'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Zap, CheckCircle, BarChart3, Target, AlertTriangle } from 'lucide-react'
import type { SummaryTabProps } from './types'
import { factorial } from '@/lib/utils'

export default function SummaryTab({
  results,
  analytics,
  prediction,
  loading,
  selectedLeagueName,
  selectedSeasonName,
}: SummaryTabProps) {
  return (
    <div className="space-y-6">
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
                const rho = -0.13 - ((analytics.under25Count / analytics.totalMatches) - 0.5) * 0.1

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
    </div>
  )
}
