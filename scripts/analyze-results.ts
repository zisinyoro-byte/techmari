// Comprehensive analysis of betting results

interface Match {
  league: string;
  teamA: string;
  teamB: string;
  lastH2H: string;
  predictedScore: string;
  model15Odds: number;
  modelBTTSOdds: number;
  o25Prob: number;
  o35Prob: number;
  bttsConfidence: string;
  o15Confidence: string;
  bttsProb: number;
  regressionSignal: string;
  zScoreSignal: string;
  xgSignal: string;
  bttsChecklist: string;
  o35Checklist: string;
  actualHT: string;
  actualFT: string;
  bookieHome: number;
  bookieDraw: number;
  bookieAway: number;
}

interface Outcome {
  color: string;
  btts: boolean;
  o15: boolean;
  o25: boolean;
  totalGoals: number;
}

const matches: Match[] = [
  { league: "Scotland Championship", teamA: "Partick", teamB: "Ross County", lastH2H: "'2-0", predictedScore: "'1-1", model15Odds: 1.30, modelBTTSOdds: 1.79, o25Prob: 52.60, o35Prob: 30.50, bttsConfidence: "Medium", o15Confidence: "High", bttsProb: 55.80, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Over", bttsChecklist: "6 of 7", o35Checklist: "4 of 7", actualHT: "3-1", actualFT: "3-1", bookieHome: 1.72, bookieDraw: 3.50, bookieAway: 4.50 },
  { league: "Scotland Championship", teamA: "Morton", teamB: "Arbroath", lastH2H: "'1-1", predictedScore: "'1-0", model15Odds: 1.40, modelBTTSOdds: 2.05, o25Prob: 45.60, o35Prob: 24.40, bttsConfidence: "Low", o15Confidence: "Medium", bttsProb: 48.90, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Over", bttsChecklist: "5 of 7", o35Checklist: "3 of 7", actualHT: "2-1", actualFT: "2-1", bookieHome: 2.60, bookieDraw: 2.95, bookieAway: 2.75 },
  { league: "Scotland Championship", teamA: "St Johnstone", teamB: "Queens Park", lastH2H: "'1-1", predictedScore: "'2-0", model15Odds: 1.16, modelBTTSOdds: 2.16, o25Prob: 68.00, o35Prob: 46.00, bttsConfidence: "Low", o15Confidence: "High", bttsProb: 46.30, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Strong Over", bttsChecklist: "5 of 7", o35Checklist: "4 of 7", actualHT: "0-1", actualFT: "1-1", bookieHome: 1.27, bookieDraw: 5.20, bookieAway: 9.00 },
  { league: "Scotland League Two", teamA: "Dumbarton", teamB: "Forfar", lastH2H: "'2-0", predictedScore: "'1-1", model15Odds: 1.39, modelBTTSOdds: 1.96, o25Prob: 46.70, o35Prob: 25.10, bttsConfidence: "Medium", o15Confidence: "Medium", bttsProb: 51.10, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Neutral", bttsChecklist: "7 of 7", o35Checklist: "4 of 7", actualHT: "0-2", actualFT: "2-2", bookieHome: 2.33, bookieDraw: 3.20, bookieAway: 2.75 },
  { league: "England League One", teamA: "Wycombe", teamB: "Port Vale", lastH2H: "'0-0", predictedScore: "'2-0", model15Odds: 1.29, modelBTTSOdds: 2.10, o25Prob: 53.50, o35Prob: 31.40, bttsConfidence: "Low", o15Confidence: "High", bttsProb: 47.60, regressionSignal: "Neutral", zScoreSignal: "Neutral", xgSignal: "Strong Over", bttsChecklist: "5 of 7", o35Checklist: "3 of 7", actualHT: "1-0", actualFT: "4-0", bookieHome: 1.47, bookieDraw: 4.30, bookieAway: 6.40 },
  { league: "England League Two", teamA: "Colchester", teamB: "Walsall", lastH2H: "'0-2", predictedScore: "'1-1", model15Odds: 1.33, modelBTTSOdds: 1.90, o25Prob: 50.90, o35Prob: 28.80, bttsConfidence: "Medium", o15Confidence: "High", bttsProb: 52.60, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Strong Over", bttsChecklist: "6 of 7", o35Checklist: "3 of 7", actualHT: "0-0", actualFT: "1-1", bookieHome: 2.20, bookieDraw: 3.10, bookieAway: 3.40 },
  { league: "England League Two", teamA: "Salford", teamB: "MK Dons", lastH2H: "'2-0", predictedScore: "'1-1", model15Odds: 1.28, modelBTTSOdds: 1.72, o25Prob: 54.90, o35Prob: 32.50, bttsConfidence: "Medium", o15Confidence: "High", bttsProb: 58.00, regressionSignal: "Over", zScoreSignal: "Over", xgSignal: "Strong Over", bttsChecklist: "6 of 7", o35Checklist: "3 of 7", actualHT: "0-0", actualFT: "1-0", bookieHome: 2.85, bookieDraw: 3.30, bookieAway: 2.42 },
  { league: "England League Two", teamA: "Swindon", teamB: "Fleetwood", lastH2H: "'1-1", predictedScore: "'1-1", model15Odds: 1.28, modelBTTSOdds: 1.76, o25Prob: 55.10, o35Prob: 32.60, bttsConfidence: "Medium", o15Confidence: "High", bttsProb: 56.70, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Strong Over", bttsChecklist: "6 of 7", o35Checklist: "3 of 7", actualHT: "1-0", actualFT: "1-1", bookieHome: 2.09, bookieDraw: 3.40, bookieAway: 3.35 },
  { league: "England National League", teamA: "Eastleigh", teamB: "Forest Green", lastH2H: "'1-0", predictedScore: "'1-1", model15Odds: 1.29, modelBTTSOdds: 1.75, o25Prob: 53.90, o35Prob: 31.50, bttsConfidence: "Medium", o15Confidence: "High", bttsProb: 57.00, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Strong Under", bttsChecklist: "7 of 7", o35Checklist: "4 of 7", actualHT: "2-1", actualFT: "2-4", bookieHome: 4.70, bookieDraw: 4.00, bookieAway: 1.64 },
  { league: "England National League", teamA: "Solihull", teamB: "Altrincham", lastH2H: "'2-0", predictedScore: "'2-1", model15Odds: 1.17, modelBTTSOdds: 1.62, o25Prob: 66.20, o35Prob: 44.20, bttsConfidence: "High", o15Confidence: "High", bttsProb: 61.70, regressionSignal: "Over", zScoreSignal: "Over", xgSignal: "Strong Under", bttsChecklist: "7 of 7", o35Checklist: "4 of 7", actualHT: "1-0", actualFT: "1-0", bookieHome: 2.05, bookieDraw: 3.65, bookieAway: 3.25 },
  { league: "England National League", teamA: "Wealdstone", teamB: "Hartlepool", lastH2H: "'1-1", predictedScore: "'1-1", model15Odds: 1.20, modelBTTSOdds: 1.56, o25Prob: 63.00, o35Prob: 40.80, bttsConfidence: "High", o15Confidence: "High", bttsProb: 64.10, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Strong Under", bttsChecklist: "7 of 7", o35Checklist: "4 of 7", actualHT: "1-0", actualFT: "3-0", bookieHome: 2.48, bookieDraw: 3.75, bookieAway: 2.50 },
  { league: "England Championship", teamA: "Charlton", teamB: "Bristol City", lastH2H: "'0-0", predictedScore: "'1-1", model15Odds: 1.34, modelBTTSOdds: 1.85, o25Prob: 49.80, o35Prob: 28.00, bttsConfidence: "Medium", o15Confidence: "Medium", bttsProb: 54.10, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Strong Over", bttsChecklist: "6 of 7", o35Checklist: "3 of 7", actualHT: "0-0", actualFT: "1-1", bookieHome: 2.03, bookieDraw: 3.35, bookieAway: 3.85 },
  { league: "England League Two", teamA: "Colchester", teamB: "Oldham", lastH2H: "'1-1", predictedScore: "'1-1", model15Odds: 1.25, modelBTTSOdds: 1.76, o25Prob: 58.00, o35Prob: 35.60, bttsConfidence: "Medium", o15Confidence: "High", bttsProb: 56.90, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Strong Over", bttsChecklist: "6 of 7", o35Checklist: "3 of 7", actualHT: "0-1", actualFT: "1-3", bookieHome: 2.42, bookieDraw: 3.30, bookieAway: 2.85 },
  { league: "Belgium Pro League", teamA: "OH Leuven", teamB: "Standard", lastH2H: "'0-1", predictedScore: "'1-1", model15Odds: 1.29, modelBTTSOdds: 1.76, o25Prob: 54.00, o35Prob: 31.70, bttsConfidence: "Medium", o15Confidence: "High", bttsProb: 56.90, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Over", bttsChecklist: "7 of 7", o35Checklist: "7 of 7", actualHT: "0-0", actualFT: "1-3", bookieHome: 2.17, bookieDraw: 3.30, bookieAway: 3.50 },
  { league: "Greece Super League", teamA: "Asteras", teamB: "Larisa", lastH2H: "'1-1", predictedScore: "'1-0", model15Odds: 1.41, modelBTTSOdds: 2.34, o25Prob: 45.30, o35Prob: 23.90, bttsConfidence: "Low", o15Confidence: "Medium", bttsProb: 42.80, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Over", bttsChecklist: "3 of 7", o35Checklist: "2 of 7", actualHT: "1-0", actualFT: "3-1", bookieHome: 2.11, bookieDraw: 3.15, bookieAway: 3.60 },
  { league: "Greece Super League", teamA: "Panetolikos", teamB: "Atromitos", lastH2H: "'1-0", predictedScore: "'1-1", model15Odds: 1.40, modelBTTSOdds: 1.98, o25Prob: 45.60, o35Prob: 24.20, bttsConfidence: "Medium", o15Confidence: "Medium", bttsProb: 50.40, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Over", bttsChecklist: "4 of 7", o35Checklist: "2 of 7", actualHT: "1-0", actualFT: "1-1", bookieHome: 2.65, bookieDraw: 2.95, bookieAway: 2.85 },
  { league: "Italy Serie A", teamA: "Lazio", teamB: "Parma", lastH2H: "'0-1", predictedScore: "'2-0", model15Odds: 1.13, modelBTTSOdds: 1.80, o25Prob: 71.00, o35Prob: 49.90, bttsConfidence: "Medium", o15Confidence: "High", bttsProb: 55.40, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Strong Over", bttsChecklist: "7 of 7", o35Checklist: "4 of 7", actualHT: "0-1", actualFT: "1-1", bookieHome: 1.98, bookieDraw: 3.25, bookieAway: 4.20 },
  { league: "Scotland Championship", teamA: "Arbroath", teamB: "St Johnstone", lastH2H: "'1-0", predictedScore: "'0-1", model15Odds: 1.41, modelBTTSOdds: 2.19, o25Prob: 45.30, o35Prob: 23.90, bttsConfidence: "Low", o15Confidence: "Medium", bttsProb: 45.60, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Strong Over", bttsChecklist: "5 of 7", o35Checklist: "3 of 7", actualHT: "1-1", actualFT: "2-4", bookieHome: 4.90, bookieDraw: 3.55, bookieAway: 1.66 },
  { league: "Scotland League Two", teamA: "Edinburgh City", teamB: "Spartans", lastH2H: "'0-0", predictedScore: "'1-1", model15Odds: 1.29, modelBTTSOdds: 1.76, o25Prob: 53.50, o35Prob: 31.40, bttsConfidence: "Medium", o15Confidence: "High", bttsProb: 57.00, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Neutral", bttsChecklist: "7 of 7", o35Checklist: "4 of 7", actualHT: "0-0", actualFT: "0-3", bookieHome: 5.60, bookieDraw: 4.10, bookieAway: 1.45 },
  { league: "Turkey Super Lig", teamA: "Genclerbirligi", teamB: "Goztep", lastH2H: "'1-0", predictedScore: "'1-1", model15Odds: 1.30, modelBTTSOdds: 1.79, o25Prob: 53.00, o35Prob: 31.00, bttsConfidence: "Medium", o15Confidence: "High", bttsProb: 56.00, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Over", bttsChecklist: "7 of 7", o35Checklist: "6 of 7", actualHT: "0-1", actualFT: "0-2", bookieHome: 3.30, bookieDraw: 3.15, bookieAway: 2.34 },
  { league: "Turkey Super Lig", teamA: "Trabzonspor", teamB: "Galatasaray", lastH2H: "'0-0", predictedScore: "'1-1", model15Odds: 1.18, modelBTTSOdds: 1.51, o25Prob: 65.30, o35Prob: 43.50, bttsConfidence: "High", o15Confidence: "High", bttsProb: 66.30, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Neutral", bttsChecklist: "7 of 7", o35Checklist: "6 of 7", actualHT: "1-0", actualFT: "2-1", bookieHome: 3.20, bookieDraw: 3.60, bookieAway: 2.19 },
  { league: "France Ligue 1", teamA: "Le Havre", teamB: "Auxerre", lastH2H: "'0-1", predictedScore: "'1-1", model15Odds: 1.47, modelBTTSOdds: 2.10, o25Prob: 41.40, o35Prob: 20.90, bttsConfidence: "Low", o15Confidence: "Medium", bttsProb: 47.50, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Strong Over", bttsChecklist: "6 of 7", o35Checklist: "4 of 7", actualHT: "1-1", actualFT: "1-1", bookieHome: 2.44, bookieDraw: 3.10, bookieAway: 3.20 },
  { league: "France Ligue 2", teamA: "Monaco", teamB: "Marseille", lastH2H: "'1-0", predictedScore: "'2-1", model15Odds: 1.14, modelBTTSOdds: 1.49, o25Prob: 70.40, o35Prob: 49.50, bttsConfidence: "High", o15Confidence: "High", bttsProb: 67.10, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Strong Over", bttsChecklist: "7 of 7", o35Checklist: "5 of 7", actualHT: "0-0", actualFT: "2-1", bookieHome: 2.10, bookieDraw: 3.70, bookieAway: 3.30 },
  { league: "Italy Serie A", teamA: "Inter", teamB: "Roma", lastH2H: "'0-1", predictedScore: "'2-1", model15Odds: 1.23, modelBTTSOdds: 1.75, o25Prob: 59.70, o35Prob: 37.30, bttsConfidence: "Medium", o15Confidence: "High", bttsProb: 57.10, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Strong Over", bttsChecklist: "7 of 7", o35Checklist: "4 of 7", actualHT: "2-1", actualFT: "5-2", bookieHome: 1.59, bookieDraw: 4.10, bookieAway: 5.80 },
  { league: "Scotland Premiership", teamA: "Livingston", teamB: "Hearts", lastH2H: "'1-0", predictedScore: "'1-1", model15Odds: 1.34, modelBTTSOdds: 1.84, o25Prob: 49.90, o35Prob: 28.00, bttsConfidence: "Medium", o15Confidence: "Medium", bttsProb: 54.40, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Strong Over", bttsChecklist: "7 of 7", o35Checklist: "5 of 7", actualHT: "1-1", actualFT: "2-2", bookieHome: 6.40, bookieDraw: 4.50, bookieAway: 1.49 },
  { league: "Turkey Super Lig", teamA: "Karagumruk", teamB: "Rizespor", lastH2H: "'1-0", predictedScore: "'2-1", model15Odds: 1.15, modelBTTSOdds: 1.58, o25Prob: 69.40, o35Prob: 48.30, bttsConfidence: "High", o15Confidence: "High", bttsProb: 63.20, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Over", bttsChecklist: "7 of 7", o35Checklist: "6 of 7", actualHT: "1-0", actualFT: "2-1", bookieHome: 2.95, bookieDraw: 3.45, bookieAway: 2.39 },
  { league: "Turkey Super Lig", teamA: "Antalyaspor", teamB: "Eyupspor", lastH2H: "'0-1", predictedScore: "'1-1", model15Odds: 1.32, modelBTTSOdds: 1.88, o25Prob: 51.70, o35Prob: 29.60, bttsConfidence: "Medium", o15Confidence: "High", bttsProb: 53.10, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Strong Over", bttsChecklist: "7 of 7", o35Checklist: "6 of 7", actualHT: "0-0", actualFT: "3-0", bookieHome: 2.09, bookieDraw: 3.20, bookieAway: 3.85 },
  { league: "England Championship", teamA: "Blackburn", teamB: "West Brom", lastH2H: "'1-0", predictedScore: "'1-1", model15Odds: 1.34, modelBTTSOdds: 1.85, o25Prob: 49.90, o35Prob: 28.20, bttsConfidence: "Medium", o15Confidence: "Medium", bttsProb: 54.10, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Strong Over", bttsChecklist: "6 of 7", o35Checklist: "3 of 7", actualHT: "0-0", actualFT: "0-0", bookieHome: 2.95, bookieDraw: 3.05, bookieAway: 2.60 },
  { league: "England League Two", teamA: "Oldham", teamB: "MK Dons", lastH2H: "'0-0", predictedScore: "'1-1", model15Odds: 1.18, modelBTTSOdds: 1.51, o25Prob: 65.30, o35Prob: 43.10, bttsConfidence: "High", o15Confidence: "High", bttsProb: 66.10, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Strong Over", bttsChecklist: "6 of 7", o35Checklist: "3 of 7", actualHT: "0-1", actualFT: "1-1", bookieHome: 2.95, bookieDraw: 3.30, bookieAway: 2.36 },
  { league: "England League Two", teamA: "Tranmere", teamB: "Colchester", lastH2H: "'1-1", predictedScore: "'1-1", model15Odds: 1.35, modelBTTSOdds: 1.92, o25Prob: 49.60, o35Prob: 27.60, bttsConfidence: "Medium", o15Confidence: "Medium", bttsProb: 52.00, regressionSignal: "Strong Over", zScoreSignal: "Strong Over", xgSignal: "Strong Over", bttsChecklist: "6 of 7", o35Checklist: "3 of 7", actualHT: "0-0", actualFT: "0-1", bookieHome: 3.15, bookieDraw: 3.30, bookieAway: 2.23 },
];

// Parse actual scores
function parseScore(score: string): [number, number] {
  const parts = score.split('-').map(s => parseInt(s.trim()));
  return [parts[0], parts[1]];
}

// Determine outcome category
function getOutcome(match: Match): Outcome {
  const [home, away] = parseScore(match.actualFT);
  const [htHome, htAway] = parseScore(match.actualHT);
  
  const totalGoals = home + away;
  const htGoals = htHome + htAway;
  const shGoals = totalGoals - htGoals;
  
  const btts = home > 0 && away > 0;
  const o15 = totalGoals > 1.5;
  const o25 = totalGoals > 2.5;
  
  // Check if both teams scored in both halves
  const htBtts = htHome > 0 && htAway > 0;
  const shBtts = (home - htHome) > 0 && (away - htAway) > 0;
  const bothHalvesBtts = htBtts && shBtts;
  
  let color: string;
  if (bothHalvesBtts) {
    color = 'Grey';
  } else if (btts) {
    color = 'Green';
  } else if (o15) {
    color = 'Orange';
  } else {
    color = 'Red';
  }
  
  return { color, btts, o15, o25, totalGoals };
}

// Analyze patterns
console.log('\n========================================');
console.log('BETTING RESULTS ANALYSIS');
console.log('========================================\n');

// Add outcomes to matches
const matchesWithOutcomes = matches.map(m => ({ ...m, outcome: getOutcome(m) }));

// Overall stats
const outcomes = matchesWithOutcomes.map(m => m.outcome);
const greyCount = outcomes.filter(o => o.color === 'Grey').length;
const greenCount = outcomes.filter(o => o.color === 'Green').length;
const orangeCount = outcomes.filter(o => o.color === 'Orange').length;
const redCount = outcomes.filter(o => o.color === 'Red').length;
const total = matches.length;

console.log('=== OVERALL OUTCOMES ===');
console.log(`Grey (Both halves BTTS): ${greyCount} (${((greyCount/total)*100).toFixed(1)}%)`);
console.log(`Green (BTTS): ${greenCount} (${((greenCount/total)*100).toFixed(1)}%)`);
console.log(`Orange (O1.5 only): ${orangeCount} (${((orangeCount/total)*100).toFixed(1)}%)`);
console.log(`Red (Under 1.5): ${redCount} (${((redCount/total)*100).toFixed(1)}%)`);
console.log(`\nTotal BTTS Success Rate: ${((greyCount + greenCount) / total * 100).toFixed(1)}%`);
console.log(`Total O1.5 Success Rate: ${((greyCount + greenCount + orangeCount) / total * 100).toFixed(1)}%`);

// BTTS Prob analysis
console.log('\n=== BTTS PROBABILITY ANALYSIS ===');
const bttsRanges = [
  { min: 40, max: 45, label: '40-45%' },
  { min: 45, max: 50, label: '45-50%' },
  { min: 50, max: 55, label: '50-55%' },
  { min: 55, max: 60, label: '55-60%' },
  { min: 60, max: 70, label: '60-70%' },
];

bttsRanges.forEach(range => {
  const matchesInRange = matchesWithOutcomes.filter(m => m.bttsProb >= range.min && m.bttsProb < range.max);
  if (matchesInRange.length > 0) {
    const bttsSuccess = matchesInRange.filter(m => m.outcome.btts).length;
    console.log(`BTTS Prob ${range.label}: ${bttsSuccess}/${matchesInRange.length} = ${((bttsSuccess/matchesInRange.length)*100).toFixed(1)}% BTTS success`);
  }
});

// O2.5 Prob analysis
console.log('\n=== O2.5 PROBABILITY ANALYSIS ===');
const o25Ranges = [
  { min: 40, max: 50, label: '40-50%' },
  { min: 50, max: 55, label: '50-55%' },
  { min: 55, max: 60, label: '55-60%' },
  { min: 60, max: 70, label: '60-70%' },
  { min: 70, max: 80, label: '70-80%' },
];

o25Ranges.forEach(range => {
  const matchesInRange = matchesWithOutcomes.filter(m => m.o25Prob >= range.min && m.o25Prob < range.max);
  if (matchesInRange.length > 0) {
    const o25Success = matchesInRange.filter(m => m.outcome.o25).length;
    console.log(`O2.5 Prob ${range.label}: ${o25Success}/${matchesInRange.length} = ${((o25Success/matchesInRange.length)*100).toFixed(1)}% O2.5 success`);
  }
});

// BTTS Confidence analysis
console.log('\n=== BTTS CONFIDENCE ANALYSIS ===');
['High', 'Medium', 'Low'].forEach(conf => {
  const matchesWithConf = matchesWithOutcomes.filter(m => m.bttsConfidence === conf);
  if (matchesWithConf.length > 0) {
    const bttsSuccess = matchesWithConf.filter(m => m.outcome.btts).length;
    const avgBttsProb = matchesWithConf.reduce((sum, m) => sum + m.bttsProb, 0) / matchesWithConf.length;
    console.log(`${conf} Confidence: ${bttsSuccess}/${matchesWithConf.length} = ${((bttsSuccess/matchesWithConf.length)*100).toFixed(1)}% BTTS success (avg BTTS prob: ${avgBttsProb.toFixed(1)}%)`);
  }
});

// Regression Signal analysis
console.log('\n=== REGRESSION SIGNAL ANALYSIS ===');
const strongOverMatches = matchesWithOutcomes.filter(m => m.regressionSignal === 'Strong Over');
const overMatches = matchesWithOutcomes.filter(m => m.regressionSignal === 'Over');
const neutralMatches = matchesWithOutcomes.filter(m => m.regressionSignal === 'Neutral');

if (strongOverMatches.length > 0) {
  const bttsSuccess = strongOverMatches.filter(m => m.outcome.btts).length;
  console.log(`Strong Over: ${bttsSuccess}/${strongOverMatches.length} = ${((bttsSuccess/strongOverMatches.length)*100).toFixed(1)}% BTTS success`);
}
if (overMatches.length > 0) {
  const bttsSuccess = overMatches.filter(m => m.outcome.btts).length;
  console.log(`Over: ${bttsSuccess}/${overMatches.length} = ${((bttsSuccess/overMatches.length)*100).toFixed(1)}% BTTS success`);
}
if (neutralMatches.length > 0) {
  const bttsSuccess = neutralMatches.filter(m => m.outcome.btts).length;
  console.log(`Neutral: ${bttsSuccess}/${neutralMatches.length} = ${((bttsSuccess/neutralMatches.length)*100).toFixed(1)}% BTTS success`);
}

// BTTS Checklist analysis
console.log('\n=== BTTS CHECKLIST ANALYSIS ===');
['7 of 7', '6 of 7', '5 of 7', '4 of 7', '3 of 7'].forEach(check => {
  const matchesWithCheck = matchesWithOutcomes.filter(m => m.bttsChecklist === check);
  if (matchesWithCheck.length > 0) {
    const bttsSuccess = matchesWithCheck.filter(m => m.outcome.btts).length;
    console.log(`${check}: ${bttsSuccess}/${matchesWithCheck.length} = ${((bttsSuccess/matchesWithCheck.length)*100).toFixed(1)}% BTTS success`);
  }
});

// xG Signal analysis
console.log('\n=== xG SIGNAL ANALYSIS ===');
['Strong Over', 'Over', 'Strong Under', 'Neutral'].forEach(signal => {
  const matchesWithSignal = matchesWithOutcomes.filter(m => m.xgSignal === signal);
  if (matchesWithSignal.length > 0) {
    const bttsSuccess = matchesWithSignal.filter(m => m.outcome.btts).length;
    console.log(`${signal}: ${bttsSuccess}/${matchesWithSignal.length} = ${((bttsSuccess/matchesWithSignal.length)*100).toFixed(1)}% BTTS success`);
  }
});

// League analysis
console.log('\n=== LEAGUE ANALYSIS ===');
const leagues = [...new Set(matchesWithOutcomes.map(m => m.league))];
leagues.forEach(league => {
  const leagueMatches = matchesWithOutcomes.filter(m => m.league === league);
  if (leagueMatches.length >= 2) {
    const bttsSuccess = leagueMatches.filter(m => m.outcome.btts).length;
    console.log(`${league}: ${bttsSuccess}/${leagueMatches.length} = ${((bttsSuccess/leagueMatches.length)*100).toFixed(1)}% BTTS`);
  }
});

// Detailed match breakdown
console.log('\n=== DETAILED MATCH BREAKDOWN ===');
matchesWithOutcomes.forEach((m, i) => {
  console.log(`${i+1}. ${m.teamA} vs ${m.teamB}: FT ${m.actualFT} | BTTS: ${m.bttsProb}% | O2.5: ${m.o25Prob}% | Conf: ${m.bttsConfidence} | Checklist: ${m.bttsChecklist} | Outcome: ${m.outcome.color} (BTTS: ${m.outcome.btts}, O2.5: ${m.outcome.o25})`);
});

// Key insights
console.log('\n========================================');
console.log('KEY INSIGHTS & RECOMMENDATIONS');
console.log('========================================');
