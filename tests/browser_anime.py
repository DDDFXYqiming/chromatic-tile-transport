"""Validate the five generated anime clips through actual browser decoding and playback."""
from pathlib import Path
import argparse,base64,io,json,os,platform,sys,tempfile,threading,hashlib
from functools import partial
from http.server import ThreadingHTTPServer
from PIL import Image,ImageChops,ImageStat
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--profile',choices=['anime','battle'],default='anime');PROFILE=parser.parse_args().profile
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'reports'/PROFILE;OUT.mkdir(exist_ok=True,parents=True)
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
    page.goto(f'http://127.0.0.1:{server.server_port}/dist/matrix-{PROFILE}.html');page.wait_for_function('MatrixMotion.getState().ready',timeout=45000)
    page.add_style_tag(content='*{transition:none!important;animation:none!important}.loading.ready{display:none}')
    page.evaluate('MatrixMotion.pause()');state=lambda:page.evaluate('MatrixMotion.getState()');shot=state()['config']['shotSeconds']
    def snap(t):
        page.evaluate('(t)=>{MatrixMotion.seek(t)}',t);page.wait_for_function('!MatrixMotion.getState().composition.seeking',timeout=15000)
        return decode(page.evaluate('MatrixMotion.snapshotAsync()'))
    def ready():
        snap(1);s=state();require(s['sceneCount']==5 and s['engine']=='WEBGL 2' and s['glError']==0 and not s['warnings']);require(len(s['composition']['clips'])==5 and all(c['ready'] and not c['failed'] for c in s['composition']['clips']));require(abs(s['frame']['total']-21.5)<1e-8);return s['composition']
    check('Five real anime videos load with a 21.5-second cycle',ready)
    def shots():
        page.evaluate('MatrixMotion.configure({mode:"original"})');hashes=set();scores={}
        for i in range(5):
            a=snap(i*shot+.2);b=snap(i*shot+2.5);hashes.add(hashlib.sha256(a.tobytes()).hexdigest());scores[str(i+1)]=mad(a,b);require(scores[str(i+1)]>5)
            a.save(OUT/f'shot-{i+1}-a.png');b.save(OUT/f'shot-{i+1}-b.png')
        require(len(hashes)==5);return {'meanPixelChanges':scores,'note':'Pixel differences demonstrate change, not an anatomy or aesthetic score.'}
    check('All five shots are different and contain substantial image changes',shots)
    def seams():
        page.evaluate('MatrixMotion.configure({mode:"auto"})');deltas=[]
        for i in range(1,6):
            d=mad(snap(i*shot-.00001),snap(i*shot));deltas.append(d);require(d<.5,str(d))
        return deltas
    check('All five video and grid boundaries join continuously including last-to-first',seams)
    def reverse():
        for t in [1.2,7.8,12.7,20.9]:
            a=snap(t);snap(t+2.3);b=snap(t);require(a.tobytes()==b.tobytes())
        return True
    check('Scrubbing across five sources returns exact decoded pixels',reverse)
    def playing():
        snap(shot-.65);before=state()['composition']['clips'];page.evaluate('MatrixMotion.play()');page.wait_for_timeout(350);after=state()
        require(after['frame']['bridge']>0);require(all(after['composition']['clips'][i]['decodedFrames']>before[i]['decodedFrames'] and not after['composition']['clips'][i]['paused'] for i in [0,1]));require(all(c['paused'] for c in after['composition']['clips'][2:]));page.evaluate('MatrixMotion.pause()');return True
    check('Only the two bridging videos play while the other three remain paused',playing)
    def controls():
        require(page.locator('.film-item').count()==5);page.locator('.film-item').nth(4).click();require(state()['frame']['scene']==4)
        page.locator('#settingsOpen').click();require(page.locator('#'+PROFILE+'Variant').get_attribute('aria-current')=='page');require(page.locator('#battleVariant').get_attribute('href').endswith('matrix-battle.html'));require(page.locator('#animeVariant').get_attribute('href').endswith('matrix-anime.html'));require(page.locator('#videoVariant').get_attribute('href').endswith('matrix-video.html'));require(page.locator('#meshVariant').get_attribute('href').endswith('matrix-motion.html'));page.locator('#settingsClose').click();return True
    check('All five filmstrip buttons and the four version links are available',controls)
    def mobile():
        sizes=[]
        for w,h in [(390,844),(320,568),(844,390)]:
            page.set_viewport_size({'width':w,'height':h});snap(2*shot+1);require(page.evaluate('document.documentElement.scrollWidth<=innerWidth'));require(state()['glError']==0);sizes.append([w,h])
        page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(OUT/'mobile.png'));page.locator('#settingsOpen').click();page.screenshot(path=str(OUT/'mobile-settings.png'));page.locator('#settingsClose').click();page.set_viewport_size({'width':1440,'height':900});return sizes
    check('Five-shot navigation fits mobile portrait and landscape layouts',mobile)
    def offline():
        with tempfile.TemporaryDirectory() as d:
            html=build_matrix.build(Path(d)/'offline.html',ROOT/f'examples/matrix-{PROFILE}/scenes.json',ROOT/f'examples/matrix-{PROFILE}/config.json').read_text(encoding='utf-8');f=browser.new_page();seen=[];f.on('request',lambda r:seen.append(r.url));f.set_content(html);f.wait_for_function('MatrixMotion.getState().ready',timeout=45000);f.evaluate('MatrixMotion.seek(18.5)');f.wait_for_function('!MatrixMotion.getState().composition.seeking',timeout=15000);s=f.evaluate('MatrixMotion.getState()');require(s['sceneCount']==5 and all(c['ready'] for c in s['composition']['clips']));require(all(u.startswith(('data:','blob:','about:')) for u in seen));f.close();return True
    check('Offline output embeds and decodes all five videos without remote requests',offline)
    check('Normal playback makes no calls to model or external media services',lambda:require(all(u.startswith(('http://127.0.0.1:','data:','blob:','about:')) for u in requests)))
    check('No uncaught browser errors',lambda:require(not errors,errors))
    snap(1.2);page.screenshot(path=str(OUT/'desktop.png'));snap(shot-.425);page.screenshot(path=str(OUT/'matrix-bridge.png'));browser.close()
finally:server.shutdown();server.server_close()
report={'profile':PROFILE,'date':'2026-09-11','environment':platform.platform(),'passed':all(c['passed'] for c in checks),'checks':checks,'errors':errors}
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
if not report['passed']:sys.exit(1)
