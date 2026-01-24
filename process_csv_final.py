import csv
import json
import os

files_map = {
    "alm": "Data csv/diciembre 1 almacen.csv",
    "mch1": "Data csv/diciembre 1 mch1.csv",
    "mch2": "Data csv/diciembre 1 mch2.csv"
}

output_data = {}

for key, relative_path in files_map.items():
    if not os.path.exists(relative_path):
        print(f"Warning: File not found {relative_path}")
        continue
    
    print(f"Processing {key} from {relative_path}...")
    items = []
    try:
        with open(relative_path, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Clean keys just in case
                clean_row = {k.strip(): v for k, v in row.items() if k}
                
                # Check for critical fields
                if 'Nombre' not in clean_row or not clean_row['Nombre'].strip():
                    continue

                items.append(clean_row)
        output_data[key] = items
        print(f"  -> {len(items)} items loaded.")
    except Exception as e:
        print(f"Error processing {relative_path}: {e}")

# Generate JS file
js_content = f"window.REAL_INVENTORY = {json.dumps(output_data, indent=2, ensure_ascii=False)};"

with open("js/initial_data.js", "w", encoding="utf-8") as f:
    f.write(js_content)

print("Done. Created js/initial_data.js")
