/**
 * EPL BTTS Both Halves — APP SIGNALS ANALYSIS
 * 
 * Focuses on the exact signals the techmari app shows:
 * - Team BTTS rate, O2.5 rate, form
 * - Model O2.5%, BTTS%, total xG, home xG, away xG
 * - Most likely scoreline + probability
 * - Dispersion (NB overdispersion)
 * - Combo filters the app uses
 */

// ---- Re-use model functions from previous script ----
interface MatchResult {
  date: string; homeTeam: string; awayTeam: string;
  ftHomeGoals: number; ftAwayGoals: number; ftResult: 'H' | 'D' | 'A';
  htHomeGoals: number; htAwayGoals: number; htResult: 'H' | 'D' | 'A';
  homeShots: number; awayShots: number;
  homeShotsOnTarget: number; awayShotsOnTarget: number;
  oddsAvgHome: number | null; oddsAvgDraw: number | null; oddsAvgAway: number | null;
  oddsOver25: number | null; oddsAvgOver25: number | null;
  season: string;
}

function lnFactorial(n: number): number {
  if (n <= 1) return 0;
  let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s;
}
function poissonPMF(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return Math.exp(k * Math.log(lambda) - lambda - lnFactorial(k));
}
function negativeBinomialPMF(r: number, p: number, k: number): number {
  if (r <= 0 || p <= 0 || p >= 1) return poissonPMF(r * (1 - p) / p, k);
  return Math.exp(lnFactorial(k + r - 1) - lnFactorial(k) - lnFactorial(r - 1) + r * Math.log(p) + k * Math.log(1 - p));
}
function goalProb(lambda: number, k: number, dispersion?: number): number {
  if (dispersion && isFinite(dispersion) && dispersion <= 100) {
    const mean = lambda; if (mean <= 0) return k === 0 ? 1 : 0;
    return negativeBinomialPMF(dispersion, mean / (mean + dispersion), k);
  }
  return poissonPMF(lambda, k);
}
function estimateDispersion(goals: number[]): number {
  const n = goals.length; if (n < 10) return Infinity;
  const mean = goals.reduce((s, g) => s + g, 0) / n; if (mean === 0) return Infinity;
  const variance = goals.reduce((s, g) => s + (g - mean) ** 2, 0) / (n - 1);
  if (variance <= mean) return Infinity;
  const r = (mean ** 2) / (variance - mean); const p = mean / variance;
  return (r <= 0 || p <= 0 || p >= 1) ? Infinity : r;
}
function calculateBidirectionalHomeAdvantage(hs: number, hc: number, as: number, ac: number, lh: number, la: number) {
  const avgSA = ((lh > 0 ? hs / lh : 1) + (la > 0 ? as / la : 1)) / 2;
  const avgDA = ((lh > 0 ? hc / lh : 1) + (la > 0 ? ac / la : 1)) / 2;
  return { scoringAdvantage: Math.max(0.8, Math.min(1.3, avgSA)), defensiveAdvantage: Math.max(0.8, Math.min(1.3, avgDA)) };
}

const DECAY_FACTOR = 0.65;
function calculateSeasonWeights(seasons: string[]): Map<string, number> {
  const weights = new Map<string, number>(); if (seasons.length === 0) return weights;
  const sorted = [...seasons].sort(); let weight = 1.0, totalWeight = 0;
  for (const season of sorted) { weights.set(season, weight); totalWeight += weight; weight *= DECAY_FACTOR; }
  for (const [season, w] of weights) weights.set(season, w / totalWeight);
  return weights;
}

interface TeamStatsResult {
 homeGames: number; awayGames: number; totalGames: number;
  avgHomeScored: number; avgHomeConceded: number; avgAwayScored: number; avgAwayConceded: number;
  form: number; bttsRate: number; over25Rate: number;
}

function calculateTeamStats(
  results: MatchResult[], team: string, seasonWeights?: Map<string, number>
): TeamStatsResult {
  let weightedResults = results;
  if (seasonWeights && seasonWeights.size > 0) {
    weightedResults = [];
    for (const match of results) {
      const copies = Math.max(1, Math.round((seasonWeights.get(match.season) ?? 1) * 10));
      for (let i = 0; i < copies; i++) weightedResults.push(match);
    }
  }
  const homeGames = weightedResults.filter(m => m.homeTeam === team);
  const awayGames = weightedResults.filter(m => m.awayTeam === team);
  const homeScored = homeGames.reduce((sum, m) => sum + m.ftHomeGoals, 0);
  const homeConceded = homeGames.reduce((sum, m) => sum + m.ftAwayGoals, 0);
  const awayScored = awayGames.reduce((sum, m) => sum + m.ftAwayGoals, 0);
  const awayConceded = awayGames.reduce((sum, m) => sum + m.ftHomeGoals, 0);
  const homeWins = homeGames.filter(m => m.ftResult === 'H').length;
  const awayWins = awayGames.filter(m => m.ftResult === 'A').length;
  const draws = homeGames.filter(m => m.ftResult === 'D').length + awayGames.filter(m => m.ftResult === 'D').length;
  const totalGames = homeGames.length + awayGames.length;
  return {
    homeGames: homeGames.length, awayGames: awayGames.length, totalGames,
    avgHomeScored: homeGames.length > 0 ? homeScored / homeGames.length : 0,
    avgHomeConceded: homeGames.length > 0 ? homeConceded / homeGames.length : 0,
    avgAwayScored: awayGames.length > 0 ? awayScored / awayGames.length : 0,
    avgAwayConceded: awayGames.length > 0 ? awayConceded / awayGames.length : 0,
    form: totalGames > 0 ? (homeWins + awayWins + 0.5 * draws) / totalGames : 0.5,
    bttsRate: totalGames > 0 ? [...homeGames, ...awayGames].filter(m => m.ftHomeGoals > 0 && m.ftAwayGoals > 0).length / totalGames : 0.5,
    over25Rate: totalGames > 0 ? [...homeGames, ...awayGames].filter(m => m.ftHomeGoals + m.ftAwayGoals > 2.5).length / totalGames : 0.5,
  };
}

