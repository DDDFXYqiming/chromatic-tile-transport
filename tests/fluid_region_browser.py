"""Study 05 region isolation, idle scheduling and comparable browser cost samples."""
import argparse
import functools
import io
import json
import subprocess
import sys
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path

from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from serve import RangeRequestHandler


def run(output,baseline=None):
    output.mkdir(parents=True,exist_ok=True)
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(RangeRequestHandler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    checks,errors,profiles=[],[],{}
    def check(name,value):
        assert value,name
        checks.append(name)
        print('PASS',name,flush=True)
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True)
            page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
            page.on('pageerror',lambda e:errors.append(str(e)))
            if baseline:
                old=subprocess.check_output(['git','show',f'{baseline}:src/studies/fluid.mjs'],cwd=ROOT)
                page.route('**/src/studies/fluid.mjs',lambda route:route.fulfill(body=old,content_type='text/javascript'))
            page.goto(f'http://127.0.0.1:{server.server_port}/dist/liquid-canvas.html')
            page.wait_for_function('window.VisualStudy && VisualStudy.inspect().frame>0')
            inspect=lambda:page.evaluate('VisualStudy.inspect()')
            cdp=page.context.new_cdp_session(page)
            cdp.send('Performance.enable')
            def metrics():return {m['name']:m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
            def profile(label):
                a,sa=metrics(),inspect()
                page.wait_for_timeout(3000)
                b,sb=metrics(),inspect()
                elapsed=b['Timestamp']-a['Timestamp']
                profiles[label]={'seconds':elapsed,'main_thread_ms_per_second':(b['TaskDuration']-a['TaskDuration'])*1000/elapsed,
                    'frames_per_second':(sb['frame']-sa['frame'])/elapsed,'simulation_steps':sb['steps']-sa['steps'],
                    'uploads':sb.get('uploads',0)-sa.get('uploads',0),'state':sb}
                print('PROFILE',label,json.dumps(profiles[label]),flush=True)
            profile('reading')
            page.get_by_role('button',name='轻推颜料',exact=True).click()
            profile('flow')
            page.wait_for_timeout(8000)
            profile('settled')
            if not baseline:
                check('reading redraws at most 13 Hz',profiles['reading']['frames_per_second']<=13)
                check('settled flow stops solver and texture uploads',profiles['settled']['simulation_steps']==0 and profiles['settled']['uploads']==0 and not inspect()['active'])
                check('settled painting survives sleep',inspect()['disturbed'])
                page.get_by_role('button',name='轻推颜料',exact=True).click()
                page.wait_for_timeout(100)
                check('new pigment input wakes sleeping solver',inspect()['active'])
                page.emulate_media(reduced_motion='reduce')
                page.evaluate('VisualStudy.pause()')
                page.locator('#reset').click()
                page.locator('#clean').click()

                def source_point(x,y):
                    b=page.locator('#canvas').bounding_box()
                    scale=max(b['width']/1536,b['height']/1024)
                    return (b['x']+(b['width']-1536*scale)/2+x*1536*scale,
                            b['y']+(b['height']-1024*scale)/2+y*1024*scale)
                def drag(a,b):
                    page.mouse.move(*a);page.mouse.down();page.mouse.move(*b,steps=8);page.mouse.up();page.wait_for_timeout(100)
                def shot():return Image.open(io.BytesIO(page.locator('#canvas').screenshot())).convert('RGB')
                points={'mineral':(.60,.71),'ink':(.65,.5),'paper':(.70,.55),'light':(.58,.78)}
                for chapter,point in points.items():
                    page.locator(f'[data-scene="{chapter}"]').click()
                    page.wait_for_timeout(100)
                    page.evaluate('scrollTo(0,0)')
                    b=page.locator('#canvas').bounding_box()
                    # Blank stage area does not even wake the solver.
                    drag((b['x']+b['width']*.1,b['y']+b['height']*.25),(b['x']+b['width']*.2,b['y']+b['height']*.3))
                    check(chapter+' empty drag stays inert',inspect()['steps']==0 and not inspect()['disturbed'])
                    before=shot()
                    drag(source_point(*point),source_point(point[0]+.035,point[1]+.015))
                    after=shot()
                    check(chapter+' pigment drag visibly moves pixels',inspect()['steps']>0 and ImageChops.difference(before,after).getbbox() is not None)
                    # A large untouched strip must remain byte-identical, not
                    # just appear calm after pressure diffuses across the grid.
                    strip=(0,0,round(before.width*.12),before.height)
                    check(chapter+' exterior pixels stay identical',ImageChops.difference(before.crop(strip),after.crop(strip)).getbbox() is None)
                    page.screenshot(path=str(output/f'{chapter}-region.png'),full_page=True)

                page.locator('[data-scene="ink"]').click()
                page.wait_for_timeout(100)
                page.evaluate('scrollTo(0,0)')
                start=source_point(.65,.5)
                page.mouse.move(*start);page.mouse.down()
                page.mouse.move(-20,start[1])
                page.mouse.move(*source_point(.68,.52))
                page.mouse.up();page.wait_for_timeout(100)
                check('leaving and reentering does not bridge strokes',inspect()['steps']==0)
                page.locator('#clean').click()
                page.wait_for_timeout(100)
                for selector in ['.hero-copy','.fluid-folio','.fluid-edition','.telemetry','.fluid-stamp']:
                    b=page.locator(selector).bounding_box()
                    drag((b['x']+b['width']*.35,b['y']+b['height']*.3),(b['x']+b['width']*.65,b['y']+b['height']*.5))
                    check(selector+' drag stays inert',inspect()['steps']==0 and not inspect()['disturbed'])
                for width,height in [(390,844),(320,568)]:
                    page.set_viewport_size({'width':width,'height':height})
                    page.locator('#clean').click()
                    page.wait_for_timeout(100)
                    page.evaluate('scrollTo(0,0)')
                    drag(source_point(.55,.3),source_point(.58,.33))
                    check(f'{width}px crop keeps pigment interactive',inspect()['steps']>0 and inspect()['finite'])
                    page.locator('#reset').click()
                    page.locator('#clean').click()
                    page.wait_for_timeout(100)
                    b=page.locator('.fluid-folio').bounding_box()
                    page.locator('.fluid-folio').scroll_into_view_if_needed()
                    b=page.locator('.fluid-folio').bounding_box()
                    drag((b['x']+30,b['y']+30),(b['x']+100,b['y']+60))
                    check(f'{width}px editorial card stays inert',inspect()['steps']==0)
            check('no browser runtime errors',not errors)
            browser.close()
    finally:
        server.shutdown()
        (output/'results.json').write_text(json.dumps({'baseline':baseline,'passed':len(checks),'checks':checks,'errors':errors,'profiles':profiles},indent=2)+'\n',encoding='utf-8')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--baseline',help='Git revision whose fluid module is served for a cost comparison')
    args=parser.parse_args()
    run(args.output,args.baseline)
