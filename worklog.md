# Work Log

---
Task ID: 1
Agent: Main Agent
Task: Build dedicated BTTS-Both-Halves detector using O2.5 implied + rolling scoring combo

Work Log:
- Explored techmari codebase structure: 8 tabs, 7+ indicator systems, all in betting-filters.ts
- Studied existing detector implementations: Strong Bet (14pts/8 threshold), Goal Fest (6-of-8), Grey Result (7-of-10), BTTS Qualification, Third Goal, Dominant Team
- Designed BTTS-BH detector based on EPL analysis findings (5.3% base rate, O2.5 implied strongest predictor)
- Added `BTTS_BOTH_HALVES_CONFIG` with 10-check system (need 7/10)
- Added `bttsBothHalves` entries to `O25_IMPLIED_THRESHOLDS` (65%) and `ROLLING_SCORING_THRESHOLDS` (3.0)
- Implemented `computeBTTSBothHalves()` with 4-tier system: STRONG/QUALIFIED/BORDERLINE/UNLIKELY
- Integrated into PredictionsTab.tsx: import, computation (line ~922), combo string ('BH:' + tierLabel), and cyan-themed Card UI
- Build compiled successfully with zero errors

Stage Summary:
- New function: `computeBTTSBothHalves()` in `/home/z/my-project/src/lib/betting-filters.ts`
- New config: `BTTS_BOTH_HALVES_CONFIG` in same file
- Updated: `/home/z/my-project/src/components/tabs/PredictionsTab.tsx` (import + computation + combo + UI card)
- 10-check system: O2.5 Implied (CRITICAL), O3.5 (HIGH), BTTS (HIGH), O2.5 (HIGH), Rolling Scoring (HIGH), Draw Prob sweet spot (MEDIUM), HT Draw (MEDIUM), League Avg Goals (LOW), BTTS Checklist (LOW), O2.5 Implied elite 70%+ (CRITICAL)
- Combo string updated: now includes `BH:Strong|Qualified|Borderline|Unlikely`
- Build: `bun run build` → compiled successfully, all 14 routes generated

---
Task ID: 1
Agent: main
Task: Multi-league BTTS-BH threshold calibration backtest

Work Log:
- Built standalone backtest script (btts-bh-multi-league-backtest.ts) with CSV caching
- Fetched 24,057 matches across 7 European leagues (EPL, La Liga, Bundesliga, Serie A, Ligue 1, Eredivisie, Primeira Liga) × 10 seasons (1516-2425)
- Computed 8 BTTS-BH checks for every game with rolling 5-game team windows
- Ran individual threshold sweeps for all 8 checks
- Ran per-league O2.5 implied lift analysis
- Ran 1,560-combo grid search across O2.5, elite, rolling, and required checks
- Fixed per-league Map key bug (ld.code → ld.league)

Stage Summary:
- Base rate: 5.19% (1,249/24,057), range 3.92%-6.14% by league
- Current config (65/72/3.0/req5) achieves 6.20% hit rate, 1.19x lift, 29.1% coverage
- Grid search best: 6.29%, 1.21x, 34.3% — only marginal improvement (+0.09pp, +0.02x)
- BTTS rolling rate confirmed DEAD (0.99-1.02x at all thresholds)
- O2.5 implied is the only strong signal (1.39x at 64%), but varies wildly by league (La Liga 2.15x vs Eredivisie 1.02x at 70%)
- Draw prob <25% is second-best (1.21x)
- Recommendation: current thresholds are near-optimal, consider simplifying to 3-check system

---
Task ID: 2
Agent: main
Task: Refactor BTTS-BH detector from 8-check to lean 3-check system

Work Log:
- Updated BTTS_BOTH_HALVES_CONFIG: removed o25ImpliedElite, o35Prob, bttsProb, o25Prob, leagueAvgGoals
- Kept only 3 proven checks: O2.5 implied >= 65%, Draw prob < 25%, Rolling scoring >= 3.0
- Changed requiredChecks from 5/8 to 2/3
- Refactored computeBTTSBothHalves() to 3-check logic with updated tier thresholds (3/3=STRONG, 2/3=QUALIFIED, 1/3=BORDERLINE, 0/3=UNLIKELY)
- Kept BTTSBothHalvesInput interface unchanged for backward compat (unused fields documented)
- Updated PredictionsTab.tsx grid from 4-col to stacked layout for 3 checks
- Verified no other files reference removed config fields
- Type-check passes (pre-existing TSX error at line 1540 unrelated)

Stage Summary:
- Detector simplified from 8 checks to 3 (removed 5 flat checks)
- Same output interface (BTTSBothHalvesResult) — no breaking changes
- UI now shows 3 clean rows instead of 8 tiny grid cells
- Config: { o25Implied: 65, drawProbMax: 25, rollingScoring: 3.0, requiredChecks: 2 }
