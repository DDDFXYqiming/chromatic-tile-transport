"""Native-HTTP integration runner for study 07. Audits also run via browser control."""
import argparse
import functools
import json
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

def run(output):
    output.mkdir(parents=True,exist_ok=True)
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    reports=[]
    errors=[]
    failed=[]
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True)
            page=browser.new_page(viewport={'width':1440,'height':900})
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('response',lambda r:failed.append(r.url) if r.status>=400 and 'favicon' not in r.url else None)
            page.goto(f'http://127.0.0.1:{server.server_port}/dist/shadow-apparatus.html')
            page.wait_for_function('window.VisualStudy?.inspect().frame>0')
            page.get_by_role('button',name='暂停巡航',exact=True).click()
            def paint():
                page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
            def audit():
                paint()
                result=page.evaluate('import("/tests/shadow_acceptance.mjs").then(m=>m.auditShadowPage())')
                reports.append(result)
                return result
            for w,h in [(1440,900),(1920,1080),(1024,768),(768,1024),(390,844),(320,568)]:
                page.set_viewport_size({'width':w,'height':h})
                for i in range(4):
                    page.locator('.study-card').nth(i).click()
                    result=audit()
                    page.screenshot(path=str(output/f'{result["state"]["chapter"]}-{w}.png'),full_page=True)
            page.set_viewport_size({'width':1440,'height':900})
            page.get_by_role('button',name='调光 ↗',exact=True).click()
            page.get_by_label('光的方向',exact=True).fill('85')
            assert abs(audit()['state']['angle']-85*3.141592653589793/180)<1e-9
            page.get_by_label('影的浓度',exact=True).fill('0.4')
            assert audit()['state']['strength']==.4
            page.get_by_role('button',name='重置',exact=True).click()
            assert audit()['state']['strength']==.9
            with page.expect_download() as download:
                page.get_by_role('button',name='保存画面',exact=True).click()
            download.value.save_as(str(output/'export.png'))
            assert (output/'export.png').stat().st_size>10000
            page.get_by_label('光的方向',exact=True).press('Escape')
            assert page.locator('.instrument-bar').is_hidden()
            before=audit()['state']['angle']
            page.locator('#canvas').press('ArrowRight')
            assert abs(audit()['state']['angle']-before-.08)<1e-8
            before=audit()['canvasHash']
            page.wait_for_timeout(200)
            assert audit()['canvasHash']==before
            page.get_by_role('button',name='继续巡航',exact=True).click()
            page.wait_for_timeout(800)
            assert audit()['canvasHash']!=before
            chapter=audit()['state']['chapter']
            page.wait_for_function('(id)=>VisualStudy.inspect().chapter!==id',arg=chapter,timeout=25000)
            audit()
            page.emulate_media(reduced_motion='reduce')
            page.reload()
            page.wait_for_function('window.VisualStudy?.inspect().frame>0')
            assert audit()['state']['playing'] is False
            before=audit()['canvasHash']
            page.wait_for_timeout(200)
            assert audit()['canvasHash']==before
            assert not errors and not failed,(errors,failed)
            browser.close()
    finally:
        server.shutdown()
    (output/'results.json').write_text(json.dumps({'audits':reports,'errors':errors,'failed_requests':failed},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'{sum(len(r["checks"]) for r in reports)} browser assertions passed')
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output',type=Path,default=ROOT/'reports/shadow')
    run(p.parse_args().output)
