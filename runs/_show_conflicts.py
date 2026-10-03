from pathlib import Path

def show(path):
    text = Path(path).read_text(encoding='utf-8')
    parts = text.split('<<<<<<<')
    print('====', path, 'conflicts', len(parts)-1, '====')
    for i, p in enumerate(parts[1:], 1):
        mid = p.split('=======')
        left = mid[0]
        right = mid[1].split('>>>>>>>')[0] if len(mid) > 1 else ''
        print(f'--- {i} OURS ---')
        print(left[:1200])
        print(f'--- {i} THEIRS ---')
        print(right[:1200])

for f in [
    'scripts/build_studies.py',
    'scripts/check_studies.py',
    'src/studies/filmstrip.mjs',
    'tests/studies_browser.py',
]:
    show(f)
