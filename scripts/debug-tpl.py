#!/usr/bin/env python3
"""Debug template literal parsing for the BTTS-BH breakdown check."""

with open('/home/z/my-project/src/components/tabs/PredictionsTab.tsx') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'p-2 rounded flex items-center justify-between' in line and 'className={' in line:
        print(f'Line {i+1}: {line.rstrip()[:120]}')
        for j in range(i+1, min(i+6, len(lines))):
            print(f'Line {j+1}: {lines[j].rstrip()[:120]}')
        print()
        print(f'--- Tracing template literal from line {i+1} ---')
        bt_pos = line.index('`')
        print(f'Opening backtick at col {bt_pos}')

        in_expr = False
        depth = 0
        in_sq = False
        in_dq = False
        found = False
        for li in range(i, min(i+10, len(lines))):
            l = lines[li].rstrip()
            col_start = bt_pos+1 if li == i else 0
            for ci in range(col_start, len(l)):
                ch = l[ci]
                if in_expr:
                    if in_sq:
                        if ch == "'" and (ci == 0 or l[ci-1] != '\\'):
                            in_sq = False
                    elif in_dq:
                        if ch == '"' and (ci == 0 or l[ci-1] != '\\'):
                            in_dq = False
                    elif ch == "'":
                        in_sq = True
                    elif ch == '"':
                        in_dq = True
                    elif ch == '{':
                        depth += 1
                    elif ch == '}':
                        if depth == 0:
                            print(f'  Closing expr at line {li+1} col {ci}')
                            in_expr = False
                        else:
                            depth -= 1
                else:
                    if ch == '`':
                        print(f'  CLOSING BACKTICK at line {li+1} col {ci}')
                        print(f'  Context: ...{l[max(0,ci-30):ci+30]}...')
                        found = True
                        break
                    elif ch == '$' and ci+1 < len(l) and l[ci+1] == '{':
                        print(f'  Opening expr at line {li+1} col {ci}')
                        in_expr = True
                        depth = 0
                        ci += 1  # skip {
            if found:
                break
        if not found:
            print('  Did NOT find closing backtick in 10 lines!')
        break
