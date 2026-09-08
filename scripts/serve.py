#!/usr/bin/env python3
"""Serve built examples on localhost only; no dependencies."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
import argparse
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--port',type=int,default=8000)
p.add_argument('--directory',type=Path,default=Path(__file__).resolve().parents[1]/'dist')
a=p.parse_args()
with ThreadingHTTPServer(('127.0.0.1',a.port),partial(SimpleHTTPRequestHandler,directory=str(a.directory.resolve()))) as server:
    print(f'Open http://127.0.0.1:{a.port}/ ; Ctrl+C to stop',flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
