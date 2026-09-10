#!/usr/bin/env python3
"""Legacy skill synchronization; never overwrite effect 01 with the multi-effect router."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
source=(ROOT/'skill.md').read_text(encoding='utf-8')
if 'name: chromatic-visual-lab' in source:
    print('Multi-effect router detected: both effect skills are maintained independently; no files changed.')
else:
    destination=ROOT/'skills/chromatic-tile-transport/SKILL.md'
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(source,encoding='utf-8')
    print(destination)
