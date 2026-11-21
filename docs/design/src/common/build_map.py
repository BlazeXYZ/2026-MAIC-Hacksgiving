"""Build an SVG basemap + overlay coordinates for the hub mockup from OpenStreetMap JSON.

Usage: python -I build_map.py <osm_dir> <out_dir>
"""
import heapq
import itertools
import json
import math
import os
import random
import sys

OSM, OUT = sys.argv[1], sys.argv[2]
LON0, LON1, LAT0, LAT1 = -87.958, -87.884, 43.022, 43.062   # view: west, east, south, north
M_PER_UNIT = 4.0
KX = math.cos(math.radians((LAT0 + LAT1) / 2)) * 111320 / M_PER_UNIT
KY = 110950 / M_PER_UNIT
W = round((LON1 - LON0) * KX)
H = round((LAT1 - LAT0) * KY)


def P(lat, lon):
    return ((lon - LON0) * KX, (LAT1 - lat) * KY)


def load(name):
    with open(os.path.join(OSM, name), encoding='utf8') as f:
        return json.load(f)['elements']


def dp(pts, tol):
    if len(pts) < 3:
        return pts
    if math.dist(pts[0], pts[-1]) < 1e-6:          # closed ring: split at the farthest point
        k = max(range(len(pts)), key=lambda i: math.dist(pts[0], pts[i]))
        if k == 0:
            return pts
        return dp(pts[:k + 1], tol)[:-1] + dp(pts[k:], tol)
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1e-9
    best, idx = -1, 0
    for i in range(1, len(pts) - 1):
        x, y = pts[i]
        dist = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / L
        if dist > best:
            best, idx = dist, i
    if best > tol:
        return dp(pts[:idx + 1], tol)[:-1] + dp(pts[idx:], tol)
    return [pts[0], pts[-1]]


def d_of(pts, close=False):
    s = 'M' + ' '.join(f'{x:.1f} {y:.1f}' for x, y in pts)
    return s + ('Z' if close else '')


def inview(pts, pad=60):
    return any(-pad <= x <= W + pad and -pad <= y <= H + pad for x, y in pts)


def rings(ways):
    """Join open polylines (lists of (lat,lon)) into closed rings by shared endpoints."""
    ways = [list(w) for w in ways if len(w) > 1]
    out = []
    while ways:
        ring = ways.pop(0)
        changed = True
        while ring[0] != ring[-1] and changed:
            changed = False
            for i, w in enumerate(ways):
                if w[0] == ring[-1]:
                    ring += w[1:]
                elif w[-1] == ring[-1]:
                    ring += w[::-1][1:]
                elif w[-1] == ring[0]:
                    ring = w[:-1] + ring
                elif w[0] == ring[0]:
                    ring = w[::-1][:-1] + ring
                else:
                    continue
                ways.pop(i)
                changed = True
                break
        out.append(ring)
    return out


raw = load('raw.json') + load('east.json')

# ---------- roads ----------
CLS = {'motorway': 'mw', 'trunk': 'mw', 'motorway_link': 'mwl', 'trunk_link': 'mwl',
       'primary': 'pri', 'primary_link': 'sec', 'secondary': 'sec', 'secondary_link': 'sec',
       'tertiary': 'ter', 'residential': 'res', 'unclassified': 'res', 'living_street': 'res', 'pedestrian': 'ped'}
roads = {k: [] for k in set(CLS.values())}
named = {}
graph = {}
seen = set()
COST = {'pri': 1.0, 'sec': 1.0, 'ter': 1.15, 'res': 1.5, 'ped': 1.3}
for e in raw:
    t = e.get('tags', {})
    if e['type'] != 'way' or 'highway' not in t or e['id'] in seen:
        continue
    seen.add(e['id'])
    c = CLS.get(t['highway'])
    g = e.get('geometry') or []
    if not c or len(g) < 2:
        continue
    ll = [(p['lat'], p['lon']) for p in g if p]
    pts = [P(*p) for p in ll]
    if not inview(pts):
        continue
    roads[c].append(d_of(dp(pts, 0.7)))
    n = t.get('name')
    if n:
        named.setdefault(n, []).append(ll)
    if c in COST and t.get('access') not in ('private', 'no'):
        for a, b in itertools.pairwise(ll):
            pa, pb = P(*a), P(*b)
            w = math.dist(pa, pb) * M_PER_UNIT
            graph.setdefault(a, []).append((b, w * COST[c], w))
            graph.setdefault(b, []).append((a, w * COST[c], w))

