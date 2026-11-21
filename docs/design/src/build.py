"""Assemble a mockup page: python -I build.py <version-dir-name> <output.html>

Each version template may use: %%STAGE_CSS%% %%DEFS%% %%DECOY%% %%HUBJS%% %%SOJ_MIN%% %%SOJ_MI%% %%LIB_MIN%% %%LIB_MI%%
Map data comes from common/map.json (built from OpenStreetMap by common/build_map.py).
"""
import json
import os
import sys

here = os.path.dirname(os.path.abspath(__file__))
common = os.path.join(here, 'common')
ver, out = sys.argv[1], sys.argv[2]


def read(*p: str) -> str:
    with open(os.path.join(*p), encoding='utf8') as f:
        return f.read()


with open(os.path.join(common, 'map.json'), encoding='utf8') as f:
    d = json.load(f)
r = d['roads']
base = (f'<g id="basemap"><rect x="-400" y="-400" width="{d["W"]+800}" height="{d["H"]+800}" fill="var(--map-land)"/>'
        f'<path class="bm-park" d="{d["parks"]}"/><path class="bm-water" d="{d["lake"]}"/><path class="bm-water" d="{d["water"]}"/>'
        f'<g class="bm-roads"><path class="bm-ped" d="{r["ped"]}"/><path class="bm-res" d="{r["res"]}"/><path class="bm-ter" d="{r["ter"]}"/>'
        f'<path class="bm-sec" d="{r["sec"]}"/><path class="bm-pri" d="{r["pri"]}"/><path class="bm-mwl" d="{r["mwl"]}"/><path class="bm-mw" d="{r["mw"]}"/></g></g>'
        # main streets only, for versions that draw street lighting
        f'<g id="litroads" fill="none" stroke-linecap="round" stroke-linejoin="round"><path class="lit-pri" d="{r["pri"]}"/><path class="lit-sec" d="{r["sec"]}"/></g>')
data = {k: d[k] for k in ('labels', 'grid', 'poi', 'routes', 'hoods', 'samples') if k in d}
if 'police' in d: data['police'] = d['police']
soj, lib = d['routes']['westside_to_sojourner']['meters'], d['routes']['library_to_msoe']['meters']
js = 'const MAP = ' + json.dumps(data, separators=(',', ':')) + ';\n' + read(common, 'hub.js')
t = read(here, ver, 'template.html')
links_path = os.path.join(here, 'links.json')
if os.path.exists(links_path):
    with open(links_path, encoding='utf8') as f:
        links = json.load(f)
else:
    links = {}
NAMES = {'v4': 'v4 Map-first', 'v5': 'v5 Channels', 'v6': 'v6 Wayfinding', 'v7': 'v7 Porch Light', 'v8': 'v8 Sampler', 'v9': 'v9 Refined'}
for v, name in NAMES.items():
    url = links.get(v)
    t = t.replace(f'%%{v.upper()}LINK%%', f'<a href="{url}" target="_blank" rel="noopener">{name}</a>' if url and v != ver else '')
for k, v in {
    '%%STAGE_CSS%%': read(common, 'stage.css'), '%%DEFS%%': read(common, 'defs.html').replace('%%BASEMAP%%', base),
    '%%DECOY%%': read(common, 'decoy.html'), '%%HUBJS%%': js,
    '%%SOJ_MIN%%': str(round(soj / 1.3 / 60)), '%%SOJ_MI%%': f'{soj/1609:.1f}',
    '%%LIB_MIN%%': str(round(lib / 1.3 / 60)), '%%LIB_MI%%': f'{lib/1609:.1f}',
}.items():
    t = t.replace(k, v)
assert '%%' not in t, t[t.index('%%') - 80:t.index('%%') + 80]
with open(out, 'w', encoding='utf8') as f:
    f.write(t)
print(ver, '->', out, len(t), 'bytes')
