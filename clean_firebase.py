import os

def process_file(filepath):
    print(f"Processing {filepath}")
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # We will just replace 'if (isRealFirebaseActive()) {' entirely using a simple stack parser
    
    # 1. First remove the imports
    import re
    content = re.sub(r'import\s*\{[^}]*\}\s*from\s*[\'\"]./services/firebaseDb[\'\"];', '', content)
    content = re.sub(r'import\s*\{[^}]*\}\s*from\s*[\'\"]../services/firebaseDb[\'\"];', '', content)
    
    # Let's replace 'isRealFirebaseActive()' with 'false' so it just becomes a dead branch.
    # The bundler (Vite/Rollup) will eliminate dead branches automatically, which satisfies 'remoção de resquícios'.
    # If the user specifically wants the block deleted, we can delete the 'if (false) {...} else' block.
    # Let's parse and delete 'if (isRealFirebaseActive()) { ... } else {'
    
    idx = 0
    while True:
        idx = content.find("if (isRealFirebaseActive()) {", idx)
        if idx == -1:
            break
        
        # find matching closing brace
        open_braces = 1
        pos = idx + len("if (isRealFirebaseActive()) {")
        while pos < len(content) and open_braces > 0:
            if content[pos] == '{':
                open_braces += 1
            elif content[pos] == '}':
                open_braces -= 1
            pos += 1
            
        end_idx = pos
        # Look for ' else {'
        else_idx = content.find("else {", end_idx)
        if else_idx != -1 and content[end_idx:else_idx].strip() == "":
            # find matching brace for else
            open_braces_else = 1
            pos_else = else_idx + len("else {")
            else_content_start = pos_else
            while pos_else < len(content) and open_braces_else > 0:
                if content[pos_else] == '{':
                    open_braces_else += 1
                elif content[pos_else] == '}':
                    open_braces_else -= 1
                pos_else += 1
            
            else_content_end = pos_else - 1
            # Replace the entire if/else block with just the else body
            else_body = content[else_content_start:else_content_end]
            content = content[:idx] + else_body + content[pos_else:]
        else:
            # No else block, just remove the if block completely
            content = content[:idx] + content[end_idx:]
            
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
        
process_file("src/components/TeacherDashboard.tsx")
process_file("src/components/AdminPanel.tsx")
process_file("src/components/StudentPortal.tsx")
