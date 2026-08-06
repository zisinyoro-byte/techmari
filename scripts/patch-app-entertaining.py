#!/usr/bin/env python3
"""Patch app/OverviewTab.tsx for Entertaining Teams season filter"""

filepath = '/tmp/techmari/src/components/app/OverviewTab.tsx'

with open(filepath, 'r') as f:
    content = f.read()

# Fix 1: Add season filter
old1 = '''          {/* Entertaining Teams - Good Attack + Weak Defense */}
          {(() => {
            const teamStats = new Map<string, {
              scored: number
              conceded: number
              matches: number
              homeScored: number
              homeConceded: number
              homeMatches: number
              awayScored: number
              awayConceded: number
              awayMatches: number
            }>()

            results.forEach(r => {'''

new1 = '''          {/* Entertaining Teams - Good Attack + Weak Defense */}
          {(() => {
            // Only use current season + previous season for entertaining teams
            const recentSeasons = [EUROPEAN_SEASONS[0], EUROPEAN_SEASONS[1]]
            const recentResults = results.filter(r => recentSeasons.includes(r.season))

            const teamStats = new Map<string, {
              scored: number
              conceded: number
              matches: number
              homeScored: number
              homeConceded: number
              homeMatches: number
              awayScored: number
              awayConceded: number
              awayMatches: number
            }>()

            recentResults.forEach(r => {'''

if old1 not in content:
    print('ERROR: old1 pattern not found')
else:
    content = content.replace(old1, new1)
    print('Patch 1: season filter added')

# Fix 2: Replace league averages
old2 = '''            const leagueAvgScored = analytics.avgGoalsPerGame / 2
            const leagueAvgConceded = analytics.avgGoalsPerGame / 2'''

new2 = '''            // League averages (computed from recent 2 seasons only)
            const totalGoalsRecent = recentResults.reduce((sum, r) => sum + r.ftHomeGoals + r.ftAwayGoals, 0)
            const leagueAvgGoalsPerGame = recentResults.length > 0 ? totalGoalsRecent / recentResults.length : analytics.avgGoalsPerGame
            const leagueAvgScored = leagueAvgGoalsPerGame / 2
            const leagueAvgConceded = leagueAvgGoalsPerGame / 2'''

if old2 not in content:
    print('ERROR: old2 pattern not found')
else:
    content = content.replace(old2, new2)
    print('Patch 2: league averages use recent 2 seasons')

with open(filepath, 'w') as f:
    f.write(content)
print(f'Saved: {filepath}')
