/**
 * EPL BTTS Both Halves Pattern Analysis
 * 
 * Finds all EPL games where both teams scored in both halves,
 * runs the prediction model on them, and analyzes what patterns emerge.
 * 
 * BTTS Both Halves = HT: home scored AND away scored, AND SH: home scored AND away scored
 */

// ============================================================================
// Minimal re-implementation of needed model functions (standalone, no imports)
// ============================================================================

interface MatchResult {
  date: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  ftHomeGoals: number;
  ftAwayGoals: number;
  ftResult: 'H' | 'D' | 'A';
  htHomeGoals: number;
  htAwayGoals: number;
  htResult: 'H' | 'D' | 'A';
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  oddsAvgHome: number | null;
  oddsAvgDraw: number | null;
  oddsAvgAway: number | null;
  oddsB365Home: number | null;
  oddsB365Draw: number | null;
  oddsB365Away: number | null;
  oddsOver25: number | null;
  oddsUnder25: number | null;
  oddsAvgOver25: number | null;
  season: string;
}

// ---- Poisson / Negative Binomial ----
function lnFactorial(n: number): number {
  if (n <= 1) return 0;
  let s = 0;
  for (let i = 2; i <= n; i++) s += Math.log(i);
  return s;
}

function poissonPMF(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return Math.exp(k * Math.log(lambda) - lambda - lnFactorial(k));
}

function negativeBinomialPMF(r: number, p: number, k: number): number {
  if (r <= 0 || p <= 0 || p >= 1) return poissonPMF(r * (1 - p) / p, k);
  const coeff = lnFactorial(k + r - 1) - lnFactorial(k) - lnFactorial(r - 1);
  return Math.exp(coeff + r * Math.log(p) + k * Math.log(1 - p));
}

function estimateDispersion(goals: number[]): number {
  const n = goals.length;
  if (n < 10) return Infinity;
  const mean = goals.reduce((s, g) => s + g, 0) / n;
  if (mean === 0) return Infinity;
  const variance = goals.reduce((s, g) => s + (g - mean) ** 2, 0) / (n - 1);
  if (variance <= mean) return Infinity;
  const r = (mean ** 2) / (variance - mean);
  const p = mean / variance;
  if (r <= 0 || p <= 0 || p >= 1) return Infinity;
  return r;
}

function goalProb(lambda: number, k: number, dispersion?: number): number {
  if (dispersion && isFinite(dispersion) && dispersion <= 100) {
    const mean = lambda;
    if (mean <= 0) return k === 0 ? 1 : 0;
    const p = mean / (mean + dispersion);
    return negativeBinomialPMF(dispersion, p, k);
  }
  return poissonPMF(lambda, k);
}

// ---- Home Advantage ----
function calculateBidirectionalHomeAdvantage(
  homeScored: number, homeConceded: number,
  awayScored: number, awayConceded: number,
  leagueHomeAvg: number, leagueAwayAvg: number
) {
  const homeScoringAdv = leagueHomeAvg > 0 ? homeScored / leagueHomeAvg : 1;
  const homeDefensiveAdv = leagueHomeAvg > 0 ? homeConceded / leagueHomeAvg : 1;
  const awayScoringAdv = leagueAwayAvg > 0 ? awayScored / leagueAwayAvg : 1;
  const awayDefensiveAdv = leagueAwayAvg > 0 ? awayConceded / leagueAwayAvg : 1;
  const avgScoringAdv = (homeScoringAdv + awayScoringAdv) / 2;
  const avgDefensiveAdv = (homeDefensiveAdv + awayDefensiveAdv) / 2;
  return {
    scoringAdvantage: Math.max(0.8, Math.min(1.3, avgScoringAdv)),
    defensiveAdvantage: Math.max(0.8, Math.min(1.3, avgDefensiveAdv)),
  };
}

// ---- Season Weighting ----
const DECAY_FACTOR = 0.65;
function calculateSeasonWeights(seasons: string[]): Map<string, number> {
  const weights = new Map<string, number>();
  if (seasons.length === 0) return weights;
  const sorted = [...seasons].sort();
  let weight = 1.0;
  let totalWeight = 0;
  for (const season of sorted) {
    weights.set(season, weight);
    totalWeight += weight;
    weight *= DECAY_FACTOR;
  }
  for (const [season, w] of weights) weights.set(season, w / totalWeight);
  return weights;
}

