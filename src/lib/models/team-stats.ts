import type { MatchResult, TeamStats } from '@/lib/types';
import { calculateBidirectionalHomeAdvantage } from './home-advantage';

/**
 * Calculate comprehensive team statistics from match results.
 * Computes attack/defense strength, bidirectional home advantage, form, BTTS, and over/under stats per team.
 * Extracted from predict/route.ts lines 196-376.
 */
export function calculateTeamStats(matches: MatchResult[]): Map<string, TeamStats> {
  const teams = new Map<string, TeamStats>();

  if (matches.length === 0) return teams;

  // Calculate league averages
  const leagueHomeGoals = matches.reduce((sum, m) => sum + m.ftHomeGoals, 0) / matches.length;
  const leagueAwayGoals = matches.reduce((sum, m) => sum + m.ftAwayGoals, 0) / matches.length;
  const leagueAvgGoals = leagueHomeGoals + leagueAwayGoals;

  // Initialize team data
  const teamData = new Map<string, {
    homeGoals: number;
    homeConceded: number;
    homeGames: number;
    awayGoals: number;
    awayConceded: number;
    awayGames: number;
    wins: number;
    draws: number;
    losses: number;
    form: { result: 'W' | 'D' | 'L'; gf: number; ga: number; date: string }[];
    bttsFullTime: number;
    bttsFirstHalf: number;
    bttsSecondHalf: number;
    over25: number;
    over35: number;
  }>();

  for (const match of matches) {
    // Home team
    if (!teamData.has(match.homeTeam)) {
      teamData.set(match.homeTeam, {
        homeGoals: 0, homeConceded: 0, homeGames: 0,
        awayGoals: 0, awayConceded: 0, awayGames: 0,
        wins: 0, draws: 0, losses: 0,
        form: [],
        bttsFullTime: 0, bttsFirstHalf: 0, bttsSecondHalf: 0,
        over25: 0, over35: 0,
      });
    }

    // Away team
    if (!teamData.has(match.awayTeam)) {
      teamData.set(match.awayTeam, {
        homeGoals: 0, homeConceded: 0, homeGames: 0,
        awayGoals: 0, awayConceded: 0, awayGames: 0,
        wins: 0, draws: 0, losses: 0,
        form: [],
        bttsFullTime: 0, bttsFirstHalf: 0, bttsSecondHalf: 0,
        over25: 0, over35: 0,
      });
    }

    const homeData = teamData.get(match.homeTeam)!;
    const awayData = teamData.get(match.awayTeam)!;

    // Home stats
    homeData.homeGoals += match.ftHomeGoals;
    homeData.homeConceded += match.ftAwayGoals;
    homeData.homeGames++;

    // Away stats
    awayData.awayGoals += match.ftAwayGoals;
    awayData.awayConceded += match.ftHomeGoals;
    awayData.awayGames++;

    // Results
    if (match.ftResult === 'H') {
      homeData.wins++;
      awayData.losses++;
      homeData.form.push({ result: 'W', gf: match.ftHomeGoals, ga: match.ftAwayGoals, date: match.date });
      awayData.form.push({ result: 'L', gf: match.ftAwayGoals, ga: match.ftHomeGoals, date: match.date });
    } else if (match.ftResult === 'A') {
      awayData.wins++;
      homeData.losses++;
      homeData.form.push({ result: 'L', gf: match.ftHomeGoals, ga: match.ftAwayGoals, date: match.date });
      awayData.form.push({ result: 'W', gf: match.ftAwayGoals, ga: match.ftHomeGoals, date: match.date });
    } else {
      homeData.draws++;
      awayData.draws++;
      homeData.form.push({ result: 'D', gf: match.ftHomeGoals, ga: match.ftAwayGoals, date: match.date });
      awayData.form.push({ result: 'D', gf: match.ftAwayGoals, ga: match.ftHomeGoals, date: match.date });
    }

    // BTTS patterns
    const bttsFT = match.ftHomeGoals > 0 && match.ftAwayGoals > 0;
    const bttsHT = match.htHomeGoals > 0 && match.htAwayGoals > 0;
    const shHomeGoals = match.ftHomeGoals - match.htHomeGoals;
    const shAwayGoals = match.ftAwayGoals - match.htAwayGoals;
    const bttsSH = shHomeGoals > 0 && shAwayGoals > 0;
    const totalGoals = match.ftHomeGoals + match.ftAwayGoals;

    if (bttsFT) {
      homeData.bttsFullTime++;
      awayData.bttsFullTime++;
    }
    if (bttsHT) {
      homeData.bttsFirstHalf++;
      awayData.bttsFirstHalf++;
    }
    if (bttsSH) {
      homeData.bttsSecondHalf++;
      awayData.bttsSecondHalf++;
    }

    // Over/Under
    if (totalGoals > 2.5) {
      homeData.over25++;
      awayData.over25++;
    }
    if (totalGoals > 3.5) {
      homeData.over35++;
      awayData.over35++;
    }
  }

  // Calculate final stats
  for (const [team, data] of teamData) {
    const totalGames = data.homeGames + data.awayGames;
    const totalGoalsScored = data.homeGoals + data.awayGoals;
    const totalGoalsConceded = data.homeConceded + data.awayConceded;

    const avgScored = totalGoalsScored / totalGames;
    const avgConceded = totalGoalsConceded / totalGames;

    // Attack strength = (goals scored / games) / league avg goals
    const attack = avgScored / (leagueAvgGoals / 2);
    // Defense strength = (goals conceded / games) / league avg goals
    const defense = avgConceded / (leagueAvgGoals / 2);

    // Bidirectional home advantage calculation
    const ha = calculateBidirectionalHomeAdvantage(
      data.homeGames > 0 ? data.homeGoals / data.homeGames : avgScored,
      data.homeGames > 0 ? data.homeConceded / data.homeGames : avgConceded,
      data.awayGames > 0 ? data.awayGoals / data.awayGames : avgScored,
      data.awayGames > 0 ? data.awayConceded / data.awayGames : avgConceded,
      leagueHomeGoals,
      leagueAwayGoals
    );
    const homeAdvantage = ha.overallAdvantage;

    // Recent form (last 5 matches)
    const parseFormDate = (d: string) => {
      if (!d) return 0;
      const parts = d.split('/');
      if (parts.length === 3) {
        let y = parseInt(parts[2]);
        if (y < 100) y += y < 50 ? 2000 : 1900;
        return new Date(y, parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
      }
      return new Date(d).getTime();
    };
    const sortedForm = data.form.sort((a, b) => parseFormDate(b.date) - parseFormDate(a.date)).slice(0, 5);
    const recentForm = sortedForm.map(f => f.result);
    const recentGoalsScored = sortedForm.reduce((sum, f) => sum + f.gf, 0);
    const recentGoalsConceded = sortedForm.reduce((sum, f) => sum + f.ga, 0);

    teams.set(team, {
      attack: attack || 1,
      defense: defense || 1,
      homeAdvantage,
      avgScored,
      avgConceded,
      homeScored: data.homeGames > 0 ? data.homeGoals / data.homeGames : 0,
      homeConceded: data.homeGames > 0 ? data.homeConceded / data.homeGames : 0,
      awayScored: data.awayGames > 0 ? data.awayGoals / data.awayGames : 0,
      awayConceded: data.awayGames > 0 ? data.awayConceded / data.awayGames : 0,
      homeGames: data.homeGames,
      awayGames: data.awayGames,
      totalGames,
      wins: data.wins,
      draws: data.draws,
      losses: data.losses,
      recentForm,
      recentGoalsScored,
      recentGoalsConceded,
      bttsFullTime: data.bttsFullTime,
      bttsFirstHalf: data.bttsFirstHalf,
      bttsSecondHalf: data.bttsSecondHalf,
      over25: data.over25,
      over35: data.over35,
    });
  }

  return teams;
}