# ---------- parks ----------
parks = []
for e in raw:
    t = e.get('tags', {})
    if e['type'] == 'way' and t.get('leisure') == 'park' and e.get('geometry'):
        pts = [P(p['lat'], p['lon']) for p in e['geometry'] if p]
        if len(pts) > 2 and inview(pts):
            parks.append(d_of(dp(pts, 0.8), True))

# ---------- water ----------
water = []
rv = load('rivers.json')
for e in rv:
    outers = [[(p['lat'], p['lon']) for p in m['geometry']] for m in e.get('members', []) if m.get('role') == 'outer' and m.get('geometry')]
    for r in rings(outers):
        pts = [P(*p) for p in r]
        if inview(pts):
            water.append(d_of(dp(pts, 0.6), True))
for e in raw:
    t = e.get('tags', {})
    if e['type'] == 'way' and t.get('natural') == 'water' and e.get('geometry'):
        pts = [P(p['lat'], p['lon']) for p in e['geometry'] if p]
        if len(pts) > 2 and inview(pts):
            water.append(d_of(dp(pts, 0.6), True))

# Lake Michigan: stitch the clipped shoreline runs into one chain, then close it along the east edge.
lake = next(e for e in load('water.json') if e['tags'].get('name') == 'Lake Michigan')
runs = []
for m in lake['members']:
    if m.get('role') != 'outer' or not m.get('geometry'):
        continue
    cur = []
    for p in m['geometry']:
        if p is None:
            if len(cur) > 1:
                runs.append(cur)
            cur = []
        else:
            cur.append((p['lat'], p['lon']))
    if len(cur) > 1:
        runs.append(cur)
chains = rings(runs)
shore = max(chains, key=len)
if shore[0][0] > shore[-1][0]:
    shore = shore[::-1]                      # south -> north
spts = [P(*p) for p in shore]
EX = W + 400
lake_d = d_of(dp(spts, 0.6) + [(EX, spts[-1][1]), (EX, spts[0][1])], True)
shore_d = d_of(dp(spts, 0.6))

# ---------- labels for named streets ----------
LABELS = ['West Wisconsin Avenue', 'North 27th Street', 'West Wells Street', 'West Michigan Street', 'North Broadway',
          'North Water Street', 'East Juneau Avenue', 'East Kilbourn Avenue', 'North Milwaukee Street', 'West Walnut Street',
          'West Highland Avenue', 'North 6th Street', 'West Vliet Street', 'West State Street', 'North 35th Street',
          'North Martin Luther King Jr. Drive', 'West St. Paul Avenue', 'North Lincoln Memorial Drive', 'North Prospect Avenue',
          'North 20th Street', 'North 16th Street', 'West Juneau Avenue', 'North Plankinton Avenue', 'North Van Buren Street']
ABBR = [('North ', 'N '), ('South ', 'S '), ('East ', 'E '), ('West ', 'W '), ('Avenue', 'Ave'), ('Street', 'St'), ('Drive', 'Dr'),
        ('Martin Luther King Jr.', 'MLK')]
labels = []
for n in LABELS:
    if n not in named:
        continue
    best = None
    for ll in named[n]:
        pts = [P(*p) for p in ll]
        pts = [p for p in pts if 30 < p[0] < W - 30 and 20 < p[1] < H - 20]
        if len(pts) < 2:
            continue
        L = math.dist(pts[0], pts[-1])
        if not best or L > best[0]:
            best = (L, pts)
    if not best or best[0] < 60:
        continue
    pts = best[1]
    a, b = pts[0], pts[-1]
    mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
    ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
    if ang > 90:
        ang -= 180
    if ang < -90:
        ang += 180
    s = n
    for x, y in ABBR:
        s = s.replace(x, y)
    labels.append({'t': s.upper(), 'x': round(mx, 1), 'y': round(my, 1), 'a': round(ang, 1)})

