#!/usr/bin/env python3
"""Validate and test effect 02; --browser adds actual Chromium integration checks."""
from pathlib import Path
import argparse,json,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--browser',action='store_true');a=p.parse_args()
    out=ROOT/'reports/matrix';out.mkdir(parents=True,exist_ok=True)
    for cmd in ([sys.executable,'scripts/build_matrix.py','--linked'],[sys.executable,'scripts/build_showcase.py']):subprocess.run(cmd,cwd=ROOT,check=True)
    result=subprocess.run(['node','tests/test_matrix_timeline.cjs'],cwd=ROOT,text=True,capture_output=True)
    (out/'timeline.json').write_text(result.stdout,encoding='utf-8');print(result.stdout,result.stderr)
    if result.returncode:return result.returncode
    result=subprocess.run(['node','tests/test_matrix_deformation.cjs'],cwd=ROOT,text=True,capture_output=True)
    (out/'deformation.json').write_text(result.stdout,encoding='utf-8');print(result.stdout,result.stderr)
    if result.returncode:return result.returncode
    result=subprocess.run(['node','tests/test_matrix_layers.cjs'],cwd=ROOT,text=True,capture_output=True)
    (out/'layers.json').write_text(result.stdout,encoding='utf-8');print(result.stdout,result.stderr)
    if result.returncode:return result.returncode
    result=subprocess.run([sys.executable,'-m','unittest','discover','-s','tests','-p','test_matrix_build.py','-v'],cwd=ROOT,text=True,capture_output=True)
    (out/'build-tests.txt').write_text(result.stdout+result.stderr,encoding='utf-8');print(result.stdout+result.stderr)
    if result.returncode:return result.returncode
    if a.browser:
        for script in ('browser_matrix.py','browser_layers.py'):
            result=subprocess.run([sys.executable,'-u','tests/'+script],cwd=ROOT)
            if result.returncode:return result.returncode
        return 0
    print('All requested Matrix Motion checks passed.');return 0
if __name__=='__main__':sys.exit(main())
