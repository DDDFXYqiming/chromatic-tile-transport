"""Capture each local preset from its actual canvas in headless Chromium."""
import functools
import io
import json
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path
from PIL import Image, ImageOps
from playwright.sync_api import sync_playwright
from serve import RangeRequestHandler

ROOT = Path(__file__).resolve().parents[1]


def main():
    output = ROOT / 'assets/studies/filmstrip'
    output.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(RangeRequestHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
            for item in json.loads((ROOT / 'src/studies/catalog.json').read_text(encoding='utf-8')):
                page.goto(f'http://127.0.0.1:{server.server_port}/dist/{item["slug"]}.html')
                page.wait_for_function('window.VisualStudy && VisualStudy.inspect().frame > 0')
                page.evaluate('VisualStudy.pause()')
                page.locator('#clean').click()
                cards = page.locator('.study-strip > button')
                for index in range(cards.count()):
                    card = cards.nth(index)
                    card.click()
                    if item['id'] == 'temporal':
                        page.evaluate('VisualStudy.play()')
                        page.wait_for_timeout(3000)
                    elif card.get_attribute('data-scene') == 'roam':
                        page.wait_for_timeout(2400)
                    page.evaluate('VisualStudy.pause()')
                    page.wait_for_timeout(100)
                    # Read only the rendered canvas, without interface overlays.
                    png = page.locator('#canvas').screenshot()
                    with Image.open(io.BytesIO(png)) as im:
                        thumb = ImageOps.fit(im.convert('RGB'), (160, 96), method=Image.Resampling.LANCZOS)
                        name = f'{item["id"]}-{card.get_attribute("data-scene")}.webp'
                        thumb.save(output / name, quality=86)
                    print('Built', name, flush=True)
            browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
