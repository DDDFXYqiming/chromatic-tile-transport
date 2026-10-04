"""Offline-only browser harness. Does not change the production sources.
Uses isolated IIFEs and in-memory asset data URLs when the test environment
forbids navigation. Static graph checks separately verify native ES-module paths.
"""
from pathlib import Path
import re,json,base64
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
ORDER=['math','core','filmstrip','portal','fluid','temporal-plates','temporal','optical','shadow-apparatus','shadow','folding']

def bundle(video_fixture: Path | None = None):
    entries=[]
    image_types={'.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'}
    assets={p.relative_to(ROOT/'assets').as_posix():'data:'+image_types[p.suffix]+';base64,'+base64.b64encode(p.read_bytes()).decode() for p in (ROOT/'assets/studies').rglob('*') if p.suffix in image_types}
    fold=ROOT/'assets/studies/temporal-fold/dawn-fold.json'
    assets[fold.relative_to(ROOT/'assets').as_posix()]='data:application/json;base64,'+base64.b64encode(fold.read_bytes()).decode()
    if video_fixture:
        assets['matrix-battle/03-clash.mp4']='data:video/mp4;base64,'+base64.b64encode(video_fixture.read_bytes()).decode()
    for name in ORDER:
        src=(ROOT/'src/studies'/f'{name}.mjs').read_text(encoding='utf-8')
        exports=re.findall(r'export\s+(?:async\s+)?(?:function|class|const)\s+(\w+)',src)
        src=re.sub(r"import\s*\{([^}]+)\}\s*from\s*'./([^']+)';",lambda m:f'const {{{m[1]}}}=M[{json.dumps(m[2])}];',src)
        if name=='core':
            src=re.sub(r"export const ASSETS = .*?;",'export const ASSETS = null;',src)
            src=re.sub(r"export const asset = .*?;",'export const asset = name => ASSET_DATA[name] || "data:video/mp4;base64,";',src)
        src=re.sub(r'\bexport\s+','',src)
        entries.append(f'M["{name}.mjs"]=(()=>{{\n{src}\nreturn {{{",".join(exports)}}};\n}})();')
    main=(ROOT/'src/studies/main.mjs').read_text(encoding='utf-8')
    main=re.sub(r"import\s*\{([^}]+)\}\s*from\s*'./([^']+)';",lambda m:f'const {{{m[1]}}}=M[{json.dumps(m[2])}];',main)
    main=re.sub(r"import\('./([^']+)'\)",lambda m:f'Promise.resolve(M[{json.dumps(m[1])}])',main)
    shell=(ROOT/'src/hall/main.js').read_text(encoding='utf-8')
    return shell+'\nconst ASSET_DATA='+json.dumps(assets)+';const M={};\n'+'\n'.join(entries)+'\n(async()=>{\n'+main+'\n})();'

def inline_page(slug):
    s=(ROOT/'dist'/f'{slug}.html').read_text(encoding='utf-8')
    s=re.sub(r'<link rel="stylesheet" href="([^"]+)"[^>]*>',lambda m:'<style>'+(ROOT/'dist'/urlsplit(m[1]).path).resolve().read_text(encoding='utf-8')+'</style>',s)
    s=re.sub(r'<script\b(?![^>]*type="application/json")[^>]*>.*?</script>','',s,flags=re.S)
    def thumbnail(match):
        path=(ROOT/'dist'/match[1]).resolve()
        return 'src="data:image/webp;base64,'+base64.b64encode(path.read_bytes()).decode()+'"'
    s=re.sub(r'src="(../assets/studies/atlas/[^\"]+)"',thumbnail,s)
    return s
