#!/usr/bin/env python3
"""Debug template literal parsing - verbose trace."""

with open('/home/z/my-project/src/components/tabs/PredictionsTab.tsx') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'p-2 rounded flex items-center justify-between' in line and 'className={' in line:
        bt_pos = line.index('`')
        print(f'Opening backtick at line {i+1} col {bt_pos}')

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
                        print(f'    L{li+1}:{ci} OPEN single-quote')
                    elif ch == '"':
                        in_dq = True
                        print(f'    L{li+1}:{ci} OPEN double-quote')
                    elif ch == '{':
                        depth += 1
                        print(f'    L{li+1}:{ci} OPEN brace depth={depth}')
                    elif ch == '}':
                        if depth == 0:
                            print(f'    L{li+1}:{ci} CLOSE expr (depth was 0)')
                            in_expr = False
                        else:
                            depth -= 1
                            print(f'    L{li+1}:{ci} CLOSE brace depth={depth}')
                else:
                    if ch == '`':
                        print(f'  CLOSING BACKTICK at line {li+1} col {ci}')
                        print(f'  Context: ...{l[max(0,ci-30):ci+30]}...')
                        found = True
                        break
                    elif ch == '$' and ci+1 < len(l) and l[ci+1] == '{':
                        print(f'  OPEN expr at line {li+1} col {ci}')
                        in_expr = True
                        depth = 0
                        ci += 1
            if found:
                break
            print(f'  End of line {li+1}: in_expr={in_expr} depth={depth} sq={in_sq} dq={in_dq}')
        
        if not found:
            print(f'  NOT found after 10 lines! in_expr={in_expr} depth={depth} sq={in_sq} dq={in_dq}')
        break
