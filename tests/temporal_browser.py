"""Chapter, media and responsive playback acceptance for study 04 / AFTERLIGHT."""
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
    chapters = next(x for x in json.loads((ROOT / 'src/studies/catalog.json').read_text(encoding='utf-8')) if x['id'] == 'temporal')['chapters']
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(RangeRequestHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    checks, errors, failed = [], [], []

    def check(name, value):
        assert value, name
        checks.append(name)
        print('PASS', name, flush=True)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('response', lambda response: failed.append(response.url) if response.status >= 400 and 'favicon' not in response.url else None)
            url = f'http://127.0.0.1:{server.server_port}/dist/temporal-field.html'
            page.goto(url)
            page.wait_for_function('window.VisualStudy && VisualStudy.inspect().frame > 0')
            inspect = lambda: page.evaluate('VisualStudy.inspect()')

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
                        inspect()['mode'] == c['mode'] and inspect()['source'] == 'art' and
                        inspect()['effect'] == c.get('effect', c['mode']) and
                        page.locator('h1').inner_text().replace('\n', '') == ''.join(c['headline']) and
                        page.locator('.hero-copy > p').inner_text() == c['body'] and
                        page.locator('.stage-tag b').inner_text() == c['kicker'] and
                        page.locator('.temporal-folio h2').inner_text() == c['feature'] and
                        page.locator('.temporal-folio > p').inner_text() == c['detail'] and
                        page.locator('.temporal-note > p').inner_text() == c['note'] and
                        page.locator('.temporal-note > small').inner_text() == c['annotation'] and
                        page.locator('#interact > span').inner_text() == c['action'] and
                        page.locator('.temporal-stamp b').inner_text() == c['time'])

            check('five generated chapter paintings decoded', inspect()['texturesLoaded'] == 5)
            check('eight peer links retain temporal selection', page.locator('.hall-modes > a').count() == 8 and page.locator('.hall-modes [aria-current]').get_attribute('href') == 'temporal-field.html')
            check('five local chapters with distinct decoded art', page.locator('.study-strip > button').count() == 5 and page.locator('.study-strip a').count() == 0 and page.locator('.study-strip img').evaluate_all('(imgs)=>new Set(imgs.map(i=>i.src)).size===5&&imgs.every(i=>i.naturalWidth>0)'))
            pause()
            hashes = []
            for width, height in [(1440, 900), (1024, 768), (768, 1024), (390, 844), (320, 568)]:
                page.set_viewport_size({'width': width, 'height': height})
                for chapter in chapters:
                    choose(chapter)
                    label = f'{width}px {chapter["id"]}'
                    check(label + ' art and complete editorial copy synchronized', copy_matches(chapter))
                    check(label + ' local strip and pause preserved', page.url == url and not inspect()['playing'] and page.locator('.study-strip [aria-current]').get_attribute('data-scene') == chapter['id'])
                    check(label + ' no horizontal overflow', page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
                    check(label + ' editorial blocks fit without overlap', page.evaluate('''()=>{
                        const boxes=['.hero-copy','.temporal-folio','.temporal-note','.temporal-edition'].map(s=>document.querySelector(s).getBoundingClientRect());
                        const theater=document.querySelector('.theater').getBoundingClientRect();
                        return boxes[3].bottom<=boxes[0].top&&boxes.every((a,i)=>a.left>=theater.left&&a.right<=theater.right&&a.top>=theater.top&&a.bottom<=theater.bottom&&
                          boxes.slice(i+1).every(b=>a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom));
                    }'''))
                    if width in (1440, 390):
                        page.screenshot(path=str(output / f'{chapter["id"]}-{width}.png'), full_page=True)
                    if width == 1440:
                        hashes.append(digest())
            check('all five chapters have distinct canvas pixels', len(set(hashes)) == 5)
            check('Blender fold sequence loaded with complete topology', inspect()['foldFrames'] == 49 and inspect()['foldTriangles'] == 252)
            page.set_viewport_size({'width': 1440, 'height': 900})
            page.evaluate('scrollTo(0,0)')
            for chapter in [chapters[1], chapters[4]]:
                choose(chapter)
                page.locator('#canvas').hover(position={'x': 300, 'y': 180})
                frame0 = digest()
                page.locator('#canvas').hover(position={'x': 1050, 'y': 300})
                page.wait_for_timeout(100)
                check(chapter['id'] + ' pointer changes its content-specific effect while paused', digest() != frame0)
            page.locator('#canvas').hover(position={'x': 720, 'y': 300})
            choose(chapters[0])
            page.evaluate('VisualStudy.play()')
            choose(chapters[1])
            page.wait_for_timeout(400)
            state = inspect()
            check('cinematic transition has intermediate frames', .05 < state['transition'] < .95)
            check('copy and picture share transition progress', page.locator('.hero-copy').evaluate('(e)=>+getComputedStyle(e).opacity') < .99 and copy_matches(chapters[1]))
            page.screenshot(path=str(output / 'transition-midpoint.png'))
            page.wait_for_function('VisualStudy.inspect().transition===1')
            check('transition completes with readable prose', page.locator('.hero-copy').evaluate('(e)=>+getComputedStyle(e).opacity') == 1)
            frame0 = digest()
            page.wait_for_timeout(500)
            check('actual camera playback changes pixels', digest() != frame0)
            for chapter in [chapters[4], chapters[1], chapters[0], chapters[3]]:
                choose(chapter)
            page.wait_for_function('VisualStudy.inspect().transition===1')
            check('interrupted transitions settle to latest chapter', copy_matches(chapters[3]))
            page.locator('#interact').click()
            page.wait_for_function('VisualStudy.inspect().transition===1')
            check('CTA advances full chapter without hiding content', copy_matches(chapters[4]) and not page.locator('body.study-clean').count())
            page.get_by_role('button', name='连读五章', exact=True).click()
            page.wait_for_function('VisualStudy.inspect().chapter==="radial"', timeout=30000)
            page.wait_for_function('VisualStudy.inspect().transition===1')
            check('guided reading wraps artwork copy and strip', inspect()['tour'] and copy_matches(chapters[0]) and page.locator('.study-strip [aria-current]').get_attribute('data-scene') == 'radial')
            pause()
            frame0 = digest()
            page.wait_for_timeout(350)
            check('paused playback is pixel stable', frame0 == digest())
            page.locator('#canvas').focus()
            page.keyboard.press('ArrowRight')
            page.wait_for_timeout(100)
            check('canvas keyboard changes complete chapter', copy_matches(chapters[1]))
            page.get_by_label('时间形状', exact=True).select_option('ribbon')
            page.wait_for_timeout(100)
            check('shape selector synchronizes art copy and local strip', copy_matches(chapters[2]) and page.locator('.study-strip [aria-current]').get_attribute('data-scene') == 'ribbon')
            # Real decoder and bounded history are retained alongside editorial art.
            page.get_by_label('运动源', exact=True).select_option('video')
            page.evaluate('VisualStudy.play()')
            page.wait_for_function('VisualStudy.inspect().readyState>=2 && VisualStudy.inspect().count>24')
            page.wait_for_timeout(2300)
            pause()
            state = inspect()
            check('real video decodes into bounded timestamp cache', state['source'] == 'video' and 24 < state['count'] <= state['capacity'] == 64 and state['bytes'] == 64*384*216*4 and state['historySeconds'] > .5)
            frame0 = digest()
            page.get_by_label('历史深度（秒）', exact=True).fill('0')
            page.get_by_label('历史深度（秒）', exact=True).dispatch_event('input')
            page.wait_for_timeout(100)
            check('paused video can resample cached time', digest() != frame0)
            page.locator('input[type=file]').set_input_files(str(ROOT / 'assets/matrix-battle/03-clash.mp4'))
            page.evaluate('VisualStudy.play()')
            page.wait_for_function('VisualStudy.inspect().source==="video"&&VisualStudy.inspect().count>2')
            check('local video import decodes and labels filename', '03-clash.mp4' in page.locator('#status').inner_text())
            page.get_by_label('运动源', exact=True).select_option('synthetic')
            page.wait_for_function('VisualStudy.inspect().count>2')
            check('explicit procedural source still runs', inspect()['source'] == 'synthetic')
            pause()
            page.locator('#reset').click()
            page.wait_for_timeout(100)
            check('reset returns to complete present-tense chapter', copy_matches(chapters[4]) and inspect()['depth'] == 0 and not inspect()['tour'])
            page.locator('#clean').click()
            check('clean view hides every editorial layer', all(page.locator(s).is_hidden() for s in ['.hero-copy','.temporal-edition','.temporal-folio','.temporal-note','.temporal-stamp']))
            page.locator('#clean').click()
            page.route('**/03-clash.mp4', lambda route: route.abort())
            page.reload()
            page.wait_for_function('window.VisualStudy && VisualStudy.inspect().frame > 0')
            page.get_by_label('运动源', exact=True).select_option('video')
            page.wait_for_function('VisualStudy.inspect().source==="art"')
            check('failed video returns to chapter with readable director feedback', copy_matches(chapters[0]) and
                  page.locator('.hint').is_visible() and '读取失败' in page.locator('.hint').inner_text())
            page.unroute('**/03-clash.mp4')
            page.emulate_media(reduced_motion='reduce')
            page.reload()
            page.wait_for_function('window.VisualStudy && VisualStudy.inspect().frame > 0')
            for chapter in chapters:
                choose(chapter)
                check('reduced motion ' + chapter['id'] + ' switches instantly paused', not inspect()['playing'] and inspect()['transition'] == 1 and copy_matches(chapter))
            page.set_viewport_size({'width':844,'height':390})
            page.locator('.hall-open-atlas').click()
            page.set_viewport_size({'width':390,'height':844})
            page.wait_for_timeout(200)
            check('peer navigation remains reachable after viewport rotation', page.locator('.hall-modes').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth}'))
            page.locator('.hall-close-atlas').click()
            for i, chapter in enumerate(chapters):
                card=page.locator('.study-strip > button').nth(i)
                card.focus();page.keyboard.press('Enter');page.wait_for_timeout(100)
                check(f'mobile keyboard selects and reveals chapter {i+1}', copy_matches(chapter) and card.evaluate('(e)=>{const a=e.getBoundingClientRect(),b=e.parentElement.getBoundingClientRect();return a.left>=b.left&&a.right<=b.right+1}'))
            check('no failed local assets or runtime exceptions', not errors and not failed)
            context.close()
            # A focused, real-time tour is delivered separately from the QA session.
            tour_context=browser.new_context(viewport={'width':1440,'height':900},device_scale_factor=1,
                                             record_video_dir=str(output/'playback'),record_video_size={'width':1440,'height':900})
            tour_page=tour_context.new_page()
            tour_page.goto(url)
            tour_page.wait_for_function('window.VisualStudy && VisualStudy.inspect().frame>0')
            tour_page.wait_for_timeout(2000)
            for chapter in chapters[1:]+chapters[:1]:
                tour_page.locator(f'.study-strip [data-scene="{chapter["id"]}"]').click()
                tour_page.wait_for_timeout(2800)
            video=tour_page.video
            tour_context.close()
            video.save_as(str(output/'temporal-tour.webm'))
            browser.close()
    finally:
        server.shutdown()
    (output/'results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors,'failed_requests':failed},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('TOTAL', len(checks), flush=True)


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'runs/six-studies-s04-temporal/temporal-browser')
    run(parser.parse_args().output)
