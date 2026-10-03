#!/usr/bin/env python3
"""Playwright interaction checks for studies 03-08 (offline or HTTP mode)."""
from __future__ import annotations
import argparse
import hashlib
import json
import threading
import tempfile
import functools
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
from studies_inline import ROOT, bundle, inline_page


def run(args):
    catalog=json.loads((ROOT/'src/studies/catalog.json').read_text())
    result={'loading':'offline-inline' if args.inline else 'HTTP native modules','checks':[],'screenshots':[]}
    args.output.mkdir(parents=True,exist_ok=True)
    server=None
    if not args.inline:
        server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
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
            errors=[]
            page=browser.new_page(viewport={'width':1440,'height':1050},device_scale_factor=1,accept_downloads=True)
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
            pause();h0=digest();page.wait_for_timeout(130);check(item['id']+' pause is stable',digest()==h0)
            if item['id']=='portal':
                change('穿越进度',100);check('camera crosses portal plane',inspect()['z']<0)
                page.get_by_role('button',name='回头看',exact=True).click();page.wait_for_timeout(70);check('turn back uses camera yaw',inspect()['yaw']>3)
            elif item['id']=='temporal':
                page.evaluate('VisualStudy.play()');page.wait_for_timeout(3200);pause();state=inspect();check('bounded frame cache',1<state['count']<=state['capacity']==64)
                if args.video_fixture:check('real video decoding fixture',state['source']=='video' and state['readyState']>=2)
                before=digest();page.get_by_label('时间形状',exact=True).select_option('wave');page.wait_for_timeout(100);check('2D time field changes sampled pixels',digest()!=before)
                page.get_by_label('运动源',exact=True).select_option('synthetic');page.evaluate('VisualStudy.play()');page.wait_for_timeout(180);pause();check('explicit synthetic source works',inspect()['source']=='synthetic')
            elif item['id']=='fluid':
                page.get_by_role('button',name='轻推颜料',exact=True).click();page.evaluate('VisualStudy.play()');page.wait_for_timeout(1200);pause();check('pigment is transported',digest()!=h0)
                check('fluid finite after interaction',inspect()['finite'])
                h1=digest();page.evaluate('VisualStudy.play()');page.wait_for_timeout(300);pause();check('flow continues without pointer',digest()!=h1)
            elif item['id']=='optical':
                change('折射率',1.68);check('refraction parameter changes pixels',digest()!=h0)
                box=page.locator('#canvas').bounding_box();page.mouse.move(box['x']+box['width']*.5,box['y']+box['height']*.5);page.mouse.down();page.mouse.move(box['x']+box['width']*.66,box['y']+box['height']*.45,steps=8);page.mouse.up();page.wait_for_timeout(80);check('lens follows drag',inspect()['pos'][0]>.6)
            elif item['id']=='shadow':
                count=inspect()['voxels'];page.get_by_role('button',name='对齐菱影 · 90°',exact=True).click();page.wait_for_timeout(90);check('projection changes with same geometry',digest()!=h0 and inspect()['voxels']==count and inspect()['angle']>1.5)
            elif item['id']=='folding':
                change('展开程度',0);check('paper closes flat',inspect()['open']==0)
                change('展开程度',100);check('paper opens while connected',inspect()['open']==1)
            with page.expect_download(timeout=4000) as download:
                page.get_by_role('button',name='保存画面',exact=True).click()
            check(item['id']+' exports PNG',download.value.suggested_filename.endswith('.png'))
            path=args.output/(item['id']+'-desktop.png');page.screenshot(path=str(path),full_page=True);result['screenshots'].append(path.name)
            page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(100)
            check(item['id']+' mobile layout fits',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
            page.screenshot(path=str(args.output/(item['id']+'-mobile.png')),full_page=True)
            page.emulate_media(reduced_motion='reduce');load();page.wait_for_timeout(70);check(item['id']+' honors reduced motion',inspect()['playing'] is False)
            check(item['id']+' no uncaught exceptions: '+repr(errors),not errors)
            page.close()
        browser.close()
    if server:server.shutdown()
    result['passed']=len(result['checks'])
    result['video_fixture']=bool(args.video_fixture)
    (args.output/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print('TOTAL',result['passed'])

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inline',action='store_true',help='Render wholly offline without navigating a URL')
    parser.add_argument('--chromium',help='Optional browser executable path')
    parser.add_argument('--video-fixture',type=Path,help='Optional local MP4 for the offline decoder test; never committed')
    parser.add_argument('--output',type=Path,default=Path(tempfile.gettempdir())/'ctt-study-review')
    run(parser.parse_args())
