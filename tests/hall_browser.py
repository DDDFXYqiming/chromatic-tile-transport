"""Exercise the shared atlas using real local-page navigation in headless Chromium."""
import functools
import json
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'runs/six-studies-style-pass/hall-browser'
sys.path.insert(0, str(ROOT / 'scripts'))
from serve import RangeRequestHandler


def run():
    OUT.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(RangeRequestHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_port}/dist/'
    checks, errors = [], []

    def check(name, passed):
        assert passed, name
        checks.append(name)
        print('PASS', name, flush=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 900})
        page.on('pageerror', lambda e: errors.append(str(e)))

        def ready():
            if page.url.endswith('/index.html'):
                page.wait_for_function('window.WarpArchive && WarpArchive.getState().plansReady === 5', timeout=60000)
                page.evaluate('WarpArchive.pause()')
            elif '/matrix-' in page.url:
                page.wait_for_function('window.MatrixMotion && MatrixMotion.getState().ready', timeout=30000)
                page.evaluate('MatrixMotion.pause()')
                page.evaluate('MatrixMotion.seekAsync(0)')
            else:
                page.wait_for_function('window.VisualStudy && VisualStudy.inspect().frame > 0')
                page.evaluate('VisualStudy.pause()')
            page.wait_for_timeout(100)

        def show_atlas():
            if page.locator('.hall-open-atlas').count() and page.locator('.hall-open-atlas').is_visible():
                page.locator('.hall-open-atlas').click()

        slugs = ['index', 'matrix-battle', 'portal-threshold', 'temporal-field', 'liquid-canvas', 'optical-vault', 'shadow-apparatus', 'folding-theater']
        page.goto(base + slugs[0] + '.html')
        for index, slug in enumerate(slugs):
            ready()
            check(slug + ' reached through atlas next', page.url == base + slug + '.html')
            show_atlas()
            check(slug + ' active atlas item', page.locator('.hall-strip [aria-current]').get_attribute('href').endswith(slug + '.html'))
            check(slug + ' atlas fits desktop viewport', page.locator('.hall-atlas').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.bottom<=innerHeight+1&&r.left>=0&&r.right<=innerWidth}'))
            check(slug + ' all eight thumbnails decoded', page.locator('.hall-strip img').evaluate_all('(imgs)=>imgs.length===8&&imgs.every(i=>i.complete&&i.naturalWidth)'))
            if index < 2:
                page.screenshot(path=str(OUT/(slug+'-atlas-desktop.png')))
                page.locator('.hall-close-atlas').click()
                check(slug + ' restores scene navigation', page.locator('.hall-scene-footer').is_visible())
                page.screenshot(path=str(OUT/(slug+'-scenes-desktop.png')))
                show_atlas()
            page.get_by_role('link', name='下一个体验', exact=True).click()
        ready()
        check('next wraps 08 to 01', page.url == base + 'index.html')
        show_atlas()
        page.get_by_role('link', name='上一个体验', exact=True).click()
        ready()
        check('previous wraps 01 to 08', page.url == base + 'folding-theater.html')
        for slug in ['index', 'matrix-battle', 'matrix-motion', 'matrix-video', 'matrix-anime']:
            page.goto(base + slug + '.html')
            ready()
            for width, height in [(1024,768), (768,1024), (320,568), (844,390), (390,844)]:
                page.set_viewport_size({'width':width,'height':height})
                page.wait_for_timeout(180)
                if slug == 'index':
                    page.wait_for_function('WarpArchive.getState().plansReady === 5', timeout=60000)
                check(f'{slug} {width}px fits', page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
                page.locator('.hall-menu summary').click()
                check(f'{slug} {width}px menu visible inside viewport',page.locator('.hall-menu-panel').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight}'))
                page.keyboard.press('Escape')
                show_atlas()
                check(f'{slug} {width}px atlas visible',page.locator('.hall-strip').is_visible())
                if width==390:
                    page.screenshot(path=str(OUT/(slug+'-atlas-mobile.png')))
                    page.locator('.hall-menu summary').click()
                    page.locator('.hall-menu a').filter(has_text='画中门').click()
                    ready()
                    check(slug+' header links to study 03',page.url==base+'portal-threshold.html')
            page.set_viewport_size({'width':1440,'height':900})
        check('no uncaught runtime exceptions',not errors)
        browser.close()
    server.shutdown()
    (OUT/'results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('TOTAL',len(checks),flush=True)


if __name__ == '__main__':
    run()