# ---------- intersections ----------
def inter(n1, n2):
    a = {p for w in named.get(n1, []) for p in w}
    b = {p for w in named.get(n2, []) for p in w}
    common = a & b
    if not common:
        return None
    lat = sum(p[0] for p in common) / len(common)
    lon = sum(p[1] for p in common) / len(common)
    return (lat, lon)

grid = {}
for st in ['North 25th Street', 'North 26th Street', 'North 27th Street', 'North 28th Street', 'North 29th Street']:
    for av in ['West Highland Avenue', 'West Wells Street', 'West Wisconsin Avenue', 'West Michigan Street']:
        p = inter(st, av)
        if p:
            x, y = P(*p)
            grid[f'{st.split()[1]}|{av.split()[1]}'] = [round(x, 1), round(y, 1)]

# ---------- routing ----------
def nearest(lat, lon):
    tx, ty = P(lat, lon)
    return min(graph, key=lambda k: (P(*k)[0] - tx) ** 2 + (P(*k)[1] - ty) ** 2)

def route(a, b):
    s, t = nearest(*a), nearest(*b)
    dist, prev, real = {s: 0}, {}, {s: 0}
    pq = [(0, s)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == t:
            break
        if d > dist[u]:
            continue
        for v, w, m in graph[u]:
            nd = d + w
            if nd < dist.get(v, 1e18):
                dist[v] = nd; real[v] = real[u] + m; prev[v] = u
                heapq.heappush(pq, (nd, v))
    path, u = [t], t
    while u != s:
        u = prev[u]; path.append(u)
    path = path[::-1]
    pts = [P(*p) for p in path]
    return {'d': d_of(dp(pts, 0.5)), 'meters': round(real[t]), 'from': [round(v, 1) for v in pts[0]], 'to': [round(v, 1) for v in pts[-1]]}

POI = {
    'msoe_ps': (43.0460829, -87.9075166),
    'diercks': (43.0443175, -87.9075293),
    'sojourner': (43.0518817, -87.9191814),
    'library': (43.0395457, -87.9223672),
    'last_seen': None,
}
p = inter('North 27th Street', 'West Wisconsin Avenue')
POI['last_seen'] = p
pts = {k: [round(c, 1) for c in P(*v)] for k, v in POI.items() if v}
routes = {
    'library_to_msoe': route(POI['library'], POI['msoe_ps']),
    'westside_to_sojourner': route(inter('North 20th Street', 'West Walnut Street') or (43.0525, -87.9375), POI['sojourner']),
}
pts['walnut20'] = routes['westside_to_sojourner']['from']

# ---------- sample request points for the coordinator heatmap (clearly sample data) ----------
random.seed(14)
hoods = {'Near West Side': ((43.0405, -87.9460), 110, 42), 'Marquette / Westown': ((43.0395, -87.9270), 70, 18),
         'Juneautown': ((43.0450, -87.9060), 70, 9), 'Historic Third Ward': ((43.0335, -87.9075), 55, 5),
         'Haymarket / Hillside': ((43.0510, -87.9230), 80, 16)}
samples = []
hood_pts = {}
for name, ((la, lo), spread, n) in hoods.items():
    cx, cy = P(la, lo)
    hood_pts[name] = [round(cx, 1), round(cy, 1)]
    for _ in range(n):
        samples.append([round(cx + random.gauss(0, spread / 2.2), 1), round(cy + random.gauss(0, spread / 2.2), 1)])

out = {
    'W': W, 'H': H, 'roads': {k: ''.join(v) for k, v in roads.items()}, 'parks': ''.join(parks), 'water': ''.join(water),
    'lake': lake_d, 'shore': shore_d, 'labels': labels, 'grid': grid, 'poi': pts, 'routes': routes, 'hoods': hood_pts,
    'samples': samples,
}
os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, 'map.json'), 'w', encoding='utf8') as f:
    json.dump(out, f)
print('W,H', W, H, 'roads', {k: len(v) for k, v in roads.items()}, 'parks', len(parks), 'water', len(water))
print('labels', [l['t'] for l in labels])
print('grid', grid)
print('poi', pts)
print('routes', {k: (v['meters'], v['from'], v['to']) for k, v in routes.items()})
print('bytes', len(json.dumps(out)))
