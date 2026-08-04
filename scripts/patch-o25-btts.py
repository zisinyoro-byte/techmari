#!/usr/bin/env python3
"""Patch Best O2.5 and BTTS Teams to use only current + previous season"""

def patch_tabs(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Replace: results.forEach(r => {  (inside the O2.5/BTTS section)
    # We target the specific block
    old = '''                {/* Best O2.5 and BTTS Teams - Side by Side */}
                {(() => {
                  // Calculate team O2.5 and BTTS rates
                  const teamGoalStats = new Map<string, { 
                    matches: number;
                    over25Count: number;
                    bttsCount: number;
                  }>();
                  
                  results.forEach(r => {'''

    new = '''                {/* Best O2.5 and BTTS Teams - Side by Side */}
                {(() => {
                  // Only use current season + previous season
                  const o25BttsRecentResults = results.filter(r => recentSeasons.includes(r.season));

                  // Calculate team O2.5 and BTTS rates
                  const teamGoalStats = new Map<string, { 
                    matches: number;
                    over25Count: number;
                    bttsCount: number;
                  }>();
                  
                  o25BttsRecentResults.forEach(r => {'''

    if old not in content:
        print(f'  WARNING: pattern not found in {filepath}')
        return False
    
    content = content.replace(old, new)
    with open(filepath, 'w') as f:
        f.write(content)
    print(f'  Patched: {filepath}')
    return True


def patch_app(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    old = '''          {/* Best O2.5 and BTTS Teams */}
          {(() => {
            const teamGoalStats = new Map<string, {
              matches: number;
              over25Count: number;
              bttsCount: number;
            }>()

            results.forEach(r => {'''

    new = '''          {/* Best O2.5 and BTTS Teams */}
          {(() => {
            // Only use current season + previous season
            const o25BttsRecentResults = results.filter(r => recentSeasons.includes(r.season))

            const teamGoalStats = new Map<string, {
              matches: number;
              over25Count: number;
              bttsCount: number;
            }>()

            o25BttsRecentResults.forEach(r => {'''

    if old not in content:
        print(f'  WARNING: pattern not found in {filepath}')
        return False

    content = content.replace(old, new)
    with open(filepath, 'w') as f:
        f.write(content)
    print(f'  Patched: {filepath}')
    return True


patch_tabs('/tmp/techmari/src/components/tabs/OverviewTab.tsx')
patch_app('/tmp/techmari/src/components/app/OverviewTab.tsx')
print('Done!')
