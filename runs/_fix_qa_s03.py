from pathlib import Path

# 1) page.html — remove "八个体验" opener from study footer (top bar already has 01-08)
page = Path('src/studies/page.html')
t = page.read_text(encoding='utf-8')
old = '<button class="hall-open-atlas" type="button">八个体验 →</button>'
# tolerate encoding variants / arrow glyphs
import re
t2, n = re.subn(
    r'<button class="hall-open-atlas" type="button">[^<]*</button>',
    '',
    t,
    count=1,
)
if n != 1:
    raise SystemExit(f'page.html opener replace failed n={n}')
# also drop HALL:ATLAS injection point so study pages have no cross-page footer chrome
if '<!-- HALL:ATLAS -->' not in t2:
    raise SystemExit('HALL:ATLAS marker missing')
t2 = t2.replace('<!-- HALL:ATLAS -->', '<!-- HALL:ATLAS omitted on studies: bottom bar stays page-local -->')
page.write_text(t2, encoding='utf-8')
print('page.html ok')

# 2) build.py — studies must not receive experience atlas HTML
build = Path('src/hall/build.py')
b = build.read_text(encoding='utf-8')
if "return dict(nav=nav, atlas=atlas," not in b:
    raise SystemExit('build return not found')
# When current is a study (not transport/matrix), return empty atlas
needle = "    return dict(nav=nav, atlas=atlas,\n                style=(ROOT / 'src/hall/style.css').read_text(encoding='utf-8'),\n                script=(ROOT / 'src/hall/main.js').read_text(encoding='utf-8'))"
repl = """    # Studies keep page-local footers only; top bar already lists all eight experiences.
    study_ids = {item['id'] for item in studies}
    atlas_html = '' if current in study_ids else atlas
    return dict(nav=nav, atlas=atlas_html,
                style=(ROOT / 'src/hall/style.css').read_text(encoding='utf-8'),
                script=(ROOT / 'src/hall/main.js').read_text(encoding='utf-8'))"""
if needle not in b:
    raise SystemExit('build needle missing')
build.write_text(b.replace(needle, repl), encoding='utf-8')
print('build.py ok')

# 3) hall/main.js — no-op atlas on study pages; defensive if opener absent
main = Path('src/hall/main.js')
main.write_text("""(() => {
  const revealItem = (strip, current) => {
    if (current) {
      const bounds = strip.getBoundingClientRect(), item = current.getBoundingClientRect();
      strip.scrollLeft += item.left - bounds.left - (strip.clientWidth - item.width) / 2;
    }
  };
  const revealCurrent = () => {
    document.querySelectorAll('.hall-modes,.hall-strip,.study-strip').forEach(strip => {
      revealItem(strip, strip.querySelector('[aria-current]'));
    });
  };
  document.querySelector('.hall-modes')?.addEventListener('focusin', e => {
    if (e.target.matches('a:focus-visible')) revealItem(e.currentTarget, e.target);
  });
  // Study pages: bottom bar stays page-local. Cross-page jumps live in the top bar only.
  const onStudy = Boolean(document.body.dataset.study);
  const opener = document.querySelector('.hall-open-atlas');
  const atlas = document.querySelector('#hall-experience-atlas');
  if (!onStudy && opener && atlas) {
    opener.setAttribute('aria-controls', 'hall-experience-atlas');
    opener.setAttribute('aria-expanded', 'false');
    opener.addEventListener('click', () => {
      document.body.classList.add('hall-experiences');
      opener.setAttribute('aria-expanded', 'true');
      revealCurrent();
      document.querySelector('.hall-close-atlas')?.focus({preventScroll:true});
    });
    const closeAtlas = () => {
      document.body.classList.remove('hall-experiences');
      opener.setAttribute('aria-expanded', 'false');
      opener.focus({preventScroll:true});
      revealCurrent();
    };
    document.querySelector('.hall-close-atlas')?.addEventListener('click', closeAtlas);
    document.addEventListener('keydown', e => {
      if (document.querySelector('dialog[open]')) return;
      if (e.key === 'Escape' && document.body.classList.contains('hall-experiences')) {
        e.preventDefault();
        e.stopPropagation();
        closeAtlas();
      } else if (e.target.closest('.hall-modes,.hall-atlas,.hall-open-atlas,.study-footer')) {
        e.stopPropagation();
      }
    });
  } else {
    document.body.classList.remove('hall-experiences');
    document.addEventListener('keydown', e => {
      if (e.target.closest('.hall-modes,.study-footer')) e.stopPropagation();
    });
  }
  window.addEventListener('resize', revealCurrent);
  revealCurrent();
})();
""", encoding='utf-8')
print('main.js ok')

# 4) portal.mjs — swap copy at mid-transition so text and art change together
portal = Path('src/studies/portal.mjs')
p = portal.read_text(encoding='utf-8')
p = p.replace(
    'let transition=1,chapterTime=0,travelTime=0;',
    'let transition=1,chapterTime=0,travelTime=0,copyPending=false;',
)
old_select_tail = """    // A paused chapter selection stays paused, including the roaming chapter.
    if(!animate||!stage.playing||reduced.matches)progress=target;
    writeCopy();stage.dirty=true;
  }"""
new_select_tail = """    // A paused chapter selection stays paused, including the roaming chapter.
    if(!animate||!stage.playing||reduced.matches)progress=target;
    // Hold previous copy until the crossfade midpoint so art and text switch together.
    if(animate&&stage.playing&&!reduced.matches&&stage.frame>0)copyPending=true;
    else{copyPending=false;writeCopy();}
    stage.dirty=true;
  }"""
if old_select_tail not in p:
    raise SystemExit('portal select tail missing')
p = p.replace(old_select_tail, new_select_tail)
old_render_blend = """      transition=(!stage.playing||reduced.matches)?1:Math.min(1,transition+dt/transitionSeconds);
      const blend=transition*transition*(3-2*transition);
      if(transition<1){"""
new_render_blend = """      transition=(!stage.playing||reduced.matches)?1:Math.min(1,transition+dt/transitionSeconds);
      const blend=transition*transition*(3-2*transition);
      if(copyPending&&blend>=.5){writeCopy();copyPending=false;}
      // Fade old copy out, then new copy in around the same midpoint as the art mix.
      const enter=copyPending?(1-Math.min(1,blend*2)):((!stage.playing||reduced.matches||transition>=1)?1:Math.min(1,Math.max(0,(blend-.5)*2)));
      theater.style.setProperty('--chapter-enter',String(enter));
      if(transition<1){"""
if old_render_blend not in p:
    raise SystemExit('portal render blend missing')
p = p.replace(old_render_blend, new_render_blend)
# remove the old single --chapter-enter assignment later in render
old_enter = "      theater.style.setProperty('--chapter-enter',String(blend));\n"
if old_enter not in p:
    raise SystemExit('old chapter-enter assign missing')
p = p.replace(old_enter, '', 1)
portal.write_text(p, encoding='utf-8')
print('portal.mjs ok')
print('done')
