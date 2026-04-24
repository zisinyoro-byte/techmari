import statistics

# Data: (match_name, ft_score, o25_prob, o35_prob, btts_prob, regression, zscore, xg_signal, btts_checklist, o35_checklist, is_strong_bet)
matches = [
    ("Partick vs Ross County", "3-1", 52.60, 30.50, 55.80, "Strong Over", "Strong Over", "Over", 6, 4, False),
    ("Morton vs Arbroath", "2-1", 45.60, 24.40, 48.90, "Strong Over", "Strong Over", "Over", 5, 3, False),
    ("St Johnstone vs Queens Park", "1-1", 68.00, 46.00, 46.30, "Strong Over", "Strong Over", "Strong Over", 5, 4, False),
    ("Dumbarton vs Forfar", "2-2", 46.70, 25.10, 51.10, "Strong Over", "Strong Over", "Neutral", 7, 4, False),
    ("Wycombe vs Port Vale", "4-0", 53.50, 31.40, 47.60, "Neutral", "Neutral", "Strong Over", 5, 3, False),
    ("Colchester vs Walsall", "1-1", 50.90, 28.80, 52.60, "Strong Over", "Strong Over", "Strong Over", 6, 3, False),
    ("Salford vs Milton Keynes Dons", "1-0", 54.90, 32.50, 58.00, "Over", "Over", "Strong Over", 6, 3, False),
    ("Swindon vs Fleetwood Town", "1-1", 55.10, 32.60, 56.70, "Strong Over", "Strong Over", "Strong Over", 6, 3, False),
    ("Eastleigh vs Forest Green", "2-4", 53.90, 31.50, 57.00, "Strong Over", "Strong Over", "Strong Under", 7, 4, False),
    ("Solihull vs Altrincham", "1-0", 66.20, 44.20, 61.70, "Over", "Over", "Strong Under", 7, 4, False),
    ("Wealdstone vs Hartlepool", "3-0", 63.00, 40.80, 64.10, "Strong Over", "Strong Over", "Strong Under", 7, 4, False),
    ("Charlton vs Bristol City", "1-1", 49.80, 28.00, 54.10, "Strong Over", "Strong Over", "Strong Over", 6, 3, False),
    ("Colchester vs Oldham", "1-3", 58.00, 35.60, 56.90, "Strong Over", "Strong Over", "Strong Over", 6, 3, False),
    ("Oud-Heverlee Leuven vs Standard", "1-3", 54.00, 31.70, 56.90, "Strong Over", "Strong Over", "Over", 7, 7, False),
    ("Asteras Tripolis vs Larisa", "3-1", 45.30, 23.90, 42.80, "Strong Over", "Strong Over", "Over", 3, 2, False),
    ("Panetolikos vs Atromitos", "1-1", 45.60, 24.20, 50.40, "Strong Over", "Strong Over", "Over", 4, 2, False),
    ("Lazio vs Parma", "1-1", 71.00, 49.90, 55.40, "Strong Over", "Strong Over", "Strong Over", 7, 4, False),
    ("Arbroath vs St Johnstone", "2-4", 45.30, 23.90, 45.60, "Strong Over", "Strong Over", "Strong Over", 5, 3, False),
    ("Edinburgh City vs Spartans", "0-3", 53.50, 31.40, 57.00, "Strong Over", "Strong Over", "Neutral", 7, 4, False),
    ("Genclerbirligi vs Goztep", "0-2", 53.00, 31.00, 56.00, "Strong Over", "Strong Over", "Over", 7, 6, False),
    ("Trabzonspor vs Galatasaray", "2-1", 65.30, 43.50, 66.30, "Strong Over", "Strong Over", "Neutral", 7, 6, False),
    ("Le Havre vs Auxerre", "1-1", 41.40, 20.90, 47.50, "Strong Over", "Strong Over", "Strong Over", 6, 4, False),
    ("Monaco vs Marseille", "2-1", 70.40, 49.50, 67.10, "Strong Over", "Strong Over", "Strong Over", 7, 5, False),
    ("Inter vs Roma", "5-2", 59.70, 37.30, 57.10, "Strong Over", "Strong Over", "Strong Over", 7, 4, False),
    ("Livingston vs Hearts", "2-2", 49.90, 28.00, 54.40, "Strong Over", "Strong Over", "Strong Over", 7, 5, False),
    ("Karagumruk vs Rizespor", "2-1", 69.40, 48.30, 63.20, "Strong Over", "Strong Over", "Over", 7, 6, False),
    ("Antalyaspor vs Eyupspor", "3-0", 51.70, 29.60, 53.10, "Strong Over", "Strong Over", "Strong Over", 7, 6, False),
    ("Blackburn vs West Brom", "0-0", 49.90, 28.20, 54.10, "Strong Over", "Strong Over", "Strong Over", 6, 3, False),
    ("Oldham vs Milton Keynes Dons", "1-1", 65.30, 43.10, 66.10, "Strong Over", "Strong Over", "Strong Over", 6, 3, False),
    ("Tranmere vs Colchester", "0-1", 49.60, 27.60, 52.00, "Strong Over", "Strong Over", "Strong Over", 6, 3, False),
    ("Charleroi vs Antwerp", "2-1", 45.50, 24.20, 50.70, "Strong Over", "Strong Over", "Strong Over", 7, 6, True),
    ("Standard vs Westerlo", "1-2", 63.10, 41.10, 60.50, "Strong Over", "Strong Over", "Over", 7, 7, True),
    ("Stoke vs Blackburn", "1-1", 49.30, 27.40, 51.90, "Strong Over", "Strong Over", "Strong Over", 6, 3, True),
    ("Lincoln vs Leyton Orient", "2-1", 53.00, 30.50, 53.40, "Strong Over", "Strong Over", "Strong Over", 6, 3, True),
    ("Burton vs AFC Wimbledon", "1-0", 51.30, 29.10, 52.70, "Strong Over", "Strong Over", "Strong Over", 6, 3, True),
    ("Chesterfield vs Tranmere", "1-1", 58.00, 35.40, 58.50, "Strong Over", "Strong Over", "Strong Over", 6, 3, True),
    ("Atalanta vs Juventus", "0-1", 51.70, 29.50, 55.50, "Strong Over", "Strong Over", "Strong Over", 7, 4, True),
    ("Aberdeen vs Hibernian", "2-0", 57.60, 35.40, 57.90, "Strong Over", "Strong Over", "Strong Over", 7, 5, True),
    ("Man United vs Leeds", "1-2", 70.20, 49.00, 57.70, "Strong Over", "Strong Over", "Strong Over", 7, 6, True),
    ("Antwerp vs Oud-Heverlee Leuven", "2-0", 62.60, 40.50, 54.80, "Strong Over", "Strong Over", "Strong Over", 7, 7, True),
    ("Schalke 04 vs Preußen Münster", "4-1", 66.00, 44.20, 58.70, "Strong Over", "Strong Over", "Strong Over", 7, 7, True),
]

