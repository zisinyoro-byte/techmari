import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// In-memory cache
let lookupCache: Record<string, any[]> | null = null;
let lastLoadTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getLookup(): Record<string, any[]> {
  const now = Date.now();
  if (lookupCache && now - lastLoadTime < CACHE_TTL) return lookupCache;

  const filePath = path.join(process.cwd(), 'public', 'data', 'combo-lookup.json');
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  lookupCache = JSON.parse(raw);
  lastLoadTime = now;
  return lookupCache!;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const combo = searchParams.get('combo');

    if (!combo) {
      return NextResponse.json({ error: 'Missing combo parameter' }, { status: 400 });
    }

    const lookup = getLookup();

    // Exact match first
    let matches = lookup[combo] || [];

    // If exact match has few results, try fuzzy matching
    let fuzzyMatches: typeof matches = [];
    let fuzzyCombo = '';
    if (matches.length < 5) {
      // Split combo into parts and try relaxing each signal
      const parts = combo.split(' | ').map(p => p.trim());
      
      // Priority order for relaxation (least important first):
      // FP1 → GF → GR → SB → MOM → GOAL → BTTS
      const relaxOrder = [6, 2, 1, 0, 5, 4, 3]; // indices into parts array

      for (const idx of relaxOrder) {
        if (matches.length >= 10) break;
        if (idx >= parts.length) continue;
        const relaxedParts = [...parts];
        const partVal = relaxedParts[idx];
        const key = partVal.split(':')[0];
        
        // Replace this signal with wildcard
        if (key === 'FP1') relaxedParts[idx] = 'FP1:*';
        else if (key === 'GF') relaxedParts[idx] = 'GF:*';
        else if (key === 'GR') relaxedParts[idx] = 'GR:*';
        else if (key === 'SB') relaxedParts[idx] = 'SB:*';
        else if (key === 'MOM') relaxedParts[idx] = 'MOM:*';
        else if (key === 'GOAL') relaxedParts[idx] = 'GOAL:*';
        else if (key === 'BTTS') relaxedParts[idx] = 'BTTS:*';

        const fuzzyKey = relaxedParts.join(' | ');
        
        // Count matching combos
        for (const [k, v] of Object.entries(lookup)) {
          const kParts = k.split(' | ').map(p => p.trim());
          let allMatch = true;
          for (let i = 0; i < relaxedParts.length; i++) {
            if (relaxedParts[i].endsWith(':*')) continue; // wildcard, skip
            if (i >= kParts.length || kParts[i] !== relaxedParts[i]) {
              allMatch = false;
              break;
            }
          }
          if (allMatch && (!fuzzyCombo || (lookup[fuzzyCombo]?.length || 0) < (v as any[]).length)) {
            fuzzyCombo = k;
            fuzzyMatches = v as typeof matches;
          }
        }
        
        if (fuzzyMatches.length > matches.length) {
          matches = fuzzyMatches;
        }
      }
    }

    // Compute statistics for the matches
    const total = matches.length;
    const exact = matches.filter(m => m.predicted === m.score).length;
    const o25Actual = matches.filter(m => m.total > 2).length;
    const bttsActual = matches.filter(m => {
      if (m.ftr === '') return false
      const parts = m.score.split('-');
      return parseInt(parts[0]) > 0 && parseInt(parts[1]) > 0;
    }).length;

    // Scoreline frequency
    const scoreFreq: Record<string, number> = {};
    for (const m of matches) {
      scoreFreq[m.score] = (scoreFreq[m.score] || 0) + 1;
    }
    const topScores = Object.entries(scoreFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([score, count]) => ({ score, count, pct: ((count / total) * 100).toFixed(1) }));

    // Result distribution
    const homeWins = matches.filter(m => m.ftr === 'H').length;
    const draws = matches.filter(m => m.ftr === 'D').length;
    const awayWins = matches.filter(m => m.ftr === 'A').length;

    // Goals distribution
    const goalBuckets: Record<string, number> = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5+': 0 };
    for (const m of matches) {
      const g = m.total;
      if (g === 0) goalBuckets['0']++;
      else if (g === 1) goalBuckets['1']++;
      else if (g === 2) goalBuckets['2']++;
      else if (g === 3) goalBuckets['3']++;
      else if (g === 4) goalBuckets['4']++;
      else goalBuckets['5+']++;
    }

    // Is this a fuzzy match?
    const isFuzzy = fuzzyCombo && fuzzyCombo !== combo;

    return NextResponse.json({
      combo: isFuzzy ? fuzzyCombo : combo,
      isFuzzy,
      requestedCombo: combo,
      totalMatches: total,
      stats: {
        exactScoreline: { hits: exact, total, pct: total > 0 ? ((exact / total) * 100).toFixed(1) : '0' },
        over25: { hits: o25Actual, total, pct: total > 0 ? ((o25Actual / total) * 100).toFixed(1) : '0' },
        btts: { hits: bttsActual, total, pct: total > 0 ? ((bttsActual / total) * 100).toFixed(1) : '0' },
        results: { homeWins, draws, awayWins },
      },
      topScores,
      goalBuckets,
      matches: matches.slice(0, 200), // Return max 200 matches to keep response manageable
    });
  } catch (error) {
    console.error('Backtest single error:', error);
    return NextResponse.json({ error: 'Failed to lookup combo' }, { status: 500 });
  }
}
