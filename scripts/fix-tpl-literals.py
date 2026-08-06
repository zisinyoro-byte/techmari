#!/usr/bin/env python3
"""Fix Turbopack-incompatible multi-line template literals in className props.

Uses a character-level parser with while-loop for proper ${} nesting.
"""

import re

filepath = '/home/z/my-project/src/components/tabs/PredictionsTab.tsx'

with open(filepath, 'r') as f:
    lines = f.readlines()

def find_closing_backtick(lines, start_line, start_col):
    """Find the closing backtick of a template literal, properly tracking ${} depth."""
    in_expr = False
    depth = 0
    in_sq = False
    in_dq = False
    
    li = start_line
    col = start_col
    
    while li < len(lines):
        line = lines[li].rstrip()
        while col < len(line):
            ch = line[col]
            
            if in_expr:
                if in_sq:
                    if ch == "'" and (col == 0 or line[col-1] != '\\'):
                        in_sq = False
                elif in_dq:
                    if ch == '"' and (col == 0 or line[col-1] != '\\'):
                        in_dq = False
                elif ch == "'":
                    in_sq = True
                elif ch == '"':
                    in_dq = True
                elif ch == '{':
                    depth += 1
                elif ch == '}':
                    if depth == 0:
                        in_expr = False
                    else:
                        depth -= 1
            else:
                # In template literal text mode
                if ch == '`':
                    return li, col
                elif ch == '$' and col + 1 < len(line) and line[col + 1] == '{':
                    in_expr = True
                    depth = 0
                    col += 2  # skip past ${
                    continue
            col += 1
        li += 1
        col = 0
    
    return None, None


result = []
i = 0
count = 0

while i < len(lines):
    line = lines[i].rstrip()
    
    # Look for className={` where the template literal doesn't close on same line
    match = re.search(r'className=\{`', line)
    if match:
        bt_pos = match.end() - 1  # position of the backtick
        
        # Check if closing backtick is on the same line
        rest_of_line = line[bt_pos + 1:]
        if '`' not in rest_of_line:
            # Multi-line template literal
            end_line, end_col = find_closing_backtick(lines, i, bt_pos + 1)
            
            if end_line is not None and end_line > i:
                # Collect template content
                before = line[:bt_pos + 1]  # className={`
                
                first_rest = line[bt_pos + 1:]
                parts = [first_rest]
                for mid in range(i + 1, end_line):
                    parts.append(lines[mid].rstrip())
                parts.append(lines[end_line].rstrip()[:end_col])
                
                template_content = '\n'.join(parts)
                after = lines[end_line].rstrip()[end_col + 1:]  # after closing `
                
                # Collapse: replace newlines+whitespace with single space
                collapsed = re.sub(r'\s*\n\s*', ' ', template_content)
                collapsed = re.sub(r'  +', ' ', collapsed)
                collapsed = collapsed.strip()
                
                new_line = before + collapsed + '`' + after
                result.append(new_line)
                count += 1
                i = end_line + 1
                continue
    
    result.append(line)
    i += 1

print(f'Collapsed {count} multi-line template literals in className')

with open(filepath, 'w') as f:
    f.write('\n'.join(result) + '\n')
