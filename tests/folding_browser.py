#!/usr/bin/env python3
"""Headless native-module checks and a recorded reading session for FOLIO."""
from __future__ import annotations
import argparse
import functools
import hashlib
import json
import math
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass


def run(output):
    output.mkdir(parents=True,exist_ok=True)
    chapters=next(c for c in json.loads((ROOT/'src/studies/catalog.json').read_text(encoding='utf-8')) if c['id']=='folding')['chapters']
    checks=[];errors=[];failed=[];playback=[]
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    url=f'http://127.0.0.1:{server.server_port}/dist/folding-theater.html'

    def check(name,condition):
        assert condition,name
        checks.append(name);print('PASS',name,flush=True)

    def watch(page):
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('requestfailed',lambda r:failed.append(r.url))
        page.on('response',lambda r:failed.append(f'{r.status} {r.url}') if r.status>=400 else None)

    def state(page):return page.evaluate('VisualStudy.inspect()')
    def pause(page):
        page.evaluate('VisualStudy.pause()')
        page.wait_for_function('VisualStudy.inspect().open===VisualStudy.inspect().target')
    def digest(page):return hashlib.sha256(page.locator('#canvas').screenshot()).hexdigest()
    def choose(page,index):
        page.locator(f'.study-strip [data-scene="{chapters[index]["id"]}"]').click()
        page.wait_for_function('(id)=>VisualStudy.inspect().chapter===id',arg=chapters[index]['id'])
    def change(page,label,value):
        field=page.get_by_label(label,exact=True);field.fill(str(value));field.dispatch_event('input')
        page.wait_for_timeout(75)
    def copy_matches(page,index):
        c=chapters[index];s=state(page)
        return (s['chapter']==c['id'] and s['art']==c['image'] and
                page.locator('h1').inner_text().replace('\n','')==''.join(c['headline']) and
                page.locator('.hero-copy > p').inner_text()==c['body'] and
                page.locator('.folding-folio h2').inner_text()==c['feature'] and
                page.locator('.folding-folio p').inner_text()==c['detail'] and
                page.locator('.folding-note p').inner_text()==c['note'] and
                page.locator('#interact > span').inner_text()==c['action'] and
                page.locator('.study-strip [aria-current]').get_attribute('data-scene')==c['id'])
    def attached(s):
        p=s['panels'];near=lambda a,b:math.dist(a,b)<1e-8
        joints=[(p['left'][1],p['center'][0]),(p['left'][2],p['center'][3]),
                (p['right'][0],p['center'][1]),(p['right'][3],p['center'][2]),
                (p['floor'][0],p['center'][0]),(p['floor'][1],p['center'][1])]
        for index,u in enumerate((.175,.825)):
            anchor=[(p['floor'][0][j]*(1-u)+p['floor'][1][j]*u+p['floor'][3][j]*(1-u)+p['floor'][2][j]*u)/2 for j in range(3)]
            joints.append((p['popup'][index],anchor))
        return all(near(a,b) for a,b in joints) and all(math.isfinite(v) for panel in p.values() for point in panel for v in point)

    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True)
            context=browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1,accept_downloads=True)
            page=context.new_page();watch(page);page.goto(url)
            page.wait_for_function('window.VisualStudy && VisualStudy.inspect().frame>0')
            check('four chapter artworks decode',state(page)['texturesLoaded']==4 and page.locator('.study-strip img').evaluate_all('(imgs)=>imgs.length===4&&imgs.every(i=>i.complete&&i.naturalWidth>0)'))
            pause(page);rendered=[]
            for i,c in enumerate(chapters):
                choose(page,i);pause(page)
                check(c['id']+' switches all prose and the paper image together',copy_matches(page,i))
                check(c['id']+' selection preserves pause and restores its pose',not state(page)['playing'] and state(page)['open']==c['pose']['open'] and state(page)['orbit']==c['pose']['orbit'])
                rendered.append(digest(page));page.screenshot(path=str(output/(c['id']+'-desktop.png')),full_page=True)
            check('all four chapters render distinct paper canvases',len(set(rendered))==4)
            check('chapter changes stay on the same local page',page.url==url)
            page.locator('#study-next').click();pause(page);check('next wraps to the first chapter',copy_matches(page,0))
            page.locator('#study-prev').click();pause(page);check('previous wraps to the last chapter',copy_matches(page,3))
            page.locator('#interact').click();pause(page);check('reading CTA turns both image and article',copy_matches(page,0))
            for value in (0,10,34,50,76,100):
                change(page,'展开程度',value);s=state(page)
                check(f'{value}% fold keeps all eight hinge endpoints attached',s['open']==value/100 and attached(s))
                check(f'{value}% fold keeps rigid panel lengths',all(abs(math.dist(s['panels'][name][0],s['panels'][name][3])-4)<1e-8 for name in ('left','center','right')) and abs(math.dist(s['panels']['floor'][0],s['panels']['floor'][3])-2.7)<1e-8)
                if value in (0,50,100):page.locator('#canvas').screenshot(path=str(output/f'paper-{value}.png'))
            check('manual folding preserves article selection',copy_matches(page,0))
            change(page,'观察角度',-55);left=digest(page)
            change(page,'观察角度',55);check('angle slider changes the projected scene',digest(page)!=left)
            choose(page,0);pause(page);before=state(page)['orbit'];canvas=page.locator('#canvas');box=canvas.bounding_box()
            page.mouse.move(box['x']+box['width']*.25,box['y']+box['height']*.5);page.mouse.down()
            check('starting a drag does not jump the viewpoint',state(page)['orbit']==before)
            page.mouse.move(box['x']+box['width']*.35,box['y']+box['height']*.5,steps=8);page.mouse.up()
            check('drag rotates the connected paper',state(page)['orbit']>before+.1 and attached(state(page)))
            canvas.focus();before=state(page)['target'];page.keyboard.press('ArrowUp');page.wait_for_timeout(70)
            check('keyboard can unfold the current article',abs(state(page)['open']-before-.05)<1e-8 and copy_matches(page,0))
            before=state(page)['orbit'];page.keyboard.press('ArrowLeft');page.wait_for_timeout(70)
            check('keyboard can orbit the paper',state(page)['orbit']<before)
            stable=digest(page);page.wait_for_timeout(200);check('paused canvas is pixel stable',digest(page)==stable)
            with page.expect_download() as saved:page.locator('#snapshot').click()
            saved.value.save_as(str(output/'export.png'))
            check('export writes a nonempty PNG',(output/'export.png').stat().st_size>20000)
            page.locator('#clean').click();page.wait_for_timeout(100)
            check('clean mode hides all editorial overlays',all(page.locator(selector).is_hidden() for selector in ('.hero-copy','.folding-edition','.folding-folio','.folding-note','.folding-page-mark')))
            page.locator('#clean').click();page.locator('#reset').click();pause(page)
            check('reset restores the first complete article',copy_matches(page,0) and not state(page)['auto'])
            for width,height in ((1920,1080),(1024,768),(768,1024),(390,844),(320,568)):
                page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(80)
                for i,c in enumerate(chapters):
                    choose(page,i);pause(page)
                    check(f'{width}px {c["id"]} fits viewport with readable complete copy',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1') and copy_matches(page,i) and page.locator('.hero-copy p').is_visible() and page.locator('.folding-folio p').is_visible())
                check(f'{width}px article, art and notes do not overlap',page.evaluate('''() => {
                    const boxes=['.hero-copy','#canvas','.folding-folio','.folding-note'].map(s=>document.querySelector(s).getBoundingClientRect());
                    return boxes.every((a,i)=>boxes.every((b,j)=>i===j||Math.min(a.right,b.right)-Math.max(a.left,b.left)<=1||Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<=1));
                }'''))
                if width<=600:
                    page.evaluate('scrollTo(0,0)')
                    check(f'{width}px chapter strip remains available',page.locator('.study-footer').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1}'))
                    for i in (0,3,1,2):choose(page,i);pause(page);check(f'{width}px pointer selection reaches {chapters[i]["id"]}',copy_matches(page,i))
                choose(page,0);pause(page);page.evaluate('scrollTo(0,0)')
                page.screenshot(path=str(output/f'layout-{width}.png'),full_page=True)
                if width==390:
                    page.screenshot(path=str(output/'mobile-reading.png'))
                    page.locator('#canvas').evaluate('(e)=>e.scrollIntoView({block:"center"})')
                    page.screenshot(path=str(output/'mobile-paper.png'))
            page.set_viewport_size({'width':1440,'height':1000})
            page.evaluate('VisualStudy.play()')
            for i in (1,3,0,2):choose(page,i)
            page.wait_for_function('VisualStudy.inspect().open===VisualStudy.inspect().target')
            check('rapid selections settle on the last requested chapter',copy_matches(page,2))
            page.locator('#about-open').click();check('notes dialog pauses motion',not state(page)['playing'])
            page.keyboard.press('Escape')
            page.wait_for_function('!document.querySelector("#about").open && VisualStudy.inspect().playing')
            check('notes dialog restores playback',state(page)['playing'])
            context.close()

            reduced=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce')
            rp=reduced.new_page();watch(rp);rp.goto(url);rp.wait_for_function('window.VisualStudy && VisualStudy.inspect().frame>0')
            check('reduced motion starts paused',not state(rp)['playing'])
            for i in range(4):
                choose(rp,i);pause(rp);check('reduced motion selects '+chapters[i]['id']+' immediately',copy_matches(rp,i) and state(rp)['open']==state(rp)['target'])
            reduced.close()

            tour=browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1,record_video_dir=str(output/'playback'),record_video_size={'width':1440,'height':1000})
            tp=tour.new_page();watch(tp);tp.goto(url);tp.wait_for_function('window.VisualStudy && VisualStudy.inspect().frame>0')
            for i in (1,2,3,0):
                choose(tp,i);snapshots=[]
                for n,delay in enumerate((70,180,500,1400)):
                    tp.wait_for_timeout(delay);s=state(tp);snapshots.append(s['open'])
                    playback.append({'chapter':s['chapter'],'open':s['open'],'target':s['target'],'frame':s['frame']})
                    if i==1:tp.screenshot(path=str(output/f'unfold-{n}.png'),full_page=True)
                check(chapters[i]['id']+' plays a real unfolding transition',snapshots[0]<snapshots[1]<snapshots[2]<=snapshots[3])
                tp.wait_for_function('VisualStudy.inspect().open===VisualStudy.inspect().target',timeout=12000)
                check(chapters[i]['id']+' settles at its full reading pose',state(tp)['open']==chapters[i]['pose']['open'])
            tp.get_by_role('button',name='自动翻页',exact=True).click()
            check('automatic reading is explicitly enabled',state(tp)['auto'])
            tp.wait_for_timeout(600);tp.locator('#play').click();held=state(tp)['chapterTime'];tp.wait_for_timeout(400)
            check('pause freezes the automatic reading clock',state(tp)['chapterTime']==held)
            tp.locator('#play').click()
            tp.wait_for_function('VisualStudy.inspect().chapter==="night"',timeout=40000)
            check('automatic reading advances image, copy and strip after its hold',copy_matches(tp,1) and state(tp)['auto'])
            choose(tp,3);check('manual selection stops automatic turning',not state(tp)['auto'] and copy_matches(tp,3))
            tp.wait_for_timeout(1800);video=tp.video;tour.close();video.save_as(str(output/'folding-tour.webm'))
            check('recorded browser playback is nonempty',(output/'folding-tour.webm').stat().st_size>100000)
            browser.close()
            check('no runtime exceptions or failed local resources',not errors and not failed)
    finally:
        server.shutdown()
        (output/'results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors,'failed_requests':failed,'playback':playback},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('TOTAL',len(checks),flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'reports/folding-browser')
    run(parser.parse_args().output)
