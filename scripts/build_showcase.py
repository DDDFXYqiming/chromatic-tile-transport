#!/usr/bin/env python3
"""Generate the shared gallery without modifying either effect."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def build():
    source=(ROOT/'src/showcase.html').read_text(encoding='utf-8')
    for path in ('dist/index.html','dist/matrix-motion.html','assets/starrail/01-neon.webp','assets/starrail/02-spring.webp'):
        if not (ROOT/path).is_file():raise FileNotFoundError('Build both effects first: '+path)
    (ROOT/'index.html').write_text(source,encoding='utf-8')
    return ROOT/'index.html'
if __name__=='__main__':print('Built',build())
