import { NextRequest, NextResponse } from 'next/server';
import { fetchSeasonData } from '@/lib/data-cache';
import type {
  TeamStats,
  PredictionResponse,
} from '@/lib/types';
import { ALL_SEASONS } from '@/lib/constants';
import { calculateSeasonWeights } from '@/lib/models/season-weighting';
import { calculateTeamStats } from '@/lib/models/team-stats';
import {
  generatePredictionCore,
  combineWeightedTeamStats,
  type SeasonStatsEntry,
} from '@/lib/models/predict-core';
import { calculatePatterns, calculateLeagueInsights } from '@/lib/models/predictions';
import { initializeThresholds } from '@/lib/models/threshold-init';

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const league = searchParams.get('league');
  const season = searchParams.get('season');
  const homeTeam = searchParams.get('homeTeam');
  const awayTeam = searchParams.get('awayTeam');

  if (!league || !season) {
    return NextResponse.json(
      { error: 'Missing required parameters: league and season' },
      { status: 400 }
    );
  }

  if (!homeTeam || !awayTeam) {
    return NextResponse.json(
      { error: 'Missing required parameters: homeTeam and awayTeam' },
      { status: 400 }
    );
  }

  if (homeTeam === awayTeam) {
    return NextResponse.json(
      { error: 'Home team and away team must be different' },
      { status: 400 }
    );
  }

  try {
    // Ensure persisted thresholds are loaded (lazy, one-time)
    initializeThresholds();

    // Fetch match data — with season weighting when season === 'all'
    let allMatches: typeof import('@/lib/types').MatchResult[];
    let teamStats: Map<string, TeamStats>;

    if (season === 'all') {
      // Fetch each season separately
      const seasonPromises = ALL_SEASONS.map(s => fetchSeasonData(league, s));
      const seasonResults = await Promise.all(seasonPromises);

      // Calculate season weights (exponential decay)
      const seasonWeights = calculateSeasonWeights(ALL_SEASONS);

      // Compute team stats per season
      const seasonTeamStats: SeasonStatsEntry[] = seasonResults.map((matches, i) => ({
        season: ALL_SEASONS[i],
        weight: seasonWeights.get(ALL_SEASONS[i]) || 0,
        stats: calculateTeamStats(matches),
      }));

      // Combine into weighted team stats
      teamStats = combineWeightedTeamStats(seasonTeamStats);
      allMatches = seasonResults.flat();
    } else {
      allMatches = await fetchSeasonData(league, season);
      teamStats = calculateTeamStats(allMatches);
    }

    if (allMatches.length === 0) {
      return NextResponse.json(
        { error: 'No match data available for the selected league and season' },
        { status: 404 }
      );
    }

    const homeStats = teamStats.get(homeTeam);
    const awayStats = teamStats.get(awayTeam);

    if (!homeStats || !awayStats) {
      return NextResponse.json(
        { error: `Team not found: ${!homeStats ? homeTeam : awayTeam}` },
        { status: 404 }
      );
    }

    // Calculate league averages for xG calculation
    const leagueHomeAvg = allMatches.reduce((sum, m) => sum + m.ftHomeGoals, 0) / allMatches.length;
    const leagueAwayAvg = allMatches.reduce((sum, m) => sum + m.ftAwayGoals, 0) / allMatches.length;

    // -----------------------------------------------------------------------
    // Core prediction — single source of truth (predict-core.ts)
    // -----------------------------------------------------------------------
    // Production passes all flags true (default). Verbose logs DC progress.
    const prediction = generatePredictionCore(
      {
        allMatches,
        teamStats,
        leagueHomeAvg,
        leagueAwayAvg,
        league,
      },
      homeTeam,
      awayTeam,
      {
        useDixonColes: true,
        useH2HBlend: true,
        useMonteCarlo: true,
        mcIterations: 100000,
        applyCalibration: true,
        applyDampener: true,
        verbose: true,
      },
    );

    // -----------------------------------------------------------------------
    // Response extras: H2H stats, rolling 5-game, patterns, league insights
    // -----------------------------------------------------------------------
    // These are presentation-layer aggregations not part of the core prediction.
    // Built directly in the route for clarity (same as before refactor).

    const h2hMatches = allMatches.filter(
      m => (m.homeTeam === homeTeam && m.awayTeam === awayTeam) ||
           (m.homeTeam === awayTeam && m.awayTeam === homeTeam)
    );

    let homeTeamWins = 0;
    let draws = 0;
    let awayTeamWins = 0;

    for (const m of h2hMatches) {
      if (m.ftResult === 'D') {
        draws++;
      } else if (m.homeTeam === homeTeam) {
        if (m.ftResult === 'H') homeTeamWins++;
        else awayTeamWins++;
      } else {
        if (m.ftResult === 'A') homeTeamWins++;
        else awayTeamWins++;
      }
    }

    const h2hStats = {
      totalMatches: h2hMatches.length,
      homeTeamWins,
      draws,
      awayTeamWins,
      avgGoals: h2hMatches.length > 0
        ? Math.round((h2hMatches.reduce((sum, m) => sum + m.ftHomeGoals + m.ftAwayGoals, 0) / h2hMatches.length) * 100) / 100
        : 0,
    };

    // Rolling 5-game stats — per-venue rolling averages from last 5 games
    const sortedMatches = [...allMatches].sort((a, b) => {
      const da = a.date.split('/');
      const db = b.date.split('/');
      return `${da[2] ?? ''}-${da[1] ?? ''}-${da[0] ?? ''}`.localeCompare(`${db[2] ?? ''}-${db[1] ?? ''}-${db[0] ?? ''}`);
    });

    const homeHomeMatches = sortedMatches.filter(m => m.homeTeam === homeTeam).slice(-5);
    const awayAwayMatches = sortedMatches.filter(m => m.awayTeam === awayTeam).slice(-5);
    const homeRollingScored = homeHomeMatches.length > 0
      ? homeHomeMatches.reduce((s, m) => s + m.ftHomeGoals, 0) / homeHomeMatches.length : 0;
    const awayRollingScored = awayAwayMatches.length > 0
      ? awayAwayMatches.reduce((s, m) => s + m.ftAwayGoals, 0) / awayAwayMatches.length : 0;

    // Pattern analysis
    const patternAnalysis = calculatePatterns(allMatches);

    // League insights
    const leagueInsights = calculateLeagueInsights(allMatches, teamStats);

    const response: PredictionResponse = {
      prediction,
      homeTeamStats: homeStats,
      awayTeamStats: awayStats,
      rollingStats: {
        homeRollingScored,
        awayRollingScored,
        rollingCombinedScoring: homeRollingScored + awayRollingScored,
      },
      h2hStats,
      patternAnalysis,
      leagueInsights,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error generating prediction:', error);
    return NextResponse.json(
      { error: 'Failed to generate prediction' },
      { status: 500 }
    );
  }
}
