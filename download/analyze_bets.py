import re

# Raw data
data = """
Scotland - Championship	Partick	Ross County	3-1	3-1	52.60	30.50	55.80	Strong Over	Strong Over	Over	6 of 7	4 of 7	BTTS WIN, O2.5 WIN
Scotland - Championship	Morton	Arbroath	2-1	2-1	45.60	24.40	48.90	Strong Over	Strong Over	Over	5 of 7	3 of 7	BTTS NO, O2.5 YES
Scotland - Championship	St Johnstone	Queens Park	0-1	1-1	68.00	46.00	46.30	Strong Over	Strong Over	Strong Over	5 of 7	4 of 7	BTTS NO, O2.5 NO
Scotland - League Two	Dumbarton	Forfar	0-2	2-2	46.70	25.10	51.10	Strong Over	Strong Over	Neutral	7 of 7	4 of 7	BTTS WIN, O2.5 WIN
England - League One	Wycombe	Port Vale	1-0	4-0	53.50	31.40	47.60	Neutral	Neutral	Strong Over	5 of 7	3 of 7	BTTS NO, O2.5 WIN
England - League Two	Colchester	Walsall	0-0	1-1	50.90	28.80	52.60	Strong Over	Strong Over	Strong Over	6 of 7	3 of 7	BTTS WIN, O2.5 NO
England - League Two	Salford	Milton Keynes Dons	0-0	1-0	54.90	32.50	58.00	Over	Over	Strong Over	6 of 7	3 of 7	BTTS NO, O2.5 NO
England - League Two	Swindon	Fleetwood Town	1-0	1-1	55.10	32.60	56.70	Strong Over	Strong Over	Strong Over	6 of 7	3 of 7	BTTS WIN, O2.5 NO
England - National League	Eastleigh	Forest Green	2-1	2-4	53.90	31.50	57.00	Strong Over	Strong Over	Strong Under	7 of 7	4 of 7	BTTS WIN, O2.5 WIN
England - National League	Solihull	Altrincham	1-0	1-0	66.20	44.20	61.70	Over	Over	Strong Under	7 of 7	4 of 7	BTTS NO, O2.5 NO
England - National League	Wealdstone	Hartlepool	1-0	3-0	63.00	40.80	64.10	Strong Over	Strong Over	Strong Under	7 of 7	4 of 7	BTTS NO, O2.5 WIN
England - Championship	Charlton	Bristol City	0-0	1-1	49.80	28.00	54.10	Strong Over	Strong Over	Strong Over	6 of 7	3 of 7	BTTS WIN, O2.5 NO
England - League Two	Colchester	Oldham	0-1	1-3	58.00	35.60	56.90	Strong Over	Strong Over	Strong Over	6 of 7	3 of 7	BTTS WIN, O2.5 WIN
Belgium - Pro League	Oud-Heverlee Leuven	Standard	0-0	1-3	54.00	31.70	56.90	Strong Over	Strong Over	Over	7 of 7	7 of 7	BTTS WIN, O2.5 WIN
Greece - Super League	Asteras Tripolis	Larisa	1-0	3-1	45.30	23.90	42.80	Strong Over	Strong Over	Over	3 of 7	2 of 7	BTTS WIN, O2.5 WIN
Greece - Super League	Panetolikos	Atromitos	1-0	1-1	45.60	24.20	50.40	Strong Over	Strong Over	Over	4 of 7	2 of 7	BTTS WIN, O2.5 NO
Italy - Serie A	Lazio	Parma	0-1	1-1	71.00	49.90	55.40	Strong Over	Strong Over	Strong Over	7 of 7	4 of 7	BTTS WIN, O2.5 NO
Scotland - Championship	Arbroath	St Johnstone	1-1	2-4	45.30	23.90	45.60	Strong Over	Strong Over	Strong Over	5 of 7	3 of 7	BTTS WIN, O2.5 WIN - GREY RESULT
Scotland - League Two	Edinburgh City	Spartans	0-0	0-3	53.50	31.40	57.00	Strong Over	Strong Over	Neutral	7 of 7	4 of 7	BTTS NO, O2.5 NO
Turkey - Süper Lig	Genclerbirligi	Goztep	0-1	0-2	53.00	31.00	56.00	Strong Over	Strong Over	Over	7 of 7	6 of 7	BTTS NO, O2.5 NO
Turkey - Süper Lig	Trabzonspor	Galatasaray	1-0	2-1	65.30	43.50	66.30	Strong Over	Strong Over	Neutral	7 of 7	6 of 7	BTTS NO, O2.5 NO
France - Ligue 1	Le Havre	Auxerre	1-1	1-1	41.40	20.90	47.50	Strong Over	Strong Over	Strong Over	6 of 7	4 of 7	BTTS WIN, O2.5 NO
France - Ligue 2	Monaco	Marseille	0-0	2-1	70.40	49.50	67.10	Strong Over	Strong Over	Strong Over	7 of 7	5 of 7	BTTS NO, O2.5 NO
Italy - Serie A	Inter	Roma	2-1	5-2	59.70	37.30	57.10	Strong Over	Strong Over	Strong Over	7 of 7	4 of 7	BTTS WIN, O2.5 WIN - GREY RESULT
Scotland - Premiership	Livingston	Hearts	1-1	2-2	49.90	28.00	54.40	Strong Over	Strong Over	Strong Over	7 of 7	5 of 7	BTTS WIN, O2.5 WIN - GREY RESULT
Turkey - Süper Lig	Karagumruk	Rizespor	1-0	2-1	69.40	48.30	63.20	Strong Over	Strong Over	Over	7 of 7	6 of 7	BTTS NO, O2.5 NO
Turkey - Süper Lig	Antalyaspor	Eyupspor	0-0	3-0	51.70	29.60	53.10	Strong Over	Strong Over	Strong Over	7 of 7	6 of 7	BTTS NO, O2.5 WIN
England - Championship	Blackburn	West Brom	0-0	0-0	49.90	28.20	54.10	Strong Over	Strong Over	Strong Over	6 of 7	3 of 7	BTTS NO, O2.5 NO
England - League Two	Oldham	Milton Keynes Dons	0-1	1-1	65.30	43.10	66.10	Strong Over	Strong Over	Strong Over	6 of 7	3 of 7	BTTS WIN, O2.5 NO
England - League Two	Tranmere	Colchester	0-0	0-1	49.60	27.60	52.00	Strong Over	Strong Over	Strong Over	6 of 7	3 of 7	BTTS NO, O2.5 NO
Belgium - Pro League	Charleroi	Antwerp	1-0	2-1	45.50	24.20	50.70	Strong Over	Strong Over	Strong Over	7 of 7	6 of 7	STRONG BET	5/7 checks	BTTS NO, O2.5 NO
Belgium - Pro League	Standard	Westerlo	0-1	1-2	63.10	41.10	60.50	Strong Over	Strong Over	Over	7 of 7	7 of 7	STRONG BET	4/7 checks	BTTS WIN, O2.5 WIN
England - Championship	Stoke	Blackburn	0-1	1-1	49.30	27.40	51.90	Strong Over	Strong Over	Strong Over	6 of 7	3 of 7	STRONG BET	5/7 checks	BTTS WIN, O2.5 NO
England - League One	Lincoln	Leyton Orient	2-0	2-1	53.00	30.50	53.40	Strong Over	Strong Over	Strong Over	6 of 7	3 of 7	STRONG BET	5/7 checks	BTTS NO, O2.5 NO
England - League One	Burton	AFC Wimbledon	0-0	1-0	51.30	29.10	52.70	Strong Over	Strong Over	Strong Over	6 of 7	3 of 7	STRONG BET	5/7 checks	BTTS NO, O2.5 NO
England - League Two	Chesterfield	Tranmere	1-0	1-1	58.00	35.40	58.50	Strong Over	Strong Over	Strong Over	6 of 7	3 of 7	STRONG BET	5/7 checks	BTTS WIN, O2.5 NO
Italy - Serie A	Atalanta	Juventus	0-0	0-1	51.70	29.50	55.50	Strong Over	Strong Over	Strong Over	7 of 7	4 of 7	STRONG BET	5/7 checks	BTTS NO, O2.5 NO
Scotland - Premiership	Aberdeen	Hibernian	1-0	2-0	57.60	35.40	57.90	Strong Over	Strong Over	Strong Over	7 of 7	5 of 7	STRONG BET	5/7 checks	BTTS NO, O2.5 NO
England - Premier League	Man United	Leeds	0-2	1-2	70.20	49.00	57.70	Strong Over	Strong Over	Strong Over	7 of 7	6 of 7	STRONG BET	5/7 checks	BTTS WIN, O2.5 WIN
Belgium - Pro League	Antwerp	Oud-Heverlee Leuven	0-0	2-0	62.60	40.50	54.80	Strong Over	Strong Over	Strong Over	7 of 7	7 of 7	STRONG BET	5/7 checks	BTTS NO, O2.5 NO
2. Bundesliga	Schalke 04	Preußen Münster	2-0	4-1	66.00	44.20	58.70	Strong Over	Strong Over	Strong Over	7 of 7	7 of 7	STRONG BET	5/7 checks	BTTS WIN, O2.5 WIN
"""

