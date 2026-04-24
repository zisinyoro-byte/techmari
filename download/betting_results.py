import re

# Raw data from user - directly parsing
matches_raw = [
    ("Partick vs Ross County", "3-1", 52.60, 55.80, "Strong Over", "Strong Over", "Over", "6/7", "4/7", False),
    ("Morton vs Arbroath", "2-1", 45.60, 48.90, "Strong Over", "Strong Over", "Over", "5/7", "3/7", False),
    ("St Johnstone vs Queens Park", "1-1", 68.00, 46.30, "Strong Over", "Strong Over", "Strong Over", "5/7", "4/7", False),
    ("Dumbarton vs Forfar", "2-2", 46.70, 51.10, "Strong Over", "Strong Over", "Neutral", "7/7", "4/7", False),
    ("Wycombe vs Port Vale", "4-0", 53.50, 47.60, "Neutral", "Neutral", "Strong Over", "5/7", "3/7", False),
    ("Colchester vs Walsall", "1-1", 50.90, 52.60, "Strong Over", "Strong Over", "Strong Over", "6/7", "3/7", False),
    ("Salford vs Milton Keynes Dons", "1-0", 54.90, 58.00, "Over", "Over", "Strong Over", "6/7", "3/7", False),
    ("Swindon vs Fleetwood Town", "1-1", 55.10, 56.70, "Strong Over", "Strong Over", "Strong Over", "6/7", "3/7", False),
    ("Eastleigh vs Forest Green", "2-4", 53.90, 57.00, "Strong Over", "Strong Over", "Strong Under", "7/7", "4/7", False),
    ("Solihull vs Altrincham", "1-0", 66.20, 61.70, "Over", "Over", "Strong Under", "7/7", "4/7", False),
    ("Wealdstone vs Hartlepool", "3-0", 63.00, 64.10, "Strong Over", "Strong Over", "Strong Under", "7/7", "4/7", False),
    ("Charlton vs Bristol City", "1-1", 49.80, 54.10, "Strong Over", "Strong Over", "Strong Over", "6/7", "3/7", False),
    ("Colchester vs Oldham", "1-3", 58.00, 56.90, "Strong Over", "Strong Over", "Strong Over", "6/7", "3/7", False),
    ("Oud-Heverlee Leuven vs Standard", "1-3", 54.00, 56.90, "Strong Over", "Strong Over", "Over", "7/7", "7/7", False),
    ("Asteras Tripolis vs Larisa", "3-1", 45.30, 42.80, "Strong Over", "Strong Over", "Over", "3/7", "2/7", False),
    ("Panetolikos vs Atromitos", "1-1", 45.60, 50.40, "Strong Over", "Strong Over", "Over", "4/7", "2/7", False),
    ("Lazio vs Parma", "1-1", 71.00, 55.40, "Strong Over", "Strong Over", "Strong Over", "7/7", "4/7", False),
    ("Arbroath vs St Johnstone", "2-4", 45.30, 45.60, "Strong Over", "Strong Over", "Strong Over", "5/7", "3/7", False),
    ("Edinburgh City vs Spartans", "0-3", 53.50, 57.00, "Strong Over", "Strong Over", "Neutral", "7/7", "4/7", False),
    ("Genclerbirligi vs Goztep", "0-2", 53.00, 56.00, "Strong Over", "Strong Over", "Over", "7/7", "6/7", False),
    ("Trabzonspor vs Galatasaray", "2-1", 65.30, 66.30, "Strong Over", "Strong Over", "Neutral", "7/7", "6/7", False),
    ("Le Havre vs Auxerre", "1-1", 41.40, 47.50, "Strong Over", "Strong Over", "Strong Over", "6/7", "4/7", False),
    ("Monaco vs Marseille", "2-1", 70.40, 67.10, "Strong Over", "Strong Over", "Strong Over", "7/7", "5/7", False),
    ("Inter vs Roma", "5-2", 59.70, 57.10, "Strong Over", "Strong Over", "Strong Over", "7/7", "4/7", False),
    ("Livingston vs Hearts", "2-2", 49.90, 54.40, "Strong Over", "Strong Over", "Strong Over", "7/7", "5/7", False),
    ("Karagumruk vs Rizespor", "2-1", 69.40, 63.20, "Strong Over", "Strong Over", "Over", "7/7", "6/7", False),
    ("Antalyaspor vs Eyupspor", "3-0", 51.70, 53.10, "Strong Over", "Strong Over", "Strong Over", "7/7", "6/7", False),
    ("Blackburn vs West Brom", "0-0", 49.90, 54.10, "Strong Over", "Strong Over", "Strong Over", "6/7", "3/7", False),
    ("Oldham vs Milton Keynes Dons", "1-1", 65.30, 66.10, "Strong Over", "Strong Over", "Strong Over", "6/7", "3/7", False),
    ("Tranmere vs Colchester", "0-1", 49.60, 52.00, "Strong Over", "Strong Over", "Strong Over", "6/7", "3/7", False),
    ("Charleroi vs Antwerp", "2-1", 45.50, 50.70, "Strong Over", "Strong Over", "Strong Over", "7/7", "6/7", True),
    ("Standard vs Westerlo", "1-2", 63.10, 60.50, "Strong Over", "Strong Over", "Over", "7/7", "7/7", True),
    ("Stoke vs Blackburn", "1-1", 49.30, 51.90, "Strong Over", "Strong Over", "Strong Over", "6/7", "3/7", True),
    ("Lincoln vs Leyton Orient", "2-1", 53.00, 53.40, "Strong Over", "Strong Over", "Strong Over", "6/7", "3/7", True),
    ("Burton vs AFC Wimbledon", "1-0", 51.30, 52.70, "Strong Over", "Strong Over", "Strong Over", "6/7", "3/7", True),
    ("Chesterfield vs Tranmere", "1-1", 58.00, 58.50, "Strong Over", "Strong Over", "Strong Over", "6/7", "3/7", True),
    ("Atalanta vs Juventus", "0-1", 51.70, 55.50, "Strong Over", "Strong Over", "Strong Over", "7/7", "4/7", True),
    ("Aberdeen vs Hibernian", "2-0", 57.60, 57.90, "Strong Over", "Strong Over", "Strong Over", "7/7", "5/7", True),
    ("Man United vs Leeds", "1-2", 70.20, 57.70, "Strong Over", "Strong Over", "Strong Over", "7/7", "6/7", True),
    ("Antwerp vs Oud-Heverlee Leuven", "2-0", 62.60, 54.80, "Strong Over", "Strong Over", "Strong Over", "7/7", "7/7", True),
    ("Schalke 04 vs Preußen Münster", "4-1", 66.00, 58.70, "Strong Over", "Strong Over", "Strong Over", "7/7", "7/7", True),
]