interface LeagueAverages {
  avgHomeGoals: number; avgAwayGoals: number; avgTotalGoals: number;
  homeWinRate: number; drawRate: number; awayWinRate: number;
  bttsRate: number; over25Rate: number;
}

function calculateLeagueAverages(results: MatchResult[]): LeagueAverages {
  if (results.length === 0) return { avgHomeGoals: 1.5, avgAwayGoals: 1.2, avgTotalGoals: 2.7, homeWinRate: 0.45, drawRate: 0.25, awayWinRate: 0.30, bttsRate: 0.5, over25Rate: 0.5 };
  return {
    avgHomeGoals: results.reduce((s, m) => s + m.ftHomeGoals, 0) / results.length,
    avgAwayGoals: results.reduce((s, m) => s + m.ftAwayGoals, 0) / results.length,
    avgTotalGoals: results.reduce((s, m) => s + m.ftHomeGoals + m.ftAwayGoals, 0) / results.length,
    homeWinRate: results.filter(m => m.ftResult === 'H').length / results.length,
    drawRate: results.filter(m => m.ftResult === 'D').length / results.length,
    awayWinRate: results.filter(m => m.ftResult === 'A').length / results.length,
    bttsRate: results.filter(m => m.ftHomeGoals > 0 && m.ftAwayGoals > 0).length / results.length,
    over25Rate: results.filter(m => m.ftHomeGoals + m.ftAwayGoals > 2.5).length / results.length,
  };
}

interface FullPrediction {
  homeWin: number; draw: number; awayWin: number;
  over15: number; over25: number; btts: number; over35: number;
  totalXg: number; homeXg: number; awayXg: number;
  likelyScore: string; likelyScoreProb: number;
  dispersion: number | null;
  // Team-level signals
  homeBttsRate: number; awayBttsRate: number;
  homeOver25Rate: number; awayOver25Rate: number;
  homeForm: number; awayForm: number;
  homeAvgScored: number; homeAvgConceded: number;
  awayAvgScored: number; awayAvgConceded: number;
  // League signals
  leagueBttsRate: number; leagueOver25Rate: number; leagueAvgGoals: number;
}

function generateFullPrediction(
  trainingData: MatchResult[], homeTeam: string, awayTeam: string,
  leagueAvgs: LeagueAverages, seasonWeights?: Map<string, number>
): FullPrediction {
  const homeStats = calculateTeamStats(trainingData, homeTeam, seasonWeights);
  const awayStats = calculateTeamStats(trainingData, awayTeam, seasonWeights);

  const ha = calculateBidirectionalHomeAdvantage(
    homeStats.homeGames > 0 ? homeStats.avgHomeScored : leagueAvgs.avgHomeGoals,
    homeStats.homeGames > 0 ? homeStats.avgHomeConceded : leagueAvgs.avgAwayGoals,
    homeStats.awayGames > 0 ? awayStats.avgAwayScored : leagueAvgs.avgAwayGoals,
    homeStats.awayGames > 0 ? awayStats.avgAwayConceded : leagueAvgs.avgHomeGoals,
    leagueAvgs.avgHomeGoals, leagueAvgs.avgAwayGoals
  );

  const halfAvg = leagueAvgs.avgTotalGoals / 2;
  const homeXg = (halfAvg > 0 ? (homeStats.homeGames > 0 ? homeStats.avgHomeScored : leagueAvgs.avgHomeGoals) / halfAvg : 1)
    * (halfAvg > 0 ? (awayStats.awayGames > 0 ? awayStats.avgAwayConceded : leagueAvgs.avgHomeGoals) / halfAvg : 1)
    * leagueAvgs.avgHomeGoals * ha.scoringAdvantage;
  const awayXg = (halfAvg > 0 ? (awayStats.awayGames > 0 ? awayStats.avgAwayScored : leagueAvgs.avgAwayGoals) / halfAvg : 1)
    * (halfAvg > 0 ? (homeStats.homeGames > 0 ? homeStats.avgHomeConceded : leagueAvgs.avgAwayGoals) / halfAvg : 1)
    * leagueAvgs.avgAwayGoals * ha.defensiveAdvantage;
  const totalXg = homeXg + awayXg;

  const allGoals = trainingData.map(m => m.ftHomeGoals + m.ftAwayGoals);
  const dispersion = estimateDispersion(allGoals);
  const useNB = isFinite(dispersion) && dispersion <= 100;

  let hwp = 0, awp = 0, dp = 0;
  for (let i = 0; i <= 7; i++) for (let j = 0; j <= 7; j++) {
    const p = goalProb(homeXg, i, dispersion) * goalProb(awayXg, j, dispersion);
    if (i > j) hwp += p; else if (j > i) awp += p; else dp += p;
  }
  const formAdj = (homeStats.form - awayStats.form) * 0.1;
  const adjH = Math.max(0.1, Math.min(0.8, hwp + formAdj));
  const adjA = Math.max(0.1, Math.min(0.8, awp - formAdj));
  const adjD = Math.max(0.15, Math.min(0.4, 1 - adjH - adjA));
  const t = adjH + adjD + adjA;

  const p0 = goalProb(totalXg, 0, dispersion);
  const p1 = goalProb(totalXg, 1, dispersion);
  const p2 = goalProb(totalXg, 2, dispersion);
  const p3 = goalProb(totalXg, 3, dispersion);
  let bttsP = 0;
  for (let i = 1; i <= 7; i++) for (let j = 1; j <= 7; j++) bttsP += goalProb(homeXg, i, dispersion) * goalProb(awayXg, j, dispersion);
  const balLam = totalXg / 2;
  const bttsBal = (1 - Math.exp(-balLam)) * (1 - Math.exp(-balLam));
  const imb = Math.abs(homeXg - awayXg) / (homeXg + awayXg + 0.001);
  bttsP = bttsP + (bttsBal - bttsP) * 0.55 * imb;

  let bestScore = '0-0', bestProb = 0;
  for (let i = 0; i <= 5; i++) for (let j = 0; j <= 5; j++) {
    const p = goalProb(homeXg, i, dispersion) * goalProb(awayXg, j, dispersion);
    if (p > bestProb) { bestProb = p; bestScore = `${i}-${j}`; }
  }

  return {
    homeWin: Math.round(adjH / t * 100), draw: Math.round(adjD / t * 100), awayWin: Math.round(adjA / t * 100),
    over15: Math.round(Math.min(95, Math.max(40, (1 - p0 - p1) * 100))),
    over25: Math.round(Math.min(85, Math.max(35, (1 - p0 - p1 - p2) * 100))),
    btts: Math.round(bttsP * 100),
    over35: Math.round(Math.min(70, Math.max(10, (1 - p0 - p1 - p2 - p3) * 100))),
    totalXg: Math.round(totalXg * 100) / 100,
    homeXg: Math.round(homeXg * 100) / 100,
    awayXg: Math.round(awayXg * 100) / 100,
    likelyScore: bestScore, likelyScoreProb: Math.round(bestProb * 1000) / 10,
    dispersion: useNB ? Math.round(dispersion * 100) / 100 : null,
    homeBttsRate: Math.round(homeStats.bttsRate * 1000) / 10,
    awayBttsRate: Math.round(awayStats.bttsRate * 1000) / 10,
    homeOver25Rate: Math.round(homeStats.over25Rate * 1000) / 10,
    awayOver25Rate: Math.round(awayStats.over25Rate * 1000) / 10,
    homeForm: Math.round(homeStats.form * 1000) / 10,
    awayForm: Math.round(awayStats.form * 1000) / 10,
    homeAvgScored: Math.round(homeStats.avgHomeScored * 100) / 100,
    homeAvgConceded: Math.round(homeStats.avgHomeConceded * 100) / 100,
    awayAvgScored: Math.round(awayStats.avgAwayScored * 100) / 100,
  awayAvgConceded: Math.round(awayStats.avgAwayConceded * 100) / 100,
    leagueBttsRate: Math.round(leagueAvgs.bttsRate * 1000) / 10,
    leagueOver25Rate: Math.round(leagueAvgs.over25Rate * 1000) / 10,
    leagueAvgGoals: Math.round(leagueAvgs.avgTotalGoals * 100) / 100,
  };
}

