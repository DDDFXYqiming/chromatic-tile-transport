"""Headless content, playback and geometry acceptance for PENUMBRA / study 07."""
import argparse
import functools
import hashlib
import json
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def run(output):
    output.mkdir(parents=True, exist_ok=True)
    chapters = next(c for c in json.loads((ROOT/'src/studies/catalog.json').read_text(encoding='utf-8')) if c['id']=='shadow')['chapters']
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    checks, errors, failed = [], [], []
    def check(name, value):
        assert value, name
        checks.append(name)
        print('PASS', name, flush=True)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={'width':1440, 'height':900}, device_scale_factor=1,
                record_video_dir=str(output/'recording'), record_video_size={'width':1440, 'height':900})
            page = context.new_page()
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('response', lambda r: failed.append(r.url) if r.status>=400 and 'favicon' not in r.url else None)
            page.goto(f'http://127.0.0.1:{server.server_port}/dist/shadow-apparatus.html')
            page.wait_for_function('window.VisualStudy && VisualStudy.inspect().frame>0')
            inspect = lambda: page.evaluate('VisualStudy.inspect()')
            def pause():
                page.evaluate('VisualStudy.pause()')
                page.wait_for_timeout(90)
            def matches(c):
                return (inspect()['chapter']==c['id'] and inspect()['art']==c['image']
                    and page.locator('h1').inner_text().replace('\n','')==''.join(c['headline'])
                    and page.locator('.hero-copy>p').inner_text()==c['body']
                    and page.locator('.shadow-folio h2').inner_text()==c['feature']
                    and page.locator('.shadow-folio p').inner_text()==c['detail']
                    and page.locator('.shadow-experiment-copy h2').inner_text()==c['experiment']
                    and page.locator('.shadow-experiment-copy>p').first.inner_text()==c['observation']
                    and page.locator('.shadow-art-caption p').inner_text()==c['note']
                    and page.locator('.shadow-plate.is-current').get_attribute('src').endswith(c['image']))
            def digest(selector='#canvas'):
                return hashlib.sha256(page.locator(selector).screenshot()).hexdigest()
            def change(label,value):
                el=page.get_by_label(label,exact=True)
                el.fill(str(value));el.dispatch_event('input');page.wait_for_timeout(100)
            check('four chapter images decode', inspect()['texturesLoaded']==4)
            check('eight peer links retain page 07', page.locator('.hall-modes>a').count()==8 and
                  page.locator('.hall-modes [aria-current]').get_attribute('href')=='shadow-apparatus.html')
            check('four distinct local filmstrip thumbnails', page.locator('.study-strip img').evaluate_all(
                '(imgs)=>imgs.length===4&&new Set(imgs.map(i=>i.src)).size===4&&imgs.every(i=>i.naturalWidth===1536)'))
            pause()
            for width,height in [(1440,900),(1920,1080),(1024,768),(768,1024),(390,844),(320,568)]:
                page.set_viewport_size({'width':width,'height':height})
                for c in chapters:
                    card=page.locator(f'.study-strip [data-scene="{c["id"]}"]')
                    card.click();page.wait_for_timeout(100)
                    name=f'{width}px {c["id"]}'
                    check(name+' complete content and art synchronize',matches(c))
                    check(name+' preset and pause synchronize',not inspect()['playing'] and
                          abs(inspect()['angle']-c['angle']*3.141592653589793/180)<1e-8 and card.get_attribute('aria-pressed')=='true')
                    check(name+' layout fits and copy does not overlap',page.evaluate('''()=>{
                        const rect=s=>document.querySelector(s).getBoundingClientRect();
                        const a=rect('.hero-copy'),b=rect('.shadow-folio'),h=rect('h1'),e=rect('.shadow-edition'),t=rect('.theater');
                        return document.documentElement.scrollWidth<=innerWidth+1&&a.bottom+10<=b.top&&
                          h.top>=e.bottom&&h.left>=0&&h.right<=innerWidth&&b.bottom<=t.bottom;
                    }'''))
                    check(name+' all reading blocks stay visible', all(page.locator(s).is_visible() for s in
                          ['.hero-copy>p','.eyebrow','#interact','.shadow-folio p','.shadow-experiment-copy>p:not(#status)']))
                    if width in (1440,390):
                        page.evaluate('scrollTo(0,0)')
                        page.screenshot(path=str(output/f'{c["id"]}-{width}.png'))
                        # Capture the editorial plate without the sticky navigation covering its lower text.
                        page.locator('.study-footer').evaluate('(e)=>e.style.visibility="hidden"')
                        page.locator('.theater').screenshot(path=str(output/f'{c["id"]}-{width}-plate.png'))
                        page.locator('.study-footer').evaluate('(e)=>e.style.visibility=""')
            page.set_viewport_size({'width':1440,'height':900})
            page.locator('.study-strip [data-scene="silhouette"]').click()
            count=inspect()['voxels']
            a=digest()
            page.get_by_role('button',name='对齐菱影 · 90°',exact=True).click();page.wait_for_timeout(100)
            check('light changes projection without changing the solid',digest()!=a and inspect()['voxels']==count and abs(inspect()['angle']-3.141592653589793/2)<1e-8)
            def projection():
                return page.locator('#canvas').evaluate('''c=>{
                    const out=document.createElement('canvas');out.width=c.width/2;out.height=c.height;
                    out.getContext('2d').drawImage(c,c.width/2,0,c.width/2,c.height,0,0,out.width,out.height);return out.toDataURL();
                }''')
            a=projection();change('观察雕塑',105)
            check('viewpoint changes only the model, not the projected silhouette',projection()==a and abs(inspect()['orbit']-105*3.141592653589793/180)<1e-8)
            page.locator('#canvas').focus();page.keyboard.press('ArrowLeft');page.wait_for_timeout(100)
            check('keyboard light control works',abs(inspect()['angle']-87*3.141592653589793/180)<1e-8)
            page.locator('#reset').click();page.wait_for_timeout(100)
            check('reset restores current chapter pose',inspect()['chapter']=='silhouette' and inspect()['angle']==0)
            page.locator('.shadow-workbench').scroll_into_view_if_needed()
            page.screenshot(path=str(output/'live-experiment.png'))
            with page.expect_download() as download:
                page.locator('#snapshot').click()
            download.value.save_as(str(output/'exported-projection.png'))
            check('experiment exports a real PNG', (output/'exported-projection.png').stat().st_size>10000)
            page.evaluate('scrollTo(0,0)');page.evaluate('VisualStudy.play()')
            page.locator('.study-strip [data-scene="boundary"]').click();page.wait_for_timeout(220)
            motion=page.evaluate('''()=>({progress:VisualStudy.inspect().transition,
                art:getComputedStyle(document.querySelector('.shadow-art')).opacity,
                copy:getComputedStyle(document.querySelector('.hero-copy')).opacity})''')
            check('live transition has intermediate art and copy frames',0<motion['progress']<1 and
                  motion['art']==motion['copy'] and matches(chapters[1]))
            page.screenshot(path=str(output/'transition.png'))
            page.wait_for_function('VisualStudy.inspect().transition===1')
            a=page.locator('.shadow-plate.is-current').evaluate('(e)=>e.style.transform')
            page.wait_for_timeout(700)
            check('actual playback moves the photograph',page.locator('.shadow-plate.is-current').evaluate('(e)=>e.style.transform')!=a)
            page.locator('.study-strip [data-scene="depth"]').click()
            page.locator('.study-strip [data-scene="silhouette"]').click()
            page.locator('.study-strip [data-scene="alignment"]').click()
            page.wait_for_function('VisualStudy.inspect().transition===1')
            check('rapid switching settles to latest complete chapter',matches(chapters[3]))
            page.locator('#interact').click();page.wait_for_function('VisualStudy.inspect().transition===1')
            check('editorial CTA wraps content',matches(chapters[0]))
            try:
                page.wait_for_function('VisualStudy.inspect().chapter==="boundary"',timeout=28000)
            except Exception:
                print('Autoplay state',json.dumps(inspect()),flush=True)
                raise
            page.wait_for_function('VisualStudy.inspect().transition===1')
            check('real-time playback advances entire chapter',matches(chapters[1]) and page.locator('.study-strip [aria-current]').get_attribute('data-scene')=='boundary')
            page.get_by_role('button',name='扫描光源',exact=True).click();page.wait_for_timeout(200)
            a=inspect()['angle'];page.wait_for_timeout(500)
            check('scan continuously moves real light',inspect()['angle']!=a)
            pause();a=digest();page.wait_for_timeout(350)
            check('pause holds geometry and live scan',digest()==a)
            page.locator('#study-next').click();page.wait_for_timeout(100)
            check('footer next changes chapter while staying paused',matches(chapters[2]) and not inspect()['playing'])
            page.locator('#study-prev').click();page.wait_for_timeout(100)
            check('footer previous restores chapter',matches(chapters[1]))
            page.locator('#clean').click()
            check('clean view hides all editorial layers',all(page.locator(s).is_hidden() for s in
                ['.hero-copy','.shadow-edition','.shadow-folio','.shadow-art-caption','.shadow-chapter-mark']))
            page.locator('#clean').click()
            page.locator('.hall-open-atlas').click()
            check('eight-experience navigation still opens',page.locator('.hall-atlas').is_visible())
            page.keyboard.press('Escape')
            page.emulate_media(reduced_motion='reduce');page.reload()
            page.wait_for_function('window.VisualStudy && VisualStudy.inspect().frame>0')
            page.set_viewport_size({'width':390,'height':844})
            for c in chapters:
                card=page.locator(f'.study-strip [data-scene="{c["id"]}"]')
                card.focus();page.keyboard.press('Enter');page.wait_for_timeout(100)
                check('reduced motion keyboard '+c['id'],matches(c) and not inspect()['playing'] and inspect()['transition']==1)
            check('no browser errors or missing assets',not errors and not failed)
            video=page.video;context.close();video.save_as(str(output/'shadow-playback.webm'));browser.close()
    finally:
        server.shutdown()
    (output/'results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors,'failed_requests':failed},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('TOTAL',len(checks),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'runs/six-studies-s07-shadow/shadow-browser')
    run(parser.parse_args().output)
