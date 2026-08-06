#!/usr/bin/env python3
"""Fix scope issue - recentSeasons not accessible across IIFEs"""

def fix_scope(filepath, search_text, replace_text):
    with open(filepath, 'r') as f:
        content = f.read()
    if search_text not in content:
        print(f'  WARNING: pattern not found in {filepath}')
        return
    content = content.replace(search_text, replace_text)
    with open(filepath, 'w') as f:
        f.write(content)
    print(f'  Fixed: {filepath}')

# tabs version
fix_scope(
    '/tmp/techmari/src/components/tabs/OverviewTab.tsx',
    '''                  // Only use current season + previous season
                  const o25BttsRecentResults = results.filter(r => recentSeasons.includes(r.season));''',
    '''                  // Only use current season + previous season
                  const o25BttsSeasons = [EUROPEAN_SEASONS[0], EUROPEAN_SEASONS[1]];
                  const o25BttsRecentResults = results.filter(r => o25BttsSeasons.includes(r.season));'''
)

# app version
fix_scope(
    '/tmp/techmari/src/components/app/OverviewTab.tsx',
    '''            // Only use current season + previous season
            const o25BttsRecentResults = results.filter(r => recentSeasons.includes(r.season))''',
    '''            // Only use current season + previous season
            const o25BttsSeasons = [EUROPEAN_SEASONS[0], EUROPEAN_SEASONS[1]]
            const o25BttsRecentResults = results.filter(r => o25BttsSeasons.includes(r.season))'''
)

print('Done!')
