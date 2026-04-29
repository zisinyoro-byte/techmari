import { NextRequest, NextResponse } from 'next/server';
import { fetchSeasonData, fetchAllSeasons } from '@/lib/data-cache';
import type { MatchResult } from '@/lib/types';
import { EUROPEAN_SEASONS, SEASON_NAMES } from '@/lib/constants';

export interface H2HMatch extends MatchResult {
  shHomeGoals: number;
  shAwayGoals: number;
  shResult: 'H' | 'D' | 'A';
  bttsFullTime: boolean;
  bttsFirstHalf: boolean;
  bttsSecondHalf: boolean;
  bttsBothHalves: boolean;
  homeTeamIsHome: boolean;
}

export interface TeamGoalForm {
  last5Overall: { scored: number; conceded: number; matches: number };
  last5Home: { scored: number; conceded: number; matches: number };
  last5Away: { scored: number; conceded: number; matches: number };
  games: { date: string; opponent: string; venue: 'H' | 'A'; scored: number; conceded: number }[];
}

export interface H2HAnalytics {
  totalMatches: number;
  homeTeamWins: number;
  draws: number;
  awayTeamWins: number;
  homeTeamWinPercent: number;
  drawPercent: number;
  awayTeamWinPercent: number;
  totalGoals: number;
  avgGoalsPerGame: number;
  bttsFullTime: { count: number; percent: number };
  bttsFirstHalf: { count: number; percent: number };
  bttsSecondHalf: { count: number; percent: number };
  bttsBothHalves: { count: number; percent: number };
  avgHomeTeamGoals: number;
  avgAwayTeamGoals: number;
  over25Goals: { count: number; percent: number };
  over35Goals: { count: number; percent: number };
  htHomeTeamLeads: number;
  htDraws: number;
  htAwayTeamLeads: number;
  homeTeamComebacks: number;
  awayTeamComebacks: number;
  seasonsCount?: number;
  seasonsPlayed?: string[];
  avgHomeTeamShots: number;
  avgAwayTeamShots: number;
  avgHomeTeamShotsOnTarget: number;
  avgAwayTeamShotsOnTarget: number;
  avgHomeTeamCorners: number;
  avgAwayTeamCorners: number;
  avgHomeTeamFouls: number;
  avgAwayTeamFouls: number;
  totalCards: number;
  oddsAnalysis: {
    matchesWithOdds: number;
    favoriteWins: number;
    favoriteWinPercent: number;
    underdogWins: number;
    underdogWinPercent: number;
    avgHomeTeamWinOdds: number;
    avgDrawOdds: number;
    avgAwayTeamWinOdds: number;
  };
  // H2H Goal Averages
  h2hGoalAverages: {
    team1Home: { scored: number; conceded: number; matches: number };
    team1Away: { scored: number; conceded: number; matches: number };
    team2Home: { scored: number; conceded: number; matches: number };
    team2Away: { scored: number; conceded: number; matches: number };
    overall: { avgTotalGoals: number; avgTeam1Goals: number; avgTeam2Goals: number };
  };
  // Team Form (Goals Focus)
  team1Form: TeamGoalForm;
  team2Form: TeamGoalForm;
  // BTTS Enhanced Analysis
  goalTimingPatterns: {
    firstHalfGoals: number;
    secondHalfGoals: number;
    avgFirstHalfGoals: number;
    avgSecondHalfGoals: number;
    team1FirstHalfGoals: number;
    team1SecondHalfGoals: number;
    team2FirstHalfGoals: number;
    team2SecondHalfGoals: number;
    secondHalfRescueRate: number; // % of matches where BTTS achieved in 2nd half after 0-0 or 1-0 HT
  };
  cleanSheetAnalysis: {
    team1CleanSheets: number;
    team1CleanSheetPercent: number;
    team2CleanSheets: number;
    team2CleanSheetPercent: number;
    team1FailedToScore: number;
    team1FailedToScorePercent: number;
    team2FailedToScore: number;
    team2FailedToScorePercent: number;
    bothTeamsScored: number;
    neitherTeamScored: number;
  };
  scorelineDistribution: {
    scoreline: string;
    count: number;
    percent: number;
    btts: boolean;
  }[];
  defensiveWeakness: {
    team1: {
      avgConceded: number;
      conceded0: number;
      conceded1: number;
      conceded2Plus: number;
      cleanSheetRate: number;
      avgConcededWhenConcedes: number; // avg goals conceded when they don't keep clean sheet
    };
    team2: {
      avgConceded: number;
      conceded0: number;
      conceded1: number;
      conceded2Plus: number;
      cleanSheetRate: number;
      avgConcededWhenConcedes: number;
    };
  };
  // BTTS Distribution Analysis
  bttsHomeDistribution: {
    team1Home: { count: number; percent: number }; // BTTS occurred when team1 was home
    team2Home: { count: number; percent: number }; // BTTS occurred when team2 was home
  };
  bttsTimingDistribution: {
    htOnly: { count: number; percent: number; desc: string }; // BTTS by halftime
    shOnly: { count: number; percent: number; desc: string }; // BTTS in 2nd half only
    bothHalves: { count: number; percent: number; desc: string }; // BTTS in both halves
    ftOnly: { count: number; percent: number; desc: string }; // BTTS at FT (total)
  };
}

