'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Users, Target, TrendingUp, BarChart3, DollarSign, Zap, AlertTriangle } from 'lucide-react'
import type { H2HMatch, H2HAnalytics as H2HAnalyticsType, TeamGoalForm, MatchResult } from '@/lib/types'
import { COLORS, SEASON_NAMES } from '@/lib/constants'
import { parseDateSafe } from '@/lib/utils'

interface H2HTabProps {
  teams: string[]
  teamsPerSeason: Record<string, number>
  team1: string
  team2: string
  h2hMatches: H2HMatch[]
  h2hAnalytics: H2HAnalyticsType | null
  h2hLoading: boolean
  h2hError: string | null
  onTeam1Change: (team: string) => void
  onTeam2Change: (team: string) => void
  onFetchH2H: () => void
  // Derived from page state
  results: MatchResult[]
  teamForm: Map<string, { form: ('W' | 'D' | 'L')[]; inForm: boolean; points: number }>
  lastH2HResults: { score00: { teams: string; score: string; date: string; season?: string }[]; score10: { teams: string; score: string; date: string; winner: string; season?: string }[]; score20: { teams: string; score: string; date: string; winner: string; season?: string }[] }
  isAllSeasons: boolean
  // H2H tracker filter (local)
  h2hTrackerSearch: string
  setH2hTrackerSearch: (value: string) => void
}

