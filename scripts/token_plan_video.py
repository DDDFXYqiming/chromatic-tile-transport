"""Interactive Token Plan video generation helper. Never called by the website/build.

Credentials are read at request time from TOKEN_PLAN_API_KEY.
submit performs ONE paid submission; status/download resume its saved task ID.
"""
from pathlib import Path
import argparse,base64,hashlib,json,mimetypes,os,re,sys
from datetime import datetime,timezone
from urllib.parse import urlsplit
from urllib.request import Request,build_opener,HTTPRedirectHandler
from urllib.error import HTTPError,URLError

ROOT=Path(__file__).resolve().parents[1]
HOST='https://token-plan.cn-beijing.maas.aliyuncs.com'
MODELS=('happyhorse-1.1-i2v','happyhorse-1.1-r2v')

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None

def open_url(request):return build_opener(NoRedirect()).open(request,timeout=120)

def local(path):
    p=path.resolve()
    if not p.is_relative_to(ROOT):raise ValueError('Use a path within this project')
    return p

def credential():
    key=os.environ.get('TOKEN_PLAN_API_KEY','').strip()
    if not key.startswith('sk-sp-'):raise ValueError('Set TOKEN_PLAN_API_KEY to a Token Plan API key')
    return key

def api(method,path,payload=None):
    key=credential()
    headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'}
    if method=='POST':headers['X-DashScope-Async']='enable'
    request=Request(HOST+path,data=json.dumps(payload).encode('utf-8') if payload is not None else None,headers=headers,method=method)
    try:
        with open_url(request) as response:status=response.status;data=json.loads(response.read())
    except HTTPError as e:
        status=e.code
        try:data=json.loads(e.read())
        except (ValueError,OSError):data={'code':'HTTP '+str(status),'message':'Request rejected'}
    except (URLError,TimeoutError,ValueError) as e:raise RuntimeError('Token Plan request did not complete; '+type(e).__name__+'; do not resubmit an uncertain creation') from None
    if status>=300 or data.get('code'):
        code=str(data.get('code','HTTP '+str(status)))
        message=re.sub(r'sk-[A-Za-z0-9_-]+','[redacted]',str(data.get('message','Request rejected'))).replace(key,'[redacted]')
        raise RuntimeError(code+': '+message[:350])
    return data