# Separate BTTS wins and losses
btts_wins = []
btts_losses = []

for m in matches:
    score = m[1].split('-')
    home, away = int(score[0]), int(score[1])
    btts_result = home > 0 and away > 0
    
    if btts_result:
        btts_wins.append(m)
    else:
        btts_losses.append(m)

print("=" * 100)
print("🎯 OPTIMAL VALUES FOR BTTS PREDICTION - DETAILED ANALYSIS")
print("=" * 100)
print()
print(f"Total Matches: {len(matches)}")
print(f"BTTS Wins: {len(btts_wins)} ({len(btts_wins)/len(matches)*100:.1f}%)")
print(f"BTTS Losses: {len(btts_losses)} ({len(btts_losses)/len(matches)*100:.1f}%)")
print()

# ============ NUMERICAL COLUMNS ANALYSIS ============
print("=" * 100)
print("📊 NUMERICAL COLUMNS - FINDING OPTIMAL THRESHOLDS")
print("=" * 100)
print()

def analyze_numeric_column(wins, losses, col_idx, col_name):
    """Analyze a numerical column to find optimal threshold"""
    win_vals = [m[col_idx] for m in wins]
    loss_vals = [m[col_idx] for m in losses]
    
    avg_win = statistics.mean(win_vals)
    avg_loss = statistics.mean(loss_vals)
    min_win = min(win_vals)
    max_win = max(win_vals)
    
    # Test different thresholds
    best_threshold = None
    best_win_rate = 0
    best_count = 0
    
    print(f"\n{'─' * 60}")
    print(f"📈 {col_name}")
    print(f"{'─' * 60}")
    
    # Find range to test
    all_vals = sorted(set(win_vals + loss_vals))
    
    results_table = []
    for threshold in range(int(min(all_vals)), int(max(all_vals)) + 2, 2):
        # Count wins and losses above threshold
        above_wins = sum(1 for v in win_vals if v >= threshold)
        above_losses = sum(1 for v in loss_vals if v >= threshold)
        total_above = above_wins + above_losses
        
        if total_above >= 5:  # Minimum sample size
            win_rate = (above_wins / total_above) * 100
            results_table.append((threshold, above_wins, above_losses, total_above, win_rate))
            
            if win_rate > best_win_rate or (win_rate == best_win_rate and total_above > best_count):
                best_win_rate = win_rate
                best_threshold = threshold
                best_count = total_above
    
    print(f"\n   BTTS Wins - Avg: {avg_win:.1f}% | Min: {min_win:.1f}% | Max: {max_win:.1f}%")
    print(f"   BTTS Losses - Avg: {avg_loss:.1f}%")
    print()
    print(f"   Win Rate by Threshold:")
    print(f"   {'Threshold':<12} {'BTTS Wins':<12} {'BTTS Losses':<12} {'Total':<10} {'Win Rate':<10}")
    print(f"   {'-'*56}")
    
    for t, w, l, tot, wr in sorted(results_table, key=lambda x: x[4], reverse=True)[:8]:
        marker = "⭐ BEST" if t == best_threshold else ""
        print(f"   ≥ {t}%{'':<7} {w:<12} {l:<12} {tot:<10} {wr:.1f}% {marker}")
    
    return best_threshold, best_win_rate

