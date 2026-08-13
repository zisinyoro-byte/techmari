// ============================================================================
// predict-core.ts — Unified prediction engine (single source of truth)
// ============================================================================
// This module contains the canonical prediction logic shared by:
//   - src/app/api/soccer/predict/route.ts (production)
//   - src/app/api/soccer/backtest/route.ts (backtest validation)
//
// Both routes MUST call `generatePredictionCore()` so that backtest accuracy
// reflects production behaviour. Previously the backtest used a separate
// `generateBacktestPredictions` function with simpler team stats, no DC
// optimization, no H2H blending, and analytical NB probabilities — all of
// which diverged from production. This file eliminates that divergence.
//
// Flags (PredictOptions) allow callers to disable specific stages:
//   - Backtest passes: applyCalibration=false, applyDampener=false
//     (because it is MEASURING the raw model to compute calibration ratios)
//   - Production passes: all flags true (default)
//
// The `beforeDate` flag allows backtest to filter H2H matches to only those
// that occurred before the test match date, preventing look-ahead bias.
// ============================================================================

import type { MatchResult, TeamStats, PredictionResult } from '@/lib/types';
import { calculateBidirectionalHomeAdvantage } from './home-advantage';
import { runMonteCarlo } from './monte-carlo';
import { estimateDispersion } from './poisson';
import { optimizeDixonColes, type DixonColesParams } from './dixon-coles-optimizer';
import { getCalibration, applyCalibration } from './calibration-store';
import { applyBookieOddsDampener, computeTeamAvgOdds } from '@/lib/betting-filters';
import { weightedAverage } from './season-weighting';
import { estimateMatchupDispersion, estimateMatchupHtFtRatio } from './dispersion-estimator';
import { computeAnalyticalDC, computeKellyStakes } from './analytical-dc';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SeasonStatsEntry {
  season: string;
  weight: number;
  stats: Map<string, TeamStats>;
}

export interface PredictOptions {
  /** Use Dixon-Coles gradient descent optimization for attack/defense params. Default: true */
  useDixonColes?: boolean;
  /** Blend base lambdas with H2H-informed lambdas when ≥4 historical meetings exist. Default: true */
  useH2HBlend?: boolean;
  /** Use Monte Carlo simulation for probability computation. Default: true
   *  When false, falls back to analytical NB/Poisson sum (faster, no sampling noise). */
  useMonteCarlo?: boolean;
  /** Monte Carlo iteration count. Default: 100000 (production). Backtest may use 10000 for speed. */
  mcIterations?: number;
  /** Apply league calibration ratios (from prior backtest) to raw probabilities. Default: true.
   *  Backtest MUST set this to false — it is measuring the raw model. */
  applyCalibration?: boolean;
  /** Apply bookie odds dampener for heavy favorites. Default: true.
   *  Backtest MUST set this to false — the dampener depends on calibration being applied. */
  applyDampener?: boolean;
  /** Walk-forward cutoff: only consider matches with date < beforeDate for H2H blending.
   *  Used by backtest to prevent look-ahead bias. Production leaves this undefined. */
  beforeDate?: string;
  /** Use per-matchup dispersion estimation (filters historical matches by similar
   *  strength differential). Default: false — currently disabled because it interacts
   *  badly with the Jensen-gap BTTS correction (which was tuned for league-wide
   *  dispersion). Enable experimentally if you also re-tune the Jensen correction. */
  useMatchupDispersion?: boolean;
  /** Bookmaker odds for Kelly criterion calculation (decimal). When provided,
   *  the prediction output will include kellyStakes. */
  bookieOdds?: {
    home?: number | null;
    draw?: number | null;
    away?: number | null;
    over25?: number | null;
    bttsYes?: number | null;
    over35?: number | null;
  };
  /** Log DC optimization progress to console. Default: false */
  verbose?: boolean;
}

export interface PredictionCoreInput {
  /** All training matches (multiple seasons flat-merged) */
  allMatches: MatchResult[];
  /** Pre-combined team stats (use `combineWeightedTeamStats` for multi-season, `calculateTeamStats` for single) */
  teamStats: Map<string, TeamStats>;
  /** League average home goals per match (computed from allMatches) */
  leagueHomeAvg: number;
  /** League average away goals per match (computed from allMatches) */
  leagueAwayAvg: number;
  /** League code (e.g. 'E0') — used for calibration store lookup */
  league: string;
}