export function H2HTab({
  teams,
  teamsPerSeason,
  team1,
  team2,
  h2hMatches,
  h2hAnalytics,
  h2hLoading,
  h2hError,
  onTeam1Change,
  onTeam2Change,
  onFetchH2H,
  results,
  teamForm,
  lastH2HResults,
  isAllSeasons,
  h2hTrackerSearch,
  setH2hTrackerSearch,
}: H2HTabProps) {
  // Filtered H2H tracker results
  const filteredH2HResults = useMemo(() => {
    if (!h2hTrackerSearch.trim()) return lastH2HResults
    const searchLower = h2hTrackerSearch.toLowerCase()
    return {
      score00: lastH2HResults.score00.filter(m => m.teams.toLowerCase().includes(searchLower)),
      score10: lastH2HResults.score10.filter(m => m.teams.toLowerCase().includes(searchLower)),
      score20: lastH2HResults.score20.filter(m => m.teams.toLowerCase().includes(searchLower))
    }
  }, [lastH2HResults, h2hTrackerSearch])

  return (
    <div className="space-y-6">
      {/* Last H2H Scoreline Tracker */}
      <Card className="shadow-md border-2 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Last H2H Scoreline Tracker
          </CardTitle>
          <CardDescription>Team pairs grouped by their most recent H2H result</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filter Input */}
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Filter by team name..."
                value={h2hTrackerSearch}
                onChange={(e) => setH2hTrackerSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {/* 0-0 Section */}
            <div className="p-4 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 border border-gray-300 dark:border-gray-600">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-gray-700 dark:text-gray-200">0-0</h4>
                <Badge className="bg-gray-500 text-white">{filteredH2HResults.score00.length}</Badge>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredH2HResults.score00.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{h2hTrackerSearch ? 'No matches found' : 'No 0-0 draws'}</p>
                ) : (
                  filteredH2HResults.score00.map((match, i) => (
                    <div key={i} className="p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium truncate">{match.teams}</p>
                      <p className="text-xs text-muted-foreground">{match.date}{match.season && ` (${SEASON_NAMES[match.season] || match.season})`}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 1-0 / 0-1 Section */}
            <div className="p-4 rounded-lg bg-gradient-to-br from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 border border-yellow-300 dark:border-yellow-700">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-yellow-700 dark:text-yellow-300">1-0 / 0-1</h4>
                <Badge className="bg-yellow-500 text-white">{filteredH2HResults.score10.length}</Badge>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredH2HResults.score10.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{h2hTrackerSearch ? 'No matches found' : 'No 1-0 results'}</p>
                ) : (
                  filteredH2HResults.score10.map((match, i) => (
                    <div key={i} className="p-2 bg-white dark:bg-gray-900 rounded border border-yellow-200 dark:border-yellow-800">
                      <p className="text-sm font-medium truncate">{match.teams}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">{match.date}{match.season && ` (${SEASON_NAMES[match.season] || match.season})`}</p>
                        <span className="text-xs font-medium text-yellow-600">{match.score}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 2-0 / 0-2 Section */}
            <div className="p-4 rounded-lg bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-300 dark:border-green-700">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-green-700 dark:text-green-300">2-0 / 0-2</h4>
                <Badge className="bg-green-500 text-white">{filteredH2HResults.score20.length}</Badge>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredH2HResults.score20.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{h2hTrackerSearch ? 'No matches found' : 'No 2-0 results'}</p>
                ) : (
                  filteredH2HResults.score20.map((match, i) => (
                    <div key={i} className="p-2 bg-white dark:bg-gray-900 rounded border border-green-200 dark:border-green-800">
                      <p className="text-sm font-medium truncate">{match.teams}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">{match.date}{match.season && ` (${SEASON_NAMES[match.season] || match.season})`}</p>
                        <span className="text-xs font-medium text-green-600">{match.score}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Shows the most recent H2H result for each unique team pair in the selected league/season
          </p>
        </CardContent>
      </Card>

      {/* Team Selectors */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            Head-to-Head Analysis
          </CardTitle>
          <CardDescription>
            Select two teams to compare their historical matchups
            {teams.length > 0 && <span className="ml-2 text-green-600">• {teams.length} teams available</span>}
            {isAllSeasons && Object.keys(teamsPerSeason).length > 0 && (
              <span className="ml-2 text-xs text-gray-500">
                (Seasons: {Object.entries(teamsPerSeason).filter(([_, v]) => v > 0).map(([k, v]) => `${SEASON_NAMES[k] || k}: ${v}`).join(', ')})
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Team 1</label>
              <Select value={team1} onValueChange={onTeam1Change}>
                <SelectTrigger>
                  <SelectValue placeholder="Select first team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map(team => (
                    <SelectItem key={team} value={team}>{team}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {team1 && teamForm.has(team1) && (
                <div className="mt-2 flex items-center gap-2">
                  {teamForm.get(team1)?.inForm ? (
                    <Badge className="bg-green-500 text-white">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      In Form
                    </Badge>
                  ) : (
                    <Badge className="bg-red-500 text-white">
                      <TrendingUp className="w-3 h-3 mr-1 rotate-180" />
                      Not In Form
                    </Badge>
                  )}
                  <div className="flex gap-1">
                    {teamForm.get(team1)?.form.map((r, i) => (
                      <span
                        key={i}
                        className={`w-5 h-5 rounded text-xs flex items-center justify-center text-white font-bold ${
                          r === 'W' ? 'bg-green-500' : r === 'D' ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">({teamForm.get(team1)?.points} pts)</span>
                </div>
              )}
            </div>

            <div className="text-2xl font-bold text-muted-foreground pb-2">VS</div>

            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Team 2</label>
              <Select value={team2} onValueChange={onTeam2Change}>
                <SelectTrigger>
                  <SelectValue placeholder="Select second team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map(team => (
                    <SelectItem key={team} value={team}>{team}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {team2 && teamForm.has(team2) && (
                <div className="mt-2 flex items-center gap-2">
                  {teamForm.get(team2)?.inForm ? (
                    <Badge className="bg-green-500 text-white">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      In Form
                    </Badge>
                  ) : (
                    <Badge className="bg-red-500 text-white">
                      <TrendingUp className="w-3 h-3 mr-1 rotate-180" />
                      Not In Form
                    </Badge>
                  )}
                  <div className="flex gap-1">
                    {teamForm.get(team2)?.form.map((r, i) => (
                      <span
                        key={i}
                        className={`w-5 h-5 rounded text-xs flex items-center justify-center text-white font-bold ${
                          r === 'W' ? 'bg-green-500' : r === 'D' ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">({teamForm.get(team2)?.points} pts)</span>
                </div>
              )}
            </div>

            <Button onClick={onFetchH2H} disabled={h2hLoading || !team1 || !team2}>
              <Search className="w-4 h-4 mr-2" />
              Analyze H2H
            </Button>
          </div>

          {h2hError && <p className="text-red-500 mt-4">{h2hError}</p>}
        </CardContent>
      </Card>

      {h2hLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Card key={i}><CardContent className="py-6"><Skeleton className="h-16 w-full" /></CardContent></Card>)}
        </div>
      ) : h2hAnalytics && (
        <>
          {/* H2H BTTS Stats - Highlighted */}
          <Card className="shadow-md border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-600" />
                BTTS (Both Teams To Score) Statistics
              </CardTitle>
              <CardDescription>Key scoring patterns in H2H matches</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-4 rounded-lg bg-white/50 dark:bg-gray-800/50">
                  <p className="text-sm text-muted-foreground">BTTS Full Time</p>
                  <p className="text-3xl font-bold text-purple-600">{h2hAnalytics.bttsFullTime.percent}%</p>
                  <p className="text-xs text-muted-foreground">{h2hAnalytics.bttsFullTime.count}/{h2hAnalytics.totalMatches} matches</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-white/50 dark:bg-gray-800/50">
                  <p className="text-sm text-muted-foreground">BTTS 1st Half</p>
                  <p className="text-3xl font-bold text-blue-600">{h2hAnalytics.bttsFirstHalf.percent}%</p>
                  <p className="text-xs text-muted-foreground">{h2hAnalytics.bttsFirstHalf.count}/{h2hAnalytics.totalMatches} matches</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-white/50 dark:bg-gray-800/50">
                  <p className="text-sm text-muted-foreground">BTTS 2nd Half</p>
                  <p className="text-3xl font-bold text-green-600">{h2hAnalytics.bttsSecondHalf.percent}%</p>
                  <p className="text-xs text-muted-foreground">{h2hAnalytics.bttsSecondHalf.count}/{h2hAnalytics.totalMatches} matches</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-800/50 dark:to-pink-800/50 ring-2 ring-purple-400">
                  <p className="text-sm text-purple-700 dark:text-purple-300 font-medium">BTTS Both Halves</p>
                  <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">{h2hAnalytics.bttsBothHalves.percent}%</p>
                  <p className="text-xs text-purple-600 dark:text-purple-400">{h2hAnalytics.bttsBothHalves.count}/{h2hAnalytics.totalMatches} matches</p>
                </div>
              </div>

              {/* BTTS Home Distribution */}
              {h2hAnalytics.bttsHomeDistribution && (
                <div className="mt-4 pt-4 border-t border-purple-200 dark:border-purple-700">
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    When BTTS occurs, who is the HOME team?
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className={`p-3 rounded-lg text-center ${
                      h2hAnalytics.bttsHomeDistribution.team1Home.percent > h2hAnalytics.bttsHomeDistribution.team2Home.percent
                        ? 'bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-800/50 dark:to-emerald-800/50 ring-2 ring-green-400'
                        : 'bg-white/50 dark:bg-gray-800/50'
                    }`}>
                      <p className="text-sm text-muted-foreground">{team1} at HOME</p>
                      <p className="text-2xl font-bold text-green-600">{h2hAnalytics.bttsHomeDistribution.team1Home.percent}%</p>
                      <p className="text-xs text-muted-foreground">{h2hAnalytics.bttsHomeDistribution.team1Home.count} BTTS matches</p>
                      {h2hAnalytics.bttsHomeDistribution.team1Home.percent > h2hAnalytics.bttsHomeDistribution.team2Home.percent && (
                        <Badge className="mt-2 bg-green-500 text-white text-xs">More likely</Badge>
                      )}
                    </div>
                    <div className={`p-3 rounded-lg text-center ${
                      h2hAnalytics.bttsHomeDistribution.team2Home.percent > h2hAnalytics.bttsHomeDistribution.team1Home.percent
                        ? 'bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-800/50 dark:to-indigo-800/50 ring-2 ring-blue-400'
                        : 'bg-white/50 dark:bg-gray-800/50'
                    }`}>
                      <p className="text-sm text-muted-foreground">{team2} at HOME</p>
                      <p className="text-2xl font-bold text-blue-600">{h2hAnalytics.bttsHomeDistribution.team2Home.percent}%</p>
                      <p className="text-xs text-muted-foreground">{h2hAnalytics.bttsHomeDistribution.team2Home.count} BTTS matches</p>
                      {h2hAnalytics.bttsHomeDistribution.team2Home.percent > h2hAnalytics.bttsHomeDistribution.team1Home.percent && (
                        <Badge className="mt-2 bg-blue-500 text-white text-xs">More likely</Badge>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* BTTS Timing Distribution */}
              {h2hAnalytics.bttsTimingDistribution && (
                <div className="mt-4 pt-4 border-t border-purple-200 dark:border-purple-700">
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    BTTS Timing Distribution
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-blue-100/50 dark:bg-blue-800/30 text-center">
                      <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">By Halftime</p>
                      <p className="text-xl font-bold text-blue-600">{h2hAnalytics.bttsTimingDistribution.htOnly.percent}%</p>
                      <p className="text-xs text-muted-foreground">{h2hAnalytics.bttsTimingDistribution.htOnly.count} matches</p>
                    </div>
                    <div className="p-3 rounded-lg bg-green-100/50 dark:bg-green-800/30 text-center">
                      <p className="text-xs text-green-700 dark:text-green-300 font-medium">2nd Half Only</p>
                      <p className="text-xl font-bold text-green-600">{h2hAnalytics.bttsTimingDistribution.shOnly.percent}%</p>
                      <p className="text-xs text-muted-foreground">{h2hAnalytics.bttsTimingDistribution.shOnly.count} matches</p>
                    </div>
                    <div className="p-3 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-800/30 dark:to-pink-800/30 text-center ring-2 ring-purple-300">
                      <p className="text-xs text-purple-700 dark:text-purple-300 font-medium">Both Halves</p>
                      <p className="text-xl font-bold text-purple-600">{h2hAnalytics.bttsTimingDistribution.bothHalves.percent}%</p>
                      <p className="text-xs text-muted-foreground">{h2hAnalytics.bttsTimingDistribution.bothHalves.count} matches</p>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-100/50 dark:bg-gray-800/30 text-center">
                      <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">Total FT</p>
                      <p className="text-xl font-bold text-gray-600">{h2hAnalytics.bttsTimingDistribution.ftOnly.percent}%</p>
                      <p className="text-xs text-muted-foreground">{h2hAnalytics.bttsTimingDistribution.ftOnly.count} matches</p>
                    </div>
                  </div>
                  <div className="mt-3 p-2 rounded bg-purple-50 dark:bg-purple-900/20 text-center">
                    <p className="text-xs text-purple-700 dark:text-purple-300">
                      <strong>Insight:</strong> "By Halftime" = BTTS achieved in 1st half | "2nd Half Only" = late BTTS | "Both Halves" = most exciting matches
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* H2H Goal Averages */}
          <Card className="shadow-md border-2 border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-green-600" />
                H2H Goal Averages
              </CardTitle>
              <CardDescription>Goals scored & conceded when these teams faced each other</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Team 1 Stats */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-green-700 dark:text-green-300 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                    {team1}
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-white/50 dark:bg-gray-800/50 text-center">
                      <p className="text-xs text-muted-foreground">At Home</p>
                      <p className="text-lg font-bold text-green-600">
                        {h2hAnalytics.h2hGoalAverages?.team1Home?.scored?.toFixed(2) || '0.00'}
                      </p>
                      <p className="text-xs text-muted-foreground">scored/game</p>
                      <p className="text-sm text-red-500 mt-1">
                        {h2hAnalytics.h2hGoalAverages?.team1Home?.conceded?.toFixed(2) || '0.00'} conceded
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        ({h2hAnalytics.h2hGoalAverages?.team1Home?.matches || 0} games)
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/50 dark:bg-gray-800/50 text-center">
                      <p className="text-xs text-muted-foreground">Away</p>
                      <p className="text-lg font-bold text-blue-600">
                        {h2hAnalytics.h2hGoalAverages?.team1Away?.scored?.toFixed(2) || '0.00'}
                      </p>
                      <p className="text-xs text-muted-foreground">scored/game</p>
                      <p className="text-sm text-red-500 mt-1">
                        {h2hAnalytics.h2hGoalAverages?.team1Away?.conceded?.toFixed(2) || '0.00'} conceded
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        ({h2hAnalytics.h2hGoalAverages?.team1Away?.matches || 0} games)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Team 2 Stats */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                    {team2}
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-white/50 dark:bg-gray-800/50 text-center">
                      <p className="text-xs text-muted-foreground">At Home</p>
                      <p className="text-lg font-bold text-green-600">
                        {h2hAnalytics.h2hGoalAverages?.team2Home?.scored?.toFixed(2) || '0.00'}
                      </p>
                      <p className="text-xs text-muted-foreground">scored/game</p>
                      <p className="text-sm text-red-500 mt-1">
                        {h2hAnalytics.h2hGoalAverages?.team2Home?.conceded?.toFixed(2) || '0.00'} conceded
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        ({h2hAnalytics.h2hGoalAverages?.team2Home?.matches || 0} games)
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/50 dark:bg-gray-800/50 text-center">
                      <p className="text-xs text-muted-foreground">Away</p>
                      <p className="text-lg font-bold text-blue-600">
                        {h2hAnalytics.h2hGoalAverages?.team2Away?.scored?.toFixed(2) || '0.00'}
                      </p>
                      <p className="text-xs text-muted-foreground">scored/game</p>
                      <p className="text-sm text-red-500 mt-1">
                        {h2hAnalytics.h2hGoalAverages?.team2Away?.conceded?.toFixed(2) || '0.00'} conceded
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        ({h2hAnalytics.h2hGoalAverages?.team2Away?.matches || 0} games)
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Overall Averages */}
              <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-700">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Total Goals</p>
                    <p className="text-xl font-bold text-gray-700 dark:text-gray-300">
                      {h2hAnalytics.h2hGoalAverages?.overall?.avgTotalGoals?.toFixed(2) || h2hAnalytics.avgGoalsPerGame}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{team1} Avg</p>
                    <p className="text-xl font-bold text-green-600">
                      {h2hAnalytics.h2hGoalAverages?.overall?.avgTeam1Goals?.toFixed(2) || h2hAnalytics.avgHomeTeamGoals}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{team2} Avg</p>
                    <p className="text-xl font-bold text-blue-600">
                      {h2hAnalytics.h2hGoalAverages?.overall?.avgTeam2Goals?.toFixed(2) || h2hAnalytics.avgAwayTeamGoals}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Team Form (Goals Focus) */}
          <Card className="shadow-md border-2 border-blue-300">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Team Form - Goals (Last 5 Games)
              </CardTitle>
              <CardDescription>Goals scored and conceded in recent matches</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Team 1 Form */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-green-700 dark:text-green-300 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                    {team1}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 rounded bg-gray-50 dark:bg-gray-800">
                      <span className="text-sm">Overall</span>
                      <div className="flex gap-4 text-sm">
                        <span className="text-green-600 font-medium">
                          Scored: {h2hAnalytics.team1Form?.last5Overall?.scored ?? 0}
                        </span>
                        <span className="text-red-500">
                          Conceded: {h2hAnalytics.team1Form?.last5Overall?.conceded ?? 0}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded bg-green-50 dark:bg-green-900/20">
                      <span className="text-sm">At Home</span>
                      <div className="flex gap-4 text-sm">
                        <span className="text-green-600 font-medium">
                          Scored: {h2hAnalytics.team1Form?.last5Home?.scored ?? 0}
                        </span>
                        <span className="text-red-500">
                          Conceded: {h2hAnalytics.team1Form?.last5Home?.conceded ?? 0}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({h2hAnalytics.team1Form?.last5Home?.matches ?? 0} games)
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded bg-blue-50 dark:bg-blue-900/20">
                      <span className="text-sm">Away</span>
                      <div className="flex gap-4 text-sm">
                        <span className="text-green-600 font-medium">
                          Scored: {h2hAnalytics.team1Form?.last5Away?.scored ?? 0}
                        </span>
                        <span className="text-red-500">
                          Conceded: {h2hAnalytics.team1Form?.last5Away?.conceded ?? 0}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({h2hAnalytics.team1Form?.last5Away?.matches ?? 0} games)
                        </span>
                      </div>
                    </div>
                  </div>
                  {h2hAnalytics.team1Form?.games && h2hAnalytics.team1Form.games.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-2">Recent Games:</p>
                      <div className="flex flex-wrap gap-1">
                        {h2hAnalytics.team1Form.games.slice(0, 5).map((game, idx) => (
                          <Badge key={idx} variant="outline" className={`text-xs ${game.venue === 'H' ? 'border-green-400' : 'border-blue-400'}`}>
                            {game.venue === 'H' ? '🏠' : '✈️'} {game.scored}-{game.conceded} vs {game.opponent.slice(0, 8)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Team 2 Form */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                    {team2}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 rounded bg-gray-50 dark:bg-gray-800">
                      <span className="text-sm">Overall</span>
                      <div className="flex gap-4 text-sm">
                        <span className="text-green-600 font-medium">
                          Scored: {h2hAnalytics.team2Form?.last5Overall?.scored ?? 0}
                        </span>
                        <span className="text-red-500">
                          Conceded: {h2hAnalytics.team2Form?.last5Overall?.conceded ?? 0}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded bg-green-50 dark:bg-green-900/20">
                      <span className="text-sm">At Home</span>
                      <div className="flex gap-4 text-sm">
                        <span className="text-green-600 font-medium">
                          Scored: {h2hAnalytics.team2Form?.last5Home?.scored ?? 0}
                        </span>
                        <span className="text-red-500">
                          Conceded: {h2hAnalytics.team2Form?.last5Home?.conceded ?? 0}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({h2hAnalytics.team2Form?.last5Home?.matches ?? 0} games)
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded bg-blue-50 dark:bg-blue-900/20">
                      <span className="text-sm">Away</span>
                      <div className="flex gap-4 text-sm">
                        <span className="text-green-600 font-medium">
                          Scored: {h2hAnalytics.team2Form?.last5Away?.scored ?? 0}
                        </span>
                        <span className="text-red-500">
                          Conceded: {h2hAnalytics.team2Form?.last5Away?.conceded ?? 0}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({h2hAnalytics.team2Form?.last5Away?.matches ?? 0} games)
                        </span>
                      </div>
                    </div>
                  </div>
                  {h2hAnalytics.team2Form?.games && h2hAnalytics.team2Form.games.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-2">Recent Games:</p>
                      <div className="flex flex-wrap gap-1">
                        {h2hAnalytics.team2Form.games.slice(0, 5).map((game, idx) => (
                          <Badge key={idx} variant="outline" className={`text-xs ${game.venue === 'H' ? 'border-green-400' : 'border-blue-400'}`}>
                            {game.venue === 'H' ? '🏠' : '✈️'} {game.scored}-{game.conceded} vs {game.opponent.slice(0, 8)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Goal Timing Patterns */}
          {h2hAnalytics.goalTimingPatterns && (
            <Card className="shadow-md border-2 border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                  Goal Timing Patterns
                </CardTitle>
                <CardDescription>When goals happen in H2H matches - key for live BTTS betting</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-3 rounded-lg bg-white/50 dark:bg-gray-800/50">
                    <p className="text-xs text-muted-foreground">1st Half Goals</p>
                    <p className="text-2xl font-bold text-blue-600">{h2hAnalytics.goalTimingPatterns.firstHalfGoals}</p>
                    <p className="text-xs text-muted-foreground">Avg: {h2hAnalytics.goalTimingPatterns.avgFirstHalfGoals}/game</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white/50 dark:bg-gray-800/50">
                    <p className="text-xs text-muted-foreground">2nd Half Goals</p>
                    <p className="text-2xl font-bold text-green-600">{h2hAnalytics.goalTimingPatterns.secondHalfGoals}</p>
                    <p className="text-xs text-muted-foreground">Avg: {h2hAnalytics.goalTimingPatterns.avgSecondHalfGoals}/game</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-800/50 dark:to-amber-800/50 ring-2 ring-orange-400">
                    <p className="text-xs text-orange-700 dark:text-orange-300 font-medium">2nd Half Rescue</p>
                    <p className="text-2xl font-bold text-orange-600">{h2hAnalytics.goalTimingPatterns.secondHalfRescueRate}%</p>
                    <p className="text-xs text-orange-600">BTTS saved in 2nd half</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white/50 dark:bg-gray-800/50">
                    <p className="text-xs text-muted-foreground">Goal Split</p>
                    <p className="text-lg font-bold">
                      <span className="text-blue-600">{Math.round((h2hAnalytics.goalTimingPatterns.firstHalfGoals / (h2hAnalytics.goalTimingPatterns.firstHalfGoals + h2hAnalytics.goalTimingPatterns.secondHalfGoals)) * 100) || 0}%</span>
                      <span className="text-muted-foreground mx-1">/</span>
                      <span className="text-green-600">{Math.round((h2hAnalytics.goalTimingPatterns.secondHalfGoals / (h2hAnalytics.goalTimingPatterns.firstHalfGoals + h2hAnalytics.goalTimingPatterns.secondHalfGoals)) * 100) || 0}%</span>
                    </p>
                    <p className="text-xs text-muted-foreground">1st / 2nd Half</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                    <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">{team1} Timing</p>
                    <div className="flex justify-between text-sm">
                      <span>1st Half: <strong className="text-blue-600">{h2hAnalytics.goalTimingPatterns.team1FirstHalfGoals}</strong></span>
                      <span>2nd Half: <strong className="text-green-600">{h2hAnalytics.goalTimingPatterns.team1SecondHalfGoals}</strong></span>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">{team2} Timing</p>
                    <div className="flex justify-between text-sm">
                      <span>1st Half: <strong className="text-blue-600">{h2hAnalytics.goalTimingPatterns.team2FirstHalfGoals}</strong></span>
                      <span>2nd Half: <strong className="text-green-600">{h2hAnalytics.goalTimingPatterns.team2SecondHalfGoals}</strong></span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Clean Sheet Analysis */}
          {h2hAnalytics.cleanSheetAnalysis && (
            <Card className="shadow-md border-2 border-red-300 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="w-5 h-5 text-red-600" />
                  Clean Sheet Analysis (H2H)
                </CardTitle>
                <CardDescription>How often each team keeps a clean sheet or fails to score in H2H matches</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-green-700 dark:text-green-300 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-500"></span>
                      {team1}
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-lg bg-green-100/50 dark:bg-green-800/30 text-center">
                        <p className="text-xs text-muted-foreground">Clean Sheets</p>
                        <p className="text-xl font-bold text-green-600">{h2hAnalytics.cleanSheetAnalysis.team1CleanSheetPercent}%</p>
                        <p className="text-xs text-muted-foreground">{h2hAnalytics.cleanSheetAnalysis.team1CleanSheets}/{h2hAnalytics.totalMatches}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-red-100/50 dark:bg-red-800/30 text-center">
                        <p className="text-xs text-muted-foreground">Failed to Score</p>
                        <p className="text-xl font-bold text-red-600">{h2hAnalytics.cleanSheetAnalysis.team1FailedToScorePercent}%</p>
                        <p className="text-xs text-muted-foreground">{h2hAnalytics.cleanSheetAnalysis.team1FailedToScore}/{h2hAnalytics.totalMatches}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                      {team2}
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-lg bg-green-100/50 dark:bg-green-800/30 text-center">
                        <p className="text-xs text-muted-foreground">Clean Sheets</p>
                        <p className="text-xl font-bold text-green-600">{h2hAnalytics.cleanSheetAnalysis.team2CleanSheetPercent}%</p>
                        <p className="text-xs text-muted-foreground">{h2hAnalytics.cleanSheetAnalysis.team2CleanSheets}/{h2hAnalytics.totalMatches}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-red-100/50 dark:bg-red-800/30 text-center">
                        <p className="text-xs text-muted-foreground">Failed to Score</p>
                        <p className="text-xl font-bold text-red-600">{h2hAnalytics.cleanSheetAnalysis.team2FailedToScorePercent}%</p>
                        <p className="text-xs text-muted-foreground">{h2hAnalytics.cleanSheetAnalysis.team2FailedToScore}/{h2hAnalytics.totalMatches}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-red-200 dark:border-red-700 grid grid-cols-2 gap-4 text-center">
                  <div className="p-2 rounded bg-purple-100/50 dark:bg-purple-800/30">
                    <p className="text-xs text-muted-foreground">Both Teams Scored</p>
                    <p className="text-lg font-bold text-purple-600">{h2hAnalytics.cleanSheetAnalysis.bothTeamsScored} matches</p>
                  </div>
                  <div className="p-2 rounded bg-gray-100/50 dark:bg-gray-800/30">
                    <p className="text-xs text-muted-foreground">Neither Scored (0-0)</p>
                    <p className="text-lg font-bold text-gray-600">{h2hAnalytics.cleanSheetAnalysis.neitherTeamScored} matches</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scoreline Distribution */}
          {h2hAnalytics.scorelineDistribution && h2hAnalytics.scorelineDistribution.length > 0 && (
            <Card className="shadow-md border-2 border-indigo-300 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  Scoreline Distribution
                </CardTitle>
                <CardDescription>Most common scorelines between these teams</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {h2hAnalytics.scorelineDistribution.slice(0, 8).map((s, idx) => (
                    <div key={idx} className={`flex items-center justify-between p-2 rounded-lg ${s.btts ? 'bg-purple-100/50 dark:bg-purple-800/30' : 'bg-gray-100/50 dark:bg-gray-800/30'}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-mono font-bold">{s.scoreline}</span>
                        {s.btts && <Badge className="bg-purple-500 text-white text-xs">BTTS</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{s.count}x</span>
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${s.btts ? 'bg-purple-500' : 'bg-gray-400'}`}
                            style={{ width: `${s.percent}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-12 text-right">{s.percent}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Highlighted scorelines indicate BTTS matches
                </p>
              </CardContent>
            </Card>
          )}

          {/* Defensive Weakness */}
          {h2hAnalytics.defensiveWeakness && (
            <Card className="shadow-md border-2 border-yellow-300 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  Defensive Weakness (H2H)
                </CardTitle>
                <CardDescription>Goals conceded patterns - key for BTTS prediction</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-green-700 dark:text-green-300 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-500"></span>
                      {team1} Defense
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-2 rounded bg-white/50 dark:bg-gray-800/50">
                        <span className="text-sm">Avg Conceded</span>
                        <span className="font-bold text-red-600">{h2hAnalytics.defensiveWeakness.team1.avgConceded}/game</span>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded bg-green-100/50 dark:bg-green-800/30">
                        <span className="text-sm">0 goals conceded</span>
                        <span className="font-medium">{h2hAnalytics.defensiveWeakness.team1.conceded0} ({h2hAnalytics.defensiveWeakness.team1.cleanSheetRate}%)</span>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded bg-yellow-100/50 dark:bg-yellow-800/30">
                        <span className="text-sm">1 goal conceded</span>
                        <span className="font-medium">{h2hAnalytics.defensiveWeakness.team1.conceded1}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded bg-red-100/50 dark:bg-red-800/30">
                        <span className="text-sm">2+ goals conceded</span>
                        <span className="font-medium text-red-600">{h2hAnalytics.defensiveWeakness.team1.conceded2Plus}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded bg-orange-100/50 dark:bg-orange-800/30">
                        <span className="text-sm text-orange-700">Avg when concedes</span>
                        <span className="font-bold text-orange-600">{h2hAnalytics.defensiveWeakness.team1.avgConcededWhenConcedes}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                      {team2} Defense
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-2 rounded bg-white/50 dark:bg-gray-800/50">
                        <span className="text-sm">Avg Conceded</span>
                        <span className="font-bold text-red-600">{h2hAnalytics.defensiveWeakness.team2.avgConceded}/game</span>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded bg-green-100/50 dark:bg-green-800/30">
                        <span className="text-sm">0 goals conceded</span>
                        <span className="font-medium">{h2hAnalytics.defensiveWeakness.team2.conceded0} ({h2hAnalytics.defensiveWeakness.team2.cleanSheetRate}%)</span>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded bg-yellow-100/50 dark:bg-yellow-800/30">
                        <span className="text-sm">1 goal conceded</span>
                        <span className="font-medium">{h2hAnalytics.defensiveWeakness.team2.conceded1}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded bg-red-100/50 dark:bg-red-800/30">
                        <span className="text-sm">2+ goals conceded</span>
                        <span className="font-medium text-red-600">{h2hAnalytics.defensiveWeakness.team2.conceded2Plus}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded bg-orange-100/50 dark:bg-orange-800/30">
                        <span className="text-sm text-orange-700">Avg when concedes</span>
                        <span className="font-bold text-orange-600">{h2hAnalytics.defensiveWeakness.team2.avgConcededWhenConcedes}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-center">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>BTTS Insight:</strong> Lower clean sheet rates + higher "avg when concedes" = better BTTS potential
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* H2H General Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="shadow-md">
              <CardContent className="py-6">
                <span className="text-sm text-muted-foreground">Total H2H Matches</span>
                <p className="text-3xl font-bold mt-2">{h2hAnalytics.totalMatches}</p>
                {isAllSeasons && h2hAnalytics.seasonsCount && <p className="text-xs text-muted-foreground mt-1">{h2hAnalytics.seasonsCount} seasons analyzed</p>}
              </CardContent>
            </Card>
            <Card className="shadow-md">
              <CardContent className="py-6">
                <span className="text-sm text-muted-foreground">Avg Goals/Game</span>
                <p className="text-3xl font-bold mt-2">{h2hAnalytics.avgGoalsPerGame}</p>
                <p className="text-xs text-muted-foreground mt-1">{team1}: {h2hAnalytics.avgHomeTeamGoals} | {team2}: {h2hAnalytics.avgAwayTeamGoals}</p>
              </CardContent>
            </Card>
            <Card className="shadow-md">
              <CardContent className="py-6">
                <span className="text-sm text-muted-foreground">Over 2.5 Goals</span>
                <p className="text-3xl font-bold mt-2 text-orange-600">{h2hAnalytics.over25Goals.percent}%</p>
                <p className="text-xs text-muted-foreground">{h2hAnalytics.over25Goals.count} matches</p>
              </CardContent>
            </Card>
            <Card className="shadow-md">
              <CardContent className="py-6">
                <span className="text-sm text-muted-foreground">Win Distribution</span>
                <div className="flex gap-1 mt-2 text-xs">
                  <Badge style={{ backgroundColor: COLORS.homeWin }} className="text-white">{team1.slice(0,3)}: {h2hAnalytics.homeTeamWinPercent}%</Badge>
                  <Badge style={{ backgroundColor: COLORS.draw }} className="text-white">D: {h2hAnalytics.drawPercent}%</Badge>
                  <Badge style={{ backgroundColor: COLORS.awayWin }} className="text-white">{team2.slice(0,3)}: {h2hAnalytics.awayTeamWinPercent}%</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* H2H Match Stats & Odds */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  H2H Match Statistics
                </CardTitle>
                <CardDescription>Average stats per H2H match</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 rounded bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-xs text-muted-foreground">Shots</p>
                    <p className="font-bold">{h2hAnalytics.avgHomeTeamShots} - {h2hAnalytics.avgAwayTeamShots}</p>
                    <p className="text-xs text-muted-foreground">{team1.slice(0,10)} - {team2.slice(0,10)}</p>
                  </div>
                  <div className="text-center p-3 rounded bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-xs text-muted-foreground">Shots on Target</p>
                    <p className="font-bold">{h2hAnalytics.avgHomeTeamShotsOnTarget} - {h2hAnalytics.avgAwayTeamShotsOnTarget}</p>
                    <p className="text-xs text-muted-foreground">{team1.slice(0,10)} - {team2.slice(0,10)}</p>
                  </div>
                  <div className="text-center p-3 rounded bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-xs text-muted-foreground">Corners</p>
                    <p className="font-bold">{h2hAnalytics.avgHomeTeamCorners} - {h2hAnalytics.avgAwayTeamCorners}</p>
                    <p className="text-xs text-muted-foreground">{team1.slice(0,10)} - {team2.slice(0,10)}</p>
                  </div>
                  <div className="text-center p-3 rounded bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-xs text-muted-foreground">Fouls</p>
                    <p className="font-bold">{h2hAnalytics.avgHomeTeamFouls} - {h2hAnalytics.avgAwayTeamFouls}</p>
                    <p className="text-xs text-muted-foreground">{team1.slice(0,10)} - {team2.slice(0,10)}</p>
                  </div>
                </div>
                <div className="mt-3 text-center p-3 rounded bg-yellow-50 dark:bg-yellow-900/30">
                  <p className="text-xs text-muted-foreground">Total Cards</p>
                  <p className="font-bold">{h2hAnalytics.totalCards}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-amber-600" />
                  H2H Odds Analysis
                </CardTitle>
                <CardDescription>{h2hAnalytics.oddsAnalysis.matchesWithOdds} matches with odds data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 rounded bg-white/50 dark:bg-gray-800/50">
                    <p className="text-xs text-muted-foreground">Favorite Won</p>
                    <p className="text-2xl font-bold text-amber-600">{h2hAnalytics.oddsAnalysis.favoriteWinPercent}%</p>
                  </div>
                  <div className="text-center p-3 rounded bg-white/50 dark:bg-gray-800/50">
                    <p className="text-xs text-muted-foreground">Underdog Won</p>
                    <p className="text-2xl font-bold text-purple-600">{h2hAnalytics.oddsAnalysis.underdogWinPercent}%</p>
                  </div>
                  <div className="text-center p-3 rounded bg-white/50 dark:bg-gray-800/50">
                    <p className="text-xs text-muted-foreground">Total Odds</p>
                    <p className="text-lg font-bold">{h2hAnalytics.oddsAnalysis.matchesWithOdds}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <p className="text-muted-foreground">Avg Odds</p>
                    <p className="font-semibold">{team1.slice(0,6)}: {h2hAnalytics.oddsAnalysis.avgHomeTeamWinOdds}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground">Avg Odds</p>
                    <p className="font-semibold">Draw: {h2hAnalytics.oddsAnalysis.avgDrawOdds}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground">Avg Odds</p>
                    <p className="font-semibold">{team2.slice(0,6)}: {h2hAnalytics.oddsAnalysis.avgAwayTeamWinOdds}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Seasons Played Card */}
          {isAllSeasons && h2hAnalytics.seasonsPlayed && h2hAnalytics.seasonsPlayed.length > 0 && (
            <Card className="shadow-md bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardContent className="py-4">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Seasons with H2H matches:</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {h2hAnalytics.seasonsPlayed.map(s => (
                    <Badge key={s} variant="outline" className="border-blue-300 text-blue-700 dark:border-blue-600 dark:text-blue-300">{s}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* H2H Match History */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">H2H Match History</CardTitle>
              <CardDescription>All matches between {team1} and {team2}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      {isAllSeasons && <TableHead>Season</TableHead>}
                      <TableHead>Home</TableHead>
                      <TableHead className="text-center">1st Half</TableHead>
                      <TableHead className="text-center">2nd Half</TableHead>
                      <TableHead className="text-center">Full Time</TableHead>
                      <TableHead>Away</TableHead>
                      <TableHead className="text-center">Odds H</TableHead>
                      <TableHead className="text-center">Odds D</TableHead>
                      <TableHead className="text-center">Odds A</TableHead>
                      <TableHead className="text-center">BTTS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {h2hMatches.length === 0 ? (
                      <TableRow><TableCell colSpan={isAllSeasons ? 11 : 10} className="text-center py-8 text-muted-foreground">No H2H matches found between these teams in this season.</TableCell></TableRow>
                    ) : (
                      h2hMatches.map((match, index) => (
                        <TableRow key={index} className={match.bttsBothHalves ? 'bg-purple-50 dark:bg-purple-900/20' : ''}>
                          <TableCell className="font-medium">{match.date || 'N/A'}</TableCell>
                          {isAllSeasons && <TableCell><Badge variant="outline">{SEASON_NAMES[match.season || ''] || match.season}</Badge></TableCell>}
                          <TableCell className={match.homeTeamIsHome ? 'font-bold' : ''}>{match.homeTeam}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={`font-mono ${match.bttsFirstHalf ? 'border-purple-400 bg-purple-50' : ''}`}>
                              {match.htHomeGoals} - {match.htAwayGoals}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={`font-mono ${match.bttsSecondHalf ? 'border-purple-400 bg-purple-50' : ''}`}>
                              {match.shHomeGoals} - {match.shAwayGoals}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="font-mono text-base">{match.ftHomeGoals} - {match.ftAwayGoals}</Badge>
                          </TableCell>
                          <TableCell className={!match.homeTeamIsHome ? 'font-bold' : ''}>{match.awayTeam}</TableCell>
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
                          <TableCell className="text-center">
                            {match.bttsBothHalves ? (
                              <Badge className="bg-purple-600 text-white"><Zap className="w-3 h-3 mr-1" />BOTH</Badge>
                            ) : match.bttsFullTime ? (
                              <Badge variant="outline" className="border-purple-400 text-purple-600">FT</Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">No</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                {h2hMatches.some(m => m.bttsBothHalves) && (
                  <p className="text-sm text-purple-600 mt-4">
                    <Zap className="w-4 h-4 inline mr-1" />
                    Highlighted rows indicate matches where BTTS occurred in BOTH halves
                  </p>
                )}
              </CardContent>
            </Card>

          {/* HT/FT Analysis */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">Half Time Analysis</CardTitle>
                <CardDescription>HT result distribution (from {team1} perspective)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>{team1} Leading at HT</span>
                    <Badge style={{ backgroundColor: COLORS.homeWin }} className="text-white">{h2hAnalytics.htHomeTeamLeads}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Draw at HT</span>
                    <Badge style={{ backgroundColor: COLORS.draw }} className="text-white">{h2hAnalytics.htDraws}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{team2} Leading at HT</span>
                    <Badge style={{ backgroundColor: COLORS.awayWin }} className="text-white">{h2hAnalytics.htAwayTeamLeads}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">Comebacks</CardTitle>
                <CardDescription>Teams winning after trailing at HT</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>{team1} Comebacks</span>
                    <Badge variant="secondary">{h2hAnalytics.homeTeamComebacks}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{team2} Comebacks</span>
                    <Badge variant="secondary">{h2hAnalytics.awayTeamComebacks}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
