#!/usr/bin/env python3
"""Create and populate a PRIVATE GitHub repository using the user's local GitHub CLI.
No token is read, printed or stored by this script. No force-push or public deployment.
"""
from __future__ import annotations
import argparse, json, re, shutil, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]


def run(*args: str, capture: bool=False) -> str:
    p=subprocess.run(list(args),cwd=ROOT,text=True,capture_output=capture,encoding='utf-8')
    if p.returncode:
        # Avoid echoing arbitrary subprocess output, which could contain credentials.
        raise RuntimeError(f'{args[0]} {args[1] if len(args)>1 else ""} failed (exit {p.returncode}); inspect the CLI message locally')
    return p.stdout.strip() if capture else ''


def audit() -> dict:
    for rel in ['project.json','README.md','skill.md','src/main.js','src/timing.js','src/matcher.js','dist/index.html','examples/starrail/scenes.json']:
        if not (ROOT/rel).is_file():raise RuntimeError(f'Missing required project file: {rel}')
    if json.loads((ROOT/'project.json').read_text(encoding='utf-8')).get('name')!='chromatic-tile-transport':raise RuntimeError('Wrong project directory')
    count=size=0
    for path in ROOT.rglob('*'):
        if not path.is_file() or any(p in {'.git','__pycache__','.venv','node_modules'} for p in path.relative_to(ROOT).parts):continue
        name=path.name.lower()
        if name=='.env' or name.startswith('.env.') or name in {'id_rsa','id_ed25519','credentials.json','secrets.json'} or path.suffix.lower() in {'.pem','.key','.p12'}:
            raise RuntimeError(f'Refusing to publish possible credentials: {path.relative_to(ROOT)}')
        if path.stat().st_size>90*1024*1024:raise RuntimeError(f'File too large for this publisher: {path.relative_to(ROOT)}')
        count+=1;size+=path.stat().st_size
    return {'files':count,'bytes':size}


def publish(owner: str, name: str, login: bool=False, resume: bool=False) -> dict:
    if not re.fullmatch(r'[A-Za-z0-9-]+',owner) or not re.fullmatch(r'[A-Za-z0-9_.-]+',name):raise ValueError('Invalid repository owner/name')
    inventory=audit()
    for cmd in ('git','gh'):
        if not shutil.which(cmd):raise RuntimeError(f'{cmd} is not installed; install it and reopen your terminal')
    try:run('gh','auth','status','--hostname','github.com')
    except RuntimeError:
        if not login:raise RuntimeError('Run gh auth login --hostname github.com, then retry; do not paste tokens into chat')
        run('gh','auth','login','--hostname','github.com','--web')
    account=json.loads(run('gh','api','user','--jq','{login: .login, id: .id}',capture=True))
    if account['login'].lower()!=owner.lower():raise RuntimeError(f'Active GitHub account is {account["login"]}; expected {owner}. Switch accounts before retrying')
    full=f'{owner}/{name}';remote=f'https://github.com/{full}.git'
    # Never initialize inside an enclosing unrelated repository.
    if not (ROOT/'.git').exists():
        for parent in ROOT.parents:
            if (parent/'.git').exists():raise RuntimeError('Project is nested inside another Git repository; move it first')
        run('git','init','-b','main')
    top=Path(run('git','rev-parse','--show-toplevel',capture=True)).resolve()
    if top!=ROOT.resolve():raise RuntimeError('Git root is not the project directory')
    remotes=run('git','remote',capture=True).splitlines()
    if any(x!='origin' for x in remotes):raise RuntimeError('Unexpected remote; use a fresh extracted copy')
    if 'origin' in remotes and run('git','remote','get-url','origin',capture=True).rstrip('/')!=remote:raise RuntimeError('origin points somewhere else; refusing to modify it')
    branch=run('git','branch','--show-current',capture=True)
    if branch!='main':raise RuntimeError('Current local branch is not main; refusing to rename it automatically')
    # Identity is repository-local; no global Git configuration is changed.
    for key,value in [('user.name',account['login']),('user.email',f'{account["id"]}+{account["login"]}@users.noreply.github.com')]:
        try:run('git','config','--get',key,capture=True)
        except RuntimeError:run('git','config',key,value)
    run('git','add','--all','--','.')
    changed=run('git','diff','--cached','--name-only',capture=True)
    if changed:run('git','commit','-m','Fix continuous tile handoffs; add reusable builder, assets, docs and regression tests')
    local_sha=run('git','rev-parse','HEAD',capture=True)
    if not resume:
        # No source upload yet. Verify remote privacy before adding an origin or pushing.
        run('gh','repo','create',full,'--private','--description','Content-driven colour tile transport with continuous motion, offline examples and an agent skill')
    info=json.loads(run('gh','repo','view',full,'--json','nameWithOwner,isPrivate,url',capture=True))
    if not info.get('isPrivate') or info.get('nameWithOwner','').lower()!=full.lower():raise RuntimeError('Remote is not the expected PRIVATE repository. Nothing has been pushed')
    if 'origin' not in remotes:run('git','remote','add','origin',remote)
    # Scoped credential helper: use gh's local auth without modifying global helpers.
    run('git','-c','credential.helper=','-c','credential.helper=!gh auth git-credential','push','-u','origin','HEAD:main')
    remote_sha=run('gh','api',f'repos/{full}/git/ref/heads/main','--jq','.object.sha',capture=True)
    final=json.loads(run('gh','repo','view',full,'--json','nameWithOwner,isPrivate,url',capture=True))
    if remote_sha!=local_sha or not final.get('isPrivate'):raise RuntimeError('Post-push verification failed; inspect the remote before sharing')
    result={**inventory,'repository':final['nameWithOwner'],'url':final['url'],'private':True,'commit':remote_sha,'verified':True}
    (ROOT/'.publish-result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    return result


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--owner',default='DDDFXYqiming');p.add_argument('--name',default='chromatic-tile-transport')
    p.add_argument('--login',action='store_true',help='Open GitHub CLI web login when needed')
    p.add_argument('--resume-existing',action='store_true',help='Explicitly reuse an already-created PRIVATE repository; never force-push')
    p.add_argument('--dry-run',action='store_true',help='Audit local files only; no Git/GitHub mutations')
    a=p.parse_args()
    try:
        if a.dry_run:
            print(json.dumps({'dryRun':True,'target':f'{a.owner}/{a.name}','visibility':'PRIVATE',**audit()},ensure_ascii=False,indent=2));return
        print(json.dumps(publish(a.owner,a.name,a.login,a.resume_existing),ensure_ascii=False,indent=2))
    except (RuntimeError,ValueError,OSError,KeyError) as e:p.exit(1,f'Publish stopped: {e}\n')

if __name__=='__main__':main()
