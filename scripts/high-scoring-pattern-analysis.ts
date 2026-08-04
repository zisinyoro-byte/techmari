/**
 * High-Scoring Pattern Analysis
 * ==============================
 * For each match, computes ROLLING pre-match features (not season-level averages)
 * and correlates them against actual 3+ and 4+ goal outcomes.
 *
 * Key insight: the current model uses season-level averages, so a team's matchday 1
 * and matchday 38 get the same prediction. This script tests whether rolling 5-game
 * windows + bookmaker O2.5 odds improve identification of high-scoring games.
 *
 * Usage: npx tsx scripts/high-scoring-pattern-analysis.ts
 */

import { fetchSeasonData } from '../src/lib/data-cache';
import { calculateLeagueAverages, generateBacktestPredictions } from '../src/lib/models/predictions';
import { calculateSeasonWeights } from '../src/lib/models/season-weighting';

// --- Config ---
const ROLLING_WINDOW = 5;
const SEASONS = ['2526', '2425', '2324', '2223', '2122'];
const LEAGUES = [
  { code: 'D1', name: 'Bundesliga' },
  { code: 'N1', name: 'Eredivisie' },
  { code: 'F1', name: 'Ligue 1' },
  { code: 'E0', name: 'Premier League' },
  { code: 'SP1', name: 'La Liga' },
  { code: 'I1', name: 'Serie A' },
  { code: 'D2', name: '2. Bundesliga' },
  { code: 'F2', name: 'Ligue 2' },
  { code: 'E1', name: 'Championship' },
  { code: 'P1', name: 'Primeira Liga' },
];

// --- Types ---
interface PreMatchFeatures {
  date: string;
  homeTeam: string;
  awayTeam: string;
  totalGoals: number;         // actual outcome
  over25: boolean;             // actual
  over35: boolean;             // actual
  btts: boolean;              // actual
  // Rolling features (computed from last N games BEFORE this match)
  homeRollingScored: number;    // avg goals scored in last N home games
  homeRollingConceded: number;  // avg goals conceded in last N home games
  awayRollingScored: number;    // avg goals scored in last N away games
  awayRollingConceded: number;  // avg goals conceded in last N away games
  combinedRollingScoring: number; // homeRollingScored + awayRollingScored
  combinedRollingConceding: number;
  homeRollingSOT: number | null;
  awayRollingSOT: number | null;
  homeRollingSOTConv: number | null;  // SOT conversion %
  awayRollingSOTConv: number | null;
  homeRollingBTTS: number;      // BTTS rate in last N games
  awayRollingBTTS: number;
  homeRollingOver25: number;    // O2.5 rate in last N games
  awayRollingOver25: number;
  // Model features
  totalXg: number;
  modelO25: number;
  modelBTTS: number;
  // Odds features
  o25ImpliedProb: number | null;  // 1 / oddsAvgOver25
  favoriteOdds: number | null;
  minOdds: number | null;
  oddsSpread: number | null;      // 1 - 1/min(oddsHome, oddsAway) — how heavy the favorite
  // League context
  leagueAvgGPG: number;
  // Variance features
  homeGoalVariance: number;     // variance of total goals in last N home games
  awayGoalVariance: number;
}

// --- Helpers ---

