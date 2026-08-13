// ============================================================================
// streak-quality.ts — Strength-Weighted Form Quality
// ============================================================================
// Replaces the naive "inForm: points >= 7" check with a Streak Quality Score
// that accounts for opponent strength, market expectations, and model surprise.
//
// Three components (weights sum to 1.0):
//   1. Opponent DC Defense Rating  (30%) — systematic opponent strength from model
//   2. Pre-Match Implied Probability (30%) — market's view of match difficulty
//   3. Model Prediction Error      (30%) — did the team exceed model expectations?
//   4. Opponent League Position    (10%) — simple table-position sanity check
// ============================================================================

import type { MatchResult, TeamStats } from '@/lib/types';
import { calculateTeamStats } from './team-stats';

// --- Types ---

export interface StreakQualityResult {
  /** Overall score 0–100 */
  score: number;
  /** Verdict label */
  tier: 'Elite' | 'Strong' | 'Solid' | 'Ordinary' | 'Weak' | 'Inflated';
  /** Raw points from last 5 */
  rawPoints: number;
  /** W/D/L form array */
  form: ('W' | 'D' | 'L')[];
  /** Per-component breakdown */
  components: {
    opponentStrength: { score: number; detail: string };
    marketDifficulty: { score: number; detail: string };
    modelSurprise: { score: number; detail: string };
    opponentPosition: { score: number; detail: string };
  };
}

interface LeagueTableEntry {
  team: string;
  points: number;
  played: number;
  goalDiff: number;
}

// --- Constants ---

const FORM_WINDOW = 5;
const WEIGHT_OPP_STRENGTH = 0.30;
const WEIGHT_MARKET = 0.30;
const WEIGHT_SURPRISE = 0.30;
const WEIGHT_POSITION = 0.10;

// --- Date parser (DD/MM/YYYY) ---

function parseDate(dateStr: string): number {
  if (!dateStr) return 0;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    let y = parseInt(parts[2]);
    if (y < 100) y += y < 50 ? 2000 : 1900;
    return new Date(y, parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
  }
  return new Date(dateStr).getTime();
}

// --- League table builder (point-in-time) ---

function buildLeagueTable(matches: MatchResult[], beforeDate: number): Map<string, LeagueTableEntry> {
  const table = new Map<string, LeagueTableEntry>();

  for (const m of matches) {
    if (parseDate(m.date) >= beforeDate) continue;

    const home = table.get(m.homeTeam) || { team: m.homeTeam, points: 0, played: 0, goalDiff: 0 };
    const away = table.get(m.awayTeam) || { team: m.awayTeam, points: 0, played: 0, goalDiff: 0 };

    home.played++;
    away.played++;
    home.goalDiff += m.ftHomeGoals - m.ftAwayGoals;
    away.goalDiff += m.ftAwayGoals - m.ftHomeGoals;

    if (m.ftResult === 'H') {
      home.points += 3;
    } else if (m.ftResult === 'A') {
      away.points += 3;
    } else {
      home.points += 1;
      away.points += 1;
    }

    table.set(m.homeTeam, home);
    table.set(m.awayTeam, away);
  }

  return table;
}

function getTablePosition(table: Map<string, LeagueTableEntry>, team: string): number {
  if (!table.has(team)) return 10; // default mid-table
  const entries = Array.from(table.values())
    .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff);
  const idx = entries.findIndex(e => e.team === team);
  return idx >= 0 ? idx + 1 : 10;
}

// --- Simple implied probability from average odds ---

function impliedProbFromOdds(odds: number | null, overround: number): number | null {
  if (!odds || odds <= 1.01) return null;
  return (1 / odds) / overround;
}

// --- Core: compute streak quality for a single team ---

/**
 * Compute the Streak Quality Score for a team based on their last N matches.
 *
 * @param team       The team name
 * @param matches    All match results in the current view (sorted any order)
 * @param teamStats  Pre-computed team stats (from calculateTeamStats)
 * @param leagueHomeAvg  League average home goals
 * @param leagueAwayAvg  League average away goals
 * @param window     Number of recent matches to consider (default 5)
 */
