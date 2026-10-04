#!/usr/bin/env python3
"""Build studies 03–08 and the shared gallery; leave both legacy engines untouched."""
from __future__ import annotations
import argparse
import html
import hashlib
import json
import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PORTAL_MODULES = ('main', 'core', 'filmstrip', 'math', 'portal', 'portal-scene', 'portal-travel')
FLUID_MODULES = ('main', 'core', 'filmstrip', 'math', 'fluid', 'fluid-regions')
SHADOW_MODULES = ('main', 'core', 'filmstrip', 'math', 'shadow', 'shadow-apparatus', 'shadow-geometry')

def fingerprint(relative: str) -> str:
    source = (ROOT / relative).read_text(encoding='utf-8').encode('utf-8')
    return hashlib.sha256(source).hexdigest()[:12]

def portal_imports() -> dict[str, str]:
    # Resolve nested imports to the bytes from this build, including a warm module cache.
    return {f'../src/studies/{name}.mjs':
            f'../src/studies/{name}.mjs?v={fingerprint(f"src/studies/{name}.mjs")}'
            for name in PORTAL_MODULES}

def fluid_imports() -> dict[str, str]:
    return {f'../src/studies/{name}.mjs':
            f'../src/studies/{name}.mjs?v={fingerprint(f"src/studies/{name}.mjs")}'
            for name in FLUID_MODULES}

def shadow_imports() -> dict[str, str]:
    return {f'../src/studies/{name}.mjs':
            f'../src/studies/{name}.mjs?v={fingerprint(f"src/studies/{name}.mjs")}'
            for name in SHADOW_MODULES}

def outputs() -> dict[Path, str]:
    catalog = json.loads((ROOT / 'src/studies/catalog.json').read_text(encoding='utf-8'))
    template = (ROOT / 'src/studies/page.html').read_text(encoding='utf-8')
    generated = {}
    for item in catalog:
        output = ROOT / f'dist/{item["slug"]}.html'
        shell = runpy.run_path(str(ROOT / 'src/hall/build.py'))['render'](item['id'], output)
        page = template
        extra = ''
        if item['id'] in ('portal', 'temporal', 'fluid', 'optical', 'shadow', 'folding'):
            chapters = json.dumps(item['chapters'], ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
            extra = (f'\n<link rel="stylesheet" href="../src/studies/{item["id"]}.css">'
                     f'\n<script type="application/json" id="{item["id"]}-chapters">' + chapters + '</script>')
        if item['id'] in ('portal', 'fluid', 'shadow'):
            if item['id'] == 'portal':
                imports = portal_imports()
            elif item['id'] == 'fluid':
                imports = fluid_imports()
            else:
                imports = shadow_imports()
            extra += '\n<script type="importmap">' + json.dumps({'imports': imports}, separators=(',', ':')) + '</script>'
            entry = '../src/studies/main.mjs'
            page = page.replace(f'src="{entry}"', f'src="{imports[entry]}"')
            for name in ('style', item['id']):
                relative = f'src/studies/{name}.css'
                old = f'../{relative}'
                page = page.replace(old + '"', old + '?v=' + fingerprint(relative) + '"')
                extra = extra.replace(old + '"', old + '?v=' + fingerprint(relative) + '"')
        page = page.replace('@@STUDYEXTRA@@', extra)
        for key, value in item.items():
            page = page.replace('@@' + key.upper() + '@@', html.escape(str(value), quote=True))
        for key, value in shell.items():
            if key in ('style', 'script'):
                tag = 'style' if key == 'style' else 'script'
                value = f'<{tag}>\n{value}\n</{tag}>'
            page = page.replace('<!-- HALL:' + key.upper() + ' -->', value)
        if '@@' in page:
            raise ValueError(f'Unresolved template token in {item["slug"]}')
        generated[ROOT / f'dist/{item["slug"]}.html'] = page
    generated[ROOT / 'index.html'] = (ROOT / 'src/showcase.html').read_text(encoding='utf-8')
    return generated

def build(check: bool = False) -> None:
    stale = []
    for path, text in outputs().items():
        if check:
            if not path.is_file() or path.read_text(encoding='utf-8') != text:
                stale.append(str(path.relative_to(ROOT)))
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding='utf-8')
            print('Built', path.relative_to(ROOT))
    if stale:
        raise SystemExit('Out-of-date generated files: ' + ', '.join(stale))
    if check:
        print('Studies and gallery are reproducible.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    build(parser.parse_args().check)
