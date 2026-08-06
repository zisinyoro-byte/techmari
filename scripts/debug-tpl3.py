#!/usr/bin/env python3
"""Verify the while-loop parser for the BTTS-BH check."""

with open('/home/z/my-project/src/components/tabs/PredictionsTab.tsx') as f:
    lines = f.readlines()

# Find the BTTS-BH check className multi-line template
for i, line in enumerate(lines):
    if 'p-2 rounded flex items-center justify-between' in line and 'className={' in line:
        import re
        match = re.search(r'className=\{`', line)
        bt_pos = match.end() - 1
        print(f'Opening backtick at line {i+1} col {bt_pos}')
        
        # Use the WHILE-LOOP parser (same as fix-tpl-literals.py)
        in_expr = False
        depth = 0
        in_sq = False
        in_dq = False
        li = i
        col = bt_pos + 1
        found = False
        
        while li < len(lines):
            l = lines[li].rstrip()
            while col < len(l):
                ch = l[col]
                if in_expr:
                    if in_sq:
                        if ch == "'" and (col == 0 or l[col-1] != '\\'):
                            in_sq = False
                            print(f'    L{li+1}:{col} CLOSE single-quote')
                    elif in_dq:
                        if ch == '"' and (col == 0 or l[col-1] != '\\'):
                            in_dq = False
                            print(f'    L{li+1}:{col} CLOSE double-quote')
                    elif ch == "'":
                        in_sq = True
                        print(f'    L{li+1}:{col} OPEN single-quote')
                    elif ch == '"':
                        in_dq = True
                        print(f'    L{li+1}:{col} OPEN double-quote')
                    elif ch == '{':
                        depth += 1
                        print(f'    L{li+1}:{col} OPEN brace depth={depth}')
                    elif ch == '}':
                        if depth == 0:
                            print(f'    L{li+1}:{col} CLOSE expr (depth was 0)')
                            in_expr = False
                        else:
                            depth -= 1
                            print(f'    L{li+1}:{col} CLOSE brace depth={depth}')
                else:
                    if ch == '`':
                        print(f'  CLOSING BACKTICK at line {li+1} col {col}')
                        print(f'  Context: ...{l[max(0,col-30):col+30]}...')
                        found = True
                        break
                    elif ch == '$' and col + 1 < len(l) and l[col + 1] == '{':
                        print(f'  OPEN ${{ at line {li+1} col {col}')
                        in_expr = True
                        depth = 0
                        col += 2  # skip past ${
                        continue
                col += 1
            if found:
                break
            print(f'  End of line {li+1}: in_expr={in_expr} depth={depth}')
            li += 1
            col = 0
        
        if not found:
            print(f'  NOT found! in_expr={in_expr} depth={depth}')
        break