print("=" * 90)
print("📊 BETTING RESULTS ANALYSIS - TECHMARI PREDICTIONS")
print("=" * 90)
print()

# Calculate results
btts_wins = 0
btts_losses = 0
o25_wins = 0
o25_losses = 0
o35_wins = 0
o35_losses = 0

strong_btts_wins = 0
strong_btts_losses = 0
strong_o25_wins = 0
strong_o25_losses = 0

grey_results = []

print("MATCH-BY-MATCH RESULTS:")
print("-" * 90)

for match in matches_raw:
    name, score, o25_prob, btts_prob, reg, zscore, xg, btts_check, o35_check, is_strong = match
    
    # Parse score
    parts = score.split('-')
    home = int(parts[0])
    away = int(parts[1])
    total = home + away
    
    # Determine results
    btts_win = home > 0 and away > 0
    o25_win = total > 2.5
    o35_win = total > 3.5
    
    # Grey result check (both teams score in both halves)
    # Based on HT and FT scores from original data
    grey = name in ["Arbroath vs St Johnstone", "Inter vs Roma", "Livingston vs Hearts"]
    
    # Count all matches
    if btts_win:
        btts_wins += 1
    else:
        btts_losses += 1
        
    if o25_win:
        o25_wins += 1
    else:
        o25_losses += 1
        
    if o35_win:
        o35_wins += 1
    else:
        o35_losses += 1
    
    # Count strong bets
    if is_strong:
        if btts_win:
            strong_btts_wins += 1
        else:
            strong_btts_losses += 1
        if o25_win:
            strong_o25_wins += 1
        else:
            strong_o25_losses += 1
    
    # Format output
    btts_icon = "✅" if btts_win else "❌"
    o25_icon = "✅" if o25_win else "❌"
    strong_tag = "⚡ STRONG BET" if is_strong else ""
    grey_tag = "🔥 GREY RESULT" if grey else ""
    
    print(f"{name:<35} {score:<6} BTTS:{btts_icon} O2.5:{o25_icon} Goals:{total} {strong_tag} {grey_tag}")

print()
print("=" * 90)
print("📈 OVERALL PERFORMANCE SUMMARY")
print("=" * 90)
print()

total_matches = len(matches_raw)
total_btts = btts_wins + btts_losses
total_o25 = o25_wins + o25_losses
total_o35 = o35_wins + o35_losses

btts_rate = (btts_wins / total_btts * 100)
o25_rate = (o25_wins / total_o25 * 100)
o35_rate = (o35_wins / total_o35 * 100)

print(f"{'BET TYPE':<30} {'WINS':<8} {'LOSSES':<8} {'WIN RATE':<12} {'PROFITABILITY'}")
print("-" * 90)

# To be profitable: need >52.4% at 1.90 odds, >57.1% at 1.75 odds
def get_verdict(win_rate, avg_odds=1.80):
    break_even = (1/avg_odds) * 100
    if win_rate >= break_even + 5:
        return "✅ STRONGLY PROFITABLE"
    elif win_rate >= break_even:
        return "⚠️ BREAK EVEN / SLIGHT PROFIT"
    else:
        return "❌ LOSING MONEY"