// ---- Team Stats ----
function calculateBacktestTeamStats(
  results: MatchResult[], team: string, seasonWeights?: Map<string, number>
) {
  let weightedResults = results;
  if (seasonWeights && seasonWeights.size > 0) {
    weightedResults = [];
    for (const match of results) {
      const weight = seasonWeights.get(match.season) ?? 1;
      const copies = Math.max(1, Math.round(weight * 10));
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
    homeGames: homeGames.length,
    awayGames: awayGames.length,
    totalGames,
    avgHomeScored: homeGames.length > 0 ? homeScored / homeGames.length : 0,
    avgHomeConceded: homeGames.length > 0 ? homeConceded / homeGames.length : 0,
    avgAwayScored: awayGames.length > 0 ? awayScored / awayGames.length : 0,
    avgAwayConceded: awayGames.length > 0 ? awayConceded / awayGames.length : 0,
    form: totalGames > 0 ? (homeWins + awayWins + 0.5 * draws) / totalGames : 0.5,
  };
}

// ---- League Averages ----
interface LeagueAverages {
  avgHomeGoals: number; avgAwayGoals: number; avgTotalGoals: number;
  homeWinRate: number; drawRate: number; awayWinRate: number;
}

function calculateLeagueAverages(results: MatchResult[]): LeagueAverages {
  if (results.length === 0) return { avgHomeGoals: 1.5, avgAwayGoals: 1.2, avgTotalGoals: 2.7, homeWinRate: 0.45, drawRate: 0.25, awayWinRate: 0.30 };
  const totalHomeGoals = results.reduce((sum, m) => sum + m.ftHomeGoals, 0);
  const totalAwayGoals = results.reduce((sum, m) => sum + m.ftAwayGoals, 0);
  return {
    avgHomeGoals: totalHomeGoals / results.length,
    avgAwayGoals: totalAwayGoals / results.length,
    avgTotalGoals: (totalHomeGoals + totalAwayGoals) / results.length,
    homeWinRate: results.filter(m => m.ftResult === 'H').length / results.length,
    drawRate: results.filter(m => m.ftResult === 'D').length / results.length,
    awayWinRate: results.filter(m => m.ftResult === 'A').length / results.length,
  };
}

// ---- Generate Predictions ----
function generatePrediction(
  trainingData: MatchResult[], homeTeam: string, awayTeam: string,
  leagueAvgs: LeagueAverages, seasonWeights?: Map<string, number>
) {
  const homeStats = calculateBacktestTeamStats(trainingData, homeTeam, seasonWeights);
  const awayStats = calculateBacktestTeamStats(trainingData, awayTeam, seasonWeights);

  const ha = calculateBidirectionalHomeAdvantage(
    homeStats.homeGames > 0 ? homeStats.avgHomeScored : leagueAvgs.avgHomeGoals,
    homeStats.homeGames > 0 ? homeStats.avgHomeConceded : leagueAvgs.avgAwayGoals,
    homeStats.awayGames > 0 ? homeStats.avgAwayScored : leagueAvgs.avgAwayGoals,
    homeStats.awayGames > 0 ? homeStats.avgAwayConceded : leagueAvgs.avgHomeGoals,
    leagueAvgs.avgHomeGoals, leagueAvgs.avgAwayGoals
  );

  const homeAttackRatio = leagueAvgs.avgTotalGoals > 0
    ? (homeStats.homeGames > 0 ? homeStats.avgHomeScored : leagueAvgs.avgHomeGoals) / (leagueAvgs.avgTotalGoals / 2) : 1;
  const awayDefenseRatio = leagueAvgs.avgTotalGoals > 0
    ? (awayStats.awayGames > 0 ? awayStats.avgAwayConceded : leagueAvgs.avgHomeGoals) / (leagueAvgs.avgTotalGoals / 2) : 1;
  const awayAttackRatio = leagueAvgs.avgTotalGoals > 0
    ? (awayStats.awayGames > 0 ? awayStats.avgAwayScored : leagueAvgs.avgAwayGoals) / (leagueAvgs.avgTotalGoals / 2) : 1;
  const homeDefenseRatio = leagueAvgs.avgTotalGoals > 0
    ? (homeStats.homeGames > 0 ? homeStats.avgHomeConceded : leagueAvgs.avgAwayGoals) / (leagueAvgs.avgTotalGoals / 2) : 1;

  const homeXg = homeAttackRatio * awayDefenseRatio * leagueAvgs.avgHomeGoals * ha.scoringAdvantage;
  const awayXg = awayAttackRatio * homeDefenseRatio * leagueAvgs.avgAwayGoals * ha.defensiveAdvantage;
  const totalXg = homeXg + awayXg;

  const allGoals = trainingData.map(m => m.ftHomeGoals + m.ftAwayGoals);
  const dispersion = estimateDispersion(allGoals);
  const useNB = isFinite(dispersion) && dispersion <= 100;

  // 1X2 probs
  let homeWinProb = 0, awayWinProb = 0, drawProbCalc = 0;
  for (let i = 0; i <= 7; i++) {
    for (let j = 0; j <= 7; j++) {
      const p = goalProb(homeXg, i, dispersion) * goalProb(awayXg, j, dispersion);
      if (i > j) homeWinProb += p;
      else if (j > i) awayWinProb += p;
      else drawProbCalc += p;
    }
  }

  let drawProb = 1 - homeWinProb - awayWinProb;
  const formAdjustment = (homeStats.form - awayStats.form) * 0.1;
  const adjustedHomeWin = Math.max(0.1, Math.min(0.8, homeWinProb + formAdjustment));
  const adjustedAwayWin = Math.max(0.1, Math.min(0.8, awayWinProb - formAdjustment));
  drawProb = Math.max(0.15, Math.min(0.4, 1 - adjustedHomeWin - adjustedAwayWin));
  const total = adjustedHomeWin + drawProb + adjustedAwayWin;
  const finalHomeWin = adjustedHomeWin / total;
  const finalDraw = drawProb / total;
  const finalAwayWin = adjustedAwayWin / total;

  // Goals markets
  const p0 = goalProb(totalXg, 0, dispersion);
  const p1 = goalProb(totalXg, 1, dispersion);
  const p2 = goalProb(totalXg, 2, dispersion);
  const over15Prob = 1 - p0 - p1;
  const over25Prob = 1 - p0 - p1 - p2;

  // BTTS
  let bttsProbCalc = 0;
  for (let i = 1; i <= 7; i++) {
    for (let j = 1; j <= 7; j++) {
      bttsProbCalc += goalProb(homeXg, i, dispersion) * goalProb(awayXg, j, dispersion);
    }
  }
  let bttsProb = bttsProbCalc;
  const balancedLambda = totalXg / 2;
  const bttsBalanced = (1 - Math.exp(-balancedLambda)) * (1 - Math.exp(-balancedLambda));
  const lambdaImbalance = Math.abs(homeXg - awayXg) / (homeXg + awayXg + 0.001);
  const correctionFraction = 0.55 * lambdaImbalance;
  bttsProb = bttsProb + (bttsBalanced - bttsProb) * correctionFraction;

  // Most likely scoreline
  let bestScore = '0-0', bestProb = 0;
  for (let i = 0; i <= 5; i++) {
    for (let j = 0; j <= 5; j++) {
      const p = goalProb(homeXg, i, dispersion) * goalProb(awayXg, j, dispersion);
      if (p > bestProb) { bestProb = p; bestScore = `${i}-${j}`; }
    }
  }

  return {
    homeWin: Math.round(finalHomeWin * 100),
    draw: Math.round(finalDraw * 100),
    awayWin: Math.round(finalAwayWin * 100),
    over15: Math.round(Math.min(95, Math.max(40, over15Prob * 100))),
    over25: Math.round(Math.min(85, Math.max(35, over25Prob * 100))),
    btts: Math.round(bttsProb * 100),
    totalXg: Math.round(totalXg * 100) / 100,
    homeXg: Math.round(homeXg * 100) / 100,
    awayXg: Math.round(awayXg * 100) / 100,
    likelyScore: bestScore,
    likelyScoreProb: Math.round(bestProb * 1000) / 10,
    dispersion: useNB ? Math.round(dispersion * 100) / 100 : null,
  };
}

// ============================================================================
// CSV Parser
// ============================================================================
function parseNumber(val: string | undefined): number | null {
  if (!val || val.trim() === '') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function parseCSV(csvText: string, season: string): MatchResult[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const headerLine = lines[0].replace(/^\uFEFF/, '');
  const header = headerLine.split(',');
  const colIndex: Record<string, number> = {};
  header.forEach((col, idx) => { colIndex[col.trim()] = idx; });

  const results: MatchResult[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const values: string[] = [];
    let currentValue = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { values.push(currentValue.trim()); currentValue = ''; }
      else currentValue += char;
    }
    values.push(currentValue.trim());

    const homeTeam = values[colIndex['HomeTeam']] || '';
    const awayTeam = values[colIndex['AwayTeam']] || '';
    if (!homeTeam || !awayTeam) continue;

    results.push({
      date: values[colIndex['Date']] || '',
      time: values[colIndex['Time']] || '',
      homeTeam, awayTeam,
      ftHomeGoals: parseInt(values[colIndex['FTHG']] || '0', 10) || 0,
      ftAwayGoals: parseInt(values[colIndex['FTAG']] || '0', 10) || 0,
      ftResult: (values[colIndex['FTR']] || 'D') as 'H' | 'D' | 'A',
      htHomeGoals: parseInt(values[colIndex['HTHG']] || '0', 10) || 0,
      htAwayGoals: parseInt(values[colIndex['HTAG']] || '0', 10) || 0,
      htResult: (values[colIndex['HTR']] || 'D') as 'H' | 'D' | 'A',
      homeShots: parseInt(values[colIndex['HS']] || '0', 10) || 0,
      awayShots: parseInt(values[colIndex['AS']] || '0', 10) || 0,
      homeShotsOnTarget: parseInt(values[colIndex['HST']] || '0', 10) || 0,
      awayShotsOnTarget: parseInt(values[colIndex['AST']] || '0', 10) || 0,
      oddsAvgHome: parseNumber(values[colIndex['AvgH']]),
      oddsAvgDraw: parseNumber(values[colIndex['AvgD']]),
      oddsAvgAway: parseNumber(values[colIndex['AvgA']]),
      oddsB365Home: parseNumber(values[colIndex['B365H']]),
      oddsB365Draw: parseNumber(values[colIndex['B365D']]),
      oddsB365Away: parseNumber(values[colIndex['B365A']]),
      oddsOver25: parseNumber(values[colIndex['B365>2.5']]),
      oddsUnder25: parseNumber(values[colIndex['B365<2.5']]),
      oddsAvgOver25: parseNumber(values[colIndex['Avg>2.5']]),
      season,
    });
  }
  return results;
}

// ============================================================================
// Fetch with retry
// ============================================================================
const fetchedUrls = new Set<string>();
async function fetchSeason(league: string, season: string): Promise<MatchResult[]> {
  const url = `https://www.football-data.co.uk/mmz4281/${season}/${league}.csv`;
  console.log(`Fetching ${league} ${season}...`);
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Accept: 'text/csv' },
  });
  if (!response.ok) { console.warn(`Failed: ${url} (${response.status})`); return []; }
  const text = await response.text();
  return parseCSV(text, season);
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  const LEAGUE = 'E0';
  const ALL_SEASONS = ['2627', '2526', '2425', '2324', '2223', '2122', '2021', '1920', '1819', '1718', '1617', '1516'];

  // Fetch all EPL data
  console.log('\n=== Fetching EPL data for all seasons ===\n');
  const allData: MatchResult[] = [];
  for (const s of ALL_SEASONS) {
    const data = await fetchSeason(LEAGUE, s);
    allData.push(...data);
    await new Promise(r => setTimeout(r, 600)); // rate limit
  }
  console.log(`\nTotal EPL matches fetched: ${allData.length}`);

  // Find all BTTS Both Halves games
  const bttsBH: (MatchResult & {
    shHomeGoals: number; shAwayGoals: number;
    htTotal: number; shTotal: number; ftTotal: number;
  })[] = [];

  for (const m of allData) {
    const shHome = m.ftHomeGoals - m.htHomeGoals;
    const shAway = m.ftAwayGoals - m.htAwayGoals;
    const bttsHT = m.htHomeGoals > 0 && m.htAwayGoals > 0;
    const bttsSH = shHome > 0 && shAway > 0;
    if (bttsHT && bttsSH) {
      bttsBH.push({
        ...m,
        shHomeGoals: shHome,
        shAwayGoals: shAway,
        htTotal: m.htHomeGoals + m.htAwayGoals,
        shTotal: shHome + shAway,
        ftTotal: m.ftHomeGoals + m.ftAwayGoals,
      });
    }
  }

  console.log(`\nBTTS Both Halves games found: ${bttsBH.length} out of ${allData.length} total (${(bttsBH.length / allData.length * 100).toFixed(1)}%)`);

  // ------------------------------------------------------------------------
  // SECTION 1: Basic Scoreline Distribution of BTTS-BH games
  // ------------------------------------------------------------------------
  console.log('\n' + '='.repeat(80));
  console.log('SECTION 1: SCORELINE PATTERNS IN BTTS BOTH HALVES GAMES');
  console.log('='.repeat(80));

  // HT scoreline distribution
  const htScoreCounts = new Map<string, number>();
  const shScoreCounts = new Map<string, number>();
  const ftScoreCounts = new Map<string, number>();
  const htTotalDist = new Map<number, number>();
  const shTotalDist = new Map<number, number>();
  const ftTotalDist = new Map<number, number>();

  for (const m of bttsBH) {
    // HT scorelines (both teams scored, so min 1-1)
    const htScore = `${m.htHomeGoals}-${m.htAwayGoals}`;
    htScoreCounts.set(htScore, (htScoreCounts.get(htScore) || 0) + 1);
    htTotalDist.set(m.htTotal, (htTotalDist.get(m.htTotal) || 0) + 1);

    // SH scorelines
    const shScore = `${m.shHomeGoals}-${m.shAwayGoals}`;
    shScoreCounts.set(shScore, (shScoreCounts.get(shScore) || 0) + 1);
    shTotalDist.set(m.shTotal, (shTotalDist.get(m.shTotal) || 0) + 1);

    // FT scorelines
    const ftScore = `${m.ftHomeGoals}-${m.ftAwayGoals}`;
    ftScoreCounts.set(ftScore, (ftScoreCounts.get(ftScore) || 0) + 1);
    ftTotalDist.set(m.ftTotal, (ftTotalDist.get(m.ftTotal) || 0) + 1);
  }

  const sortByCountDesc = (a: [string, number], b: [string, number]) => b[1] - a[1];

  console.log('\n--- Half-Time Scorelines (Top 15) ---');
  console.log('HT Score | Count | Pct');
  console.log('-'.repeat(35));
  for (const [score, count] of [...htScoreCounts.entries()].sort(sortByCountDesc).slice(0, 15)) {
    console.log(`  ${score.padStart(5)} | ${String(count).padStart(4)} | ${(count / bttsBH.length * 100).toFixed(1)}%`);
  }

  console.log('\n--- Second-Half Scorelines (Top 15) ---');
  console.log('SH Score | Count | Pct');
  console.log('-'.repeat(35));
  for (const [score, count] of [...shScoreCounts.entries()].sort(sortByCountDesc).slice(0, 15)) {
    console.log(`  ${score.padStart(5)} | ${String(count).padStart(4)} | ${(count / bttsBH.length * 100).toFixed(1)}%`);
  }

  console.log('\n--- Full-Time Scorelines (Top 20) ---');
  console.log('FT Score | Count | Pct');
  console.log('-'.repeat(35));
  for (const [score, count] of [...ftScoreCounts.entries()].sort(sortByCountDesc).slice(0, 20)) {
    console.log(`  ${score.padStart(5)} | ${String(count).padStart(4)} | ${(count / bttsBH.length * 100).toFixed(1)}%`);
  }

  console.log('\n--- Goals Per Half Distribution ---');
  console.log('Goals | HT Count | HT Pct | SH Count | SH Pct | FT Count | FT Pct');
  console.log('-'.repeat(70));
  for (let g = 2; g <= 10; g++) {
    const htC = htTotalDist.get(g) || 0;
    const shC = shTotalDist.get(g) || 0;
    const ftC = ftTotalDist.get(g) || 0;
    if (htC + shC + ftC > 0) {
      console.log(`  ${String(g).padStart(2)}    | ${String(htC).padStart(7)} | ${(htC / bttsBH.length * 100).toFixed(1)}%  | ${String(shC).padStart(7)} | ${(shC / bttsBH.length * 100).toFixed(1)}%  | ${String(ftC).padStart(7)} | ${(ftC / bttsBH.length * 100).toFixed(1)}%`);
    }
  }

  // Averages
  const avgHtTotal = bttsBH.reduce((s, m) => s + m.htTotal, 0) / bttsBH.length;
  const avgShTotal = bttsBH.reduce((s, m) => s + m.shTotal, 0) / bttsBH.length;
  const avgFtTotal = bttsBH.reduce((s, m) => s + m.ftTotal, 0) / bttsBH.length;
  console.log(`\n  Average HT goals: ${avgHtTotal.toFixed(2)}`);
  console.log(`  Average SH goals: ${avgShTotal.toFixed(2)}`);
  console.log(`  Average FT goals: ${avgFtTotal.toFixed(2)}`);

  // ------------------------------------------------------------------------
  // SECTION 2: FT Result Distribution
  // ------------------------------------------------------------------------
  console.log('\n' + '='.repeat(80));
  console.log('SECTION 2: RESULT DISTRIBUTION');
  console.log('='.repeat(80));

  const homeWins = bttsBH.filter(m => m.ftResult === 'H').length;
  const draws = bttsBH.filter(m => m.ftResult === 'D').length;
  const awayWins = bttsBH.filter(m => m.ftResult === 'A').length;
  console.log(`\n  Home Win: ${homeWins} (${(homeWins / bttsBH.length * 100).toFixed(1)}%)`);
  console.log(`  Draw:     ${draws} (${(draws / bttsBH.length * 100).toFixed(1)}%)`);
  console.log(`  Away Win: ${awayWins} (${(awayWins / bttsBH.length * 100).toFixed(1)}%)`);

  // Compare to overall EPL
  const allHomeWins = allData.filter(m => m.ftResult === 'H').length;
  const allDraws = allData.filter(m => m.ftResult === 'D').length;
  const allAwayWins = allData.filter(m => m.ftResult === 'A').length;
  console.log(`\n  Overall EPL: Home ${(allHomeWins / allData.length * 100).toFixed(1)}% | Draw ${(allDraws / allData.length * 100).toFixed(1)}% | Away ${(allAwayWins / allData.length * 100).toFixed(1)}%`);

  // HT result distribution
  const htHomeWins = bttsBH.filter(m => m.htResult === 'H').length;
  const htDraws = bttsBH.filter(m => m.htResult === 'D').length;
  const htAwayWins = bttsBH.filter(m => m.htResult === 'A').length;
  console.log(`\n  HT Result: Home ${htHomeWins} (${(htHomeWins / bttsBH.length * 100).toFixed(1)}%) | Draw ${htDraws} (${(htDraws / bttsBH.length * 100).toFixed(1)}%) | Away ${htAwayWins} (${(htAwayWins / bttsBH.length * 100).toFixed(1)}%)`);

  // HT/FT transition matrix
  console.log('\n--- HT -> FT Transition Matrix ---');
  console.log('             FT Home  FT Draw  FT Away');
  for (const ht of ['H', 'D', 'A'] as const) {
    const htLabel = ht === 'H' ? 'HT Home' : ht === 'D' ? 'HT Draw' : 'HT Away';
    const row = bttsBH.filter(m => m.htResult === ht);
    const toH = row.filter(m => m.ftResult === 'H').length;
    const toD = row.filter(m => m.ftResult === 'D').length;
    const toA = row.filter(m => m.ftResult === 'A').length;
    console.log(`  ${htLabel} | ${(toH / row.length * 100).toFixed(1).padStart(6)}% | ${(toD / row.length * 100).toFixed(1).padStart(6)}% | ${(toA / row.length * 100).toFixed(1).padStart(6)}%  (n=${row.length})`);
  }

  // Comebacks
  const comebacks = bttsBH.filter(m =>
    (m.htResult === 'H' && m.ftResult === 'A') || (m.htResult === 'A' && m.ftResult === 'H')
  ).length;
  console.log(`\n  Full comebacks (HT leader loses): ${comebacks} (${(comebacks / bttsBH.length * 100).toFixed(1)}%)`);

  // ------------------------------------------------------------------------
  // SECTION 3: Odds Analysis
  // ------------------------------------------------------------------------
  console.log('\n' + '='.repeat(80));
  console.log('SECTION 3: PRE-MATCH ODDS ANALYSIS');
  console.log('='.repeat(80));

  const withOdds = bttsBH.filter(m => m.oddsAvgHome && m.oddsAvgDraw && m.oddsAvgAway);
  console.log(`\n  Games with avg odds available: ${withOdds.length} / ${bttsBH.length}`);

  if (withOdds.length > 0) {
    const avgHomeOdds = withOdds.reduce((s, m) => s + m.oddsAvgHome!, 0) / withOdds.length;
    const avgDrawOdds = withOdds.reduce((s, m) => s + m.oddsAvgDraw!, 0) / withOdds.length;
    const avgAwayOdds = withOdds.reduce((s, m) => s + m.oddsAvgAway!, 0) / withOdds.length;
    console.log(`\n  Average odds: Home ${avgHomeOdds.toFixed(2)} | Draw ${avgDrawOdds.toFixed(2)} | Away ${avgAwayOdds.toFixed(2)}`);

    // Implied probabilities (from odds, removing overround)
    const avgImpliedHome = withOdds.reduce((s, m) => s + 1 / m.oddsAvgHome!, 0) / withOdds.length;
    const avgImpliedDraw = withOdds.reduce((s, m) => s + 1 / m.oddsAvgDraw!, 0) / withOdds.length;
    const avgImpliedAway = withOdds.reduce((s, m) => s + 1 / m.oddsAvgAway!, 0) / withOdds.length;
    const overround = avgImpliedHome + avgImpliedDraw + avgImpliedAway;
    console.log(`  Raw implied: Home ${(avgImpliedHome * 100).toFixed(1)}% | Draw ${(avgImpliedDraw * 100).toFixed(1)}% | Away ${(avgImpliedAway * 100).toFixed(1)}% (overround: ${(overround * 100).toFixed(1)}%)`);
    const normHome = (avgImpliedHome / overround * 100).toFixed(1);
    const normDraw = (avgImpliedDraw / overround * 100).toFixed(1);
    const normAway = (avgImpliedAway / overround * 100).toFixed(1);
    console.log(`  Normalized:  Home ${normHome}% | Draw ${normDraw}% | Away ${normAway}%`);

    // O2.5 odds
    const withO25Odds = withOdds.filter(m => m.oddsAvgOver25);
    if (withO25Odds.length > 0) {
      const avgO25Odds = withO25Odds.reduce((s, m) => s + m.oddsAvgOver25!, 0) / withO25Odds.length;
      const impliedO25 = 1 / avgO25Odds;
      console.log(`\n  O2.5 avg odds: ${avgO25Odds.toFixed(2)} (implied prob: ${(impliedO25 * 100).toFixed(1)}%)`);
      // How many had O2.5 odds < 2.0 (heavy favorite for over)?
      const strongO25 = withO25Odds.filter(m => m.oddsAvgOver25! < 2.0).length;
      const midO25 = withO25Odds.filter(m => m.oddsAvgOver25! >= 2.0 && m.oddsAvgOver25! < 2.5).length;
      const weakO25 = withO25Odds.filter(m => m.oddsAvgOver25! >= 2.5).length;
      console.log(`  O2.5 odds < 2.0: ${strongO25} (${(strongO25 / withO25Odds.length * 100).toFixed(1)}%)`);
      console.log(`  O2.5 odds 2.0-2.5: ${midO25} (${(midO25 / withO25Odds.length * 100).toFixed(1)}%)`);
      console.log(`  O2.5 odds >= 2.5: ${weakO25} (${(weakO25 / withO25Odds.length * 100).toFixed(1)}%)`);
    }

    // Favorite odds range
    const favOddsRanges = [
      { label: '< 1.50', min: 0, max: 1.5 },
      { label: '1.50-1.80', min: 1.5, max: 1.8 },
      { label: '1.80-2.10', min: 1.8, max: 2.1 },
      { label: '2.10-2.50', min: 2.1, max: 2.5 },
      { label: '2.50-3.00', min: 2.5, max: 3.0 },
      { label: '> 3.00', min: 3.0, max: 99 },
    ];
    console.log('\n  Favorite (lowest odds) distribution:');
    for (const range of favOddsRanges) {
      const count = withOdds.filter(m => {
        const favOdds = Math.min(m.oddsAvgHome!, m.oddsAvgDraw!, m.oddsAvgAway!);
        return favOdds >= range.min && favOdds < range.max;
      }).length;
      if (count > 0) console.log(`    ${range.label.padEnd(12)}: ${count} (${(count / withOdds.length * 100).toFixed(1)}%)`);
    }

    // Underdog won?
    console.log('\n  Underdog outcomes (favorite = lowest odds):');
    let favWon = 0, drawResult = 0, dogWon = 0;
    for (const m of withOdds) {
      const odds = [m.oddsAvgHome!, m.oddsAvgDraw!, m.oddsAvgAway!];
      const results = [m.ftResult === 'H', m.ftResult === 'D', m.ftResult === 'A'];
      const minIdx = odds.indexOf(Math.min(...odds));
      if (results[minIdx]) favWon++;
      else if (m.ftResult === 'D') drawResult++;
      else dogWon++;
    }
    console.log(`    Favorite won: ${favWon} (${(favWon / withOdds.length * 100).toFixed(1)}%)`);
    console.log(`    Draw:         ${drawResult} (${(drawResult / withOdds.length * 100).toFixed(1)}%)`);
    console.log(`    Underdog won: ${dogWon} (${(dogWon / withOdds.length * 100).toFixed(1)}%)`);
  }

  // ------------------------------------------------------------------------
  // SECTION 4: Season-by-Season Trend
  // ------------------------------------------------------------------------
  console.log('\n' + '='.repeat(80));
  console.log('SECTION 4: SEASON-BY-SEASON TREND');
  console.log('='.repeat(80));

  console.log('\n  Season  | BTTS-BH Games | Total Games | Rate  | Avg FT Goals');
  console.log('  ' + '-'.repeat(60));
  for (const season of ALL_SEASONS) {
    const seasonGames = allData.filter(m => m.season === season);
    const seasonBH = bttsBH.filter(m => m.season === season);
    if (seasonGames.length > 0) {
      const avgGoals = seasonBH.length > 0 ? seasonBH.reduce((s, m) => s + m.ftTotal, 0) / seasonBH.length : 0;
      console.log(`  ${season.padEnd(7)} | ${String(seasonBH.length).padStart(13)} | ${String(seasonGames.length).padStart(11)} | ${(seasonBH.length / seasonGames.length * 100).toFixed(1)}% | ${avgGoals.toFixed(1)}`);
    }
  }

  // ------------------------------------------------------------------------
  // SECTION 5: Match Statistics (Shots, Corners, etc.)
  // ------------------------------------------------------------------------
  console.log('\n' + '='.repeat(80));
  console.log('SECTION 5: MATCH STATISTICS (SHOTS, CORNERS, FOULS, CARDS)');
  console.log('='.repeat(80));

  const avgHomeShots = bttsBH.reduce((s, m) => s + m.homeShots, 0) / bttsBH.length;
  const avgAwayShots = bttsBH.reduce((s, m) => s + m.awayShots, 0) / bttsBH.length;
  const avgHomeSOT = bttsBH.reduce((s, m) => s + m.homeShotsOnTarget, 0) / bttsBH.length;
  const avgAwaySOT = bttsBH.reduce((s, m) => s + m.awayShotsOnTarget, 0) / bttsBH.length;
  const avgHomeCorners = bttsBH.reduce((s, m) => s + m.homeCorners, 0) / bttsBH.length;
  const avgAwayCorners = bttsBH.reduce((s, m) => s + m.awayCorners, 0) / bttsBH.length;
  const avgHomeFouls = bttsBH.reduce((s, m) => s + m.homeFouls, 0) / bttsBH.length;
  const avgAwayFouls = bttsBH.reduce((s, m) => s + m.awayFouls, 0) / bttsBH.length;
  const avgHomeYellows = bttsBH.reduce((s, m) => s + m.homeYellowCards, 0) / bttsBH.length;
  const avgAwayYellows = bttsBH.reduce((s, m) => s + m.awayYellowCards, 0) / bttsBH.length;
  const avgHomeReds = bttsBH.reduce((s, m) => s + m.homeRedCards, 0) / bttsBH.length;
  const avgAwayReds = bttsBH.reduce((s, m) => s + m.awayRedCards, 0) / bttsBH.length;

  // Compare to overall averages
  const allHomeShots = allData.reduce((s, m) => s + m.homeShots, 0) / allData.length;
  const allAwayShots = allData.reduce((s, m) => s + m.awayShots, 0) / allData.length;
  const allHomeSOT = allData.reduce((s, m) => s + m.homeShotsOnTarget, 0) / allData.length;
  const allAwaySOT = allData.reduce((s, m) => s + m.awayShotsOnTarget, 0) / allData.length;
  const allHomeCorners = allData.reduce((s, m) => s + m.homeCorners, 0) / allData.length;
  const allAwayCorners = allData.reduce((s, m) => s + m.awayCorners, 0) / allData.length;

  console.log(`\n  Stat          | BTTS-BH (Home) | BTTS-BH (Away) | Overall (Home) | Overall (Away) | Delta (Home) | Delta (Away)`);
  console.log('  ' + '-'.repeat(110));
  const statRows = [
    { label: 'Shots', bh_h: avgHomeShots, bh_a: avgAwayShots, all_h: allHomeShots, all_a: allAwayShots },
    { label: 'Shots OT', bh_h: avgHomeSOT, bh_a: avgAwaySOT, all_h: allHomeSOT, all_a: allAwaySOT },
    { label: 'Corners', bh_h: isNaN(avgHomeCorners) ? 0 : avgHomeCorners, bh_a: isNaN(avgAwayCorners) ? 0 : avgAwayCorners, all_h: isNaN(allHomeCorners) ? 0 : allHomeCorners, all_a: isNaN(allAwayCorners) ? 0 : allAwayCorners },
    { label: 'Fouls', bh_h: isNaN(avgHomeFouls) ? 0 : avgHomeFouls, bh_a: isNaN(avgAwayFouls) ? 0 : avgAwayFouls, all_h: 0, all_a: 0 },
    { label: 'Yellow Cards', bh_h: isNaN(avgHomeYellows) ? 0 : avgHomeYellows, bh_a: isNaN(avgAwayYellows) ? 0 : avgAwayYellows, all_h: 0, all_a: 0 },
    { label: 'Red Cards', bh_h: isNaN(avgHomeReds) ? 0 : avgHomeReds, bh_a: isNaN(avgAwayReds) ? 0 : avgAwayReds, all_h: 0, all_a: 0 },
  ];
  for (const row of statRows) {
    const dH = row.all_h > 0 ? (row.bh_h - row.all_h).toFixed(1) : '-';
    const dA = row.all_a > 0 ? (row.bh_a - row.all_a).toFixed(1) : '-';
    console.log(`  ${row.label.padEnd(13)} | ${row.bh_h.toFixed(1).padStart(14)} | ${row.bh_a.toFixed(1).padStart(14)} | ${row.all_h > 0 ? row.all_h.toFixed(1).padStart(14) : '             -'} | ${row.all_a > 0 ? row.all_a.toFixed(1).padStart(14) : '             -'} | ${String(dH).padStart(12)} | ${String(dA).padStart(12)}`);
  }

  // ------------------------------------------------------------------------
  // SECTION 6: MODEL PREDICTIONS ON BTTS-BH GAMES
  // ------------------------------------------------------------------------
  console.log('\n' + '='.repeat(80));
  console.log('SECTION 6: MODEL PREDICTION ANALYSIS ON BTTS-BH GAMES');
  console.log('='.repeat(80));

  // For each BTTS-BH game, generate prediction using training data from prior seasons
  // ALL_SEASONS is newest-first, so we need to reverse for chronological indexing
  // Oldest-first order: ['1516', '1617', '1718', '1819', '1920', '2021', '2122', '2223', '2324', '2425', '2526']
  const CHRONO_SEASONS = [...ALL_SEASONS].reverse();

  const predictions: {
    match: typeof bttsBH[0];
    pred: ReturnType<typeof generatePrediction>;
  }[] = [];

  // Test seasons: 1920 through 2425 (need at least 5 prior training seasons)
  const TEST_SEASONS = ['1920', '2021', '2122', '2223', '2324', '2425'];

  for (const testSeason of TEST_SEASONS) {
    const chronoIdx = CHRONO_SEASONS.indexOf(testSeason);
    if (chronoIdx < 5) continue; // Need 5 prior training seasons

    // Training = 5 seasons before test season (chronological)
    const trainingSeasons = CHRONO_SEASONS.slice(chronoIdx - 5, chronoIdx);
    const trainingData = allData.filter(m => trainingSeasons.includes(m.season));
    const seasonWeights = calculateSeasonWeights(trainingSeasons);
    const leagueAvgs = calculateLeagueAverages(trainingData);

    const seasonBH = bttsBH.filter(m => m.season === testSeason);
    console.log(`\n  Processing ${testSeason}: ${seasonBH.length} BTTS-BH games, training on ${trainingSeasons.join(', ')} (${trainingData.length} matches)`);

    for (const m of seasonBH) {
      const pred = generatePrediction(trainingData, m.homeTeam, m.awayTeam, leagueAvgs, seasonWeights);
      predictions.push({ match: m, pred });
    }
  }

  console.log(`\n  Total predictions generated: ${predictions.length}`);

  if (predictions.length > 0) {
    // Average predicted probabilities
    const avgPredHomeWin = predictions.reduce((s, p) => s + p.pred.homeWin, 0) / predictions.length;
    const avgPredDraw = predictions.reduce((s, p) => s + p.pred.draw, 0) / predictions.length;
    const avgPredAwayWin = predictions.reduce((s, p) => s + p.pred.awayWin, 0) / predictions.length;
    const avgPredO25 = predictions.reduce((s, p) => s + p.pred.over25, 0) / predictions.length;
    const avgPredBTTS = predictions.reduce((s, p) => s + p.pred.btts, 0) / predictions.length;
    const avgPredXg = predictions.reduce((s, p) => s + p.pred.totalXg, 0) / predictions.length;
    const avgHomeXg = predictions.reduce((s, p) => s + p.pred.homeXg, 0) / predictions.length;
    const avgAwayXg = predictions.reduce((s, p) => s + p.pred.awayXg, 0) / predictions.length;

    console.log('\n--- Average Model Predictions for BTTS-BH Games ---');
    console.log(`  Avg Predicted Home Win: ${avgPredHomeWin.toFixed(1)}%`);
    console.log(`  Avg Predicted Draw:     ${avgPredDraw.toFixed(1)}%`);
    console.log(`  Avg Predicted Away Win: ${avgPredAwayWin.toFixed(1)}%`);
    console.log(`  Avg Predicted O2.5:     ${avgPredO25.toFixed(1)}%`);
    console.log(`  Avg Predicted BTTS:     ${avgPredBTTS.toFixed(1)}%`);
    console.log(`  Avg Predicted Total xG:  ${avgPredXg.toFixed(2)}`);
    console.log(`  Avg Predicted Home xG:   ${avgHomeXg.toFixed(2)}`);
    console.log(`  Avg Predicted Away xG:   ${avgAwayXg.toFixed(2)}`);

    // Compare to average predictions for ALL games
    // Quick sample: run predictions for a sample of non-BTTS-BH games
    console.log('\n--- Comparing to Non-BTTS-BH Games (sample) ---');
    const nonBHSample: typeof predictions = [];
    for (const testSeason of TEST_SEASONS) {
      const chronoIdx = CHRONO_SEASONS.indexOf(testSeason);
      if (chronoIdx < 5) continue;
      const trainingSeasons = CHRONO_SEASONS.slice(chronoIdx - 5, chronoIdx);
      const trainingData = allData.filter(m => trainingSeasons.includes(m.season));
      const seasonWeights = calculateSeasonWeights(trainingSeasons);
      const leagueAvgs = calculateLeagueAverages(trainingData);
      const bhDates = new Set(bttsBH.filter(m => m.season === testSeason).map(m => `${m.date}|${m.homeTeam}|${m.awayTeam}`));
      const nonBH = allData.filter(m => m.season === testSeason && !bhDates.has(`${m.date}|${m.homeTeam}|${m.awayTeam}`));
      // Sample every 3rd non-BH game to keep it manageable
      for (let i = 0; i < nonBH.length; i += 3) {
        const pred = generatePrediction(trainingData, nonBH[i].homeTeam, nonBH[i].awayTeam, leagueAvgs, seasonWeights);
        nonBHSample.push({ match: nonBH[i] as any, pred });
      }
    }

    if (nonBHSample.length > 0) {
      const nonAvgO25 = nonBHSample.reduce((s, p) => s + p.pred.over25, 0) / nonBHSample.length;
      const nonAvgBTTS = nonBHSample.reduce((s, p) => s + p.pred.btts, 0) / nonBHSample.length;
      const nonAvgXg = nonBHSample.reduce((s, p) => s + p.pred.totalXg, 0) / nonBHSample.length;
      const nonAvgHomeXg = nonBHSample.reduce((s, p) => s + p.pred.homeXg, 0) / nonBHSample.length;
      const nonAvgAwayXg = nonBHSample.reduce((s, p) => s + p.pred.awayXg, 0) / nonBHSample.length;

      console.log(`  Non-BH Avg O2.5:     ${nonAvgO25.toFixed(1)}%  (BH: ${avgPredO25.toFixed(1)}%  delta: +${(avgPredO25 - nonAvgO25).toFixed(1)}pp)`);
      console.log(`  Non-BH Avg BTTS:     ${nonAvgBTTS.toFixed(1)}%  (BH: ${avgPredBTTS.toFixed(1)}%  delta: +${(avgPredBTTS - nonAvgBTTS).toFixed(1)}pp)`);
      console.log(`  Non-BH Avg Total xG:  ${nonAvgXg.toFixed(2)}  (BH: ${avgPredXg.toFixed(2)}  delta: +${(avgPredXg - nonAvgXg).toFixed(2)})`);
      console.log(`  Non-BH Avg Home xG:   ${nonAvgHomeXg.toFixed(2)}  (BH: ${avgHomeXg.toFixed(2)}  delta: +${(avgHomeXg - nonAvgHomeXg).toFixed(2)})`);
      console.log(`  Non-BH Avg Away xG:   ${nonAvgAwayXg.toFixed(2)}  (BH: ${avgAwayXg.toFixed(2)}  delta: +${(avgAwayXg - nonAvgAwayXg).toFixed(2)})`);
    }

    // Distribution of predicted O2.5 and BTTS for BH games
    console.log('\n--- Prediction Distribution for BTTS-BH Games ---');
    const o25Buckets = [0, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85];
    const bttsBuckets = [0, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85];

    console.log('\n  O2.5 Probability Distribution:');
    for (let i = 0; i < o25Buckets.length - 1; i++) {
      const count = predictions.filter(p => p.pred.over25 >= o25Buckets[i] && p.pred.over25 < o25Buckets[i + 1]).length;
      if (count > 0) console.log(`    ${o25Buckets[i]}-${o25Buckets[i + 1]}%: ${count} (${(count / predictions.length * 100).toFixed(1)}%)`);
    }

    console.log('\n  BTTS Probability Distribution:');
    for (let i = 0; i < bttsBuckets.length - 1; i++) {
      const count = predictions.filter(p => p.pred.btts >= bttsBuckets[i] && p.pred.btts < bttsBuckets[i + 1]).length;
      if (count > 0) console.log(`    ${bttsBuckets[i]}-${bttsBuckets[i + 1]}%: ${count} (${(count / predictions.length * 100).toFixed(1)}%)`);
    }

    // How many BH games had model predicting O2.5 >= 60%?
    const highO25 = predictions.filter(p => p.pred.over25 >= 60).length;
    const highBTTS = predictions.filter(p => p.pred.btts >= 55).length;
    const veryHighO25 = predictions.filter(p => p.pred.over25 >= 65).length;
    const veryHighBTTS = predictions.filter(p => p.pred.btts >= 60).length;
    console.log(`\n  Model said O2.5 >= 60%: ${highO25} / ${predictions.length} (${(highO25 / predictions.length * 100).toFixed(1)}%)`);
    console.log(`  Model said O2.5 >= 65%: ${veryHighO25} / ${predictions.length} (${(veryHighO25 / predictions.length * 100).toFixed(1)}%)`);
    console.log(`  Model said BTTS >= 55%: ${highBTTS} / ${predictions.length} (${(highBTTS / predictions.length * 100).toFixed(1)}%)`);
    console.log(`  Model said BTTS >= 60%: ${veryHighBTTS} / ${predictions.length} (${(veryHighBTTS / predictions.length * 100).toFixed(1)}%)`);

    // xG distribution
    console.log('\n  Total xG Distribution:');
    const xgBuckets = [0, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 7.0];
    for (let i = 0; i < xgBuckets.length - 1; i++) {
      const count = predictions.filter(p => p.pred.totalXg >= xgBuckets[i] && p.pred.totalXg < xgBuckets[i + 1]).length;
      if (count > 0) console.log(`    ${xgBuckets[i]}-${xgBuckets[i + 1]}: ${count} (${(count / predictions.length * 100).toFixed(1)}%)`);
    }

    // ------------------------------------------------------------------------
    // SECTION 7: KEY PATTERN SUMMARY
    // ------------------------------------------------------------------------
    console.log('\n' + '='.repeat(80));
    console.log('SECTION 7: KEY PATTERN SUMMARY - WHAT DO BTTS-BH GAMES HAVE IN COMMON?');
    console.log('='.repeat(80));

    // Check xG balance (home vs away)
    const balancedXg = predictions.filter(p => Math.abs(p.pred.homeXg - p.pred.awayXg) < 0.3).length;
    const moderateImbalance = predictions.filter(p => {
      const diff = Math.abs(p.pred.homeXg - p.pred.awayXg);
      return diff >= 0.3 && diff < 0.7;
    }).length;
    const highImbalance = predictions.filter(p => Math.abs(p.pred.homeXg - p.pred.awayXg) >= 0.7).length;
    console.log(`\n  xG Balance (|homeXg - awayXg|):`);
    console.log(`    Balanced (< 0.3):   ${balancedXg} (${(balancedXg / predictions.length * 100).toFixed(1)}%)`);
    console.log(`    Moderate (0.3-0.7):  ${moderateImbalance} (${(moderateImbalance / predictions.length * 100).toFixed(1)}%)`);
    console.log(`    Imbalanced (>= 0.7): ${highImbalance} (${(highImbalance / predictions.length * 100).toFixed(1)}%)`);

    // Both teams have xG >= 1.0?
    const bothXgGt1 = predictions.filter(p => p.pred.homeXg >= 1.0 && p.pred.awayXg >= 1.0).length;
    const bothXgGt12 = predictions.filter(p => p.pred.homeXg >= 1.2 && p.pred.awayXg >= 1.2).length;
    const homeXgGt15 = predictions.filter(p => p.pred.homeXg >= 1.5).length;
    const awayXgGt15 = predictions.filter(p => p.pred.awayXg >= 1.5).length;
    console.log(`\n  Both teams xG >= 1.0: ${bothXgGt1} (${(bothXgGt1 / predictions.length * 100).toFixed(1)}%)`);
    console.log(`  Both teams xG >= 1.2: ${bothXgGt12} (${(bothXgGt12 / predictions.length * 100).toFixed(1)}%)`);
    console.log(`  Home xG >= 1.5: ${homeXgGt15} (${(homeXgGt15 / predictions.length * 100).toFixed(1)}%)`);
    console.log(`  Away xG >= 1.5: ${awayXgGt15} (${(awayXgGt15 / predictions.length * 100).toFixed(1)}%)`);

    // Actual goals
    const avgActualHomeGoals = bttsBH.filter(m => predictions.some(p => p.match.date === m.date && p.match.homeTeam === m.homeTeam && p.match.awayTeam === m.awayTeam)).reduce((s, m) => s + m.ftHomeGoals, 0) / Math.max(1, predictions.length);
    const avgActualAwayGoals = bttsBH.filter(m => predictions.some(p => p.match.date === m.date && p.match.homeTeam === m.homeTeam && p.match.awayTeam === m.awayTeam)).reduce((s, m) => s + m.ftAwayGoals, 0) / Math.max(1, predictions.length);
    console.log(`\n  Actual avg home goals (predicted games): ${avgActualHomeGoals.toFixed(2)} (predicted: ${avgHomeXg.toFixed(2)})`);
    console.log(`  Actual avg away goals (predicted games): ${avgActualAwayGoals.toFixed(2)} (predicted: ${avgAwayXg.toFixed(2)})`);

    // ------------------------------------------------------------------------
    // SECTION 8: EXAMPLE GAMES
    // ------------------------------------------------------------------------
    console.log('\n' + '='.repeat(80));
    console.log('SECTION 8: EXAMPLE BTTS-BOTH-HALVES GAMES (RECENT SEASONS)');
    console.log('='.repeat(80));

    const recentBH = bttsBH.filter(m => ['2425', '2324', '2223'].includes(m.season));
    // Get predictions for these
    console.log('\n  Date       | Season | Home           | Away             | HT  | SH  | FT  | O2.5% | BTTS% | xG   | Home xG | Away xG');
    console.log('  ' + '-'.repeat(130));
    for (const m of recentBH.slice(0, 30)) {
      const pred = predictions.find(p => p.match.date === m.date && p.match.homeTeam === m.homeTeam && p.match.awayTeam === m.awayTeam);
      if (!pred) continue;
      console.log(`  ${m.date.padEnd(10)} | ${m.season}  | ${m.homeTeam.padEnd(14)} | ${m.awayTeam.padEnd(16)} | ${m.htHomeGoals}-${m.htAwayGoals}  | ${m.shHomeGoals}-${m.shAwayGoals}  | ${m.ftHomeGoals}-${m.ftAwayGoals}  | ${String(pred.pred.over25).padStart(4)}% | ${String(pred.pred.btts).padStart(4)}% | ${pred.pred.totalXg.toFixed(2).padStart(4)} | ${pred.pred.homeXg.toFixed(2).padStart(7)} | ${pred.pred.awayXg.toFixed(2)}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('ANALYSIS COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error);
