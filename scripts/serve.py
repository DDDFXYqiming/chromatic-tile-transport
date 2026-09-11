#!/usr/bin/env python3
"""Serve built examples on localhost only; no dependencies."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
import argparse,re

class RangeRequestHandler(SimpleHTTPRequestHandler):
    """Single byte ranges let browser video decoders seek without reloading frame zero."""
    def send_head(self):
        self.byte_range=None
        path=Path(self.translate_path(self.path));requested=self.headers.get('Range')
        if not requested or not path.is_file():return super().send_head()
        match=re.fullmatch(r'bytes=(\d*)-(\d*)',requested.strip());size=path.stat().st_size
        if match and any(match.groups()):
            first,last=match.groups()
            start=int(first) if first else max(0,size-int(last))
            end=min(size-1,int(last)) if first and last else size-1
        else:start,end=size,-1
        if start>end or start>=size or (match and match.groups()==('','0')):
            self.send_response(416);self.send_header('Content-Range',f'bytes */{size}');self.send_header('Content-Length','0');self.end_headers();return None
        try:stream=path.open('rb')
        except OSError:self.send_error(404);return None
        self.send_response(206);self.send_header('Content-type',self.guess_type(str(path)))
        self.send_header('Accept-Ranges','bytes');self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length',str(end-start+1));self.end_headers()
        stream.seek(start);self.byte_range=end-start+1;return stream

    def copyfile(self,source,outputfile):
        if self.byte_range is None:return super().copyfile(source,outputfile)
        remaining=self.byte_range
        while remaining:
            block=source.read(min(65536,remaining))
            if not block:break
            outputfile.write(block);remaining-=len(block)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--port',type=int,default=8000)
    p.add_argument('--directory',type=Path,default=Path(__file__).resolve().parents[1]/'dist')
    a=p.parse_args()
    with ThreadingHTTPServer(('127.0.0.1',a.port),partial(RangeRequestHandler,directory=str(a.directory.resolve()))) as server:
        print(f'Open http://127.0.0.1:{a.port}/ ; Ctrl+C to stop',flush=True)
        try:server.serve_forever()
        except KeyboardInterrupt:pass

if __name__=='__main__':main()
