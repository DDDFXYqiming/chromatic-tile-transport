#!/usr/bin/env python3
"""Check the new static resource graph without requiring legacy media locally."""
from pathlib import Path
from html.parser import HTMLParser
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from urllib.parse import urlsplit
from build_studies import ROOT, build

class Links(HTMLParser):
    def __init__(self):super().__init__();self.paths=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag in ('script','img') and a.get('src'):self.paths.append(a['src'])
        if tag=='link' and a.get('href'):self.paths.append(a['href'])

build(check=True)
for path in (ROOT/'src/studies').glob('*.mjs'):
    subprocess.run(['node','--check',str(path)],check=True)
    for rel in re.findall(r"(?:from\s*|import\()\s*['\"](\./[^'\"]+)['\"]",path.read_text(encoding='utf-8')):
        assert (path.parent/rel).is_file(),(path,rel)
for path in (ROOT/'assets/studies').glob('*.svg'):ET.parse(path)
for item in json.loads((ROOT/'src/studies/catalog.json').read_text(encoding='utf-8')):
    path=ROOT/f'dist/{item["slug"]}.html';p=Links();p.feed(path.read_text(encoding='utf-8'))
    for rel in p.paths:assert (path.parent/urlsplit(rel).path).resolve().is_file(),(path,rel)
    assert (ROOT/'assets/studies'/item['cover']).is_file()
    if item['id'] == 'portal':
        from build_studies import portal_imports, fingerprint
        imports = json.loads(re.search(r'<script type="importmap">(.*?)</script>', path.read_text(encoding='utf-8')).group(1))['imports']
        assert imports == portal_imports()
        assert imports['../src/studies/main.mjs'] in p.paths
        for source, versioned in imports.items():
            parsed = urlsplit(versioned)
            assert parsed.path == source
            assert parsed.query == 'v=' + fingerprint(source.removeprefix('../'))
        chapters = item['chapters']
        assert len(chapters) == 4
        assert len({chapter['image'] for chapter in chapters}) == 4
        for chapter in chapters:
            assert (ROOT/'assets'/chapter['image']).is_file()
            assert all(chapter[key] for key in ('headline', 'body', 'feature', 'detail', 'action'))
        assert (ROOT/'assets/studies/portal-patina.png').is_file()
        subprocess.run(['node', str(ROOT/'tests/test_portal_travel.mjs')], check=True)
    if item['id'] == 'optical':
        chapters = item['chapters']
        assert len(chapters) == 4
        assert {c['world'] for c in chapters} == {'black', 'white'}
        by_id = {c['id']: c for c in chapters}
        assert len(by_id) == 4
        for chapter in chapters:
            assert (ROOT/'assets'/chapter['image']).is_file()
            paired = by_id[chapter['pair']]
            assert paired['pair'] == chapter['id'] and paired['world'] != chapter['world']
            assert all(chapter[k] for k in ('headline', 'body', 'detail', 'feature', 'note', 'action'))
            assert len(chapter['specs']) == 3
    if item['id'] == 'folding':
        chapters = item['chapters']
        assert len(chapters) == 4
        for field in ('id', 'image', 'body', 'note', 'kicker'):
            assert len({chapter[field] for chapter in chapters}) == 4, field
        for chapter in chapters:
            assert (ROOT/'assets'/chapter['image']).is_file()
            assert chapter['image'].startswith('studies/folding-')
            assert all(chapter[key] for key in ('headline', 'feature', 'detail', 'annotation', 'action'))
            assert 0 <= chapter['pose']['open'] <= 1 and abs(chapter['pose']['orbit']) <= 1
    if item['id'] in ('temporal', 'shadow'):
        chapters = item['chapters']
        assert 4 <= len(chapters) <= 5
        for field in ('id', 'image', 'body', 'note', 'kicker'):
            assert len({chapter[field] for chapter in chapters}) == len(chapters), field
        for chapter in chapters:
            assert (ROOT/'assets'/chapter['image']).is_file()
            assert all(chapter[key] for key in ('headline', 'detail', 'feature', 'action'))
            if item['id'] == 'temporal':
                assert chapter['annotation']
                if chapter.get('fold'):
                    assert (ROOT/'assets'/chapter['fold']).is_file()
            else:
                assert len(chapter['display']) == 2
                assert all(chapter[key] for key in ('alt', 'material'))
        if item['id'] == 'temporal':
            from build_studies import temporal_imports
            generated = path.read_text(encoding='utf-8')
            imports = json.loads(re.search(r'<script type="importmap">(.*?)</script>', generated).group(1))['imports']
            assert imports == temporal_imports()
            assert imports['../src/studies/main.mjs'] in p.paths
            subprocess.run(['node', str(ROOT/'tests/temporal_plates.mjs')], check=True)
            subprocess.run(['node', str(ROOT/'tests/temporal_runtime.mjs')], check=True)
        if item['id'] == 'shadow':
            from build_studies import shadow_imports, fingerprint
            generated = path.read_text(encoding='utf-8')
            imports = json.loads(re.search(r'<script type="importmap">(.*?)</script>', generated).group(1))['imports']
            assert imports == shadow_imports()
            assert imports['../src/studies/main.mjs'] in p.paths
            assert '../src/studies/shadow.css?v=' + fingerprint('src/studies/shadow.css') in p.paths
            subprocess.run(['node', str(ROOT/'tests/shadow_geometry.mjs')], check=True)
            subprocess.run(['node', str(ROOT/'tests/shadow_runtime.mjs')], check=True)
    if item['id'] == 'fluid':
        from build_studies import fluid_imports, fingerprint
        imports = json.loads(re.search(r'<script type="importmap">(.*?)</script>', path.read_text(encoding='utf-8')).group(1))['imports']
        assert imports == fluid_imports()
        assert imports['../src/studies/main.mjs'] in p.paths
        for source, versioned in imports.items():
            parsed = urlsplit(versioned)
            assert parsed.path == source
            assert parsed.query == 'v=' + fingerprint(source.removeprefix('../'))
        subprocess.run(['node', str(ROOT/'tests/fluid_math.mjs')], check=True)
        subprocess.run([sys.executable, str(ROOT/'tests/fluid_regions.py')], check=True)
        chapters = item['chapters']
        assert 4 <= len(chapters) <= 5
        for field in ('id', 'image', 'body', 'note', 'kicker', 'material'):
            assert len({chapter[field] for chapter in chapters}) == len(chapters), field
        for chapter in chapters:
            assert (ROOT/'assets'/chapter['image']).is_file()
            assert all(chapter[key] for key in ('headline', 'detail', 'feature', 'annotation', 'action', 'flow'))
            assert len(chapter['swatches']) == len(chapter['swatchNames']) == 3
s=(ROOT/'src/showcase.html').read_text(encoding='utf-8')
assert s.count('class="card')==8
assert 'href="dist/index.html"' in s and 'href="dist/matrix-battle.html"' in s
assert not any('placeholder' in p.name.lower() for p in (ROOT/'assets/studies').iterdir())
print('Native module/resource graph, SVGs, eight-entry gallery and generated files: PASS')
