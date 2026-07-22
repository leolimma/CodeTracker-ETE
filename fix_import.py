import re
f = 'src/components/PythonEditor.tsx'
with open(f, 'r', encoding='utf-8') as file:
    content = file.read()
if 'import AITutorChat from' not in content:
    content = content.replace('import React', 'import React\nimport AITutorChat from "./AITutorChat";\n', 1)
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)
