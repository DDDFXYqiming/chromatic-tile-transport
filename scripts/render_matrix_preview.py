#!/usr/bin/env python3
"""Export deterministic webpage frames to MP4. This is NOT a real-time FPS benchmark."""
from __future__ import annotations
import argparse,os,shutil,subprocess,sys,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,default=ROOT/'docs/matrix-preview.mp4')
    p.add_argument('--duration',type=float,default=14.2);p.add_argument('--fps',type=int,default=24);p.add_argument('--width',type=int,default=1280);p.add_argument('--height',type=int,default=800)
    p.add_argument('--start',type=float,default=0);p.add_argument('--motion-study',action='store_true');p.add_argument('--clean',action='store_true');p.add_argument('--video',action='store_true');a=p.parse_args()
    if not 1<=a.duration<=120 or not 1<=a.fps<=60 or not 320<=a.width<=2560 or not 320<=a.height<=1600:p.error('Invalid capture dimensions, duration or frame rate')
    ffmpeg=os.environ.get('FFMPEG_BIN') or shutil.which('ffmpeg')
    if not ffmpeg:p.error('FFmpeg is required; set FFMPEG_BIN or add it to PATH')
    from playwright.sync_api import sync_playwright
    from build_matrix import build
    sys.path.insert(0,str(ROOT/'tests'))
    from browser_launch_matrix import launch_options
    a.output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp, sync_playwright() as p:
        inputs={'scenes_path':ROOT/'examples/matrix-video/scenes.json','config_path':ROOT/'examples/matrix-video/config.json'} if a.video else {}
        html=build(Path(tmp)/'matrix.html',**inputs).read_text(encoding='utf-8')
        browser=p.chromium.launch(**launch_options());page=browser.new_page(viewport={'width':a.width,'height':a.height},device_scale_factor=1)
        page.set_content(html,wait_until='load');page.wait_for_function('window.MatrixMotion?.getState().ready',timeout=45000)
        page.evaluate('MatrixMotion.pause()');page.add_style_tag(content='*{transition:none!important;animation:none!important}.loading.ready{display:none}')
        page.evaluate('(o)=>{MatrixMotion.seek(o.start);MatrixMotion.configure({motionStudy:o.study});MatrixMotion.setClean(o.clean)}',{'start':a.start,'study':a.motion_study,'clean':a.clean})
        print('Renderer:',page.evaluate('MatrixMotion.getState().engine'),flush=True)
        cmd=[ffmpeg,'-y','-v','error','-f','image2pipe','-vcodec','png','-framerate',str(a.fps),'-i','-','-an','-vf','scale=trunc(iw/2)*2:trunc(ih/2)*2','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',str(a.output)]
        proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
        try:
            for i in range(round(a.duration*a.fps)):
                page.evaluate('(t)=>MatrixMotion.seekAsync(t)',a.start+i/a.fps);proc.stdin.write(page.screenshot(type='png'))
                if i%a.fps==0:print(f'Frame {i}/{round(a.duration*a.fps)}',flush=True)
        finally:
            proc.stdin.close();code=proc.wait(timeout=90);browser.close()
        if code:raise RuntimeError('FFmpeg failed')
    print('Saved',a.output,'(offline frame-by-frame export, not hardware FPS)')
if __name__=='__main__':main()
