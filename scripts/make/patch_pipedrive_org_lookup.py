#!/usr/bin/env python3
"""
Přepne Make scénář z vlastního hledání organizace na endpoint
`/make-server-93a20b6f/pipedrive/resolve-organization`.

Proč: 23 Make scénářů mělo 23 kopií logiky „najdi organizaci podle IČO, jinak
založ novou“ — se syrovou hodnotou z formuláře, bez normalizace a bez fallbacku
na název. To je zdroj duplicit popsaných v `docs/PIPEDRIVE_ORG_DEDUP.md`.
Po přepnutí žijí pravidla na jednom místě (edge funkce `make-server-93a20b6f`).

Co skript v blueprintu udělá:
  1. modul „Search organization“ (pipedrive:MakeAPICall / itemSearch) nahradí
     modulem `http:ActionSendData`, který volá náš endpoint; ID modulu, jeho
     filtr i pozice v designeru zůstanou, aby zbytek scénáře nebylo nutné překreslit,
  2. přepíše odkazy na jeho výstup (`…item.id` → `…data.orgId` atd.),
  3. přidá error handler `builtin:Resume` — když endpoint selže, scénář nespadne
     a projde se původní záložní větví, takže se registrace nikdy neztratí,
  4. záložní větev „Create new organization“ přejmenuje, ať je zřejmé, že je to
     jen pojistka, ne běžná cesta.

Použití:
  python3 scripts/make/patch_pipedrive_org_lookup.py --scenario 3472524 \
      --input <odpoved-scenarios_get.json> --output bp.json

Výstup se do Make nahraje přes „Import Blueprint“ v menu scénáře. Tajemství
`x-vividbooks-secret` je ve výstupu jako placeholder — doplň ho až v Make,
ať se nedostane do gitu ani do sdílených souborů.
"""
import argparse, copy, json, re, sys

RESOLVE_URL = (
    'https://iekkundgizzdbmkzatdl.supabase.co/functions/v1'
    '/make-server-93a20b6f/pipedrive/resolve-organization'
)
SECRET_PLACEHOLDER = '__DOPLNIT_PIPEDRIVE_ORG_RESOLVE_SECRET__'

# Pro každý scénář: ID modulu, který hledá organizaci, ID záložního
# „Create organization“ modulu a výrazy, ze kterých se berou vstupy.
SCENARIOS = {
    3472524: {
        'name': '[NB] [CZ1] Webinar form v1.5 (úpravy a testování)',
        'search_module': 132,
        'create_module': 14,
        'ico': '{{4.data.Vat}}',
        'school': '{{substring(ifempty(4.data.`flexdatalist-School`; 4.data.School); 0; 100)}}',
        'address': '{{4.data.Region}}',
        'refs': {
            '132.body.data.items[].item.owner.id': '132.data.ownerId',
            '132.body.data.items[].item.name': '132.data.orgName',
            '132.body.data.items[].item.id': '132.data.orgId',
        },
    },
}


def walk(mods):
    for m in mods or []:
        yield m
        for r in (m.get('routes') or []):
            yield from walk(r.get('flow'))


def load_blueprint(path):
    raw = open(path, encoding='utf-8').read()
    doc = json.JSONDecoder().raw_decode(raw[raw.find('{'):])[0]
    scenario = doc.get('scenario', doc)
    blueprint = scenario.get('blueprint')
    if isinstance(blueprint, str):
        blueprint = json.loads(blueprint)
    return scenario, blueprint


def find_module(blueprint, module_id):
    for m in walk(blueprint['flow']):
        if m.get('id') == module_id:
            return m
    return None


def next_free_id(blueprint):
    return max((m.get('id', 0) for m in walk(blueprint['flow'])), default=0) + 1


def http_template(blueprint):
    """Existující http:ActionSendData ve scénáři — přebíráme z něj `metadata.expect`,
    aby se modul v designeru vykreslil se všemi poli."""
    for m in walk(blueprint['flow']):
        if m.get('module') == 'http:ActionSendData':
            return m
    raise SystemExit('Ve scénáři není žádný http:ActionSendData, ze kterého vzít metadata.')