// ---------------------------------------------------------------------------
// combineWeightedTeamStats – merge per-season TeamStats using exponential weights
// ---------------------------------------------------------------------------
// Moved here verbatim from predict/route.ts so both routes can use it.
// Used when training spans multiple seasons (e.g. backtest default = 5 seasons,
// production season='all' = 12 seasons).
// ---------------------------------------------------------------------------

export function combineWeightedTeamStats(entries: SeasonStatsEntry[]): Map<string, TeamStats> {
  const combined = new Map<string, TeamStats>();

  // Sort entries by season descending so the most recent season is first
  const sorted = [...entries].sort((a, b) => b.season.localeCompare(a.season));

  // Collect all teams across all seasons
  const allTeams = new Set<string>();
  for (const entry of entries) {
    for (const team of entry.stats.keys()) {
      allTeams.add(team);
    }
  }

  for (const team of allTeams) {
    // Find entries where this team has stats
    const teamEntries = entries
      .filter(e => e.stats.has(team))
      .sort((a, b) => b.season.localeCompare(a.season)); // most recent first

    if (teamEntries.length === 0) continue;

    // For form/recent data, use the most recent season's data
    const mostRecentStats = teamEntries[0].stats.get(team)!;

    // Weighted numeric fields
    const avgScored = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.avgScored,
    })));
    const avgConceded = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.avgConceded,
    })));
    const attack = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.attack,
    })));
    const defense = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.defense,
    })));
    const homeAttack = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.homeAttack,
    })));
    const awayAttack = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.awayAttack,
    })));
    const homeDefense = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.homeDefense,
    })));
    const awayDefense = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.awayDefense,
    })));
    const homeScored = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.homeScored,
    })));
    const homeConceded = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.homeConceded,
    })));
    const awayScored = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.awayScored,
    })));
    const awayConceded = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.awayConceded,
    })));
    const homeAdvantage = weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.homeAdvantage,
    })));

    // Aggregate counts (weighted sum)
    const totalGames = Math.round(weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.totalGames,
    }))));
    const homeGames = Math.round(weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.homeGames,
    }))));
    const awayGames = Math.round(weightedAverage(teamEntries.map(e => ({
      weight: e.weight,
      value: e.stats.get(team)!.awayGames,
    }))));

    // Use the most recent season for form data (non-weightable)
    combined.set(team, {
      attack: attack || 1,
      defense: defense || 1,
      homeAttack: homeAttack || 1,
      awayAttack: awayAttack || 1,
      homeDefense: homeDefense || 1,
      awayDefense: awayDefense || 1,
      homeAdvantage: Math.min(Math.max(homeAdvantage, 0.8), 1.3),
      avgScored,
      avgConceded,
      homeScored,
      homeConceded,
      awayScored,
      awayConceded,
      homeGames,
      awayGames,
      totalGames,
      wins: mostRecentStats.wins,
      draws: mostRecentStats.draws,
      losses: mostRecentStats.losses,
      recentForm: mostRecentStats.recentForm,
      recentGoalsScored: mostRecentStats.recentGoalsScored,
      recentGoalsConceded: mostRecentStats.recentGoalsConceded,
      bttsFullTime: mostRecentStats.bttsFullTime,
      bttsFirstHalf: mostRecentStats.bttsFirstHalf,
      bttsSecondHalf: mostRecentStats.bttsSecondHalf,
      over25: mostRecentStats.over25,
      over35: mostRecentStats.over35,
    });
  }

  return combined;
}

// ---------------------------------------------------------------------------
// Dixon-Coles param cache
// ---------------------------------------------------------------------------
// DC optimization is expensive (Adam with finite-difference gradients over
// 150 iterations). For backtests where training data is the same across
// hundreds of test matches, recomputing DC per match is wasteful.
//
// Cache key = `${league}:${firstMatchDate}:${lastMatchDate}:${matchCount}`
// This is unique per (league, training snapshot) and cheap to compute.
// ---------------------------------------------------------------------------

interface DCMatchData {
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
}

const dcParamsCache = new Map<string, DixonColesParams>();

