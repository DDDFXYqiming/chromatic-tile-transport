from pathlib import Path
import sys,unittest
from unittest.mock import MagicMock,patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import token_plan_video as client

class TokenPlanTests(unittest.TestCase):
    def test_credentials_use_only_explicit_environment(self):
        with patch.dict(client.os.environ,{'TOKEN_PLAN_API_KEY':'sk-sp-test-only'},clear=True),patch.object(Path,'read_text',side_effect=AssertionError('Must not read personal configuration')):
            self.assertEqual(client.credential(),'sk-sp-test-only')
        with patch.dict(client.os.environ,{},clear=True):
            with self.assertRaisesRegex(ValueError,'TOKEN_PLAN_API_KEY'):client.credential()
    def test_async_header_only_on_submission(self):
        response=MagicMock(status=200);response.__enter__.return_value=response;response.read.return_value=b'{"output":{"task_id":"test"}}'
        with patch.object(client,'credential',return_value='sk-sp-test-only'),patch.object(client,'open_url',return_value=response) as request:
            client.api('POST','/api/v1/services/aigc/video-generation/video-synthesis',{})
            self.assertEqual(request.call_args.args[0].get_header('X-dashscope-async'),'enable')
            client.api('GET','/api/v1/tasks/test')
            self.assertIsNone(request.call_args.args[0].get_header('X-dashscope-async'))
            self.assertTrue(request.call_args.args[0].full_url.startswith(client.HOST+'/api/v1/'))
            self.assertIsNone(client.NoRedirect().redirect_request(None,None,302,'',{},'https://elsewhere.invalid'))
    def test_error_does_not_echo_credentials(self):
        response=MagicMock(status=403);response.__enter__.return_value=response;response.read.return_value=b'{"code":"Denied","message":"Bad token sk-sp-test-only"}'
        with patch.object(client,'credential',return_value='sk-sp-test-only'),patch.object(client,'open_url',return_value=response):
            with self.assertRaises(RuntimeError) as caught:client.api('GET','/api/v1/tasks/test')
            self.assertNotIn('sk-sp-test-only',str(caught.exception))

if __name__=='__main__':unittest.main()
