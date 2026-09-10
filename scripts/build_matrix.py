#!/usr/bin/env python3
"""Build effect 02 without modifying effect 01. Default: offline HTML; --linked: small repository preview."""
from __future__ import annotations
import argparse, base64, hashlib, html, json, math, os, re
from pathlib import Path
from build import ROOT, local, load_scenes, script_json, image_info

DEFAULT_SCENES = ROOT / 'examples/matrix-motion/scenes.json'
DEFAULT_CONFIG = ROOT / 'examples/matrix-motion/config.json'
BOUNDS = {'shotSeconds':(4,14), 'bridgeSeconds':(.3,1.6), 'density':(48,224), 'zoom':(1,2.1), 'parallax':(0,1),'cameraX':(-.3,.3),'cameraY':(-.3,.3),'deformationStrength':(0,1.5)}

def load_matrix_config(path: Path, scenes: list[dict]) -> dict:
    c=json.loads(local(path).read_text(encoding='utf-8'))
    if not isinstance(c,dict) or set(c)-{'title','brand','notice','options','focus','composition'}: raise ValueError('Unknown matrix config key')
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
        elif k in ('autoplay','layerMotion','deformation','motionStudy'):
            if type(v) is not bool: raise ValueError(k+' must be boolean')
        else: raise ValueError('Unknown matrix option: '+k)
    focus=c.get('focus',{})
    if not isinstance(focus,dict) or set(focus)-{s['slug'] for s in scenes}: raise ValueError('focus refers to an unknown scene')
    for point in focus.values():
        if not isinstance(point,list) or len(point)!=2 or any(type(v) not in (int,float) or not math.isfinite(v) or not 0<=v<=1 for v in point): raise ValueError('focus must contain [x,y] in [0,1]')
    composition=c.get('composition')
    if composition is not None:
        def number(v,lo,hi):return type(v) in (int,float) and math.isfinite(v) and lo<=v<=hi
        if not isinstance(composition,dict) or set(composition)!={'width','height','layers'}:raise ValueError('Invalid composition')
        if not all(number(composition[k],100,8192) for k in ('width','height')):raise ValueError('Invalid composition size')
        layers=composition['layers']
        if not isinstance(layers,list) or not 2<=len(layers)<=12:raise ValueError('A composition requires 2-12 layers')
        ids=set()
        for layer in layers:
            if not isinstance(layer,dict) or set(layer)-{'id','label','src','kind','x','y','height','depth','drift','phase','rotation','sway','opacity','rig','rigStrength'}:raise ValueError('Invalid layer')
            if layer.get('rig','none') not in ('none','character','fish','plant'):raise ValueError('Invalid layer rig')
            if not number(layer.get('rigStrength',1),0,1):raise ValueError('Invalid layer rig strength')
            if not isinstance(layer.get('id'),str) or not re.fullmatch(r'[a-z][a-z0-9-]*',layer['id']) or layer['id'] in ids:raise ValueError('Layer ids must be unique')
            ids.add(layer['id'])
            if not isinstance(layer.get('label'),str) or not isinstance(layer.get('src'),str):raise ValueError('Missing layer label/src')
            for key,lo,hi,default in [('x',-1,2,None),('y',-1,2,None),('height',.01,3,None),('depth',0,2,1),('opacity',0,1,1),('phase',-20,20,0),('rotation',-180,180,0),('sway',0,45,0)]:
                if not number(layer.get(key,default),lo,hi):raise ValueError('Invalid layer '+key)
            drift=layer.get('drift',[0,0])
            if not isinstance(drift,list) or len(drift)!=2 or not all(number(v,-.5,.5) for v in drift):raise ValueError('Invalid layer drift')
            local(path.parent/layer['src'])
        for scene in scenes:
            keys=scene.get('cameraKeys')
            if not isinstance(keys,list) or len(keys)<2:raise ValueError('Camera keyframes are required for each composition shot')
            for key in keys:
                if not isinstance(key,dict) or set(key)!={'p','x','y','scale'} or not all(number(key[k],0,1) for k in ('p','x','y')) or not number(key['scale'],.5,2.5):raise ValueError('Invalid camera keyframe')
            if keys[0]['p']!=0 or keys[-1]['p']!=1 or any(a['p']>=b['p'] for a,b in zip(keys,keys[1:])):raise ValueError('Camera keyframes must run in order from 0 to 1')
    return c

