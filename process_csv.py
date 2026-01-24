import csv
import json
import os

files = {
    'alm': 'Data csv/diciembre 1 almacen.csv',
    'mch1': 'Data csv/diciembre 1 mch1.csv',
    'mch2': 'Data csv/diciembre 1 mch2.csv'
}

result = {}

for biz_id, filepath in files.items():
    result[biz_id] = []
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        continue
    
    with open(filepath, mode='r', encoding='utf-8') as f:
        # Some CSVs have BOM or weird encoding, but let's try utf-8 first
        reader = csv.DictReader(f)
        for row in reader:
            # Clean up keys (sometimes they have spaces or BOM)
            clean_row = {k.strip(): v.strip() if v else "" for k, v in row.items() if k}
            if clean_row.get('Nombre'):
                result[biz_id].append(clean_row)

print("window.REAL_INVENTORY = " + json.dumps(result, indent=2, ensure_ascii=False) + ";")
