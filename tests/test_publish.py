"""Publisher safety tests use mocks ONLY. They never access a real GitHub account."""
import importlib.util,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('publisher',ROOT/'scripts/publish_private.py');pub=importlib.util.module_from_spec(spec);spec.loader.exec_module(pub)
class PublishTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);(self.root/'.git').mkdir()
        self.calls=[];self.private=True;self.owner='DDDFXYqiming';self.remote_sha='abc123';self.fail_create=False;self.remote='';self.account='DDDFXYqiming'
        self.ps=[patch.object(pub,'ROOT',self.root),patch.object(pub,'audit',return_value={'files':10,'bytes':100}),patch.object(pub.shutil,'which',return_value='/fake/tool'),patch.object(pub,'run',side_effect=self.fake_run)]
        for p in self.ps:p.start()
    def tearDown(self):
        for p in reversed(self.ps):p.stop()
        self.tmp.cleanup()
    def fake_run(self,*args,**kwargs):
        self.calls.append(args)
        if args[:3]==('gh','api','user'):return json.dumps({'login':self.account,'id':114125824})
        if args==('git','rev-parse','--show-toplevel'):return str(self.root)
        if args==('git','remote'):return 'origin' if self.remote else ''
        if args[:3]==('git','remote','get-url'):return self.remote
        if args==('git','branch','--show-current'):return 'main'
        if args[:3]==('git','diff','--cached'):return 'README.md'
        if args==('git','rev-parse','HEAD'):return 'abc123'
        if args[:3]==('gh','repo','create') and self.fail_create:raise RuntimeError('create failed')
        if args[:3]==('gh','repo','view'):return json.dumps({'nameWithOwner':f'{self.owner}/chromatic-tile-transport','isPrivate':self.private,'url':'https://github.com/test/only'})
        if args[:2]==('gh','api') and 'repos/' in args[2]:return self.remote_sha
        return ''
    def pushed(self):return any('push' in c for c in self.calls)
    def test_success_verifies_private_before_push(self):
        result=pub.publish(self.owner,'chromatic-tile-transport');self.assertTrue(result['verified']);self.assertTrue(result['private'])
        create=next(i for i,c in enumerate(self.calls) if c[:3]==('gh','repo','create'));self.assertIn('--private',self.calls[create])
        view=next(i for i,c in enumerate(self.calls) if c[:3]==('gh','repo','view'));push=next(i for i,c in enumerate(self.calls) if 'push' in c)
        self.assertLess(create,view);self.assertLess(view,push);self.assertFalse(any('--force' in c for c in self.calls))
    def test_public_remote_never_receives_files(self):
        self.private=False
        with self.assertRaises(RuntimeError):pub.publish(self.owner,'chromatic-tile-transport')
        self.assertFalse(self.pushed())
    def test_wrong_account_stops_before_git_changes(self):
        self.account='somebody-else'
        with self.assertRaises(RuntimeError):pub.publish(self.owner,'chromatic-tile-transport')
        self.assertFalse(any(c[0]=='git' for c in self.calls))
    def test_create_failure_never_pushes(self):
        self.fail_create=True
        with self.assertRaises(RuntimeError):pub.publish(self.owner,'chromatic-tile-transport')
        self.assertFalse(self.pushed())
    def test_remote_sha_must_match(self):
        self.remote_sha='wrong'
        with self.assertRaises(RuntimeError):pub.publish(self.owner,'chromatic-tile-transport')
        self.assertFalse((self.root/'.publish-result.json').exists())
    def test_wrong_existing_origin_stops(self):
        self.remote='https://github.com/other/private.git'
        with self.assertRaises(RuntimeError):pub.publish(self.owner,'chromatic-tile-transport')
        self.assertFalse(self.pushed())
    def test_resume_still_checks_private(self):
        self.private=False
        with self.assertRaises(RuntimeError):pub.publish(self.owner,'chromatic-tile-transport',resume=True)
        self.assertFalse(self.pushed());self.assertFalse(any(c[:3]==('gh','repo','create') for c in self.calls))
    def test_bad_repository_name_stops(self):
        with self.assertRaises(ValueError):pub.publish(self.owner,'../public')
        self.assertFalse(self.calls)
if __name__=='__main__':unittest.main(verbosity=2)
