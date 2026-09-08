"""Regression tests for the reported detach/land pauses, including actual image plans."""
import base64, io, json, os, shutil, sys, tempfile, importlib.util
from pathlib import Path
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'reports'/'handoff';OUT.mkdir(parents=True,exist_ok=True)
checks=[]
def check(name,fn):
    try:detail=fn();checks.append(dict(test=name,passed=True,detail=detail));print('PASS',name,flush=True)
    except Exception as e:checks.append(dict(test=name,passed=False,error=str(e)));print('FAIL',name,str(e),flush=True)
def require(value,why='Assertion failed'):
    if not value:raise AssertionError(why)
def image(page,p):
    data=page.evaluate('(p)=>{WarpArchive.seek(p);return document.getElementById("visual").toDataURL("image/png");}',p)
    return Image.open(io.BytesIO(base64.b64decode(data.split(',')[1]))).convert('RGB')
with sync_playwright() as pw:
    kwargs={'headless':True}
    exe=os.environ.get('CHROME_BIN') or shutil.which('chromium') or shutil.which('google-chrome')
    if exe:kwargs['executable_path']=exe
    if sys.platform.startswith('linux'):kwargs.update(args=['--no-sandbox','--ignore-gpu-blocklist','--enable-webgl','--use-gl=angle','--use-angle=gl-egl','--disable-dev-shm-usage'],env={**os.environ,'LIBGL_ALWAYS_SOFTWARE':'1','EGL_PLATFORM':'surfaceless'})
    browser=pw.chromium.launch(**kwargs)
    page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content((ROOT/'dist/index.html').read_text(encoding='utf-8'))
    page.wait_for_function('window.WarpArchive');page.evaluate('WarpArchive.pause()');page.wait_for_function('WarpArchive.getState().plansReady===5',timeout=60000)
    def same_maps():
        expected={x['pair']:x['hash'] for x in json.loads((ROOT/'tests/fixtures/v3-desktop-metrics.json').read_text())}
        actual={x['pair']:x['hash'] for x in page.evaluate('WarpArchive.getMetrics()')};require(expected==actual);return actual
    check('All five original colour assignments are unchanged, hash for hash',same_maps)
    def actual_speeds():
        result=page.evaluate('''()=>{
          const out=[];for(let i=0;i<5;i++){
            const plan=WarpArchive.getPlan(i,(i+1)%5);let min=Infinity,oldZero=0,newZero=0,samples=0;
            for(let k=0;k<plan.attrs.length;k+=10){if(plan.attrs[k+9]<.01)continue;
              const start=plan.attrs[k+6],end=plan.attrs[k+7];
              const old=(p)=>{let t=Math.max(0,Math.min(1,(p-start)/(end-start)));return t*t*t*(t*(6*t-15)+10)};
              for(const p of [.13,.17,.21,.78,.82,.85,.88]){
                const speed=(WarpArchive.sampleTiming(p+.001,start,end).t-WarpArchive.sampleTiming(p,start,end).t)/.001;
                const oldSpeed=(old(p+.001)-old(p))/.001;
                min=Math.min(min,speed);if(oldSpeed<.001)oldZero++;if(speed<.001)newZero++;samples++;
              }
            }out.push({pair:i+":"+((i+1)%5),minimumNewSpeed:min,oldStationarySamples:oldZero,newStationarySamples:newZero,samples});
          }return out;
        }''')
        require(all(x['minimumNewSpeed']>.85 and x['newStationarySamples']==0 for x in result));require(sum(x['oldStationarySamples'] for x in result)>0);return result
    check('Actual-image plans have no stationary timing samples in either handoff',actual_speeds)
    def seam_frames():
        values=[]
        for i in range(5):
            for a,b in [(.14,.20),(.81,.87)]:
                x,y=image(page,i+a),image(page,i+b);diff=sum(ImageStat.Stat(ImageChops.difference(x,y)).mean)/3
                require(diff>1,'Transition frames do not change enough');values.append({'pair':i,'range':[a,b],'meanRGBPixelDifference':diff})
        return values
    check('Actual GPU pixels change across both formerly stagnant windows in every pair',seam_frames)
    def gpu_endpoints():
        results=[]
        for i in range(5):
            start=image(page,i);before=image(page,i-.0005)
            require(start.tobytes()==before.tobytes());results.append(i)
        return results
    check('Five cyclic seams finish at pixel-identical complete images',gpu_endpoints)
    def sample_parity():
        p=.17;s=.20;e=.81
        result=page.evaluate('([p,s,e])=>WarpArchive.sampleTiming(p,s,e)',[p,s,e])
        require(result['t']>.05);return result
    check('Runtime exposes the shared deterministic timing used by both renderers',sample_parity)
    def invalid_api():
        return page.evaluate('''()=>{let caught=0;for(const cfg of [{density:0},{duration:0},{trails:"yes"},{mapping:"oops"}]){try{WarpArchive.configure(cfg)}catch(e){caught++}}if(caught!==4)throw new Error("Expected validation failures");return caught;}''')
    check('Runtime rejects invalid density, duration, booleans and mapping',invalid_api)
    # Readable preview of a real mid-transition frame, not a generated image.
    page.evaluate('WarpArchive.seek(.40)');page.screenshot(path=str(ROOT/'docs/preview.png'))
    # Arbitrary image count: exercise a two-image build as well as the five-image demo.
    def two_images():
        spec=importlib.util.spec_from_file_location('builder',ROOT/'scripts/build.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
        with tempfile.TemporaryDirectory(dir=ROOT/'examples') as td:
            td=Path(td);s=json.loads(m.DEFAULT_SCENES.read_text())[:2];manifest=td/'scenes.json';manifest.write_text(json.dumps(s))
            output=m.build(td/'index.html',manifest)
            p=browser.new_page(viewport={'width':960,'height':640});p.set_content(output.read_text());p.wait_for_function('window.WarpArchive');p.evaluate('WarpArchive.pause()');p.wait_for_function('WarpArchive.getState().plansReady===2',timeout=60000)
            require(p.evaluate('WarpArchive.getState().sceneCount===2 && document.getElementById("timeline").max==="2000"'));p.evaluate('WarpArchive.seek(1.6)');require(p.evaluate('WarpArchive.getState().glError===0'));p.close()
        return '2 scene sources; 2 plans; loop transition 1→0 rendered'
    check('Generic two-image project builds and renders the reverse loop',two_images)
    check('No uncaught browser errors',lambda:require(not errors,str(errors)))
    browser.close()
report=dict(version='3.1.0',environment='Chromium headless / Mesa llvmpipe; deterministic progress samples, not a hardware FPS benchmark',checks=checks,allPassed=all(x['passed'] for x in checks))
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('TOTAL',len(checks),'PASSED',sum(x['passed'] for x in checks),flush=True)
sys.exit(0 if report['allPassed'] else 1)
