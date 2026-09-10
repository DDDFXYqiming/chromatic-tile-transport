#!/usr/bin/env python3
"""Build effect 02 without modifying effect 01. Default: offline HTML; --linked: small repository preview."""
from __future__ import annotations
import argparse, html, json, math, os, re
from pathlib import Path
from build import ROOT, DEFAULT_SCENES, local, load_scenes, script_json

DEFAULT_CONFIG = ROOT / 'examples/matrix-motion/config.json'
BOUNDS = {'shotSeconds':(4,14), 'bridgeSeconds':(.3,.85), 'density':(48,224), 'zoom':(1,2.1), 'parallax':(0,1)}

def load_matrix_config(path: Path, scenes: list[dict]) -> dict:
    c=json.loads(local(path).read_text(encoding='utf-8'))
    if not isinstance(c,dict) or set(c)-{'title','brand','notice','options','focus'}: raise ValueError('Unknown matrix config key')
    for k in ('title','brand','notice'):
        if not isinstance(c.get(k),str): raise ValueError('Missing config text: '+k)
    options=c.get('options',{})
    if not isinstance(options,dict): raise ValueError('options must be an object')
    for k,v in options.items():
        if k in BOUNDS:
            lo,hi=BOUNDS[k]
            if type(v) not in (int,float) or not math.isfinite(v) or not lo<=v<=hi: raise ValueError('Invalid '+k)
            if k=='density' and int(v)!=v: raise ValueError('density must be integer')
        elif k=='mode':
            if v not in ('auto','original','duotone','poster','line','matrix'): raise ValueError('Unknown mode')
        elif k=='palette':
            if v not in ('ice','scene','mono'): raise ValueError('Unknown palette')
        elif k=='autoplay':
            if type(v) is not bool: raise ValueError('autoplay must be boolean')
        else: raise ValueError('Unknown matrix option: '+k)
    focus=c.get('focus',{})
    if not isinstance(focus,dict) or set(focus)-{s['slug'] for s in scenes}: raise ValueError('focus refers to an unknown scene')
    for point in focus.values():
        if not isinstance(point,list) or len(point)!=2 or any(type(v) not in (int,float) or not math.isfinite(v) or not 0<=v<=1 for v in point): raise ValueError('focus must contain [x,y] in [0,1]')
    return c

def build(output: Path, scenes_path: Path=DEFAULT_SCENES, config_path: Path=DEFAULT_CONFIG, linked: bool=False) -> Path:
    scenes=load_scenes(scenes_path); config=load_matrix_config(config_path,scenes);output=output.resolve()
    src=ROOT/'src/matrix';result=(src/'index.template.html').read_text(encoding='utf-8')
    rel=lambda p: os.path.relpath(p,output.parent).replace(os.sep,'/')
    # Linked previews use repository files. Inline builds never fetch assets or code.
    if linked:
        local(output)
        original=json.loads(local(scenes_path).read_text(encoding='utf-8'))
        for scene,raw in zip(scenes,original): scene['src']=rel(local(scenes_path.parent/raw['src']))
        css='<link rel="stylesheet" href="'+html.escape(rel(src/'style.css'),quote=True)+'">'
        scripts='\n'.join('<script src="'+html.escape(rel(src/f),quote=True)+'"></script>' for f in ('timeline.js','renderer.js','main.js'))
        gallery=rel(ROOT/'index.html');transport=rel(ROOT/'dist/index.html')
    else:
        css='<style>\n'+(src/'style.css').read_text(encoding='utf-8')+'\n</style>'
        scripts='<script>\n'+'\n'.join((src/f).read_text(encoding='utf-8') for f in ('timeline.js','renderer.js','main.js'))+'\n</script>'
        gallery=rel(ROOT/'index.html') if output.is_relative_to(ROOT) else './index.html'
        transport=rel(ROOT/'dist/index.html') if output.is_relative_to(ROOT) else './starrail_color_transport_v3_1.html'
    replacements={'<!-- MATRIX:STYLE -->':css,'<!-- MATRIX:SCRIPT -->':scripts,
      '<!-- MATRIX:ASSETS -->':'<script>window.MATRIX_DATA='+script_json({'config':config,'scenes':scenes})+';</script>',
      '{{TITLE}}':html.escape(config['title']),'{{NOTICE}}':html.escape(config['notice']),
      '{{GALLERY}}':html.escape(gallery,quote=True),'{{TRANSPORT}}':html.escape(transport,quote=True)}
    for old,new in replacements.items():result=result.replace(old,new)
    if '<!-- MATRIX:' in result or re.search(r'{{[A-Z_]+}}',result):raise ValueError('Unresolved matrix template token')
    output.parent.mkdir(parents=True,exist_ok=True);output.write_text(result,encoding='utf-8');return output

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--scenes',type=Path,default=DEFAULT_SCENES);p.add_argument('--config',type=Path,default=DEFAULT_CONFIG)
    p.add_argument('--output','-o',type=Path,default=ROOT/'dist/matrix-motion.html');p.add_argument('--linked',action='store_true')
    a=p.parse_args()
    try:
        out=build(a.output,a.scenes,a.config,a.linked);print(f'Built {out} ({out.stat().st_size:,} bytes; {"linked" if a.linked else "standalone"})')
    except (ValueError,TypeError,KeyError,OSError) as e:p.exit(1,f'Matrix build failed: {e}\n')
if __name__=='__main__':main()