def write(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')

def submit(args):
    state=local(args.state)
    if state.exists():raise ValueError('Task record already exists; use status/download instead of resubmitting')
    prompt=local(args.prompt).read_text(encoding='utf-8').strip()
    if not prompt or len(prompt)>5000:raise ValueError('Prompt must be 1-5000 characters')
    if not 0<=args.seed<=2147483647:raise ValueError('Seed must be between 0 and 2147483647')
    images=[local(p) for p in args.image]
    if (args.model.endswith('-i2v') and len(images)!=1) or not 1<=len(images)<=9:raise ValueError('Invalid number of reference images')
    media=[];refs=[]
    from PIL import Image
    for image in images:
        raw=image.read_bytes();mime=mimetypes.guess_type(image.name)[0]
        if mime not in ('image/png','image/jpeg','image/webp') or len(raw)>20*1024*1024:raise ValueError('Unsupported or oversized image')
        with Image.open(image) as im:
            if min(im.size)<(300 if args.model.endswith('-i2v') else 400):raise ValueError('Input image too small')
            if args.model.endswith('-i2v') and not .4<=im.width/im.height<=2.5:raise ValueError('Input aspect ratio unsupported')
        media.append({'type':'first_frame' if args.model.endswith('-i2v') else 'reference_image','url':'data:'+mime+';base64,'+base64.b64encode(raw).decode()})
        refs.append({'file':image.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(raw).hexdigest()})
    params={'resolution':args.resolution,'duration':args.duration,'watermark':False,'seed':args.seed}
    if args.model.endswith('-r2v'):params['ratio']='16:9'
    record={'model':args.model,'endpoint':HOST,'credentialSource':'environment (not copied)','prompt':prompt,'references':refs,'parameters':params,'submittedAt':datetime.now(timezone.utc).isoformat(),'status':'SUBMITTING'}
    # A saved SUBMITTING record prevents accidental duplicate paid requests after timeout.
    write(state,record)
    result=api('POST','/api/v1/services/aigc/video-generation/video-synthesis',{'model':args.model,'input':{'prompt':prompt,'media':media},'parameters':params})
    out=result.get('output',{});record.update(task_id=out.get('task_id'),status=out.get('task_status'),request_id=result.get('request_id'))
    write(state,record)
    if not record.get('task_id'):raise RuntimeError('No task ID returned; creation state retained for inspection')
    print(json.dumps({'task_id':record['task_id'],'status':record['status'],'model':args.model,'duration':args.duration,'resolution':args.resolution}))

def status(args):
    state=local(args.state);record=json.loads(state.read_text(encoding='utf-8'));task=record.get('task_id')
    if not task or not re.fullmatch(r'[A-Za-z0-9-]+',task):raise ValueError('No valid saved task ID; do not automatically recreate the request')
    result=api('GET','/api/v1/tasks/'+task);out=result.get('output',{})
    record['status']=out.get('task_status');record['usage']=result.get('usage',{})
    for key in ('submit_time','scheduled_time','end_time','code'):
        if key in out:record[key]=out[key]
    if out.get('message'):record['error']=re.sub(r'sk-[A-Za-z0-9_-]+','[redacted]',str(out['message']))[:350]
    if args.command=='download':
        if record['status']!='SUCCEEDED':raise ValueError('Task is not ready: '+str(record['status']))
        url=out.get('video_url','');parsed=urlsplit(url)
        if parsed.scheme!='https' or not parsed.hostname or not parsed.hostname.endswith('.aliyuncs.com'):raise ValueError('Unexpected result host; inspect before downloading')
        output=local(args.output)
        if output.exists():raise ValueError('Output already exists')
        try:
            with open_url(Request(url)) as response:
                if response.status!=200:raise RuntimeError('Video download failed: HTTP '+str(response.status))
                raw=response.read(64*1024*1024+1)
        except (URLError,TimeoutError):raise RuntimeError('Video download did not complete; resume the saved task instead of resubmitting') from None
        if len(raw)>64*1024*1024:raise ValueError('Result exceeds the local 64 MiB limit')
        if len(raw)<16 or raw[4:8]!=b'ftyp':raise ValueError('Result is not an MP4')
        output.parent.mkdir(parents=True,exist_ok=True);output.write_bytes(raw)
        record['output']={'file':output.relative_to(ROOT).as_posix(),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
    # Keep no signed result URLs, image base64 or auth headers in the audit record.
    write(state,record);print(json.dumps({k:record[k] for k in ('task_id','status','usage','output','error') if k in record},ensure_ascii=False))

def main():
    p=argparse.ArgumentParser(description=__doc__);sub=p.add_subparsers(dest='command',required=True)
    s=sub.add_parser('submit');s.add_argument('--model',choices=MODELS,default=MODELS[0]);s.add_argument('--state',type=Path,required=True);s.add_argument('--prompt',type=Path,required=True);s.add_argument('--image',type=Path,action='append',required=True)
    s.add_argument('--resolution',choices=['480P','720P','1080P'],default='720P');s.add_argument('--duration',type=int,choices=range(3,16),default=5);s.add_argument('--seed',type=int,default=20260911)
    for name in ('status','download'):
        a=sub.add_parser(name);a.add_argument('--state',type=Path,required=True)
        if name=='download':a.add_argument('--output',type=Path,required=True)
    args=p.parse_args()
    try:submit(args) if args.command=='submit' else status(args)
    except (ValueError,RuntimeError,OSError) as e:print(str(e),file=sys.stderr);return 1
    return 0

if __name__=='__main__':sys.exit(main())
