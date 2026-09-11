"""Exercise the shared Matrix page chrome, retained collections and modal playback."""
from pathlib import Path
import json,os,sys,threading,platform
from functools import partial
from http.server import ThreadingHTTPServer
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'reports/interface';OUT.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(ROOT/'scripts'))
from serve import RangeRequestHandler
class Quiet(RangeRequestHandler):
    def log_message(self,*args):pass
def require(ok,message='Assertion failed'):
    if not ok:raise AssertionError(message)
checks=[]
def check(name,fn):
    try:detail=fn();checks.append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True)
    except Exception as e:checks.append({'name':name,'passed':False,'error':str(e)});print('FAIL',name,str(e),flush=True)
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
    launch={'headless':True}
    if os.environ.get('CHROME_BIN'):launch['executable_path']=os.environ['CHROME_BIN']
    browser=p.chromium.launch(**launch);page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    def load(profile):
        page.goto(f'http://127.0.0.1:{server.server_port}/dist/matrix-{profile}.html');page.wait_for_function('MatrixMotion.getState().ready',timeout=45000)
        page.add_style_tag(content='*{transition:none!important;animation:none!important}.loading.ready{display:none}')
        page.evaluate('MatrixMotion.pause();MatrixMotion.seekAsync(1.2)')
    state=lambda:page.evaluate('MatrixMotion.getState()')
    def collections():
        counts={}
        for profile,variant,count in [('motion','mesh',3),('video','video',2),('anime','anime',5),('battle','battle',5)]:
            load(profile);s=state();require(s['sceneCount']==count and s['engine']=='WEBGL 2' and s['glError']==0)
            require(page.locator('.top-actions > button').count()==4);require(page.locator('.hero-copy').is_visible() and page.locator('.specimen-card').is_visible())
            require(page.locator('#heroLine1').inner_text()==page.evaluate('MATRIX_DATA.scenes[0].line1'));require(page.locator('#sceneEnglish').inner_text()==page.evaluate('MATRIX_DATA.scenes[0].en'))
            require(page.locator('#cellCount').inner_text()==f"{s['grid']['cols']*s['grid']['rows']:,} CELLS")
            page.locator('#galleryOpen').click();require(page.locator('.gallery-item').count()==count)
            require(page.locator('.collection-links a').count()==4 and page.locator('.collection-links [aria-current="page"]').get_attribute('data-variant')==variant)
            for link in page.locator('.collection-links a').all():require((ROOT/'dist'/link.get_attribute('href').split('/')[-1]).is_file())
            page.locator('#galleryClose').click();counts[profile]=count;page.screenshot(path=str(OUT/f'{profile}-desktop.png'))
        return counts
    check('The original garden and all three video collections retain full page components',collections)
    def navigation():
        load('motion');page.locator('#galleryOpen').click();page.locator('.gallery-item').nth(2).click();s=state();require(s['frame']['scene']==2 and not s['playing']);require(not page.locator('#gallery').evaluate('(e)=>e.open'))
        for selector in ['.gallery-item','.film-item','.rail-dot']:require(page.locator(selector).nth(2).get_attribute('aria-current')=='true')
        require(page.locator('#heroCaption').inner_text()==page.evaluate('MATRIX_DATA.scenes[2].caption'))
        page.locator('#nextHero').click();require(state()['frame']['scene']==0);page.locator('.rail-dot').nth(1).click();require(state()['frame']['scene']==1)
        return True
    check('Archive selection, side navigation, hero action and chapter copy stay synchronized',navigation)
    def modal_playback():
        result=[]
        for profile in ['motion','battle']:
            load(profile);page.evaluate('MatrixMotion.play()');page.wait_for_timeout(160);page.locator('#galleryOpen').click();page.evaluate('MatrixMotion.snapshotAsync()');a=state();page.wait_for_timeout(400);b=state()
            require(a['seconds']==b['seconds'],'The clock moved beneath the archive')
            if profile=='battle':require(all(c['paused'] for c in b['composition']['clips']))
            page.keyboard.press('Escape');require(not page.locator('#gallery').evaluate('(e)=>e.open'));require(page.locator('#galleryOpen').evaluate('(e)=>document.activeElement===e'))
            page.wait_for_timeout(250);require(state()['seconds']>b['seconds'] and state()['playing']);page.evaluate('MatrixMotion.pause()');result.append(profile)
        return result
    check('Opening the archive freezes image and video motion; Escape restores focus and playback',modal_playback)
    def paused_dialog():
        page.locator('#galleryOpen').click();before=state()['seconds'];page.locator('#galleryClose').click();page.wait_for_timeout(200);require(state()['seconds']==before and not state()['playing']);require(page.locator('#manualIndicator').is_visible());return True
    check('Closing the archive preserves a deliberately paused timeline',paused_dialog)
    def viewing_modes():
        page.locator('#settingsOpen').click();page.locator('#clean').check();page.locator('#settingsClose').click();require(not page.locator('.hero-copy').is_visible() and not page.locator('.specimen-card').is_visible());require(page.locator('#playButton').is_visible())
        require(page.locator('.image-shade').evaluate('(e)=>getComputedStyle(e).opacity')=='0')
        page.evaluate('MatrixMotion.setClean(false)');page.locator('#immersive').click();require(not page.locator('.topbar').is_visible() and page.locator('#exitImmersive').is_visible());page.locator('#exitImmersive').click();require(page.locator('#galleryOpen').is_visible() and page.locator('.hero-copy').is_visible());return True
    check('Pure image and immersive modes remain available without losing the full page view',viewing_modes)
    def layouts():
        results=[]
        for profile in ['motion','battle']:
            load(profile)
            for w,h in [(1731,1184),(1161,790),(390,844),(320,568),(844,390)]:
                page.set_viewport_size({'width':w,'height':h});page.evaluate('MatrixMotion.seekAsync(1.2)')
                require(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'{profile} {w} page overflow')
                geometry=page.evaluate('''()=>{const r=s=>{const x=document.querySelector(s).getBoundingClientRect();return {l:x.left,r:x.right,t:x.top,b:x.bottom}};return {hero:r('.hero-copy'),card:r('.specimen-card'),stage:r('#stage')}}''')
                a,b=geometry['hero'],geometry['card'];require(a['r']<=b['l'] or a['l']>=b['r'] or a['b']<=b['t'] or a['t']>=b['b'],f'{profile} {w} title overlaps status')
                require(a['t']>=geometry['stage']['t'] and a['b']<=geometry['stage']['b'],f'{profile} {w} title clipped')
                if w in [1731,390,320]:page.screenshot(path=str(OUT/f'{profile}-{w}.png'))
                page.locator('#galleryOpen').click();require(page.locator('#gallery').evaluate('(e)=>e.scrollWidth<=e.clientWidth'))
                if w==390:page.screenshot(path=str(OUT/f'{profile}-gallery-mobile.png'))
                page.locator('#galleryClose').click();page.locator('#settingsOpen').click();require(page.locator('#settings').evaluate('(e)=>e.scrollWidth<=e.clientWidth'));page.locator('#settingsClose').click();results.append([profile,w,h])
        page.set_viewport_size({'width':1440,'height':900});return results
    check('Desktop, small phone and landscape layouts avoid component overlap and horizontal scroll',layouts)
    check('Shared page components have no uncaught browser errors',lambda:require(not errors,errors))
    browser.close()
finally:server.shutdown();server.server_close()
report={'date':'2026-09-12','environment':platform.platform(),'passed':all(c['passed'] for c in checks),'checks':checks,'errors':errors}
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
if not report['passed']:sys.exit(1)
