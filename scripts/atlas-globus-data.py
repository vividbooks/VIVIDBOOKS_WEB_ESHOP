"""Data pro točící se glóbus na /atlas-zdarma (public/kampane/atlas/globus.json).

Bere hranice států, české názvy a ukazatele Světové banky přímo z aplikace Atlas (repo vividbooks-ultra),
geometrii zjednoduší (body aspoň 0,4° od sebe), ať má soubor jen pár set kB.

python3 scripts/atlas-globus-data.py ~/Dev/vb-atlas-ui/frontend
"""
import json, math, re, sys, os

root = os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else '~/Dev/vb-atlas-ui/frontend')
data = f'{root}/public/assets/atlas/data'
names_ts = open(f'{root}/src/app/pages/atlas/atlas-country-names-cs.ts', encoding='utf-8').read()
NAMES = dict(re.findall(r'^\s+([A-Z]{3}): "([^"]+)"', names_ts, re.M))

THEMES = [
    # klíč, ukazatel, popisek (shortTitle v Atlasu), jednotka, logaritmická stupnice — viz atlas-choropleth-topics.ts
    ('hustota', 'EN.POP.DNST', 'Hustota zalidnění', 'obyv./km²', True),
    ('porodnost', 'SP.DYN.CBRT.IN', 'Porodnost', '‰', False),
    ('zivot', 'SP.DYN.LE00.IN', 'Délka života', 'let', False),
    ('hdp', 'NY.GDP.PCAP.CD', 'HDP/obyv.', 'USD/obyv.', True),
    ('lesy', 'AG.LND.FRST.ZS', 'Lesnatost', '%', False),
]


def latest(series):
    years = sorted((int(y), v) for y, v in series.items() if v is not None)
    return (years[-1][1], years[-1][0]) if years else (None, None)


def simplify(ring):
    out = []
    for lon, lat in ring:
        p = [round(lon, 1), round(lat, 1)]
        # bod bližší než 0,4° k předchozímu vynechat (glóbus v hero má průměr ~500 px)
        if not out or abs(p[0] - out[-1][0]) + abs(p[1] - out[-1][1]) >= 0.4:
            out.append(p)
    if out and out[-1] != out[0]:
        out.append(out[0])
    return out if len(out) >= 4 else None


def area(ring):
    return abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(ring, ring[1:])) / 2)


geo = json.load(open(f'{data}/countries.geojson'))
values = {}
for key, ind, *_ in THEMES:
    s = json.load(open(f'{data}/world-bank/{ind}.json'))['series']
    values[key] = {iso: latest(v) for iso, v in s.items()}

countries = []
for ft in geo['features']:
    pr = ft['properties']
    iso = pr.get('ISO_A3_EH') if pr.get('ISO_A3_EH') not in (None, '-99') else pr.get('ADM0_A3')
    g = ft['geometry']
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    rings = []
    for poly in polys:
        r = simplify(poly[0])  # jen vnější hranice, ostrůvky pod ~0,3 °² vynechat
        if r and (area(r) > 0.3 or len(polys) == 1):
            rings.append(r)
    if not rings:
        continue
    row = {'iso': iso, 'name': NAMES.get(iso, pr.get('NAME')), 'c': pr.get('MAPCOLOR7', 1), 'r': rings, 'v': {}}
    for key, *_ in THEMES:
        v, _y = values[key].get(iso, (None, None))
        if v is not None:
            row['v'][key] = round(v, 1)
    countries.append(row)

years = {}
for key, ind, *_ in THEMES:
    ys = [y for v, y in values[key].values() if y]
    years[key] = max(set(ys), key=ys.count) if ys else None

out = {
    'themes': [{'key': k, 'label': l, 'unit': u, 'log': lg, 'year': years[k]} for k, _i, l, u, lg in THEMES],
    'countries': countries,
}
dst = os.path.join(os.path.dirname(__file__), '..', 'public', 'kampane', 'atlas', 'globus.json')
json.dump(out, open(dst, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(countries), 'států,', os.path.getsize(dst) // 1024, 'kB')