function getDixonColesParams(
  league: string,
  matches: DCMatchData[],
  homeAvg: number,
  awayAvg: number,
  verbose: boolean,
): DixonColesParams {
  // Build cache key from training data fingerprint
  const cacheKey = `${league}:${matches.length}:${matches[0]?.homeTeam ?? ''}:${matches[matches.length - 1]?.awayTeam ?? ''}`;

  const cached = dcParamsCache.get(cacheKey);
  if (cached) return cached;

  const params = optimizeDixonColes(matches, homeAvg, awayAvg, {
    maxIterations: 150,
    learningRate: 0.008,
    verbose,
  });
  dcParamsCache.set(cacheKey, params);
  return params;
}

/**
 * Clear the DC params cache. Useful for tests or when training data changes.
 */
export function clearDixonColesCache(): void {
  dcParamsCache.clear();
}

// ---------------------------------------------------------------------------
// Date parsing helper (matches the format used elsewhere in the codebase)
// ---------------------------------------------------------------------------

function parseMatchDate(dateStr: string): number {
  if (!dateStr) return 0;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    let y = parseInt(parts[2]);
    if (y < 100) y += y < 50 ? 2000 : 1900;
    return new Date(y, parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
  }
  return new Date(dateStr).getTime();
}

// ---------------------------------------------------------------------------
// generatePredictionCore — the unified entry point
// ---------------------------------------------------------------------------

/**
 * Generate a match prediction using the same model that production serves.
 *
 * This function is the SINGLE SOURCE OF TRUTH for prediction logic.
 * Both `predict/route.ts` and `backtest/route.ts` must call it.
 *
 * Stages (all toggleable via options):
 *   1. Bidirectional home advantage (always on)
 *   2. Dixon-Coles gradient descent optimization (optional, default on)
 *   3. H2H-informed lambda blending (optional, default on, respects `beforeDate`)
 *   4. Negative Binomial dispersion estimation (always on)
 *   5. Monte Carlo simulation (optional, default on) OR analytical NB
 *   6. Dixon-Coles rho correction to scoreline matrix (always applied if rho > 0)
 *   7. Jensen-gap BTTS correction (always applied)
 *   8. League calibration correction (optional, default on)
 *   9. Bookie odds dampener for heavy favorites (optional, default on)
 *
 * @param input    - Pre-fetched matches, team stats, league averages
 * @param homeTeam - Home team name
 * @param awayTeam - Away team name
 * @param options  - Feature flags (see PredictOptions)
 * @returns PredictionResult with probabilities for all markets
 */
