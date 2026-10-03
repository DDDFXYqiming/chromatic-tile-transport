from pathlib import Path
import re

def hunks(path):
    text = Path(path).read_text(encoding='utf-8')
    print('==== FULL', path, '====')
    # print each conflict with more context by finding markers
    for m in re.finditer(r'<<<<<<<[^\n]*\n.*?>>>>>>>[^\n]*\n', text, re.S):
        print('---HUNK---')
        print(m.group(0))
        print('---END---')

for f in [
    'scripts/build_studies.py',
    'scripts/check_studies.py',
    'src/studies/filmstrip.mjs',
    'tests/studies_browser.py',
]:
    hunks(f)
