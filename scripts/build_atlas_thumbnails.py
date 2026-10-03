"""Resize existing exhibition covers for the shared atlas (requires dev Pillow)."""
import json
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
catalog = json.loads((ROOT/'src/studies/catalog.json').read_text(encoding='utf-8'))
sources = {'transport': ROOT/'assets/starrail/02-spring.webp',
           'matrix': ROOT/'assets/matrix-battle/01-faceoff-poster.jpg',
           **{e['id']: ROOT/'assets/studies'/e['cover'] for e in catalog}}
out = ROOT/'assets/studies/atlas'
out.mkdir(exist_ok=True)
for name, source in sources.items():
    with Image.open(source) as image:
        ImageOps.fit(image.convert('RGB'), (160,96), method=Image.Resampling.LANCZOS).save(out/(name+'.webp'), quality=84)
    print('Built', (out/(name+'.webp')).relative_to(ROOT))