function getRollingStats(
  team: string,
  isHome: boolean,
  allPriorMatches: MatchResult[],
  window: number
): {
  scored: number; conceded: number;
  sot: number | null; sotConv: number | null;
  bttsRate: number; over25Rate: number; goalVariance: number;
} {
  // Get this team's prior matches (home or away)
  const teamMatches = allPriorMatches.filter(m =>
    isHome ? m.homeTeam === team : m.awayTeam === team
  ).slice(-window); // last N

  if (teamMatches.length === 0) {
    return { scored: 0, conceded: 0, sot: null, sotConv: null, bttsRate: 0.5, over25Rate: 0.5, goalVariance: 0 };
  }

  const n = teamMatches.length;
  let scored = 0, conceded = 0, bttsCount = 0, over25Count = 0;
  let sotTotal = 0, goalsTotal = 0;
  const totalGoalsArr: number[] = [];

  for (const m of teamMatches) {
    const s = isHome ? m.ftHomeGoals : m.ftAwayGoals;
    const c = isHome ? m.ftAwayGoals : m.ftHomeGoals;
    const sot = isHome ? m.homeShotsOnTarget : m.awayShotsOnTarget;
    scored += s;
    conceded += c;
    sotTotal += sot;
    goalsTotal += s;
    totalGoalsArr.push(m.ftHomeGoals + m.ftAwayGoals);
    if (m.ftHomeGoals > 0 && m.ftAwayGoals > 0) bttsCount++;
    if (m.ftHomeGoals + m.ftAwayGoals > 2.5) over25Count++;
  }

  const mean = totalGoalsArr.reduce((a, b) => a + b, 0) / n;
  const variance = totalGoalsArr.reduce((s, g) => s + (g - mean) ** 2, 0) / n;

  return {
    scored: scored / n,
    conceded: conceded / n,
    sot: sotTotal / n,
    sotConv: goalsTotal > 0 ? (goalsTotal / sotTotal) * 100 : null,
    bttsRate: bttsCount / n,
    over25Rate: over25Count / n,
    goalVariance: variance,
  };
}

// Simple feature → outcome correlation
function computeFeatureCorrelation(
  records: PreMatchFeatures[],
  getFeature: (r: PreMatchFeatures) => number | null,
  getOutcome: (r: PreMatchFeatures) => boolean
): { meanAbove: number; meanBelow: number; correlation: number; bestThreshold: number; bestLift: number; samplesAtBest: number } {
  const valid = records.filter(r => {
    const f = getFeature(r);
    return f !== null && !isNaN(f);
  });

  if (valid.length < 50) return { meanAbove: 0, meanBelow: 0, correlation: 0, bestThreshold: 0, bestLift: 0, samplesAtBest: 0 };

  const baseRate = valid.filter(r => getOutcome(r)).length / valid.length;

  // Find best threshold
  let bestThreshold = 0;
  let bestLift = 0;
  let bestSamples = 0;

  const featureValues = valid.map(r => getFeature(r)!);
  const min = Math.min(...featureValues);
  const max = Math.max(...featureValues);
  const range = max - min;

  // Sweep 50 thresholds
  const step = range / 50 || 0.01;
  for (let t = min; t <= max; t += step) {
    const above = valid.filter(r => getFeature(r)! >= t);
    if (above.length < 30) continue;
    const hitRate = above.filter(r => getOutcome(r)).length / above.length;
    const lift = hitRate / baseRate;
    if (lift > bestLift || (lift === bestLift && above.length > bestSamples)) {
      bestLift = lift;
      bestThreshold = t;
      bestSamples = above.length;
    }
  }

  // Point-biserial correlation
  const n = valid.length;
  const outcomes = valid.map(r => getOutcome(r) ? 1 : 0);
  const features = valid.map(r => getFeature(r)!);
  const fMean = features.reduce((a, b) => a + b, 0) / n;
  const oMean = outcomes.reduce((a, b) => a + b, 0) / n;
  let covSum = 0, fVarSum = 0, oVarSum = 0;
  for (let i = 0; i < n; i++) {
    covSum += (features[i] - fMean) * (outcomes[i] - oMean);
    fVarSum += (features[i] - fMean) ** 2;
    oVarSum += (outcomes[i] - oMean) ** 2;
  }
  const correlation = (fVarSum > 0 && oVarSum > 0)
    ? covSum / Math.sqrt(fVarSum * oVarSum)
    : 0;

  // Mean outcome above/below median threshold
  const medianThreshold = bestThreshold;
  const above = valid.filter(r => getFeature(r)! >= medianThreshold);
  const below = valid.filter(r => getFeature(r)! < medianThreshold);
  const meanAbove = above.length > 0 ? above.filter(r => getOutcome(r)).length / above.length : 0;
  const meanBelow = below.length > 0 ? below.filter(r => getOutcome(r)).length / below.length : 0;

  return { meanAbove, meanBelow, correlation, bestThreshold, bestLift, samplesAtBest: bestSamples };
}