// In-memory cache for H2H analysis results (derived data)
const h2hCache = new Map<string, { data: { matches: H2HMatch[]; analytics: H2HAnalytics }; timestamp: number }>();
const H2H_CACHE_DURATION = 10 * 60 * 1000;

function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date(0);
  
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    
    // Handle 2-digit years (e.g., "16" -> 2016, "99" -> 1999)
    if (year < 100) {
      year += year < 50 ? 2000 : 1900;
    }
    
    return new Date(year, month, day);
  }
  
  return new Date(dateStr) || new Date(0);
}

// Calculate team form (goals focus) for last 5 games
function calculateTeamForm(allMatches: MatchResult[], team: string): TeamGoalForm {
  // Get all matches for this team
  const teamMatches = allMatches.filter(
    m => m.homeTeam === team || m.awayTeam === team
  );

  // Sort by date descending
  const sortedMatches = teamMatches.sort((a, b) => {
    const dateA = parseDate(a.date);
    const dateB = parseDate(b.date);
    return dateB.getTime() - dateA.getTime();
  });

  // Take last 5 matches
  const last5 = sortedMatches.slice(0, 5);

  const form: TeamGoalForm = {
    last5Overall: { scored: 0, conceded: 0, matches: 0 },
    last5Home: { scored: 0, conceded: 0, matches: 0 },
    last5Away: { scored: 0, conceded: 0, matches: 0 },
    games: [],
  };

  for (const m of last5) {
    const isHome = m.homeTeam === team;
    const scored = isHome ? m.ftHomeGoals : m.ftAwayGoals;
    const conceded = isHome ? m.ftAwayGoals : m.ftHomeGoals;
    const opponent = isHome ? m.awayTeam : m.homeTeam;

    // Overall stats
    form.last5Overall.scored += scored;
    form.last5Overall.conceded += conceded;
    form.last5Overall.matches++;

    // Home/Away split
    if (isHome) {
      form.last5Home.scored += scored;
      form.last5Home.conceded += conceded;
      form.last5Home.matches++;
    } else {
      form.last5Away.scored += scored;
      form.last5Away.conceded += conceded;
      form.last5Away.matches++;
    }

    // Individual game record
    form.games.push({
      date: m.date,
      opponent,
      venue: isHome ? 'H' : 'A',
      scored,
      conceded,
    });
  }

  return form;
}

