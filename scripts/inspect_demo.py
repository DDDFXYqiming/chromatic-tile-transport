#!/usr/bin/env python3
"""Accept any built 2–24-scene demo: inspect all plans and capture both handoff regions."""
import argparse,json,os,shutil,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--html',type=Path,default=ROOT/'dist/index.html');p.add_argument('--output',type=Path,default=ROOT/'reports/custom');p.add_argument('--width',type=int,default=1440);p.add_argument('--height',type=int,default=900);a=p.parse_args()
a.output.mkdir(parents=True,exist_ok=True)
with sync_playwright() as pw:
    kw={'headless':True};exe=os.environ.get('CHROME_BIN') or shutil.which('chromium') or shutil.which('google-chrome')
    if exe:kw['executable_path']=exe
    if sys.platform.startswith('linux'):kw.update(args=['--no-sandbox','--ignore-gpu-blocklist','--enable-webgl','--use-gl=angle','--use-angle=gl-egl','--disable-dev-shm-usage'],env={**os.environ,'LIBGL_ALWAYS_SOFTWARE':'1','EGL_PLATFORM':'surfaceless'})
    b=pw.chromium.launch(**kw);page=b.new_page(viewport={'width':a.width,'height':a.height},device_scale_factor=1);errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
    page.set_content(a.html.read_text(encoding='utf-8'));page.wait_for_function('window.WarpArchive');page.evaluate('WarpArchive.pause()');page.wait_for_function('WarpArchive.getState().plansReady===WarpArchive.getState().sceneCount',timeout=180000)
    state=page.evaluate('WarpArchive.getState()');metrics=page.evaluate('WarpArchive.getMetrics()');n=state['sceneCount']
    for i in range(n):
        page.evaluate('(p)=>WarpArchive.seek(p)',i+.4);page.screenshot(path=str(a.output/f'scene-{i+1:02d}-transport.png'))
    for progress in [0,.14,.20,.81,.87,1]:
        page.evaluate('(p)=>WarpArchive.seek(p)',progress);page.screenshot(path=str(a.output/f'handoff-{progress:.2f}.png'))
    a1=page.evaluate('()=>{WarpArchive.seek(.46);return document.getElementById("visual").toDataURL()}')
    a2=page.evaluate('()=>{WarpArchive.seek(.73);WarpArchive.seek(.46);return document.getElementById("visual").toDataURL()}')
    checks={'allPlansReady':len(metrics)==n,'bijections':all(x['count']==x['uniqueTargets'] and x['bijection'] for x in metrics),'reversePixelIdentical':a1==a2,'noExternalRequests':all(u.startswith(('data:','blob:')) for u in requests),'noBrowserErrors':not errors,'noGraphicsErrors':page.evaluate('WarpArchive.getState().glError||0')==0,'noHorizontalOverflow':page.evaluate('document.documentElement.scrollWidth<=innerWidth')}
    report={'html':a.html.name,'viewport':[a.width,a.height],'state':state,'metrics':metrics,'checks':checks,'errors':errors,'allPassed':all(checks.values()),'note':'Screenshot/logic acceptance, not a real-device FPS benchmark. Review both handoff regions in actual playback.'}
    (a.output/'acceptance.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');b.close()
print(json.dumps(checks,ensure_ascii=False,indent=2));sys.exit(0 if report['allPassed'] else 1)