// Combined feature analysis
function analyzeCombinations(
  records: PreMatchFeatures[],
  outcome: (r: PreMatchFeatures) => boolean
): void {
  const outcomeLabel = outcome === (r => r.over25) ? 'O2.5' : outcome === (r => r.over35) ? 'O3.5' : 'BTTS';
  const baseRate = records.filter(outcome).length / records.length;

  console.log(`\n  === COMBINED THRESHOLD ANALYSIS (${outcomeLabel}) ===`);
  console.log(`  Base rate: ${(baseRate * 100).toFixed(1)}%`);

  // Test key combinations
  const combos = [
    {
      name: 'totalXg >= 2.6 + combinedRollingScoring >= 2.8',
      filter: (r: PreMatchFeatures) => r.totalXg >= 2.6 && r.combinedRollingScoring >= 2.8,
    },
    {
      name: 'totalXg >= 2.6 + o25Implied >= 55%',
      filter: (r: PreMatchFeatures) => r.totalXg >= 2.6 && r.o25ImpliedProb !== null && r.o25ImpliedProb >= 55,
    },
    {
      name: 'combinedRollingScoring >= 3.0 + favoriteOdds 1.80-2.50',
      filter: (r: PreMatchFeatures) => r.combinedRollingScoring >= 3.0 && r.favoriteOdds !== null && r.favoriteOdds >= 1.80 && r.favoriteOdds <= 2.50,
    },
    {
      name: 'totalXg >= 2.8 + modelO25 >= 65%',
      filter: (r: PreMatchFeatures) => r.totalXg >= 2.8 && r.modelO25 >= 65,
    },
    {
      name: 'totalXg >= 2.6 + combinedRollingScoring >= 2.5 + o25Implied >= 53%',
      filter: (r: PreMatchFeatures) => r.totalXg >= 2.6 && r.combinedRollingScoring >= 2.5 && r.o25ImpliedProb !== null && r.o25ImpliedProb >= 53,
    },
    {
      name: 'modelO25 >= 60% + combinedRollingScoring >= 2.5',
      filter: (r: PreMatchFeatures) => r.modelO25 >= 60 && r.combinedRollingScoring >= 2.5,
    },
    {
      name: 'combinedRollingScoring >= 3.0 + combinedRollingConceding >= 2.5',
      filter: (r: PreMatchFeatures) => r.combinedRollingScoring >= 3.0 && r.combinedRollingConceding >= 2.5,
    },
    {
      name: 'totalXg >= 2.6 + homeRollingScored >= 1.8 + awayRollingScored >= 1.3',
      filter: (r: PreMatchFeatures) => r.totalXg >= 2.6 && r.homeRollingScored >= 1.8 && r.awayRollingScored >= 1.3,
    },
    {
      name: 'totalXg >= 2.5 + o25Implied >= 55% + favoriteOdds >= 1.80',
      filter: (r: PreMatchFeatures) => r.totalXg >= 2.5 && r.o25ImpliedProb !== null && r.o25ImpliedProb >= 55 && r.favoriteOdds !== null && r.favoriteOdds >= 1.80,
    },
    {
      name: 'o25Implied >= 58% + combinedRollingScoring >= 2.8',
      filter: (r: PreMatchFeatures) => r.o25ImpliedProb !== null && r.o25ImpliedProb >= 58 && r.combinedRollingScoring >= 2.8,
    },
    {
      name: 'totalXg >= 2.5 + homeRollingOver25 >= 0.6 + awayRollingOver25 >= 0.5',
      filter: (r: PreMatchFeatures) => r.totalXg >= 2.5 && r.homeRollingOver25 >= 0.6 && r.awayRollingOver25 >= 0.5,
    },
    {
      name: 'modelO25 >= 65% + homeRollingScored >= 1.5 + awayRollingScored >= 1.2',
      filter: (r: PreMatchFeatures) => r.modelO25 >= 65 && r.homeRollingScored >= 1.5 && r.awayRollingScored >= 1.2,
    },
  ];

  const results = combos.map(c => {
    const passed = records.filter(c.filter);
    const hits = passed.filter(outcome).length;
    const rate = passed.length > 0 ? hits / passed.length : 0;
    const lift = baseRate > 0 ? rate / baseRate : 0;
    return { ...c, n: passed.length, hits, rate, lift };
  });

  // Sort by hit rate (descending), then by sample size
  results.sort((a, b) => b.rate - a.rate || b.n - a.n);

  for (const r of results) {
    if (r.n < 20) continue;
    const bar = '█'.repeat(Math.round(r.rate * 30));
    console.log(`  ${(r.rate * 100).toFixed(1).padStart(5)}% ${bar} (${r.n.toString().padStart(4)} matches, +${((r.lift - 1) * 100).toFixed(0).padStart(3)}% lift) — ${r.name}`);
  }
}