# Parse and analyze
matches = []
lines = data.strip().split('\n')

btts_wins = 0
btts_losses = 0
o25_wins = 0
o25_losses = 0
strong_bet_btts_wins = 0
strong_bet_btts_losses = 0
strong_bet_o25_wins = 0
strong_bet_o25_losses = 0

print("=" * 80)
print("MATCH-BY-MATCH ANALYSIS")
print("=" * 80)

for line in lines:
    parts = line.split('\t')
    if len(parts) >= 18:
        league = parts[0].strip()
        team_a = parts[1].strip()
        team_b = parts[2].strip()
        ht_score = parts[16].strip()
        ft_score = parts[17].strip()
        o25_prob = float(parts[6].strip()) if parts[6].strip() else 0
        btts_prob = float(parts[10].strip()) if parts[10].strip() else 0
        regression = parts[11].strip()
        zscore = parts[12].strip()
        xg_signal = parts[13].strip()
        btts_checklist = parts[14].strip()
        o35_checklist = parts[15].strip()
        strong_bet = parts[16].strip() if len(parts) > 16 else ""
        
        # Parse final score
        try:
            ft_parts = ft_score.split('-')
            home_goals = int(ft_parts[0])
            away_goals = int(ft_parts[1])
            total_goals = home_goals + away_goals
            btts_result = "WIN" if home_goals > 0 and away_goals > 0 else "LOSS"
            o25_result = "WIN" if total_goals > 2.5 else "LOSS"
        except:
            continue
        
        # Check if strong bet
        is_strong_bet = "STRONG BET" in line
        
        # Count results
        if btts_result == "WIN":
            btts_wins += 1
            if is_strong_bet:
                strong_bet_btts_wins += 1
        else:
            btts_losses += 1
            if is_strong_bet:
                strong_bet_btts_losses += 1
                
        if o25_result == "WIN":
            o25_wins += 1
            if is_strong_bet:
                strong_bet_o25_wins += 1
        else:
            o25_losses += 1
            if is_strong_bet:
                strong_bet_o25_losses += 1
        
        print(f"{team_a} vs {team_b}: {ft_score}")
        print(f"  BTTS: {btts_result} | O2.5: {o25_result} | Total Goals: {total_goals}")
        if is_strong_bet:
            print(f"  ⚡ STRONG BET")
        print()

