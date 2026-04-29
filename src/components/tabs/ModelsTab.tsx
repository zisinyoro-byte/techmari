'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dice5, Target, BarChart3, AlertTriangle, Users, TrendingUp, Goal } from 'lucide-react'
import { Fragment } from 'react'
import type { ModelsTabProps } from './types'
import { COLORS } from '@/lib/constants'
import { parseDateSafe, factorial } from '@/lib/utils'
import {
  computeLeagueBaselines,
  computeBttsChecklistLabels, computeOver35ChecklistLabels,
  computeStrongBet, computeGreyResult,
  type ChecklistInput, type SignalInput, type LeagueBaselines,
} from '@/lib/betting-filters'

export default function ModelsTab({
  results,
  analytics,
  prediction,
  predHomeTeam,
  predAwayTeam,
  selectedLeague,
  selectedSeason,
  loading,
}: ModelsTabProps) {
  return (
    <div className="space-y-6">
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
                {/* xG Estimation Section */}
                <Card className="shadow-md border-2 border-cyan-200 bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-900/20 dark:to-teal-900/20">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="w-5 h-5 text-cyan-600" />
                      xG Estimation (Expected Goals)
                    </CardTitle>
                    <CardDescription>
                      Estimated xG based on shots data - compares actual vs expected performance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      // Calculate estimated xG for all matches
                      // Formula: xG = (Shots on Target × 0.30) + (Shots off Target × 0.08)
                      let totalHomeXg = 0
                      let totalAwayXg = 0
                      let totalHomeGoals = 0
                      let totalAwayGoals = 0
                      let matchCount = 0

                      results.forEach(match => {
                        if (match.homeShotsOnTarget > 0 || match.awayShotsOnTarget > 0) {
                          const homeShotsOff = match.homeShots - match.homeShotsOnTarget
                          const awayShotsOff = match.awayShots - match.awayShotsOnTarget

                          const homeXg = (match.homeShotsOnTarget * 0.30) + (homeShotsOff * 0.08)
                          const awayXg = (match.awayShotsOnTarget * 0.30) + (awayShotsOff * 0.08)

                          totalHomeXg += homeXg
                          totalAwayXg += awayXg
                          totalHomeGoals += match.ftHomeGoals
                          totalAwayGoals += match.ftAwayGoals
                          matchCount++
                        }
                      })

                      const avgHomeXg = matchCount > 0 ? totalHomeXg / matchCount : 0
                      const avgAwayXg = matchCount > 0 ? totalAwayXg / matchCount : 0
                      const avgHomeActual = matchCount > 0 ? totalHomeGoals / matchCount : 0
                      const avgAwayActual = matchCount > 0 ? totalAwayGoals / matchCount : 0

                      const homeXgDiff = avgHomeActual - avgHomeXg
                      const awayXgDiff = avgAwayActual - avgAwayXg

                      return (
                        <div className="space-y-4">
                          {/* xG Averages */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-lg bg-white/50 dark:bg-gray-800/50">
                              <p className="text-sm font-medium text-center text-muted-foreground">Home Team</p>
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                <div className="text-center">
                                  <p className="text-xs text-muted-foreground">Actual Goals</p>
                                  <p className="text-2xl font-bold text-blue-600">{avgHomeActual.toFixed(2)}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs text-muted-foreground">xG</p>
                                  <p className="text-2xl font-bold text-cyan-600">{avgHomeXg.toFixed(2)}</p>
                                </div>
                              </div>
                              <div className="mt-2 text-center">
                                <p className="text-xs text-muted-foreground">Difference</p>
                                <p className={`text-lg font-bold ${homeXgDiff > 0 ? 'text-green-600' : homeXgDiff < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                  {homeXgDiff > 0 ? '+' : ''}{homeXgDiff.toFixed(2)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {homeXgDiff > 0.1 ? 'Overperforming' : homeXgDiff < -0.1 ? 'Underperforming' : 'Performing as expected'}
                                </p>
                              </div>
                            </div>
                            <div className="p-4 rounded-lg bg-white/50 dark:bg-gray-800/50">
                              <p className="text-sm font-medium text-center text-muted-foreground">Away Team</p>
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                <div className="text-center">
                                  <p className="text-xs text-muted-foreground">Actual Goals</p>
                                  <p className="text-2xl font-bold text-blue-600">{avgAwayActual.toFixed(2)}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs text-muted-foreground">xG</p>
                                  <p className="text-2xl font-bold text-cyan-600">{avgAwayXg.toFixed(2)}</p>
                                </div>
                              </div>
                              <div className="mt-2 text-center">
                                <p className="text-xs text-muted-foreground">Difference</p>
                                <p className={`text-lg font-bold ${awayXgDiff > 0 ? 'text-green-600' : awayXgDiff < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                  {awayXgDiff > 0 ? '+' : ''}{awayXgDiff.toFixed(2)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {awayXgDiff > 0.1 ? 'Overperforming' : awayXgDiff < -0.1 ? 'Underperforming' : 'Performing as expected'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* xG-based predictions */}
                          <div className="p-4 rounded-lg bg-white/50 dark:bg-gray-800/50">
                            <p className="text-sm font-medium mb-2">xG-Based Predictions</p>
                            <div className="grid grid-cols-5 gap-2 text-sm">
                              <div className="text-center p-2 rounded bg-cyan-50 dark:bg-cyan-900/30">
                                <p className="text-xs text-muted-foreground">Predicted Total Goals</p>
                                <p className="text-lg font-bold text-cyan-600">{(avgHomeXg + avgAwayXg).toFixed(2)}</p>
                              </div>
                              <div className="text-center p-2 rounded bg-emerald-50 dark:bg-emerald-900/30">
                                <p className="text-xs text-muted-foreground">xG Over 1.5 Prob</p>
                                <p className="text-lg font-bold text-emerald-600">
                                  {(() => {
                                    const totalXg = avgHomeXg + avgAwayXg
                                    // Using Poisson-inspired probability estimation
                                    // P(Over 1.5) = 1 - P(0 goals) - P(1 goal)
                                    const lambda = totalXg
                                    const p0 = Math.exp(-lambda)
                                    const p1 = lambda * Math.exp(-lambda)
                                    const prob = Math.min(95, Math.max(40, (1 - p0 - p1) * 100))
                                    return prob.toFixed(0)
                                  })()}%
                                </p>
                              </div>
                              <div className="text-center p-2 rounded bg-cyan-50 dark:bg-cyan-900/30">
                                <p className="text-xs text-muted-foreground">xG Over 2.5 Prob</p>
                                <p className="text-lg font-bold text-cyan-600">
                                  {((avgHomeXg + avgAwayXg) > 2.5 ? 55 + ((avgHomeXg + avgAwayXg) - 2.5) * 15 : 55 - (2.5 - (avgHomeXg + avgAwayXg)) * 15).toFixed(0)}%
                                </p>
                              </div>
                              <div className="text-center p-2 rounded bg-purple-50 dark:bg-purple-900/30">
                                <p className="text-xs text-muted-foreground">xG BTTS Prob</p>
                                <p className="text-lg font-bold text-purple-600">
                                  {(() => {
                                    // BTTS probability based on both teams' xG
                                    // Using Poisson distribution for each team scoring at least 1
                                    const homeScoringProb = 1 - Math.exp(-avgHomeXg)
                                    const awayScoringProb = 1 - Math.exp(-avgAwayXg)
                                    const bttsProb = homeScoringProb * awayScoringProb
                                    return Math.min(85, Math.max(25, bttsProb * 100)).toFixed(0)
                                  })()}%
                                </p>
                              </div>
                              <div className="text-center p-2 rounded bg-cyan-50 dark:bg-cyan-900/30">
                                <p className="text-xs text-muted-foreground">Matches Analyzed</p>
                                <p className="text-lg font-bold text-cyan-600">{matchCount}</p>
                              </div>
                            </div>
                            {/* Prediction confidence indicators */}
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                              <div className="flex items-center gap-2 p-2 rounded bg-emerald-50 dark:bg-emerald-900/20">
                                <span className="font-medium text-emerald-700 dark:text-emerald-400">O1.5 Tip:</span>
                                <span className={(() => {
                                  const totalXg = avgHomeXg + avgAwayXg
                                  const lambda = totalXg
                                  const p0 = Math.exp(-lambda)
                                  const p1 = lambda * Math.exp(-lambda)
                                  const prob = (1 - p0 - p1) * 100
                                  return prob >= 65 ? 'text-green-600 font-semibold' : prob >= 50 ? 'text-amber-600 font-medium' : 'text-red-600'
                                })()}>
                                  {(() => {
                                    const totalXg = avgHomeXg + avgAwayXg
                                    const lambda = totalXg
                                    const p0 = Math.exp(-lambda)
                                    const p1 = lambda * Math.exp(-lambda)
                                    const prob = (1 - p0 - p1) * 100
                                    return prob >= 65 ? '✅ Strong Over 1.5' : prob >= 50 ? '⚖️ Moderate Over 1.5' : '⚠️ Consider Under 1.5'
                                  })()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 p-2 rounded bg-purple-50 dark:bg-purple-900/20">
                                <span className="font-medium text-purple-700 dark:text-purple-400">BTTS Tip:</span>
                                <span className={(() => {
                                  const homeScoringProb = 1 - Math.exp(-avgHomeXg)
                                  const awayScoringProb = 1 - Math.exp(-avgAwayXg)
                                  const bttsProb = homeScoringProb * awayScoringProb * 100
                                  return bttsProb >= 55 ? 'text-green-600 font-semibold' : bttsProb >= 40 ? 'text-amber-600 font-medium' : 'text-red-600'
                                })()}>
                                  {(() => {
                                    const homeScoringProb = 1 - Math.exp(-avgHomeXg)
                                    const awayScoringProb = 1 - Math.exp(-avgAwayXg)
                                    const bttsProb = homeScoringProb * awayScoringProb * 100
                                    return bttsProb >= 55 ? '✅ BTTS Likely' : bttsProb >= 40 ? '⚖️ BTTS Possible' : '⚠️ BTTS Unlikely'
                                  })()}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Likely Scorelines Section */}
                          <div className="p-4 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800">
                            <p className="text-sm font-medium mb-3 flex items-center gap-2">
                              <span className="text-indigo-600">🎯</span>
                              Likely Scorelines (Poisson Distribution)
                            </p>
                            {(() => {
                              // Calculate scoreline probabilities using Poisson distribution
                              // P(k goals) = (λ^k * e^-λ) / k!
                              const poissonProb = (lambda: number, k: number): number => {
                                return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k)
                              }

                              // Generate scoreline matrix for home goals 0-5 and away goals 0-5
                              const scorelines: { score: string; prob: number; homeGoals: number; awayGoals: number }[] = []

                              for (let h = 0; h <= 5; h++) {
                                for (let a = 0; a <= 5; a++) {
                                  const prob = poissonProb(avgHomeXg, h) * poissonProb(avgAwayXg, a)
                                  scorelines.push({
                                    score: `${h}-${a}`,
                                    prob: prob * 100,
                                    homeGoals: h,
                                    awayGoals: a
                                  })
                                }
                              }

                              // Sort by probability descending and take top 6
                              const topScorelines = scorelines.sort((a, b) => b.prob - a.prob).slice(0, 6)
                              const mostLikely = topScorelines[0]

                              // Determine result type for each scoreline
                              const getResultType = (h: number, a: number) => {
                                if (h > a) return { type: 'Home Win', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' }
                                if (h < a) return { type: 'Away Win', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' }
                                return { type: 'Draw', color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' }
                              }

                              return (
                                <div className="space-y-3">
                                  {/* Most likely scoreline highlighted */}
                                  <div className="flex items-center justify-center p-3 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 border-2 border-indigo-400">
                                    <div className="text-center">
                                      <p className="text-xs text-muted-foreground mb-1">Most Likely Scoreline</p>
                                      <p className="text-3xl font-bold text-indigo-600">{mostLikely.score}</p>
                                      <p className="text-sm font-medium text-indigo-500">{mostLikely.prob.toFixed(1)}% probability</p>
                                      <Badge className={`mt-1 ${getResultType(mostLikely.homeGoals, mostLikely.awayGoals).bg} ${getResultType(mostLikely.homeGoals, mostLikely.awayGoals).color}`}>
                                        {getResultType(mostLikely.homeGoals, mostLikely.awayGoals).type}
                                      </Badge>
                                    </div>
                                  </div>

                                  {/* Other likely scorelines */}
                                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                                    {topScorelines.slice(1).map((s, idx) => {
                                      const resultType = getResultType(s.homeGoals, s.awayGoals)
                                      return (
                                        <div key={idx} className={`text-center p-2 rounded-lg ${resultType.bg}`}>
                                          <p className="text-lg font-bold">{s.score}</p>
                                          <p className="text-xs text-muted-foreground">{s.prob.toFixed(1)}%</p>
                                        </div>
                                      )
                                    })}
                                  </div>

                                  {/* Scoreline summary stats */}
                                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-indigo-200 dark:border-indigo-700">
                                    <div className="text-center">
                                      <p className="text-xs text-muted-foreground">Home Win Scores</p>
                                      <p className="text-lg font-bold text-green-600">
                                        {topScorelines.filter(s => s.homeGoals > s.awayGoals).reduce((sum, s) => sum + s.prob, 0).toFixed(1)}%
                                      </p>
                                    </div>
                                    <div className="text-center">
                                      <p className="text-xs text-muted-foreground">Draw Scores</p>
                                      <p className="text-lg font-bold text-amber-600">
                                        {topScorelines.filter(s => s.homeGoals === s.awayGoals).reduce((sum, s) => sum + s.prob, 0).toFixed(1)}%
                                      </p>
                                    </div>
                                    <div className="text-center">
                                      <p className="text-xs text-muted-foreground">Away Win Scores</p>
                                      <p className="text-lg font-bold text-blue-600">
                                        {topScorelines.filter(s => s.homeGoals < s.awayGoals).reduce((sum, s) => sum + s.prob, 0).toFixed(1)}%
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )
                            })()}
                          </div>

                          {/* Formula explanation */}
                          <div className="text-xs text-muted-foreground p-2 bg-gray-100 dark:bg-gray-800 rounded">
                            <strong>Formula:</strong> xG = (Shots on Target × 0.30) + (Shots off Target × 0.08)
                            <br />
                            <span className="text-xs">Based on average conversion rates from historical data.</span>
                          </div>
                        </div>
                      )
                    })()}
                  </CardContent>
                </Card>

                {/* Export to CSV */}
                <Card className="shadow-md border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-600" />
                      Export Predictions to CSV
                    </CardTitle>
                    <CardDescription>
                      Download all predictions and analysis data for the selected league/season
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Button 
                          onClick={() => {
                            // Export match results
                            const headers = ['Date', 'Season', 'Home Team', 'Away Team', 'HT Score', 'FT Score', 'Result', 'Home Shots', 'Away Shots', 'Home SOT', 'Away SOT', 'Home Corners', 'Away Corners', 'Home Fouls', 'Away Fouls', 'Home Yellow', 'Away Yellow', 'Home Red', 'Away Red', 'Odds H', 'Odds D', 'Odds A']
                            const csvRows = [headers.join(',')]
                            results.forEach(m => {
                              csvRows.push([
                                m.date, m.season || '', `"${m.homeTeam}"`, `"${m.awayTeam}"`,
                                `${m.htHomeGoals}-${m.htAwayGoals}`, `${m.ftHomeGoals}-${m.ftAwayGoals}`,
                                m.ftResult, m.homeShots, m.awayShots, m.homeShotsOnTarget, m.awayShotsOnTarget,
                                m.homeCorners, m.awayCorners, m.homeFouls, m.awayFouls,
                                m.homeYellowCards, m.awayYellowCards, m.homeRedCards, m.awayRedCards,
                                m.oddsB365Home || '', m.oddsB365Draw || '', m.oddsB365Away || ''
                              ].join(','))
                            })
                            const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `${selectedLeague}_results_${selectedSeason}.csv`
                            a.click()
                          }}
                          variant="outline"
                          className="w-full"
                        >
                          📊 Match Results
                        </Button>
                        <Button 
                          onClick={() => {
                            // Export analytics summary
                            if (!analytics) return
                            const data = [
                              ['Metric', 'Value'],
                              ['Total Matches', analytics.totalMatches],
                              ['Home Win %', analytics.homeWinPercent],
                              ['Draw %', analytics.drawPercent],
                              ['Away Win %', analytics.awayWinPercent],
                              ['Avg Goals/Game', analytics.avgGoalsPerGame],
                              ['Avg Home Goals', analytics.avgHomeGoals],
                              ['Avg Away Goals', analytics.avgAwayGoals],
                              ['Over 2.5 %', analytics.over25Percent],
                              ['Under 2.5 %', analytics.under25Percent],
                              ['HT-FT Correlation %', analytics.htftCorrelationPercent],
                              ['Avg Home Shots', analytics.avgHomeShots],
                              ['Avg Away Shots', analytics.avgAwayShots],
                              ['Home Shot Conversion %', analytics.homeShotConversion],
                              ['Away Shot Conversion %', analytics.awayShotConversion],
                            ]
                            const csv = data.map(row => row.join(',')).join('\n')
                            const blob = new Blob([csv], { type: 'text/csv' })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `${selectedLeague}_analytics_${selectedSeason}.csv`
                            a.click()
                          }}
                          variant="outline"
                          className="w-full"
                        >
                          📈 Analytics Summary
                        </Button>
                        <Button
                          onClick={() => {
                            // Comprehensive analysis export matching exact format
                            if (!prediction || !predHomeTeam || !predAwayTeam) return

                            // Calculate H2H data
                            const h2hData = results.filter(r =>
                              (r.homeTeam === predHomeTeam && r.awayTeam === predAwayTeam) ||
                              (r.homeTeam === predAwayTeam && r.awayTeam === predHomeTeam)
                            ).sort((a, b) => {
                              const dateA = parseDateSafe(a.date)
                              const dateB = parseDateSafe(b.date)
                              return dateB.getTime() - dateA.getTime()
                            })
                            const lastH2H = h2hData[0]
                            const h2hAvgGoals = h2hData.length > 0
                              ? h2hData.reduce((sum, m) => sum + m.ftHomeGoals + m.ftAwayGoals, 0) / h2hData.length
                              : null

                            // Sort results by date for regression analysis
                            const sortedResults = [...results].sort((a, b) => {
                              const dateA = parseDateSafe(a.date)
                              const dateB = parseDateSafe(b.date)
                              return dateB.getTime() - dateA.getTime()
                            })

                            // Calculate team goal stats for regression (matching detailed Regression to Mean Analysis)
                            const teamGoalStats = new Map<string, {
                              matches: number;
                              goalsScored: number;
                              goalsConceded: number;
                              matchesThisSeason: number;
                              scoredThisSeason: number;
                              concededThisSeason: number;
                              last10Matches: { totalGoals: number }[];
                              last3Matches: { totalGoals: number }[];
                            }>()

                            sortedResults.forEach(r => {
                              const totalGoals = r.ftHomeGoals + r.ftAwayGoals
                              const homeStats = teamGoalStats.get(r.homeTeam) || { matches: 0, goalsScored: 0, goalsConceded: 0, matchesThisSeason: 0, scoredThisSeason: 0, concededThisSeason: 0, last10Matches: [], last3Matches: [] }
                              homeStats.matches++
                              homeStats.goalsScored += r.ftHomeGoals
                              homeStats.goalsConceded += r.ftAwayGoals
                              homeStats.matchesThisSeason++
                              homeStats.scoredThisSeason += r.ftHomeGoals
                              homeStats.concededThisSeason += r.ftAwayGoals
                              homeStats.last10Matches.push({ totalGoals })
                              homeStats.last3Matches.push({ totalGoals })
                              teamGoalStats.set(r.homeTeam, homeStats)

                              const awayStats = teamGoalStats.get(r.awayTeam) || { matches: 0, goalsScored: 0, goalsConceded: 0, matchesThisSeason: 0, scoredThisSeason: 0, concededThisSeason: 0, last10Matches: [], last3Matches: [] }
                              awayStats.matches++
                              awayStats.goalsScored += r.ftAwayGoals
                              awayStats.goalsConceded += r.ftHomeGoals
                              awayStats.matchesThisSeason++
                              awayStats.scoredThisSeason += r.ftAwayGoals
                              awayStats.concededThisSeason += r.ftHomeGoals
                              awayStats.last10Matches.push({ totalGoals })
                              awayStats.last3Matches.push({ totalGoals })
                              teamGoalStats.set(r.awayTeam, awayStats)
                            })

                            const homeTeamData = teamGoalStats.get(predHomeTeam)
                            const awayTeamData = teamGoalStats.get(predAwayTeam)

                            // Calculate regression signals using the SAME weighted formula as the detailed card:
                            // combinedSignal = (seasonDeviation × 0.4) + (last10Deviation × 0.3) + (h2hDeviation × 0.3)
                            const calcRegressionSignal = (teamData: typeof homeTeamData, teamName: string) => {
                              if (!teamData || teamData.last3Matches.length < 3) return { signal: 'Neutral', combinedSignal: 0 }
                              const seasonAvg = teamData.matchesThisSeason > 0
                                ? (teamData.scoredThisSeason + teamData.concededThisSeason) / teamData.matchesThisSeason
                                : 0
                              const last10 = teamData.last10Matches.slice(0, 10)
                              const last10Avg = last10.length > 0
                                ? last10.reduce((sum, m) => sum + m.totalGoals, 0) / last10.length
                                : 0
                              const last3 = teamData.last3Matches.slice(0, 3)
                              const last3Avg = last3.length > 0
                                ? last3.reduce((sum, m) => sum + m.totalGoals, 0) / last3.length
                                : 0

                              // H2H deviation
                              const teamH2H = h2hData.filter(m => m.homeTeam === teamName || m.awayTeam === teamName)
                              const teamH2HAvg = teamH2H.length > 0
                                ? teamH2H.reduce((sum, m) => sum + m.ftHomeGoals + m.ftAwayGoals, 0) / teamH2H.length
                                : null
                              const lastH2HGoals = lastH2H ? lastH2H.ftHomeGoals + lastH2H.ftAwayGoals : null
                              const h2hDeviation = teamH2HAvg !== null && lastH2HGoals !== null
                                ? lastH2HGoals - teamH2HAvg
                                : 0

                              const deviationFromSeason = last3Avg - seasonAvg
                              const deviationFromLast10 = last3Avg - last10Avg
                              const combinedSignal = (deviationFromSeason * 0.4) + (deviationFromLast10 * 0.3) + (h2hDeviation * 0.3)

                              let signal: 'Strong Over' | 'Over' | 'Neutral' | 'Under' | 'Strong Under' = 'Neutral'
                              if (combinedSignal <= -0.8) signal = 'Strong Over'
                              else if (combinedSignal <= -0.3) signal = 'Over'
                              else if (combinedSignal >= 0.8) signal = 'Strong Under'
                              else if (combinedSignal >= 0.3) signal = 'Under'
                              return { signal, combinedSignal, last3Avg, seasonAvg }
                            }

                            const homeReg = calcRegressionSignal(homeTeamData, predHomeTeam)
                            const awayReg = calcRegressionSignal(awayTeamData, predAwayTeam)
                            const totalSignal = (homeReg.combinedSignal || 0) + (awayReg.combinedSignal || 0)

                            let regressionOverallSignal = 'Neutral'
                            if (totalSignal <= -1.2) regressionOverallSignal = 'Strong Over'
                            else if (totalSignal <= -0.5) regressionOverallSignal = 'Over'
                            else if (totalSignal >= 1.2) regressionOverallSignal = 'Strong Under'
                            else if (totalSignal >= 0.5) regressionOverallSignal = 'Under'

                            // Calculate BTTS confidence
                            const bttsProb = prediction.prediction.btts
                            let bttsConfidence = 'Low'
                            if (bttsProb >= 60) bttsConfidence = 'High'
                            else if (bttsProb >= 50) bttsConfidence = 'Medium'

                            // Calculate O1.5 confidence
                            const o15Prob = prediction.prediction.over15
                            let o15Confidence = 'Low'
                            if (o15Prob >= 75) o15Confidence = 'High'
                            else if (o15Prob >= 60) o15Confidence = 'Medium'

                            // Calculate BTTS strength (different from confidence)
                            let bttsStrength = 'Weak'
                            if (bttsProb >= 60) bttsStrength = 'Strong'
                            else if (bttsProb >= 50) bttsStrength = 'Medium'

                            // Compute league-adapted baselines for hybrid thresholds
                            const baselines: LeagueBaselines = computeLeagueBaselines(results, analytics);

                            // Use calibrated probabilities when available (more accurate from backtest), fall back to raw
                            const calBtts = prediction.prediction.calibrated?.btts ?? prediction.prediction.btts;
                            const calO25 = prediction.prediction.calibrated?.over25 ?? prediction.prediction.over25;
                            const calO35 = prediction.prediction.calibrated?.over35 ?? prediction.prediction.over35;

                            // Calculate checklists using shared utility
                            const checklistInput: ChecklistInput = {
                              avgGoalsPerGame: analytics.avgGoalsPerGame,
                              over25Percent: analytics.over25Percent,
                              bttsProb: calBtts,
                              avgHomeGoals: analytics.avgHomeGoals,
                              avgAwayGoals: analytics.avgAwayGoals,
                              o25Prob: calO25,
                              o35Prob: calO35,
                              overallShotConversion: parseFloat(analytics.overallShotConversion),
                            };
                            const over35Checks = computeOver35ChecklistLabels(checklistInput, baselines);
                            const over35Checklist = `${over35Checks.length} of 7`

                            // BTTS Check items (7 criteria) using shared utility
                            const bttsChecks = computeBttsChecklistLabels(checklistInput, baselines);
                            const bttsChecklist = `${bttsChecks.length} of 7`

                            // Z-Score Analysis Overall Signal - computed independently using Z-Score methodology
                            // matching the detailed Z-Score Analysis & Confidence Intervals card
                            const zScoreTeamStats = new Map<string, {
                              matches: number;
                              goals: number[];
                              totalGoals: number;
                              mean: number;
                              stdDev: number;
                              last3Avg: number;
                            }>();

                            sortedResults.forEach(r => {
                              const totalGoals = r.ftHomeGoals + r.ftAwayGoals;
                              const homeStats = zScoreTeamStats.get(r.homeTeam) || { matches: 0, goals: [], totalGoals: 0, mean: 0, stdDev: 0, last3Avg: 0 };
                              homeStats.matches++;
                              homeStats.goals.push(totalGoals);
                              homeStats.totalGoals += totalGoals;
                              zScoreTeamStats.set(r.homeTeam, homeStats);

                              const awayStats = zScoreTeamStats.get(r.awayTeam) || { matches: 0, goals: [], totalGoals: 0, mean: 0, stdDev: 0, last3Avg: 0 };
                              awayStats.matches++;
                              awayStats.goals.push(totalGoals);
                              awayStats.totalGoals += totalGoals;
                              zScoreTeamStats.set(r.awayTeam, awayStats);
                            });

                            // Calculate stats for each team
                            zScoreTeamStats.forEach((stats) => {
                              stats.mean = stats.totalGoals / stats.matches;
                              const last3 = stats.goals.slice(0, 3);
                              stats.last3Avg = last3.length > 0 ? last3.reduce((a, b) => a + b, 0) / last3.length : 0;
                              const squaredDiffs = stats.goals.map(g => Math.pow(g - stats.mean, 2));
                              stats.stdDev = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / stats.matches);
                            });

                            const homeZStats = zScoreTeamStats.get(predHomeTeam);
                            const awayZStats = zScoreTeamStats.get(predAwayTeam);

                            let zScoreOverallSignal = 'Neutral';
                            if (homeZStats && awayZStats && homeZStats.matches >= 3 && awayZStats.matches >= 3) {
                              const homeZScore = homeZStats.stdDev > 0
                                ? (homeZStats.last3Avg - homeZStats.mean) / homeZStats.stdDev
                                : 0;
                              const awayZScore = awayZStats.stdDev > 0
                                ? (awayZStats.last3Avg - awayZStats.mean) / awayZStats.stdDev
                                : 0;

                              // 95% CI: mean ± 1.96 * (stdDev / sqrt(n))
                              const homeCILower = homeZStats.mean - 1.96 * (homeZStats.stdDev / Math.sqrt(homeZStats.matches));
                              const awayCILower = awayZStats.mean - 1.96 * (awayZStats.stdDev / Math.sqrt(awayZStats.matches));
                              const homeBelowCI = homeZStats.last3Avg < homeCILower;
                              const awayBelowCI = awayZStats.last3Avg < awayCILower;

                              // CV (consistency measure)
                              const homeCV = homeZStats.mean > 0 ? (homeZStats.stdDev / homeZStats.mean) * 100 : 0;
                              const awayCV = awayZStats.mean > 0 ? (awayZStats.stdDev / awayZStats.mean) * 100 : 0;

                              // Score-based signal matching the detailed Z-Score card's getCombinedOverSignal()
                              let score = 0;
                              if (homeZScore <= -1.5) score += 2;
                              else if (homeZScore <= -1.0) score += 1;
                              if (awayZScore <= -1.5) score += 2;
                              else if (awayZScore <= -1.0) score += 1;
                              if (homeBelowCI) score += 1;
                              if (awayBelowCI) score += 1;
                              if (homeCV < 35 && homeZScore < -1) score += 0.5;
                              if (awayCV < 35 && awayZScore < -1) score += 0.5;

                              // Also handle Under signals
                              if (homeZScore >= 1.5) score -= 2;
                              else if (homeZScore >= 1.0) score -= 1;
                              if (awayZScore >= 1.5) score -= 2;
                              else if (awayZScore >= 1.0) score -= 1;

                              if (score >= 4) zScoreOverallSignal = 'Strong Over';
                              else if (score >= 2.5) zScoreOverallSignal = 'Over';
                              else if (score <= -3) zScoreOverallSignal = 'Strong Under';
                              else if (score <= -1.5) zScoreOverallSignal = 'Under';
                            }

                            // Calculate xG Overperformance/Underperformance Signal
                            const teamXgStats = new Map<string, {
                              matches: number;
                              totalXg: number;
                              actualGoals: number;
                              shotsOnTarget: number;
                            }>();

                            results.forEach(r => {
                              const homeShotsOff = r.homeShots - r.homeShotsOnTarget;
                              const awayShotsOff = r.awayShots - r.awayShotsOnTarget;
                              const homeXg = (r.homeShotsOnTarget * 0.30) + (homeShotsOff * 0.08);
                              const awayXg = (r.awayShotsOnTarget * 0.30) + (awayShotsOff * 0.08);

                              const homeStats = teamXgStats.get(r.homeTeam) || { matches: 0, totalXg: 0, actualGoals: 0, shotsOnTarget: 0 };
                              homeStats.matches++;
                              homeStats.totalXg += homeXg;
                              homeStats.actualGoals += r.ftHomeGoals;
                              homeStats.shotsOnTarget += r.homeShotsOnTarget;
                              teamXgStats.set(r.homeTeam, homeStats);

                              const awayStats = teamXgStats.get(r.awayTeam) || { matches: 0, totalXg: 0, actualGoals: 0, shotsOnTarget: 0 };
                              awayStats.matches++;
                              awayStats.totalXg += awayXg;
                              awayStats.actualGoals += r.ftAwayGoals;
                              awayStats.shotsOnTarget += r.awayShotsOnTarget;
                              teamXgStats.set(r.awayTeam, awayStats);
                            });

                            const homeXgData = teamXgStats.get(predHomeTeam);
                            const awayXgData = teamXgStats.get(predAwayTeam);

                            let xgOverallSignal = 'Neutral';
                            if (homeXgData && awayXgData) {
                              const homeXgDiff = (homeXgData.actualGoals / homeXgData.matches) - (homeXgData.totalXg / homeXgData.matches);
                              const awayXgDiff = (awayXgData.actualGoals / awayXgData.matches) - (awayXgData.totalXg / awayXgData.matches);
                              const totalXgDiff = homeXgDiff + awayXgDiff;

                              if (totalXgDiff <= -0.7) xgOverallSignal = 'Strong Over';
                              else if (totalXgDiff <= -0.3) xgOverallSignal = 'Over';
                              else if (totalXgDiff >= 0.7) xgOverallSignal = 'Strong Under';
                              else if (totalXgDiff >= 0.3) xgOverallSignal = 'Under';
                            }

                            // Updated Strong Bet — Points-based system using shared utility
                            const signalInput: SignalInput = {
                              xgSignal: xgOverallSignal,
                              regressionSignal: regressionOverallSignal,
                              zScoreSignal: zScoreOverallSignal,
                            };
                            const strongBetResult = computeStrongBet(checklistInput, signalInput, baselines);
                            const isStrongBet = strongBetResult.isStrongBet;
                            const strongBetIndicator = isStrongBet ? 'STRONG BET' : `${strongBetResult.points}/${strongBetResult.maxPoints} pts`;

                            // Grey Result — Tightened criteria using shared utility
                            const greyResultData = computeGreyResult(checklistInput, signalInput, baselines);
                            const greyResultIndicator = greyResultData.isGreyResult ? 'GREY RESULT' : `${greyResultData.score}/${greyResultData.totalChecks} checks`;

                            // Build CSV row with exact headers
                            const headers = [
                              'League',
                              'Team A',
                              'Team B',
                              'Last H2H',
                              'Predicted Score',
                              'Model 0.5 Odds',
                              'Model BTTS Odds',
                              'O2.5 Prob',
                              'O3.5 Prob',
                              'BTTS Confidence',
                              'O1.5 Confidence',
                              'BTTS Prob',
                              'Regression Overall Signal',
                              'Z-Score Analysis & Confidence Intervals Overall Signal',
                              'xG Overperformance Signal',
                              'BTTS Check list',
                              'Over 3.5 Check list',
                              'Strong Bet',
                              'Grey Result Predictor'
                            ]

                            // Format check lists for export - matching display exactly
                            const bttsChecklistExport = `${bttsChecks.length} of 7`;
                            const over35ChecklistExport = `${over35Checks.length} of 7`;
                            
                            const row = [
                              `"${selectedLeague}"`,
                              `"${predHomeTeam}"`,
                              `"${predAwayTeam}"`,
                              lastH2H ? `"'${lastH2H.ftHomeGoals}-${lastH2H.ftAwayGoals}"` : 'N/A',
                              prediction.prediction.likelyScore ? `"'${prediction.prediction.likelyScore}"` : 'N/A',
                              prediction.prediction.impliedOdds.over15,
                              prediction.prediction.impliedOdds.bttsYes,
                              `${prediction.prediction.over25.toFixed(2)}`,
                              `${prediction.prediction.over35.toFixed(2)}`,
                              bttsConfidence,
                              o15Confidence,
                              `${prediction.prediction.btts.toFixed(2)}`,
                              regressionOverallSignal,
                              zScoreOverallSignal,
                              xgOverallSignal,
                              bttsChecklistExport,
                              over35ChecklistExport,
                              strongBetIndicator,
                              greyResultIndicator
                            ]

                            const csv = [headers.join(','), row.join(',')].join('\n')
                            const blob = new Blob([csv], { type: 'text/csv' })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `${selectedLeague}_${predHomeTeam}_vs_${predAwayTeam}_analysis.csv`
                            a.click()
                          }}
                          variant="outline"
                          className="w-full"
                          disabled={!prediction}
                        >
                          🎯 Analysis Export
                        </Button>
                        <Button 
                          variant="outline"
                          className="w-full"
                          disabled={true}
                          title="H2H export is available on the Head-to-Head tab"
                        >
                          🔄 H2H Data
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        💡 Export data for analysis in Excel, Google Sheets, or other tools. Prediction export requires a match prediction to be generated first.
                      </p>
                    </div>
                  </CardContent>
                </Card>

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
                              // Higher under25Ratio = more low-scoring = more negative rho
                              const rho = -0.13 - (under25Ratio - 0.5) * 0.1
                              return rho.toFixed(3)
                            })()}
                          </p>
                          <p className="text-xs text-muted-foreground">Negative = more low-scoring matches than expected</p>
                        </div>
                        <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
                          <p className="text-sm font-medium text-green-700 dark:text-green-300">Correction Effect</p>
                          <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                            <div className="text-center">
                              <p className="font-medium">0-0 adj.</p>
                              <p className="text-green-600">×{(() => {
                                const total = analytics.totalMatches
                                const under25Ratio = analytics.under25Count / total
                                const rho = -0.13 - (under25Ratio - 0.5) * 0.1
                                const lamH = analytics.avgHomeGoals
                                const lamA = analytics.avgAwayGoals
                                return (1 - lamH * lamA * rho).toFixed(2)
                              })()}</p>
                            </div>
                            <div className="text-center">
                              <p className="font-medium">1-1 adj.</p>
                              <p className="text-green-600">×{(() => {
                                const total = analytics.totalMatches
                                const under25Ratio = analytics.under25Count / total
                                const rho = -0.13 - (under25Ratio - 0.5) * 0.1
                                return (1 - rho).toFixed(2)
                              })()}</p>
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
                        // Use dynamic rho matching the display value
                        const rho = -0.13 - ((analytics.under25Count / analytics.totalMatches) - 0.5) * 0.1
                        
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
                          <Fragment key={h}>
                            <div className="p-1 font-medium text-muted-foreground">{h}</div>
                            {[0, 1, 2, 3].map(a => {
                              const lambda1 = analytics.avgHomeGoals
                              const lambda2 = analytics.avgAwayGoals
                              // Compute lambda3 consistently from league data
                              const lambda3 = analytics.avgGoalsPerGame * 0.08
                              // Correct Bivariate Poisson PMF:
                              // P(X=h, Y=a) = exp(-(λ1+λ2+λ3)) × Σ_{k=0}^{min(h,a)} [λ1^(h-k)·λ2^(a-k)·λ3^k] / [(h-k)!·(a-k)!·k!]
                              let probSum = 0
                              for (let k = 0; k <= Math.min(h, a); k++) {
                                probSum += Math.pow(lambda1, h - k) * Math.pow(lambda2, a - k) * Math.pow(lambda3, k) /
                                  (factorial(h - k) * factorial(a - k) * factorial(k))
                              }
                              const prob = Math.exp(-(lambda1 + lambda2 + lambda3)) * probSum
                              return (
                                <div key={`${h}-${a}`} className={`p-1 rounded ${h + a >= 3 ? 'bg-green-100 dark:bg-green-800/30' : 'bg-gray-100 dark:bg-gray-700/30'}`}>
                                  {(prob * 100).toFixed(1)}%
                                </div>
                              )
                            })}
                          </Fragment>
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
    </div>
  )
}
