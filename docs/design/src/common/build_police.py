"""Add police-report hotspots to map.json from the Milwaukee Police Department's public NIBRS file.

Usage: python -I build_police.py <wibr.csv> [days=30]
Source: data.milwaukee.gov, "NIBRS Crime Data (Current)" (dataset id "wibr"), updated daily.

Only counts per 200 m grid cell are kept, split into person / property / other offenses.
Case numbers, addresses and weapons are never written out.
"""
import csv
import json
import math
import os
import sys
from collections import Counter
from datetime import datetime, timedelta

here = os.path.dirname(os.path.abspath(__file__))
src, days = sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 30

# Same projection as build_map.py
LON0, LON1, LAT0, LAT1 = -87.958, -87.884, 43.022, 43.062
M_PER_UNIT = 4.0
KX = math.cos(math.radians((LAT0 + LAT1) / 2)) * 111320 / M_PER_UNIT
KY = 110950 / M_PER_UNIT
CELL = 50  # map units = 200 m

# NIBRS offense codes grouped the way a coordinator reads them
PERSON = {'09A', '09B', '09C', '100', '11A', '11B', '11C', '11D', '120', '13A', '13B', '13C', '64A', '64B'}
PROPERTY = {'200', '210', '220', '23A', '23B', '23C', '23D', '23E', '23F', '23G', '23H', '240', '250', '26A', '26B', '26C', '26D', '26E', '26F', '26G', '270', '280', '290'}

rows = []
with open(src, newline='', encoding='utf-8-sig') as f:
    for r in csv.DictReader(f):
        try:
            t = datetime.strptime(r['Incident_Date'], '%Y-%m-%d %H:%M:%S')
            lat, lon = float(r['Address_Latitude']), float(r['Address_Longitude'])
        except (ValueError, KeyError, TypeError):
            continue
        rows.append((t, lat, lon, (r.get('Offense_All') or '').split(';')))

now = datetime.now()
valid = [r for r in rows if r[0] <= now]          # the file has a few mistyped future dates
end = max(r[0] for r in valid)
start = end - timedelta(days=days)
cells, kinds, total = {}, Counter(), 0
for t, lat, lon, codes in valid:
    if t < start or not (LON0 <= lon <= LON1 and LAT0 <= lat <= LAT1):
        continue
    x, y = (lon - LON0) * KX, (LAT1 - lat) * KY
    k = (int(x // CELL), int(y // CELL))
    c = cells.setdefault(k, [0, 0, 0])
    kind = 0 if PERSON & set(codes) else 1 if PROPERTY & set(codes) else 2
    c[kind] += 1; kinds[kind] += 1; total += 1

path = os.path.join(here, 'map.json')
with open(path, encoding='utf8') as f:
    d = json.load(f)
d['police'] = {
    'cell': CELL,
    'from': start.strftime('%Y-%m-%d'), 'to': end.strftime('%Y-%m-%d'), 'days': days,
    'total': total, 'person': kinds[0], 'property': kinds[1], 'other': kinds[2],
    'source': 'Milwaukee Police Department, NIBRS Crime Data (Current), data.milwaukee.gov',
    # [cell centre x, cell centre y, person, property, other]
    'cells': [[(i + .5) * CELL, (j + .5) * CELL, *c] for (i, j), c in sorted(cells.items())],
}
with open(path, 'w', encoding='utf8') as f:
    json.dump(d, f, separators=(',', ':'))
print(f'{total} reports {start:%Y-%m-%d}..{end:%Y-%m-%d} in view, {len(cells)} cells, person {kinds[0]} property {kinds[1]} other {kinds[2]}')
