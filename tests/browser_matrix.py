"""Real Chromium tests of effect 02; no screenshot or frame-rate claims without execution."""
import base64, hashlib, io, json, os, shutil, sys, tempfile, threading, time
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import build_matrix
OUT=ROOT/'reports/matrix';OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];requests=[]
def require(value,message='Assertion failed'):
    if not value:raise AssertionError(message)
    return value
def check(name,fn):
    try: detail=fn();checks.append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True)
    except Exception as e:checks.append({'name':name,'passed':False,'error':str(e)});print('FAIL',name,e,flush=True)
def image(data):return Image.open(io.BytesIO(base64.b64decode(data.split(',',1)[1]))).convert('RGB')
def mad(a,b):return sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3
def launch_options():
    opts={'headless':True}
    exe=os.environ.get('CHROME_BIN') or shutil.which('chromium') or shutil.which('google-chrome')
    if exe:opts['executable_path']=exe
    if sys.platform.startswith('linux'):
        opts.update(args=['--no-sandbox','--ignore-gpu-blocklist','--enable-webgl','--use-gl=angle','--use-angle=gl-egl','--disable-dev-shm-usage'],env={**os.environ,'LIBGL_ALWAYS_SOFTWARE':'1','EGL_PLATFORM':'surfaceless'})
    return opts
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
with tempfile.TemporaryDirectory() as tmp:
    html=build_matrix.build(Path(tmp)/'demo.html').read_text(encoding='utf-8')
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start();base=f'http://127.0.0.1:{server.server_port}'
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(**launch_options());page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
            page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
            page.set_content(html,wait_until='load');page.wait_for_function('window.MatrixMotion?.getState().ready',timeout=45000)
            page.evaluate('MatrixMotion.pause()');page.add_style_tag(content='*{transition:none!important;animation:none!important} .loading.ready{display:none}')
            state=lambda:page.evaluate('MatrixMotion.getState()')
            snap=lambda t:page.evaluate('(t)=>{MatrixMotion.seek(t);return MatrixMotion.snapshot()}',t)
            check('WebGL 2 runs the actual shader without fallback or warnings',lambda:require(state()['engine']=='WEBGL 2' and state()['glError']==0 and not state()['warnings']))
            check('All five images have distinct, nonblank actual renders',lambda:require(len({hashlib.sha256(snap(i*6.8+1.4).encode()).hexdigest() for i in range(5)})==5))
            def modes():
                hashes={}
                for mode in ['original','duotone','poster','line','matrix']:
                    page.evaluate('(mode)=>MatrixMotion.configure({mode})',mode);hashes[mode]=hashlib.sha256(snap(4.1).encode()).hexdigest()[:12]
                page.evaluate('MatrixMotion.configure({mode:"auto"})');require(len(set(hashes.values()))==5);return hashes
            check('Original, duotone, poster, line and matrix are visually different',modes)
            def reverse():
                a=snap(6.57);b=snap(13);c=snap(6.57);require(a==c and a!=b);return 'Exact pixel-identical reverse seek'
            check('Reverse seeking is pixel deterministic',reverse)
            def pause():
                snap(6.56);before=state();page.wait_for_timeout(300);after=state();require(before['seconds']==after['seconds']);require(before['drawCount']==after['drawCount']);return 'No drift and no extra draw calls'
            check('Paused frames remain still without continuously burning GPU work',pause)
            def bridges():
                result=[]
                for i in range(5):
                    start=(i+1)*6.8-.48;ims=[image(snap(start+j*.48/12)).resize((500,260)) for j in range(13)]
                    diffs=[round(mad(a,b),4) for a,b in zip(ims,ims[1:])];require(min(diffs)>.025,f'Unexpected freeze {i}: {diffs}')
                    require(all(max(ImageStat.Stat(im).stddev)>10 for im in ims),'Blank frame')
                    result.append({'scene':i,'successiveFrameMAD':diffs})
                return result
            check('All five short bridges continuously change with no blank frame',bridges)
            def seam():
                out=[]
                for i in range(1,6):
                    a=image(snap(i*6.8-0.00001)).resize((500,260));b=image(snap(i*6.8)).resize((500,260));d=mad(a,b);require(d<.2,f'Visible end seam {i}: {d}');out.append(round(d,5))
                return out
            check('All bridge endpoints, including last-to-first, join continuously',seam)
            def controls():
                page.locator('#timeline').evaluate('(e)=>{e.value="6.56";e.dispatchEvent(new Event("input",{bubbles:true}))}');require(abs(state()['seconds']-6.56)<.001)
                page.locator('#next').click();require(state()['frame']['scene']==1);page.locator('#previous').click();require(state()['frame']['scene']==0)
                page.locator('.film-item').nth(3).click();require(state()['frame']['scene']==3);return True
            check('Timeline, next/previous and all scene controls work',controls)
            def inspector():
                page.locator('#settingsOpen').click();page.locator('#modeButtons button[data-mode="line"]').click();require(state()['config']['mode']=='line')
                page.locator('#palette').select_option('scene');require(state()['config']['palette']=='scene')
                page.locator('#inspectBridge').click();require(not page.locator('#settings').evaluate('(e)=>e.open'));require(abs(state()['frame']['bridge']-.5)<.001 and not state()['playing'])
                page.evaluate('MatrixMotion.configure({palette:"ice"})');return True
            check('Director desk pins styles and pauses exactly at the bridge midpoint',inspector)
            def settings():
                for d in [96,192,144]:page.evaluate('(density)=>MatrixMotion.configure({density})',d);require(state()['grid']['cols']==d)
                for shotSeconds in [5.2,9,6.8]:
                    page.evaluate('(shotSeconds)=>MatrixMotion.configure({shotSeconds})',shotSeconds);snap(shotSeconds-.24);require(abs(state()['frame']['bridge']-.5)<.001)
                require(state()['glError']==0);return True
            check('Grid density and shot duration update without stretching the bridge',settings)
            def invalid():
                before=state()['config'];require(page.evaluate('()=>{try{MatrixMotion.configure({zoom:NaN});return false}catch(e){return true}}'));require(state()['config']==before);return True
            check('Invalid runtime configuration is rejected atomically',invalid)
            def playback():
                page.evaluate('MatrixMotion.seek(1);MatrixMotion.play()');page.wait_for_timeout(400);v=state()['seconds'];require(v>1.04);page.evaluate('MatrixMotion.pause()');return {'advancedTo':v,'fpsClaim':False}
            check('Actual requestAnimationFrame playback advances and pauses',playback)
            def looptest():
                snap(1);page.locator('#bridgeButton').click();require(state()['bridgeLoop'] and state()['playing']);page.wait_for_timeout(250);page.evaluate('MatrixMotion.pause()');snap(4.1);require(not state()['bridgeLoop']);return True
            check('Bridge-focused loop starts and manual scrub exits the loop',looptest)
            def wheel():
                snap(2);page.locator('#stage').hover(position={'x':400,'y':350});page.mouse.wheel(0,100);page.wait_for_timeout(100);require(state()['seconds']>2.1);return True
            check('Wheel scrub moves through the same timeline',wheel)
            def immersive():
                page.evaluate('MatrixMotion.setImmersive(true)');page.wait_for_timeout(100);require(state()['width']==1440);require(page.locator('#exitImmersive').is_visible());page.keyboard.press('Escape');page.wait_for_timeout(100);require(state()['width']<1440);return True
            check('Immersive entry, resize and Escape exit work',immersive)
            def phone():
                layouts=[]
                for width,height in [(390,844),(320,568),(844,390)]:
                    page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(120);snap(4.1)
                    v=page.evaluate('({w:innerWidth,sw:document.documentElement.scrollWidth})');require(v['sw']<=v['w']);require(state()['glError']==0);layouts.append(v)
                page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(100);snap(4.1);page.screenshot(path=str(OUT/'mobile.png'))
                page.locator('#settingsOpen').click();require(page.locator('#settings').is_visible());page.screenshot(path=str(OUT/'mobile-settings.png'));page.locator('#settingsClose').click();return layouts
            check('Phone portrait, narrow phone and landscape have no horizontal overflow',phone)
            def context():
                page.set_viewport_size({'width':1440,'height':900});page.wait_for_timeout(100);snap(4.1)
                page.evaluate('()=>{const gl=document.getElementById("matrixCanvas").getContext("webgl2");const ext=gl.getExtension("WEBGL_lose_context");if(!ext)throw new Error("Extension unavailable");ext.loseContext();setTimeout(()=>ext.restoreContext(),200)}')
                page.wait_for_function('MatrixMotion.getState().contextLost');page.wait_for_function('!MatrixMotion.getState().contextLost',timeout=15000)
                require(state()['engine']=='WEBGL 2' and state()['glError']==0 and not state()['playing']);return True
            check('WebGL context loss restores a working paused renderer',context)
            # Final desktop artifacts from the real WebGL path.
            page.set_viewport_size({'width':1440,'height':900});page.wait_for_timeout(120)
            for name,t in [('desktop',4.1),('matrix',6.57),('line',6.8),('original',1.4)]:snap(t);page.screenshot(path=str(OUT/(name+'.png')))
            fallback=browser.new_page(viewport={'width':960,'height':640});fallback.on('pageerror',lambda e:errors.append(str(e)))
            fallback.evaluate('()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==="webgl2"?null:get.call(this,type,...args)}}')
            fallback.set_content(html,wait_until='load');fallback.wait_for_function('MatrixMotion.getState().ready',timeout=45000);fallback.evaluate('MatrixMotion.pause()')
            def canvas():
                require(fallback.evaluate('MatrixMotion.getState().engine==="CANVAS 2D"'));a=fallback.evaluate('()=>{MatrixMotion.seek(6.56);return MatrixMotion.snapshot()}');fallback.evaluate('MatrixMotion.seek(10)');b=fallback.evaluate('()=>{MatrixMotion.seek(6.56);return MatrixMotion.snapshot()}');require(a==b);return 'Simplified, deterministic fixed-grid fallback'
            check('Explicit Canvas fallback renders and reverses correctly',canvas)
            reduced=browser.new_page(viewport={'width':390,'height':844},reduced_motion='reduce');reduced.set_content(html,wait_until='load');reduced.wait_for_function('MatrixMotion.getState().ready',timeout=45000)
            def reduced_motion():
                s=reduced.evaluate('MatrixMotion.getState()');require(s['reduced'] and not s['playing']);reduced.evaluate('MatrixMotion.play();MatrixMotion.seek(6.57)');s=reduced.evaluate('MatrixMotion.getState()');require(not s['playing'] and s['frame']['bridge']==0 and s['frame']['zoom']==1);return True
            check('System reduced-motion preference disables autoplay and transitions',reduced_motion)
            check('Standalone effect requests no remote resource',lambda:require(all(u.startswith(('blob:','data:','about:')) for u in requests),[u[:90] for u in requests]))
            def linked():
                # Navigation to localhost/file:// is blocked by the test environment's browser policy.
                # Do not route around that policy. Render inline, and validate links on disk instead.
                from html.parser import HTMLParser
                class Links(HTMLParser):
                    def __init__(self):super().__init__();self.targets=[]
                    def handle_starttag(self,tag,attrs):
                        for k,v in attrs:
                            if k in ('href','src') and v and not v.startswith(('#','data:','http:','https:')):self.targets.append(v)
                for relative in ['index.html','dist/matrix-motion.html']:
                    path=ROOT/relative;parser=Links();parser.feed(path.read_text())
                    for target in parser.targets:require((path.parent/target).resolve().is_file(),relative+' -> '+target)
                source=(ROOT/'index.html').read_text()
                for name in ['01-neon','02-spring']:
                    source=source.replace('assets/starrail/'+name+'.webp','data:image/webp;base64,'+base64.b64encode((ROOT/'assets/starrail'/(name+'.webp')).read_bytes()).decode())
                linked=browser.new_page(viewport={'width':1100,'height':900});linked.on('pageerror',lambda e:errors.append(str(e)))
                linked.set_content(source,wait_until='load');require(linked.locator('main.gallery .card').count()==2);linked.screenshot(path=str(OUT/'gallery.png'))
                linked.set_content((ROOT/'dist/index.html').read_text(),wait_until='load');linked.wait_for_function('window.WarpArchive?.getState().plansReady===5',timeout=60000);require(linked.evaluate('WarpArchive.getState().engine==="WEBGL 2"'))
                return {'galleryRendered':True,'linkedPathsExist':True,'originalRendererStillWorks':True,'localhostNavigation':'Not verified: blocked by administrator browser policy'}
            check('Gallery renders, linked targets exist, and preserved original still renders',linked)
            check('No unhandled JavaScript errors',lambda:require(not errors,errors))
            browser.close()
    finally:server.shutdown();server.server_close()
report={'suite':'matrix-browser','passed':all(c['passed'] for c in checks),'checks':checks,'errors':errors,'limitations':['Browser navigation to localhost and file URLs is blocked by administrator policy; page rendering tested with inline content, linked targets verified on disk.'],'environment':'Linux headless Chromium, software GL; viewport simulation, not physical phone/GPU throughput'}
(OUT/'browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
if not report['passed']:sys.exit(1)