print(f"{'BTTS (Both Teams to Score)':<30} {btts_wins:<8} {btts_losses:<8} {btts_rate:.1f}%{'':<6} {get_verdict(btts_rate, 1.75)}")
print(f"{'Over 2.5 Goals':<30} {o25_wins:<8} {o25_losses:<8} {o25_rate:.1f}%{'':<6} {get_verdict(o25_rate, 1.85)}")
print(f"{'Over 3.5 Goals':<30} {o35_wins:<8} {o35_losses:<8} {o35_rate:.1f}%{'':<6} {get_verdict(o35_rate, 2.10)}")

print()
print("-" * 90)
print("⚡ STRONG BET INDICATOR PERFORMANCE")
print("-" * 90)
print()

total_strong = strong_btts_wins + strong_btts_losses
strong_btts_rate = (strong_btts_wins / total_strong * 100) if total_strong > 0 else 0
strong_o25_rate = (strong_o25_wins / total_strong * 100) if total_strong > 0 else 0

print(f"{'BTTS (Strong Bet only)':<30} {strong_btts_wins:<8} {strong_btts_losses:<8} {strong_btts_rate:.1f}%{'':<6} {get_verdict(strong_btts_rate, 1.75)}")
print(f"{'Over 2.5 (Strong Bet only)':<30} {strong_o25_wins:<8} {strong_o25_losses:<8} {strong_o25_rate:.1f}%{'':<6} {get_verdict(strong_o25_rate, 1.85)}")

print()
print("=" * 90)
print("💰 PROFIT/LOSS CALCULATION (1 unit per bet)")
print("=" * 90)
print()

# BTTS typical odds: 1.75, O2.5 typical odds: 1.85
btts_odds = 1.75
o25_odds = 1.85
o35_odds = 2.10

btts_profit = (btts_wins * btts_odds) - total_btts
o25_profit = (o25_wins * o25_odds) - total_o25
o35_profit = (o35_wins * o35_odds) - total_o35

print("ALL MATCHES:")
print(f"  BTTS:   {btts_wins}W × {btts_odds} - {total_btts} stakes = {btts_profit:+.2f} units")
print(f"  O2.5:   {o25_wins}W × {o25_odds} - {total_o25} stakes = {o25_profit:+.2f} units")
print(f"  O3.5:   {o35_wins}W × {o35_odds} - {total_o35} stakes = {o35_profit:+.2f} units")
print(f"  ─────────────────────────────────────────")
print(f"  TOTAL:  {btts_profit + o25_profit + o35_profit:+.2f} units")

print()

# Strong Bet profit
strong_btts_profit = (strong_btts_wins * btts_odds) - total_strong
strong_o25_profit = (strong_o25_wins * o25_odds) - total_strong

print("STRONG BET ONLY:")
print(f"  BTTS:   {strong_btts_wins}W × {btts_odds} - {total_strong} stakes = {strong_btts_profit:+.2f} units")
print(f"  O2.5:   {strong_o25_wins}W × {o25_odds} - {total_strong} stakes = {strong_o25_profit:+.2f} units")
print(f"  ─────────────────────────────────────────")
print(f"  TOTAL:  {strong_btts_profit + strong_o25_profit:+.2f} units")

print()
print("=" * 90)
print("🎯 KEY FINDINGS & RECOMMENDATIONS")
print("=" * 90)
print()

if btts_rate >= 55:
    print("✅ BTTS predictions are PROFITABLE - continue betting")
elif btts_rate >= 50:
    print("⚠️ BTTS predictions are BREAK EVEN - needs refinement")
else:
    print("❌ BTTS predictions are LOSING - needs major improvement")

if o25_rate >= 55:
    print("✅ Over 2.5 predictions are PROFITABLE - continue betting")
elif o25_rate >= 50:
    print("⚠️ Over 2.5 predictions are BREAK EVEN - needs refinement")
else:
    print("❌ Over 2.5 predictions are LOSING - needs major improvement")

print()

# Strong bet assessment
if total_strong > 0:
    if strong_btts_rate > btts_rate:
        print(f"✅ Strong Bet Indicator improves BTTS win rate: {btts_rate:.1f}% → {strong_btts_rate:.1f}%")
    else:
        print(f"❌ Strong Bet Indicator does NOT improve BTTS win rate: {btts_rate:.1f}% → {strong_btts_rate:.1f}%")
    
    if strong_o25_rate > o25_rate:
        print(f"✅ Strong Bet Indicator improves O2.5 win rate: {o25_rate:.1f}% → {strong_o25_rate:.1f}%")
    else:
        print(f"❌ Strong Bet Indicator does NOT improve O2.5 win rate: {o25_rate:.1f}% → {strong_o25_rate:.1f}%")

print()
print("=" * 90)
print("🔥 GREY RESULTS (Both Teams Score in Both Halves)")
print("=" * 90)
print()
print("Grey Results Found: 3 matches")
print("  1. Arbroath vs St Johnstone (2-4)")
print("  2. Inter vs Roma (5-2)")
print("  3. Livingston vs Hearts (2-2)")
print()
print("Grey Result Pattern: All had Strong Over on all 3 signals + BTTS Checklist ≥5/7")