print("=" * 80)
print("OVERALL RESULTS SUMMARY")
print("=" * 80)
print()
print(f"{'BET TYPE':<25} {'WINS':<10} {'LOSSES':<10} {'WIN RATE':<15} {'VERDICT'}")
print("-" * 80)

total_btts = btts_wins + btts_losses
total_o25 = o25_wins + o25_losses

btts_rate = (btts_wins / total_btts * 100) if total_btts > 0 else 0
o25_rate = (o25_wins / total_o25 * 100) if total_o25 > 0 else 0

# To break even in betting, you need approximately 52-55% win rate at typical odds
btts_verdict = "✅ PROFITABLE" if btts_rate >= 55 else "❌ LOSING" if btts_rate < 50 else "⚠️ BREAK EVEN"
o25_verdict = "✅ PROFITABLE" if o25_rate >= 55 else "❌ LOSING" if o25_rate < 50 else "⚠️ BREAK EVEN"

print(f"{'BTTS (All matches)':<25} {btts_wins:<10} {btts_losses:<10} {btts_rate:.1f}%{'':<10} {btts_verdict}")
print(f"{'Over 2.5 (All matches)':<25} {o25_wins:<10} {o25_losses:<10} {o25_rate:.1f}%{'':<10} {o25_verdict}")
print()

