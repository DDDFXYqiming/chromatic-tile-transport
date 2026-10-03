import functools, threading
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
root=Path('D:/AI_Projects/chromatic-wt-s08');out=Path(__file__).resolve().parent
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1440,'height':1000})
    page.goto(f'http://127.0.0.1:{server.server_port}/dist/folding-theater.html')
    page.wait_for_function('window.VisualStudy && VisualStudy.inspect().frame>0')
    page.evaluate('VisualStudy.pause()')
    for value in (0,5,10,50,100):
        slider=page.get_by_label('展开程度',exact=True);slider.fill(str(value));slider.dispatch_event('input')
        page.wait_for_function('(v)=>VisualStudy.inspect().open===v/100',arg=value)
        page.locator('#canvas').screenshot(path=str(out/f'endpoint-{value}.png'))
    browser.close()
server.shutdown()
print('Five final folding endpoints rendered.')