# Analyze BTTS Probability
btts_prob_threshold, btts_prob_rate = analyze_numeric_column(btts_wins, btts_losses, 4, "BTTS Probability")

# Analyze O2.5 Probability
o25_threshold, o25_rate = analyze_numeric_column(btts_wins, btts_losses, 2, "Over 2.5 Probability")

# Analyze O3.5 Probability
o35_threshold, o35_rate = analyze_numeric_column(btts_wins, btts_losses, 3, "Over 3.5 Probability")

# ============ CHECKLIST ANALYSIS ============
print()
print("=" * 100)
print("📋 CHECKLIST ANALYSIS - FINDING OPTIMAL SCORES")
print("=" * 100)
print()

def analyze_checklist(wins, losses, col_idx, col_name):
    """Analyze checklist column"""
    win_vals = [m[col_idx] for m in wins]
    loss_vals = [m[col_idx] for m in losses]
    
    avg_win = statistics.mean(win_vals)
    avg_loss = statistics.mean(loss_vals)
    
    best_threshold = None
    best_win_rate = 0
    
    print(f"\n{'─' * 60}")
    print(f"📋 {col_name}")
    print(f"{'─' * 60}")
    print(f"\n   BTTS Wins - Avg Score: {avg_win:.1f}/7")
    print(f"   BTTS Losses - Avg Score: {avg_loss:.1f}/7")
    print()
    print(f"   Win Rate by Minimum Score:")
    print(f"   {'Min Score':<12} {'BTTS Wins':<12} {'BTTS Losses':<12} {'Total':<10} {'Win Rate':<10}")
    print(f"   {'-'*56}")
    
    results = []
    for threshold in range(1, 8):
        above_wins = sum(1 for v in win_vals if v >= threshold)
        above_losses = sum(1 for v in loss_vals if v >= threshold)
        total = above_wins + above_losses
        
        if total >= 3:
            win_rate = (above_wins / total) * 100
            results.append((threshold, above_wins, above_losses, total, win_rate))
            
            if win_rate > best_win_rate:
                best_win_rate = win_rate
                best_threshold = threshold
    
    for t, w, l, tot, wr in sorted(results, key=lambda x: x[4], reverse=True):
        marker = "⭐ BEST" if t == best_threshold else ""
        print(f"   ≥ {t}/7{'':<8} {w:<12} {l:<12} {tot:<10} {wr:.1f}% {marker}")
    
    return best_threshold, best_win_rate

btts_check_threshold, btts_check_rate = analyze_checklist(btts_wins, btts_losses, 7, "BTTS Checklist")
o35_check_threshold, o35_check_rate = analyze_checklist(btts_wins, btts_losses, 8, "Over 3.5 Checklist")

# ============ SIGNAL ANALYSIS ============
print()
print("=" * 100)
print("📡 SIGNAL ANALYSIS - WHICH SIGNALS MATTER FOR BTTS")
print("=" * 100)
print()

def analyze_signal(wins, losses, col_idx, col_name):
    """Analyze categorical signal column"""
    signal_values = ['Strong Over', 'Over', 'Neutral', 'Under', 'Strong Under']
    
    print(f"\n{'─' * 60}")
    print(f"📡 {col_name}")
    print(f"{'─' * 60}")
    print()
    print(f"   {'Signal':<15} {'BTTS Wins':<12} {'BTTS Losses':<12} {'Total':<10} {'Win Rate':<10}")
    print(f"   {'-'*56}")
    
    results = []
    for signal in signal_values:
        sig_wins = sum(1 for m in wins if m[col_idx] == signal)
        sig_losses = sum(1 for m in losses if m[col_idx] == signal)
        total = sig_wins + sig_losses
        
        if total > 0:
            win_rate = (sig_wins / total) * 100
            results.append((signal, sig_wins, sig_losses, total, win_rate))
    
    best_signal = None
    best_rate = 0
    for sig, w, l, tot, wr in sorted(results, key=lambda x: x[4], reverse=True):
        marker = "⭐" if wr > 68 else ""
        if wr > best_rate and tot >= 3:
            best_rate = wr
            best_signal = sig
        print(f"   {sig:<15} {w:<12} {l:<12} {tot:<10} {wr:.1f}% {marker}")
    
    return best_signal, best_rate