# Strong Bet results
print("-" * 80)
print("STRONG BET INDICATOR RESULTS")
print("-" * 80)
print()

total_strong_btts = strong_bet_btts_wins + strong_bet_btts_losses
total_strong_o25 = strong_bet_o25_wins + strong_bet_o25_losses

strong_btts_rate = (strong_bet_btts_wins / total_strong_btts * 100) if total_strong_btts > 0 else 0
strong_o25_rate = (strong_bet_o25_wins / total_strong_o25 * 100) if total_strong_o25 > 0 else 0

strong_btts_verdict = "✅ PROFITABLE" if strong_btts_rate >= 55 else "❌ LOSING" if strong_btts_rate < 50 else "⚠️ BREAK EVEN"
strong_o25_verdict = "✅ PROFITABLE" if strong_o25_rate >= 55 else "❌ LOSING" if strong_o25_rate < 50 else "⚠️ BREAK EVEN"

print(f"{'BTTS (Strong Bet)':<25} {strong_bet_btts_wins:<10} {strong_bet_btts_losses:<10} {strong_btts_rate:.1f}%{'':<10} {strong_btts_verdict}")
print(f"{'Over 2.5 (Strong Bet)':<25} {strong_bet_o25_wins:<10} {strong_bet_o25_losses:<10} {strong_o25_rate:.1f}%{'':<10} {strong_o25_verdict}")
print()

# Profit calculation (assuming average odds)
print("=" * 80)
print("PROFIT/LOSS CALCULATION (Assuming 1 unit per bet)")
print("=" * 80)
print()

# Typical BTTS odds: ~1.75, O2.5 odds: ~1.85
btts_avg_odds = 1.75
o25_avg_odds = 1.85

btts_profit = (btts_wins * btts_avg_odds) - total_btts
o25_profit = (o25_wins * o25_avg_odds) - total_o25

print(f"BTTS: {btts_wins} wins × {btts_avg_odds} odds - {total_btts} stakes = {btts_profit:+.2f} units")
print(f"Over 2.5: {o25_wins} wins × {o25_avg_odds} odds - {total_o25} stakes = {o25_profit:+.2f} units")
print(f"Combined: {btts_profit + o25_profit:+.2f} units")
print()

# Strong Bet profit
strong_btts_profit = (strong_bet_btts_wins * btts_avg_odds) - total_strong_btts
strong_o25_profit = (strong_bet_o25_wins * o25_avg_odds) - total_strong_o25

print("STRONG BET PROFIT:")
print(f"BTTS: {strong_bet_btts_wins} wins × {btts_avg_odds} - {total_strong_btts} stakes = {strong_btts_profit:+.2f} units")
print(f"Over 2.5: {strong_bet_o25_wins} wins × {o25_avg_odds} - {total_strong_o25} stakes = {strong_o25_profit:+.2f} units")
print(f"Combined: {strong_btts_profit + strong_o25_profit:+.2f} units")