// CSV Parser
function parseNumber(val: string | undefined): number | null {
  if (!val || val.trim() === '') return null;
  const n = parseFloat(val); return isNaN(n) ? null : n;
}
function parseCSV(csvText: string, season: string): MatchResult[] {
  const lines = csvText.trim().split('\n'); if (lines.length < 2) return [];
  const header = lines[0].replace(/^\uFEFF/, '').split(',');
  const ci: Record<string, number> = {}; header.forEach((c, i) => { ci[c.trim()] = i; });
  const results: MatchResult[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]; if (!line.trim()) continue;
    const v: string[] = []; let cv = ''; let inQ = false;
    for (const ch of line) { if (ch === '"') inQ = !inQ; else if (ch === ',' && !inQ) { v.push(cv.trim()); cv = ''; } else cv += ch; }
    v.push(cv.trim());
    const h = v[ci['HomeTeam']] || '', a = v[ci['AwayTeam']] || '';
    if (!h || !a) continue;
    results.push({
      date: v[ci['Date']] || '', homeTeam: h, awayTeam: a,
      ftHomeGoals: parseInt(v[ci['FTHG']] || '0', 10) || 0, ftAwayGoals: parseInt(v[ci['FTAG']] || '0', 10) || 0,
      ftResult: (v[ci['FTR']] || 'D') as 'H' | 'D' | 'A',
      htHomeGoals: parseInt(v[ci['HTHG']] || '0', 10) || 0, htAwayGoals: parseInt(v[ci['HTAG']] || '0', 10) || 0,
      htResult: (v[ci['HTR']] || 'D') as 'H' | 'D' | 'A',
      homeShots: parseInt(v[ci['HS']] || '0', 10) || 0, awayShots: parseInt(v[ci['AS']] || '0', 10) || 0,
      homeShotsOnTarget: parseInt(v[ci['HST']] || '0', 10) || 0, awayShotsOnTarget: parseInt(v[ci['AST']] || '0', 10) || 0,
      oddsAvgHome: parseNumber(v[ci['AvgH']]), oddsAvgDraw: parseNumber(v[ci['AvgD']]), oddsAvgAway: parseNumber(v[ci['AvgA']]),
      oddsOver25: parseNumber(v[ci['B365>2.5']]), oddsAvgOver25: parseNumber(v[ci['Avg>2.5']]),
      season,
    });
  }
  return results;
}

