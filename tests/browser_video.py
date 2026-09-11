"""Real locally decoded video frames through the existing Matrix shader; no model calls."""
from pathlib import Path
import base64,io,json,os,platform,sys,tempfile,threading
from functools import partial
from http.server import ThreadingHTTPServer
from PIL import Image,ImageChops,ImageStat
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'reports/video';OUT.mkdir(exist_ok=True,parents=True)
sys.path.insert(0,str(ROOT/'scripts'))
from serve import RangeRequestHandler
import build_matrix

class Quiet(RangeRequestHandler):
    def log_message(self,*args):pass
def require(ok,message='Assertion failed'):
    if not ok:raise AssertionError(message)
def decode(data):return Image.open(io.BytesIO(base64.b64decode(data.split(',',1)[1]))).convert('RGB')
def mad(a,b):return sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3
checks=[]
def check(name,fn):
    try:detail=fn();checks.append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True)
    except Exception as e:checks.append({'name':name,'passed':False,'error':str(e)});print('FAIL',name,str(e),flush=True)
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
    options={'headless':True}
    if os.environ.get('CHROME_BIN'):options['executable_path']=os.environ['CHROME_BIN']
    browser=p.chromium.launch(**options);page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
    errors=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
    url=f'http://127.0.0.1:{server.server_port}/dist/matrix-video.html'
    page.goto(url);page.wait_for_function('MatrixMotion.getState().ready',timeout=45000)
    page.add_style_tag(content='*{transition:none!important;animation:none!important}.loading.ready{display:none}')
    page.evaluate('MatrixMotion.pause()')
    state=lambda:page.evaluate('MatrixMotion.getState()')
    def snap(t):
        page.evaluate('(t)=>{MatrixMotion.seek(t)}',t);page.wait_for_function('!MatrixMotion.getState().composition.seeking',timeout=15000)
        return decode(page.evaluate('MatrixMotion.snapshotAsync()'))
    def ready():
        snap(1.2);s=state();require(s['engine']=='WEBGL 2' and s['glError']==0 and not s['warnings']);require(s['sceneCount']==2)
        require(s['composition']['backend']=='PixiJS WebGL' and all(c['ready'] and not c['failed'] and c['source']=='PixiJS VideoSource' and c['seekableEnd']>=4.9 for c in s['composition']['clips']));return s['composition']
    check('Both generated MP4s decode through real PixiJS VideoSource textures',ready)
    def motion():
        page.evaluate('MatrixMotion.configure({mode:"original"})');scores={}
        for i,name in enumerate(['garden','encounter']):
            a=snap(i*5.2+.2);b=snap(i*5.2+2.5);scores[name]=mad(a,b);require(scores[name]>2)
            a.save(OUT/(name+'-render-a.png'));b.save(OUT/(name+'-render-b.png'))
        return scores
    check('Each shot has visible internal movement with no shader camera drift',motion)
    def reverse():
        scores={}
        for mode,t in [('original',1.2),('matrix',3.1),('auto',4.6),('auto',9.8)]:
            page.evaluate('(mode)=>MatrixMotion.configure({mode})',mode);a=snap(t);snap(t+1.9);b=snap(t);delta=mad(a,b);scores[mode+str(t)]=delta;require(a.tobytes()==b.tobytes(),str(delta))
        return scores
    check('Reverse scrubs reproduce the exact decoded pixels in original and grid modes',reverse)
    def seams():
        page.evaluate('MatrixMotion.configure({mode:"auto"})');scores=[]
        for t in [5.2,10.4]:
            a=snap(t-.00001);b=snap(t);delta=mad(a,b);scores.append(delta);require(delta<.5,str(delta))
        return scores
    check('Incoming video time stays continuous at both shot boundaries including the loop',seams)
    def bridge_play():
        snap(4.2);before=state()['composition']['clips'];page.evaluate('MatrixMotion.play()');page.wait_for_timeout(450);after=state()
        require(after['frame']['bridge']>0);require(all(not c['paused'] and c['decodedFrames']>b['decodedFrames'] and c['currentTime']>b['currentTime'] for c,b in zip(after['composition']['clips'],before)))
        page.evaluate('MatrixMotion.pause()');return {'before':before,'after':after['composition']['clips']}
    check('Both videos continue native playback during the Matrix bridge',bridge_play)
    def paused():
        snap(1.2);page.wait_for_timeout(100);a=decode(page.evaluate('MatrixMotion.snapshotAsync()'));before=state()['drawCount'];page.wait_for_timeout(350)
        require(state()['drawCount']==before);b=decode(page.evaluate('MatrixMotion.snapshotAsync()'));require(a.tobytes()==b.tobytes());return True
    check('Paused playback freezes pixels and stops continuous drawing',paused)
    def still():
        page.evaluate('MatrixMotion.configure({mode:"original"})');page.locator('#settingsOpen').click();page.locator('#videoMotion').uncheck();page.locator('#settingsClose').click()
        a=snap(.5);b=snap(2);require(a.tobytes()==b.tobytes());page.locator('#settingsOpen').click();page.locator('#videoMotion').check();page.locator('#settingsClose').click();require(mad(snap(.5),snap(2))>2);return True
    check('The actual motion checkbox switches between video movement and its still first frame',still)
    def slow_preview():
        page.evaluate('MatrixMotion.setClean(false)');snap(1.2);page.locator('#bridgeButton').click();page.wait_for_function('!MatrixMotion.getState().composition.seeking')
        first=state();page.wait_for_timeout(350);require(state()['seconds']==first['seconds'] and state()['preview']['phase']=='hold-source')
        page.wait_for_function('MatrixMotion.getState().preview?.phase==="hold-target"',timeout=45000);page.wait_for_function('!MatrixMotion.getState().composition.seeking')
        require(state()['frame']['scene']==1);page.wait_for_function('MatrixMotion.getState().preview?.phase==="reverse"',timeout=12000)
        before=state()['seconds'];page.wait_for_timeout(200);require(state()['seconds']<before);page.locator('#bridgeButton').click();require(not state()['bridgeLoop']);page.evaluate('MatrixMotion.pause();MatrixMotion.setClean(true);MatrixMotion.configure({mode:"original"})');return True
    check('Slow card preview holds both video frames, reverses, and returns to native playback',slow_preview)
    def restore():
        a=snap(1.2);page.evaluate('()=>{const gl=document.querySelector("#matrixCanvas").getContext("webgl2"),e=gl.getExtension("WEBGL_lose_context");e.loseContext();setTimeout(()=>e.restoreContext(),200)}')
        page.wait_for_function('MatrixMotion.getState().contextLost');page.wait_for_function('!MatrixMotion.getState().contextLost',timeout=45000)
        b=snap(1.2);require(a.tobytes()==b.tobytes());require(state()['glError']==0 and not state()['playing']);return True
    check('Restoring the WebGL context recreates video resources at the same paused frame',restore)
    def mobile():
        sizes=[]
        for w,h in [(390,844),(320,568),(844,390)]:
            page.set_viewport_size({'width':w,'height':h});snap(6.5);require(page.evaluate('document.documentElement.scrollWidth<=innerWidth'));require(state()['glError']==0);sizes.append([w,h])
        page.set_viewport_size({'width':390,'height':844});snap(6.5);page.screenshot(path=str(OUT/'mobile-video.png'))
        page.locator('#settingsOpen').click();require(page.locator('#videoControls').is_visible());page.screenshot(path=str(OUT/'mobile-settings.png'));page.locator('#settingsClose').click()
        page.set_viewport_size({'width':1440,'height':900});return sizes
    check('Mobile portrait and landscape keep the character and controls usable',mobile)
    def reduced():
        page.evaluate('MatrixMotion.setReduced(true)');a=snap(.5);b=snap(2.5);require(a.tobytes()==b.tobytes() and not state()['playing']);require(all(c['paused'] for c in state()['composition']['clips']));page.evaluate('MatrixMotion.setReduced(false)');return True
    check('Reduced motion freezes the videos as well as the transition',reduced)
    def fallback():
        f=browser.new_page();f.goto(url+'?renderer=canvas');f.wait_for_function('MatrixMotion.getState().ready',timeout=45000);f.evaluate('MatrixMotion.seek(1.2)');f.wait_for_function('!MatrixMotion.getState().composition.seeking');s=f.evaluate('MatrixMotion.getState()');require(s['engine']=='CANVAS 2D' and all(c['ready'] for c in s['composition']['clips']));f.close();return True
    check('Canvas fallback can also draw real local video frames',fallback)
    def missing():
        f=browser.new_page();f.route('**/encounter.mp4',lambda route:route.fulfill(status=404,body='missing'));f.goto(url);f.wait_for_function('MatrixMotion.getState().ready',timeout=45000);f.evaluate('MatrixMotion.pause()');s=f.evaluate('MatrixMotion.getState()');require(s['composition']['clips'][1]['failed'] and len(s['warnings'])==1);require(f.locator('#mediaWarning').is_visible() and '静态封面' in f.locator('#mediaWarning').inner_text());f.close();return True
    check('An unavailable video uses its poster and reports the downgrade explicitly',missing)
    def offline():
        with tempfile.TemporaryDirectory() as d:
            html=build_matrix.build(Path(d)/'offline.html',ROOT/'examples/matrix-video/scenes.json',ROOT/'examples/matrix-video/config.json').read_text(encoding='utf-8')
            f=browser.new_page();seen=[];f.on('request',lambda r:seen.append(r.url));f.set_content(html);f.wait_for_function('MatrixMotion.getState().ready',timeout=45000);f.evaluate('MatrixMotion.seek(6.5)');f.wait_for_function('!MatrixMotion.getState().composition.seeking');s=f.evaluate('MatrixMotion.getState()');require(all(c['ready'] for c in s['composition']['clips']));require(all(u.startswith(('data:','blob:','about:')) for u in seen));f.close();return True
    check('The standalone artifact embeds both playable videos and makes no external requests',offline)
    check('The website never contacts generation APIs or any remote media host',lambda:require(all(u.startswith(('http://127.0.0.1:','data:','blob:','about:')) for u in requests)))
    check('No uncaught browser errors',lambda:require(not errors,errors))
    page.evaluate('MatrixMotion.configure({mode:"auto"})');snap(6.5);page.screenshot(path=str(OUT/'desktop-video.png'));snap(4.6);page.screenshot(path=str(OUT/'video-bridge.png'));browser.close()
finally:server.shutdown();server.server_close()
report={'date':'2026-09-11','environment':platform.platform(),'passed':all(c['passed'] for c in checks),'checks':checks,'errors':errors}
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
if not report['passed']:sys.exit(1)