def build_resolve_module(old, template, cfg, resume_id):
    new = copy.deepcopy(template)
    new['id'] = old['id']
    if old.get('filter'):
        new['filter'] = old['filter']
    else:
        new.pop('filter', None)
    new['mapper'] = {
        'ca': '',
        'qs': [
            {'name': 'ico', 'value': cfg['ico']},
            {'name': 'schoolName', 'value': cfg['school']},
            {'name': 'address', 'value': cfg.get('address', '')},
        ],
        'url': RESOLVE_URL,
        'gzip': True,
        'method': 'post',
        'headers': [{'name': 'x-vividbooks-secret', 'value': SECRET_PLACEHOLDER}],
        'timeout': '',
        'useMtls': False,
        'authPass': '',
        'authUser': '',
        'bodyType': '',
        'serializeUrl': False,
        'shareCookies': False,
        'parseResponse': True,
        'followRedirect': True,
        'useQuerystring': False,
        'followAllRedirects': False,
        'rejectUnauthorized': True,
    }
    designer = (old.get('metadata') or {}).get('designer') or {}
    metadata = new.setdefault('metadata', {})
    metadata['designer'] = {
        **{k: v for k, v in designer.items() if k in ('x', 'y')},
        'name': 'Najdi nebo založ organizaci (Vividbooks)',
    }
    metadata.pop('restore', None)
    metadata.pop('parameters', None)
    new.pop('parameters', None)
    # Bez tohohle by výpadek endpointu shodil celý běh a registrace by se ztratila.
    new['onerror'] = [{
        'id': resume_id,
        'module': 'builtin:Resume',
        'version': 1,
        'mapper': {},
        'metadata': {
            'designer': {
                'x': int(designer.get('x', 0)) + 150,
                'y': int(designer.get('y', 0)) + 150,
                'name': 'Endpoint selhal → pokračuj záložní větví',
            },
        },
    }]
    return new


def replace_module(blueprint, module_id, new_module):
    def rec(mods):
        for i, m in enumerate(mods or []):
            if m.get('id') == module_id:
                mods[i] = new_module
                return True
            for r in (m.get('routes') or []):
                if rec(r.get('flow')):
                    return True
        return False
    if not rec(blueprint['flow']):
        raise SystemExit(f'Modul {module_id} v blueprintu není.')


def rewrite_refs(blueprint, mapping):
    text = json.dumps(blueprint, ensure_ascii=False)
    for old, new in mapping.items():
        text = text.replace(old, new)
    return json.loads(text)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--scenario', type=int, required=True)
    ap.add_argument('--input', required=True, help='odpověď Make scenarios_get (JSON)')
    ap.add_argument('--output', required=True)
    args = ap.parse_args()

    cfg = SCENARIOS.get(args.scenario)
    if not cfg:
        raise SystemExit(f'Scénář {args.scenario} nemá v SCENARIOS mapování vstupů — doplň ho.')

    scenario, blueprint = load_blueprint(args.input)
    if scenario.get('id') != args.scenario:
        raise SystemExit(f"Vstup je scénář {scenario.get('id')}, ne {args.scenario}.")

    old = find_module(blueprint, cfg['search_module'])
    if old is None:
        raise SystemExit(f"Modul {cfg['search_module']} nenalezen.")
    if old.get('module') == 'http:ActionSendData':
        raise SystemExit('Scénář už je přepnutý na endpoint — není co měnit.')

    resume_id = next_free_id(blueprint)
    new = build_resolve_module(old, http_template(blueprint), cfg, resume_id)
    replace_module(blueprint, cfg['search_module'], new)
    blueprint = rewrite_refs(blueprint, cfg['refs'])

    fallback = find_module(blueprint, cfg['create_module'])
    if fallback:
        fallback.setdefault('metadata', {}).setdefault('designer', {})['name'] = (
            'Záloha: založ organizaci (jen když endpoint nevrátí ID)'
        )

    text = json.dumps(blueprint, ensure_ascii=False)
    stale = sorted(set(re.findall(r'\{\{[^}]*\b%d\.body[^}]*\}\}' % cfg['search_module'], text)))
    if stale:
        raise SystemExit(f'Zůstaly odkazy na starý výstup: {stale}')

    with open(args.output, 'w', encoding='utf-8') as fh:
        json.dump(blueprint, fh, ensure_ascii=False)

    refs = sorted(set(re.findall(r'\{\{[^}]*\b%d\.[^}]*\}\}' % cfg['search_module'], text)))
    print(f"Scénář {args.scenario} — {cfg['name']}")
    print(f"  modul {cfg['search_module']}: pipedrive:MakeAPICall → http:ActionSendData (+ builtin:Resume #{resume_id})")
    print(f"  odkazy na výstup: {', '.join(refs)}")
    print(f"  záložní modul {cfg['create_module']} přejmenován")
    print(f"  zapsáno: {args.output}")


if __name__ == '__main__':
    main()
