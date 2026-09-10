"""Shared browser launch for tests and frame exports; uses system Chromium when present."""
import os,shutil,sys

def launch_options():
    opts={'headless':True}
    exe=os.environ.get('CHROME_BIN') or shutil.which('chromium') or shutil.which('google-chrome')
    if exe:opts['executable_path']=exe
    if sys.platform.startswith('linux'):
        opts.update(args=['--no-sandbox','--ignore-gpu-blocklist','--enable-webgl','--use-gl=angle','--use-angle=gl-egl','--disable-dev-shm-usage'],env={**os.environ,'LIBGL_ALWAYS_SOFTWARE':'1','EGL_PLATFORM':'surfaceless'})
    return opts