reg_best, reg_rate = analyze_signal(btts_wins, btts_losses, 5, "Regression Signal")
zscore_best, zscore_rate = analyze_signal(btts_wins, btts_losses, 6, "Z-Score Signal")
xg_best, xg_rate = analyze_signal(btts_wins, btts_losses, 7 - 1, "xG Signal")  # Fixed column index

# Actually let me fix the column indices
print()
print("Re-analyzing with correct indices...")
print()

# Correct column indices: 5=Regression, 6=ZScore, 7=xG (but we used 7 for BTTS checklist)
# Let me recalculate
def analyze_signal_correct(wins, losses, col_idx, col_name):
    """Analyze categorical signal column"""
    signal_values = ['Strong Over', 'Over', 'Neutral', 'Under', 'Strong Under']
    
    print(f"\n{'─' * 60}")
    print(f"📡 {col_name}")
    print(f"{'─' * 60}")
    print()
    print(f"   {'Signal':<15} {'BTTS Wins':<12} {'BTTS Losses':<12} {'Total':<10} {'Win Rate':<10}")
    print(f"   {'-'*56}")
    
    results = []
    for signal in signal_values:
        sig_wins = sum(1 for m in wins if m[col_idx] == signal)
        sig_losses = sum(1 for m in losses if m[col_idx] == signal)
        total = sig_wins + sig_losses
        
        if total > 0:
            win_rate = (sig_wins / total) * 100
            results.append((signal, sig_wins, sig_losses, total, win_rate))
    
    best_signal = None
    best_rate = 0
    for sig, w, l, tot, wr in sorted(results, key=lambda x: x[4], reverse=True):
        marker = "⭐" if wr >= 68 else ""
        if wr > best_rate and tot >= 3:
            best_rate = wr
            best_signal = sig
        print(f"   {sig:<15} {w:<12} {l:<12} {tot:<10} {wr:.1f}% {marker}")
    
    return best_signal, best_rate

# Column indices: 5=Regression, 6=Z-Score, (let me check xG)
# Looking at data structure: (name, score, o25, o35, btts_prob, reg, zscore, xg, btts_check, o35_check, is_strong)
# So xG is index 7
reg_best, reg_rate = analyze_signal_correct(btts_wins, btts_losses, 5, "Regression Signal")
zscore_best, zscore_rate = analyze_signal_correct(btts_wins, btts_losses, 6, "Z-Score Signal")
xg_best, xg_rate = analyze_signal_correct(btts_wins, btts_losses, 7, "xG Signal")

# ============ FINAL OPTIMAL VALUES SUMMARY ============
print()
print("=" * 100)
print("⭐ OPTIMAL VALUES FOR BTTS PREDICTION - FINAL SUMMARY")
print("=" * 100)
print()

print("┌─────────────────────────────────────┬────────────────────┬─────────────────┐")
print("│ Column                              │ Optimal Value      │ Win Rate        │")
print("├─────────────────────────────────────┼────────────────────┼─────────────────┤")
print(f"│ BTTS Probability                    │ ≥ {btts_prob_threshold}%             │ {btts_prob_rate:.1f}%            │")
print(f"│ Over 2.5 Probability                │ ≥ {o25_threshold}%             │ {o25_rate:.1f}%            │")
print(f"│ Over 3.5 Probability                │ ≥ {o35_threshold}%             │ {o35_rate:.1f}%            │")
print(f"│ BTTS Checklist                      │ ≥ {btts_check_threshold}/7            │ {btts_check_rate:.1f}%            │")
print(f"│ Over 3.5 Checklist                  │ ≥ {o35_check_threshold}/7            │ {o35_check_rate:.1f}%            │")
print(f"│ Regression Signal                   │ {reg_best:<18} │ {reg_rate:.1f}%            │")
print(f"│ Z-Score Signal                      │ {zscore_best:<18} │ {zscore_rate:.1f}%            │")
print(f"│ xG Signal                           │ {xg_best:<18} │ {xg_rate:.1f}%            │")
print("└─────────────────────────────────────┴────────────────────┴─────────────────┘")

