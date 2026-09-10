#!/usr/bin/env python3
"""Build a validated, completely offline HTML. Python >=3.10, standard library only."""
from __future__ import annotations
import argparse, base64, copy, html, json, math, os, re, struct
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCENES = ROOT / 'examples/starrail/scenes.json'
DEFAULT_CONFIG = ROOT / 'examples/starrail/config.json'


def local(path: Path) -> Path:
    path = path.resolve()
    if not path.is_relative_to(ROOT):
        raise ValueError(f'Input must stay inside the project directory: {path.name}')
    return path


def image_info(data: bytes) -> tuple[str, int, int]:
    """Inspect PNG, JPEG or WebP headers without a decoding dependency."""
    if data.startswith(b'\x89PNG\r\n\x1a\n') and len(data) >= 24:
        w, h = struct.unpack('>II', data[16:24]); return 'image/png', w, h
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        pos = 12
        while pos + 8 <= len(data):
            tag = data[pos:pos+4]; size = int.from_bytes(data[pos+4:pos+8], 'little'); b = data[pos+8:pos+8+size]
            if tag == b'VP8X' and len(b) >= 10:
                return 'image/webp', 1 + int.from_bytes(b[4:7], 'little'), 1 + int.from_bytes(b[7:10], 'little')
            if tag == b'VP8 ' and len(b) >= 10 and b[3:6] == b'\x9d\x01\x2a':
                return 'image/webp', int.from_bytes(b[6:8], 'little') & 16383, int.from_bytes(b[8:10], 'little') & 16383
            if tag == b'VP8L' and len(b) >= 5 and b[0] == 47:
                bits = int.from_bytes(b[1:5], 'little'); return 'image/webp', 1 + (bits & 16383), 1 + ((bits >> 14) & 16383)
            pos += 8 + size + (size & 1)
    if data[:2] == b'\xff\xd8':
        pos = 2
        while pos + 4 < len(data):
            if data[pos] != 255: pos += 1; continue
            while pos < len(data) and data[pos] == 255: pos += 1
            marker = data[pos]; pos += 1
            if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7: continue
            size = int.from_bytes(data[pos:pos+2], 'big')
            if marker in (0xC0,0xC1,0xC2,0xC3,0xC5,0xC6,0xC7,0xC9,0xCA,0xCB,0xCD,0xCE,0xCF) and size >= 7:
                return 'image/jpeg', int.from_bytes(data[pos+5:pos+7], 'big'), int.from_bytes(data[pos+3:pos+5], 'big')
            if size < 2: break
            pos += size
    raise ValueError('Unsupported or malformed image (supported: PNG / JPEG / WebP)')


def load_scenes(path: Path) -> list[dict]:
    path = local(path)
    scenes = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(scenes, list) or not 2 <= len(scenes) <= 24:
        raise ValueError('scenes.json must contain 2–24 images')
    seen = set()
    for scene in scenes:
        for key in ('slug','name','en','line1','line2','caption','tag','src'):
            if not isinstance(scene.get(key), str): raise ValueError(f'Missing/string field required: {key}')
        if not re.fullmatch(r'[a-zA-Z0-9_-]+', scene['slug']) or scene['slug'] in seen: raise ValueError('Each slug must be unique and URL-safe')
        seen.add(scene['slug'])
        if not re.fullmatch(r'#[0-9a-fA-F]{6}', scene.get('accent','')): raise ValueError('accent must be #RRGGBB')
        focal = scene.get('position')
        if not isinstance(focal, list) or len(focal) != 2 or any(type(x) not in (int,float) or not math.isfinite(x) or not 0 <= x <= 1 for x in focal):
            raise ValueError('position must contain two finite numbers in [0,1]')
        asset = local(path.parent / scene['src'])
        data = asset.read_bytes()
        if len(data) > 32*1024*1024: raise ValueError('An image exceeds 32 MiB; resize it before building')
        mime, width, height = image_info(data)
        if not 1 <= width <= 8192 or not 1 <= height <= 8192: raise ValueError('Image dimensions must be in [1,8192]')
        for k, actual in (('width',width),('height',height)):
            if k in scene and scene[k] != actual: raise ValueError(f'{asset.name}: {k} metadata differs from the actual image')
            scene[k] = actual
        scene['src'] = f'data:{mime};base64,' + base64.b64encode(data).decode('ascii')
    return scenes


