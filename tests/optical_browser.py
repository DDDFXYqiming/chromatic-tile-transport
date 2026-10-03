"""Headless acceptance for PHASE: paired narratives, real pixels and accessible controls."""
import argparse
import functools
import hashlib
import json
import sys
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from serve import RangeRequestHandler


def run(output):
    output.mkdir(parents=True, exist_ok=True)
    chapters = next(c for c in json.loads((ROOT/'src/studies/catalog.json').read_text(encoding='utf-8')) if c['id'] == 'optical')['chapters']
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(RangeRequestHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    checks, errors, failed, playback = [], [], [], []
    url = f'http://127.0.0.1:{server.server_port}/dist/optical-vault.html'

    def check(name, value):
        assert value, name
        checks.append(name)
        print('PASS', name, flush=True)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={'width':1440, 'height':900}, device_scale_factor=1)
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('response', lambda r: failed.append(r.url) if r.status >= 400 and 'favicon' not in r.url else None)
            page.goto(url)
            page.wait_for_function('window.VisualStudy && VisualStudy.inspect().frame > 0')
            inspect = lambda: page.evaluate('VisualStudy.inspect()')
            digest = lambda: hashlib.sha256(page.locator('#canvas').screenshot()).hexdigest()

            def pause():
                page.evaluate('VisualStudy.pause()')
                page.wait_for_timeout(80)

            def choose(chapter):
                page.locator(f'.study-strip [data-scene="{chapter["id"]}"]').click()
                page.wait_for_timeout(80)

            def copy_matches(c):
                return (inspect()['chapter'] == c['id'] and inspect()['world'] == c['world'] and inspect()['art'] == c['image'] and
                        page.locator('h1').inner_text().replace('\n', '') == ''.join(c['headline']) and
                        page.locator('.hero-copy > p').inner_text() == c['body'] and
                        page.locator('.optical-journal h2').inner_text() == c['feature'] and
                        page.locator('.optical-journal > p').inner_text() == c['detail'] and
                        page.locator('.optical-note').inner_text() == c['note'] and
                        page.locator('.optical-specs dt').all_text_contents() == [s[0] for s in c['specs']] and
                        page.locator('#interact > span').inner_text() == c['action'] and
                        page.locator('.optical-worlds [aria-pressed="true"]').get_attribute('data-world') == c['world'])

            check('both original world images decoded', inspect()['texturesLoaded'] == 2)
            check('eight peer links retain page 06', page.locator('.hall-modes > a').count() == 8 and page.locator('.hall-modes [aria-current]').get_attribute('href') == 'optical-vault.html')
            check('four local chapters have decoded art', page.locator('.study-strip > button').count() == 4 and page.locator('.study-strip img').evaluate_all('(imgs)=>imgs.every(i=>i.naturalWidth>0)'))
            pause()
            hashes = []
            for width, height in [(1440,900), (1024,768), (768,1024), (390,844), (320,568)]:
                page.set_viewport_size({'width':width, 'height':height})
                for chapter in chapters:
                    choose(chapter)
                    label = f'{width}px {chapter["id"]}'
                    page.evaluate('scrollTo(0,0)')
                    if width in (1440,390):
                        page.screenshot(path=str(output/f'{chapter["id"]}-{width}.png'), full_page=True)
                    check(label+' artwork and full narrative synchronized', copy_matches(chapter))
                    check(label+' local selection preserves URL and pause', page.url == url and not inspect()['playing'] and page.locator('.study-strip [aria-current]').get_attribute('data-scene') == chapter['id'])
                    check(label+' no horizontal overflow', page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
                    check(label+' header navigation clears the artwork', page.evaluate('document.querySelector(".hall-modes").getBoundingClientRect().bottom<=document.querySelector(".theater").getBoundingClientRect().top'))
                    check(label+' hero fits theater without wordmark overlap', page.evaluate('''()=>{
                        const a=document.querySelector('.hero-copy').getBoundingClientRect();
                        const b=document.querySelector('.optical-wordmark').getBoundingClientRect();
                        const t=document.querySelector('.theater').getBoundingClientRect();
                        return a.left>=t.left && a.right<=t.right+1 && a.top>=b.bottom+5 && a.bottom<=t.bottom-25;
                    }'''))
                    check(label+' selected card visible in strip', page.locator('.study-strip [aria-current]').evaluate('(e)=>{const a=e.getBoundingClientRect(),b=e.parentElement.getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1}'))
                    if width == 1440:
                        hashes.append(digest())
                if width < 620:
                    check(f'{width}px chapter strip remains in viewport', page.locator('.study-footer').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1}'))
                    page.evaluate('scrollTo(0,document.body.scrollHeight)')
                    check(f'{width}px reading controls clear the fixed strip at scroll end', page.locator('.optical-tools summary').evaluate('(e)=>e.getBoundingClientRect().bottom < document.querySelector(".study-footer").getBoundingClientRect().top'))
                    if width == 390:
                        page.screenshot(path=str(output/'mobile-reading.png'))
            check('four chapter canvases differ', len(set(hashes)) == 4)
            page.set_viewport_size({'width':1440, 'height':900})
            page.evaluate('scrollTo(0,0)')
            choose(chapters[0])
            still = digest()
            page.wait_for_timeout(250)
            check('paused pixels are stable', digest() == still)
            seam = page.get_by_role('slider', name='光学分界', exact=True)
            handle = page.locator('.optical-seam > span').bounding_box()
            bounds = page.locator('.theater').bounding_box()
            page.mouse.move(handle['x']+handle['width']/2, handle['y']+handle['height']/2)
            page.mouse.down()
            page.mouse.move(bounds['x']+bounds['width']*.60, handle['y']+handle['height']/2, steps=10)
            page.mouse.up()
            page.wait_for_timeout(100)
            check('drag changes real split pixels while keeping narrative', abs(inspect()['split']-.6)<.01 and digest()!=still and copy_matches(chapters[0]))
            seam.focus()
            page.keyboard.press('End')
            check('split slider End clamps to 91 percent', abs(inspect()['split']-.91)<.0001 and seam.get_attribute('aria-valuenow') == '91')
            page.keyboard.press('Home')
            check('split slider Home clamps to 53 percent', inspect()['split'] == .53)
            page.keyboard.press('ArrowRight')
            check('split slider keyboard nudges without chapter navigation', abs(inspect()['split']-.55)<.0001 and inspect()['chapter']=='night')
            page.locator('.optical-tools summary').click()
            control = page.get_by_role('slider', name='分界位置', exact=True)
            control.fill('70')
            control.dispatch_event('input')
            check('optical console shares the split state', inspect()['split'] == .7)
            page.get_by_role('button', name='重置', exact=True).click()
            check('reset restores split while retaining chapter', inspect()['split'] == .77 and copy_matches(chapters[0]))
            with page.expect_download() as download:
                page.get_by_role('button', name='保存画面', exact=True).click()
            download.value.save_as(str(output/'export.png'))
            check('real composite exports as PNG', (output/'export.png').stat().st_size>10000)
            page.get_by_role('button', name='黑白翻转', exact=True).click()
            page.wait_for_timeout(80)
            check('console flip opens paired research narrative', copy_matches(chapters[2]))
            page.locator('.optical-tools summary').click()
            page.locator('#interact').click()
            page.wait_for_timeout(80)
            check('hero CTA returns to paired product chapter', copy_matches(chapters[0]))
            page.locator('.optical-other button').click()
            page.wait_for_timeout(80)
            check('secondary narrative preview opens its world', copy_matches(chapters[2]))
            page.locator('#canvas').focus()
            page.keyboard.press('ArrowRight')
            page.wait_for_timeout(80)
            check('canvas arrow moves to next chapter', copy_matches(chapters[3]))
            page.locator('#study-next').click()
            page.wait_for_timeout(80)
            check('next wraps all four chapters', copy_matches(chapters[0]))
            page.locator('#study-prev').click()
            page.wait_for_timeout(80)
            check('previous wraps all four chapters', copy_matches(chapters[3]))
            choose(chapters[0])
            page.evaluate('VisualStudy.play()')
            choose(chapters[2])
            page.wait_for_timeout(150)
            sample=page.evaluate('''()=>({...VisualStudy.inspect(),
                clip:getComputedStyle(document.querySelector('.optical-main-overlay')).clipPath,
                wipe:parseFloat(document.querySelector('.theater').style.getPropertyValue('--optical-wipe'))})''')
            check('world transition renders intermediate frames', 0<sample['transition']<1)
            check('transition typography reveals with matching world', sample['clip']!='none' and sample['wipe']>0)
            playback.append(sample)
            page.screenshot(path=str(output/'transition-midpoint.png'))
            page.wait_for_function('VisualStudy.inspect().transition===1')
            check('world transition resolves complete copy', copy_matches(chapters[2]) and page.locator('.hero-copy').evaluate('(e)=>+getComputedStyle(e).opacity')==1)
            moving=digest()
            page.wait_for_timeout(450)
            check('live optical scene advances canvas pixels', moving != digest())
            playback.append(inspect())
            for c in [chapters[0],chapters[3],chapters[1]]:
                choose(c)
            page.wait_for_function('VisualStudy.inspect().transition===1')
            check('rapid reversal settles on last requested chapter', copy_matches(chapters[1]))
            choose(chapters[3])
            pause()
            check('pause during transition settles readable chapter', inspect()['transition']==1 and copy_matches(chapters[3]))
            page.locator('#about-open').click()
            check('notes open and pause safely', page.locator('#about').evaluate('(e)=>e.open') and not inspect()['playing'])
            page.keyboard.press('Escape')
            page.locator('.hall-open-atlas').click()
            check('gallery navigation still works', page.locator('.hall-atlas').is_visible())
            check('white world gallery uses readable theme ink', page.locator('.hall-atlas').evaluate('(e)=>getComputedStyle(e).color===getComputedStyle(document.body).color'))
            page.keyboard.press('Escape')
            page.locator('#clean').click()
            check('clean view hides narrative overlays', page.locator('.hero-copy').is_hidden() and page.locator('.optical-other').is_hidden())
            page.set_viewport_size({'width':390,'height':844})
            page.wait_for_timeout(100)
            check('mobile clean scene fills its canvas', page.evaluate('''()=>{
                const c=document.querySelector('#canvas'),d=c.getContext('2d').getImageData(0,Math.round(c.height*.75),c.width,1).data;
                const colours=new Set();for(let i=0;i<d.length;i+=4)colours.add(d[i]+','+d[i+1]+','+d[i+2]);return colours.size>30;
            }'''))
            page.screenshot(path=str(output/'mobile-clean.png'))
            page.locator('#clean').click()
            page.emulate_media(reduced_motion='reduce')
            page.reload()
            page.wait_for_function('window.VisualStudy && VisualStudy.inspect().frame>0')
            choose(chapters[2])
            check('reduced motion gives instant legible navigation', not inspect()['playing'] and inspect()['transition']==1 and copy_matches(chapters[2]))
            check('no browser exceptions', not errors)
            check('all local resources resolved', not failed)
            browser.close()
    finally:
        server.shutdown()
        (output/'results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors,'failed':failed,'playback':playback},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('TOTAL',len(checks),flush=True)


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'.local-generation/optical-review')
    run(parser.parse_args().output)
