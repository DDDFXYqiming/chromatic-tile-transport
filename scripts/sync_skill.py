#!/usr/bin/env python3
"""Keep the portable SKILL.md entry identical to the canonical root skill.md."""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
target=root/'skills/chromatic-tile-transport/SKILL.md'
target.parent.mkdir(parents=True,exist_ok=True)
shutil.copyfile(root/'skill.md',target)
print(target)
