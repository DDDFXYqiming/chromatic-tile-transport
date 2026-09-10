from pathlib import Path
import importlib.util,sys,json,tempfile,unittest
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import build_matrix as M

class MatrixBuildTests(unittest.TestCase):
    def setUp(self):
        self.directory=tempfile.TemporaryDirectory(dir=ROOT/'examples')
        self.root=Path(self.directory.name)
        self.config=json.loads(M.DEFAULT_CONFIG.read_text())
        self.scenes=M.load_scenes(M.DEFAULT_SCENES)
    def tearDown(self):self.directory.cleanup()
    def config_file(self):
        p=self.root/'config.json';p.write_text(json.dumps(self.config),encoding='utf-8');return p
    def test_default_config(self):self.assertEqual(M.load_matrix_config(M.DEFAULT_CONFIG,self.scenes)['options']['bridgeSeconds'],.48)
    def test_unknown_options_fail(self):
        self.config['options']['matching']=True
        with self.assertRaises(ValueError):M.load_matrix_config(self.config_file(),self.scenes)
    def test_nonfinite_values_fail(self):
        self.config['options']['zoom']=float('nan')
        with self.assertRaises(ValueError):M.load_matrix_config(self.config_file(),self.scenes)
    def test_bool_is_not_duration(self):
        self.config['options']['shotSeconds']=True
        with self.assertRaises(ValueError):M.load_matrix_config(self.config_file(),self.scenes)
    def test_unknown_focus_fails(self):
        self.config['focus']['missing']=[.5,.5]
        with self.assertRaises(ValueError):M.load_matrix_config(self.config_file(),self.scenes)
    def test_outside_focus_fails(self):
        self.config['focus']['neon']=[1.1,.2]
        with self.assertRaises(ValueError):M.load_matrix_config(self.config_file(),self.scenes)
    def test_unknown_top_level_fails(self):
        self.config['backend']='api'
        with self.assertRaises(ValueError):M.load_matrix_config(self.config_file(),self.scenes)
    def test_linked_stays_in_repository(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(ValueError):M.build(Path(d)/'demo.html',linked=True)
    def test_inline_contains_assets_and_scripts(self):
        out=M.build(self.root/'demo.html');s=out.read_text();self.assertIn('data:image/webp;base64,',s)
        self.assertIn('class WebGLRenderer',s);self.assertNotIn('<!-- MATRIX:',s);self.assertNotIn('<script src=',s)
    def test_linked_paths_are_relative_and_exist(self):
        out=M.build(self.root/'linked.html',linked=True);s=out.read_text();self.assertNotIn('data:image/webp;',s)
        self.assertIn('../../src/matrix/main.js',s);self.assertIn('../../assets/starrail/',s)
    def test_user_text_cannot_break_out_of_script_or_title(self):
        self.config['title']='</title><script>alert(1)</script>'
        self.config['notice']='</script><img src=x onerror=alert(1)>'
        out=M.build(self.root/'safe.html',config_path=self.config_file());s=out.read_text();self.assertNotIn('<script>alert(1)</script>',s)
        self.assertIn('\\u003c/script>',s)
    def test_router_sync_does_not_overwrite_legacy_skill(self):
        import subprocess
        path=ROOT/'skills/chromatic-tile-transport/SKILL.md';before=path.read_bytes()
        subprocess.run([sys.executable,str(ROOT/'scripts/sync_skill.py')],check=True,capture_output=True)
        self.assertEqual(path.read_bytes(),before)
    def test_legacy_core_and_distribution_are_unchanged(self):
        import hashlib
        expected={'src/main.js':'27b5f5f4daea374d6b40484a5605ffbc2b2c6c27','src/matcher.js':'e545b4d8f1347a09a9b0f5b3651a471867d49946','src/transport.js':'8dc60a80fc813576f419bf43b2afba04d02fea39','src/timing.js':'7d5cbc247a774769f208cea904abbd4902e24fe6','src/style.css':'d685d788bd22dde0033f56e6306a53cd3e7a95c7','scripts/build.py':'b1fe276807f228aa9555e7d840f71cd7b09a1e2e','dist/index.html':'47aa8adce0dd6d5ce30e060f15064306d54aa72d'}
        for name,want in expected.items():
            b=(ROOT/name).read_bytes();self.assertEqual(hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest(),want,name)
if __name__=='__main__':unittest.main()
