from pathlib import Path
import subprocess, sys, types
from unittest.mock import patch
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts'))
old = {}
for rel in ['scripts/build.py','scripts/build_matrix.py','src/index.template.html','src/matrix/index.template.html','src/showcase.html','index.html']:
    old[ROOT/rel] = subprocess.check_output(['git','show','4780446:'+rel],cwd=ROOT).decode('utf-8')
read = Path.read_text
def baseline_read(path,*args,**kwargs):
    return old[path.resolve()] if path.resolve() in old else read(path,*args,**kwargs)
with patch.object(Path,'read_text',baseline_read):
    for name in ['build','build_matrix']:
        mod=types.ModuleType(name);mod.__file__=str(ROOT/f'scripts/{name}.py');sys.modules[name]=mod
        exec(compile(old[ROOT/f'scripts/{name}.py'],mod.__file__,'exec'),mod.__dict__)
    path=ROOT/'tests/browser_matrix.py'
    exec(compile(read(path,encoding='utf-8'),str(path),'exec'),{'__name__':'__main__','__file__':str(path)})