export function generatePredictionCore(
  input: PredictionCoreInput,
  homeTeam: string,
  awayTeam: string,
  options: PredictOptions = {},
): PredictionResult {
  const {
    useDixonColes = true,
    useH2HBlend = true,
    useMonteCarlo = true,
    mcIterations = 100000,
    applyCalibration: doCalibration = true,
    applyDampener: doDampener = true,
    beforeDate,
    useMatchupDispersion = false, // disabled by default — see PredictOptions docs
    verbose = false,
  } = options;

  const { allMatches, teamStats, leagueHomeAvg, leagueAwayAvg, league } = input;

  const homeStats = teamStats.get(homeTeam);
  const awayStats = teamStats.get(awayTeam);

  if (!homeStats || !awayStats) {
    // Should not happen if caller pre-checks; return a safe fallback
    throw new Error(`Team not found in stats map: ${!homeStats ? homeTeam : awayTeam}`);
  }

  // Calculate bidirectional home advantage for this specific matchup
  const ha = calculateBidirectionalHomeAdvantage(
    homeStats.homeScored,
    homeStats.homeConceded,
    homeStats.awayScored,
    homeStats.awayConceded,
    leagueHomeAvg,
    leagueAwayAvg,
  );

  // -----------------------------------------------------------------------
  // Phase 2g: Gradient descent on Dixon-Coles parameters
  // -----------------------------------------------------------------------
  let optimizedHomeAdv: number | null = null;
  let optimizedRho: number | null = null;
  let optimizedAttack: Map<string, number> | null = null;
  let optimizedDefense: Map<string, number> | null = null;
  const DC_MIN_MATCHES = 100;
  if (useDixonColes && allMatches.length >= DC_MIN_MATCHES) {
    try {
      const dcMatches: DCMatchData[] = allMatches.map(m => ({
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        homeGoals: m.ftHomeGoals,
        awayGoals: m.ftAwayGoals,
      }));
      const dcParams = getDixonColesParams(league, dcMatches, leagueHomeAvg, leagueAwayAvg, verbose);
      // Production behavior: only use DC if it converged.
      // (Backtest could relax this to "always use partially-optimized params", but
      //  to match production exactly, we keep the same gating.)
      if (dcParams.converged) {
        optimizedHomeAdv = dcParams.homeAdvantage;
        optimizedRho = dcParams.rho;
        optimizedAttack = dcParams.attack;
        optimizedDefense = dcParams.defense;
        if (verbose) {
          console.log(`[PredictCore] Dixon-Coles: homeAdv=${optimizedHomeAdv.toFixed(4)}, rho=${optimizedRho.toFixed(4)}, NLL=${dcParams.nll.toFixed(2)}, iters=${dcParams.iterations}`);
        }
      }
    } catch (dcError) {
      if (verbose) console.warn('[PredictCore] Dixon-Coles optimization failed (non-fatal):', dcError);
    }
  }

  // -----------------------------------------------------------------------
  // Phase 2c: H2H-based lambda adjustment
  // -----------------------------------------------------------------------
  // Walk-forward: filter by beforeDate to prevent look-ahead bias in backtest.
  const h2hMatches = allMatches.filter(m => {
    if (!((m.homeTeam === homeTeam && m.awayTeam === awayTeam) ||
          (m.homeTeam === awayTeam && m.awayTeam === homeTeam))) {
      return false;
    }
    if (beforeDate && parseMatchDate(m.date) >= parseMatchDate(beforeDate)) {
      return false;
    }
    return true;
  });
  const H2H_MIN_SAMPLE = 4;
  const H2H_BLEND_WEIGHT = 0.3;

  // Use optimized home advantage if available, otherwise bidirectional
  const effectiveHomeAdv = optimizedHomeAdv ?? ha.scoringAdvantage;
  const effectiveRho = optimizedRho ?? (h2hMatches.length >= H2H_MIN_SAMPLE ? 0.05 : 0);

  // -----------------------------------------------------------------------
  // Phase 2a + 2g: Lambda calculation (DC-optimized if available, else ratio)
  // -----------------------------------------------------------------------
  let lambdaHome: number;
  let lambdaAway: number;
  if (optimizedAttack && optimizedDefense) {
    const dcHomeAttack = optimizedAttack.get(homeTeam) ?? homeStats.homeAttack;
    const dcAwayDefense = optimizedDefense.get(awayTeam) ?? awayStats.awayDefense;
    const dcAwayAttack = optimizedAttack.get(awayTeam) ?? awayStats.awayAttack;
    const dcHomeDefense = optimizedDefense.get(homeTeam) ?? homeStats.homeDefense;
    lambdaHome = dcHomeAttack * dcAwayDefense * leagueHomeAvg * effectiveHomeAdv;
    lambdaAway = dcAwayAttack * dcHomeDefense * leagueAwayAvg;
    if (verbose) {
      console.log(`[PredictCore] DC lambdas: home=${lambdaHome.toFixed(3)} away=${lambdaAway.toFixed(3)}`);
    }
  } else {
    lambdaHome = homeStats.homeAttack * awayStats.awayDefense * leagueHomeAvg * effectiveHomeAdv;
    lambdaAway = awayStats.awayAttack * homeStats.homeDefense * leagueAwayAvg * ha.defensiveAdvantage;
  }

  let adjustedLambdaHome = lambdaHome;
  let adjustedLambdaAway = lambdaAway;

  if (useH2HBlend && h2hMatches.length >= H2H_MIN_SAMPLE) {
    const h2hAvgHomeGoals = h2hMatches.reduce((sum, m) =>
      sum + (m.homeTeam === homeTeam ? m.ftHomeGoals : m.ftAwayGoals), 0) / h2hMatches.length;
    const h2hAvgAwayGoals = h2hMatches.reduce((sum, m) =>
      sum + (m.homeTeam === awayTeam ? m.ftHomeGoals : m.ftAwayGoals), 0) / h2hMatches.length;
    adjustedLambdaHome = lambdaHome * (1 - H2H_BLEND_WEIGHT) + h2hAvgHomeGoals * H2H_BLEND_WEIGHT;
    adjustedLambdaAway = lambdaAway * (1 - H2H_BLEND_WEIGHT) + h2hAvgAwayGoals * H2H_BLEND_WEIGHT;
  }

  // -----------------------------------------------------------------------
  // Phase 2f: Negative Binomial dispersion estimation
  // -----------------------------------------------------------------------
  // Item 2: per-matchup dispersion estimation (OFF by default).
  //
  // When `useMatchupDispersion` is true, the dispersion parameter `r` is
  // estimated from historical matches with a similar strength differential
  // to the target matchup. This better captures the fact that mismatched
  // matchups have fatter tails (higher variance) than balanced matchups.
  //
  // DEFAULT: disabled. When enabled, it interacts badly with the Jensen-gap
  // BTTS correction (which was tuned for league-wide dispersion). To use it
  // safely, you must also re-tune `bttsJensenCorrection` per league. The
  // infrastructure is in place — flip the flag in predict/route.ts and
  // backtest/route.ts to enable experimentally.
  //
  // When disabled, falls back to league-wide dispersion (original behavior).
  const dispersion = useMatchupDispersion
    ? estimateMatchupDispersion(allMatches, teamStats, homeTeam, awayTeam, league)
    : estimateDispersion(allMatches.map(m => m.ftHomeGoals + m.ftAwayGoals));

  // -----------------------------------------------------------------------
  // Phase 2d + 2f: Monte Carlo simulation with NB dispersion and DC rho
  // -----------------------------------------------------------------------
  // Item 1 fix: pass per-league BTTS Jensen correction factor.
  // Item 3 fix: pass per-matchup HT/FT ratio (computed from league baseline
  //             + matchup scoring/mismatch adjustments).
  const htFtRatio = estimateMatchupHtFtRatio(
    league,
    adjustedLambdaHome,
    adjustedLambdaAway,
    homeStats.attack,
    awayStats.attack,
  );

  const iterations = useMonteCarlo ? mcIterations : 10000; // smaller default for analytical
  const prediction = runMonteCarlo(
    adjustedLambdaHome,
    adjustedLambdaAway,
    iterations,
    // Pass 0 for rho in MC — analytical DC handles 1X2 below
    0,
    dispersion,
    {
      bttsJensenCorrection: undefined, // let runMonteCarlo look up league default
      htFtRatio,
      league,
    },
  );

  // -----------------------------------------------------------------------
  // Phase 2j: Analytical Dixon-Coles for exact 1X2 probabilities
  // -----------------------------------------------------------------------
  // The MC simulation above generates goal markets (O2.5, BTTS, O3.5) using
  // NB dispersion. But for 1X2, we compute exact DC probabilities by
  // enumerating the full bivariate probability matrix with tau baked in.
  // This is mathematically correct — the MC post-hoc approach only
  // covered ~76% of probability mass and was an approximation.
  //
  // When rho ≈ 0, the analytical result is nearly identical to MC.
  // When rho is meaningful (0.05-0.15), this gives materially better 1X2.
  if (effectiveRho !== 0) {
    const dc = computeAnalyticalDC(adjustedLambdaHome, adjustedLambdaAway, effectiveRho, dispersion);
    prediction.homeWin = dc.homeWin;
    prediction.draw = dc.draw;
    prediction.awayWin = dc.awayWin;
    // Also update BTTS from analytical (more accurate than MC + Jensen correction)
    prediction.btts = dc.btts;
    // Re-derive implied odds for 1X2 from exact probabilities
    prediction.impliedOdds.homeWin = prediction.homeWin > 0 ? Math.round((100 / prediction.homeWin) * 100) / 100 : 999;
    prediction.impliedOdds.draw = prediction.draw > 0 ? Math.round((100 / prediction.draw) * 100) / 100 : 999;
    prediction.impliedOdds.awayWin = prediction.awayWin > 0 ? Math.round((100 / prediction.awayWin) * 100) / 100 : 999;
    prediction.impliedOdds.bttsYes = prediction.btts > 0 ? Math.round((100 / prediction.btts) * 100) / 100 : 999;
    prediction.impliedOdds.bttsNo = (100 - prediction.btts) > 0 ? Math.round((100 / (100 - prediction.btts)) * 100) / 100 : 999;
    if (verbose) {
      console.log(`[PredictCore] Analytical DC: H=${dc.homeWin}% D=${dc.draw}% A=${dc.awayWin}% BTTS=${dc.btts}% (matrix mass=${dc.totalMass})`);
    }
  }

  // -----------------------------------------------------------------------
  // Phase 2h: Calibration correction
  // -----------------------------------------------------------------------
  // Applied BEFORE dampener so the calibration ratio (measured against raw
  // model output in backtests) corrects the right baseline.
  if (doCalibration) {
    const calData = getCalibration(league);
    if (calData) {
      const rawH = applyCalibration(prediction.homeWin, calData.homeWin);
      const rawD = applyCalibration(prediction.draw, calData.draw);
      const rawA = applyCalibration(prediction.awayWin, calData.awayWin);
      const total1X2 = rawH + rawD + rawA;

      prediction.calibrated = {
        homeWin: Math.round((rawH / total1X2) * 100 * 10) / 10,
        draw: Math.round((rawD / total1X2) * 100 * 10) / 10,
        awayWin: Math.round((rawA / total1X2) * 100 * 10) / 10,
        over25: applyCalibration(prediction.over25, calData.over25),
        over15: applyCalibration(prediction.over15, calData.over15),
        btts: applyCalibration(prediction.btts, calData.bttsYes),
        over35: applyCalibration(prediction.over35, calData.over35),
      };
      prediction.calibrationSource = {
        testSeason: calData.testSeason,
        matches: calData.matches,
        brierScore: calData.brierScore,
      };

      // Apply calibrated values as the new baseline for dampener
      prediction.over25 = prediction.calibrated.over25;
      prediction.over35 = prediction.calibrated.over35;
      prediction.btts = prediction.calibrated.btts;
    }
  }

  // -----------------------------------------------------------------------
  // Phase 2i: Bookie odds dampener for heavy favorites
  // -----------------------------------------------------------------------
  if (doDampener) {
    const homeAvgOdds = computeTeamAvgOdds(allMatches, homeTeam);
    const awayAvgOdds = computeTeamAvgOdds(allMatches, awayTeam);
    const dampened = applyBookieOddsDampener(
      prediction.over25, prediction.over35, prediction.btts,
      homeAvgOdds, awayAvgOdds,
      leagueHomeAvg + leagueAwayAvg,
    );
    if (dampened.dampened) {
      prediction.over25 = dampened.over25;
      prediction.over35 = dampened.over35;
      prediction.btts = dampened.btts;
      if (prediction.calibrated) {
        prediction.calibrated.over25 = dampened.over25;
        prediction.calibrated.over35 = dampened.over35;
        prediction.calibrated.btts = dampened.btts;
      }
      if (verbose) {
        console.log(`[PredictCore] ${dampened.reason} → O2.5: ${dampened.over25}%, BTTS: ${dampened.btts}%`);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Phase 2k: Kelly criterion stake sizing
  // -----------------------------------------------------------------------
  if (options.bookieOdds) {
    const kelly = computeKellyStakes(
      {
        homeWin: prediction.homeWin,
        draw: prediction.draw,
        awayWin: prediction.awayWin,
        over25: prediction.over25,
        btts: prediction.btts,
        over35: prediction.over35,
      },
      options.bookieOdds,
      0.25, // quarter Kelly for safety
    );
    prediction.kellyStakes = kelly;
  }

  // Flag whether analytical DC was used
  prediction.analyticalDC = effectiveRho !== 0;

  return prediction;
}

// ---------------------------------------------------------------------------
// extractBacktestShape – flatten PredictionResult to backtest's compact shape
// ---------------------------------------------------------------------------
// Backtest stores predictions in a compact `{homeWin, draw, awayWin, over15,
// over25, over35, btts, totalXg}` shape. This helper extracts those fields
// from a full PredictionResult so backtest code stays clean.
// ---------------------------------------------------------------------------

export interface BacktestPrediction {
  homeWin: number;
  draw: number;
  awayWin: number;
  over15: number;
  over25: number;
  btts: number;
  totalXg: number;
  over35?: number;
  dispersion?: number;
}

export function extractBacktestShape(pred: PredictionResult): BacktestPrediction {
  return {
    homeWin: pred.homeWin,
    draw: pred.draw,
    awayWin: pred.awayWin,
    over15: pred.over15,
    over25: pred.over25,
    btts: pred.btts,
    totalXg: pred.homeXg + pred.awayXg,
    over35: pred.over35,
  };
}
