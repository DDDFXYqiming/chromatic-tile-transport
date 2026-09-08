from __future__ import annotations
import copy, importlib.util, json, tempfile, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('builder',ROOT/'scripts/build.py');builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
class BuildTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(dir=ROOT/'examples');self.root=Path(self.tmp.name)
    def tearDown(self):self.tmp.cleanup()
    def manifest(self,scenes):
        p=self.root/'scenes.json';p.write_text(json.dumps(scenes,ensure_ascii=False),encoding='utf-8');return p
    def scenes(self):
        s=json.loads(builder.DEFAULT_SCENES.read_text());return copy.deepcopy(s)
    def config(self,update):
        c=json.loads(builder.DEFAULT_CONFIG.read_text());c.update(update);p=self.root/'config.json';p.write_text(json.dumps(c),encoding='utf-8');return p
    def test_default_reproducible(self):
        a=builder.build(self.root/'a.html').read_bytes();b=builder.build(self.root/'b.html').read_bytes();self.assertEqual(a,b)
    def test_two_scene_build(self):
        s=self.scenes()[:2];out=builder.build(self.root/'two.html',self.manifest(s)).read_text();self.assertIn('max="2000"',out);self.assertIn(' / 02',out)
    def test_html_in_scene_is_not_script(self):
        s=self.scenes()[:2];s[0]['caption']='</script><script>alert(1)</script>'
        out=builder.build(self.root/'safe.html',self.manifest(s)).read_text();self.assertNotIn(s[0]['caption'],out);self.assertIn('\\u003c/script>',out)
    def test_manifest_count(self):
        with self.assertRaises(ValueError):builder.load_scenes(self.manifest(self.scenes()[:1]))
    def test_duplicate_slug(self):
        s=self.scenes();s[1]['slug']=s[0]['slug']
        with self.assertRaises(ValueError):builder.load_scenes(self.manifest(s))
    def test_focal_outside_range(self):
        s=self.scenes();s[0]['position']=[2,.5]
        with self.assertRaises(ValueError):builder.load_scenes(self.manifest(s))
    def test_image_metadata_checked(self):
        s=self.scenes();s[0]['width']=3
        with self.assertRaises(ValueError):builder.load_scenes(self.manifest(s))
    def test_outside_project_input_rejected(self):
        with self.assertRaises(ValueError):builder.local(ROOT.parent/'private.png')
    def test_bad_timing_rejected(self):
        with self.assertRaises(ValueError):builder.load_config(self.config({'motion':{'launchBase':.25}}))
    def test_invalid_boolean_rejected(self):
        with self.assertRaises(ValueError):builder.load_config(self.config({'options':{'trails':'yes'}}))
    def test_unknown_config_rejected(self):
        with self.assertRaises(ValueError):builder.load_config(self.config({'typo':True}))
    def test_image_info(self):
        for file in (ROOT/'assets/starrail').glob('*.webp'):
            mime,w,h=builder.image_info(file.read_bytes());self.assertEqual(mime,'image/webp');self.assertGreater(w,1000);self.assertGreater(h,500)
if __name__=='__main__':unittest.main(verbosity=2)