// --- Main ---
async function main() {
  console.log('=' .repeat(90));
  console.log('  HIGH-SCORING PATTERN ANALYSIS — Rolling Pre-Match Features vs Actual Outcomes');
  console.log('='.repeat(90));

  const allLeagueRecords: Map<string, { league: string; records: PreMatchFeatures[] }> = new Map();

  for (const league of LEAGUES) {
    console.log(`\nFetching ${league.name} (${league.code})...`);

    // Fetch ALL seasons (need prior matches for rolling windows)
    const allPriorSeasons = ['1819', '1920', '2021', '2122', '2223', '2324', '2425', '2526'];
    const fetchSeasons = allPriorSeasons.filter(s => s <= '2526');
    const allData = await fetchSeasonData(league.code, '1819') || [];
    // Fetch remaining seasons
    for (const s of ['1920', '2021', '2122', '2223', '2324', '2425', '2526']) {
      const data = await fetchSeasonData(league.code, s);
      if (data.length > 0) allData.push(...data);
    }

    // Deduplicate (fetchSeasonData may return overlaps if cache mixes)
    const seen = new Set<string>();
    const deduped = allData.filter(m => {
      const key = `${m.date}|${m.homeTeam}|${m.awayTeam}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort chronologically
    deduped.sort((a, b) => a.date.localeCompare(b.date));

    console.log(`  Total matches loaded: ${deduped.length}`);

    // For each test season, compute rolling features
    const records: PreMatchFeatures[] = [];

    for (const testSeason of SEASONS) {
      // Get the training seasons for model predictions
      const trainingSeasons = SEASONS.filter(s => s < testSeason).slice(-5);
      if (trainingSeasons.length < 2) continue;

      const trainingData = deduped.filter(m => trainingSeasons.includes(m.season));
      const testData = deduped.filter(m => m.season === testSeason);

      if (trainingData.length < 50 || testData.length < 20) continue;

      const seasonWeights = calculateSeasonWeights(trainingSeasons);
      const leagueAvgs = calculateLeagueAverages(trainingData);

      for (const match of testData) {
        // Only include matches where both teams have prior history
        const homePrior = deduped.filter(m =>
          m.date < match.date && (m.homeTeam === match.homeTeam || m.awayTeam === match.homeTeam)
        );
        const awayPrior = deduped.filter(m =>
          m.date < match.date && (m.homeTeam === match.awayTeam || m.awayTeam === match.awayTeam)
        );

        if (homePrior.length < ROLLING_WINDOW || awayPrior.length < ROLLING_WINDOW) continue;

        // All matches before this date (for rolling window)
        const allBefore = deduped.filter(m => m.date < match.date);

        // Rolling stats
        const homeStats = getRollingStats(match.homeTeam, true, allBefore, ROLLING_WINDOW);
        const awayStats = getRollingStats(match.awayTeam, false, allBefore, ROLLING_WINDOW);

        // Model predictions (season-level, same as current system)
        const predicted = generateBacktestPredictions(trainingData, match.homeTeam, match.awayTeam, leagueAvgs, seasonWeights);

        // Odds features
        const o25ImpliedProb = match.oddsAvgOver25 ? (1 / match.oddsAvgOver25) * 100 : null;
        const favOdds = match.oddsAvgHome && match.oddsAvgAway
          ? Math.min(match.oddsAvgHome, match.oddsAvgAway)
          : null;

        records.push({
          date: match.date,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          totalGoals: match.ftHomeGoals + match.ftAwayGoals,
          over25: match.ftHomeGoals + match.ftAwayGoals > 2.5,
          over35: match.ftHomeGoals + match.ftAwayGoals > 3.5,
          btts: match.ftHomeGoals > 0 && match.ftAwayGoals > 0,
          homeRollingScored: homeStats.scored,
          homeRollingConceded: homeStats.conceded,
          awayRollingScored: awayStats.scored,
          awayRollingConceded: awayStats.conceded,
          combinedRollingScoring: homeStats.scored + awayStats.scored,
          combinedRollingConceding: homeStats.conceded + awayStats.conceded,
          homeRollingSOT: homeStats.sot,
          awayRollingSOT: awayStats.sot,
          homeRollingSOTConv: homeStats.sotConv,
          awayRollingSOTConv: awayStats.sotConv,
          homeRollingBTTS: homeStats.bttsRate,
          awayRollingBTTS: awayStats.bttsRate,
          homeRollingOver25: homeStats.over25Rate,
          awayRollingOver25: awayStats.over25Rate,
          totalXg: predicted.totalXg,
          modelO25: predicted.over25,
          modelBTTS: predicted.btts,
          o25ImpliedProb,
          favoriteOdds: favOdds,
          minOdds: favOdds,
          oddsSpread: favOdds ? 1 - (1 / favOdds) : null,
          leagueAvgGPG: leagueAvgs.avgTotalGoals,
          homeGoalVariance: homeStats.goalVariance,
          awayGoalVariance: awayStats.goalVariance,
        });
      }
    }

    if (records.length > 0) {
      allLeagueRecords.set(league.code, { league: league.name, records });
    }
    console.log(`  Usable records: ${records.length}`);
  }

  // ==============================================
  // GLOBAL ANALYSIS (all leagues pooled)
  // ==============================================
  const allRecords = Array.from(allLeagueRecords.values()).flatMap(l => l.records);
  console.log(`\n${'='.repeat(90)}`);
  console.log(`  GLOBAL ANALYSIS — ${allRecords.length} matches across ${allLeagueRecords.size} leagues`);
  console.log(`${'='.repeat(90)}`);

  const baseO25 = allRecords.filter(r => r.over25).length / allRecords.length * 100;
  const baseO35 = allRecords.filter(r => r.over35).length / allRecords.length * 100;
  const baseBTTS = allRecords.filter(r => r.btts).length / allRecords.length * 100;
  console.log(`  Base rates: O2.5=${baseO25.toFixed(1)}%, O3.5=${baseO35.toFixed(1)}%, BTTS=${baseBTTS.toFixed(1)}%`);

  // --- Individual Feature Correlations ---
  const features: { name: string; getter: (r: PreMatchFeatures) => number | null }[] = [
    { name: 'totalXg (model)', getter: r => r.totalXg },
    { name: 'combinedRollingScoring (last 5)', getter: r => r.combinedRollingScoring },
    { name: 'combinedRollingConceding (last 5)', getter: r => r.combinedRollingConceding },
    { name: 'homeRollingScored', getter: r => r.homeRollingScored },
    { name: 'awayRollingScored', getter: r => r.awayRollingScored },
    { name: 'homeRollingConceded', getter: r => r.homeRollingConceded },
    { name: 'awayRollingConceded', getter: r => r.awayRollingConceded },
    { name: 'modelO25%', getter: r => r.modelO25 },
    { name: 'modelBTTS%', getter: r => r.modelBTTS },
    { name: 'o25ImpliedProb% (odds)', getter: r => r.o25ImpliedProb },
    { name: 'favoriteOdds (lower=fav)', getter: r => r.favoriteOdds },
    { name: 'homeRollingSOT', getter: r => r.homeRollingSOT },
    { name: 'awayRollingSOT', getter: r => r.awayRollingSOT },
    { name: 'homeRollingSOTConv%', getter: r => r.homeRollingSOTConv },
    { name: 'awayRollingSOTConv%', getter: r => r.awayRollingSOTConv },
    { name: 'homeRollingBTTS rate', getter: r => r.homeRollingBTTS },
    { name: 'awayRollingBTTS rate', getter: r => r.awayRollingBTTS },
    { name: 'homeRollingOver25 rate', getter: r => r.homeRollingOver25 },
    { name: 'awayRollingOver25 rate', getter: r => r.awayRollingOver25 },
    { name: 'homeGoalVariance', getter: r => r.homeGoalVariance },
    { name: 'awayGoalVariance', getter: r => r.awayGoalVariance },
    { name: 'leagueAvgGPG', getter: r => r.leagueAvgGPG },
  ];

  for (const target of ['over25', 'over35'] as const) {
    const targetLabel = target === 'over25' ? 'O2.5 (3+ goals)' : 'O3.5 (4+ goals)';
    const getOutcome = target === 'over25' ? (r: PreMatchFeatures) => r.over25 : (r: PreMatchFeatures) => r.over35;

    console.log(`\n--- FEATURE RANKINGS for ${targetLabel} ---`);
    console.log(`${'Feature'.padEnd(35)} ${'Corr'.padStart(6)} ${'BestThresh'.padStart(10)} ${'HitRate'.padStart(8)} ${'Lift'.padStart(6)} ${'Samples'.padStart(7)}`);
    console.log('-'.repeat(80));

    const results = features.map(f => ({
      name: f.name,
      ...computeFeatureCorrelation(allRecords, f.getter, getOutcome),
    }));

    // Sort by correlation (absolute)
    results.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

    for (const r of results) {
      const hitPct = (r.meanAbove * 100).toFixed(1);
      console.log(
        `${r.name.padEnd(35)} ${r.correlation.toFixed(3).padStart(6)} ${r.bestThreshold.toFixed(2).padStart(10)} ${(hitPct + '%').padStart(8)} ${(r.bestLift.toFixed(2) + 'x').padStart(6)} ${r.samplesAtBest.toString().padStart(7)}`
      );
    }

    // Combined analysis
    analyzeCombinations(allRecords, getOutcome);
  }

  // ==============================================
  // PER-LEAGUE ANALYSIS — top features
  // ==============================================
  console.log(`\n${'='.repeat(90)}`);
  console.log(`  PER-LEAGUE TOP PREDICTORS`);
  console.log(`${'='.repeat(90)}`);

  for (const [code, { league, records }] of allLeagueRecords) {
    const baseRate = records.filter(r => r.over25).length / records.length * 100;
    console.log(`\n  ${league} (${code}) — ${records.length} matches, base O2.5 rate: ${baseRate.toFixed(1)}%`);

    // Top 5 features by correlation
    const featureResults = features.map(f => ({
      name: f.name,
      ...computeFeatureCorrelation(records, f.getter, r => r.over25),
    }));
    featureResults.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

    console.log(`  Top 5 features by correlation:`);
    for (let i = 0; i < Math.min(5, featureResults.length); i++) {
      const r = featureResults[i];
      console.log(`    ${i + 1}. ${r.name.padEnd(30)} corr=${r.correlation.toFixed(3)}  best@${r.bestThreshold.toFixed(2)} → ${(r.meanAbove * 100).toFixed(1)}% (${r.samplesAtBest} matches)`);
    }

    // Best combo for this league
    const combos = [
      { name: 'totalXg >= 2.6 + combinedRollingScoring >= 2.5', filter: (r: PreMatchFeatures) => r.totalXg >= 2.6 && r.combinedRollingScoring >= 2.5 },
      { name: 'totalXg >= 2.6 + o25Implied >= 55%', filter: (r: PreMatchFeatures) => r.totalXg >= 2.6 && r.o25ImpliedProb !== null && r.o25ImpliedProb >= 55 },
      { name: 'modelO25 >= 60% + combinedRollingScoring >= 2.5', filter: (r: PreMatchFeatures) => r.modelO25 >= 60 && r.combinedRollingScoring >= 2.5 },
      { name: 'combinedRollingScoring >= 2.8 + o25Implied >= 55%', filter: (r: PreMatchFeatures) => r.combinedRollingScoring >= 2.8 && r.o25ImpliedProb !== null && r.o25ImpliedProb >= 55 },
    ];

    let bestCombo = { name: '', rate: 0, n: 0 };
    for (const c of combos) {
      const passed = records.filter(c.filter);
      if (passed.length < 15) continue;
      const rate = passed.filter(r => r.over25).length / passed.length;
      if (rate > bestCombo.rate) bestCombo = { name: c.name, rate, n: passed.length };
    }
    if (bestCombo.n > 0) {
      console.log(`  Best combo: ${(bestCombo.rate * 100).toFixed(1)}% O2.5 hit rate (${bestCombo.n} matches) — ${bestCombo.name}`);
    }
  }

  // ==============================================
  // ROLLING vs SEASON-LEVEL COMPARISON
  // ==============================================
  console.log(`\n${'='.repeat(90)}`);
  console.log(`  ROLLING vs MODEL COMPARISON — Does rolling form add value?`);
  console.log(`${'='.repeat(90)}`);

  // Group matches by modelO25 buckets, then see if rolling scoring splits them
  const o25Buckets = [
    { label: 'modelO25 50-55%', min: 50, max: 55 },
    { label: 'modelO25 55-60%', min: 55, max: 60 },
    { label: 'modelO25 60-65%', min: 60, max: 65 },
    { label: 'modelO25 65-70%', min: 65, max: 70 },
    { label: 'modelO25 70-75%', min: 70, max: 75 },
    { label: 'modelO25 75-80%', min: 75, max: 80 },
    { label: 'modelO25 80%+', min: 80, max: 100 },
  ];

  console.log(`\n${'Bucket'.padEnd(20)} ${'Base O2.5'.padStart(10)} | ${'Rolling<2.5'.padStart(11)} ${'Rolling2.5-3'.padStart(12)} ${'Rolling>=3.0'.padStart(12)}`);
  console.log('-'.repeat(70));

  for (const bucket of o25Buckets) {
    const bucketMatches = allRecords.filter(r => r.modelO25 >= bucket.min && r.modelO25 < bucket.max);
    if (bucketMatches.length < 30) continue;

    const baseRate = bucketMatches.filter(r => r.over25).length / bucketMatches.length;
    const lowRolling = bucketMatches.filter(r => r.combinedRollingScoring < 2.5);
    const midRolling = bucketMatches.filter(r => r.combinedRollingScoring >= 2.5 && r.combinedRollingScoring < 3.0);
    const highRolling = bucketMatches.filter(r => r.combinedRollingScoring >= 3.0);

    const lowRate = lowRolling.length > 10 ? lowRolling.filter(r => r.over25).length / lowRolling.length : NaN;
    const midRate = midRolling.length > 10 ? midRolling.filter(r => r.over25).length / midRolling.length : NaN;
    const highRate = highRolling.length > 10 ? highRolling.filter(r => r.over25).length / highRolling.length : NaN;

    console.log(
      `${bucket.label.padEnd(20)} ${(baseRate * 100).toFixed(1).padStart(9)}% | `
      + `${lowRolling.length.toString().padStart(3)}m ${(lowRate * 100).toFixed(1).padStart(5)}% | `
      + `${midRolling.length.toString().padStart(3)}m ${(midRate * 100).toFixed(1).padStart(5)}% | `
      + `${highRolling.length.toString().padStart(3)}m ${(highRate * 100).toFixed(1).padStart(5)}%`
    );
  }

  // Same for O2.5 odds implied probability
  console.log(`\n  --- O2.5 ODDS IMPLIED PROBABILITY BUCKETS ---\n`);
  const oddsBuckets = [
    { label: 'o25Implied <50%', min: 0, max: 50 },
    { label: 'o25Implied 50-53%', min: 50, max: 53 },
    { label: 'o25Implied 53-56%', min: 53, max: 56 },
    { label: 'o25Implied 56-59%', min: 56, max: 59 },
    { label: 'o25Implied 59-62%', min: 59, max: 62 },
    { label: 'o25Implied 62-65%', min: 62, max: 65 },
    { label: 'o25Implied 65%+', min: 65, max: 100 },
  ];

  console.log(`${'Bucket'.padEnd(20)} ${'Matches'.padStart(8)} ${'O2.5 Hit'.padStart(9)} ${'O3.5 Hit'.padStart(9)}`);
  console.log('-'.repeat(50));

  for (const bucket of oddsBuckets) {
    const bucketMatches = allRecords.filter(r => r.o25ImpliedProb !== null && r.o25ImpliedProb >= bucket.min && r.o25ImpliedProb < bucket.max);
    if (bucketMatches.length < 20) continue;

    const o25Rate = bucketMatches.filter(r => r.over25).length / bucketMatches.length;
    const o35Rate = bucketMatches.filter(r => r.over35).length / bucketMatches.length;

    console.log(
      `${bucket.label.padEnd(20)} ${bucketMatches.length.toString().padStart(8)} ${(o25Rate * 100).toFixed(1).padStart(8)}% ${(o35Rate * 100).toFixed(1).padStart(8)}%`
    );
  }

  // ==============================================
  // FAVORITE ODDS vs HIGH SCORING
  // ==============================================
  console.log(`\n${'='.repeat(90)}`);
  console.log(`  FAVORITE ODDS vs HIGH-SCORING RATES`);
  console.log(`${'='.repeat(90)}`);

  const oddsRanges = [
    { label: 'Heavy fav (<=1.40)', min: 0, max: 1.40 },
    { label: 'Strong fav (1.40-1.60)', min: 1.40, max: 1.60 },
    { label: 'Moderate fav (1.60-1.80)', min: 1.60, max: 1.80 },
    { label: 'Competitive (1.80-2.10)', min: 1.80, max: 2.10 },
    { label: 'Even (2.10-2.50)', min: 2.10, max: 2.50 },
    { label: 'No clear fav (2.50+)', min: 2.50, max: 100 },
  ];

  console.log(`\n${'Favorite Odds Range'.padEnd(30)} ${'Matches'.padStart(8)} ${'O2.5'.padStart(8)} ${'O3.5'.padStart(8)} ${'BTTS'.padStart(8)}`);
  console.log('-'.repeat(65));

  for (const range of oddsRanges) {
    const subset = allRecords.filter(r => r.favoriteOdds !== null && r.favoriteOdds >= range.min && r.favoriteOdds < range.max);
    if (subset.length < 20) continue;
    const o25 = subset.filter(r => r.over25).length / subset.length;
    const o35 = subset.filter(r => r.over35).length / subset.length;
    const btts = subset.filter(r => r.btts).length / subset.length;
    console.log(
      `${range.label.padEnd(30)} ${subset.length.toString().padStart(8)} ${(o25 * 100).toFixed(1).padStart(7)}% ${(o35 * 100).toFixed(1).padStart(7)}% ${(btts * 100).toFixed(1).padStart(7)}%`
    );
  }

  console.log(`\n${'='.repeat(90)}`);
  console.log('  ANALYSIS COMPLETE');
  console.log('='.repeat(90));
}

type MatchResult = import('../src/lib/types').MatchResult;

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