export function computeStreakQuality(
  team: string,
  matches: MatchResult[],
  teamStats: Map<string, TeamStats>,
  leagueHomeAvg: number,
  leagueAwayAvg: number,
  window: number = FORM_WINDOW,
): StreakQualityResult {
  // Default (empty) result
  const empty: StreakQualityResult = {
    score: 0, tier: 'Ordinary', rawPoints: 0, form: [],
    components: {
      opponentStrength: { score: 0, detail: 'No data' },
      marketDifficulty: { score: 0, detail: 'No data' },
      modelSurprise: { score: 0, detail: 'No data' },
      opponentPosition: { score: 0, detail: 'No data' },
    },
  };

  if (matches.length === 0 || !teamStats.has(team)) return empty;

  // --- Gather team's last N matches (any venue), most recent first ---
  const teamMatches = matches
    .filter(m => m.homeTeam === team || m.awayTeam === team)
    .sort((a, b) => parseDate(b.date) - parseDate(a.date));

  const lastN = teamMatches.slice(0, window);
  if (lastN.length === 0) return empty;

  // Build form array and raw points
  const form: ('W' | 'D' | 'L')[] = [];
  let rawPoints = 0;

  for (const m of lastN) {
    const isHome = m.homeTeam === team;
    const teamGoals = isHome ? m.ftHomeGoals : m.ftAwayGoals;
    const oppGoals = isHome ? m.ftAwayGoals : m.ftHomeGoals;
    const result = teamGoals > oppGoals ? 'W' : teamGoals < oppGoals ? 'L' : 'D';
    form.push(result);
    rawPoints += result === 'W' ? 3 : result === 'D' ? 1 : 0;
  }

  // --- Component 1: Opponent DC Defense Rating (30%) ---
  // Average the defense rating of opponents faced.
  // defense < 1 = good defense (concedes less than avg). Lower = harder opponent.
  // We invert: facing teams with defense 0.8 (strong) should score higher than 1.2 (weak).
  const oppDefenseRatings: number[] = [];
  for (const m of lastN) {
    const opp = m.homeTeam === team ? m.awayTeam : m.homeTeam;
    const oppStats = teamStats.get(opp);
    if (oppStats) {
      // Use the relevant defense rating: opponent's defense when conceding
      const oppDefense = m.homeTeam === team
        ? oppStats.awayDefense  // opp is away, so their awayDefense (conceding at away = vs home goals)
        : oppStats.homeDefense; // opp is home, so their homeDefense (conceding at home = vs away goals)
      oppDefenseRatings.push(oppDefense);
    }
  }

  let oppStrengthScore = 50; // default mid
  let oppStrengthDetail = 'No opponent stats';
  if (oppDefenseRatings.length > 0) {
    const avgOppDefense = oppDefenseRatings.reduce((s, v) => s + v, 0) / oppDefenseRatings.length;
    // avgOppDefense < 1 means opponents concede less than avg (strong defenses)
    // Scale: defense 0.6 → score ~90, defense 1.0 → score ~50, defense 1.4 → score ~20
    oppStrengthScore = Math.round(Math.max(0, Math.min(100, 50 + (1 - avgOppDefense) * 100)));
    oppStrengthDetail = `Avg opp defense: ${avgOppDefense.toFixed(2)} (${avgOppDefense < 0.9 ? 'tough' : avgOppDefense > 1.1 ? 'weak' : 'avg'} opponents)`;
  }

  // --- Component 2: Market Difficulty — Pre-Match Implied Probability (30%) ---
  // For each match, check if the team was favorite/underdog from average odds.
  // Lower implied prob = tougher matches = higher quality if won.
  let marketScore = 50;
  let marketDetail = 'No odds data';
  const impliedProbs: number[] = [];

  for (const m of lastN) {
    const isHome = m.homeTeam === team;
    const teamOdds = isHome ? m.oddsAvgHome : m.oddsAvgAway;
    const drawOdds = m.oddsAvgDraw;
    const otherOdds = isHome ? m.oddsAvgAway : m.oddsAvgHome;

    if (teamOdds && drawOdds && otherOdds && teamOdds > 1.01) {
      const overround = (1 / teamOdds) + (1 / drawOdds) + (1 / otherOdds);
      const implied = (1 / teamOdds) / overround;
      impliedProbs.push(implied);
    }
  }

  if (impliedProbs.length > 0) {
    const avgImplied = impliedProbs.reduce((s, v) => s + v, 0) / impliedProbs.length;
    // avgImplied ~0.5 = even matches (score 50), ~0.7 = heavy favorite (score 20), ~0.3 = underdog (score 85)
    marketScore = Math.round(Math.max(0, Math.min(100, 115 - avgImplied * 130)));
    marketDetail = `Avg implied prob: ${(avgImplied * 100).toFixed(0)}% (${avgImplied < 0.35 ? 'underdog' : avgImplied > 0.55 ? 'heavy favorite' : 'competitive'} avg)`;
  }

  // --- Component 3: Model Surprise — Actual vs Expected (30%) ---
  // For each match, compute what a simple Poisson model would predict and
  // measure the "surprise" (positive = overperformed).
  // We use the team's own attack * opponent defense * league avg as expected goals.
  const surprises: number[] = [];
  const myStats = teamStats.get(team)!;

  for (const m of lastN) {
    const isHome = m.homeTeam === team;
    const opp = isHome ? m.awayTeam : m.homeTeam;
    const oppStats = teamStats.get(opp);
    if (!oppStats) continue;

    const myAttack = isHome ? myStats.homeAttack : myStats.awayAttack;
    const oppDef = isHome ? oppStats.awayDefense : oppStats.homeDefense;
    const leagueAvg = isHome ? leagueHomeAvg : leagueAwayAvg;

    const expectedGoals = myAttack * oppDef * leagueAvg;
    const actualGoals = isHome ? m.ftHomeGoals : m.ftAwayGoals;
    const oppExpected = (isHome ? oppStats.awayAttack : oppStats.homeAttack) * (isHome ? myStats.homeDefense : myStats.awayDefense) * (isHome ? leagueAwayAvg : leagueHomeAvg);
    const oppActual = isHome ? m.ftAwayGoals : m.ftHomeGoals;

    // Surprise: positive = we scored more than expected AND conceded less than expected
    const goalSurprise = (actualGoals - expectedGoals) - (oppActual - oppExpected);
    surprises.push(goalSurprise);
  }

  let surpriseScore = 50;
  let surpriseDetail = 'No model data';
  if (surprises.length > 0) {
    const avgSurprise = surprises.reduce((s, v) => s + v, 0) / surprises.length;
    // avgSurprise > 0 means team outperformed expectations on average
    // Scale: +1.5 goals → score 90, 0 → score 50, -1.5 → score 10
    surpriseScore = Math.round(Math.max(0, Math.min(100, 50 + avgSurprise * 27)));
    surpriseDetail = `Avg surprise: ${avgSurprise > 0 ? '+' : ''}${avgSurprise.toFixed(2)} goals vs model (${avgSurprise > 0.3 ? 'outperforming' : avgSurprise < -0.3 ? 'underperforming' : 'matching'} expectations)`;
  }

  // --- Component 4: Opponent League Position (10%) ---
  // Average league position of opponents at the time of each match.
  const positionScores: number[] = [];

  for (const m of lastN) {
    const opp = m.homeTeam === team ? m.awayTeam : m.homeTeam;
    const matchDate = parseDate(m.date);
    const table = buildLeagueTable(matches, matchDate);
    const pos = getTablePosition(table, opp);
    // Position 1 = toughest (score 100), position 20 = weakest (score 5)
    positionScores.push(Math.max(5, 105 - pos * 5));
  }

  let positionScore = 50;
  let positionDetail = 'No table data';
  if (positionScores.length > 0) {
    const avgPosScore = positionScores.reduce((s, v) => s + v, 0) / positionScores.length;
    positionScore = Math.round(avgPosScore);
    // Derive approximate average position from score
    const avgPos = Math.round((105 - positionScore) / 5);
    positionDetail = `Avg opp position: ~${avgPos}${avgPos === 1 ? 'st' : avgPos === 2 ? 'nd' : avgPos === 3 ? 'rd' : 'th'} (${avgPos <= 4 ? 'top sides' : avgPos <= 10 ? 'mid-table' : 'lower half'})`;
  }

  // --- Composite Score ---
  const score = Math.round(
    oppStrengthScore * WEIGHT_OPP_STRENGTH +
    marketScore * WEIGHT_MARKET +
    surpriseScore * WEIGHT_SURPRISE +
    positionScore * WEIGHT_POSITION
  );

  // --- Tier classification ---
  const tier: StreakQualityResult['tier'] =
    score >= 80 ? 'Elite' :
    score >= 65 ? 'Strong' :
    score >= 50 ? 'Solid' :
    score >= 35 ? 'Ordinary' :
    score >= 20 ? 'Weak' : 'Inflated';

  return {
    score,
    tier,
    rawPoints,
    form,
    components: {
      opponentStrength: { score: oppStrengthScore, detail: oppStrengthDetail },
      marketDifficulty: { score: marketScore, detail: marketDetail },
      modelSurprise: { score: surpriseScore, detail: surpriseDetail },
      opponentPosition: { score: positionScore, detail: positionDetail },
    },
  };
}

