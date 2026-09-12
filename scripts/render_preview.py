#!/usr/bin/env python3
"""Export deterministic browser frames to MP4. Not a real-time FPS benchmark."""
from pathlib import Path
import argparse, os, shutil, subprocess, sys
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--html',type=Path,default=ROOT/'dist/index.html');p.add_argument('--output',type=Path,default=ROOT/'docs/preview.mp4')
p.add_argument('--fps',type=int,default=24);p.add_argument('--pairs',type=int,default=2);p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=640)
a=p.parse_args()
if not 1<=a.fps<=60 or a.pairs<1:p.error('fps: 1–60; pairs: >=1')
ffmpeg=os.environ.get('FFMPEG_BIN') or shutil.which('ffmpeg')
if not ffmpeg:p.error('ffmpeg is required for video export; set FFMPEG_BIN or add it to PATH')
a.output.parent.mkdir(parents=True,exist_ok=True)
with sync_playwright() as pw:
    kw={'headless':True};exe=os.environ.get('CHROME_BIN') or shutil.which('chromium') or shutil.which('google-chrome')
    if exe:kw['executable_path']=exe
    if sys.platform.startswith('linux'):kw.update(args=['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl-egl','--disable-dev-shm-usage'],env={**os.environ,'LIBGL_ALWAYS_SOFTWARE':'1','EGL_PLATFORM':'surfaceless'})
    browser=pw.chromium.launch(**kw);page=browser.new_page(viewport={'width':a.width,'height':a.height},device_scale_factor=1)
    page.set_content(a.html.read_text(encoding='utf-8'));page.wait_for_function('window.WarpArchive');page.evaluate('WarpArchive.pause()')
    page.wait_for_function('WarpArchive.getState().plansReady===WarpArchive.getState().sceneCount',timeout=120000)
    state=page.evaluate('WarpArchive.getState()');pairs=min(a.pairs,state['sceneCount']);duration=state['options']['duration'];hold=.45
    cmd=[ffmpeg,'-y','-loglevel','error','-f','image2pipe','-vcodec','mjpeg','-r',str(a.fps),'-i','-','-an','-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',str(a.output)]
    process=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    try:
        for pair in range(pairs):
            frames=round((duration+hold*2)*a.fps)
            for frame in range(frames):
                t=frame/a.fps;progress=max(0,min(1,(t-hold)/duration));page.evaluate('(x)=>WarpArchive.seek(x)',pair+progress)
                process.stdin.write(page.screenshot(type='jpeg',quality=83))
            print(f'Exported pair {pair+1}/{pairs}',flush=True)
        process.stdin.close();code=process.wait()
        if code:raise RuntimeError(f'ffmpeg exited {code}')
    finally:
        if process.poll() is None:process.kill()
        browser.close()
print(a.output)
