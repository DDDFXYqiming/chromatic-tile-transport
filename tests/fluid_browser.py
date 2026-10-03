"""Real playback, chapter content and flow acceptance for study 05 / INKFIELD."""
import argparse
import functools
import hashlib
import json
import sys
import threading
import time
from http.server import ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from serve import RangeRequestHandler


def run(output):
    output.mkdir(parents=True, exist_ok=True)
    chapters = next(x for x in json.loads((ROOT/'src/studies/catalog.json').read_text(encoding='utf-8')) if x['id'] == 'fluid')['chapters']
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(RangeRequestHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    checks, errors, failed, playback = [], [], [], []
    url = f'http://127.0.0.1:{server.server_port}/dist/liquid-canvas.html'

    def check(name, value):
        assert value, name
        checks.append(name)
        print('PASS', name, flush=True)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={'width':1440,'height':900}, device_scale_factor=1)
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('response', lambda response: failed.append(response.url) if response.status >= 400 and 'favicon' not in response.url else None)
            page.goto(url)
            page.wait_for_function('window.VisualStudy && VisualStudy.inspect().frame>0')
            inspect = lambda: page.evaluate('VisualStudy.inspect()')

            def settle():
                started=time.monotonic()
                try:
                    page.wait_for_function('VisualStudy.inspect().transition===1')
                finally:
                    state=inspect()
                    playback.append({'wait_seconds':round(time.monotonic()-started,3),'state':state})
                    print('PLAYBACK',json.dumps(playback[-1],ensure_ascii=False),flush=True)

            def pause():
                page.evaluate('VisualStudy.pause()')
                page.wait_for_timeout(100)

            def digest():
                return hashlib.sha256(page.locator('#canvas').screenshot()).hexdigest()

            def choose(chapter):
                page.locator(f'.study-strip [data-scene="{chapter["id"]}"]').click()
                page.wait_for_timeout(100)

            def copy_matches(c):
                return (inspect()['chapter'] == c['id'] and inspect()['art'] == c['image'] and
                        page.locator('h1').inner_text().replace('\n','') == ''.join(c['headline']) and
                        page.locator('.hero-copy > p').inner_text() == c['body'] and
                        page.locator('.stage-tag b').inner_text() == c['kicker'] and
                        page.locator('.fluid-folio h2').inner_text() == c['feature'] and
                        page.locator('.fluid-folio > p').inner_text() == c['detail'] and
                        page.locator('.fluid-folio-top b').inner_text() == c['material'] and
                        page.locator('.fluid-note > p').inner_text() == c['note'] and
                        page.locator('.fluid-note > small').inner_text() == c['annotation'] and
                        page.locator('#interact > span').inner_text() == c['action'] and
                        page.locator('.fluid-swatches span').all_text_contents() == c['swatchNames'])

            check('four original chapter paintings decoded', inspect()['texturesLoaded'] == 4)
            check('native-resolution texture flow available', inspect()['renderer'] == 'texture-flow')
            check('eight peer links keep study 05 selected', page.locator('.hall-modes > a').count() == 8 and page.locator('.hall-modes [aria-current]').get_attribute('href') == 'liquid-canvas.html')
            check('four local chapter buttons with distinct art', page.locator('.study-strip > button').count() == 4 and page.locator('.study-strip a').count() == 0 and page.locator('.study-strip img').evaluate_all('(imgs)=>new Set(imgs.map(i=>i.src)).size===4&&imgs.every(i=>i.naturalWidth>0)'))
            pause()
            hashes = []
            for width, height in [(1440,900),(1024,768),(768,1024),(390,844),(320,568)]:
                page.set_viewport_size({'width':width,'height':height})
                for chapter in chapters:
                    choose(chapter)
                    label = f'{width}px {chapter["id"]}'
                    check(label+' full chapter copy and artwork synchronized', copy_matches(chapter))
                    check(label+' navigation and pause preserved', page.url == url and not inspect()['playing'] and page.locator('.study-strip [aria-current]').get_attribute('data-scene') == chapter['id'])
                    check(label+' no horizontal overflow', page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
                    check(label+' editorial blocks do not overlap', page.evaluate('''()=>{
                        const boxes=['.hero-copy','.fluid-folio','.fluid-note','.fluid-edition','.fluid-stamp'].map(s=>document.querySelector(s).getBoundingClientRect());
                        const t=document.querySelector('.theater').getBoundingClientRect();
                        return boxes.every((a,i)=>a.left>=t.left&&a.right<=t.right+1&&a.top>=t.top&&a.bottom<=t.bottom&&
                          boxes.slice(i+1).every(b=>a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom));
                    }'''))
                    if width in (1440,390):
                        page.evaluate('scrollTo(0,0)')
                        page.screenshot(path=str(output/f'{chapter["id"]}-{width}.png'), full_page=True)
                    if width == 1440:
                        hashes.append(digest())
            check('all four chapters have distinct canvas pixels', len(set(hashes)) == 4)
            page.set_viewport_size({'width':1440,'height':900})
            page.evaluate('scrollTo(0,0)')
            choose(chapters[0])
            page.evaluate('VisualStudy.play()')
            choose(chapters[1])
            page.wait_for_timeout(450)
            check('pigment transition renders intermediate frames', .05 < inspect()['transition'] < .95)
            check('chapter prose shares the transition clock', page.locator('.hero-copy').evaluate('(e)=>+getComputedStyle(e).opacity') < .99 and copy_matches(chapters[1]))
            page.screenshot(path=str(output/'transition-midpoint.png'))
            settle()
            check('transition settles to legible prose', page.locator('.hero-copy').evaluate('(e)=>+getComputedStyle(e).opacity') == 1)
            frame0 = digest()
            page.wait_for_timeout(450)
            check('camera playback advances actual pixels', digest() != frame0)
            for chapter in [chapters[3],chapters[0],chapters[2]]:
                choose(chapter)
            settle()
            check('interrupted transitions settle to last chapter', copy_matches(chapters[2]))
            page.locator('#interact').click()
            settle()
            check('hero action advances artwork and copy', copy_matches(chapters[3]) and not page.locator('body.study-clean').count())
            pause()
            page.locator('#canvas').focus()
            page.keyboard.press('ArrowRight')
            page.wait_for_timeout(100)
            check('keyboard wraps to first chapter', copy_matches(chapters[0]))
            frame0 = digest()
            page.wait_for_timeout(200)
            check('paused frame is stable', digest() == frame0)
            page.get_by_role('button',name='轻推颜料',exact=True).click()
            page.wait_for_timeout(100)
            check('paused pigment action visibly transports artwork', inspect()['steps'] == 8 and digest() != frame0 and not inspect()['playing'])
            check('pigment interaction retains selected chapter and copy', copy_matches(chapters[0]) and page.locator('.study-strip [aria-current]').get_attribute('data-scene') == 'mineral')
            page.evaluate('VisualStudy.play()')
            page.wait_for_timeout(700)
            pause()
            frame1 = digest()
            page.screenshot(path=str(output/'pigment-flow.png'),full_page=True)
            check('flow remains finite and keeps moving after release', inspect()['steps'] > 8 and inspect()['finite'] and frame1 != frame0)
            page.evaluate('VisualStudy.play()')
            page.wait_for_timeout(350)
            pause()
            check('persistent momentum changes transported pixels', digest() != frame1)
            page.locator('#reset').click()
            page.wait_for_timeout(100)
            check('reset restores current chapter and clears momentum', copy_matches(chapters[0]) and inspect()['steps'] == 0 and not inspect()['disturbed'])
            page.locator('#clean').click()
            box = page.locator('#canvas').bounding_box()
            page.mouse.move(box['x']+box['width']*.66,box['y']+box['height']*.45)
            page.mouse.down()
            page.mouse.move(box['x']+box['width']*.78,box['y']+box['height']*.55,steps=10)
            page.mouse.up()
            page.wait_for_timeout(100)
            check('direct canvas drag changes the persistent field', inspect()['disturbed'] and inspect()['steps'] > 0 and inspect()['finite'])
            check('clean view hides every editorial overlay', all(page.locator(s).is_hidden() for s in ['.hero-copy','.fluid-edition','.fluid-folio','.fluid-note','.fluid-stamp']))
            page.locator('#clean').click()
            page.locator('input[type=file]').set_input_files(str(ROOT/'assets/studies/fluid-light.png'))
            page.wait_for_function('VisualStudy.inspect().source==="local"')
            check('local image import identifies the test material', 'fluid-light.png' in page.locator('#status').inner_text())
            choose(chapters[1])
            check('chapter selection exits local-image mode', inspect()['source'] == 'art' and copy_matches(chapters[1]))
            with page.expect_download() as download:
                page.locator('#snapshot').click()
            check('flow painting exports a PNG', download.value.suggested_filename.endswith('.png'))
            choose(chapters[3])
            page.get_by_role('button',name='连读四章',exact=True).click()
            pause()
            reading_time=inspect()['chapterTime']
            page.wait_for_timeout(250)
            check('paused guided reading freezes its chapter clock', inspect()['chapterTime'] == reading_time)
            page.evaluate('VisualStudy.play()')
            page.wait_for_function('VisualStudy.inspect().chapter==="mineral"', timeout=30000)
            settle()
            check('guided reading wraps complete content and strip', inspect()['tour'] and copy_matches(chapters[0]) and page.locator('.study-strip [aria-current]').get_attribute('data-scene') == 'mineral')
            choose(chapters[2])
            check('manual selection stops guided reading', not inspect()['tour'])
            page.emulate_media(reduced_motion='reduce')
            page.reload()
            page.wait_for_function('window.VisualStudy && VisualStudy.inspect().frame>0')
            for chapter in chapters:
                choose(chapter)
                check('reduced motion '+chapter['id']+' switches instantly', not inspect()['playing'] and inspect()['transition'] == 1 and copy_matches(chapter))
            page.set_viewport_size({'width':390,'height':844})
            for i,chapter in enumerate(chapters):
                card=page.locator('.study-strip > button').nth(i)
                card.focus()
                page.keyboard.press('Enter')
                page.wait_for_timeout(100)
                check(f'mobile keyboard reveals chapter {i+1}', copy_matches(chapter) and card.evaluate('(e)=>{const a=e.getBoundingClientRect(),b=e.parentElement.getBoundingClientRect();return a.left>=b.left&&a.right<=b.right+1}'))
            page.locator('.hall-open-atlas').click()
            check('atlas opens with eight experiences', page.locator('.hall-atlas').is_visible() and page.locator('.hall-strip a').count() == 8)
            page.keyboard.press('Escape')
            check('Escape restores material journal footer', page.locator('.hall-scene-footer').is_visible() and page.locator('.hall-atlas').is_hidden())
            check('no runtime exceptions or failed local assets', not errors and not failed)
            context.close()

            tour_context=browser.new_context(viewport={'width':1440,'height':900},device_scale_factor=1,
                                            record_video_dir=str(output/'playback'),record_video_size={'width':1440,'height':900})
            tour_page=tour_context.new_page()
            tour_page.goto(url)
            tour_page.wait_for_function('window.VisualStudy && VisualStudy.inspect().frame>0')
            tour_page.wait_for_timeout(1800)
            for chapter in chapters[1:]+chapters[:1]:
                tour_page.locator(f'.study-strip [data-scene="{chapter["id"]}"]').click()
                tour_page.wait_for_function('VisualStudy.inspect().transition===1')
                tour_page.wait_for_timeout(1400)
            tour_page.get_by_role('button',name='轻推颜料',exact=True).click()
            tour_page.wait_for_timeout(1800)
            video=tour_page.video
            tour_context.close()
            video.save_as(str(output/'fluid-tour.webm'))
            browser.close()

            fallback_browser=p.chromium.launch(headless=True,args=['--disable-webgl'])
            fallback_page=fallback_browser.new_page(viewport={'width':960,'height':720},reduced_motion='reduce')
            fallback_page.goto(url)
            fallback_page.wait_for_function('window.VisualStudy && VisualStudy.inspect().frame>0')
            check('2D fallback initializes readable artwork', fallback_page.evaluate('VisualStudy.inspect().renderer') == 'canvas-flow')
            h0=hashlib.sha256(fallback_page.locator('#canvas').screenshot()).hexdigest()
            fallback_page.get_by_role('button',name='轻推颜料',exact=True).click()
            fallback_page.wait_for_timeout(150)
            check('2D fallback transports the same finite field', fallback_page.evaluate('VisualStudy.inspect().finite&&VisualStudy.inspect().steps===8') and hashlib.sha256(fallback_page.locator('#canvas').screenshot()).hexdigest() != h0)
            fallback_page.screenshot(path=str(output/'fallback.png'),full_page=True)
            fallback_browser.close()
    finally:
        server.shutdown()
        (output/'results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors,'failed_requests':failed,'playback':playback},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('TOTAL',len(checks),flush=True)


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'runs/six-studies-s05-fluid/fluid-browser')
    run(parser.parse_args().output)
