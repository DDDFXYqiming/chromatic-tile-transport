"""Verify the shipped layer study through real localhost navigation and actual pixels."""
from pathlib import Path
import base64,io,json,threading,tempfile,platform,statistics,os,sys
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from PIL import Image,ImageChops,ImageStat
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'reports/layers';OUT.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(ROOT/'scripts'))
import build_matrix
checks=[]
def require(value,message='Assertion failed'):
    if not value:raise AssertionError(message)
def check(name,fn):
    try:detail=fn();checks.append(dict(name=name,passed=True,detail=detail));print('PASS',name,flush=True)
    except Exception as e:checks.append(dict(name=name,passed=False,error=str(e)));print('FAIL',name,e,flush=True)
def decode(value):return Image.open(io.BytesIO(base64.b64decode(value.split(',',1)[1]))).convert('RGB')
def mad(a,b):return sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
    executable=os.environ.get('CHROME_BIN');opts={'headless':True}
    if executable:opts['executable_path']=executable
    browser=p.chromium.launch(**opts);page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
    errors=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
    page.goto(f'http://127.0.0.1:{server.server_port}/dist/matrix-motion.html');page.wait_for_function('MatrixMotion.getState().ready',timeout=45000)
    page.evaluate('MatrixMotion.pause()');state=lambda:page.evaluate('MatrixMotion.getState()')
    snap=lambda t:decode(page.evaluate('(t)=>{MatrixMotion.seek(t);return MatrixMotion.snapshot()}',t))
    def ready():
        s=state();require(s['engine']=='WEBGL 2' and s['glError']==0 and not s['warnings']);require(s['sceneCount']==3 and len(s['composition']['layers'])==5);return s['engine']
    check('Default 02 uses five independent layer instances and three original-art shots',ready)
    def alpha():
        rows=[]
        for name in ['character','fish','flowers']:
            im=Image.open(ROOT/f'assets/matrix-botanical/{name}.png');require(im.mode=='RGBA');h=im.getchannel('A').histogram();ratio=h[0]/(im.width*im.height);require(.15<ratio<.9);rows.append({'asset':name,'fullyTransparentFraction':ratio})
        return rows
    check('The three cutouts contain genuine transparent alpha',alpha)
    def poses():
        images=[]
        for name,t in [('wide',1.2),('closeup',6.7),('negative-space',9.8)]:
            im=snap(t);images.append(im);im.save(OUT/(name+'.png'));page.screenshot(path=str(OUT/(name+'-ui.png')))
        require(min(mad(a,b) for a,b in zip(images,images[1:]))>15)
        cover=images[0].copy();cover.thumbnail((1440,900));cover.save(ROOT/'assets/matrix-botanical/cover.webp',quality=90)
        return 'Wide / close-up / negative-space images differ visibly'
    check('Three camera compositions render visibly distinct frames',poses)
    def layer_switches():
        a=snap(1.2);page.evaluate('MatrixMotion.setLayerVisible("character",false)');b=decode(page.evaluate('MatrixMotion.snapshot()'));require(mad(a,b)>8)
        page.evaluate('MatrixMotion.setLayerVisible("character",true)');c=decode(page.evaluate('MatrixMotion.snapshot()'));require(a.tobytes()==c.tobytes())
        page.locator('#settingsOpen').click();require(page.locator('#layerList input').count()==5);page.locator('[data-layer="fish"]').uncheck();require(not next(l for l in state()['composition']['layers'] if l['id']=='fish')['visible'])
        page.locator('[data-layer="fish"]').check();page.locator('#settingsClose').click();return True
    check('Layer switches remove actual image content and restore it exactly',layer_switches)
    def motion():
        page.evaluate('MatrixMotion.configure({layerMotion:true})');snap(1);a=state()['composition']['layers'];snap(2.5);b=state()['composition']['layers']
        delta={x['id']:y['x']-x['x'] for x,y in zip(a,b)};require(abs(delta['fish']-delta['character'])>30)
        page.evaluate('MatrixMotion.configure({layerMotion:false})');off=snap(2.5);page.evaluate('MatrixMotion.configure({layerMotion:true})');on=decode(page.evaluate('MatrixMotion.snapshot()'));require(mad(off,on)>1);return delta
    check('Fish and portrait actually move independently',motion)
    def seams():
        result=[]
        for mode in ['original','auto']:
            page.evaluate('(mode)=>MatrixMotion.configure({mode})',mode)
            for t in [4,8,12]:
                delta=mad(snap(t-.00001),snap(t));require(delta<.5,f'{mode} seam at {t}: {delta}');result.append(delta)
        page.evaluate('MatrixMotion.configure({mode:"original"})');return result
    check('All three camera joins and Matrix bridges are continuous',seams)
    def reverse():
        for mode in ['original','auto','matrix']:
            page.evaluate('(mode)=>MatrixMotion.configure({mode})',mode);a=snap(3.78);snap(6.7);b=snap(3.78);require(a.tobytes()==b.tobytes())
        page.evaluate('MatrixMotion.configure({mode:"original"})');return True
    check('Layered textures and point-grid frames reproduce after reverse scrubbing',reverse)
    def modes():
        hashes=[]
        import hashlib
        for mode in ['original','duotone','poster','line','matrix']:
            page.evaluate('(mode)=>MatrixMotion.configure({mode})',mode);hashes.append(hashlib.sha256(snap(1.2).tobytes()).hexdigest())
        require(len(set(hashes))==5);page.evaluate('MatrixMotion.configure({mode:"original"})');return True
    check('All five existing visual treatments process the moving layer composition',modes)
    def playback():
        page.evaluate('MatrixMotion.seek(.3);MatrixMotion.play()');before=state();page.wait_for_timeout(700);after=state();page.evaluate('MatrixMotion.pause()')
        require(after['seconds']>before['seconds']+.3 and after['composition']['frames']>before['composition']['frames']);return {'advancedSeconds':after['seconds']-before['seconds'],'compositedFrames':after['composition']['frames']-before['composition']['frames']}
    check('Actual requestAnimationFrame playback updates the composite textures',playback)
    def mobile():
        values=[]
        for width,height in [(390,844),(320,568),(844,390)]:
            page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(100);snap(6.7)
            v=page.evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})');require(v['width']==v['scrollWidth']);require(state()['glError']==0);values.append(v)
        page.set_viewport_size({'width':390,'height':844});snap(1.2);page.screenshot(path=str(OUT/'mobile.png'));return values
    check('Portrait and landscape layouts keep navigation and artwork inside the viewport',mobile)
    def reduced():
        page.evaluate('MatrixMotion.setReduced(true)');a=snap(1);b=snap(2);require(a.tobytes()==b.tobytes() and not state()['playing']);page.evaluate('MatrixMotion.setReduced(false)');return True
    check('Reduced motion stops both camera and independent layer drift',reduced)
    def fallback():
        fallback=browser.new_page(viewport={'width':960,'height':640});fallback.goto(f'http://127.0.0.1:{server.server_port}/dist/matrix-motion.html?renderer=canvas');fallback.wait_for_function('MatrixMotion.getState().ready',timeout=45000);fallback.evaluate('MatrixMotion.pause()');s=fallback.evaluate('MatrixMotion.getState()');require(s['engine']=='CANVAS 2D' and s['composition'])
        a=fallback.evaluate('()=>{MatrixMotion.seek(1.2);return MatrixMotion.snapshot()}');fallback.evaluate('MatrixMotion.seek(6.7)');b=fallback.evaluate('()=>{MatrixMotion.seek(1.2);return MatrixMotion.snapshot()}');require(a==b);fallback.close();return True
    check('Canvas fallback retains reversible layer composition',fallback)
    def offline():
        with tempfile.TemporaryDirectory() as tmp:
            html=build_matrix.build(Path(tmp)/'offline.html').read_text(encoding='utf-8');offline=browser.new_page();seen=[];offline.on('request',lambda r:seen.append(r.url));offline.set_content(html);offline.wait_for_function('MatrixMotion.getState().ready',timeout=45000);require(all(x.startswith(('data:','blob:','about:')) for x in seen));offline.close();return True
    check('Standalone build embeds every layer without remote requests',offline)
    check('No game artwork or external services are requested by default 02',lambda:require(not any('starrail/' in x or not x.startswith(('http://127.0.0.1:','data:','blob:','about:')) for x in requests)))
    check('No uncaught browser errors',lambda:require(not errors,errors))
    browser.close()
finally:server.shutdown();server.server_close()
report={'date':'2026-09-10','environment':platform.platform(),'passed':all(c['passed'] for c in checks),'checks':checks,'errors':errors}
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
if not report['passed']:sys.exit(1)
