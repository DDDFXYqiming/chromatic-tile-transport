#!/usr/bin/env python3
"""Check the new static resource graph without requiring legacy media locally."""
from pathlib import Path
from html.parser import HTMLParser
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
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
    for rel in p.paths:assert (path.parent/rel).resolve().is_file(),(path,rel)
    assert (ROOT/'assets/studies'/item['cover']).is_file()
s=(ROOT/'src/showcase.html').read_text(encoding='utf-8')
assert s.count('class="card')==8
assert 'href="dist/index.html"' in s and 'href="dist/matrix-battle.html"' in s
assert not any('placeholder' in p.name.lower() for p in (ROOT/'assets/studies').iterdir())
print('Native module/resource graph, SVGs, eight-entry gallery and generated files: PASS')