def load_config(path: Path) -> dict:
    c = json.loads(local(path).read_text(encoding='utf-8'))
    allowed={'title','brand','description','notice','autoplay','cleanView','options','motion'}
    if not isinstance(c, dict) or set(c)-allowed: raise ValueError('Unknown config key')
    for key in ('title','brand','description','notice'):
        if not isinstance(c.get(key),str): raise ValueError(f'Missing config text: {key}')
    for key in ('autoplay','cleanView'):
        if key in c and type(c[key]) is not bool: raise ValueError(f'{key} must be boolean')
    opts = c.get('options', {})
    bounds={'density':(32,256),'duration':(.25,30),'holdTime':(0,60),'spatial':(0,1)}
    allowed_opts=set(bounds)|{'mapping','holdColor','trails','reduced'}
    if not isinstance(opts,dict) or set(opts)-allowed_opts: raise ValueError('Unknown options key')
    for key,value in opts.items():
        if key in bounds:
            lo,hi=bounds[key]
            if type(value) not in (int,float) or not math.isfinite(value) or not lo <= value <= hi: raise ValueError(f'Invalid {key}')
            if key=='density' and value != int(value): raise ValueError('density must be integer')
        elif key=='mapping':
            if value not in ('color','geometry','position'): raise ValueError('Invalid mapping')
        elif type(value) is not bool: raise ValueError(f'{key} must be boolean')
    m={'launchBase':.015,'launchSpread':.035,'landBase':.95,'landSpread':.035,'ramp':.08,'splitEnd':.10,'fillStart':.88}
    override=c.get('motion',{})
    if not isinstance(override,dict) or set(override)-set(m): raise ValueError('Unknown motion key')
    if any(type(v) not in (int,float) or not math.isfinite(v) for v in override.values()): raise ValueError('Invalid motion value')
    m.update(override)
    if not (m['launchBase']>=0 and m['launchSpread']>=0 and m['launchBase']+m['launchSpread']<=.12 and
            m['landBase']>=.88 and m['landSpread']>=0 and m['landBase']+m['landSpread']<=1 and
            .02<=m['ramp']<=.2 and .04<=m['splitEnd']<=.25 and .75<=m['fillStart']<=.96):
        raise ValueError('Motion configuration is invalid or would reintroduce long dead zones')
    return c


def script_json(value: object) -> str:
    return json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False).replace('<','\\u003c').replace('\u2028','\\u2028').replace('\u2029','\\u2029')


def build(output: Path, scenes_path: Path=DEFAULT_SCENES, config_path: Path=DEFAULT_CONFIG) -> Path:
    scenes, config = load_scenes(scenes_path), load_config(config_path)
    output = output.resolve()
    def link(target: Path) -> str:
        return quote(Path(os.path.relpath(target, output.parent)).as_posix(), safe='/')
    src = ROOT/'src'
    result = (src/'index.template.html').read_text(encoding='utf-8')
    tokens={**{k.upper():str(config[k]) for k in ('title','brand','description','notice')},
            'COUNT':str(len(scenes)).zfill(2),'TIMELINE_MAX':str(len(scenes)*1000),
            'GALLERY':link(ROOT/'index.html') if output.is_relative_to(ROOT) else './index.html',
            'MATRIX':link(ROOT/'dist/matrix-motion.html') if output.is_relative_to(ROOT) else './matrix-motion.html'}
    for key,value in tokens.items(): result=result.replace('{{'+key+'}}',html.escape(value,quote=True))
    worker=(src/'matcher.js').read_text(encoding='utf-8')
    js='window.MATCH_WORKER_SOURCE='+script_json(worker)+';\n'
    js+='\n'.join((src/f).read_text(encoding='utf-8') for f in ('timing.js','transport.js','main.js'))
    result=result.replace('<!-- BUILD:STYLE -->','<style>\n'+(src/'style.css').read_text(encoding='utf-8')+'\n</style>')
    result=result.replace('<!-- BUILD:ASSETS -->','<script>window.ARCHIVE_CONFIG='+script_json(config)+';window.ARCHIVE_MEDIA='+script_json(scenes)+';</script>')
    result=result.replace('<!-- BUILD:SCRIPT -->','<script>\n'+js+'\n</script>')
    if '<!-- BUILD:' in result or re.search(r'{{[A-Z_]+}}', result): raise ValueError('Unresolved template token')
    output=output.resolve(); output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(result,encoding='utf-8')
    return output


def main() -> None:
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--scenes',type=Path,default=DEFAULT_SCENES)
    p.add_argument('--config',type=Path,default=DEFAULT_CONFIG)
    p.add_argument('-o','--output',type=Path,default=ROOT/'dist/index.html')
    args=p.parse_args()
    try:
        out=build(args.output,args.scenes,args.config)
        print(f'Built {out} ({out.stat().st_size:,} bytes)')
    except (ValueError,OSError,TypeError,KeyError) as e: p.exit(1,f'Build failed: {e}\n')


if __name__=='__main__': main()
