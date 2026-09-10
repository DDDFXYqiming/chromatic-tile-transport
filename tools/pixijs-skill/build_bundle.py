"""Package every tracked upstream file behind one discoverable PixiJS skill."""
from pathlib import Path, PurePosixPath
import argparse, hashlib, json, re, subprocess, zipfile

HERE=Path(__file__).resolve().parent

def build(repo, output):
    repo=repo.resolve();output=output.resolve()
    if output.exists():raise SystemExit('Refusing to overwrite existing bundle: '+str(output))
    revision=subprocess.check_output(['git','-C',str(repo),'rev-parse','HEAD'],text=True).strip()
    tree=subprocess.check_output(['git','-C',str(repo),'ls-tree','-rz',revision]).decode().split('\0')
    records=[]
    for entry in filter(None,tree):
        meta,name=entry.split('\t',1);mode,kind,oid=meta.split()
        if kind!='blob':raise ValueError('Unsupported upstream entry '+name)
        records.append({'source':name,'mode':mode,'git_blob':oid})
    (output/'archive').mkdir(parents=True)
    archive=output/'archive/pixijs-skills-upstream.zip'
    subprocess.run(['git','-c','core.autocrlf=false','-c','core.eol=lf','-C',str(repo),'archive','--format=zip','--output',str(archive),revision],check=True)
    with zipfile.ZipFile(archive) as z:
        for row in records:
            name=row['source'];original=z.read(name)
            relative='upstream/'+name
            if PurePosixPath(name).name=='SKILL.md':relative=relative[:-len('SKILL.md')]+'GUIDE.md'
            content=original
            if name.endswith('.md') and row['mode']!='120000':
                # Adapt local module names, leaving external upstream URLs intact.
                text=original.decode('utf-8')
                text=re.sub(r'(?<=[(/])SKILL\.md(?=[)#`\s]|$)','GUIDE.md',text)
                text=text.replace('`SKILL.md`','`GUIDE.md`')
                content=text.encode('utf-8')
            target=output/relative;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(content)
            row.update(installed=relative,sha256_original=hashlib.sha256(original).hexdigest(),sha256_installed=hashlib.sha256(content).hexdigest(),adapted=content!=original)
        router=z.read('skills/pixijs/SKILL.md').decode().replace('\r\n','\n')
        routing=router.split('## Skill router\n',1)[1].split('## Fallback:',1)[0]
        routing=re.sub(r'\.\./(pixijs[^/]*)/SKILL\.md',r'upstream/skills/\1/GUIDE.md',routing)
        routing=routing.replace('| Skill |','| Topic guide |')
    entry='''---
name: pixijs
description: Build, animate, debug, or optimize PixiJS v8 applications. Includes the complete official skill repository as local references, covering 2D scenes, meshes, assets, interaction, rendering, performance, and migration. Use when the project uses PixiJS or the user chooses it.
license: MIT
metadata:
  short-description: Complete PixiJS v8 toolkit in one skill
---

# PixiJS · 全量整合版

One skill entry backed by the complete official `pixijs/pixijs-skills` repository. Read only the topic guides needed for the current task.

## Use the bundle

1. Check the project's installed PixiJS version and existing renderer/loop before choosing an API.
2. Read the matching guide below and follow its linked references. If a guide refers to another `pixijs-*` skill, read that topic's local `GUIDE.md`; it is part of this skill and needs no separate installation.
3. Use the upstream examples and auxiliary guidance only when relevant. Preserve the project's chosen libraries and existing user requirements.
4. For an API absent here or version-dependent details, fetch [the official PixiJS documentation index](https://pixijs.download/release/docs/llms.txt), then the relevant API page. Bundled documents are a pinned snapshot, so resolve conflicts against the installed package and current official docs.

## Topic routing
'''+routing+'''
## Repository content beyond the topic guides

- [Upstream README](upstream/README.md): project overview and original distribution methods.
- [Original router](upstream/skills/pixijs/GUIDE.md) and [full topic index](upstream/skills/pixijs/references/index.md): all original routing descriptions and trigger keywords.
- [Example overview](upstream/examples/README.md), [HTML](upstream/examples/vanilla/index.html), [JavaScript](upstream/examples/vanilla/main.js): a minimal runnable PixiJS example; it uses external CDN resources as documented upstream.
- [React guidance](upstream/.github/instructions/react.instructions.md): when integrating PixiJS with React; verify the installed `@pixi/react` version.
- [Custom rendering guidance](upstream/.github/instructions/scrolltrigger.instructions.md): extra renderer/shader conventions (the upstream filename is retained).
- [Copilot guidance](upstream/.github/copilot-instructions.md): upstream repository-wide conventions, for reference where applicable.
- [Repository authoring rules](upstream/AGENTS.md): relevant when maintaining the upstream skill repository, not a replacement for the target project's instructions. Upstream `CLAUDE.md` is a symlink to that file; its link target is preserved as text in the expanded Windows copy and as a symlink entry in the archive.
- [Claude plugin metadata](upstream/.claude-plugin/plugin.json), [marketplace](upstream/.claude-plugin/marketplace.json), [Cursor plugin metadata](upstream/.cursor-plugin/plugin.json), [marketplace](upstream/.cursor-plugin/marketplace.json): retained for completeness and optional porting, not registered as additional plugins or skills by this bundle.
- [Pixi logo](upstream/assets/pixi-logo.svg), [skills logo](upstream/assets/pixijs-skills-logo.svg), [license](upstream/LICENSE), and upstream `.gitignore` are included.

## Packaging and verification

All upstream tracked files are expanded under `upstream/`. Internal `SKILL.md` files are named `GUIDE.md`, with local links adapted, so only this root file is discoverable as a skill. The original byte-for-byte files and symlink metadata are also retained in [the upstream archive](archive/pixijs-skills-upstream.zip).

See [provenance and file map](references/provenance.md) and `references/upstream-manifest.json`. Run `python scripts/verify_bundle.py` to verify completeness, checksums, the single entrypoint, and local Markdown links. Preserve this structure when updating; do not unpack original `SKILL.md` files into the installed skill folder.
'''
    (output/'SKILL.md').write_text(entry,encoding='utf-8',newline='\n')
    (output/'agents').mkdir()
    (output/'agents/openai.yaml').write_text('interface:\n  display_name: "PixiJS 全量版"\n  short_description: "完整收录官方仓库的二维绘图、动画、交互与性能优化资料，只保留一个技能入口"\n',encoding='utf-8',newline='\n')
    (output/'references').mkdir()
    manifest={'repository':'https://github.com/pixijs/pixijs-skills','revision':revision,'tracked_files':len(records),'topic_guides':sum(PurePosixPath(r['source']).name=='SKILL.md' for r in records),'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':records}
    (output/'references/upstream-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8',newline='\n')
    provenance=f'''# Source and local adaptation

Source: https://github.com/pixijs/pixijs-skills

Revision: `{revision}`. Packaged 2026-09-10.

All {len(records)} tracked files are included, including {manifest['topic_guides']} topic entry documents, hidden plugin/Copilot configuration, examples, SVG assets, license and root documentation. The local clone beside the bundle retains the Git history. The installed archive represents the complete file tree at this revision; it does not include Git's local database or network-expanded dependencies.

`upstream-manifest.json` records every original path, Git blob/mode, original SHA-256, expanded path and adapted SHA-256. Expanded Markdown uses `GUIDE.md` for internal topic entrypoints and adapts local links. The archive retains original names and bytes, including symlink metadata. Other source files are unchanged. The upstream README's installation instructions and plugin descriptors describe the original multi-skill distribution; they are retained as reference, not automatically executed.

The single-entry packaging follows [Codex skill structure and progressive disclosure](https://learn.chatgpt.com/docs/build-skills). Only root `SKILL.md` is active; nested guides are on-demand documents.
'''
    (output/'references/provenance.md').write_text(provenance,encoding='utf-8',newline='\n')
    (output/'scripts').mkdir();(output/'scripts/verify_bundle.py').write_bytes((HERE/'verify_bundle.py').read_bytes())
    print(json.dumps({k:v for k,v in manifest.items() if k!='files'},indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--repo',type=Path,default=HERE/'upstream-repo');p.add_argument('--output',type=Path,default=HERE/'pixijs');a=p.parse_args();build(a.repo,a.output)
