#!/usr/bin/env python3
"""Playwright interaction checks for studies 03-08 (offline or HTTP mode)."""
from __future__ import annotations
import argparse
import hashlib
import json
import threading
import tempfile
import functools
import sys
from pathlib import Path
from http.server import ThreadingHTTPServer
from playwright.sync_api import sync_playwright
from studies_inline import ROOT, bundle, inline_page
sys.path.insert(0, str(ROOT / 'scripts'))
from serve import RangeRequestHandler


def run(args):
    catalog=json.loads((ROOT/'src/studies/catalog.json').read_text(encoding='utf-8'))
    result={'loading':'offline-inline' if args.inline else 'HTTP native modules','checks':[],'screenshots':[]}
    args.output.mkdir(parents=True,exist_ok=True)
    server=None
    if not args.inline:
        server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(RangeRequestHandler,directory=str(ROOT)))
        threading.Thread(target=server.serve_forever,daemon=True).start()
    code=bundle(args.video_fixture) if args.inline else None
    def check(name,value):
        assert value, name
        result['checks'].append(name)
        print('PASS',name,flush=True)
    with sync_playwright() as p:
        kw={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if args.chromium:kw['executable_path']=args.chromium
        browser=p.chromium.launch(**kw)
        for item in catalog:
            if args.study and item['id'] != args.study:continue
            errors=[]
            page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1,accept_downloads=True)
            page.on('pageerror',lambda e:errors.append(str(e)))
            def load():
                if args.inline:
                    page.goto('about:blank');page.set_content(inline_page(item['slug']));page.add_script_tag(content=code)
                else:page.goto(f'http://127.0.0.1:{server.server_port}/dist/{item["slug"]}.html')
                page.wait_for_function('window.VisualStudy !== undefined',timeout=12000)
            def inspect():return page.evaluate('VisualStudy.inspect()')
            def pause():page.evaluate('VisualStudy.pause()');page.wait_for_timeout(80)
            def change(label,value):
                el=page.get_by_label(label,exact=True)
                el.fill(str(value));el.dispatch_event('input');page.wait_for_timeout(80)
            def digest():return hashlib.sha256(page.locator('#canvas').screenshot()).hexdigest()
            load();page.wait_for_timeout(350);check(item['id']+' initialized',inspect()['frame']>0)
            check(item['id']+' default local filmstrip',page.locator('.hall-scene-footer').is_visible() and page.locator('.hall-atlas').is_hidden())
            check(item['id']+' local strip has only content buttons',4<=page.locator('.study-strip > button').count()<=5 and page.locator('.hall-scene-footer a').count()==0)
            check(item['id']+' local thumbnails decoded',page.locator('.study-strip img').evaluate_all('(imgs)=>imgs.every(i=>i.complete&&i.naturalWidth>0)'))
            check(item['id']+' initial content accented',page.locator('.study-strip [aria-current]').count()==1)
            page.locator('.hall-open-atlas').click()
            check(item['id']+' atlas only opens on request',page.locator('body.hall-experiences').count()==1 and page.locator('.hall-atlas').is_visible() and page.locator('.hall-scene-footer').is_hidden() and page.locator('.hall-strip a').count()==8)
            page.locator('#about-open').click();page.keyboard.press('Escape')
            page.wait_for_function('!document.querySelector("#about").open')
            check(item['id']+' notes Escape preserves underlying atlas',page.locator('.hall-atlas').is_visible() and page.locator('.hall-open-atlas').get_attribute('aria-expanded')=='true')
            page.keyboard.press('Escape')
            check(item['id']+' escape restores local content and focus',page.locator('.hall-atlas').is_hidden() and page.locator('.hall-open-atlas').evaluate('(e)=>e===document.activeElement'))
            page.screenshot(path=str(args.output/(item['id']+'-entry.png')),full_page=True)
            result['screenshots'].append(item['id']+'-entry.png')
            page.locator('body').click(position={'x':2,'y':2});before=inspect()['playing'];page.keyboard.press('Space')
            check(item['id']+' global SPACE toggles once',inspect()['playing'] is not before)
            page.locator('#clean').click();check(item['id']+' clean canvas hides HUD',page.locator('.hero-copy').is_hidden())
            page.locator('#clean').click()
            page.locator('#canvas').focus();page.keyboard.press('h');check(item['id']+' canvas H restores clean-view control',page.locator('.hero-copy').is_hidden());page.keyboard.press('h')
            before=inspect()['playing'];page.keyboard.press('Space');check(item['id']+' canvas SPACE toggles once',inspect()['playing'] is not before)
            check(item['id']+' header has eight peer links',page.locator('.hall-modes > a').count()==8 and page.locator('.hall-modes [aria-current]').count()==1)
            check(item['id']+' header is one visible row',page.locator('.hall-modes').evaluate('(e)=>{const r=[...e.children].map(a=>a.getBoundingClientRect());return e.scrollWidth<=e.clientWidth+1&&r.every(a=>Math.abs(a.top-r[0].top)<1)}'))
            before=inspect()['playing'];page.locator('#about-open').click();check(item['id']+' notes pause playback',inspect()['playing'] is False)
            page.keyboard.press('Escape');page.wait_for_function('(playing)=>!document.querySelector("#about").open&&VisualStudy.inspect().playing===playing',arg=before)
            check(item['id']+' notes restore playback',inspect()['playing'] is before)
            pause();h0=digest();page.wait_for_timeout(130);check(item['id']+' pause is stable',digest()==h0)
            if item['id']=='portal':
                change('穿越进度',100);check('camera crosses portal plane',inspect()['z']<0)
                page.get_by_role('button',name='回头看',exact=True).click();page.wait_for_timeout(70);check('turn back uses camera yaw',inspect()['yaw']>3)
            elif item['id']=='temporal':
                page.get_by_label('运动源',exact=True).select_option('video')
                page.evaluate('VisualStudy.play()');page.wait_for_timeout(3200);pause();state=inspect()
                if not args.inline or args.video_fixture:
                    check('bounded frame cache',1<state['count']<=state['capacity']==64)
                    check('real video decoding',state['source']=='video' and state['readyState']>=2)
                    before=digest();change('历史深度（秒）',0);check('2D time field changes sampled pixels',digest()!=before)
                else:check('missing offline video falls back to chapter art',state['source']=='art' and '读取失败' in page.locator('#status').inner_text())
                page.get_by_label('运动源',exact=True).select_option('synthetic');page.evaluate('VisualStudy.play()');page.wait_for_timeout(180);pause();check('explicit synthetic source works',inspect()['source']=='synthetic')
            elif item['id']=='fluid':
                page.get_by_role('button',name='轻推颜料',exact=True).click();page.evaluate('VisualStudy.play()');page.wait_for_timeout(1200);pause();check('pigment is transported',digest()!=h0)
                check('fluid finite after interaction',inspect()['finite'])
                h1=digest();page.evaluate('VisualStudy.play()');page.wait_for_timeout(300);pause();check('flow continues without pointer',digest()!=h1)
            elif item['id']=='optical':
                page.locator('.optical-tools summary').click()
                change('分界位置',60);check('optical boundary changes pixels',digest()!=h0 and inspect()['split']==.6)
            elif item['id']=='shadow':
                count=inspect()['voxels'];page.get_by_role('button',name='对齐菱影 · 90°',exact=True).click();page.wait_for_timeout(90);check('projection changes with same geometry',digest()!=h0 and inspect()['voxels']==count and inspect()['angle']>1.5)
            elif item['id']=='folding':
                change('展开程度',0);check('paper closes flat',inspect()['open']==0)
                change('展开程度',100);check('paper opens while connected',inspect()['open']==1)
            # Exercise every local preset through its visible button, then verify
            # actual module state and canvas pixels, not just selected CSS.
            page.locator('#clean').click()
            if item['id']=='temporal':
                page.get_by_label('运动源',exact=True).select_option('video')
                page.evaluate('VisualStudy.play()');page.wait_for_timeout(3200);pause()
            page_url=page.url
            rendered=[]
            cards=page.locator('.study-strip > button')
            for i in range(cards.count()):
                card=cards.nth(i);scene=card.get_attribute('data-scene')
                card.click();pause();state=inspect()
                check(f'{item["id"]} {scene} stays in page and accents selection',page.url==page_url and card.get_attribute('aria-pressed')=='true' and page.locator('.study-strip [aria-current]').count()==1)
                if item['id']=='portal':
                    check(scene+' camera preset',state['auto'] if scene=='roam' else state['target']==(0 if scene=='threshold' else 1) and state['yaw']==(3.141592653589793 if scene=='return' else 0))
                elif item['id']=='temporal':
                    chapter=item['chapters'][i]
                    check(scene+' art and prose',state['chapter']==scene and state['mode']==chapter['mode'] and state['source']=='art' and state['art']==chapter['image'] and page.locator('h1').inner_text().replace('\n','')==''.join(chapter['headline']))
                elif item['id']=='fluid':
                    chapter=item['chapters'][i]
                    check(scene+' artwork and material journal',state['chapter']==scene and state['finite'] and state['steps']==0 and state['source']=='art' and state['art']==chapter['image'] and page.locator('h1').inner_text().replace('\n','')==''.join(chapter['headline']) and page.locator('.hero-copy > p').inner_text()==chapter['body'])
                elif item['id']=='optical':
                    chapter=item['chapters'][i]
                    check(scene+' optical world and narrative',state['chapter']==scene and state['world']==chapter['world'] and state['art']==chapter['image'] and page.locator('h1').inner_text().replace('\n','')==''.join(chapter['headline']))
                elif item['id']=='shadow':check(scene+' light angle',abs(state['angle']-i*3.141592653589793/6)<1e-8)
                elif item['id']=='folding':check(scene+' paper pose',state['open']==[.76,0,.5,1,1][i] and abs(state['orbit']-(65*3.141592653589793/180 if scene=='side' else .36))<1e-8)
                rendered.append(digest())
            check(item['id']+' content presets produce distinct canvases',len(set(rendered))>=3)
            page.locator('#study-next').click();pause()
            check(item['id']+' local next wraps to first content',cards.first.get_attribute('aria-pressed')=='true' and page.url==page_url)
            page.locator('#study-prev').click();pause()
            check(item['id']+' local previous wraps to last content',cards.last.get_attribute('aria-pressed')=='true' and page.url==page_url)
            # Existing controls must update the same selection state.
            if item['id']=='portal':change('穿越进度',37)
            elif item['id']=='temporal':page.get_by_label('运动源',exact=True).select_option('video');page.get_by_label('时间形状',exact=True).select_option('radial');page.wait_for_timeout(100)
            elif item['id']=='fluid':page.get_by_role('button',name='轻推颜料',exact=True).click();page.wait_for_timeout(100)
            elif item['id']=='optical':change('分界位置',70)
            elif item['id']=='shadow':change('光源方位',43)
            elif item['id']=='folding':change('展开程度',34)
            check(item['id']+' controls synchronize selection',page.locator('.study-strip [aria-current]').count()==(1 if item['id'] in ('temporal','fluid','optical') else 0))
            cards.first.click();pause();page.locator('#clean').click()
            with page.expect_download(timeout=4000) as download:
                page.get_by_role('button',name='保存画面',exact=True).click()
            check(item['id']+' exports PNG',download.value.suggested_filename.endswith('.png'))
            if item['id']=='optical':page.locator('.optical-tools summary').click()
            path=args.output/(item['id']+'-desktop.png');page.screenshot(path=str(path),full_page=True);result['screenshots'].append(path.name)
            page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(100)
            check(item['id']+' mobile layout fits',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
            check(item['id']+' mobile local filmstrip visible by default',page.locator('.hall-scene-footer').is_visible() and page.locator('.hall-atlas').is_hidden() and page.locator('.study-footer').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1}'))
            cards.last.click();pause()
            check(item['id']+' mobile last content scrolls into view',cards.last.evaluate('(e)=>{const a=e.getBoundingClientRect(),b=e.parentElement.getBoundingClientRect();return a.left>=b.left&&a.right<=b.right+1}'))
            page.screenshot(path=str(args.output/(item['id']+'-mobile.png')),full_page=True)
            result['screenshots'].append(item['id']+'-mobile.png')
            check(item['id']+' mobile switch scrolls inside viewport',page.locator('.hall-modes').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&e.scrollWidth>e.clientWidth&&getComputedStyle(e).overflowX==="auto"}'))
            check(item['id']+' active mobile mode visible',page.locator('.hall-modes').evaluate('(e)=>{const r=e.getBoundingClientRect(),a=e.querySelector("[aria-current]").getBoundingClientRect();return a.left>=r.left&&a.right<=r.right}'))
            page.set_viewport_size({'width':320,'height':568});page.wait_for_timeout(100)
            check(item['id']+' narrow phone fits',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
            page.set_viewport_size({'width':390,'height':844})
            page.emulate_media(reduced_motion='reduce');load();page.wait_for_timeout(70);check(item['id']+' honors reduced motion',inspect()['playing'] is False)
            check(item['id']+' no uncaught exceptions: '+repr(errors),not errors)
            page.close()
        browser.close()
    if server:server.shutdown()
    result['passed']=len(result['checks'])
    result['video_fixture']=bool(args.video_fixture)
    (args.output/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('TOTAL',result['passed'])

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inline',action='store_true',help='Render wholly offline without navigating a URL')
    parser.add_argument('--study',choices=['portal','temporal','fluid','optical','shadow','folding'],help='Check a single study')
    parser.add_argument('--chromium',help='Optional browser executable path')
    parser.add_argument('--video-fixture',type=Path,help='Optional local MP4 for the offline decoder test; never committed')
    parser.add_argument('--output',type=Path,default=Path(tempfile.gettempdir())/'ctt-study-review')
    run(parser.parse_args())
