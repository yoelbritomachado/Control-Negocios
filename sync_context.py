import os
from datetime import datetime

context_file = "GEMINI_CONTEXT.md"
source_files = ["app.js", "index.html", "style.css"]

def sync():
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    if not os.path.exists(context_file):
        print(f"Error: {context_file} not found.")
        return

    with open(context_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Update timestamp
    if "Last updated:" in content:
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if "Last updated:" in line:
                lines[i] = f"*Last updated: {now}*"
        content = '\n'.join(lines)
    
    with open(context_file, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print(f"Context synced at {now}. Files ready for Google Drive synchronization.")

if __name__ == "__main__":
    sync()
