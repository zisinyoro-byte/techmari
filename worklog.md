---
Task ID: 1
Agent: main
Task: EPL BTTS Both Halves pattern analysis

Work Log:
- Explored techmari data model: MatchResult has htHomeGoals/htAwayGoals for HT scores, SH derived from FT-HT
- Created standalone analysis script at /home/z/my-project/scripts/epl-btts-both-halves-analysis.ts
- Fetched all 11 EPL seasons (1516-2526) from football-data.co.uk (4,180 matches)
- Identified 223 BTTS-BH games (5.3%)
- Ran prediction model on 113 games (2021-2425 seasons with proper chronological training)
- Analyzed scoreline patterns, odds, model predictions, match statistics
- Fixed training season ordering (CHRONO_SEASONS reversed from ALL_SEASONS)

Stage Summary:
- BTTS-BH is rare (5.3%), avg 5.52 goals, 2-2 most common FT scoreline
- 90% have O2.5 odds < 2.0, draw rate doubles (34% vs 24%)
- Model barely distinguishes these: only +2.2pp O2.5, +1.2pp BTTS vs normal games
- Massive xG underestimation: predicted 3.00, actual 5.52
- Away team actual goals (2.71) vastly exceed predicted away xG (1.04)