async function fetchSeason(league: string, season: string): Promise<MatchResult[]> {
  const url = `https://www.football-data.co.uk/mmz4281/${season}/${league}.csv`;
  console.log(`Fetching ${league} ${season}...`);
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/csv' } });
  if (!r.ok) { console.warn(`Failed: ${url} (${r.status})`); return []; }
  return parseCSV(await r.text(), season);
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  const LEAGUE = 'E0';
  const ALL_SEASONS = ['2627', '2526', '2425', '2324', '2223', '2122', '2021', '1920', '1819', '1718', '1617', '1516'];
  const CHRONO = [...ALL_SEASONS].reverse();
  const TEST_SEASONS = ['2021', '2122', '2223', '2324', '2425'];

  console.log('Fetching all EPL data...');
  const allData: MatchResult[] = [];
  for (const s of ALL_SEASONS) { allData.push(...await fetchSeason(LEAGUE, s)); await new Promise(r => setTimeout(r, 600)); }
  console.log(`Total: ${allData.length} matches`);

  // Find BTTS-BH games
  const bttsBH = allData.filter(m => {
    const shH = m.ftHomeGoals - m.htHomeGoals, shA = m.ftAwayGoals - m.htAwayGoals;
    return m.htHomeGoals > 0 && m.htAwayGoals > 0 && shH > 0 && shA > 0;
  }).map(m => ({ ...m, shHomeGoals: m.ftHomeGoals - m.htHomeGoals, shAwayGoals: m.ftAwayGoals - m.htAwayGoals, ftTotal: m.ftHomeGoals + m.ftAwayGoals }));
  console.log(`BTTS-BH: ${bttsBH.length} games (${(bttsBH.length / allData.length * 100).toFixed(1)}%)`);

  // Generate full predictions for test seasons
  interface PredMatch { match: typeof bttsBH[0]; pred: FullPrediction; }
  const bhPreds: PredMatch[] = [];
  const nonBHPreds: PredMatch[] = [];

  for (const ts of TEST_SEASONS) {
    const ci = CHRONO.indexOf(ts); if (ci < 5) continue;
    const trainSeasons = CHRONO.slice(ci - 5, ci);
    const trainData = allData.filter(m => trainSeasons.includes(m.season));
    const sw = calculateSeasonWeights(trainSeasons);
    const la = calculateLeagueAverages(trainData);

    for (const m of allData.filter(x => x.season === ts)) {
      const pred = generateFullPrediction(trainData, m.homeTeam, m.awayTeam, la, sw);
      const isBH = bttsBH.some(b => b.date === m.date && b.homeTeam === m.homeTeam && b.awayTeam === m.awayTeam);
      if (isBH) bhPreds.push({ match: m as any, pred });
      else if (Math.random() < 0.15) nonBHPreds.push({ match: m as any, pred }); // 15% sample
    }
  }

  console.log(`\nPredictions: ${bhPreds.length} BTTS-BH, ${nonBHPreds.length} non-BH sample`);

  // ========================================================================
  // SIGNAL 1: TEAM BTTS RATES (the "Best BTTS Teams" signal)
  // ========================================================================
  console.log('\n' + '='.repeat(90));
  console.log('SIGNAL 1: TEAM BTTS RATES — What do the app\'s team BTTS% look like?');
  console.log('='.repeat(90));

  const avgBhHomeBtts = bhPreds.reduce((s, p) => s + p.pred.homeBttsRate, 0) / bhPreds.length;
  const avgBhAwayBtts = bhPreds.reduce((s, p) => s + p.pred.awayBttsRate, 0) / bhPreds.length;
  const avgNonHomeBtts = nonBHPreds.reduce((s, p) => s + p.pred.homeBttsRate, 0) / nonBHPreds.length;
  const avgNonAwayBtts = nonBHPreds.reduce((s, p) => s + p.pred.awayBttsRate, 0) / nonBHPreds.length;

  console.log(`\n  Signal                     | BTTS-BH Games  | Non-BH Games   | Delta`);
  console.log('  ' + '-'.repeat(75));
  console.log(`  Home team BTTS rate      | ${avgBhHomeBtts.toFixed(1).padStart(13)}% | ${avgNonHomeBtts.toFixed(1).padStart(13)}% | ${(avgBhHomeBtts - avgNonHomeBtts).toFixed(1).padStart(5)}pp`);
  console.log(`  Away team BTTS rate      | ${avgBhAwayBtts.toFixed(1).padStart(13)}% | ${avgNonAwayBtts.toFixed(1).padStart(13)}% | ${(avgBhAwayBtts - avgNonAwayBtts).toFixed(1).padStart(5)}pp`);
  console.log(`  Combined avg BTTS rate   | ${((avgBhHomeBtts + avgBhAwayBtts) / 2).toFixed(1).padStart(13)}% | ${((avgNonHomeBtts + avgNonAwayBtts) / 2).toFixed(1).padStart(13)}% | ${(((avgBhHomeBtts + avgBhAwayBtts) / 2) - ((avgNonHomeBtts + avgNonAwayBtts) / 2)).toFixed(1).padStart(5)}pp`);

  // Both teams BTTS rate >= 50%
  const bhBothBtts50 = bhPreds.filter(p => p.pred.homeBttsRate >= 50 && p.pred.awayBttsRate >= 50).length;
  const nonBothBtts50 = nonBHPreds.filter(p => p.pred.homeBttsRate >= 50 && p.pred.awayBttsRate >= 50).length;
  console.log(`\n  Both teams BTTS rate >= 50%: ${bhBothBtts50}/${bhPreds.length} (${(bhBothBtts50/bhPreds.length*100).toFixed(1)}%) vs non-BH: ${nonBothBtts50}/${nonBHPreds.length} (${(nonBothBtts50/nonBHPreds.length*100).toFixed(1)}%)`);

  // Both teams BTTS rate >= 55%
  const bhBothBtts55 = bhPreds.filter(p => p.pred.homeBttsRate >= 55 && p.pred.awayBttsRate >= 55).length;
  const nonBothBtts55 = nonBHPreds.filter(p => p.pred.homeBttsRate >= 55 && p.pred.awayBttsRate >= 55).length;
  console.log(`  Both teams BTTS rate >= 55%: ${bhBothBtts55}/${bhPreds.length} (${(bhBothBtts55/bhPreds.length*100).toFixed(1)}%) vs non-BH: ${nonBothBtts55}/${nonBHPreds.length} (${(nonBothBtts55/nonBHPreds.length*100).toFixed(1)}%)`);

  // Min BTTS rate
  const bhMinBtts = bhPreds.map(p => Math.min(p.pred.homeBttsRate, p.pred.awayBttsRate));
  const nonMinBtts = nonBHPreds.map(p => Math.min(p.pred.homeBttsRate, p.pred.awayBttsRate));
  console.log(`  Min of two BTTS rates (avg): ${bhMinBtts.reduce((s,v)=>s+v,0)/bhMinBtts.length.toFixed(1)}% vs non-BH: ${nonMinBtts.reduce((s,v)=>s+v,0)/nonMinBtts.length.toFixed(1)}%`);

  // ========================================================================
  // SIGNAL 2: TEAM O2.5 RATES (the "Best O2.5 Teams" signal)
  // ========================================================================
  console.log('\n' + '='.repeat(90));
  console.log('SIGNAL 2: TEAM O2.5 RATES — What do the app\'s team O2.5% look like?');
  console.log('='.repeat(90));

  const avgBhHomeO25 = bhPreds.reduce((s, p) => s + p.pred.homeOver25Rate, 0) / bhPreds.length;
  const avgBhAwayO25 = bhPreds.reduce((s, p) => s + p.pred.awayOver25Rate, 0) / bhPreds.length;
  const avgNonHomeO25 = nonBHPreds.reduce((s, p) => s + p.pred.homeOver25Rate, 0) / nonBHPreds.length;
  const avgNonAwayO25 = nonBHPreds.reduce((s, p) => s + p.pred.awayOver25Rate, 0) / nonBHPreds.length;

  console.log(`\n  Signal                     | BTTS-BH Games  | Non-BH Games   | Delta`);
  console.log('  ' + '-'.repeat(75));
  console.log(`  Home team O2.5 rate      | ${avgBhHomeO25.toFixed(1).padStart(13)}% | ${avgNonHomeO25.toFixed(1).padStart(13)}% | ${(avgBhHomeO25 - avgNonHomeO25).toFixed(1).padStart(5)}pp`);
  console.log(`  Away team O2.5 rate      | ${avgBhAwayO25.toFixed(1).padStart(13)}% | ${avgNonAwayO25.toFixed(1).padStart(13)}% | ${(avgBhAwayO25 - avgNonAwayO25).toFixed(1).padStart(5)}pp`);

  const bhBothO2550 = bhPreds.filter(p => p.pred.homeOver25Rate >= 50 && p.pred.awayOver25Rate >= 50).length;
  const nonBothO2550 = nonBHPreds.filter(p => p.pred.homeOver25Rate >= 50 && p.pred.awayOver25Rate >= 50).length;
  console.log(`\n  Both teams O2.5 rate >= 50%: ${bhBothO2550}/${bhPreds.length} (${(bhBothO2550/bhPreds.length*100).toFixed(1)}%) vs non-BH: ${nonBothO2550}/${nonBHPreds.length} (${(nonBothO2550/nonBHPreds.length*100).toFixed(1)}%)`);

  // ========================================================================
  // SIGNAL 3: MODEL PROBABILITIES (O2.5%, BTTS%, O3.5%)
  // ========================================================================
  console.log('\n' + '='.repeat(90));
  console.log('SIGNAL 3: MODEL PREDICTED PROBABILITIES');
  console.log('='.repeat(90));

  const avg = (arr: PredMatch[], key: keyof FullPrediction) => arr.reduce((s, p) => s + (p.pred[key] as number), 0) / arr.length;

  console.log(`\n  Signal              | BTTS-BH Games  | Non-BH Games   | Delta`);
  console.log('  ' + '-'.repeat(75));
  console.log(`  Model O1.5%         | ${avg(bhPreds, 'over15').toFixed(1).padStart(13)}% | ${avg(nonBHPreds, 'over15').toFixed(1).padStart(13)}% | ${(avg(bhPreds, 'over15') - avg(nonBHPreds, 'over15')).toFixed(1).padStart(5)}pp`);
  console.log(`  Model O2.5%         | ${avg(bhPreds, 'over25').toFixed(1).padStart(13)}% | ${avg(nonBHPreds, 'over25').toFixed(1).padStart(13)}% | ${(avg(bhPreds, 'over25') - avg(nonBHPreds, 'over25')).toFixed(1).padStart(5)}pp`);
  console.log(`  Model O3.5%         | ${avg(bhPreds, 'over35').toFixed(1).padStart(13)}% | ${avg(nonBHPreds, 'over35').toFixed(1).padStart(13)}% | ${(avg(bhPreds, 'over35') - avg(nonBHPreds, 'over35')).toFixed(1).padStart(5)}pp`);
  console.log(`  Model BTTS%         | ${avg(bhPreds, 'btts').toFixed(1).padStart(13)}% | ${avg(nonBHPreds, 'btts').toFixed(1).padStart(13)}% | ${(avg(bhPreds, 'btts') - avg(nonBHPreds, 'btts')).toFixed(1).padStart(5)}pp`);
  console.log(`  Model Total xG      | ${avg(bhPreds, 'totalXg').toFixed(2).padStart(13)}  | ${avg(nonBHPreds, 'totalXg').toFixed(2).padStart(13)}  | ${(avg(bhPreds, 'totalXg') - avg(nonBHPreds, 'totalXg')).toFixed(2).padStart(5)}`);
  console.log(`  Model Home xG       | ${avg(bhPreds, 'homeXg').toFixed(2).padStart(13)}  | ${avg(nonBHPreds, 'homeXg').toFixed(2).padStart(13)}  | ${(avg(bhPreds, 'homeXg') - avg(nonBHPreds, 'homeXg')).toFixed(2).padStart(5)}`);
  console.log(`  Model Away xG       | ${avg(bhPreds, 'awayXg').toFixed(2).padStart(13)}  | ${avg(nonBHPreds, 'awayXg').toFixed(2).padStart(13)}  | ${(avg(bhPreds, 'awayXg') - avg(nonBHPreds, 'awayXg')).toFixed(2).padStart(5)}`);

  // ========================================================================
  // SIGNAL 4: COMBO FILTERS — what % of BTTS-BH pass common thresholds?
  // ========================================================================
  console.log('\n' + '='.repeat(90));
  console.log('SIGNAL 4: COMBO FILTER PASS RATES');
  console.log('What % of BTTS-BH games pass common filter combos vs non-BH?');
  console.log('='.repeat(90));

  const filters = [
    { name: 'O2.5 >= 60%', fn: (p: FullPrediction) => p.over25 >= 60 },
    { name: 'O2.5 >= 55%', fn: (p: FullPrediction) => p.over25 >= 55 },
    { name: 'BTTS >= 50%', fn: (p: FullPrediction) => p.btts >= 50 },
    { name: 'BTTS >= 55%', fn: (p: FullPrediction) => p.btts >= 55 },
    { name: 'O2.5>=60% AND BTTS>=50%', fn: (p: FullPrediction) => p.over25 >= 60 && p.btts >= 50 },
    { name: 'O2.5>=55% AND BTTS>=50%', fn: (p: FullPrediction) => p.over25 >= 55 && p.btts >= 50 },
    { name: 'O2.5>=60% AND BTTS>=55%', fn: (p: FullPrediction) => p.over25 >= 60 && p.btts >= 55 },
    { name: 'O2.5>=55% AND BTTS>=55%', fn: (p: FullPrediction) => p.over25 >= 55 && p.btts >= 55 },
    { name: 'O3.5 >= 40%', fn: (p: FullPrediction) => p.over35 >= 40 },
    { name: 'O3.5 >= 45%', fn: (p: FullPrediction) => p.over35 >= 45 },
    { name: 'Total xG >= 3.0', fn: (p: FullPrediction) => p.totalXg >= 3.0 },
    { name: 'Total xG >= 3.5', fn: (p: FullPrediction) => p.totalXg >= 3.5 },
    { name: 'Both BTTS rate >= 50%', fn: (p: FullPrediction) => p.homeBttsRate >= 50 && p.awayBttsRate >= 50 },
    { name: 'Both BTTS rate >= 50% + O2.5>=55%', fn: (p: FullPrediction) => p.homeBttsRate >= 50 && p.awayBttsRate >= 50 && p.over25 >= 55 },
    { name: 'Both BTTS rate >= 50% + BTTS>=50%', fn: (p: FullPrediction) => p.homeBttsRate >= 50 && p.awayBttsRate >= 50 && p.btts >= 50 },
    { name: 'Draw >= 25%', fn: (p: FullPrediction) => p.draw >= 25 },
    { name: 'Draw >= 25% + O2.5>=55%', fn: (p: FullPrediction) => p.draw >= 25 && p.over25 >= 55 },
    { name: 'O2.5>=55% + BTTS>=50% + Draw>=25%', fn: (p: FullPrediction) => p.over25 >= 55 && p.btts >= 50 && p.draw >= 25 },
    { name: 'O2.5>=60% + BTTS>=50% + Draw>=25%', fn: (p: FullPrediction) => p.over25 >= 60 && p.btts >= 50 && p.draw >= 25 },
  ];

  console.log(`\n  ${'Filter'.padEnd(45)} | ${'BTTS-BH'.padStart(8)} | ${'Non-BH'.padStart(8)} | ${'Lift'.padStart(8)}`);
  console.log('  ' + '-'.repeat(80));
  for (const f of filters) {
    const bhPass = bhPreds.filter(p => f.fn(p.pred)).length;
    const nonPass = nonBHPreds.filter(p => f.fn(p.pred)).length;
    const bhRate = bhPass / bhPreds.length * 100;
    const nonRate = nonPass / nonBHPreds.length * 100;
    const lift = nonRate > 0 ? (bhRate / nonRate) : Infinity;
    console.log(`  ${f.name.padEnd(45)} | ${bhRate.toFixed(1).padStart(6)}% | ${nonRate.toFixed(1).padStart(6)}% | ${lift.toFixed(2).padStart(6)}x`);
  }

  // ========================================================================
  // SIGNAL 5: LIKELY SCORELINE
  // ========================================================================
  console.log('\n' + '='.repeat(90));
  console.log('SIGNAL 5: MOST LIKELY SCORELINE PREDICTED BY MODEL');
  console.log('='.repeat(90));

  const scoreCounts = new Map<string, number>();
  for (const p of bhPreds) scoreCounts.set(p.pred.likelyScore, (scoreCounts.get(p.pred.likelyScore) || 0) + 1);
  console.log('\n  Predicted Score | Count | Pct   | Avg Score Prob');
  console.log('  ' + '-'.repeat(55));
  for (const [score, count] of [...scoreCounts.entries()].sort((a, b) => b[1] - a[1])) {
    const avgProb = bhPreds.filter(p => p.pred.likelyScore === score).reduce((s, p) => s + p.pred.likelyScoreProb, 0) / count;
    console.log(`  ${score.padEnd(15)} | ${String(count).padStart(5)} | ${(count / bhPreds.length * 100).toFixed(1).padStart(5)}% | ${avgProb.toFixed(1)}%`);
  }

  // How often was the predicted scoreline 1-1, 2-1, 1-2, 2-2 (high BTTS scores)?
  const highBttsScores = ['1-1', '2-1', '1-2', '2-2', '3-2', '2-3'];
  const bhHighBttsScore = bhPreds.filter(p => highBttsScores.includes(p.pred.likelyScore)).length;
  const nonHighBttsScore = nonBHPreds.filter(p => highBttsScores.includes(p.pred.likelyScore)).length;
  console.log(`\n  Predicted score in {1-1,2-1,1-2,2-2,3-2,2-3}: BH ${(bhHighBttsScore/bhPreds.length*100).toFixed(1)}% vs non-BH ${(nonHighBttsScore/nonBHPreds.length*100).toFixed(1)}%`);

  // ========================================================================
  // SIGNAL 6: FORM & TEAM SCORING/CONCEDING
  // ========================================================================
  console.log('\n' + '='.repeat(90));
  console.log('SIGNAL 6: FORM, SCORING & CONCEDING PATTERNS');
  console.log('='.repeat(90));

  console.log(`\n  Signal                         | BTTS-BH Games  | Non-BH Games   | Delta`);
  console.log('  ' + '-'.repeat(75));
  console.log(`  Home form (win pts %)         | ${avg(bhPreds, 'homeForm').toFixed(1).padStart(13)}% | ${avg(nonBHPreds, 'homeForm').toFixed(1).padStart(13)}% | ${(avg(bhPreds, 'homeForm') - avg(nonBHPreds, 'homeForm')).toFixed(1).padStart(5)}pp`);
  console.log(`  Away form (win pts %)         | ${avg(bhPreds, 'awayForm').toFixed(1).padStart(13)}% | ${avg(nonBHPreds, 'awayForm').toFixed(1).padStart(13)}% | ${(avg(bhPreds, 'awayForm') - avg(nonBHPreds, 'awayForm')).toFixed(1).padStart(5)}pp`);
  console.log(`  Home avg scored (home games)  | ${avg(bhPreds, 'homeAvgScored').toFixed(2).padStart(13)}  | ${avg(nonBHPreds, 'homeAvgScored').toFixed(2).padStart(13)}  | ${(avg(bhPreds, 'homeAvgScored') - avg(nonBHPreds, 'homeAvgScored')).toFixed(2).padStart(5)}`);
  console.log(`  Home avg conceded (home games)| ${avg(bhPreds, 'homeAvgConceded').toFixed(2).padStart(13)}  | ${avg(nonBHPreds, 'homeAvgConceded').toFixed(2).padStart(13)}  | ${(avg(bhPreds, 'homeAvgConceded') - avg(nonBHPreds, 'homeAvgConceded')).toFixed(2).padStart(5)}`);
  console.log(`  Away avg scored (away games)  | ${avg(bhPreds, 'awayAvgScored').toFixed(2).padStart(13)}  | ${avg(nonBHPreds, 'awayAvgScored').toFixed(2).padStart(13)}  | ${(avg(bhPreds, 'awayAvgScored') - avg(nonBHPreds, 'awayAvgScored')).toFixed(2).padStart(5)}`);
  console.log(`  Away avg conceded (away games)| ${avg(bhPreds, 'awayAvgConceded').toFixed(2).padStart(13)}  | ${avg(nonBHPreds, 'awayAvgConceded').toFixed(2).padStart(13)}  | ${(avg(bhPreds, 'awayAvgConceded') - avg(nonBHPreds, 'awayAvgConceded')).toFixed(2).padStart(5)}`);

  // Home concedes >= 1.2 AND away scores >= 1.0
  const bhScoringConceding = bhPreds.filter(p => p.pred.homeAvgConceded >= 1.2 && p.pred.awayAvgScored >= 1.0).length;
  const nonScoringConceding = nonBHPreds.filter(p => p.pred.homeAvgConceded >= 1.2 && p.pred.awayAvgScored >= 1.0).length;
  console.log(`\n  Home concedes >= 1.2 AND away scores >= 1.0: BH ${(bhScoringConceding/bhPreds.length*100).toFixed(1)}% vs non-BH ${(nonScoringConceding/nonBHPreds.length*100).toFixed(1)}%`);

  // ========================================================================
  // SIGNAL 7: xG BALANCE & DISPERSION
  // ========================================================================
  console.log('\n' + '='.repeat(90));
  console.log('SIGNAL 7: xG BALANCE & NEGATIVE BINOMIAL DISPERSION');
  console.log('='.repeat(90));

  const bhImb = bhPreds.map(p => Math.abs(p.pred.homeXg - p.pred.awayXg));
  const nonImb = nonBHPreds.map(p => Math.abs(p.pred.homeXg - p.pred.awayXg));
  const bhAvgImb = bhImb.reduce((s, v) => s + v, 0) / bhImb.length;
  const nonAvgImb = nonImb.reduce((s, v) => s + v, 0) / nonImb.length;

  console.log(`\n  Signal                          | BTTS-BH Games  | Non-BH Games   | Delta`);
  console.log('  ' + '-'.repeat(75));
  console.log(`  |homeXg - awayXg| (avg)        | ${bhAvgImb.toFixed(2).padStart(13)}  | ${nonAvgImb.toFixed(2).padStart(13)}  | ${(bhAvgImb - nonAvgImb).toFixed(2).padStart(5)}`);

  // Imbalance categories
  for (const [label, min, max] of [['< 0.3', 0, 0.3], ['0.3-0.7', 0.3, 0.7], ['0.7-1.0', 0.7, 1.0], ['>= 1.0', 1.0, 99]] as [string, number, number][]) {
    const bhC = bhImb.filter(v => v >= min && v < max).length;
    const nonC = nonImb.filter(v => v >= min && v < max).length;
    console.log(`    ${label.padEnd(10)}: ${bhC} (${(bhC/bhPreds.length*100).toFixed(1)}%) vs ${nonC} (${(nonC/nonBHPreds.length*100).toFixed(1)}%)`);
  }

  // Dispersion
  const bhWithDisp = bhPreds.filter(p => p.pred.dispersion !== null);
  const nonWithDisp = nonBHPreds.filter(p => p.pred.dispersion !== null);
  if (bhWithDisp.length > 0) {
    const bhAvgDisp = bhWithDisp.reduce((s, p) => s + p.pred.dispersion!, 0) / bhWithDisp.length;
    const nonAvgDisp = nonWithDisp.reduce((s, p) => s + p.pred.dispersion!, 0) / nonWithDisp.length;
    console.log(`\n  Avg NB dispersion:               | ${bhAvgDisp.toFixed(2).padStart(13)}  | ${nonAvgDisp.toFixed(2).padStart(13)}  | ${(bhAvgDisp - nonAvgDisp).toFixed(2).padStart(5)}`);
  }

  // ========================================================================
  // SIGNAL 8: BEST COMBO — what single filter combo has the highest lift?
  // ========================================================================
  console.log('\n' + '='.repeat(90));
  console.log('SIGNAL 8: TOP COMBOS BY LIFT (MOST DISCRIMINATING)');
  console.log('='.repeat(90));

  const advancedFilters = [
    { name: 'O2.5>=55 + BTTS>=50 + Draw>=25%', fn: (p: FullPrediction) => p.over25 >= 55 && p.btts >= 50 && p.draw >= 25 },
    { name: 'O2.5>=55 + BTTS>=50 + Hconcedes>=1.0', fn: (p: FullPrediction) => p.over25 >= 55 && p.btts >= 50 && p.homeAvgConceded >= 1.0 },
    { name: 'O2.5>=55 + BTTS>=50 + Aconcedes>=1.0', fn: (p: FullPrediction) => p.over25 >= 55 && p.btts >= 50 && p.awayAvgConceded >= 1.0 },
    { name: 'O2.5>=55 + BTTS>=50 + Both concede >=1.0', fn: (p: FullPrediction) => p.over25 >= 55 && p.btts >= 50 && p.homeAvgConceded >= 1.0 && p.awayAvgConceded >= 1.0 },
    { name: 'Draw>=25% + O2.5>=55% + Home concedes>=1.2', fn: (p: FullPrediction) => p.draw >= 25 && p.over25 >= 55 && p.homeAvgConceded >= 1.2 },
    { name: 'Draw>=25% + O2.5>=55% + xG imbalance <0.7', fn: (p: FullPrediction) => p.draw >= 25 && p.over25 >= 55 && Math.abs(p.homeXg - p.awayXg) < 0.7 },
    { name: 'BTTS>=50% + Draw>=25% + Both BTTS rate>=50%', fn: (p: FullPrediction) => p.btts >= 50 && p.draw >= 25 && p.homeBttsRate >= 50 && p.awayBttsRate >= 50 },
    { name: 'O2.5>=60% + Draw>=25% + xG imbalance <0.7', fn: (p: FullPrediction) => p.over25 >= 60 && p.draw >= 25 && Math.abs(p.homeXg - p.awayXg) < 0.7 },
    { name: 'O2.5>=55% + xG>=3.0 + Draw>=25%', fn: (p: FullPrediction) => p.over25 >= 55 && p.totalXg >= 3.0 && p.draw >= 25 },
    { name: 'Both BTTS>=50% + O2.5>=55% + Home concedes>=1.2', fn: (p: FullPrediction) => p.homeBttsRate >= 50 && p.awayBttsRate >= 50 && p.over25 >= 55 && p.homeAvgConceded >= 1.2 },
    { name: 'O2.5>=55% + BTTS>=50% + Likely score in {1-1,2-1,1-2,2-2}', fn: (p: FullPrediction) => p.over25 >= 55 && p.btts >= 50 && ['1-1','2-1','1-2','2-2'].includes(p.likelyScore) },
    { name: 'O2.5>=55% + BTTS>=50% + O3.5>=35%', fn: (p: FullPrediction) => p.over25 >= 55 && p.btts >= 50 && p.over35 >= 35 },
    { name: 'O2.5>=60% + O3.5>=40% + BTTS>=50%', fn: (p: FullPrediction) => p.over25 >= 60 && p.over35 >= 40 && p.btts >= 50 },
    { name: 'Draw>=25% + Both BTTS rate>=50% + O2.5>=55%', fn: (p: FullPrediction) => p.draw >= 25 && p.homeBttsRate >= 50 && p.awayBttsRate >= 50 && p.over25 >= 55 },
    { name: 'Draw>=25% + Home concedes>=1.2 + Away concedes>=1.0', fn: (p: FullPrediction) => p.draw >= 25 && p.homeAvgConceded >= 1.2 && p.awayAvgConceded >= 1.0 },
  ];

  const allFilters = [...filters, ...advancedFilters];
  const results2 = allFilters.map(f => {
    const bhPass = bhPreds.filter(p => f.fn(p.pred)).length;
    const nonPass = nonBHPreds.filter(p => f.fn(p.pred)).length;
    const bhRate = bhPass / bhPreds.length * 100;
    const nonRate = nonPass / nonBHPreds.length * 100;
    const lift = nonRate > 0 ? bhRate / nonRate : Infinity;
    return { name: f.name, bhPass, nonPass, bhRate, nonRate, lift };
  }).sort((a, b) => b.lift - a.lift);

  console.log(`\n  ${'Filter'.padEnd(55)} | ${'BH Pass'.padStart(7)} | ${'BH Rate'.padStart(8)} | ${'Non Rate'.padStart(9)} | ${'Lift'.padStart(6)}`);
  console.log('  ' + '-'.repeat(95));
  for (const r of results2.slice(0, 15)) {
    console.log(`  ${r.name.padEnd(55)} | ${String(r.bhPass).padStart(7)} | ${r.bhRate.toFixed(1).padStart(6)}% | ${r.nonRate.toFixed(1).padStart(7)}% | ${r.lift.toFixed(2).padStart(5)}x`);
  }

  // ========================================================================
  // SIGNAL 9: REVERSE — for the BEST filter combo, what's the hit rate?
  // ========================================================================
  console.log('\n' + '='.repeat(90));
  console.log('SIGNAL 9: PRACTICAL VALUE — If you used the top combos as BTTS-BH filters...');
  console.log('='.repeat(90));

  // For top 5 combos, show: how many games pass, what % of BH games caught, base rate
  for (const r of results2.slice(0, 8)) {
    const bhCaught = r.bhPass;
    const bhMissed = bhPreds.length - bhCaught;
    const totalPassing = r.bhPass + r.nonPass;
    const hitRate = totalPassing > 0 ? (r.bhPass / totalPassing * 100) : 0;
    const baseRate = 5.3; // overall BTTS-BH rate in EPL
    console.log(`\n  ${r.name}:`);
    console.log(`    Games passing filter: ${totalPassing} out of ~${bhPreds.length + nonBHPreds.length}`);
    console.log(`    BTTS-BH games caught: ${bhCaught}/${bhPreds.length} (${(bhCaught/bhPreds.length*100).toFixed(1)}%)`);
    console.log(`    Hit rate (of passing games): ${hitRate.toFixed(1)}% (base rate: ${baseRate}%)`);
    console.log(`    Enrichment: ${(hitRate / baseRate).toFixed(1)}x over random`);
  }

  console.log('\n' + '='.repeat(90));
  console.log('ANALYSIS COMPLETE');
  console.log('='.repeat(90));
}

main().catch(console.error);
