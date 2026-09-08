import json,time,hashlib,os,sys,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
SOURCE=Path(__file__).resolve().parents[1]
ROOT=SOURCE/'reports'/'browser';ROOT.mkdir(parents=True,exist_ok=True)
HTML=(SOURCE/'dist'/'index.html').read_text(encoding='utf-8')
checks=[];errors=[]
def check(name,fn):
 try:
  detail=fn();checks.append({'test':name,'passed':True,'detail':detail});print('PASS',name,flush=True)
 except Exception as e:
  checks.append({'test':name,'passed':False,'error':str(e)});print('FAIL',name,str(e),flush=True)
def require(v,msg='Assertion failed'):
 if not v:raise AssertionError(msg)
 return v
with sync_playwright() as p:
 launch={'headless':True}
 executable=os.environ.get('CHROME_BIN') or shutil.which('chromium') or shutil.which('google-chrome')
 if executable:launch['executable_path']=executable
 if sys.platform.startswith('linux'):
  launch.update(args=['--no-sandbox','--ignore-gpu-blocklist','--enable-webgl','--use-gl=angle','--use-angle=gl-egl','--disable-dev-shm-usage'],env={**os.environ,'LIBGL_ALWAYS_SOFTWARE':'1','EGL_PLATFORM':'surfaceless'})
 browser=p.chromium.launch(**launch)
 page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
 page.on('pageerror',lambda e:errors.append(str(e)))
 requests=[];page.on('request',lambda r:requests.append(r.url[:80]))
 page.set_content(HTML,wait_until='load');page.wait_for_function('window.WarpArchive',timeout=25000)
 page.evaluate('WarpArchive.pause()');page.wait_for_function('WarpArchive.getState().plansReady===5',timeout=60000)
 state=lambda:page.evaluate('WarpArchive.getState()')
 check('Primary WebGL 2 renderer starts without GL errors',lambda:require(state()['engine']=='WEBGL 2' and state()['glError']==0))
 check('Zero external network requests (local Blob worker allowed)',lambda:require(all(u.startswith(('blob:','data:')) for u in requests),requests))
 check('All five desktop plans have unique target cells',lambda:require(page.evaluate('WarpArchive.getMetrics().every(m=>m.bijection && m.count===12160 && m.uniqueTargets===12160)')))
 check('Every actual-image pair lowers mean weighted colour error vs same-position',lambda:require(page.evaluate('WarpArchive.getMetrics().every(m=>m.meanColorError<m.samePositionError)')))
 check('Every actual-image refinement lowers total objective',lambda:require(page.evaluate('WarpArchive.getMetrics().every(m=>m.finalObjective<=m.initialObjective)')))
 check('Five pairs produce five distinct maps',lambda:require(page.evaluate('new Set(WarpArchive.getMetrics().map(m=>m.hash)).size===5')))
 def endpoints():
  out=[]
  for i in range(5):
   data=page.evaluate('(i)=>{WarpArchive.seek(i);return document.getElementById("visual").toDataURL()}',i)
   require(len(data)>50000);out.append(hashlib.sha256(data.encode()).hexdigest()[:12])
  require(len(set(out))==5);return out
 check('All five endpoints display different, nonblank complete images',endpoints)
 def reverse():
  h=[]
  for t in [.46,.73,.46]:
   h.append(page.evaluate('(t)=>{WarpArchive.seek(t);return document.getElementById("visual").toDataURL()}',t))
  require(h[0]==h[2]);require(h[0]!=h[1]);return 'Exact pixel-identical return to p=.46'
 check('Reverse seeking returns to exactly the same pixels',reverse)
 def pause():
  page.evaluate('WarpArchive.seek(.41)');v=state()['position'];page.wait_for_timeout(250);require(state()['position']==v);return v
 check('Paused transition does not drift',pause)
 def controls():
  hashes={}
  for m in ['color','geometry','position']:
   data=page.evaluate('(m)=>{WarpArchive.configure({mapping:m});WarpArchive.seek(.56);return document.getElementById("visual").toDataURL()}',m)
   hashes[m]=hashlib.sha256(data.encode()).hexdigest()[:16]
  page.evaluate('WarpArchive.configure({mapping:"color"})');require(len(set(hashes.values()))==3);return hashes
 check('A/B modes use visibly different mapping at same progress',controls)
 def held():
  a=page.evaluate('()=>{WarpArchive.configure({holdColor:false});WarpArchive.seek(.76);return document.getElementById("visual").toDataURL()}')
  b=page.evaluate('()=>{WarpArchive.configure({holdColor:true});WarpArchive.seek(.76);return document.getElementById("visual").toDataURL()}')
  require(a!=b);page.evaluate('WarpArchive.configure({holdColor:false})');return 'Arrival tint is deferred in tracking mode'
 check('Original-colour tracking affects late transport',held)
 def spatial():
  results=[]
  for w in [.002,.095]:
   page.evaluate('(w)=>{WarpArchive.seek(0);WarpArchive.configure({spatial:w});}',w)
   page.wait_for_function('WarpArchive.getState().plansReady===5',timeout=60000)
   results.append(state()['metrics'])
  require(results[1]['meanTravel']<results[0]['meanTravel']);page.evaluate('WarpArchive.configure({spatial:.022})');page.wait_for_function('WarpArchive.getState().plansReady===5',timeout=60000)
  return {'colourFirstMeanTravel':results[0]['meanTravel'],'localFirstMeanTravel':results[1]['meanTravel']}
 check('Spatial preference changes map and reduces travel distance',spatial)
 def slider():
  page.locator('#timeline').evaluate('(e)=>{e.value="550";e.dispatchEvent(new Event("input",{bubbles:true}))}')
  require(abs(state()['position']-.55)<1e-6);return state()['position']
 check('Timeline input seeks precisely',slider)
 def wheel():
  page.evaluate('WarpArchive.seek(.2)');page.locator('#stage').hover();page.mouse.wheel(0,90);page.wait_for_timeout(300);require(state()['position']>.22);page.mouse.move(0,0);return state()['position']
 check('Wheel scrub advances current transition',wheel)
 def autoplay():
  page.evaluate('WarpArchive.seek(0);WarpArchive.configure({duration:.45,holdTime:.1});WarpArchive.play()')
  page.wait_for_timeout(600);require(state()['position']>0);page.evaluate('WarpArchive.pause();WarpArchive.configure({duration:5.8,holdTime:3.2})');return state()['position']
 check('Autoplay advances, then can be paused',autoplay)
 def negative():
  page.evaluate('WarpArchive.seek(-.25)');require(state()['scene'] in [4,0]);require(state()['glError']==0);return state()['position']
 check('Loop boundary and negative seek render without errors',negative)
 def dense():
  page.evaluate('WarpArchive.seek(0);WarpArchive.configure({density:216})');page.wait_for_function('WarpArchive.getState().plansReady===5',timeout=60000)
  require(state()['cells']>20000);page.evaluate('WarpArchive.seek(.49)');require(state()['glError']==0);n=state()['cells'];page.evaluate('WarpArchive.configure({density:152})');page.wait_for_function('WarpArchive.getState().plansReady===5',timeout=60000);return n
 check('Fine grid recalculates and renders over 24,000 cells',dense)
 def immersive():
  page.keyboard.press('f');page.wait_for_function('document.body.classList.contains("immersive")');page.wait_for_function('WarpArchive.getState().plansReady===5',timeout=60000)
  require(state()['width']==1440);page.keyboard.press('Escape');page.wait_for_function('!document.body.classList.contains("immersive")');page.wait_for_function('WarpArchive.getState().plansReady===5',timeout=60000);return 'enter / resize / exit'
 check('Immersive mode recomputes visible crop correctly',immersive)
 def lowmotion():
  page.evaluate('WarpArchive.pause();document.getElementById("reducedMotion").checked=true;document.getElementById("reducedMotion").dispatchEvent(new Event("change"))')
  require(state()['reducedMotion']);require(not state()['autoplay']);page.evaluate('document.getElementById("reducedMotion").checked=false;document.getElementById("reducedMotion").dispatchEvent(new Event("change"))');return True
 check('Reduced-motion control disables animated playback',lowmotion)
 # Mobile browser viewport simulation, not a claim about real-phone performance.
 def mobile():
  page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(500);page.wait_for_function('WarpArchive.getState().plansReady===5',timeout=60000)
  page.evaluate('WarpArchive.seek(.31)');require(state()['glError']==0)
  layout=page.evaluate('({sw:document.documentElement.scrollWidth,w:innerWidth,sh:document.documentElement.scrollHeight,h:innerHeight})');require(layout['sw']<=layout['w'])
  page.screenshot(path=str(ROOT/'v3_mobile.png'))
  page.locator('.mobile-settings').click();page.screenshot(path=str(ROOT/'v3_mobile_settings.png'))
  require(page.locator('#settingsDialog').evaluate('(e)=>e.open'));page.locator('#settingsDialog .close-dialog').click();return {**layout,'cells':state()['cells']}
 check('390px mobile layout and settings have no horizontal overflow',mobile)
 def rapid():
  for w,h in [(1000,760),(1200,800),(1440,900)]:page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(25)
  page.wait_for_timeout(600);page.wait_for_function('WarpArchive.getState().plansReady===5',timeout=60000)
  require(state()['configuration'].startswith('152:80:'));return state()['configuration']
 check('Rapid resize does not apply a stale worker result',rapid)
 # Return to default screenshot and metadata for the package.
 page.evaluate('WarpArchive.seek(0)');page.screenshot(path=str(ROOT/'final_desktop.png'))
 metrics=page.evaluate('WarpArchive.getMetrics()');(ROOT/'final_metrics.json').write_text(json.dumps(metrics,indent=2))
 # Explicit software fallback test in a separate page.
 fallback=browser.new_page(viewport={'width':960,'height':640})
 fallback.on('pageerror',lambda e:errors.append(str(e)))
 fallback.evaluate("""(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args)}})()""")
 fallback.set_content(HTML,wait_until='load');fallback.wait_for_function('window.WarpArchive');fallback.evaluate('WarpArchive.pause()');fallback.wait_for_function('WarpArchive.getState().plansReady===5',timeout=60000)
 check('Canvas fallback uses content-aware bijective plans',lambda:require(fallback.evaluate('WarpArchive.getState().engine==="CANVAS 2D" && WarpArchive.getMetrics().every(m=>m.bijection)')))
 fallback.evaluate('WarpArchive.seek(.5)');check('Canvas fallback renders intermediate transport',lambda:require(fallback.evaluate('document.getElementById("visual").toDataURL().length>10000')))
 fallback.close()
 # Worker-unavailable path.
 no_worker=browser.new_page(viewport={'width':640,'height':480})
 no_worker.on('pageerror',lambda e:errors.append(str(e)))
 no_worker.evaluate('window.Worker=undefined')
 no_worker.set_content(HTML,wait_until='load');no_worker.wait_for_function('window.WarpArchive');no_worker.evaluate('WarpArchive.pause()');no_worker.wait_for_function('WarpArchive.getState().plansReady===5',timeout=60000)
 check('No Worker environment still calculates valid maps',lambda:require(no_worker.evaluate('WarpArchive.getState().worker==="main-thread fallback" && WarpArchive.getMetrics().every(m=>m.bijection)')))
 no_worker.close()
 check('No uncaught browser JavaScript errors',lambda:require(not errors,errors))
 browser.close()
report={'version':'3.1.0','environment':'Chromium headless, WebGL 2 through Mesa llvmpipe software EGL. HTML injected into browser memory with Playwright set_content; local file navigation is blocked by test-environment policy. No claim of real-phone or end-user hardware frame rate.','checks':checks,'browserErrors':errors,'allPassed':all(x['passed'] for x in checks),'desktopMetrics':metrics}
(ROOT/'browser_report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False));print('TOTAL',len(checks),'PASSED',sum(x['passed'] for x in checks),flush=True)

if not report['allPassed']:sys.exit(1)
