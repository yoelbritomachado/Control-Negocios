file_path = 'app.js'
try:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check for null bytes
    if '\0' in content:
        print("Found NULL bytes in file!")
    
    # Count braces
    open_braces = content.count('{')
    close_braces = content.count('}')
    print(f"Braces: {{: {open_braces}, }}: {close_braces}")
    if open_braces != close_braces:
        print("Mismatched braces!")
    
    # Check for non-ascii and print their positions
    for i, c in enumerate(content):
        if ord(c) > 127:
            pass # this is expected for Spanish

    print("Scan complete.")

except Exception as e:
    print(f"Error reading file: {e}")
