# Techmari Results Analyzer - Backups

## Latest Backup

### `page_h2hfilter_v3_20260305_055102.tsx` ⭐ CURRENT
- Date: 2026-03-05 05:51
- Features:
  - 5 tabs: Overview, H2H, Predictions, Models, Summary
  - **Team Selection Syncing** between H2H and Predictions tabs
  - **H2H Scoreline Tracker with Filter** - Filter team pairs by name
  - 4 Statistical Models: Dixon-Coles, Time-Weighted Poisson, Elo Ratings, Bivariate Poisson
  - Summary Tab with Top 2 betting recommendations
  - Shot Conversion Rates (total shots and shots on target)
  - Correct Score predictions from Dixon-Coles model
  - 11 seasons of data (2015-16 to 2025-26)

## Previous Backups

### `page_summary_tab_v1.tsx`
- Main page component with Summary Tab implementation
- Date: 2026-03-03
- Features:
  - 5 tabs: Overview, H2H, Predictions, Models, Summary
  - 4 Statistical Models: Dixon-Coles, Time-Weighted Poisson, Elo Ratings, Bivariate Poisson
  - Summary Tab with Top 2 betting recommendations
  - Shot Conversion Rates (total shots and shots on target)
  - Correct Score predictions from Dixon-Coles model

### `page_20260303_074250.tsx`
- Timestamped backup of the same version as summary_tab_v1

### `api_backup/`
- Backup of all API routes:
  - `/api/soccer/analytics` - League analytics
  - `/api/soccer/fixtures` - Match fixtures
  - `/api/soccer/h2h` - Head-to-head data
  - `/api/soccer/leagues` - Available leagues
  - `/api/soccer/patterns` - Pattern analysis
  - `/api/soccer/predict` - Match predictions
  - `/api/soccer/results` - Match results
  - `/api/soccer/teams` - Team listings

## How to Restore

If you need to restore from backup:

```bash
# Restore the latest version (with team sync)
cp /home/z/my-project/backups/page_teamsync_20260303_100108.tsx /home/z/my-project/src/app/page.tsx

# Restore the summary tab version (no team sync)
cp /home/z/my-project/backups/page_summary_tab_v1.tsx /home/z/my-project/src/app/page.tsx

# Restore API routes if needed
cp -r /home/z/my-project/backups/api_backup/* /home/z/my-project/src/app/api/
```

## Project Info
- 11 seasons of data (2015-16 to 2025-26)
- 22 leagues from football-data.co.uk
- Dixon-Coles model with tau correction for low scores
- Factorial helper for Bivariate Poisson calculations
