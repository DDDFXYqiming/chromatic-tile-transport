"""Verify complete upstream preservation and one discoverable skill entry."""
from pathlib import Path
import hashlib,json,re,sys,zipfile
from urllib.parse import unquote,urlsplit

def verify(root):
    root=root.resolve();manifest=json.loads((root/'references/upstream-manifest.json').read_text(encoding='utf-8'))
    archive=root/'archive/pixijs-skills-upstream.zip'
    assert hashlib.sha256(archive.read_bytes()).hexdigest()==manifest['archive_sha256'],'Archive digest mismatch'
    entries=[p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and p.name.lower()=='skill.md']
    assert entries==['SKILL.md'],entries
    with zipfile.ZipFile(archive) as z:
        expected={r['source'] for r in manifest['files']}
        assert {x.filename for x in z.infolist() if not x.is_dir()}==expected,'Archive file set differs'
        for row in manifest['files']:
            original=z.read(row['source'])
            assert hashlib.sha256(original).hexdigest()==row['sha256_original'],row['source']
            assert hashlib.sha1(b'blob '+str(len(original)).encode()+b'\0'+original).hexdigest()==row['git_blob'],'Original differs from Git blob: '+row['source']
            p=root/row['installed'];assert p.resolve().is_relative_to(root) and p.is_file(),row['installed']
            assert hashlib.sha256(p.read_bytes()).hexdigest()==row['sha256_installed'],row['installed']
            if row['mode']=='120000':assert (z.getinfo(row['source']).external_attr>>16)&0o170000==0o120000,'Symlink metadata lost'
    assert len(manifest['files'])==manifest['tracked_files']
    linked=set();links=0;missing=[]
    for doc in root.rglob('*.md'):
        text=doc.read_text(encoding='utf-8')
        for match in re.finditer(r'\[[^\]\n]*\]\(([^)\n]+)\)',text):
            target=match.group(1).strip().split(' ',1)[0];parsed=urlsplit(target)
            if parsed.scheme or not parsed.path or '<' in target or '{' in target:continue
            dest=(doc.parent/unquote(parsed.path)).resolve();links+=1
            if not dest.is_relative_to(root) or not dest.exists():missing.append(str(doc.relative_to(root))+' -> '+target)
            else:linked.add(dest)
    assert not missing,'Broken local links: '+repr(missing)
    guides={root/r['installed'] for r in manifest['files'] if r['source'].endswith('/SKILL.md')}
    # The upstream router is retained but the new root provides the active routing table.
    assert guides-{root/'upstream/skills/pixijs/GUIDE.md'}<=linked,'Unreachable topic guides'
    result={'passed':True,'revision':manifest['revision'],'upstreamFiles':len(manifest['files']),'topicGuides':len(guides),'discoverableEntries':entries,'checkedLocalLinks':links}
    print(json.dumps(result,ensure_ascii=False,indent=2));return result

if __name__=='__main__':verify(Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[1])