def build(output: Path, scenes_path: Path=DEFAULT_SCENES, config_path: Path=DEFAULT_CONFIG, linked: bool=False) -> Path:
    scenes=load_scenes(scenes_path); config=load_matrix_config(config_path,scenes);output=output.resolve()
    src=ROOT/'src/matrix';result=(src/'index.template.html').read_text(encoding='utf-8')
    modules=([ROOT/'src/vendor/pixi-8.20.1.min.js',src/'deformation.js',src/'mesh.js'] if config.get('composition') else [])
    modules += [src/f for f in ('timeline.js','layers.js','renderer.js','main.js')]
    rel=lambda p: os.path.relpath(p,output.parent).replace(os.sep,'/')
    versioned=lambda p:rel(p)+'?v='+hashlib.sha256(p.read_bytes()).hexdigest()[:12]
    for layer in config.get('composition',{}).get('layers',[]):
        asset=local(config_path.parent/layer['src']);raw=asset.read_bytes();mime,width,height=image_info(raw)
        if len(raw)>32*1024*1024 or max(width,height)>8192:raise ValueError('Layer image is too large')
        layer['src']=rel(asset) if linked else 'data:'+mime+';base64,'+base64.b64encode(raw).decode('ascii')
    # Linked previews use repository files. Inline builds never fetch assets or code.
    if linked:
        local(output)
        original=json.loads(local(scenes_path).read_text(encoding='utf-8'))
        for scene,raw in zip(scenes,original): scene['src']=rel(local(scenes_path.parent/raw['src']))
        css='<link rel="stylesheet" href="'+html.escape(versioned(src/'style.css'),quote=True)+'">'
        scripts='\n'.join('<script src="'+html.escape(versioned(f),quote=True)+'"></script>' for f in modules)
        gallery=rel(ROOT/'index.html');transport=rel(ROOT/'dist/index.html')
    else:
        css='<style>\n'+(src/'style.css').read_text(encoding='utf-8')+'\n</style>'
        scripts='<script>\n'+'\n'.join(f.read_text(encoding='utf-8').replace('</script','<\\/script') for f in modules)+'\n</script>'
        gallery=rel(ROOT/'index.html') if output.is_relative_to(ROOT) else './index.html'
        transport=rel(ROOT/'dist/index.html') if output.is_relative_to(ROOT) else './starrail_color_transport_v3_1.html'
    replacements={'<!-- MATRIX:STYLE -->':css,'<!-- MATRIX:SCRIPT -->':scripts,
      '<!-- MATRIX:ASSETS -->':'<script>window.MATRIX_DATA='+script_json({'config':config,'scenes':scenes})+';</script>',
      '{{TITLE}}':html.escape(config['title']),'{{NOTICE}}':html.escape(config['notice']),
      '{{GALLERY}}':html.escape(gallery,quote=True),'{{TRANSPORT}}':html.escape(transport,quote=True),
      '{{BRAND}}':html.escape(config['brand']),'{{FIRST_NAME}}':html.escape(scenes[0]['name']),'{{FIRST_EN}}':html.escape(scenes[0]['en']),
      '{{COUNT}}':str(len(scenes)).zfill(2),
      '{{CANVAS_LABEL}}':'人物、鱼、花枝与背景独立合成的动态图像' if config.get('composition') else '由静态插画生成的动态图像',
      '{{PARALLAX_TITLE}}':'图层视差' if config.get('composition') else '焦点局部视差',
      '{{PARALLAX_NOTE}}':'人物、远景和前景以不同幅度移动。' if config.get('composition') else '连续形变近似前后景，不是人物分层。'}
    # Replace only our template tokens; Pixi's shader source has its own {{TOKENS}}.
    tokens=re.compile(r'<!-- MATRIX:[A-Z]+ -->|{{[A-Z_]+}}')
    if set(tokens.findall(result))-set(replacements):raise ValueError('Unresolved matrix template token')
    result=tokens.sub(lambda match:replacements[match.group(0)],result)
    output.parent.mkdir(parents=True,exist_ok=True);output.write_text(result,encoding='utf-8');return output

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--scenes',type=Path,default=DEFAULT_SCENES);p.add_argument('--config',type=Path,default=DEFAULT_CONFIG)
    p.add_argument('--output','-o',type=Path,default=ROOT/'dist/matrix-motion.html');p.add_argument('--linked',action='store_true')
    a=p.parse_args()
    try:
        out=build(a.output,a.scenes,a.config,a.linked);print(f'Built {out} ({out.stat().st_size:,} bytes; {"linked" if a.linked else "standalone"})')
    except (ValueError,TypeError,KeyError,OSError) as e:p.exit(1,f'Matrix build failed: {e}\n')
if __name__=='__main__':main()
