"""Exercise the shared atlas using real local-page navigation in headless Chromium."""
import functools
import argparse
import json
import sys
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'runs/six-studies-chrome/hall-browser'
sys.path.insert(0, str(ROOT / 'scripts'))
from serve import RangeRequestHandler


def run(OUT):
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
            if any(page.url.endswith('/' + slug + '.html') for slug in ['index', 'readme-transport', 'two-images']):
                page.wait_for_function('window.WarpArchive && WarpArchive.getState().plansReady === WarpArchive.getState().sceneCount', timeout=60000)
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

        def check_footer(label, slug):
            if page.locator('.hall-close-atlas').is_visible():
                page.locator('.hall-close-atlas').click()
            footer=page.locator('.hall-scene-footer')
            check(label+' default scene strip visible',footer.is_visible() and page.locator('.hall-atlas').is_hidden())
            check(label+' default strip has no experience destinations',footer.locator('a[href$=".html"]').count()==0 and footer.locator('.hall-strip').count()==0)
            if slug.startswith('matrix-'):
                check(label+' native MOTION chapters',footer.locator('#filmstrip button').count()>=2 and 'THE MOTION ATLAS' in footer.inner_text())
            elif slug in ['index','readme-transport','two-images']:
                check(label+' native MEMORY images',footer.locator('#filmstrip button').count()>=2 and 'THE MEMORY ATLAS' in footer.inner_text())
            else:
                check(label+' study-local content buttons',4<=footer.locator('.study-strip > button').count()<=5)
            show_atlas()
            check(label+' atlas opens explicitly',page.locator('body.hall-experiences').count()==1 and page.locator('.hall-strip > a').count()==8 and page.locator('.hall-atlas').is_visible() and footer.is_hidden())
            check(label+' atlas announces open state',page.locator('.hall-open-atlas').get_attribute('aria-expanded')=='true' and page.locator('.hall-open-atlas').get_attribute('aria-controls')==page.locator('.hall-atlas').get_attribute('id'))
            page.keyboard.press('Escape')
            check(label+' atlas closes back to local footer',footer.is_visible() and page.locator('.hall-atlas').is_hidden())
            check(label+' atlas restores focus and collapsed state',page.locator('.hall-open-atlas').evaluate('(e)=>document.activeElement===e&&e.getAttribute("aria-expanded")==="false"'))

        def check_keyboard(label):
            playing = 'VisualStudy.inspect().playing' if page.locator('body[data-study]').count() else 'MatrixMotion.getState().playing' if '/matrix-' in page.url else 'WarpArchive.getState().autoplay'
            before = page.evaluate(playing)
            page.locator('.hall-open-atlas').focus()
            page.keyboard.press('Space')
            check(label+' SPACE opens atlas without toggling playback',page.locator('.hall-atlas').is_visible() and page.evaluate(playing)==before)
            page.keyboard.press('Space')
            check(label+' SPACE restores local content without toggling playback',page.locator('.hall-scene-footer').is_visible() and page.evaluate(playing)==before)

        slugs = ['index', 'matrix-battle', 'portal-threshold', 'temporal-field', 'liquid-canvas', 'optical-vault', 'shadow-apparatus', 'folding-theater']
        labels = ['01 寻色迁移', '02 MATRIX MOTION', '03 画中门', '04 时差场', '05 液态画布', '06 光学展柜', '07 影子机关', '08 折叠剧场']

        def check_modes(label, slug):
            modes = page.locator('.hall-modes')
            links = modes.locator(':scope > a')
            check(label + ' eight peer links', links.all_text_contents() == labels)
            check(label + ' direct destinations', links.evaluate_all('(links)=>links.map(a=>a.getAttribute("href"))') == [s + '.html' for s in slugs])
            current = 'matrix-battle' if slug.startswith('matrix-') else 'index' if slug in ['readme-transport', 'two-images'] else slug
            check(label + ' active mode', modes.locator('[aria-current="page"]').count() == 1 and modes.locator('[aria-current]').get_attribute('href') == current + '.html')
            check(label + ' single row with equal button heights', links.evaluate_all('(links)=>{const r=links.map(a=>a.getBoundingClientRect());return r.every(a=>a.height>0&&Math.abs(a.top-r[0].top)<1&&Math.abs(a.height-r[0].height)<1)}'))
            check(label + ' no grouped menu', modes.locator('details,summary,select,button,[role="menu"],[aria-haspopup]').count() == 0)
            check(label + ' switch fits header', modes.evaluate('''(e)=>{const r=e.getBoundingClientRect();return r.width>80&&r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight&&[...e.parentElement.children].filter(s=>s!==e).every(s=>{const b=s.getBoundingClientRect();return r.right<=b.left+1||r.left>=b.right-1||r.bottom<=b.top+1||r.top>=b.bottom-1})}'''))
            check(label + ' active mode visible', modes.evaluate('(e)=>{const r=e.getBoundingClientRect(),a=e.querySelector("[aria-current]").getBoundingClientRect();return a.left>=r.left&&a.right<=r.right+1}'))
            if page.viewport_size['width'] >= 1440:
                check(label + ' all eight visible on desktop', modes.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'))
            if page.viewport_size['width'] <= 390:
                check(label + ' mobile row scrolls', modes.evaluate('(e)=>e.scrollWidth>e.clientWidth&&getComputedStyle(e).overflowX==="auto"'))
                links.first.focus()
                for i in range(8):
                    check(f'{label} keyboard reaches {i+1:02}', links.nth(i).evaluate('(e)=>{const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return document.activeElement===e&&r.left>=p.left&&r.right<=p.right+1}'))
                    if i < 7:
                        page.keyboard.press('Tab')
                modes.locator('[aria-current]').focus()

        for width, height in [(1440, 900), (390, 844)]:
            page.set_viewport_size({'width': width, 'height': height})
            page.goto(base + 'index.html')
            for index, slug in enumerate(slugs):
                ready()
                check(f'{width}px top link reaches {slug}', page.url == base + slug + '.html')
                check_modes(f'{slug} {width}px', slug)
                check_footer(f'{slug} {width}px', slug)
                check_keyboard(f'{slug} {width}px')
                page.screenshot(path=str(OUT / f'{slug}-modes-{width}.png'), full_page=True)
                page.locator('.hall-modes > a').nth((index + 1) % 8).click()
            ready()
            check(f'{width}px top links return to 01', page.url == base + 'index.html')

        # Direct thumbnail links remain usable independently of the top switch.
        for index, slug in enumerate(slugs):
            show_atlas()
            page.locator('.hall-strip > a').nth((index + 1) % 8).click()
            ready()
            check(slug + ' opened atlas thumbnail changes experience', page.url == base + slugs[(index + 1) % 8] + '.html')

        page.set_viewport_size({'width':1440,'height':900})
        page.goto(base + slugs[0] + '.html')
        for index, slug in enumerate(slugs):
            ready()
            check(slug + ' reached through atlas next', page.url == base + slug + '.html')
            show_atlas()
            check(slug + ' active atlas item', page.locator('.hall-strip [aria-current]').get_attribute('href').endswith(slug + '.html'))
            check(slug + ' atlas fits desktop viewport', page.locator('.hall-atlas').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.bottom<=innerHeight+1&&r.left>=0&&r.right<=innerWidth}'))
            check(slug + ' all eight thumbnails decoded', page.locator('.hall-strip img').evaluate_all('(imgs)=>imgs.length===8&&imgs.every(i=>i.complete&&i.naturalWidth)'))
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
        for slug in slugs + ['matrix-motion', 'matrix-video', 'matrix-anime']:
            page.goto(base + slug + '.html')
            ready()
            for width, height in [(1920,1080), (1024,768), (768,1024), (320,568), (844,390), (390,844)]:
                page.set_viewport_size({'width':width,'height':height})
                page.wait_for_timeout(180)
                if slug == 'index':
                    page.wait_for_function('WarpArchive.getState().plansReady === 5', timeout=60000)
                check(f'{slug} {width}px fits', page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
                check_modes(f'{slug} {width}px', slug)
                check_footer(f'{slug} {width}px', slug)
                show_atlas()
                check(f'{slug} {width}px atlas visible',page.locator('.hall-strip').is_visible())
                if width==390:
                    page.screenshot(path=str(OUT/(slug+'-atlas-mobile.png')))
                    page.locator('.hall-modes > a').filter(has_text='画中门').click()
                    ready()
                    check(slug+' header links to study 03',page.url==base+'portal-threshold.html')
            page.set_viewport_size({'width':1440,'height':900})
        check('no uncaught runtime exceptions',not errors)
        for slug in ['readme-transport', 'two-images', 'matrix-motion-offline', 'matrix-video-offline', 'matrix-anime-offline', 'matrix-battle-offline']:
            page.goto(base + slug + '.html')
            ready()
            for width, height in [(1440,900), (390,844)]:
                page.set_viewport_size({'width':width,'height':height})
                page.wait_for_timeout(180)
                check_modes(f'{slug} {width}px', slug)
                check_footer(f'{slug} {width}px', slug)
                show_atlas()
                check(f'{slug} {width}px bottom atlas', page.locator('.hall-strip > a').count() == 8 and page.locator('.hall-strip').is_visible())
            page.locator('.hall-modes > a').nth(2).click()
            ready()
            check(slug + ' direct study link', page.url == base + 'portal-threshold.html')
        check('all generated variants have no runtime exceptions', not errors)
        browser.close()
    server.shutdown()
    (OUT/'results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('TOTAL',len(checks),flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=OUT)
    run(parser.parse_args().output)
