import functools, threading, sys
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
root=Path('D:/AI_Projects/chromatic-wt-s08')
out=Path(__file__).resolve().parent
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
    page.on('pageerror',lambda e:print(e))
    page.goto(f'http://127.0.0.1:{server.server_port}/dist/folding-theater.html')
    page.wait_for_function('window.VisualStudy && VisualStudy.inspect().frame>0')
    page.screenshot(path=str(out/'preview-desktop.png'),full_page=True)
    print(page.evaluate('VisualStudy.inspect()'))
    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_timeout(150)
    page.screenshot(path=str(out/'preview-mobile.png'),full_page=True)
    browser.close()
server.shutdown()
