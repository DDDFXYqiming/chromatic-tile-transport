#!/usr/bin/env python3
"""Build, run deterministic tests, and optionally run Chromium integration tests."""
from pathlib import Path
import argparse, json, subprocess, sys
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--browser',action='store_true');a=p.parse_args()
(ROOT/'reports').mkdir(exist_ok=True)
subprocess.run([sys.executable,'scripts/build.py'],cwd=ROOT,check=True)
for name in ['matcher','timing']:
    result=subprocess.run(['node',f'tests/test_{name}.cjs'],cwd=ROOT,text=True,capture_output=True)
    (ROOT/f'reports/{name}.json').write_text(result.stdout,encoding='utf-8')
    if result.returncode:print(result.stdout,result.stderr);sys.exit(result.returncode)
    report=json.loads(result.stdout);print(f'{name}: {len(report["tests"])} passed',flush=True)
result=subprocess.run([sys.executable,'-m','unittest','discover','-s','tests','-p','test_*.py','-v'],cwd=ROOT,text=True,capture_output=True)
(ROOT/'reports/build-tests.txt').write_text(result.stdout+result.stderr,encoding='utf-8');print(result.stdout+result.stderr)
if result.returncode:sys.exit(result.returncode)
if a.browser:
    for file in ('browser_test.py','browser_timing.py'):
        result=subprocess.run([sys.executable,'-u',f'tests/{file}'],cwd=ROOT)
        if result.returncode:sys.exit(result.returncode)
print('All requested checks passed.')
