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
        continue
    
    # Trying utf-8-sig first, then utf-8, then latin-1
    encodings = ['utf-8-sig', 'utf-8', 'latin-1']
    content = None
    for enc in encodings:
        try:
            with open(filepath, mode='r', encoding=enc) as f:
                reader = csv.DictReader(f)
                rows = list(reader)
                if rows:
                    content = rows
                    break
        except Exception:
            continue
    
    if content:
        for row in content:
            clean_row = {k.strip(): v.strip() if v else "" for k, v in row.items() if k}
            if clean_row.get('Nombre'):
                result[biz_id].append(clean_row)

new_inv_js = "window.REAL_INVENTORY = " + json.dumps(result, indent=2, ensure_ascii=False) + ";"

with open('data.js', 'r', encoding='utf-8') as f:
    orig = f.read()

start_marker = 'window.REAL_INVENTORY = {'
end_pattern = '/* SISTEMA DE CAJAS FUERTES */'

start_idx = orig.find(start_marker)
end_idx = orig.find(end_pattern)

if start_idx != -1 and end_idx != -1:
    new_content = orig[:start_idx] + new_inv_js + '\n' + orig[end_idx:]
    with open('data.js', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('SUCCESS')
else:
    print(f'ERROR: Markers not found. Start: {start_idx}, End: {end_idx}')