function analyzeH2H(
  matches: MatchResult[],
  allMatches: MatchResult[],
  team1: string,
  team2: string,
  seasonsCount?: number
): { matches: H2HMatch[]; analytics: H2HAnalytics } {
  const h2hMatches = matches.filter(
    m => (m.homeTeam === team1 && m.awayTeam === team2) ||
         (m.homeTeam === team2 && m.awayTeam === team1)
  );

  const h2hWithStats: H2HMatch[] = h2hMatches.map(m => {
    const shHomeGoals = m.ftHomeGoals - m.htHomeGoals;
    const shAwayGoals = m.ftAwayGoals - m.htAwayGoals;
    
    let shResult: 'H' | 'D' | 'A' = 'D';
    if (shHomeGoals > shAwayGoals) shResult = 'H';
    else if (shHomeGoals < shAwayGoals) shResult = 'A';

    const bttsFullTime = m.ftHomeGoals > 0 && m.ftAwayGoals > 0;
    const bttsFirstHalf = m.htHomeGoals > 0 && m.htAwayGoals > 0;
    const bttsSecondHalf = shHomeGoals > 0 && shAwayGoals > 0;
    const bttsBothHalves = bttsFirstHalf && bttsSecondHalf;
    const homeTeamIsHome = m.homeTeam === team1;

    return {
      ...m,
      shHomeGoals,
      shAwayGoals,
      shResult,
      bttsFullTime,
      bttsFirstHalf,
      bttsSecondHalf,
      bttsBothHalves,
      homeTeamIsHome,
    };
  });

  const totalMatches = h2hWithStats.length;
  
  const emptyTeamForm: TeamGoalForm = {
    last5Overall: { scored: 0, conceded: 0, matches: 0 },
    last5Home: { scored: 0, conceded: 0, matches: 0 },
    last5Away: { scored: 0, conceded: 0, matches: 0 },
    games: [],
  };

  const emptyAnalytics: H2HAnalytics = {
    totalMatches: 0,
    homeTeamWins: 0,
    draws: 0,
    awayTeamWins: 0,
    homeTeamWinPercent: 0,
    drawPercent: 0,
    awayWinPercent: 0,
    totalGoals: 0,
    avgGoalsPerGame: 0,
    bttsFullTime: { count: 0, percent: 0 },
    bttsFirstHalf: { count: 0, percent: 0 },
    bttsSecondHalf: { count: 0, percent: 0 },
    bttsBothHalves: { count: 0, percent: 0 },
    avgHomeTeamGoals: 0,
    avgAwayTeamGoals: 0,
    over25Goals: { count: 0, percent: 0 },
    over35Goals: { count: 0, percent: 0 },
    htHomeTeamLeads: 0,
    htDraws: 0,
    htAwayTeamLeads: 0,
    homeTeamComebacks: 0,
    awayTeamComebacks: 0,
    seasonsCount,
    seasonsPlayed: [],
    avgHomeTeamShots: 0,
    avgAwayTeamShots: 0,
    avgHomeTeamShotsOnTarget: 0,
    avgAwayTeamShotsOnTarget: 0,
    avgHomeTeamCorners: 0,
    avgAwayTeamCorners: 0,
    avgHomeTeamFouls: 0,
    avgAwayTeamFouls: 0,
    totalCards: 0,
    oddsAnalysis: {
      matchesWithOdds: 0,
      favoriteWins: 0,
      favoriteWinPercent: 0,
      underdogWins: 0,
      underdogWinPercent: 0,
      avgHomeTeamWinOdds: 0,
      avgDrawOdds: 0,
      avgAwayTeamWinOdds: 0,
    },
    h2hGoalAverages: {
      team1Home: { scored: 0, conceded: 0, matches: 0 },
      team1Away: { scored: 0, conceded: 0, matches: 0 },
      team2Home: { scored: 0, conceded: 0, matches: 0 },
      team2Away: { scored: 0, conceded: 0, matches: 0 },
      overall: { avgTotalGoals: 0, avgTeam1Goals: 0, avgTeam2Goals: 0 },
    },
    team1Form: emptyTeamForm,
    team2Form: emptyTeamForm,
    goalTimingPatterns: {
      firstHalfGoals: 0,
      secondHalfGoals: 0,
      avgFirstHalfGoals: 0,
      avgSecondHalfGoals: 0,
      team1FirstHalfGoals: 0,
      team1SecondHalfGoals: 0,
      team2FirstHalfGoals: 0,
      team2SecondHalfGoals: 0,
      secondHalfRescueRate: 0,
    },
    cleanSheetAnalysis: {
      team1CleanSheets: 0,
      team1CleanSheetPercent: 0,
      team2CleanSheets: 0,
      team2CleanSheetPercent: 0,
      team1FailedToScore: 0,
      team1FailedToScorePercent: 0,
      team2FailedToScore: 0,
      team2FailedToScorePercent: 0,
      bothTeamsScored: 0,
      neitherTeamScored: 0,
    },
    scorelineDistribution: [],
    defensiveWeakness: {
      team1: { avgConceded: 0, conceded0: 0, conceded1: 0, conceded2Plus: 0, cleanSheetRate: 0, avgConcededWhenConcedes: 0 },
      team2: { avgConceded: 0, conceded0: 0, conceded1: 0, conceded2Plus: 0, cleanSheetRate: 0, avgConcededWhenConcedes: 0 },
    },
    bttsHomeDistribution: {
      team1Home: { count: 0, percent: 0 },
      team2Home: { count: 0, percent: 0 },
    },
    bttsTimingDistribution: {
      htOnly: { count: 0, percent: 0, desc: 'BTTS achieved by halftime' },
      shOnly: { count: 0, percent: 0, desc: 'BTTS achieved in 2nd half only' },
      bothHalves: { count: 0, percent: 0, desc: 'BTTS in BOTH halves' },
      ftOnly: { count: 0, percent: 0, desc: 'BTTS at Full Time (total)' },
    },
  };

  if (totalMatches === 0) {
    return { matches: [], analytics: emptyAnalytics };
  }

  let homeTeamWins = 0;
  let draws = 0;
  let awayTeamWins = 0;
  let totalGoals = 0;
  let team1Goals = 0;
  let team2Goals = 0;
  let bttsFullTimeCount = 0;
  let bttsFirstHalfCount = 0;
  let bttsSecondHalfCount = 0;
  let bttsBothHalvesCount = 0;
  let over25Count = 0;
  let over35Count = 0;
  let htTeam1Leads = 0;
  let htDrawCount = 0;
  let htTeam2Leads = 0;
  let team1Comebacks = 0;
  let team2Comebacks = 0;
  const seasonsWithMatches = new Set<string>();

  let totalTeam1Shots = 0;
  let totalTeam2Shots = 0;
  let totalTeam1ShotsOnTarget = 0;
  let totalTeam2ShotsOnTarget = 0;
  let totalTeam1Corners = 0;
  let totalTeam2Corners = 0;
  let totalTeam1Fouls = 0;
  let totalTeam2Fouls = 0;
  let totalCards = 0;

  let favoriteWins = 0;
  let underdogWins = 0;
  let totalTeam1Odds = 0;
  let totalDrawOdds = 0;
  let totalTeam2Odds = 0;
  let oddsCount = 0;

  // H2H Goal Averages
  let team1HomeScored = 0, team1HomeConceded = 0, team1HomeMatches = 0;
  let team1AwayScored = 0, team1AwayConceded = 0, team1AwayMatches = 0;
  let team2HomeScored = 0, team2HomeConceded = 0, team2HomeMatches = 0;
  let team2AwayScored = 0, team2AwayConceded = 0, team2AwayMatches = 0;

  // Goal Timing Patterns
  let totalFirstHalfGoals = 0;
  let totalSecondHalfGoals = 0;
  let team1FirstHalfGoals = 0;
  let team1SecondHalfGoals = 0;
  let team2FirstHalfGoals = 0;
  let team2SecondHalfGoals = 0;
  let secondHalfRescueCount = 0; // matches where BTTS achieved in 2nd half after no BTTS in 1st

  // Clean Sheet Analysis
  let team1CleanSheets = 0;
  let team2CleanSheets = 0;
  let team1FailedToScore = 0;
  let team2FailedToScore = 0;
  let neitherTeamScored = 0;

  // Defensive Weakness
  let team1Conceded0 = 0, team1Conceded1 = 0, team1Conceded2Plus = 0;
  let team2Conceded0 = 0, team2Conceded1 = 0, team2Conceded2Plus = 0;
  let team1TotalConceded = 0;
  let team2TotalConceded = 0;

  // Scoreline Distribution
  const scorelineMap = new Map<string, { count: number; btts: boolean }>();

  // BTTS Home Distribution
  let bttsTeam1HomeCount = 0; // BTTS when team1 was home
  let bttsTeam2HomeCount = 0; // BTTS when team2 was home

  // BTTS Timing Distribution
  let bttsHtOnlyCount = 0; // BTTS in 1st half only (not 2nd)
  let bttsShOnlyCount = 0; // BTTS in 2nd half only (not 1st)
  let bttsBothHalvesTimingCount = 0; // BTTS in both halves

  for (const m of h2hWithStats) {
    seasonsWithMatches.add(m.season);
    
    if (m.ftResult === 'D') {
      draws++;
    } else if ((m.ftResult === 'H' && m.homeTeamIsHome) || (m.ftResult === 'A' && !m.homeTeamIsHome)) {
      homeTeamWins++;
    } else {
      awayTeamWins++;
    }

    totalGoals += m.ftHomeGoals + m.ftAwayGoals;
    team1Goals += m.homeTeamIsHome ? m.ftHomeGoals : m.ftAwayGoals;
    team2Goals += m.homeTeamIsHome ? m.ftAwayGoals : m.ftHomeGoals;

    if (m.bttsFullTime) bttsFullTimeCount++;
    if (m.bttsFirstHalf) bttsFirstHalfCount++;
    if (m.bttsSecondHalf) bttsSecondHalfCount++;
    if (m.bttsBothHalves) bttsBothHalvesCount++;

    const totalMatchGoals = m.ftHomeGoals + m.ftAwayGoals;
    if (totalMatchGoals > 2.5) over25Count++;
    if (totalMatchGoals > 3.5) over35Count++;

    if (m.htResult === 'D') {
      htDrawCount++;
    } else if ((m.htResult === 'H' && m.homeTeamIsHome) || (m.htResult === 'A' && !m.homeTeamIsHome)) {
      htTeam1Leads++;
    } else {
      htTeam2Leads++;
    }

    if (m.homeTeamIsHome) {
      if (m.htResult === 'A' && m.ftResult === 'H') team1Comebacks++;
      if (m.htResult === 'H' && m.ftResult === 'A') team2Comebacks++;
    } else {
      if (m.htResult === 'H' && m.ftResult === 'A') team1Comebacks++;
      if (m.htResult === 'A' && m.ftResult === 'H') team2Comebacks++;
    }

    totalTeam1Shots += m.homeTeamIsHome ? m.homeShots : m.awayShots;
    totalTeam2Shots += m.homeTeamIsHome ? m.awayShots : m.homeShots;
    totalTeam1ShotsOnTarget += m.homeTeamIsHome ? m.homeShotsOnTarget : m.awayShotsOnTarget;
    totalTeam2ShotsOnTarget += m.homeTeamIsHome ? m.awayShotsOnTarget : m.homeShotsOnTarget;
    totalTeam1Corners += m.homeTeamIsHome ? m.homeCorners : m.awayCorners;
    totalTeam2Corners += m.homeTeamIsHome ? m.awayCorners : m.homeCorners;
    totalTeam1Fouls += m.homeTeamIsHome ? m.homeFouls : m.awayFouls;
    totalTeam2Fouls += m.homeTeamIsHome ? m.awayFouls : m.homeFouls;
    totalCards += m.homeYellowCards + m.awayYellowCards + m.homeRedCards + m.awayRedCards;

    if (m.oddsAvgHome && m.oddsAvgDraw && m.oddsAvgAway) {
      oddsCount++;
      
      const team1Odds = m.homeTeamIsHome ? m.oddsAvgHome : m.oddsAvgAway;
      const team2Odds = m.homeTeamIsHome ? m.oddsAvgAway : m.oddsAvgHome;
      
      totalTeam1Odds += team1Odds;
      totalDrawOdds += m.oddsAvgDraw;
      totalTeam2Odds += team2Odds;

      const minOdds = Math.min(team1Odds, m.oddsAvgDraw, team2Odds);
      const team1Win = (m.ftResult === 'H' && m.homeTeamIsHome) || (m.ftResult === 'A' && !m.homeTeamIsHome);
      const team2Win = (m.ftResult === 'A' && m.homeTeamIsHome) || (m.ftResult === 'H' && !m.homeTeamIsHome);
      
      if (minOdds === team1Odds && team1Win) {
        favoriteWins++;
      } else if (minOdds === m.oddsAvgDraw && m.ftResult === 'D') {
        favoriteWins++;
      } else if (minOdds === team2Odds && team2Win) {
        favoriteWins++;
      } else if (team1Win || team2Win) {
        underdogWins++;
      }
    }

    // H2H Goal Averages calculation
    if (m.homeTeamIsHome) {
      // Team1 is playing at home
      team1HomeScored += m.ftHomeGoals;
      team1HomeConceded += m.ftAwayGoals;
      team1HomeMatches++;
      // Team2 is playing away
      team2AwayScored += m.ftAwayGoals;
      team2AwayConceded += m.ftHomeGoals;
      team2AwayMatches++;
    } else {
      // Team2 is playing at home
      team2HomeScored += m.ftHomeGoals;
      team2HomeConceded += m.ftAwayGoals;
      team2HomeMatches++;
      // Team1 is playing away
      team1AwayScored += m.ftAwayGoals;
      team1AwayConceded += m.ftHomeGoals;
      team1AwayMatches++;
    }

    // Goal Timing Patterns
    const firstHalfGoals = m.htHomeGoals + m.htAwayGoals;
    const secondHalfGoals = m.shHomeGoals + m.shAwayGoals;
    totalFirstHalfGoals += firstHalfGoals;
    totalSecondHalfGoals += secondHalfGoals;

    // Team-specific timing goals
    const team1HTGoals = m.homeTeamIsHome ? m.htHomeGoals : m.htAwayGoals;
    const team1SHGoals = m.homeTeamIsHome ? m.shHomeGoals : m.shAwayGoals;
    const team2HTGoals = m.homeTeamIsHome ? m.htAwayGoals : m.htHomeGoals;
    const team2SHGoals = m.homeTeamIsHome ? m.shAwayGoals : m.shHomeGoals;
    team1FirstHalfGoals += team1HTGoals;
    team1SecondHalfGoals += team1SHGoals;
    team2FirstHalfGoals += team2HTGoals;
    team2SecondHalfGoals += team2SHGoals;

    // Second Half Rescue: BTTS achieved in 2nd half after no BTTS in 1st half
    if (!m.bttsFirstHalf && m.bttsSecondHalf) {
      secondHalfRescueCount++;
    }

    // Clean Sheet Analysis
    const team1GoalsScored = m.homeTeamIsHome ? m.ftHomeGoals : m.ftAwayGoals;
    const team2GoalsScored = m.homeTeamIsHome ? m.ftAwayGoals : m.ftHomeGoals;
    const team1GoalsConceded = m.homeTeamIsHome ? m.ftAwayGoals : m.ftHomeGoals;
    const team2GoalsConceded = m.homeTeamIsHome ? m.ftHomeGoals : m.ftAwayGoals;

    if (team1GoalsConceded === 0) team1CleanSheets++;
    if (team2GoalsConceded === 0) team2CleanSheets++;
    if (team1GoalsScored === 0) team1FailedToScore++;
    if (team2GoalsScored === 0) team2FailedToScore++;
    if (team1GoalsScored === 0 && team2GoalsScored === 0) neitherTeamScored++;

    // Defensive Weakness
    team1TotalConceded += team1GoalsConceded;
    team2TotalConceded += team2GoalsConceded;
    if (team1GoalsConceded === 0) team1Conceded0++;
    else if (team1GoalsConceded === 1) team1Conceded1++;
    else team1Conceded2Plus++;
    if (team2GoalsConceded === 0) team2Conceded0++;
    else if (team2GoalsConceded === 1) team2Conceded1++;
    else team2Conceded2Plus++;

    // Scoreline Distribution
    const homeGoals = m.ftHomeGoals;
    const awayGoals = m.ftAwayGoals;
    const scoreline = `${homeGoals}-${awayGoals}`;
    const existing = scorelineMap.get(scoreline);
    if (existing) {
      existing.count++;
    } else {
      scorelineMap.set(scoreline, { count: 1, btts: m.bttsFullTime });
    }

    // BTTS Home Distribution
    if (m.bttsFullTime) {
      if (m.homeTeamIsHome) {
        bttsTeam1HomeCount++; // Team1 was home when BTTS occurred
      } else {
        bttsTeam2HomeCount++; // Team2 was home when BTTS occurred
      }
    }

    // BTTS Timing Distribution
    if (m.bttsFirstHalf && m.bttsSecondHalf) {
      bttsBothHalvesTimingCount++;
    } else if (m.bttsFirstHalf) {
      bttsHtOnlyCount++;
    } else if (m.bttsSecondHalf) {
      bttsShOnlyCount++;
    }
  }

  const analytics: H2HAnalytics = {
    totalMatches,
    homeTeamWins,
    draws,
    awayTeamWins,
    homeTeamWinPercent: Math.round((homeTeamWins / totalMatches) * 1000) / 10,
    drawPercent: Math.round((draws / totalMatches) * 1000) / 10,
    awayTeamWinPercent: Math.round((awayTeamWins / totalMatches) * 1000) / 10,
    totalGoals,
    avgGoalsPerGame: Math.round((totalGoals / totalMatches) * 100) / 100,
    bttsFullTime: {
      count: bttsFullTimeCount,
      percent: Math.round((bttsFullTimeCount / totalMatches) * 1000) / 10,
    },
    bttsFirstHalf: {
      count: bttsFirstHalfCount,
      percent: Math.round((bttsFirstHalfCount / totalMatches) * 1000) / 10,
    },
    bttsSecondHalf: {
      count: bttsSecondHalfCount,
      percent: Math.round((bttsSecondHalfCount / totalMatches) * 1000) / 10,
    },
    bttsBothHalves: {
      count: bttsBothHalvesCount,
      percent: Math.round((bttsBothHalvesCount / totalMatches) * 1000) / 10,
    },
    avgHomeTeamGoals: Math.round((team1Goals / totalMatches) * 100) / 100,
    avgAwayTeamGoals: Math.round((team2Goals / totalMatches) * 100) / 100,
    over25Goals: {
      count: over25Count,
      percent: Math.round((over25Count / totalMatches) * 1000) / 10,
    },
    over35Goals: {
      count: over35Count,
      percent: Math.round((over35Count / totalMatches) * 1000) / 10,
    },
    htHomeTeamLeads: htTeam1Leads,
    htDraws: htDrawCount,
    htAwayTeamLeads: htTeam2Leads,
    homeTeamComebacks: team1Comebacks,
    awayTeamComebacks: team2Comebacks,
    seasonsCount,
    seasonsPlayed: Array.from(seasonsWithMatches).map(s => SEASON_NAMES[s] || s).sort(),
    avgHomeTeamShots: Math.round((totalTeam1Shots / totalMatches) * 10) / 10,
    avgAwayTeamShots: Math.round((totalTeam2Shots / totalMatches) * 10) / 10,
    avgHomeTeamShotsOnTarget: Math.round((totalTeam1ShotsOnTarget / totalMatches) * 10) / 10,
    avgAwayTeamShotsOnTarget: Math.round((totalTeam2ShotsOnTarget / totalMatches) * 10) / 10,
    avgHomeTeamCorners: Math.round((totalTeam1Corners / totalMatches) * 10) / 10,
    avgAwayTeamCorners: Math.round((totalTeam2Corners / totalMatches) * 10) / 10,
    avgHomeTeamFouls: Math.round((totalTeam1Fouls / totalMatches) * 10) / 10,
    avgAwayTeamFouls: Math.round((totalTeam2Fouls / totalMatches) * 10) / 10,
    totalCards,
    oddsAnalysis: {
      matchesWithOdds: oddsCount,
      favoriteWins,
      favoriteWinPercent: oddsCount > 0 ? Math.round((favoriteWins / oddsCount) * 1000) / 10 : 0,
      underdogWins,
      underdogWinPercent: oddsCount > 0 ? Math.round((underdogWins / oddsCount) * 1000) / 10 : 0,
      avgHomeTeamWinOdds: oddsCount > 0 ? Math.round((totalTeam1Odds / oddsCount) * 100) / 100 : 0,
      avgDrawOdds: oddsCount > 0 ? Math.round((totalDrawOdds / oddsCount) * 100) / 100 : 0,
      avgAwayTeamWinOdds: oddsCount > 0 ? Math.round((totalTeam2Odds / oddsCount) * 100) / 100 : 0,
    },
    h2hGoalAverages: {
      team1Home: { 
        scored: team1HomeMatches > 0 ? Math.round((team1HomeScored / team1HomeMatches) * 100) / 100 : 0,
        conceded: team1HomeMatches > 0 ? Math.round((team1HomeConceded / team1HomeMatches) * 100) / 100 : 0,
        matches: team1HomeMatches 
      },
      team1Away: { 
        scored: team1AwayMatches > 0 ? Math.round((team1AwayScored / team1AwayMatches) * 100) / 100 : 0,
        conceded: team1AwayMatches > 0 ? Math.round((team1AwayConceded / team1AwayMatches) * 100) / 100 : 0,
        matches: team1AwayMatches 
      },
      team2Home: { 
        scored: team2HomeMatches > 0 ? Math.round((team2HomeScored / team2HomeMatches) * 100) / 100 : 0,
        conceded: team2HomeMatches > 0 ? Math.round((team2HomeConceded / team2HomeMatches) * 100) / 100 : 0,
        matches: team2HomeMatches 
      },
      team2Away: { 
        scored: team2AwayMatches > 0 ? Math.round((team2AwayScored / team2AwayMatches) * 100) / 100 : 0,
        conceded: team2AwayMatches > 0 ? Math.round((team2AwayConceded / team2AwayMatches) * 100) / 100 : 0,
        matches: team2AwayMatches 
      },
      overall: { 
        avgTotalGoals: Math.round((totalGoals / totalMatches) * 100) / 100,
        avgTeam1Goals: Math.round((team1Goals / totalMatches) * 100) / 100,
        avgTeam2Goals: Math.round((team2Goals / totalMatches) * 100) / 100,
      },
    },
    team1Form: calculateTeamForm(allMatches, team1),
    team2Form: calculateTeamForm(allMatches, team2),
    goalTimingPatterns: {
      firstHalfGoals: totalFirstHalfGoals,
      secondHalfGoals: totalSecondHalfGoals,
      avgFirstHalfGoals: Math.round((totalFirstHalfGoals / totalMatches) * 100) / 100,
      avgSecondHalfGoals: Math.round((totalSecondHalfGoals / totalMatches) * 100) / 100,
      team1FirstHalfGoals,
      team1SecondHalfGoals,
      team2FirstHalfGoals,
      team2SecondHalfGoals,
      secondHalfRescueRate: Math.round((secondHalfRescueCount / totalMatches) * 1000) / 10,
    },
    cleanSheetAnalysis: {
      team1CleanSheets,
      team1CleanSheetPercent: Math.round((team1CleanSheets / totalMatches) * 1000) / 10,
      team2CleanSheets,
      team2CleanSheetPercent: Math.round((team2CleanSheets / totalMatches) * 1000) / 10,
      team1FailedToScore,
      team1FailedToScorePercent: Math.round((team1FailedToScore / totalMatches) * 1000) / 10,
      team2FailedToScore,
      team2FailedToScorePercent: Math.round((team2FailedToScore / totalMatches) * 1000) / 10,
      bothTeamsScored: bttsFullTimeCount,
      neitherTeamScored,
    },
    scorelineDistribution: Array.from(scorelineMap.entries())
      .map(([scoreline, data]) => ({
        scoreline,
        count: data.count,
        percent: Math.round((data.count / totalMatches) * 1000) / 10,
        btts: data.btts,
      }))
      .sort((a, b) => b.count - a.count),
    defensiveWeakness: {
      team1: {
        avgConceded: Math.round((team1TotalConceded / totalMatches) * 100) / 100,
        conceded0: team1Conceded0,
        conceded1: team1Conceded1,
        conceded2Plus: team1Conceded2Plus,
        cleanSheetRate: Math.round((team1Conceded0 / totalMatches) * 1000) / 10,
        avgConcededWhenConcedes: team1Conceded0 < totalMatches
          ? Math.round((team1TotalConceded / (totalMatches - team1Conceded0)) * 100) / 100
          : 0,
      },
      team2: {
        avgConceded: Math.round((team2TotalConceded / totalMatches) * 100) / 100,
        conceded0: team2Conceded0,
        conceded1: team2Conceded1,
        conceded2Plus: team2Conceded2Plus,
        cleanSheetRate: Math.round((team2Conceded0 / totalMatches) * 1000) / 10,
        avgConcededWhenConcedes: team2Conceded0 < totalMatches
          ? Math.round((team2TotalConceded / (totalMatches - team2Conceded0)) * 100) / 100
          : 0,
      },
    },
    bttsHomeDistribution: {
      team1Home: {
        count: bttsTeam1HomeCount,
        percent: bttsFullTimeCount > 0 ? Math.round((bttsTeam1HomeCount / bttsFullTimeCount) * 1000) / 10 : 0,
      },
      team2Home: {
        count: bttsTeam2HomeCount,
        percent: bttsFullTimeCount > 0 ? Math.round((bttsTeam2HomeCount / bttsFullTimeCount) * 1000) / 10 : 0,
      },
    },
    bttsTimingDistribution: {
      htOnly: {
        count: bttsHtOnlyCount,
        percent: Math.round((bttsHtOnlyCount / totalMatches) * 1000) / 10,
        desc: 'BTTS achieved by halftime',
      },
      shOnly: {
        count: bttsShOnlyCount,
        percent: Math.round((bttsShOnlyCount / totalMatches) * 1000) / 10,
        desc: 'BTTS achieved in 2nd half only',
      },
      bothHalves: {
        count: bttsBothHalvesTimingCount,
        percent: Math.round((bttsBothHalvesTimingCount / totalMatches) * 1000) / 10,
        desc: 'BTTS in BOTH halves',
      },
      ftOnly: {
        count: bttsFullTimeCount,
        percent: Math.round((bttsFullTimeCount / totalMatches) * 1000) / 10,
        desc: 'BTTS at Full Time (total)',
      },
    },
  };

  h2hWithStats.sort((a, b) => {
    const dateA = parseDate(a.date);
    const dateB = parseDate(b.date);
    return dateB.getTime() - dateA.getTime();
  });

  return { matches: h2hWithStats, analytics };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const league = searchParams.get('league');
  const season = searchParams.get('season');
  const team1 = searchParams.get('team1');
  const team2 = searchParams.get('team2');

  if (!league || !season) {
    return NextResponse.json(
      { error: 'Missing required parameters: league and season' },
      { status: 400 }
    );
  }

  if (!team1 || !team2) {
    return NextResponse.json(
      { error: 'Missing required parameters: team1 and team2 for H2H analysis' },
      { status: 400 }
    );
  }

  const cacheKey = `${league}-${season}-${team1}-${team2}`;
  const cached = h2hCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < H2H_CACHE_DURATION) {
    return NextResponse.json(cached.data);
  }

  try {
    let allResults: MatchResult[] = [];
    let seasonsCount: number | undefined;

    if (season === 'all') {
      allResults = await fetchAllSeasons(league, EUROPEAN_SEASONS);
      seasonsCount = EUROPEAN_SEASONS.length;
    } else {
      allResults = await fetchSeasonData(league, season);
    }

    const h2hData = analyzeH2H(allResults, allResults, team1, team2, seasonsCount);

    h2hCache.set(cacheKey, { data: h2hData, timestamp: Date.now() });

    return NextResponse.json(h2hData);
  } catch (error) {
    console.error('Error fetching H2H data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch H2H data.' },
      { status: 500 }
    );
  }
}