// --- Tier color mapping (for UI) ---

export const TIER_COLORS: Record<StreakQualityResult['tier'], { bg: string; text: string; border: string }> = {
  Elite:   { bg: 'bg-emerald-500',   text: 'text-white', border: 'border-emerald-400' },
  Strong:  { bg: 'bg-green-600',     text: 'text-white', border: 'border-green-400' },
  Solid:   { bg: 'bg-blue-500',      text: 'text-white', border: 'border-blue-400' },
  Ordinary:{ bg: 'bg-gray-400',      text: 'text-white', border: 'border-gray-300' },
  Weak:    { bg: 'bg-orange-500',     text: 'text-white', border: 'border-orange-400' },
  Inflated:{ bg: 'bg-red-500',       text: 'text-white', border: 'border-red-400' },
};

export const TIER_DESCRIPTIONS: Record<StreakQualityResult['tier'], string> = {
  Elite: 'Beating strong opponents, often as underdog — genuine top form',
  Strong: 'Overperforming expectations against quality opposition',
  Solid: 'Good results, but mostly against average sides',
  Ordinary: 'Mixed bag — winning the matches they should, losing the tough ones',
  Weak: 'Dropping points even against weaker opposition',
  Inflated: 'Winning streak built on easy fixtures — likely unsustainable',
};
