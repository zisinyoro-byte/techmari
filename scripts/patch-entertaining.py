#!/usr/bin/env python3
"""Patch Entertaining Teams to use only current + previous season"""

def patch_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Fix import
    content = content.replace(
        "import { COLORS, PIE_COLORS, SEASON_NAMES } from '@/lib/constants'",
        "import { COLORS, PIE_COLORS, SEASON_NAMES, EUROPEAN_SEASONS } from '@/lib/constants'"
    )

    # Fix 1: Add season filter before teamStats
    old1 = '''                {/* Entertaining Teams - Good Attack + Weak Defense */}
                {(() => {
                  // Calculate team stats
                  const teamStats = new Map<string, { 
                    scored: number; 
                    conceded: number; 
                    matches: number;
                    homeScored: number;
                    homeConceded: number;
                    homeMatches: number;
                    awayScored: number;
                    awayConceded: number;
                    awayMatches: number;
                  }>();
                  
                  results.forEach(r => {'''

    new1 = '''                {/* Entertaining Teams - Good Attack + Weak Defense */}
                {(() => {
                  // Only use current season + previous season for entertaining teams
                  const recentSeasons = [EUROPEAN_SEASONS[0], EUROPEAN_SEASONS[1]];
                  const recentResults = results.filter(r => recentSeasons.includes(r.season));

                  // Calculate team stats
                  const teamStats = new Map<string, { 
                    scored: number; 
                    conceded: number; 
                    matches: number;
                    homeScored: number;
                    homeConceded: number;
                    homeMatches: number;
                    awayScored: number;
                    awayConceded: number;
                    awayMatches: number;
                  }>();
                  
                  recentResults.forEach(r => {'''

    if old1 not in content:
        print(f'  WARNING: Could not find old1 pattern in {filepath}')
    else:
        content = content.replace(old1, new1)
        print(f'  Patched: added season filter + recentResults')

    # Fix 2: Replace league averages
    old2 = '''                  // League averages
                  const leagueAvgScored = analytics.avgGoalsPerGame / 2;
                  const leagueAvgConceded = analytics.avgGoalsPerGame / 2;'''

    new2 = '''                  // League averages (computed from recent 2 seasons only)
                  const totalGoalsRecent = recentResults.reduce((sum, r) => sum + r.ftHomeGoals + r.ftAwayGoals, 0);
                  const leagueAvgGoalsPerGame = recentResults.length > 0 ? totalGoalsRecent / recentResults.length : analytics.avgGoalsPerGame;
                  const leagueAvgScored = leagueAvgGoalsPerGame / 2;
                  const leagueAvgConceded = leagueAvgGoalsPerGame / 2;'''

    if old2 not in content:
        print(f'  WARNING: Could not find old2 pattern in {filepath}')
    else:
        content = content.replace(old2, new2)
        print(f'  Patched: league averages now use recent 2 seasons')

    with open(filepath, 'w') as f:
        f.write(content)
    print(f'  Saved: {filepath}')


# Patch both files
for fpath in [
    '/tmp/techmari/src/components/tabs/OverviewTab.tsx',
    '/tmp/techmari/src/components/app/OverviewTab.tsx',
]:
    print(f'Patching {fpath}...')
    patch_file(fpath)
    print()
