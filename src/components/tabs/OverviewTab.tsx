'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { ArrowUpDown, Search, Trophy, Goal, TrendingUp, Sparkles, BarChart3, DollarSign, Target, Calendar, AlertTriangle } from 'lucide-react'
import type { OverviewTabProps } from './types'
import { COLORS, PIE_COLORS, SEASON_NAMES } from '@/lib/constants'

export default function OverviewTab({
  results,
  analytics,
  loading,
  error,
  searchTerm,
  setSearchTerm,
  sortConfig,
  handleSort,
  displayLimit,
  setDisplayLimit,
  filteredResults,
  selectedLeagueName,
  selectedSeasonName,
  isAllSeasons,
  resultDistributionData,
  htFtTransitionsData,
  overUnderData,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
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

                {/* Entertaining Teams - Good Attack + Weak Defense */}
                {(() => {
                  // Calculate team stats
                  const teamStats = new Map<string, { 
                    scored: number; 
                    conceded: number; 
                    matches: number;
                    homeScored: number;
                    homeConceded: number;
                    homeMatches: number;
                    awayScored: number;
                    awayConceded: number;
                    awayMatches: number;
                  }>();
                  
                  results.forEach(r => {
                    // Home team stats
                    const homeStats = teamStats.get(r.homeTeam) || { 
                      scored: 0, conceded: 0, matches: 0,
                      homeScored: 0, homeConceded: 0, homeMatches: 0,
                      awayScored: 0, awayConceded: 0, awayMatches: 0
                    };
                    homeStats.scored += r.ftHomeGoals;
                    homeStats.conceded += r.ftAwayGoals;
                    homeStats.matches++;
                    homeStats.homeScored += r.ftHomeGoals;
                    homeStats.homeConceded += r.ftAwayGoals;
                    homeStats.homeMatches++;
                    teamStats.set(r.homeTeam, homeStats);
                    
                    // Away team stats
                    const awayStats = teamStats.get(r.awayTeam) || { 
                      scored: 0, conceded: 0, matches: 0,
                      homeScored: 0, homeConceded: 0, homeMatches: 0,
                      awayScored: 0, awayConceded: 0, awayMatches: 0
                    };
                    awayStats.scored += r.ftAwayGoals;
                    awayStats.conceded += r.ftHomeGoals;
                    awayStats.matches++;
                    awayStats.awayScored += r.ftAwayGoals;
                    awayStats.awayConceded += r.ftHomeGoals;
                    awayStats.awayMatches++;
                    teamStats.set(r.awayTeam, awayStats);
                  });
                  
                  // Calculate averages and identify entertaining teams
                  const teamArray = Array.from(teamStats.entries()).map(([name, stats]) => ({
                    name,
                    avgScored: stats.scored / stats.matches,
                    avgConceded: stats.conceded / stats.matches,
                    avgGoalsPerGame: (stats.scored + stats.conceded) / stats.matches,
                    matches: stats.matches,
                    homeAvgScored: stats.homeMatches > 0 ? stats.homeScored / stats.homeMatches : 0,
                    homeAvgConceded: stats.homeMatches > 0 ? stats.homeConceded / stats.homeMatches : 0,
                    awayAvgScored: stats.awayMatches > 0 ? stats.awayScored / stats.awayMatches : 0,
                    awayAvgConceded: stats.awayMatches > 0 ? stats.awayConceded / stats.awayMatches : 0,
                  }));
                  
                  // League averages
                  const leagueAvgScored = analytics.avgGoalsPerGame / 2;
                  const leagueAvgConceded = analytics.avgGoalsPerGame / 2;
                  
                  // Entertaining teams: above avg attack AND above avg conceded
                  // Lowered threshold to 1.0 (league average) to include more teams
                  const entertainingTeams = teamArray
                    .filter(t => t.matches >= 3) // At least 3 matches
                    .filter(t => t.avgScored >= leagueAvgScored && t.avgConceded >= leagueAvgConceded)
                    .sort((a, b) => b.avgGoalsPerGame - a.avgGoalsPerGame)
                    .slice(0, 6);
                  
                  if (entertainingTeams.length === 0) return null;
                  
                  return (
                    <Card className="shadow-md border-2 border-pink-300 bg-gradient-to-r from-pink-50 via-rose-50 to-orange-50 dark:from-pink-900/20 dark:via-rose-900/20 dark:to-orange-900/20">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-pink-600" />
                          🎭 Entertaining Teams
                        </CardTitle>
                        <CardDescription>
                          Teams with strong attack AND weak defense - expect high-scoring matches!
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-pink-100/50 to-orange-100/50 dark:from-pink-800/20 dark:to-orange-800/20">
                          <p className="text-sm text-muted-foreground">
                            These teams score <span className="font-semibold text-green-600">at or above average ({leagueAvgScored.toFixed(2)}+ goals/game)</span> AND concede <span className="font-semibold text-red-600">at or above average ({leagueAvgConceded.toFixed(2)}+ goals/game)</span>. Perfect for BTTS and Over 2.5 bets!
                          </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {entertainingTeams.map((team, idx) => (
                            <div 
                              key={team.name}
                              className={`p-4 rounded-xl border-2 ${
                                idx === 0 
                                  ? 'bg-gradient-to-br from-yellow-100 to-amber-100 border-yellow-400 dark:from-yellow-800/30 dark:to-amber-800/30' 
                                  : 'bg-white/50 dark:bg-gray-800/50 border-pink-200 dark:border-pink-700'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-3">
                                {idx === 0 && <span className="text-xl">👑</span>}
                                {idx === 1 && <span className="text-xl">🥈</span>}
                                {idx === 2 && <span className="text-xl">🥉</span>}
                                <h4 className="font-bold text-lg truncate">{team.name}</h4>
                                <Badge variant="outline" className="ml-auto text-xs">{team.matches} games</Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="text-center p-2 rounded-lg bg-green-100/50 dark:bg-green-800/30">
                                  <p className="text-xs text-muted-foreground">⚔️ Attack</p>
                                  <p className="text-xl font-bold text-green-600">{team.avgScored.toFixed(2)}</p>
                                  <p className="text-xs text-muted-foreground">goals/game</p>
                                </div>
                                <div className="text-center p-2 rounded-lg bg-red-100/50 dark:bg-red-800/30">
                                  <p className="text-xs text-muted-foreground">🛡️ Defense</p>
                                  <p className="text-xl font-bold text-red-600">{team.avgConceded.toFixed(2)}</p>
                                  <p className="text-xs text-muted-foreground">conceded/game</p>
                                </div>
                              </div>
                              <div className="mt-3 pt-3 border-t border-pink-200 dark:border-pink-700">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-muted-foreground">📊 Avg match goals:</span>
                                  <span className="font-bold text-lg text-pink-600">{team.avgGoalsPerGame.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center mt-1 text-xs">
                                  <span className="text-muted-foreground">Home: {team.homeAvgScored.toFixed(1)} scored / {team.homeAvgConceded.toFixed(1)} conceded</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-muted-foreground">Away: {team.awayAvgScored.toFixed(1)} scored / {team.awayAvgConceded.toFixed(1)} conceded</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-800/20 dark:to-pink-800/20">
                          <p className="text-sm text-center">
                            <span className="font-semibold text-purple-700 dark:text-purple-300">💡 Tip:</span> When these teams play each other or against other high-scoring teams, consider <span className="font-bold">BTTS Yes</span> and <span className="font-bold">Over 2.5 Goals</span>
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Best O2.5 and BTTS Teams - Side by Side */}
                {(() => {
                  // Calculate team O2.5 and BTTS rates
                  const teamGoalStats = new Map<string, { 
                    matches: number;
                    over25Count: number;
                    bttsCount: number;
                  }>();
                  
                  results.forEach(r => {
                    const totalGoals = r.ftHomeGoals + r.ftAwayGoals;
                    const isOver25 = totalGoals > 2.5;
                    const isBTTS = r.ftHomeGoals > 0 && r.ftAwayGoals > 0;
                    
                    // Home team
                    const homeStats = teamGoalStats.get(r.homeTeam) || { matches: 0, over25Count: 0, bttsCount: 0 };
                    homeStats.matches++;
                    if (isOver25) homeStats.over25Count++;
                    if (isBTTS) homeStats.bttsCount++;
                    teamGoalStats.set(r.homeTeam, homeStats);
                    
                    // Away team
                    const awayStats = teamGoalStats.get(r.awayTeam) || { matches: 0, over25Count: 0, bttsCount: 0 };
                    awayStats.matches++;
                    if (isOver25) awayStats.over25Count++;
                    if (isBTTS) awayStats.bttsCount++;
                    teamGoalStats.set(r.awayTeam, awayStats);
                  });
                  
                  // Convert to arrays and calculate percentages
                  const teamArray = Array.from(teamGoalStats.entries())
                    .filter(([_, stats]) => stats.matches >= 3) // At least 3 matches
                    .map(([name, stats]) => ({
                      name,
                      matches: stats.matches,
                      over25Rate: (stats.over25Count / stats.matches) * 100,
                      bttsRate: (stats.bttsCount / stats.matches) * 100,
                    }));
                  
                  // Get top 5 O2.5 teams
                  const topOver25Teams = [...teamArray]
                    .sort((a, b) => b.over25Rate - a.over25Rate)
                    .slice(0, 5);
                  
                  // Get top 5 BTTS teams
                  const topBTTSTeams = [...teamArray]
                    .sort((a, b) => b.bttsRate - a.bttsRate)
                    .slice(0, 5);
                  
                  if (topOver25Teams.length === 0 && topBTTSTeams.length === 0) return null;
                  
                  return (
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Best O2.5 Teams */}
                      <Card className="shadow-md border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Goal className="w-5 h-5 text-emerald-600" />
                            🔥 Best O2.5 Teams
                          </CardTitle>
                          <CardDescription>
                            Teams with highest % of matches with 3+ total goals
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {topOver25Teams.map((team, idx) => (
                              <div 
                                key={team.name}
                                className={`flex items-center justify-between p-3 rounded-lg ${
                                  idx === 0 
                                    ? 'bg-gradient-to-r from-yellow-100 to-amber-100 border border-yellow-300 dark:from-yellow-800/30 dark:to-amber-800/30' 
                                    : 'bg-white/50 dark:bg-gray-800/50'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {idx === 0 && <span className="text-lg">🥇</span>}
                                  {idx === 1 && <span className="text-lg">🥈</span>}
                                  {idx === 2 && <span className="text-lg">🥉</span>}
                                  {idx > 2 && <span className="w-6 text-center text-sm text-muted-foreground">{idx + 1}.</span>}
                                  <span className="font-medium truncate max-w-[120px]">{team.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-emerald-500 rounded-full" 
                                      style={{ width: `${team.over25Rate}%` }}
                                    />
                                  </div>
                                  <span className="font-bold text-emerald-600 w-14 text-right">{team.over25Rate.toFixed(0)}%</span>
                                  <span className="text-xs text-muted-foreground w-12 text-right">({team.matches}g)</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 p-2 rounded bg-emerald-100/50 dark:bg-emerald-800/20 text-center">
                            <p className="text-xs text-muted-foreground">
                              💡 These teams are involved in high-scoring matches
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Best BTTS Teams */}
                      <Card className="shadow-md border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Target className="w-5 h-5 text-purple-600" />
                            ⚽ Best BTTS Teams
                          </CardTitle>
                          <CardDescription>
                            Teams with highest % of matches where both teams scored
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {topBTTSTeams.map((team, idx) => (
                              <div 
                                key={team.name}
                                className={`flex items-center justify-between p-3 rounded-lg ${
                                  idx === 0 
                                    ? 'bg-gradient-to-r from-yellow-100 to-amber-100 border border-yellow-300 dark:from-yellow-800/30 dark:to-amber-800/30' 
                                    : 'bg-white/50 dark:bg-gray-800/50'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {idx === 0 && <span className="text-lg">🥇</span>}
                                  {idx === 1 && <span className="text-lg">🥈</span>}
                                  {idx === 2 && <span className="text-lg">🥉</span>}
                                  {idx > 2 && <span className="w-6 text-center text-sm text-muted-foreground">{idx + 1}.</span>}
                                  <span className="font-medium truncate max-w-[120px]">{team.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-purple-500 rounded-full" 
                                      style={{ width: `${team.bttsRate}%` }}
                                    />
                                  </div>
                                  <span className="font-bold text-purple-600 w-14 text-right">{team.bttsRate.toFixed(0)}%</span>
                                  <span className="text-xs text-muted-foreground w-12 text-right">({team.matches}g)</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 p-2 rounded bg-purple-100/50 dark:bg-purple-800/20 text-center">
                            <p className="text-xs text-muted-foreground">
                              💡 Both teams score when these teams play
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })()}

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
                          <TableHead className="text-center">Odds H</TableHead>
                          <TableHead className="text-center">Odds D</TableHead>
                          <TableHead className="text-center">Odds A</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredResults.length === 0 ? (
                          <TableRow><TableCell colSpan={isAllSeasons ? 10 : 9} className="text-center py-8 text-muted-foreground">No matches found. Try adjusting your filters.</TableCell></TableRow>
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
                              <TableCell className="text-center">
                                {match.oddsB365Home ? (
                                  <span className={`text-sm font-mono ${match.ftResult === 'H' ? 'text-green-600 font-bold' : 'text-muted-foreground'}`}>
                                    {match.oddsB365Home.toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {match.oddsB365Draw ? (
                                  <span className={`text-sm font-mono ${match.ftResult === 'D' ? 'text-amber-600 font-bold' : 'text-muted-foreground'}`}>
                                    {match.oddsB365Draw.toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {match.oddsB365Away ? (
                                  <span className={`text-sm font-mono ${match.ftResult === 'A' ? 'text-blue-600 font-bold' : 'text-muted-foreground'}`}>
                                    {match.oddsB365Away.toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
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
    </div>
  )
}
