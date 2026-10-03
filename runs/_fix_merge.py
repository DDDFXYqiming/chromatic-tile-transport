from pathlib import Path

# --- build_studies.py ---
p = Path('scripts/build_studies.py')
t = p.read_text(encoding='utf-8')
old = """<<<<<<< HEAD
<<<<<<< HEAD
        if item['id'] in ('portal', 'temporal', 'fluid', 'optical'):
=======
        if item['id'] in ('portal', 'temporal', 'fluid', 'shadow'):
>>>>>>> remodel/s07-shadow
=======
        if item['id'] in ('portal', 'temporal', 'fluid', 'folding'):
>>>>>>> remodel/s08-folding"""
new = "        if item['id'] in ('portal', 'temporal', 'fluid', 'optical', 'shadow', 'folding'):"
if old not in t:
    raise SystemExit('build_studies hunk missing')
p.write_text(t.replace(old, new), encoding='utf-8')

# --- filmstrip.mjs ---
p = Path('src/studies/filmstrip.mjs')
t = p.read_text(encoding='utf-8')
old = """<<<<<<< HEAD
<<<<<<< HEAD
    button.addEventListener('focus',()=>{if(!['portal','temporal','fluid','optical'].includes(id)||button.matches(':focus-visible'))reveal(button);});strip.append(button);return button;
=======
    button.addEventListener('focus',()=>{if(!['portal','temporal','fluid','shadow'].includes(id)||button.matches(':focus-visible'))reveal(button);});strip.append(button);return button;
>>>>>>> remodel/s07-shadow
=======
    button.addEventListener('focus',()=>{if(!['portal','temporal','fluid','folding'].includes(id)||button.matches(':focus-visible'))reveal(button);});strip.append(button);return button;
>>>>>>> remodel/s08-folding"""
new = "    button.addEventListener('focus',()=>{if(!['portal','temporal','fluid','optical','shadow','folding'].includes(id)||button.matches(':focus-visible'))reveal(button);});strip.append(button);return button;"
if old not in t:
    raise SystemExit('filmstrip hunk missing')
p.write_text(t.replace(old, new), encoding='utf-8')

# --- check_studies.py ---
p = Path('scripts/check_studies.py')
t = p.read_text(encoding='utf-8')
old = """<<<<<<< HEAD
<<<<<<< HEAD
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
=======
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
>>>>>>> remodel/s08-folding
    if item['id'] == 'temporal':
=======
    if item['id'] in ('temporal', 'shadow'):
>>>>>>> remodel/s07-shadow"""
new = """    if item['id'] == 'optical':
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
    if item['id'] in ('temporal', 'shadow'):"""
if old not in t:
    raise SystemExit('check_studies hunk missing')
p.write_text(t.replace(old, new), encoding='utf-8')

# --- studies_browser.py ---
p = Path('tests/studies_browser.py')
t = p.read_text(encoding='utf-8')
old1 = """<<<<<<< HEAD
            check(item['id']+' controls synchronize selection',page.locator('.study-strip [aria-current]').count()==(1 if item['id'] in ('temporal','fluid','optical') else 0))
=======
            check(item['id']+' controls synchronize selection',page.locator('.study-strip [aria-current]').count()==(1 if item['id'] in ('temporal','fluid','folding') else 0))
>>>>>>> remodel/s08-folding"""
new1 = "            check(item['id']+' controls synchronize selection',page.locator('.study-strip [aria-current]').count()==(1 if item['id'] in ('temporal','fluid','optical','shadow','folding') else 0))"
if old1 not in t:
    raise SystemExit('browser hunk1 missing')
t = t.replace(old1, new1)
old2 = """<<<<<<< HEAD
    parser.add_argument('--study',choices=['portal','temporal','fluid','optical','shadow','folding'],help='Check a single study')
=======
    parser.add_argument('--study',choices=['portal','temporal','fluid','optical','shadow','folding'],help='Run only one study')
>>>>>>> remodel/s08-folding"""
new2 = "    parser.add_argument('--study',choices=['portal','temporal','fluid','optical','shadow','folding'],help='Check a single study')"
if old2 not in t:
    raise SystemExit('browser hunk2 missing')
p.write_text(t.replace(old2, new2), encoding='utf-8')

# verify
for f in ['scripts/build_studies.py','scripts/check_studies.py','src/studies/filmstrip.mjs','tests/studies_browser.py']:
    text = Path(f).read_text(encoding='utf-8')
    if any(m in text for m in ('<<<<<<<','=======','>>>>>>>')):
        raise SystemExit(f'markers remain in {f}')
print('all conflicts resolved')
