"""Content, transition and responsive playback acceptance for ELSEWHERE / study 03."""
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
    chapters = json.loads((ROOT / 'src/studies/catalog.json').read_text(encoding='utf-8'))[0]['chapters']
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
            context = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1,
                                          record_video_dir=str(output / 'playback'), record_video_size={'width': 1440, 'height': 900})
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('response', lambda response: failed.append(response.url) if response.status >= 400 and 'favicon' not in response.url else None)
            page.goto(f'http://127.0.0.1:{server.server_port}/dist/portal-threshold.html')
            page.wait_for_function('window.VisualStudy && VisualStudy.inspect().frame > 0')
            inspect = lambda: page.evaluate('VisualStudy.inspect()')

            def pause():
                page.evaluate('VisualStudy.pause()')
                page.wait_for_timeout(80)

            def digest():
                return hashlib.sha256(page.locator('#canvas').screenshot()).hexdigest()

            def copy_matches(chapter):
                if inspect()['chapter'] != chapter['id']:
                    print('Unexpected selection', json.dumps({'expected': chapter['id'], 'actual': inspect(),
                          'copy': page.locator('h1').inner_text()}, ensure_ascii=False), flush=True)
                return (page.locator('h1').inner_text().replace('\n', '') == ''.join(chapter['headline'])
                        and page.locator('.hero-copy > p').inner_text() == chapter['body']
                        and page.locator('.stage-tag b').inner_text() == chapter['kicker']
                        and page.locator('.portal-folio h2').inner_text() == chapter['feature']
                        and page.locator('.portal-folio > p').inner_text() == chapter['detail']
                        and page.locator('.portal-note > p').inner_text() == chapter['note']
                        and page.locator('.hero-copy').get_attribute('data-chapter') == chapter['id']
                        and inspect()['art'] == chapter['image'])

            check('five generated textures decoded', inspect()['texturesLoaded'] == 5)
            check('eight peer links retain portal selection', page.locator('.hall-modes > a').count() == 8 and
                  page.locator('.hall-modes [aria-current]').get_attribute('href') == 'portal-threshold.html')
            check('four local chapters with individual art', page.locator('.study-strip > button').count() == 4 and
                  page.locator('.study-strip a').count() == 0 and
                  page.locator('.study-strip img').evaluate_all('(imgs)=>new Set(imgs.map(i=>i.src)).size===4&&imgs.every(i=>i.naturalWidth>0)'))
            pause()
            hashes = []
            for width, height in [(1440, 900), (1024, 768), (768, 1024), (390, 844), (320, 568)]:
                page.set_viewport_size({'width': width, 'height': height})
                for chapter in chapters:
                    card = page.locator(f'.study-strip [data-scene="{chapter["id"]}"]')
                    card.click()
                    page.wait_for_timeout(80)
                    label = f'{width}px {chapter["id"]}'
                    check(label + ' art and complete copy synchronized', copy_matches(chapter))
                    check(label + ' local selection and pause preserved', card.get_attribute('aria-pressed') == 'true' and not inspect()['playing'])
                    check(label + ' no horizontal overflow', page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
                    check(label + ' copy and product card do not overlap', page.evaluate('''()=>{
                        const a=document.querySelector('.hero-copy').getBoundingClientRect();
                        const b=document.querySelector('.portal-folio').getBoundingClientRect();
                        const e=document.querySelector('.portal-edition').getBoundingClientRect();
                        const h=document.querySelector('h1').getBoundingClientRect();
                        return (a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom)&&
                          a.top>=e.bottom+8&&h.left>=0&&h.right<=innerWidth;
                    }'''))
                    if width in [1440, 390]:
                        page.screenshot(path=str(output / f'{chapter["id"]}-{width}.png'), full_page=True)
                    if width == 1440:
                        hashes.append(digest())
            check('four visually distinct chapter canvases', len(set(hashes)) == 4)
            page.set_viewport_size({'width': 1440, 'height': 900})
            page.locator('.study-strip [data-scene="threshold"]').click()
            page.evaluate('VisualStudy.play()')
            page.wait_for_timeout(100)
            page.locator('.study-strip [data-scene="through"]').click()
            page.wait_for_timeout(420)
            state = inspect()
            check('live chapter transition has intermediate frames', 0.05 < state['transition'] < .95)
            check('incoming copy shares transition progress', page.locator('.hero-copy').evaluate('(e)=>+getComputedStyle(e).opacity') < .99 and copy_matches(chapters[1]))
            page.screenshot(path=str(output / 'transition-midpoint.png'))
            page.wait_for_function('VisualStudy.inspect().transition===1')
            check('transition completes with readable copy', page.locator('.hero-copy').evaluate('(e)=>+getComputedStyle(e).opacity') == 1)
            frame0 = digest()
            page.wait_for_timeout(600)
            check('actual playback advances camera/environment', digest() != frame0)
            # Interrupt a transition with another selection, then use the content CTA.
            for scene in ['return', 'threshold', 'through', 'return']:
                page.locator(f'.study-strip [data-scene="{scene}"]').click()
            page.wait_for_function('VisualStudy.inspect().transition===1')
            check('rapid selections settle to latest art and prose', copy_matches(chapters[2]))
            page.locator('#interact').click()
            page.wait_for_function('VisualStudy.inspect().transition===1')
            check('content CTA advances visual and copy together', copy_matches(chapters[3]) and not page.locator('body.study-clean').count())
            check('roaming chapter enables guided sequence', inspect()['auto'])
            page.wait_for_function('VisualStudy.inspect().chapter === "threshold"', timeout=25000)
            page.wait_for_function('VisualStudy.inspect().transition === 1')
            check('roam wraps to next full content beat', inspect()['auto'] and copy_matches(chapters[0]) and
                  page.locator('.study-strip [aria-current]').get_attribute('data-scene') == 'threshold')
            pause()
            still = digest()
            page.wait_for_timeout(300)
            check('paused roaming is visually stable', still == digest())
            page.locator('#clean').click()
            check('clean view hides all editorial layers', all(page.locator(selector).is_hidden() for selector in
                  ['.hero-copy', '.portal-edition', '.portal-folio', '.portal-note', '.portal-chapter-mark']))
            page.locator('#clean').click()
            page.emulate_media(reduced_motion='reduce')
            page.reload()
            page.wait_for_function('window.VisualStudy && VisualStudy.inspect().frame > 0')
            for chapter in chapters:
                page.locator(f'.study-strip [data-scene="{chapter["id"]}"]').click()
                page.wait_for_timeout(80)
                check('reduced motion ' + chapter['id'] + ' switches instantly and stays paused',
                      not inspect()['playing'] and inspect()['transition'] == 1 and copy_matches(chapter))
            # Opening the footer in a short landscape viewport can scroll the page.
            # Returning to portrait must leave the peer navigation reachable.
            page.set_viewport_size({'width': 844, 'height': 390})
            page.locator('.hall-open-atlas').click()
            page.set_viewport_size({'width': 390, 'height': 844})
            page.wait_for_timeout(200)
            check('peer navigation stays visible after landscape footer use', page.locator('.hall-modes').evaluate(
                  '(e)=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth}'))
            page.locator('.hall-close-atlas').click()
            for i in range(4):
                card = page.locator('.study-strip > button').nth(i)
                card.focus()
                page.keyboard.press('Enter')
                page.wait_for_timeout(80)
                check(f'mobile keyboard selects chapter {i+1}', copy_matches(chapters[i]) and card.evaluate(
                      '(e)=>{const a=e.getBoundingClientRect(),b=e.parentElement.getBoundingClientRect();return a.left>=b.left&&a.right<=b.right+1}'))
            check('no failed local assets or runtime errors', not errors and not failed)
            video = page.video
            context.close()
            video.save_as(str(output / 'portal-playback.webm'))
            browser.close()
    finally:
        server.shutdown()
    (output / 'results.json').write_text(json.dumps({'passed': len(checks), 'checks': checks, 'errors': errors,
                                                   'failed_requests': failed}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('TOTAL', len(checks), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'runs/six-studies-s03-portal/portal-browser')
    run(parser.parse_args().output)
