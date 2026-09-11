from pathlib import Path
import sys,tempfile,threading,unittest,urllib.request,urllib.error
from functools import partial
from http.server import ThreadingHTTPServer
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from serve import RangeRequestHandler

class Quiet(RangeRequestHandler):
    def log_message(self,*args):pass

class VideoServingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory();cls.body=bytes(range(256))*8
        Path(cls.temp.name,'clip.mp4').write_bytes(cls.body)
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=cls.temp.name))
        threading.Thread(target=cls.server.serve_forever,daemon=True).start();cls.url=f'http://127.0.0.1:{cls.server.server_port}/clip.mp4'
    @classmethod
    def tearDownClass(cls):cls.server.shutdown();cls.server.server_close();cls.temp.cleanup()
    def get(self,range_value=None,method='GET'):
        return urllib.request.urlopen(urllib.request.Request(self.url,headers={'Range':range_value} if range_value else {},method=method))
    def test_whole_file(self):
        with self.get() as r:self.assertEqual(r.status,200);self.assertEqual(r.read(),self.body)
    def test_ranges_return_exact_bytes_and_lengths(self):
        for header,a,b in [('bytes=100-199',100,200),('bytes=2000-',2000,2048),('bytes=-20',2028,2048),('bytes=2000-9999',2000,2048)]:
            with self.get(header) as r:self.assertEqual(r.status,206);self.assertEqual(r.read(),self.body[a:b]);self.assertEqual(r.headers['Content-Range'],f'bytes {a}-{b-1}/2048')
    def test_invalid_and_empty_ranges(self):
        for header in ['bytes=2048-','bytes=90-20','bytes=-0','bytes=','bytes=0-10,20-30']:
            with self.assertRaises(urllib.error.HTTPError) as caught:self.get(header)
            self.assertEqual(caught.exception.code,416)
    def test_head_sends_no_body(self):
        with self.get('bytes=10-19','HEAD') as r:self.assertEqual(r.status,206);self.assertEqual(r.headers['Content-Length'],'10');self.assertEqual(r.read(),b'')

if __name__=='__main__':unittest.main()
