from pathlib import Path
p = Path('src/studies/portal.mjs')
t = p.read_text(encoding='utf-8')
old = """      transition=(!stage.playing||reduced.matches)?1:Math.min(1,transition+dt/transitionSeconds);
      const blend=transition*transition*(3-2*transition);
      if(copyPending&&blend>=.5){writeCopy();copyPending=false;}
      // Fade old copy out, then new copy in around the same midpoint as the art mix.
      const enter=copyPending?(1-Math.min(1,blend*2)):((!stage.playing||reduced.matches||transition>=1)?1:Math.min(1,Math.max(0,(blend-.5)*2)));
      theater.style.setProperty('--chapter-enter',String(enter));
      if(transition<1){"""
new = """      transition=(!stage.playing||reduced.matches)?1:Math.min(1,transition+dt/transitionSeconds);
      const blend=transition*transition*(3-2*transition);
      // Keep previous copy fading with the outgoing frame; reveal new copy only after art settles.
      if(copyPending&&transition>=1){writeCopy();copyPending=false;}
      theater.style.setProperty('--chapter-enter',String(copyPending?(1-blend):1));
      if(transition<1){"""
if old not in t:
    raise SystemExit('portal block missing')
p.write_text(t.replace(old, new), encoding='utf-8')
print('portal.mjs patched')
