'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Target, RefreshCw, Sparkles, CheckCircle, AlertTriangle, Zap, Goal, DollarSign, BarChart3, TrendingUp } from 'lucide-react'
import type { PredictionsTabProps } from './types'
import { COLORS, SEASON_NAMES } from '@/lib/constants'
import { parseDateSafe } from '@/lib/utils'
import {
  BTTS_THRESHOLDS, OVER35_THRESHOLDS, STRONG_BET_POINTS,
  computeBttsChecklist, computeOver35Checklist,
  computeStrongBet, computeGreyResult,
  type ChecklistInput, type SignalInput,
} from '@/lib/betting-filters'

export default function PredictionsTab({
  results,
  analytics,
  teams,
  teamsPerSeason,
  predHomeTeam,
  predAwayTeam,
  setPredHomeTeam,
  setPredAwayTeam,
  setTeam1,
  setTeam2,
  prediction,
  predLoading,
  predError,
  bookmakerOdds15,
  setBookmakerOdds15,
  bookmakerOddsBtts,
  setBookmakerOddsBtts,
  fetchPrediction,
  selectedLeague,
  selectedSeason,
  isAllSeasons,
  teamForm,
}: PredictionsTabProps) {
  // Synced team selection handlers
  const handlePredHomeTeamChange = (team: string) => {
    setPredHomeTeam(team)
    setTeam1(team)
  }
  const handlePredAwayTeamChange = (team: string) => {
    setPredAwayTeam(team)
    setTeam2(team)
  }

  return (
    <div className="space-y-6">
            {/* Team Selectors */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  Match Prediction Engine
                </CardTitle>
                <CardDescription>
                  Select teams to generate predictions using Monte Carlo simulation (100,000 iterations)
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
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Home Team</label>
                    <Select value={predHomeTeam} onValueChange={handlePredHomeTeamChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select home team" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map(team => (
                          <SelectItem key={`home-${team}`} value={team}>{team}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="text-2xl font-bold text-muted-foreground pb-2">VS</div>

                  <div className="flex-1 min-w-[200px]">
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Away Team</label>
                    <Select value={predAwayTeam} onValueChange={handlePredAwayTeamChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select away team" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map(team => (
                          <SelectItem key={`away-${team}`} value={team}>{team}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button onClick={fetchPrediction} disabled={predLoading || !predHomeTeam || !predAwayTeam} className="bg-purple-600 hover:bg-purple-700">
                    {predLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Predict
                      </>
                    )}
                  </Button>
                </div>

                {predError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {predError}
                  </div>
                )}
              </CardContent>
            </Card>

            {prediction?.prediction?.impliedOdds && (
              <>
                {/* Market Probabilities with Implied Odds */}
                <Card className="shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="w-5 h-5 text-purple-600" />
                      Goals Markets & Implied Odds
                      {prediction.prediction.calibrated && (
                        <Badge className="bg-cyan-100 text-cyan-700 text-xs border border-cyan-300">
                          Calibrated
                        </Badge>
                      )}
                    </CardTitle>
                    {prediction.prediction.calibrationSource && (
                      <CardDescription>
                        Probabilities corrected using backtest from season {SEASON_NAMES[prediction.prediction.calibrationSource.testSeason] || prediction.prediction.calibrationSource.testSeason} ({prediction.prediction.calibrationSource.matches} matches, Brier: {prediction.prediction.calibrationSource.brierScore})
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-5 gap-4 mb-4">
                      <div className="text-center p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                        <p className="text-xs text-muted-foreground">Over 0.5</p>
                        <p className="text-2xl font-bold text-emerald-600 mt-1">{prediction.prediction.over05}%</p>
                        <div className="flex flex-col gap-1 mt-1 text-xs">
                          <span className="bg-emerald-100 px-1 py-0.5 rounded">O: {prediction.prediction.impliedOdds.over05}</span>
                          <span className="bg-gray-100 px-1 py-0.5 rounded">U: {prediction.prediction.impliedOdds.under05}</span>
                        </div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-teal-50 border border-teal-200">
                        <p className="text-xs text-muted-foreground">Over 1.5</p>
                        <p className="text-2xl font-bold text-teal-600 mt-1">{prediction.prediction.over15}%</p>
                        {prediction.prediction.calibrated && (
                          <p className="text-xs font-semibold text-cyan-600 bg-cyan-50 rounded px-1.5 py-0.5 mt-0.5">
                            Adj: {prediction.prediction.calibrated.over15}%
                          </p>
                        )}
                        <div className="flex flex-col gap-1 mt-1 text-xs">
                          <span className="bg-teal-100 px-1 py-0.5 rounded">O: {prediction.prediction.impliedOdds.over15}</span>
                          <span className="bg-gray-100 px-1 py-0.5 rounded">U: {prediction.prediction.impliedOdds.under15}</span>
                        </div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-purple-50 border border-purple-200">
                        <p className="text-xs text-muted-foreground">Over 2.5</p>
                        <p className="text-2xl font-bold text-purple-600 mt-1">{prediction.prediction.over25}%</p>
                        {prediction.prediction.calibrated && (
                          <p className="text-xs font-semibold text-cyan-600 bg-cyan-50 rounded px-1.5 py-0.5 mt-0.5">
                            Adj: {prediction.prediction.calibrated.over25}%
                          </p>
                        )}
                        <div className="flex flex-col gap-1 mt-1 text-xs">
                          <span className="bg-purple-100 px-1 py-0.5 rounded">O: {prediction.prediction.impliedOdds.over25}</span>
                          <span className="bg-gray-100 px-1 py-0.5 rounded">U: {prediction.prediction.impliedOdds.under25}</span>
                        </div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-indigo-50 border border-indigo-200">
                        <p className="text-xs text-muted-foreground">Over 3.5</p>
                        <p className="text-2xl font-bold text-indigo-600 mt-1">{prediction.prediction.over35}%</p>
                        {prediction.prediction.calibrated && (
                          <p className="text-xs font-semibold text-cyan-600 bg-cyan-50 rounded px-1.5 py-0.5 mt-0.5">
                            Adj: {prediction.prediction.calibrated.over35}%
                          </p>
                        )}
                        <div className="flex flex-col gap-1 mt-1 text-xs">
                          <span className="bg-indigo-100 px-1 py-0.5 rounded">O: {prediction.prediction.impliedOdds.over35}</span>
                          <span className="bg-gray-100 px-1 py-0.5 rounded">U: {prediction.prediction.impliedOdds.under35}</span>
                        </div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-pink-50 border border-pink-200">
                        <p className="text-xs text-muted-foreground">BTTS</p>
                        <p className="text-2xl font-bold text-pink-600 mt-1">{prediction.prediction.btts}%</p>
                        {prediction.prediction.calibrated && (
                          <p className="text-xs font-semibold text-cyan-600 bg-cyan-50 rounded px-1.5 py-0.5 mt-0.5">
                            Adj: {prediction.prediction.calibrated.btts}%
                          </p>
                        )}
                        <div className="flex flex-col gap-1 mt-1 text-xs">
                          <span className="bg-pink-100 px-1 py-0.5 rounded">Yes: {prediction.prediction.impliedOdds.bttsYes}</span>
                          <span className="bg-gray-100 px-1 py-0.5 rounded">No: {prediction.prediction.impliedOdds.bttsNo}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Strong Bet Indicator */}
                {(() => {
                  // Guard: analytics and prediction.prediction must be available
                  if (!analytics || !prediction?.prediction) return null;
                  
                  // Calculate Strong Bet indicator
                  // Use calibrated probabilities when available (more accurate from backtest), fall back to raw
                  const bttsProbValue = prediction.prediction.calibrated?.btts ?? prediction.prediction.btts;
                  const o25ProbValue = prediction.prediction.calibrated?.over25 ?? prediction.prediction.over25;

                  // Calculate Regression to Mean signal for Strong Bet check (matching main Regression to Mean Analysis)
                  const sortedResultsForRegression = [...results].sort((a, b) => {
                    const dateA = parseDateSafe(a.date)
                    const dateB = parseDateSafe(b.date)
                    return dateB.getTime() - dateA.getTime()
                  });

                  const teamGoalStatsQuick = new Map<string, {
                    matches: number;
                    goalsScored: number;
                    goalsConceded: number;
                    matchesThisSeason: number;
                    scoredThisSeason: number;
                    concededThisSeason: number;
                    last10Matches: { totalGoals: number }[];
                    last3Matches: { totalGoals: number }[];
                  }>();

                  sortedResultsForRegression.forEach(r => {
                    const totalGoals = r.ftHomeGoals + r.ftAwayGoals;

                    const homeStats = teamGoalStatsQuick.get(r.homeTeam) || {
                      matches: 0, goalsScored: 0, goalsConceded: 0,
                      matchesThisSeason: 0, scoredThisSeason: 0, concededThisSeason: 0,
                      last10Matches: [], last3Matches: []
                    };
                    homeStats.matches++;
                    homeStats.goalsScored += r.ftHomeGoals;
                    homeStats.goalsConceded += r.ftAwayGoals;
                    homeStats.matchesThisSeason++;
                    homeStats.scoredThisSeason += r.ftHomeGoals;
                    homeStats.concededThisSeason += r.ftAwayGoals;
                    homeStats.last10Matches.push({ totalGoals });
                    homeStats.last3Matches.push({ totalGoals });
                    teamGoalStatsQuick.set(r.homeTeam, homeStats);

                    const awayStats = teamGoalStatsQuick.get(r.awayTeam) || {
                      matches: 0, goalsScored: 0, goalsConceded: 0,
                      matchesThisSeason: 0, scoredThisSeason: 0, concededThisSeason: 0,
                      last10Matches: [], last3Matches: []
                    };
                    awayStats.matches++;
                    awayStats.goalsScored += r.ftAwayGoals;
                    awayStats.goalsConceded += r.ftHomeGoals;
                    awayStats.matchesThisSeason++;
                    awayStats.scoredThisSeason += r.ftAwayGoals;
                    awayStats.concededThisSeason += r.ftHomeGoals;
                    awayStats.last10Matches.push({ totalGoals });
                    awayStats.last3Matches.push({ totalGoals });
                    teamGoalStatsQuick.set(r.awayTeam, awayStats);
                  });

                  const homeTeamDataQuick = teamGoalStatsQuick.get(predHomeTeam);
                  const awayTeamDataQuick = teamGoalStatsQuick.get(predAwayTeam);

                  // Calculate H2H data (matching main Regression to Mean Analysis)
                  const h2hDataQuick = results.filter(r => 
                    (r.homeTeam === predHomeTeam && r.awayTeam === predAwayTeam) ||
                    (r.homeTeam === predAwayTeam && r.awayTeam === predHomeTeam)
                  ).sort((a, b) => {
                    const dateA = parseDateSafe(a.date)
                    const dateB = parseDateSafe(b.date)
                    return dateB.getTime() - dateA.getTime()
                  });
                  
                  const lastH2HQuick = h2hDataQuick.length > 0 ? h2hDataQuick[0] : null;
                  const h2hAvgGoalsQuick = h2hDataQuick.length > 0 
                    ? h2hDataQuick.reduce((sum, m) => sum + m.ftHomeGoals + m.ftAwayGoals, 0) / h2hDataQuick.length 
                    : null;

                  let regressionSignalQuick = 'Neutral';
                  
                  if (homeTeamDataQuick && awayTeamDataQuick) {
                    // Calculate means for each team (matching main analysis)
                    const calculateTeamMeans = (teamData: typeof homeTeamDataQuick, teamName: string) => {
                      const seasonAvg = teamData.matchesThisSeason > 0 
                        ? (teamData.scoredThisSeason + teamData.concededThisSeason) / teamData.matchesThisSeason 
                        : 0;
                      
                      const last10 = teamData.last10Matches.slice(0, 10);
                      const last10Avg = last10.length > 0 
                        ? last10.reduce((sum, m) => sum + m.totalGoals, 0) / last10.length 
                        : 0;
                      
                      const last3 = teamData.last3Matches.slice(0, 3);
                      const last3Avg = last3.length > 0 
                        ? last3.reduce((sum, m) => sum + m.totalGoals, 0) / last3.length 
                        : 0;

                      const teamH2H = h2hDataQuick.filter(m => 
                        m.homeTeam === teamName || m.awayTeam === teamName
                      );
                      const teamH2HAvg = teamH2H.length > 0 
                        ? teamH2H.reduce((sum, m) => sum + m.ftHomeGoals + m.ftAwayGoals, 0) / teamH2H.length 
                        : null;

                      const teamLastH2H = lastH2HQuick;
                      const lastH2HGoals = teamLastH2H ? teamLastH2H.ftHomeGoals + teamLastH2H.ftAwayGoals : null;

                      return { seasonAvg, last10Avg, last3Avg, h2hAvg: teamH2HAvg, lastH2HGoals };
                    };

                    const homeMeans = calculateTeamMeans(homeTeamDataQuick, predHomeTeam);
                    const awayMeans = calculateTeamMeans(awayTeamDataQuick, predAwayTeam);

                    // Calculate deviation for each team (matching main analysis exactly)
                    const calculateDeviation = (means: typeof homeMeans) => {
                      const deviationFromSeason = means.last3Avg - means.seasonAvg;
                      const deviationFromLast10 = means.last3Avg - means.last10Avg;
                      const h2hDeviation = means.h2hAvg && means.lastH2HGoals !== null
                        ? means.lastH2HGoals - means.h2hAvg
                        : 0;

                      // Combined signal with H2H component (0.4 + 0.3 + 0.3 = 1.0)
                      const combinedSignal = (deviationFromSeason * 0.4) + (deviationFromLast10 * 0.3) + (h2hDeviation * 0.3);
                      
                      return { combinedSignal };
                    };

                    const homeDeviation = calculateDeviation(homeMeans);
                    const awayDeviation = calculateDeviation(awayMeans);

                    // Combined match signal (matching main analysis thresholds)
                    const totalSignal = homeDeviation.combinedSignal + awayDeviation.combinedSignal;

                    if (totalSignal <= -1.2) {
                      regressionSignalQuick = 'Strong Over';
                    } else if (totalSignal <= -0.5) {
                      regressionSignalQuick = 'Over';
                    } else if (totalSignal >= 1.2) {
                      regressionSignalQuick = 'Strong Under';
                    } else if (totalSignal >= 0.5) {
                      regressionSignalQuick = 'Under';
                    }
                  }

                  // Calculate BTTS Check list count (7 criteria) using shared utility
                  const bttsChecklistInput: ChecklistInput = {
                    avgGoalsPerGame: analytics.avgGoalsPerGame,
                    over25Percent: analytics.over25Percent,
                    bttsProb: bttsProbValue,
                    avgHomeGoals: analytics.avgHomeGoals,
                    avgAwayGoals: analytics.avgAwayGoals,
                    o25Prob: o25ProbValue,
                    o35Prob: prediction.prediction.over35,
                    overallShotConversion: parseFloat(analytics.overallShotConversion),
                  };
                  const bttsChecksQuickCount = computeBttsChecklist(bttsChecklistInput);

                  // BTTS Confidence
                  const bttsConf = bttsProbValue >= 60 ? 'High' : bttsProbValue >= 50 ? 'Medium' : 'Low';

                  // Calculate xG Overperformance Signal for Strong Bet
                  const teamXgStatsQuick = new Map<string, {
                    matches: number;
                    totalXg: number;
                    actualGoals: number;
                  }>();

                  results.forEach(r => {
                    const homeShotsOff = r.homeShots - r.homeShotsOnTarget;
                    const awayShotsOff = r.awayShots - r.awayShotsOnTarget;
                    const homeXg = (r.homeShotsOnTarget * 0.30) + (homeShotsOff * 0.08);
                    const awayXg = (r.awayShotsOnTarget * 0.30) + (awayShotsOff * 0.08);

                    const homeStats = teamXgStatsQuick.get(r.homeTeam) || { matches: 0, totalXg: 0, actualGoals: 0 };
                    homeStats.matches++;
                    homeStats.totalXg += homeXg;
                    homeStats.actualGoals += r.ftHomeGoals;
                    teamXgStatsQuick.set(r.homeTeam, homeStats);

                    const awayStats = teamXgStatsQuick.get(r.awayTeam) || { matches: 0, totalXg: 0, actualGoals: 0 };
                    awayStats.matches++;
                    awayStats.totalXg += awayXg;
                    awayStats.actualGoals += r.ftAwayGoals;
                    teamXgStatsQuick.set(r.awayTeam, awayStats);
                  });

                  const homeXgDataQuick = teamXgStatsQuick.get(predHomeTeam);
                  const awayXgDataQuick = teamXgStatsQuick.get(predAwayTeam);

                  let xgSignalQuick = 'Neutral';
                  if (homeXgDataQuick && awayXgDataQuick) {
                    const homeXgDiff = (homeXgDataQuick.actualGoals / homeXgDataQuick.matches) - (homeXgDataQuick.totalXg / homeXgDataQuick.matches);
                    const awayXgDiff = (awayXgDataQuick.actualGoals / awayXgDataQuick.matches) - (awayXgDataQuick.totalXg / awayXgDataQuick.matches);
                    const totalXgDiff = homeXgDiff + awayXgDiff;

                    if (totalXgDiff <= -0.7) xgSignalQuick = 'Strong Over';
                    else if (totalXgDiff <= -0.3) xgSignalQuick = 'Over';
                    else if (totalXgDiff >= 0.7) xgSignalQuick = 'Strong Under';
                    else if (totalXgDiff >= 0.3) xgSignalQuick = 'Under';
                  }

                  // Calculate Over 3.5 Checklist (7 auto-check criteria) using shared utility
                  const over35ChecksQuickCount = computeOver35Checklist(bttsChecklistInput);

                  // Z-Score Signal - computed independently using Z-Score methodology
                  // matching the detailed Z-Score Analysis & Confidence Intervals card
                  let zScoreSignalQuick = 'Neutral';
                  {
                    const zTeamStats = new Map<string, {
                      matches: number;
                      goals: number[];
                      totalGoals: number;
                      mean: number;
                      stdDev: number;
                      last3Avg: number;
                    }>();

                    sortedResultsForRegression.forEach(r => {
                      const totalGoals = r.ftHomeGoals + r.ftAwayGoals;
                      const hStats = zTeamStats.get(r.homeTeam) || { matches: 0, goals: [], totalGoals: 0, mean: 0, stdDev: 0, last3Avg: 0 };
                      hStats.matches++;
                      hStats.goals.push(totalGoals);
                      hStats.totalGoals += totalGoals;
                      zTeamStats.set(r.homeTeam, hStats);

                      const aStats = zTeamStats.get(r.awayTeam) || { matches: 0, goals: [], totalGoals: 0, mean: 0, stdDev: 0, last3Avg: 0 };
                      aStats.matches++;
                      aStats.goals.push(totalGoals);
                      aStats.totalGoals += totalGoals;
                      zTeamStats.set(r.awayTeam, aStats);
                    });

                    zTeamStats.forEach((stats) => {
                      stats.mean = stats.totalGoals / stats.matches;
                      const last3 = stats.goals.slice(0, 3);
                      stats.last3Avg = last3.length > 0 ? last3.reduce((a, b) => a + b, 0) / last3.length : 0;
                      const squaredDiffs = stats.goals.map(g => Math.pow(g - stats.mean, 2));
                      stats.stdDev = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / stats.matches);
                    });

                    const homeZStats = zTeamStats.get(predHomeTeam);
                    const awayZStats = zTeamStats.get(predAwayTeam);

                    if (homeZStats && awayZStats && homeZStats.matches >= 3 && awayZStats.matches >= 3) {
                      const homeZ = homeZStats.stdDev > 0 ? (homeZStats.last3Avg - homeZStats.mean) / homeZStats.stdDev : 0;
                      const awayZ = awayZStats.stdDev > 0 ? (awayZStats.last3Avg - awayZStats.mean) / awayZStats.stdDev : 0;
                      const homeCILower = homeZStats.mean - 1.96 * (homeZStats.stdDev / Math.sqrt(homeZStats.matches));
                      const awayCILower = awayZStats.mean - 1.96 * (awayZStats.stdDev / Math.sqrt(awayZStats.matches));
                      const homeBelowCI = homeZStats.last3Avg < homeCILower;
                      const awayBelowCI = awayZStats.last3Avg < awayCILower;
                      const homeCV = homeZStats.mean > 0 ? (homeZStats.stdDev / homeZStats.mean) * 100 : 0;
                      const awayCV = awayZStats.mean > 0 ? (awayZStats.stdDev / awayZStats.mean) * 100 : 0;

                      let score = 0;
                      if (homeZ <= -1.5) score += 2;
                      else if (homeZ <= -1.0) score += 1;
                      if (awayZ <= -1.5) score += 2;
                      else if (awayZ <= -1.0) score += 1;
                      if (homeBelowCI) score += 1;
                      if (awayBelowCI) score += 1;
                      if (homeCV < 35 && homeZ < -1) score += 0.5;
                      if (awayCV < 35 && awayZ < -1) score += 0.5;
                      if (homeZ >= 1.5) score -= 2;
                      else if (homeZ >= 1.0) score -= 1;
                      if (awayZ >= 1.5) score -= 2;
                      else if (awayZ >= 1.0) score -= 1;

                      if (score >= 4) zScoreSignalQuick = 'Strong Over';
                      else if (score >= 2.5) zScoreSignalQuick = 'Over';
                      else if (score <= -3) zScoreSignalQuick = 'Strong Under';
                      else if (score <= -1.5) zScoreSignalQuick = 'Under';
                    }
                  }

                  // STRONG BET — New points-based system (need 7+ of 11 points)
                  // Replaces old auto-qualify on O2.5 ≥ 68% + 4/6 checks
                  const o35ProbValue = prediction.prediction.calibrated?.over35 ?? prediction.prediction.over35; // O3.5 probability (calibrated preferred)
                  const signalInput: SignalInput = {
                    xgSignal: xgSignalQuick,
                    regressionSignal: regressionSignalQuick,
                    zScoreSignal: zScoreSignalQuick,
                  };
                  const strongBetResult = computeStrongBet(bttsChecklistInput, signalInput);
                  const isStrongBet = strongBetResult.isStrongBet;
                  const strongBetChecks = strongBetResult.breakdown.map(c => c.passed);
                  const strongBetScore = strongBetResult.points;

                  // Grey Result Predictor — Tightened criteria using shared utility
                  const greyResultData = computeGreyResult(bttsChecklistInput, signalInput);
                  const isGreyResult = greyResultData.isGreyResult;
                  const greyResultChecks = greyResultData.breakdown.map(c => c.passed);
                  const greyScore = greyResultData.score;

                  return (
                    <>
                    {/* Strong Bet Indicator - Updated based on actual betting results */}
                    <Card className={`shadow-md border-2 ${isStrongBet ? 'border-green-400 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20' : 'border-gray-200 bg-gray-50 dark:bg-gray-800/20'}`}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <CheckCircle className={`w-5 h-5 ${isStrongBet ? 'text-green-600' : 'text-gray-400'}`} />
                          🎯 Strong Bet Indicator
                        </CardTitle>
                        <CardDescription>
                          Based on analysis of your actual betting results (30 matches analyzed)
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {/* Result Badge */}
                          <div className={`text-center p-4 rounded-lg ${isStrongBet ? 'bg-green-100 dark:bg-green-800/30' : 'bg-gray-100 dark:bg-gray-700/30'}`}>
                            <p className={`text-2xl font-bold ${isStrongBet ? 'text-green-600' : 'text-gray-500'}`}>
                              {isStrongBet ? '✅ STRONG BET' : `⚠️ ${strongBetScore}/${STRONG_BET_POINTS.maxPoints} Points`}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {isStrongBet ? 'This match meets the criteria for a strong BTTS + O2.5 bet' : `Needs ${STRONG_BET_POINTS.threshold}+ points to qualify as a Strong Bet`}
                            </p>
                          </div>

                          {/* Checklist - 7 items with point values */}
                          <div className="grid grid-cols-1 md:grid-cols-7 gap-2 text-sm">
                            {strongBetResult.breakdown.map((check, i) => (
                              <div key={i} className={`p-2 rounded-lg text-center ${check.passed ? 'bg-green-100 dark:bg-green-800/30 text-green-700' : 'bg-red-50 dark:bg-red-900/20 text-red-600'}`}>
                                {check.passed ? '✅' : '❌'} {check.check}
                                <p className="text-xs text-muted-foreground">{check.passed ? `+${check.points}pt` : '0pt'}</p>
                              </div>
                            ))}
                          </div>

                          <p className="text-xs text-muted-foreground text-center">
                            Points-based system: need {STRONG_BET_POINTS.threshold}+ of {STRONG_BET_POINTS.maxPoints} points. No auto-qualify.
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Grey Result Predictor - Both Teams Score in Both Halves */}
                    <Card className={`shadow-md border-2 ${isGreyResult ? 'border-purple-500 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20' : 'border-gray-200 bg-gray-50 dark:bg-gray-800/20'}`}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Zap className={`w-5 h-5 ${isGreyResult ? 'text-purple-600' : 'text-gray-400'}`} />
                          🔮 Grey Result Predictor
                        </CardTitle>
                        <CardDescription>
                          Predicts if both teams will score in BOTH halves (Based on 3 actual grey results from your data)
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {/* Result Badge */}
                          <div className={`text-center p-4 rounded-lg ${isGreyResult ? 'bg-purple-100 dark:bg-purple-800/30' : 'bg-gray-100 dark:bg-gray-700/30'}`}>
                            <p className={`text-2xl font-bold ${isGreyResult ? 'text-purple-600' : 'text-gray-500'}`}>
                              {isGreyResult ? '🟠 GREY RESULT LIKELY' : `⚠️ ${greyScore}/${greyResultData.totalChecks} Checks Passed`}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {isGreyResult ? 'High probability of BTTS in both halves!' : 'Needs 6+ checks for grey result prediction'}
                            </p>
                          </div>

                          {/* Checklist */}
                          <div className="grid grid-cols-1 md:grid-cols-8 gap-2 text-sm">
                            {greyResultData.breakdown.map((check, i) => (
                              <div key={i} className={`p-2 rounded-lg text-center ${check.passed ? 'bg-purple-100 dark:bg-purple-800/30 text-purple-700' : 'bg-red-50 dark:bg-red-900/20 text-red-600'}`}>
                                {check.passed ? '✅' : '❌'} {check.check}
                              </div>
                            ))}
                          </div>

                          <div className="p-3 rounded-lg bg-purple-100/50 dark:bg-purple-800/20 text-sm">
                            <p className="font-semibold text-purple-700 dark:text-purple-300 mb-1">📊 Key Findings from Your Results (7 Greys Analyzed):</p>
                            <ul className="text-xs text-muted-foreground space-y-1">
                              <li>• 100% had <strong>Regression Strong Over</strong> and <strong>Z-Score Strong Over</strong></li>
                              <li>• BTTS Checklist score: <strong>5-7 of 7</strong></li>
                              <li>• BTTS Probability: <strong>≥53%</strong></li>
                              <li>• O2.5 Probability: <strong>≥68%</strong> (consistent across all sections)</li>
                              <li>• O3.5 Probability: <strong>≥35%</strong> (bonus check)</li>
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    </>
                  );
                })()}

                {/* Value Bet Calculator for O1.5 & BTTS */}
                <Card className="shadow-md border-2 border-yellow-300 bg-gradient-to-r from-yellow-50 to-amber-50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-yellow-600" />
                      Value Bet Calculator - Over 1.5 & BTTS
                    </CardTitle>
                    <CardDescription>Enter bookmaker odds to find value bets</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Over 1.5 */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-teal-700">Over 1.5 Goals</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-muted-foreground">Bookmaker Odds</label>
                            <Input
                              type="number"
                              step="0.01"
                              min="1.01"
                              placeholder="e.g. 1.85"
                              value={bookmakerOdds15}
                              onChange={(e) => setBookmakerOdds15(e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Model Probability</label>
                            <div className="mt-1 p-2 bg-teal-100 rounded text-center">
                              <span className="text-lg font-bold text-teal-700">{prediction.prediction.over15}%</span>
                            </div>
                          </div>
                        </div>
                        {bookmakerOdds15 && parseFloat(bookmakerOdds15) > 1 && (
                          <div className={`p-4 rounded-lg ${
                            ((prediction.prediction.over15 / 100) * parseFloat(bookmakerOdds15)) > 1 
                              ? 'bg-green-100 border-2 border-green-400' 
                              : 'bg-red-100 border-2 border-red-300'
                          }`}>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div>
                                <p className="text-xs text-muted-foreground">Implied Prob</p>
                                <p className="font-bold">{(100 / parseFloat(bookmakerOdds15)).toFixed(1)}%</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Expected Value</p>
                                <p className={`font-bold text-lg ${((prediction.prediction.over15 / 100) * parseFloat(bookmakerOdds15)) > 1 ? 'text-green-600' : 'text-red-600'}`}>
                                  {(((prediction.prediction.over15 / 100) * parseFloat(bookmakerOdds15)) * 100 - 100).toFixed(1)}%
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Verdict</p>
                                <p className={`font-bold ${((prediction.prediction.over15 / 100) * parseFloat(bookmakerOdds15)) > 1 ? 'text-green-600' : 'text-red-600'}`}>
                                  {((prediction.prediction.over15 / 100) * parseFloat(bookmakerOdds15)) > 1 ? '✓ VALUE' : '✗ NO VALUE'}
                                </p>
                              </div>
                            </div>
                            {((prediction.prediction.over15 / 100) * parseFloat(bookmakerOdds15)) > 1 && (
                              <p className="text-center text-sm text-green-700 mt-2">
                                Edge: Model rates this {(prediction.prediction.over15 - (100 / parseFloat(bookmakerOdds15))).toFixed(1)}% higher than bookmaker
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* BTTS Yes */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-purple-700">BTTS Yes</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-muted-foreground">Bookmaker Odds</label>
                            <Input
                              type="number"
                              step="0.01"
                              min="1.01"
                              placeholder="e.g. 1.75"
                              value={bookmakerOddsBtts}
                              onChange={(e) => setBookmakerOddsBtts(e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Model Probability</label>
                            <div className="mt-1 p-2 bg-purple-100 rounded text-center">
                              <span className="text-lg font-bold text-purple-700">{prediction.prediction.btts}%</span>
                            </div>
                          </div>
                        </div>
                        {bookmakerOddsBtts && parseFloat(bookmakerOddsBtts) > 1 && (
                          <div className={`p-4 rounded-lg ${
                            ((prediction.prediction.btts / 100) * parseFloat(bookmakerOddsBtts)) > 1 
                              ? 'bg-green-100 border-2 border-green-400' 
                              : 'bg-red-100 border-2 border-red-300'
                          }`}>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div>
                                <p className="text-xs text-muted-foreground">Implied Prob</p>
                                <p className="font-bold">{(100 / parseFloat(bookmakerOddsBtts)).toFixed(1)}%</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Expected Value</p>
                                <p className={`font-bold text-lg ${((prediction.prediction.btts / 100) * parseFloat(bookmakerOddsBtts)) > 1 ? 'text-green-600' : 'text-red-600'}`}>
                                  {(((prediction.prediction.btts / 100) * parseFloat(bookmakerOddsBtts)) * 100 - 100).toFixed(1)}%
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Verdict</p>
                                <p className={`font-bold ${((prediction.prediction.btts / 100) * parseFloat(bookmakerOddsBtts)) > 1 ? 'text-green-600' : 'text-red-600'}`}>
                                  {((prediction.prediction.btts / 100) * parseFloat(bookmakerOddsBtts)) > 1 ? '✓ VALUE' : '✗ NO VALUE'}
                                </p>
                              </div>
                            </div>
                            {((prediction.prediction.btts / 100) * parseFloat(bookmakerOddsBtts)) > 1 && (
                              <p className="text-center text-sm text-green-700 mt-2">
                                Edge: Model rates this {(prediction.prediction.btts - (100 / parseFloat(bookmakerOddsBtts))).toFixed(1)}% higher than bookmaker
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-4 text-center">
                      💡 Value = (Model Probability × Bookmaker Odds) - 1. Positive expected value indicates a potential value bet.
                    </p>
                  </CardContent>
                </Card>

                {/* Confidence Banner */}
                <Card className={`shadow-md border-2 ${
                  prediction.prediction.confidence === 'high' ? 'border-green-500 bg-green-50' :
                  prediction.prediction.confidence === 'medium' ? 'border-amber-500 bg-amber-50' :
                  'border-gray-300 bg-gray-50'
                }`}>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      {prediction.prediction.confidence === 'high' ? (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      ) : prediction.prediction.confidence === 'medium' ? (
                        <Target className="w-6 h-6 text-amber-600" />
                      ) : (
                        <AlertTriangle className="w-6 h-6 text-gray-600" />
                      )}
                      <div>
                        <p className="font-semibold capitalize">{prediction.prediction.confidence} Confidence Prediction</p>
                        <p className="text-sm text-muted-foreground">{prediction.prediction.confidenceReason}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Main Probabilities */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="shadow-md border-2 border-green-200 bg-gradient-to-b from-green-50 to-white">
                    <CardContent className="py-6 text-center">
                      <p className="text-sm text-muted-foreground uppercase tracking-wide">Home Win</p>
                      <p className="text-4xl font-bold text-green-600 mt-2">{prediction.prediction.homeWin}%</p>
                      {prediction.prediction.calibrated && (
                        <p className="text-sm font-semibold text-cyan-600 bg-cyan-50 rounded px-2 py-0.5 mt-1">
                          Calibrated: {prediction.prediction.calibrated.homeWin}%
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mt-2">xG: {prediction.prediction.homeXg}</p>
                      <p className="text-xs text-green-700 mt-1 font-medium">Odds: {prediction.prediction.impliedOdds.homeWin}</p>
                    </CardContent>
                  </Card>

                  <Card className="shadow-md border-2 border-amber-200 bg-gradient-to-b from-amber-50 to-white">
                    <CardContent className="py-6 text-center">
                      <p className="text-sm text-muted-foreground uppercase tracking-wide">Draw</p>
                      <p className="text-4xl font-bold text-amber-600 mt-2">{prediction.prediction.draw}%</p>
                      {prediction.prediction.calibrated && (
                        <p className="text-sm font-semibold text-cyan-600 bg-cyan-50 rounded px-2 py-0.5 mt-1">
                          Calibrated: {prediction.prediction.calibrated.draw}%
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mt-2">Most Likely: {prediction.prediction.likelyScore}</p>
                      <p className="text-xs text-amber-700 mt-1 font-medium">Odds: {prediction.prediction.impliedOdds.draw}</p>
                    </CardContent>
                  </Card>

                  <Card className="shadow-md border-2 border-blue-200 bg-gradient-to-b from-blue-50 to-white">
                    <CardContent className="py-6 text-center">
                      <p className="text-sm text-muted-foreground uppercase tracking-wide">Away Win</p>
                      <p className="text-4xl font-bold text-blue-600 mt-2">{prediction.prediction.awayWin}%</p>
                      {prediction.prediction.calibrated && (
                        <p className="text-sm font-semibold text-cyan-600 bg-cyan-50 rounded px-2 py-0.5 mt-1">
                          Calibrated: {prediction.prediction.calibrated.awayWin}%
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mt-2">xG: {prediction.prediction.awayXg}</p>
                      <p className="text-xs text-blue-700 mt-1 font-medium">Odds: {prediction.prediction.impliedOdds.awayWin}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Halftime Predictions */}
                <Card className="shadow-md border-2 border-cyan-200 bg-gradient-to-r from-cyan-50 to-sky-50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="w-5 h-5 text-cyan-600" />
                      Halftime Predictions
                    </CardTitle>
                    <CardDescription>First half result and expected goals</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center p-4 rounded-lg bg-white/70 border border-green-200">
                        <p className="text-sm text-muted-foreground">HT Home Win</p>
                        <p className="text-2xl font-bold text-green-600 mt-1">{prediction.prediction.htHomeWin}%</p>
                        <p className="text-xs text-green-700 mt-1">Odds: {prediction.prediction.impliedOdds.htHomeWin}</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-white/70 border border-amber-200">
                        <p className="text-sm text-muted-foreground">HT Draw</p>
                        <p className="text-2xl font-bold text-amber-600 mt-1">{prediction.prediction.htDraw}%</p>
                        <p className="text-xs text-amber-700 mt-1">Odds: {prediction.prediction.impliedOdds.htDraw}</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-white/70 border border-blue-200">
                        <p className="text-sm text-muted-foreground">HT Away Win</p>
                        <p className="text-2xl font-bold text-blue-600 mt-1">{prediction.prediction.htAwayWin}%</p>
                        <p className="text-xs text-blue-700 mt-1">Odds: {prediction.prediction.impliedOdds.htAwayWin}</p>
                      </div>
                    </div>
                    <div className="flex justify-center gap-8 text-sm">
                      <div className="text-center">
                        <p className="text-muted-foreground">HT xG (Home)</p>
                        <p className="font-bold text-lg">{prediction.prediction.htHomeXg}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">HT xG (Away)</p>
                        <p className="font-bold text-lg">{prediction.prediction.htAwayXg}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">Most Likely HT Score</p>
                        <p className="font-bold text-lg">{prediction.prediction.htLikelyScore} ({prediction.prediction.htLikelyScoreProb}%)</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-5 gap-2">
                      {prediction.prediction.htScoreMatrix.slice(0, 5).map((s, i) => (
                        <div key={i} className={`text-center p-2 rounded ${i === 0 ? 'bg-cyan-200 border border-cyan-400' : 'bg-white/50'}`}>
                          <p className="font-mono font-bold">{s.score}</p>
                          <p className="text-xs text-muted-foreground">{s.prob}%</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Score Matrix */}
                <Card className="shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg">Most Likely Scorelines</CardTitle>
                    <CardDescription>Top 10 predicted scores from Monte Carlo simulation</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-5 gap-3">
                      {prediction.prediction.scoreMatrix.map((s, i) => (
                        <div key={i} className={`text-center p-3 rounded-lg ${i === 0 ? 'bg-green-100 border-2 border-green-400' : 'bg-gray-50'}`}>
                          <p className="font-mono font-bold text-lg">{s.score}</p>
                          <p className="text-xs text-muted-foreground">{s.prob}%</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Team Statistics Comparison */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Home Team Stats */}
                  <Card className="shadow-md border-l-4 border-l-green-500">
                    <CardHeader>
                      <CardTitle className="text-lg">{predHomeTeam} (Home)</CardTitle>
                      <CardDescription>Team statistics</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {prediction.homeTeamStats && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Attack Strength</p>
                              <p className="text-xl font-bold">{(prediction.homeTeamStats.attack * 100).toFixed(0)}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Defense Strength</p>
                              <p className="text-xl font-bold">{(prediction.homeTeamStats.defense * 100).toFixed(0)}%</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Avg Goals Scored</p>
                              <p className="font-semibold">{prediction.homeTeamStats.avgScored.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Avg Goals Conceded</p>
                              <p className="font-semibold">{prediction.homeTeamStats.avgConceded.toFixed(2)}</p>
                            </div>
                          </div>
                          <div className="pt-2 border-t">
                            <p className="text-xs text-muted-foreground mb-1">Recent Form (Last 5)</p>
                            <div className="flex gap-1">
                              {prediction.homeTeamStats.recentForm.map((r, i) => (
                                <Badge key={i} className={`w-8 h-8 flex items-center justify-center ${
                                  r === 'W' ? 'bg-green-500' : r === 'D' ? 'bg-amber-500' : 'bg-red-500'
                                }`}>
                                  {r}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Games: {prediction.homeTeamStats.totalGames}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">W/D/L: {prediction.homeTeamStats.wins}/{prediction.homeTeamStats.draws}/{prediction.homeTeamStats.losses}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Away Team Stats */}
                  <Card className="shadow-md border-l-4 border-l-blue-500">
                    <CardHeader>
                      <CardTitle className="text-lg">{predAwayTeam} (Away)</CardTitle>
                      <CardDescription>Team statistics</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {prediction.awayTeamStats && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Attack Strength</p>
                              <p className="text-xl font-bold">{(prediction.awayTeamStats.attack * 100).toFixed(0)}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Defense Strength</p>
                              <p className="text-xl font-bold">{(prediction.awayTeamStats.defense * 100).toFixed(0)}%</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Avg Goals Scored</p>
                              <p className="font-semibold">{prediction.awayTeamStats.avgScored.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Avg Goals Conceded</p>
                              <p className="font-semibold">{prediction.awayTeamStats.avgConceded.toFixed(2)}</p>
                            </div>
                          </div>
                          <div className="pt-2 border-t">
                            <p className="text-xs text-muted-foreground mb-1">Recent Form (Last 5)</p>
                            <div className="flex gap-1">
                              {prediction.awayTeamStats.recentForm.map((r, i) => (
                                <Badge key={i} className={`w-8 h-8 flex items-center justify-center ${
                                  r === 'W' ? 'bg-green-500' : r === 'D' ? 'bg-amber-500' : 'bg-red-500'
                                }`}>
                                  {r}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Games: {prediction.awayTeamStats.totalGames}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">W/D/L: {prediction.awayTeamStats.wins}/{prediction.awayTeamStats.draws}/{prediction.awayTeamStats.losses}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* H2H & League Insights */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* H2H Stats */}
                  <Card className="shadow-md">
                    <CardHeader>
                      <CardTitle className="text-lg">Head-to-Head History</CardTitle>
                      <CardDescription>Historical matchups between these teams</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {prediction.h2hStats.totalMatches > 0 ? (
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span>Total Meetings</span>
                            <Badge variant="secondary">{prediction.h2hStats.totalMatches}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>{predHomeTeam} Wins</span>
                            <Badge style={{ backgroundColor: COLORS.homeWin }} className="text-white">{prediction.h2hStats.homeTeamWins}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Draws</span>
                            <Badge style={{ backgroundColor: COLORS.draw }} className="text-white">{prediction.h2hStats.draws}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>{predAwayTeam} Wins</span>
                            <Badge style={{ backgroundColor: COLORS.awayWin }} className="text-white">{prediction.h2hStats.awayTeamWins}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Avg Goals/Game</span>
                            <Badge variant="outline">{prediction.h2hStats.avgGoals}</Badge>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-4">No historical matchups found</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* League Insights */}
                  <Card className="shadow-md">
                    <CardHeader>
                      <CardTitle className="text-lg">League Insights</CardTitle>
                      <CardDescription>League-wide statistics for context</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Avg Goals/Game</p>
                            <p className="font-semibold">{prediction.leagueInsights.avgGoalsPerGame}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">BTTS %</p>
                            <p className="font-semibold">{prediction.leagueInsights.bttsPercent}%</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Home Win %</p>
                            <p className="font-semibold">{prediction.leagueInsights.homeWinPercent}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Away Win %</p>
                            <p className="font-semibold">{prediction.leagueInsights.awayWinPercent}%</p>
                          </div>
                        </div>
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground mb-1">Best Attack</p>
                          <p className="font-semibold">{prediction.leagueInsights.bestAttack.team} ({prediction.leagueInsights.bestAttack.avg} goals/game)</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Best Defense</p>
                          <p className="font-semibold">{prediction.leagueInsights.bestDefense.team} ({prediction.leagueInsights.bestDefense.avg} conceded/game)</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Pattern Analysis */}
                <Card className="shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-600" />
                      League Pattern Analysis
                    </CardTitle>
                    <CardDescription>Identified patterns from historical data</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                        <p className="text-xs text-muted-foreground">BTTS Both Halves</p>
                        <p className="text-2xl font-bold text-indigo-600">{prediction.patternAnalysis.bttsPatterns.bothHalves}%</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                        <p className="text-xs text-muted-foreground">Comeback Rate</p>
                        <p className="text-2xl font-bold text-indigo-600">{prediction.patternAnalysis.comebackRate}%</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                        <p className="text-xs text-muted-foreground">1H Avg Goals</p>
                        <p className="text-2xl font-bold text-indigo-600">{prediction.patternAnalysis.goalTiming.avgFirstHalfGoals}</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                        <p className="text-xs text-muted-foreground">2H Avg Goals</p>
                        <p className="text-2xl font-bold text-indigo-600">{prediction.patternAnalysis.goalTiming.avgSecondHalfGoals}</p>
                      </div>
                    </div>
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-2">HT/FT Transitions (Home Lead →)</p>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="text-center p-2 bg-green-100 rounded">
                          <p className="text-xs text-muted-foreground">FT Win</p>
                          <p className="font-bold">{prediction.patternAnalysis.resultTransitions.htHomeLeadFtHomeWin}%</p>
                        </div>
                        <div className="text-center p-2 bg-amber-100 rounded">
                          <p className="text-xs text-muted-foreground">FT Draw</p>
                          <p className="font-bold">{prediction.patternAnalysis.resultTransitions.htHomeLeadFtDraw}%</p>
                        </div>
                        <div className="text-center p-2 bg-blue-100 rounded">
                          <p className="text-xs text-muted-foreground">FT Loss</p>
                          <p className="font-bold">{prediction.patternAnalysis.resultTransitions.htHomeLeadFtAwayWin}%</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Regression to Mean Analysis */}
                <Card className="shadow-md border-2 border-rose-300 bg-gradient-to-r from-rose-50 via-pink-50 to-orange-50 dark:from-rose-900/20 dark:via-pink-900/20 dark:to-orange-900/20">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-rose-600" />
                      📊 Regression to Mean Analysis
                    </CardTitle>
                    <CardDescription>
                      Identifies teams likely to regress toward their average - key for finding value bets
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      // Calculate team goal statistics
                      // First, sort results by date descending (most recent first)
                      const sortedResultsForRegression = [...results].sort((a, b) => {
                        const dateA = parseDateSafe(a.date)
                        const dateB = parseDateSafe(b.date)
                        return dateB.getTime() - dateA.getTime()
                      });

                      const teamGoalStats = new Map<string, {
                        matches: number;
                        goalsScored: number;
                        goalsConceded: number;
                        matchesThisSeason: number;
                        scoredThisSeason: number;
                        concededThisSeason: number;
                        last10Matches: { totalGoals: number }[];
                        last3Matches: { totalGoals: number }[];
                        allMatchGoals: number[]; // Track all match goal totals for distribution
                      }>();

                      sortedResultsForRegression.forEach(r => {
                        const totalGoals = r.ftHomeGoals + r.ftAwayGoals;
                        
                        // Home team
                        const homeStats = teamGoalStats.get(r.homeTeam) || {
                          matches: 0, goalsScored: 0, goalsConceded: 0,
                          matchesThisSeason: 0, scoredThisSeason: 0, concededThisSeason: 0,
                          last10Matches: [], last3Matches: [], allMatchGoals: []
                        };
                        homeStats.matches++;
                        homeStats.goalsScored += r.ftHomeGoals;
                        homeStats.goalsConceded += r.ftAwayGoals;
                        homeStats.matchesThisSeason++;
                        homeStats.scoredThisSeason += r.ftHomeGoals;
                        homeStats.concededThisSeason += r.ftAwayGoals;
                        homeStats.last10Matches.push({ totalGoals });
                        homeStats.last3Matches.push({ totalGoals });
                        homeStats.allMatchGoals.push(totalGoals);
                        teamGoalStats.set(r.homeTeam, homeStats);

                        // Away team
                        const awayStats = teamGoalStats.get(r.awayTeam) || {
                          matches: 0, goalsScored: 0, goalsConceded: 0,
                          matchesThisSeason: 0, scoredThisSeason: 0, concededThisSeason: 0,
                          last10Matches: [], last3Matches: [], allMatchGoals: []
                        };
                        awayStats.matches++;
                        awayStats.goalsScored += r.ftAwayGoals;
                        awayStats.goalsConceded += r.ftHomeGoals;
                        awayStats.matchesThisSeason++;
                        awayStats.scoredThisSeason += r.ftAwayGoals;
                        awayStats.concededThisSeason += r.ftHomeGoals;
                        awayStats.last10Matches.push({ totalGoals });
                        awayStats.last3Matches.push({ totalGoals });
                        awayStats.allMatchGoals.push(totalGoals);
                        teamGoalStats.set(r.awayTeam, awayStats);
                      });

                      // Get stats for home and away teams
                      const homeTeamData = teamGoalStats.get(predHomeTeam);
                      const awayTeamData = teamGoalStats.get(predAwayTeam);

                      if (!homeTeamData || !awayTeamData) return null;

                      // Calculate H2H data - filter and sort by date (most recent first)
                      const h2hData = results.filter(r => 
                        (r.homeTeam === predHomeTeam && r.awayTeam === predAwayTeam) ||
                        (r.homeTeam === predAwayTeam && r.awayTeam === predHomeTeam)
                      ).sort((a, b) => {
                        // Sort by date descending (most recent first)
                        const dateA = parseDateSafe(a.date)
                        const dateB = parseDateSafe(b.date)
                        return dateB.getTime() - dateA.getTime()
                      });
                      
                      const lastH2H = h2hData.length > 0 ? h2hData[0] : null;
                      const h2hAvgGoals = h2hData.length > 0 
                        ? h2hData.reduce((sum, m) => sum + m.ftHomeGoals + m.ftAwayGoals, 0) / h2hData.length 
                        : null;

                      // Calculate means for each team
                      const calculateTeamMeans = (teamData: typeof homeTeamData, teamName: string) => {
                        const seasonAvg = teamData.matchesThisSeason > 0 
                          ? (teamData.scoredThisSeason + teamData.concededThisSeason) / teamData.matchesThisSeason 
                          : 0;
                        
                        const last10 = teamData.last10Matches.slice(0, 10);
                        const last10Avg = last10.length > 0 
                          ? last10.reduce((sum, m) => sum + m.totalGoals, 0) / last10.length 
                          : 0;
                        
                        const last3 = teamData.last3Matches.slice(0, 3);
                        const last3Avg = last3.length > 0 
                          ? last3.reduce((sum, m) => sum + m.totalGoals, 0) / last3.length 
                          : 0;

                        // H2H specific for this team
                        const teamH2H = h2hData.filter(m => 
                          m.homeTeam === teamName || m.awayTeam === teamName
                        );
                        const teamH2HAvg = teamH2H.length > 0 
                          ? teamH2H.reduce((sum, m) => sum + m.ftHomeGoals + m.ftAwayGoals, 0) / teamH2H.length 
                          : null;

                        // Last H2H for this team
                        const teamLastH2H = lastH2H;

                        return {
                          seasonAvg,
                          last10Avg,
                          last3Avg,
                          h2hAvg: teamH2HAvg,
                          lastH2H: teamLastH2H,
                          lastH2HGoals: teamLastH2H ? teamLastH2H.ftHomeGoals + teamLastH2H.ftAwayGoals : null,
                          matches: teamData.matchesThisSeason
                        };
                      };

                      const homeMeans = calculateTeamMeans(homeTeamData, predHomeTeam);
                      const awayMeans = calculateTeamMeans(awayTeamData, predAwayTeam);

                      // Calculate deviation and signal
                      const calculateDeviation = (means: typeof homeMeans) => {
                        // Deviation from season average
                        const deviationFromSeason = means.last3Avg - means.seasonAvg;
                        
                        // Deviation from last 10 average  
                        const deviationFromLast10 = means.last3Avg - means.last10Avg;
                        
                        // H2H deviation
                        const h2hDeviation = means.h2hAvg && means.lastH2HGoals !== null
                          ? means.lastH2HGoals - means.h2hAvg
                          : 0;

                        // Combined signal
                        // Positive = last 3 games above mean = likely to regress DOWN (Under)
                        // Negative = last 3 games below mean = likely to regress UP (Over)
                        const combinedSignal = (deviationFromSeason * 0.4) + (deviationFromLast10 * 0.3) + (h2hDeviation * 0.3);
                        
                        let signal: 'Strong Over' | 'Over' | 'Neutral' | 'Under' | 'Strong Under' = 'Neutral';
                        let signalColor = 'text-gray-600';
                        let signalBg = 'bg-gray-100';
                        let signalEmoji = '➡️';

                        if (combinedSignal <= -0.8) {
                          signal = 'Strong Over';
                          signalColor = 'text-green-600';
                          signalBg = 'bg-green-100';
                          signalEmoji = '📈';
                        } else if (combinedSignal <= -0.3) {
                          signal = 'Over';
                          signalColor = 'text-emerald-600';
                          signalBg = 'bg-emerald-100';
                          signalEmoji = '↗️';
                        } else if (combinedSignal >= 0.8) {
                          signal = 'Strong Under';
                          signalColor = 'text-red-600';
                          signalBg = 'bg-red-100';
                          signalEmoji = '📉';
                        } else if (combinedSignal >= 0.3) {
                          signal = 'Under';
                          signalColor = 'text-orange-600';
                          signalBg = 'bg-orange-100';
                          signalEmoji = '↘️';
                        }

                        return {
                          deviationFromSeason,
                          deviationFromLast10,
                          h2hDeviation,
                          combinedSignal,
                          signal,
                          signalColor,
                          signalBg,
                          signalEmoji
                        };
                      };

                      const homeDeviation = calculateDeviation(homeMeans);
                      const awayDeviation = calculateDeviation(awayMeans);

                      // Combined match signal
                      const getCombinedSignal = () => {
                        const totalSignal = homeDeviation.combinedSignal + awayDeviation.combinedSignal;
                        
                        if (totalSignal <= -1.2) {
                          return {
                            recommendation: 'STRONG OVER SIGNAL',
                            description: 'Both teams likely to regress UP toward mean - expect more goals',
                            color: 'text-green-600',
                            bg: 'bg-green-100 border-green-300',
                            emoji: '🔥 OVER'
                          };
                        } else if (totalSignal <= -0.5) {
                          return {
                            recommendation: 'OVER SIGNAL',
                            description: 'Teams showing Under form, likely to regress up',
                            color: 'text-emerald-600',
                            bg: 'bg-emerald-100 border-emerald-300',
                            emoji: '↗️ OVER'
                          };
                        } else if (totalSignal >= 1.2) {
                          return {
                            recommendation: 'STRONG UNDER SIGNAL',
                            description: 'Both teams likely to regress DOWN toward mean - expect fewer goals',
                            color: 'text-red-600',
                            bg: 'bg-red-100 border-red-300',
                            emoji: '📉 UNDER'
                          };
                        } else if (totalSignal >= 0.5) {
                          return {
                            recommendation: 'UNDER SIGNAL',
                            description: 'Teams showing Over form, likely to regress down',
                            color: 'text-orange-600',
                            bg: 'bg-orange-100 border-orange-300',
                            emoji: '↘️ UNDER'
                          };
                        } else {
                          return {
                            recommendation: 'MIXED SIGNALS',
                            description: 'Teams deviating in opposite directions - proceed with caution',
                            color: 'text-amber-600',
                            bg: 'bg-amber-100 border-amber-300',
                            emoji: '⚠️ CAUTION'
                          };
                        }
                      };

                      const combinedSignal = getCombinedSignal();

                      return (
                        <div className="space-y-4">
                          {/* Explanation */}
                          <div className="p-3 rounded-lg bg-gradient-to-r from-rose-100/50 to-pink-100/50 dark:from-rose-800/20 dark:to-pink-800/20 text-sm">
                            <p className="text-muted-foreground">
                              <strong>Regression to Mean:</strong> Teams that performed above/below their average are statistically likely to return to normal. 
                              <span className="text-green-600 font-medium"> Negative deviation = likely MORE goals</span>
                              <span className="text-red-600 font-medium"> • Positive deviation = likely FEWER goals</span>
                            </p>
                          </div>

                          {/* Team Stats Grid */}
                          <div className="grid md:grid-cols-2 gap-4">
                            {/* Home Team */}
                            <div className={`p-4 rounded-xl border-2 ${homeDeviation.signalBg} border-rose-200 dark:border-rose-700`}>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-bold text-green-700 dark:text-green-300">{predHomeTeam} (Home)</h4>
                                <Badge className={`${homeDeviation.signalColor} ${homeDeviation.signalBg} border`}>
                                  {homeDeviation.signalEmoji} {homeDeviation.signal}
                                </Badge>
                              </div>
                              
                              <div className="space-y-2 text-sm">
                                {/* Season Average */}
                                <div className="flex justify-between items-center p-2 rounded bg-white/50 dark:bg-gray-800/50">
                                  <span className="text-muted-foreground">Season Avg (All matches)</span>
                                  <span className="font-bold">{homeMeans.seasonAvg.toFixed(2)} goals/game</span>
                                </div>
                                
                                {/* Last 10 Average */}
                                <div className="flex justify-between items-center p-2 rounded bg-white/50 dark:bg-gray-800/50">
                                  <span className="text-muted-foreground">Last 10 Matches Avg</span>
                                  <span className="font-bold">{homeMeans.last10Avg.toFixed(2)} goals/game</span>
                                </div>
                                
                                {/* Last 3 Average */}
                                <div className="flex justify-between items-center p-2 rounded bg-white/50 dark:bg-gray-800/50">
                                  <span className="text-muted-foreground">Last 3 Matches Avg</span>
                                  <span className={`font-bold ${homeDeviation.deviationFromSeason < 0 ? 'text-blue-600' : homeDeviation.deviationFromSeason > 0 ? 'text-orange-600' : ''}`}>
                                    {homeMeans.last3Avg.toFixed(2)} goals/game
                                  </span>
                                </div>

                                {/* Deviation Indicators */}
                                <div className="pt-2 border-t border-rose-200 dark:border-rose-700">
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className={`p-2 rounded ${homeDeviation.deviationFromSeason < 0 ? 'bg-green-100 dark:bg-green-800/30' : homeDeviation.deviationFromSeason > 0 ? 'bg-red-100 dark:bg-red-800/30' : 'bg-gray-100 dark:bg-gray-800/30'}`}>
                                      <p className="text-muted-foreground">vs Season</p>
                                      <p className={`font-bold ${homeDeviation.deviationFromSeason < 0 ? 'text-green-600' : homeDeviation.deviationFromSeason > 0 ? 'text-red-600' : ''}`}>
                                        {homeDeviation.deviationFromSeason > 0 ? '+' : ''}{homeDeviation.deviationFromSeason.toFixed(2)}
                                      </p>
                                    </div>
                                    <div className={`p-2 rounded ${homeDeviation.deviationFromLast10 < 0 ? 'bg-green-100 dark:bg-green-800/30' : homeDeviation.deviationFromLast10 > 0 ? 'bg-red-100 dark:bg-red-800/30' : 'bg-gray-100 dark:bg-gray-800/30'}`}>
                                      <p className="text-muted-foreground">vs Last 10</p>
                                      <p className={`font-bold ${homeDeviation.deviationFromLast10 < 0 ? 'text-green-600' : homeDeviation.deviationFromLast10 > 0 ? 'text-red-600' : ''}`}>
                                        {homeDeviation.deviationFromLast10 > 0 ? '+' : ''}{homeDeviation.deviationFromLast10.toFixed(2)}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* H2H Data */}
                                {homeMeans.h2hAvg !== null && (
                                  <div className="pt-2 border-t border-rose-200 dark:border-rose-700">
                                    <div className="flex justify-between items-center p-2 rounded bg-purple-50 dark:bg-purple-800/20">
                                      <span className="text-muted-foreground">H2H Avg vs {predAwayTeam}</span>
                                      <span className="font-bold text-purple-600">{homeMeans.h2hAvg.toFixed(2)} goals</span>
                                    </div>
                                    {homeMeans.lastH2H && (
                                      <div className="flex justify-between items-center p-2 rounded bg-indigo-50 dark:bg-indigo-800/20 mt-1">
                                        <span className="text-muted-foreground">Last H2H Result</span>
                                        <span className={`font-bold ${homeMeans.lastH2HGoals !== null && homeMeans.lastH2HGoals < homeMeans.h2hAvg ? 'text-blue-600' : 'text-orange-600'}`}>
                                          {homeMeans.lastH2H.ftHomeGoals}-{homeMeans.lastH2H.ftAwayGoals} ({homeMeans.lastH2HGoals} goals)
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Away Team */}
                            <div className={`p-4 rounded-xl border-2 ${awayDeviation.signalBg} border-blue-200 dark:border-blue-700`}>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-bold text-blue-700 dark:text-blue-300">{predAwayTeam} (Away)</h4>
                                <Badge className={`${awayDeviation.signalColor} ${awayDeviation.signalBg} border`}>
                                  {awayDeviation.signalEmoji} {awayDeviation.signal}
                                </Badge>
                              </div>
                              
                              <div className="space-y-2 text-sm">
                                {/* Season Average */}
                                <div className="flex justify-between items-center p-2 rounded bg-white/50 dark:bg-gray-800/50">
                                  <span className="text-muted-foreground">Season Avg (All matches)</span>
                                  <span className="font-bold">{awayMeans.seasonAvg.toFixed(2)} goals/game</span>
                                </div>
                                
                                {/* Last 10 Average */}
                                <div className="flex justify-between items-center p-2 rounded bg-white/50 dark:bg-gray-800/50">
                                  <span className="text-muted-foreground">Last 10 Matches Avg</span>
                                  <span className="font-bold">{awayMeans.last10Avg.toFixed(2)} goals/game</span>
                                </div>
                                
                                {/* Last 3 Average */}
                                <div className="flex justify-between items-center p-2 rounded bg-white/50 dark:bg-gray-800/50">
                                  <span className="text-muted-foreground">Last 3 Matches Avg</span>
                                  <span className={`font-bold ${awayDeviation.deviationFromSeason < 0 ? 'text-blue-600' : awayDeviation.deviationFromSeason > 0 ? 'text-orange-600' : ''}`}>
                                    {awayMeans.last3Avg.toFixed(2)} goals/game
                                  </span>
                                </div>

                                {/* Deviation Indicators */}
                                <div className="pt-2 border-t border-blue-200 dark:border-blue-700">
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className={`p-2 rounded ${awayDeviation.deviationFromSeason < 0 ? 'bg-green-100 dark:bg-green-800/30' : awayDeviation.deviationFromSeason > 0 ? 'bg-red-100 dark:bg-red-800/30' : 'bg-gray-100 dark:bg-gray-800/30'}`}>
                                      <p className="text-muted-foreground">vs Season</p>
                                      <p className={`font-bold ${awayDeviation.deviationFromSeason < 0 ? 'text-green-600' : awayDeviation.deviationFromSeason > 0 ? 'text-red-600' : ''}`}>
                                        {awayDeviation.deviationFromSeason > 0 ? '+' : ''}{awayDeviation.deviationFromSeason.toFixed(2)}
                                      </p>
                                    </div>
                                    <div className={`p-2 rounded ${awayDeviation.deviationFromLast10 < 0 ? 'bg-green-100 dark:bg-green-800/30' : awayDeviation.deviationFromLast10 > 0 ? 'bg-red-100 dark:bg-red-800/30' : 'bg-gray-100 dark:bg-gray-800/30'}`}>
                                      <p className="text-muted-foreground">vs Last 10</p>
                                      <p className={`font-bold ${awayDeviation.deviationFromLast10 < 0 ? 'text-green-600' : awayDeviation.deviationFromLast10 > 0 ? 'text-red-600' : ''}`}>
                                        {awayDeviation.deviationFromLast10 > 0 ? '+' : ''}{awayDeviation.deviationFromLast10.toFixed(2)}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* H2H Data */}
                                {awayMeans.h2hAvg !== null && (
                                  <div className="pt-2 border-t border-blue-200 dark:border-blue-700">
                                    <div className="flex justify-between items-center p-2 rounded bg-purple-50 dark:bg-purple-800/20">
                                      <span className="text-muted-foreground">H2H Avg vs {predHomeTeam}</span>
                                      <span className="font-bold text-purple-600">{awayMeans.h2hAvg.toFixed(2)} goals</span>
                                    </div>
                                    {awayMeans.lastH2H && (
                                      <div className="flex justify-between items-center p-2 rounded bg-indigo-50 dark:bg-indigo-800/20 mt-1">
                                        <span className="text-muted-foreground">Last H2H Result</span>
                                        <span className={`font-bold ${awayMeans.lastH2HGoals !== null && awayMeans.lastH2HGoals < awayMeans.h2hAvg ? 'text-blue-600' : 'text-orange-600'}`}>
                                          {awayMeans.lastH2H.ftHomeGoals}-{awayMeans.lastH2H.ftAwayGoals} ({awayMeans.lastH2HGoals} goals)
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Distribution Shape - 5 Point Summary */}
                          {(() => {
                            // Calculate 5-point summary for each team
                            const calculateFivePointSummary = (goals: number[]) => {
                              if (goals.length === 0) return null;
                              
                              const sorted = [...goals].sort((a, b) => a - b);
                              const n = sorted.length;
                              
                              const min = sorted[0];
                              const max = sorted[n - 1];
                              const median = n % 2 === 0 
                                ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 
                                : sorted[Math.floor(n / 2)];
                              
                              // Q1 is median of lower half
                              const lowerHalf = sorted.slice(0, Math.floor(n / 2));
                              const q1 = lowerHalf.length > 0 
                                ? (lowerHalf.length % 2 === 0 
                                  ? (lowerHalf[lowerHalf.length / 2 - 1] + lowerHalf[lowerHalf.length / 2]) / 2 
                                  : lowerHalf[Math.floor(lowerHalf.length / 2)])
                                : min;
                              
                              // Q3 is median of upper half
                              const upperHalf = sorted.slice(Math.ceil(n / 2));
                              const q3 = upperHalf.length > 0 
                                ? (upperHalf.length % 2 === 0 
                                  ? (upperHalf[upperHalf.length / 2 - 1] + upperHalf[upperHalf.length / 2]) / 2 
                                  : upperHalf[Math.floor(upperHalf.length / 2)])
                                : max;
                              
                              return { min, q1, median, q3, max, count: n };
                            };

                            const homeSummary = calculateFivePointSummary(homeTeamData?.allMatchGoals || []);
                            const awaySummary = calculateFivePointSummary(awayTeamData?.allMatchGoals || []);

                            if (!homeSummary || !awaySummary) return null;

                            // Find global min/max for scaling
                            const globalMin = Math.min(homeSummary.min, awaySummary.min);
                            const globalMax = Math.max(homeSummary.max, awaySummary.max);
                            const range = globalMax - globalMin || 1;

                            // Helper to calculate position percentage
                            const getPosition = (value: number) => ((value - globalMin) / range) * 100;

                            // Box plot component
                            const BoxPlot = ({ summary, last3Avg, color, bgColor }: { 
                              summary: typeof homeSummary; 
                              last3Avg: number;
                              color: string;
                              bgColor: string;
                            }) => {
                              const last3Position = getPosition(last3Avg);
                              
                              return (
                                <div className="space-y-2">
                                  {/* Visual Box Plot */}
                                  <div className="relative h-12 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                                    {/* Whisker line (min to max) */}
                                    <div 
                                      className="absolute top-1/2 h-0.5 bg-gray-400"
                                      style={{ left: `${getPosition(summary.min)}%`, width: `${getPosition(summary.max) - getPosition(summary.min)}%`, transform: 'translateY(-50%)' }}
                                    />
                                    
                                    {/* Min marker */}
                                    <div 
                                      className="absolute top-1/2 w-1 h-4 bg-gray-600 rounded transform -translate-y-1/2"
                                      style={{ left: `${getPosition(summary.min)}%` }}
                                    />
                                    
                                    {/* Max marker */}
                                    <div 
                                      className="absolute top-1/2 w-1 h-4 bg-gray-600 rounded transform -translate-y-1/2"
                                      style={{ left: `${getPosition(summary.max)}%` }}
                                    />
                                    
                                    {/* IQR Box (Q1 to Q3) */}
                                    <div 
                                      className={`absolute top-1/2 h-8 ${bgColor} border-2 border-current rounded transform -translate-y-1/2`}
                                      style={{ left: `${getPosition(summary.q1)}%`, width: `${Math.max(2, getPosition(summary.q3) - getPosition(summary.q1))}%` }}
                                    />
                                    
                                    {/* Median line */}
                                    <div 
                                      className={`absolute top-1/2 h-10 ${color} rounded transform -translate-y-1/2`}
                                      style={{ left: `${getPosition(summary.median)}%`, width: '3px' }}
                                    />
                                    
                                    {/* Last 3 Average marker */}
                                    <div 
                                      className="absolute top-1/2 w-3 h-3 bg-yellow-400 border-2 border-yellow-600 rounded-full transform -translate-y-1/2 z-10"
                                      style={{ left: `calc(${last3Position}% - 6px)` }}
                                      title={`Last 3 Avg: ${last3Avg.toFixed(2)}`}
                                    />
                                  </div>
                                  
                                  {/* Scale labels */}
                                  <div className="flex justify-between text-xs text-muted-foreground px-1">
                                    <span>{summary.min}</span>
                                    <span className="text-blue-600 font-medium">Q1: {summary.q1.toFixed(1)}</span>
                                    <span className={`${color} font-bold`}>Med: {summary.median.toFixed(1)}</span>
                                    <span className="text-blue-600 font-medium">Q3: {summary.q3.toFixed(1)}</span>
                                    <span>{summary.max}</span>
                                  </div>
                                  
                                  {/* 5-Point Summary Stats */}
                                  <div className="grid grid-cols-5 gap-1 text-xs">
                                    <div className="text-center p-1 rounded bg-gray-50 dark:bg-gray-800">
                                      <p className="text-muted-foreground">Min</p>
                                      <p className="font-bold">{summary.min}</p>
                                    </div>
                                    <div className="text-center p-1 rounded bg-blue-50 dark:bg-blue-900/30">
                                      <p className="text-muted-foreground">Q1</p>
                                      <p className="font-bold text-blue-600">{summary.q1.toFixed(1)}</p>
                                    </div>
                                    <div className="text-center p-1 rounded bg-purple-50 dark:bg-purple-900/30">
                                      <p className="text-muted-foreground">Median</p>
                                      <p className="font-bold text-purple-600">{summary.median.toFixed(1)}</p>
                                    </div>
                                    <div className="text-center p-1 rounded bg-blue-50 dark:bg-blue-900/30">
                                      <p className="text-muted-foreground">Q3</p>
                                      <p className="font-bold text-blue-600">{summary.q3.toFixed(1)}</p>
                                    </div>
                                    <div className="text-center p-1 rounded bg-gray-50 dark:bg-gray-800">
                                      <p className="text-muted-foreground">Max</p>
                                      <p className="font-bold">{summary.max}</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            };

                            return (
                              <div className="space-y-4">
                                <div className="p-3 rounded-lg bg-gradient-to-r from-violet-100/50 to-purple-100/50 dark:from-violet-800/20 dark:to-purple-800/20">
                                  <h4 className="font-semibold text-violet-700 dark:text-violet-300 mb-3 flex items-center gap-2">
                                    <span>📊</span> Goal Distribution (5-Point Summary)
                                  </h4>
                                  <p className="text-xs text-muted-foreground mb-4">
                                    Box plot showing goal distribution across all matches. 
                                    <span className="text-yellow-600 font-medium"> Yellow dot</span> = Last 3 games average (current form position)
                                  </p>
                                  
                                  <div className="grid md:grid-cols-2 gap-6">
                                    {/* Home Team Distribution */}
                                    <div className="space-y-2">
                                      <h5 className="text-sm font-medium text-green-700 dark:text-green-300">{predHomeTeam}</h5>
                                      <BoxPlot 
                                        summary={homeSummary} 
                                        last3Avg={homeMeans.last3Avg}
                                        color="text-green-600"
                                        bgColor="bg-green-200 dark:bg-green-800"
                                      />
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">Matches: {homeSummary.count}</span>
                                        <span className="text-yellow-600 font-medium">
                                          Last 3 Avg: {homeMeans.last3Avg.toFixed(2)} 
                                          {homeMeans.last3Avg < homeSummary.median ? ' ↓ Below median' : homeMeans.last3Avg > homeSummary.median ? ' ↑ Above median' : ' = At median'}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    {/* Away Team Distribution */}
                                    <div className="space-y-2">
                                      <h5 className="text-sm font-medium text-blue-700 dark:text-blue-300">{predAwayTeam}</h5>
                                      <BoxPlot 
                                        summary={awaySummary} 
                                        last3Avg={awayMeans.last3Avg}
                                        color="text-blue-600"
                                        bgColor="bg-blue-200 dark:bg-blue-800"
                                      />
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">Matches: {awaySummary.count}</span>
                                        <span className="text-yellow-600 font-medium">
                                          Last 3 Avg: {awayMeans.last3Avg.toFixed(2)}
                                          {awayMeans.last3Avg < awaySummary.median ? ' ↓ Below median' : awayMeans.last3Avg > awaySummary.median ? ' ↑ Above median' : ' = At median'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Combined Signal */}
                          <div className={`p-4 rounded-xl border-2 ${combinedSignal.bg}`}>
                            <div className="text-center">
                              <p className="text-2xl font-bold {combinedSignal.color}">{combinedSignal.emoji}</p>
                              <p className={`text-xl font-bold ${combinedSignal.color}`}>{combinedSignal.recommendation}</p>
                              <p className="text-sm text-muted-foreground mt-2">{combinedSignal.description}</p>
                            </div>
                          </div>

                          {/* Strategy Tips */}
                          <div className="p-3 rounded-lg bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-800/20 dark:to-purple-800/20">
                            <p className="text-sm">
                              <span className="font-semibold text-indigo-700 dark:text-indigo-300">💡 Strategy:</span>{' '}
                              {combinedSignal.recommendation.includes('OVER') 
                                ? 'Consider Over 1.5 or Over 2.5 goals. Teams due for goal increase based on regression analysis.'
                                : combinedSignal.recommendation.includes('UNDER')
                                ? 'Consider Under 2.5 or Under 3.5 goals. Teams due for goal decrease based on regression analysis.'
                                : 'Wait for clearer signals or check other indicators before placing goals-based bets.'}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* xG Overperformance/Underperformance Analysis */}
                <Card className="shadow-md border-2 border-cyan-300 bg-gradient-to-r from-cyan-50 via-teal-50 to-emerald-50 dark:from-cyan-900/20 dark:via-teal-900/20 dark:to-emerald-900/20">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="w-5 h-5 text-cyan-600" />
                      🎯 xG Overperformance/Underperformance
                    </CardTitle>
                    <CardDescription>
                      Compare actual goals vs expected goals (xG) - identifies lucky/unlucky teams due for regression
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      // Calculate xG and actual goals for each team
                      // Formula: xG = (Shots on Target × 0.30) + (Shots off Target × 0.08)
                      const teamXgStats = new Map<string, {
                        matches: number;
                        totalXg: number;
                        actualGoals: number;
                        totalXgConceded: number;
                        actualConceded: number;
                        shotsOnTarget: number;
                        shotsOffTarget: number;
                      }>();

                      results.forEach(r => {
                        const homeShotsOff = r.homeShots - r.homeShotsOnTarget;
                        const awayShotsOff = r.awayShots - r.awayShotsOnTarget;
                        
                        const homeXg = (r.homeShotsOnTarget * 0.30) + (homeShotsOff * 0.08);
                        const awayXg = (r.awayShotsOnTarget * 0.30) + (awayShotsOff * 0.08);

                        // Home team
                        const homeStats = teamXgStats.get(r.homeTeam) || {
                          matches: 0, totalXg: 0, actualGoals: 0, totalXgConceded: 0, actualConceded: 0,
                          shotsOnTarget: 0, shotsOffTarget: 0
                        };
                        homeStats.matches++;
                        homeStats.totalXg += homeXg;
                        homeStats.actualGoals += r.ftHomeGoals;
                        homeStats.totalXgConceded += awayXg;
                        homeStats.actualConceded += r.ftAwayGoals;
                        homeStats.shotsOnTarget += r.homeShotsOnTarget;
                        homeStats.shotsOffTarget += homeShotsOff;
                        teamXgStats.set(r.homeTeam, homeStats);

                        // Away team
                        const awayStats = teamXgStats.get(r.awayTeam) || {
                          matches: 0, totalXg: 0, actualGoals: 0, totalXgConceded: 0, actualConceded: 0,
                          shotsOnTarget: 0, shotsOffTarget: 0
                        };
                        awayStats.matches++;
                        awayStats.totalXg += awayXg;
                        awayStats.actualGoals += r.ftAwayGoals;
                        awayStats.totalXgConceded += homeXg;
                        awayStats.actualConceded += r.ftHomeGoals;
                        awayStats.shotsOnTarget += r.awayShotsOnTarget;
                        awayStats.shotsOffTarget += awayShotsOff;
                        teamXgStats.set(r.awayTeam, awayStats);
                      });

                      const homeTeamXg = teamXgStats.get(predHomeTeam);
                      const awayTeamXg = teamXgStats.get(predAwayTeam);

                      if (!homeTeamXg || !awayTeamXg) return null;

                      // Calculate performance metrics
                      const calculateXgMetrics = (stats: typeof homeTeamXg) => {
                        const avgXg = stats.totalXg / stats.matches;
                        const avgActual = stats.actualGoals / stats.matches;
                        const xgDiff = avgActual - avgXg; // Positive = overperforming, Negative = underperforming
                        const conversionRate = stats.shotsOnTarget > 0 
                          ? (stats.actualGoals / stats.shotsOnTarget) * 100 
                          : 0;
                        
                        // Expected conversion rate is ~30% for shots on target
                        const expectedConversion = 30;
                        const conversionDiff = conversionRate - expectedConversion;

                        // Attack performance rating
                        let attackStatus: 'HOT' | 'OVERPERFORMING' | 'NORMAL' | 'UNDERPERFORMING' | 'COLD' = 'NORMAL';
                        let attackColor = 'text-gray-600';
                        let attackBg = 'bg-gray-100';
                        let attackEmoji = '➡️';

                        if (xgDiff >= 0.5) {
                          attackStatus = 'HOT';
                          attackColor = 'text-red-600';
                          attackBg = 'bg-red-100';
                          attackEmoji = '🔥';
                        } else if (xgDiff >= 0.25) {
                          attackStatus = 'OVERPERFORMING';
                          attackColor = 'text-orange-600';
                          attackBg = 'bg-orange-100';
                          attackEmoji = '📈';
                        } else if (xgDiff <= -0.5) {
                          attackStatus = 'COLD';
                          attackColor = 'text-blue-600';
                          attackBg = 'bg-blue-100';
                          attackEmoji = '❄️';
                        } else if (xgDiff <= -0.25) {
                          attackStatus = 'UNDERPERFORMING';
                          attackColor = 'text-cyan-600';
                          attackBg = 'bg-cyan-100';
                          attackEmoji = '📉';
                        }

                        return {
                          avgXg,
                          avgActual,
                          xgDiff,
                          conversionRate,
                          conversionDiff,
                          attackStatus,
                          attackColor,
                          attackBg,
                          attackEmoji,
                          matches: stats.matches
                        };
                      };

                      const homeMetrics = calculateXgMetrics(homeTeamXg);
                      const awayMetrics = calculateXgMetrics(awayTeamXg);

                      // Combined signal
                      const getXgCombinedSignal = () => {
                        const totalDiff = homeMetrics.xgDiff + awayMetrics.xgDiff;
                        
                        if (totalDiff <= -0.7) {
                          return {
                            recommendation: 'GOALS DUE - Both Teams Cold',
                            description: 'Both teams underperforming xG significantly. Goals are statistically overdue.',
                            color: 'text-green-600',
                            bg: 'bg-green-100 border-green-300',
                            emoji: '🥶 GOALS INCOMING'
                          };
                        } else if (totalDiff <= -0.3) {
                          return {
                            recommendation: 'SLIGHT OVER SIGNAL',
                            description: 'Teams marginally underperforming xG. Expect regression toward mean.',
                            color: 'text-emerald-600',
                            bg: 'bg-emerald-100 border-emerald-300',
                            emoji: '↗️ OVER LEAN'
                          };
                        } else if (totalDiff >= 0.7) {
                          return {
                            recommendation: 'REGRESSION WARNING - Both Teams Hot',
                            description: 'Both teams significantly overperforming xG. Due for fewer goals.',
                            color: 'text-red-600',
                            bg: 'bg-red-100 border-red-300',
                            emoji: '🔥 UNDER LEAN'
                          };
                        } else if (totalDiff >= 0.3) {
                          return {
                            recommendation: 'SLIGHT UNDER SIGNAL',
                            description: 'Teams marginally overperforming xG. May see fewer goals.',
                            color: 'text-orange-600',
                            bg: 'bg-orange-100 border-orange-300',
                            emoji: '↘️ UNDER LEAN'
                          };
                        } else {
                          return {
                            recommendation: 'NEUTRAL - Mixed Signals',
                            description: 'Teams performing close to xG expectations. No strong signal.',
                            color: 'text-gray-600',
                            bg: 'bg-gray-100 border-gray-300',
                            emoji: '⚖️ NEUTRAL'
                          };
                        }
                      };

                      const xgSignal = getXgCombinedSignal();

                      return (
                        <div className="space-y-4">
                          {/* Explanation */}
                          <div className="p-3 rounded-lg bg-gradient-to-r from-cyan-100/50 to-teal-100/50 dark:from-cyan-800/20 dark:to-teal-800/20 text-sm">
                            <p className="text-muted-foreground">
                              <strong>xG Analysis:</strong> Compares actual goals vs expected goals from shots.
                              <span className="text-blue-600 font-medium"> Negative = underperforming (goals due)</span>
                              <span className="text-red-600 font-medium"> • Positive = overperforming (regression likely)</span>
                            </p>
                          </div>

                          {/* Team Stats Grid */}
                          <div className="grid md:grid-cols-2 gap-4">
                            {/* Home Team */}
                            <div className={`p-4 rounded-xl border-2 ${homeMetrics.attackBg} border-cyan-200 dark:border-cyan-700`}>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-bold text-green-700 dark:text-green-300">{predHomeTeam} (Home)</h4>
                                <Badge className={`${homeMetrics.attackColor} ${homeMetrics.attackBg} border`}>
                                  {homeMetrics.attackEmoji} {homeMetrics.attackStatus}
                                </Badge>
                              </div>
                              
                              <div className="space-y-2 text-sm">
                                {/* Expected Goals */}
                                <div className="flex justify-between items-center p-2 rounded bg-white/50 dark:bg-gray-800/50">
                                  <span className="text-muted-foreground">Expected Goals (xG) per game</span>
                                  <span className="font-bold text-cyan-600">{homeMetrics.avgXg.toFixed(2)}</span>
                                </div>
                                
                                {/* Actual Goals */}
                                <div className="flex justify-between items-center p-2 rounded bg-white/50 dark:bg-gray-800/50">
                                  <span className="text-muted-foreground">Actual Goals per game</span>
                                  <span className="font-bold">{homeMetrics.avgActual.toFixed(2)}</span>
                                </div>
                                
                                {/* xG Difference */}
                                <div className={`flex justify-between items-center p-2 rounded ${homeMetrics.xgDiff < 0 ? 'bg-blue-50 dark:bg-blue-800/30' : homeMetrics.xgDiff > 0 ? 'bg-orange-50 dark:bg-orange-800/30' : 'bg-gray-50 dark:bg-gray-800/30'}`}>
                                  <span className="text-muted-foreground">xG Difference</span>
                                  <span className={`font-bold ${homeMetrics.xgDiff < 0 ? 'text-blue-600' : homeMetrics.xgDiff > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                    {homeMetrics.xgDiff > 0 ? '+' : ''}{homeMetrics.xgDiff.toFixed(2)}
                                  </span>
                                </div>

                                {/* Conversion Rate */}
                                <div className="pt-2 border-t border-cyan-200 dark:border-cyan-700">
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="p-2 rounded bg-white/50 dark:bg-gray-800/50">
                                      <p className="text-muted-foreground">Shot Conversion</p>
                                      <p className={`font-bold ${homeMetrics.conversionDiff > 10 ? 'text-red-600' : homeMetrics.conversionDiff < -10 ? 'text-blue-600' : 'text-gray-600'}`}>
                                        {homeMetrics.conversionRate.toFixed(1)}%
                                      </p>
                                    </div>
                                    <div className="p-2 rounded bg-white/50 dark:bg-gray-800/50">
                                      <p className="text-muted-foreground">Expected Conv.</p>
                                      <p className="font-bold text-gray-600">~30%</p>
                                    </div>
                                  </div>
                                </div>

                                {/* Interpretation */}
                                <div className="pt-2 border-t border-cyan-200 dark:border-cyan-700">
                                  <p className="text-xs text-muted-foreground">
                                    {homeMetrics.xgDiff > 0.25 
                                      ? '⚠️ Overperforming: Scoring more than chances suggest. Regression likely.'
                                      : homeMetrics.xgDiff < -0.25
                                      ? '💡 Underperforming: Creating chances but not converting. Goals due.'
                                      : '✅ Performing as expected based on chance quality.'}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Away Team */}
                            <div className={`p-4 rounded-xl border-2 ${awayMetrics.attackBg} border-teal-200 dark:border-teal-700`}>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-bold text-blue-700 dark:text-blue-300">{predAwayTeam} (Away)</h4>
                                <Badge className={`${awayMetrics.attackColor} ${awayMetrics.attackBg} border`}>
                                  {awayMetrics.attackEmoji} {awayMetrics.attackStatus}
                                </Badge>
                              </div>
                              
                              <div className="space-y-2 text-sm">
                                {/* Expected Goals */}
                                <div className="flex justify-between items-center p-2 rounded bg-white/50 dark:bg-gray-800/50">
                                  <span className="text-muted-foreground">Expected Goals (xG) per game</span>
                                  <span className="font-bold text-cyan-600">{awayMetrics.avgXg.toFixed(2)}</span>
                                </div>
                                
                                {/* Actual Goals */}
                                <div className="flex justify-between items-center p-2 rounded bg-white/50 dark:bg-gray-800/50">
                                  <span className="text-muted-foreground">Actual Goals per game</span>
                                  <span className="font-bold">{awayMetrics.avgActual.toFixed(2)}</span>
                                </div>
                                
                                {/* xG Difference */}
                                <div className={`flex justify-between items-center p-2 rounded ${awayMetrics.xgDiff < 0 ? 'bg-blue-50 dark:bg-blue-800/30' : awayMetrics.xgDiff > 0 ? 'bg-orange-50 dark:bg-orange-800/30' : 'bg-gray-50 dark:bg-gray-800/30'}`}>
                                  <span className="text-muted-foreground">xG Difference</span>
                                  <span className={`font-bold ${awayMetrics.xgDiff < 0 ? 'text-blue-600' : awayMetrics.xgDiff > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                    {awayMetrics.xgDiff > 0 ? '+' : ''}{awayMetrics.xgDiff.toFixed(2)}
                                  </span>
                                </div>

                                {/* Conversion Rate */}
                                <div className="pt-2 border-t border-teal-200 dark:border-teal-700">
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="p-2 rounded bg-white/50 dark:bg-gray-800/50">
                                      <p className="text-muted-foreground">Shot Conversion</p>
                                      <p className={`font-bold ${awayMetrics.conversionDiff > 10 ? 'text-red-600' : awayMetrics.conversionDiff < -10 ? 'text-blue-600' : 'text-gray-600'}`}>
                                        {awayMetrics.conversionRate.toFixed(1)}%
                                      </p>
                                    </div>
                                    <div className="p-2 rounded bg-white/50 dark:bg-gray-800/50">
                                      <p className="text-muted-foreground">Expected Conv.</p>
                                      <p className="font-bold text-gray-600">~30%</p>
                                    </div>
                                  </div>
                                </div>

                                {/* Interpretation */}
                                <div className="pt-2 border-t border-teal-200 dark:border-teal-700">
                                  <p className="text-xs text-muted-foreground">
                                    {awayMetrics.xgDiff > 0.25 
                                      ? '⚠️ Overperforming: Scoring more than chances suggest. Regression likely.'
                                      : awayMetrics.xgDiff < -0.25
                                      ? '💡 Underperforming: Creating chances but not converting. Goals due.'
                                      : '✅ Performing as expected based on chance quality.'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Combined Signal */}
                          <div className={`p-4 rounded-xl border-2 ${xgSignal.bg}`}>
                            <div className="text-center">
                              <p className="text-2xl font-bold">{xgSignal.emoji}</p>
                              <p className={`text-xl font-bold ${xgSignal.color}`}>{xgSignal.recommendation}</p>
                              <p className="text-sm text-muted-foreground mt-2">{xgSignal.description}</p>
                            </div>
                          </div>

                          {/* Strategy Tips */}
                          <div className="p-3 rounded-lg bg-gradient-to-r from-cyan-100 to-emerald-100 dark:from-cyan-800/20 dark:to-emerald-800/20">
                            <p className="text-sm">
                              <span className="font-semibold text-cyan-700 dark:text-cyan-300">💡 Strategy:</span>{' '}
                              {xgSignal.recommendation.includes('GOALS DUE') || xgSignal.recommendation.includes('OVER LEAN')
                                ? 'Consider Over goals markets. Teams creating quality chances but not converting - goals statistically overdue.'
                                : xgSignal.recommendation.includes('REGRESSION') || xgSignal.recommendation.includes('UNDER LEAN')
                                ? 'Consider Under goals markets or proceed with caution. Teams outperforming xG significantly - regression expected.'
                                : 'No strong xG signal. Combine with other indicators like Regression to Mean for best results.'}
                            </p>
                          </div>

                          {/* Combined Analysis Hint */}
                          <div className="p-3 rounded-lg bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-800/20 dark:to-indigo-800/20">
                            <p className="text-sm">
                              <span className="font-semibold text-purple-700 dark:text-purple-300">🔗 Combined Insight:</span>{' '}
                              Combine xG analysis with Regression to Mean. Teams with <strong>negative xG difference AND below recent form</strong> = Strong Over signal. 
                              Teams with <strong>positive xG difference AND above recent form</strong> = Strong Under signal.
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Z-Score Analysis & Confidence Intervals */}
                <Card className="shadow-md border-2 border-violet-300 bg-gradient-to-r from-violet-50 via-purple-50 to-fuchsia-50 dark:from-violet-900/20 dark:via-purple-900/20 dark:to-fuchsia-900/20">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-violet-600" />
                      📊 Z-Score Analysis & Confidence Intervals
                    </CardTitle>
                    <CardDescription>
                      Statistical significance testing - identifies teams deviating significantly from their mean
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      // Calculate Z-Score and Confidence Intervals for each team
                      // First, sort results by date descending (most recent first)
                      const sortedResults = [...results].sort((a, b) => {
                        const dateA = parseDateSafe(a.date)
                        const dateB = parseDateSafe(b.date)
                        return dateB.getTime() - dateA.getTime()
                      });

                      const teamStats = new Map<string, {
                        matches: number;
                        goals: number[];
                        totalGoals: number;
                        mean: number;
                        variance: number;
                        stdDev: number;
                        last3: number[];
                        last3Avg: number;
                        last5: number[];
                        last5Avg: number;
                      }>();

                      sortedResults.forEach(r => {
                        const totalGoals = r.ftHomeGoals + r.ftAwayGoals;
                        
                        // Home team
                        const homeStats = teamStats.get(r.homeTeam) || {
                          matches: 0, goals: [], totalGoals: 0, mean: 0, variance: 0, stdDev: 0,
                          last3: [], last3Avg: 0, last5: [], last5Avg: 0
                        };
                        homeStats.matches++;
                        homeStats.goals.push(totalGoals);
                        homeStats.totalGoals += totalGoals;
                        teamStats.set(r.homeTeam, homeStats);

                        // Away team
                        const awayStats = teamStats.get(r.awayTeam) || {
                          matches: 0, goals: [], totalGoals: 0, mean: 0, variance: 0, stdDev: 0,
                          last3: [], last3Avg: 0, last5: [], last5Avg: 0
                        };
                        awayStats.matches++;
                        awayStats.goals.push(totalGoals);
                        awayStats.totalGoals += totalGoals;
                        teamStats.set(r.awayTeam, awayStats);
                      });

                      // Calculate statistics for each team
                      teamStats.forEach((stats, team) => {
                        stats.mean = stats.totalGoals / stats.matches;
                        // Goals array is now sorted by date (most recent first), so slice(0, 3) gets last 3
                        stats.last3 = stats.goals.slice(0, 3);
                        stats.last5 = stats.goals.slice(0, 5);
                        stats.last3Avg = stats.last3.length > 0 ? stats.last3.reduce((a, b) => a + b, 0) / stats.last3.length : 0;
                        stats.last5Avg = stats.last5.length > 0 ? stats.last5.reduce((a, b) => a + b, 0) / stats.last5.length : 0;
                        
                        // Calculate variance and standard deviation
                        const squaredDiffs = stats.goals.map(g => Math.pow(g - stats.mean, 2));
                        stats.variance = squaredDiffs.reduce((a, b) => a + b, 0) / stats.matches;
                        stats.stdDev = Math.sqrt(stats.variance);
                      });

                      const homeTeamStats = teamStats.get(predHomeTeam);
                      const awayTeamStats = teamStats.get(predAwayTeam);

                      if (!homeTeamStats || !awayTeamStats || homeTeamStats.matches < 3 || awayTeamStats.matches < 3) {
                        return (
                          <div className="text-center text-muted-foreground py-4">
                            Need at least 3 matches for each team to calculate Z-scores
                          </div>
                        );
                      }

                      // Calculate Z-Score (how many standard deviations from mean)
                      const calculateZScore = (stats: typeof homeTeamStats) => {
                        if (stats.stdDev === 0) return 0;
                        return (stats.last3Avg - stats.mean) / stats.stdDev;
                      };

                      const homeZScore = calculateZScore(homeTeamStats);
                      const awayZScore = calculateZScore(awayTeamStats);

                      // Calculate 95% Confidence Interval
                      const calculateCI = (stats: typeof homeTeamStats) => {
                        // 95% CI: mean ± 1.96 * (stdDev / sqrt(n))
                        const marginOfError = 1.96 * (stats.stdDev / Math.sqrt(stats.matches));
                        return {
                          lower: stats.mean - marginOfError,
                          upper: stats.mean + marginOfError,
                          margin: marginOfError
                        };
                      };

                      const homeCI = calculateCI(homeTeamStats);
                      const awayCI = calculateCI(awayTeamStats);

                      // Coefficient of Variation (consistency measure)
                      const calculateCV = (stats: typeof homeTeamStats) => {
                        if (stats.mean === 0) return 0;
                        return (stats.stdDev / stats.mean) * 100;
                      };

                      const homeCV = calculateCV(homeTeamStats);
                      const awayCV = calculateCV(awayTeamStats);

                      // Interpret Z-Score
                      const interpretZScore = (zScore: number) => {
                        if (zScore <= -2.0) {
                          return { 
                            signal: 'STRONG OVER', 
                            color: 'text-green-600', 
                            bg: 'bg-green-100',
                            emoji: '🔥',
                            description: 'Last 3 games 2+ SD below mean - Very strong regression signal'
                          };
                        } else if (zScore <= -1.5) {
                          return { 
                            signal: 'OVER SIGNAL', 
                            color: 'text-emerald-600', 
                            bg: 'bg-emerald-100',
                            emoji: '📈',
                            description: 'Last 3 games 1.5+ SD below mean - Strong regression signal'
                          };
                        } else if (zScore <= -1.0) {
                          return { 
                            signal: 'SLIGHT OVER', 
                            color: 'text-teal-600', 
                            bg: 'bg-teal-100',
                            emoji: '↗️',
                            description: 'Last 3 games 1+ SD below mean - Moderate regression signal'
                          };
                        } else if (zScore >= 2.0) {
                          return { 
                            signal: 'STRONG UNDER', 
                            color: 'text-red-600', 
                            bg: 'bg-red-100',
                            emoji: '📉',
                            description: 'Last 3 games 2+ SD above mean - Very strong regression signal'
                          };
                        } else if (zScore >= 1.5) {
                          return { 
                            signal: 'UNDER SIGNAL', 
                            color: 'text-orange-600', 
                            bg: 'bg-orange-100',
                            emoji: '↘️',
                            description: 'Last 3 games 1.5+ SD above mean - Strong regression signal'
                          };
                        } else if (zScore >= 1.0) {
                          return { 
                            signal: 'SLIGHT UNDER', 
                            color: 'text-amber-600', 
                            bg: 'bg-amber-100',
                            emoji: '➡️',
                            description: 'Last 3 games 1+ SD above mean - Moderate regression signal'
                          };
                        } else {
                          return { 
                            signal: 'NEUTRAL', 
                            color: 'text-gray-600', 
                            bg: 'bg-gray-100',
                            emoji: '⚖️',
                            description: 'Last 3 games within normal range'
                          };
                        }
                      };

                      const homeZInterpretation = interpretZScore(homeZScore);
                      const awayZInterpretation = interpretZScore(awayZScore);

                      // Check if last 3 avg is outside CI bounds
                      const homeBelowCI = homeTeamStats.last3Avg < homeCI.lower;
                      const homeAboveCI = homeTeamStats.last3Avg > homeCI.upper;
                      const awayBelowCI = awayTeamStats.last3Avg < awayCI.lower;
                      const awayAboveCI = awayTeamStats.last3Avg > awayCI.upper;

                      // Combined Over Signal
                      const getCombinedOverSignal = () => {
                        let score = 0;
                        let signals: string[] = [];

                        // Z-Score signals
                        if (homeZScore <= -1.5) { score += 2; signals.push('Home Z ≤ -1.5'); }
                        else if (homeZScore <= -1.0) { score += 1; signals.push('Home Z ≤ -1.0'); }
                        
                        if (awayZScore <= -1.5) { score += 2; signals.push('Away Z ≤ -1.5'); }
                        else if (awayZScore <= -1.0) { score += 1; signals.push('Away Z ≤ -1.0'); }

                        // CI signals
                        if (homeBelowCI) { score += 1; signals.push('Home below CI'); }
                        if (awayBelowCI) { score += 1; signals.push('Away below CI'); }

                        // CV signals (lower CV = more predictable regression)
                        if (homeCV < 35 && homeZScore < -1) { score += 0.5; signals.push('Home consistent'); }
                        if (awayCV < 35 && awayZScore < -1) { score += 0.5; signals.push('Away consistent'); }

                        // UNDER signals (positive Z = overperforming, regression downward expected)
                        if (homeZScore >= 1.5) { score -= 2; signals.push('Home Z ≥ 1.5'); }
                        else if (homeZScore >= 1.0) { score -= 1; signals.push('Home Z ≥ 1.0'); }
                        if (awayZScore >= 1.5) { score -= 2; signals.push('Away Z ≥ 1.5'); }
                        else if (awayZScore >= 1.0) { score -= 1; signals.push('Away Z ≥ 1.0'); }

                        // CI above signals
                        if (homeAboveCI) { score -= 1; signals.push('Home above CI'); }
                        if (awayAboveCI) { score -= 1; signals.push('Away above CI'); }

                        // CV signals for UNDER (consistent team overperforming)
                        if (homeCV < 35 && homeZScore > 1) { score -= 0.5; signals.push('Home consistent over'); }
                        if (awayCV < 35 && awayZScore > 1) { score -= 0.5; signals.push('Away consistent over'); }

                        if (score >= 4) {
                          return {
                            recommendation: '🔥🔥 EXCEPTIONAL OVER OPPORTUNITY',
                            description: 'Multiple strong statistical signals suggest both teams are significantly underperforming. High confidence regression play.',
                            color: 'text-green-600',
                            bg: 'bg-green-100 border-green-400',
                            signals,
                            score
                          };
                        } else if (score >= 2.5) {
                          return {
                            recommendation: '🔥 STRONG OVER SIGNAL',
                            description: 'Strong statistical evidence that goals are due. Consider Over 1.5 or Over 2.5.',
                            color: 'text-emerald-600',
                            bg: 'bg-emerald-100 border-emerald-400',
                            signals,
                            score
                          };
                        } else if (score >= 1) {
                          return {
                            recommendation: '↗️ MODERATE OVER SIGNAL',
                            description: 'Some statistical indicators suggest Over value. Combine with other analysis.',
                            color: 'text-teal-600',
                            bg: 'bg-teal-100 border-teal-400',
                            signals,
                            score
                          };
                        } else if (score <= -3) {
                          return {
                            recommendation: '📉 STRONG UNDER SIGNAL',
                            description: 'Teams significantly overperforming. Regression downward expected.',
                            color: 'text-red-600',
                            bg: 'bg-red-100 border-red-400',
                            signals,
                            score
                          };
                        } else if (score <= -1.5) {
                          return {
                            recommendation: '↘️ MODERATE UNDER SIGNAL',
                            description: 'Some statistical indicators suggest Under value. Teams overperforming, regression expected.',
                            color: 'text-orange-600',
                            bg: 'bg-orange-100 border-orange-400',
                            signals,
                            score
                          };
                        } else {
                          return {
                            recommendation: '⚖️ NEUTRAL / MIXED',
                            description: 'No strong Over/Under signal from Z-score analysis. Check other indicators.',
                            color: 'text-gray-600',
                            bg: 'bg-gray-100 border-gray-400',
                            signals,
                            score
                          };
                        }
                      };

                      const combinedSignal = getCombinedOverSignal();

                      return (
                        <div className="space-y-4">
                          {/* Explanation */}
                          <div className="p-3 rounded-lg bg-gradient-to-r from-violet-100/50 to-purple-100/50 dark:from-violet-800/20 dark:to-purple-800/20 text-sm">
                            <p className="text-muted-foreground">
                              <strong>Z-Score:</strong> Measures how many standard deviations recent form is from the mean.
                              <span className="text-green-600 font-medium"> Z &lt; -1 = due for MORE goals</span>
                              <span className="text-red-600 font-medium"> • Z &gt; 1 = due for FEWER goals</span>
                            </p>
                            <p className="text-muted-foreground mt-1">
                              <strong>Confidence Interval:</strong> 95% range where true average lies. Last 3 avg <span className="text-green-600 font-medium">below lower bound = Over signal</span>.
                            </p>
                          </div>

                          {/* Team Stats Grid */}
                          <div className="grid md:grid-cols-2 gap-4">
                            {/* Home Team */}
                            <div className={`p-4 rounded-xl border-2 ${homeZInterpretation.bg} border-violet-200 dark:border-violet-700`}>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-bold text-green-700 dark:text-green-300">{predHomeTeam} (Home)</h4>
                                <Badge className={`${homeZInterpretation.color} ${homeZInterpretation.bg} border`}>
                                  {homeZInterpretation.emoji} {homeZInterpretation.signal}
                                </Badge>
                              </div>
                              
                              <div className="space-y-2 text-sm">
                                {/* Z-Score */}
                                <div className="flex justify-between items-center p-2 rounded bg-white/50 dark:bg-gray-800/50">
                                  <span className="text-muted-foreground">Z-Score</span>
                                  <span className={`font-bold text-lg ${homeZScore < -1 ? 'text-green-600' : homeZScore > 1 ? 'text-red-600' : 'text-gray-600'}`}>
                                    {homeZScore.toFixed(2)}
                                  </span>
                                </div>

                                {/* Mean & StdDev */}
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="p-2 rounded bg-white/50 dark:bg-gray-800/50 text-center">
                                    <p className="text-xs text-muted-foreground">Mean (μ)</p>
                                    <p className="font-bold">{homeTeamStats.mean.toFixed(2)}</p>
                                  </div>
                                  <div className="p-2 rounded bg-white/50 dark:bg-gray-800/50 text-center">
                                    <p className="text-xs text-muted-foreground">Std Dev (σ)</p>
                                    <p className="font-bold">{homeTeamStats.stdDev.toFixed(2)}</p>
                                  </div>
                                </div>

                                {/* Last 3 vs Season */}
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="p-2 rounded bg-white/50 dark:bg-gray-800/50 text-center">
                                    <p className="text-xs text-muted-foreground">Season Avg</p>
                                    <p className="font-bold">{homeTeamStats.mean.toFixed(2)}</p>
                                  </div>
                                  <div className={`p-2 rounded text-center ${homeTeamStats.last3Avg < homeTeamStats.mean ? 'bg-green-100 dark:bg-green-800/30' : homeTeamStats.last3Avg > homeTeamStats.mean ? 'bg-red-100 dark:bg-red-800/30' : 'bg-white/50 dark:bg-gray-800/50'}`}>
                                    <p className="text-xs text-muted-foreground">Last 3 Avg</p>
                                    <p className={`font-bold ${homeTeamStats.last3Avg < homeTeamStats.mean ? 'text-green-600' : homeTeamStats.last3Avg > homeTeamStats.mean ? 'text-red-600' : ''}`}>
                                      {homeTeamStats.last3Avg.toFixed(2)}
                                    </p>
                                  </div>
                                </div>

                                {/* 95% Confidence Interval */}
                                <div className={`p-2 rounded ${homeBelowCI ? 'bg-green-100 dark:bg-green-800/30 border border-green-300' : homeAboveCI ? 'bg-red-100 dark:bg-red-800/30 border border-red-300' : 'bg-violet-50 dark:bg-violet-800/20'}`}>
                                  <p className="text-xs text-muted-foreground text-center">95% Confidence Interval</p>
                                  <div className="flex justify-center items-center gap-2">
                                    <span className="font-bold">{homeCI.lower.toFixed(2)}</span>
                                    <span className="text-muted-foreground">—</span>
                                    <span className="font-bold">{homeCI.upper.toFixed(2)}</span>
                                  </div>
                                  {homeBelowCI && (
                                    <p className="text-xs text-green-600 text-center mt-1 font-medium">
                                      ⬆️ Last 3 avg BELOW CI - Strong Over signal
                                    </p>
                                  )}
                                  {homeAboveCI && (
                                    <p className="text-xs text-red-600 text-center mt-1 font-medium">
                                      ⬇️ Last 3 avg ABOVE CI - Under signal
                                    </p>
                                  )}
                                </div>

                                {/* Coefficient of Variation */}
                                <div className="flex justify-between items-center p-2 rounded bg-white/50 dark:bg-gray-800/50">
                                  <span className="text-muted-foreground">Consistency (CV)</span>
                                  <span className={`font-bold ${homeCV < 30 ? 'text-green-600' : homeCV < 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                    {homeCV.toFixed(1)}%
                                    <span className="text-xs ml-1 text-muted-foreground">
                                      ({homeCV < 30 ? 'Very consistent' : homeCV < 50 ? 'Moderate' : 'Volatile'})
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Away Team */}
                            <div className={`p-4 rounded-xl border-2 ${awayZInterpretation.bg} border-purple-200 dark:border-purple-700`}>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-bold text-blue-700 dark:text-blue-300">{predAwayTeam} (Away)</h4>
                                <Badge className={`${awayZInterpretation.color} ${awayZInterpretation.bg} border`}>
                                  {awayZInterpretation.emoji} {awayZInterpretation.signal}
                                </Badge>
                              </div>
                              
                              <div className="space-y-2 text-sm">
                                {/* Z-Score */}
                                <div className="flex justify-between items-center p-2 rounded bg-white/50 dark:bg-gray-800/50">
                                  <span className="text-muted-foreground">Z-Score</span>
                                  <span className={`font-bold text-lg ${awayZScore < -1 ? 'text-green-600' : awayZScore > 1 ? 'text-red-600' : 'text-gray-600'}`}>
                                    {awayZScore.toFixed(2)}
                                  </span>
                                </div>

                                {/* Mean & StdDev */}
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="p-2 rounded bg-white/50 dark:bg-gray-800/50 text-center">
                                    <p className="text-xs text-muted-foreground">Mean (μ)</p>
                                    <p className="font-bold">{awayTeamStats.mean.toFixed(2)}</p>
                                  </div>
                                  <div className="p-2 rounded bg-white/50 dark:bg-gray-800/50 text-center">
                                    <p className="text-xs text-muted-foreground">Std Dev (σ)</p>
                                    <p className="font-bold">{awayTeamStats.stdDev.toFixed(2)}</p>
                                  </div>
                                </div>

                                {/* Last 3 vs Season */}
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="p-2 rounded bg-white/50 dark:bg-gray-800/50 text-center">
                                    <p className="text-xs text-muted-foreground">Season Avg</p>
                                    <p className="font-bold">{awayTeamStats.mean.toFixed(2)}</p>
                                  </div>
                                  <div className={`p-2 rounded text-center ${awayTeamStats.last3Avg < awayTeamStats.mean ? 'bg-green-100 dark:bg-green-800/30' : awayTeamStats.last3Avg > awayTeamStats.mean ? 'bg-red-100 dark:bg-red-800/30' : 'bg-white/50 dark:bg-gray-800/50'}`}>
                                    <p className="text-xs text-muted-foreground">Last 3 Avg</p>
                                    <p className={`font-bold ${awayTeamStats.last3Avg < awayTeamStats.mean ? 'text-green-600' : awayTeamStats.last3Avg > awayTeamStats.mean ? 'text-red-600' : ''}`}>
                                      {awayTeamStats.last3Avg.toFixed(2)}
                                    </p>
                                  </div>
                                </div>

                                {/* 95% Confidence Interval */}
                                <div className={`p-2 rounded ${awayBelowCI ? 'bg-green-100 dark:bg-green-800/30 border border-green-300' : awayAboveCI ? 'bg-red-100 dark:bg-red-800/30 border border-red-300' : 'bg-purple-50 dark:bg-purple-800/20'}`}>
                                  <p className="text-xs text-muted-foreground text-center">95% Confidence Interval</p>
                                  <div className="flex justify-center items-center gap-2">
                                    <span className="font-bold">{awayCI.lower.toFixed(2)}</span>
                                    <span className="text-muted-foreground">—</span>
                                    <span className="font-bold">{awayCI.upper.toFixed(2)}</span>
                                  </div>
                                  {awayBelowCI && (
                                    <p className="text-xs text-green-600 text-center mt-1 font-medium">
                                      ⬆️ Last 3 avg BELOW CI - Strong Over signal
                                    </p>
                                  )}
                                  {awayAboveCI && (
                                    <p className="text-xs text-red-600 text-center mt-1 font-medium">
                                      ⬇️ Last 3 avg ABOVE CI - Under signal
                                    </p>
                                  )}
                                </div>

                                {/* Coefficient of Variation */}
                                <div className="flex justify-between items-center p-2 rounded bg-white/50 dark:bg-gray-800/50">
                                  <span className="text-muted-foreground">Consistency (CV)</span>
                                  <span className={`font-bold ${awayCV < 30 ? 'text-green-600' : awayCV < 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                    {awayCV.toFixed(1)}%
                                    <span className="text-xs ml-1 text-muted-foreground">
                                      ({awayCV < 30 ? 'Very consistent' : awayCV < 50 ? 'Moderate' : 'Volatile'})
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Combined Signal */}
                          <div className={`p-4 rounded-xl border-2 ${combinedSignal.bg}`}>
                            <div className="text-center">
                              <p className="text-2xl font-bold">{combinedSignal.recommendation}</p>
                              <p className={`text-sm ${combinedSignal.color} mt-2`}>{combinedSignal.description}</p>
                              {combinedSignal.signals.length > 0 && (
                                <div className="mt-3 flex flex-wrap justify-center gap-2">
                                  {combinedSignal.signals.map((signal, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {signal}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Over Opportunity Highlight */}
                          {(homeZScore <= -1.5 || awayZScore <= -1.5 || homeBelowCI || awayBelowCI) && (
                            <div className="p-4 rounded-xl bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-800/30 dark:to-emerald-800/30 border-2 border-green-400">
                              <div className="flex items-start gap-3">
                                <span className="text-3xl">🎯</span>
                                <div>
                                  <h4 className="font-bold text-green-700 dark:text-green-300 text-lg">OVER OPPORTUNITY DETECTED</h4>
                                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                                    Statistical analysis shows one or both teams are significantly underperforming their mean.
                                    This presents a potential value opportunity for Over goals markets.
                                  </p>
                                  <div className="mt-2 text-sm">
                                    <strong>Recommended Markets:</strong>{' '}
                                    {combinedSignal.score >= 4 
                                      ? 'Over 2.5, Over 1.5 HT, BTTS' 
                                      : combinedSignal.score >= 2.5 
                                      ? 'Over 1.5, Over 2.5 (moderate confidence)'
                                      : 'Over 1.5 (conservative)'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Legend */}
                          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-xs">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              <div><strong>Z ≤ -1.5:</strong> <span className="text-green-600">Strong Over</span></div>
                              <div><strong>Z ≥ 1.5:</strong> <span className="text-red-600">Strong Under</span></div>
                              <div><strong>CV &lt; 30%:</strong> Consistent team</div>
                              <div><strong>CV &gt; 50%:</strong> Volatile team</div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </>
            )}
    </div>
  )
}
