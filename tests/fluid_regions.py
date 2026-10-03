"""Feed the actual chapter artwork to the Node region/solver regression tests."""
from pathlib import Path
import json
import subprocess

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
catalog = json.loads((ROOT/'src/studies/catalog.json').read_text(encoding='utf-8'))
chapters = next(item['chapters'] for item in catalog if item['id'] == 'fluid')
samples = []
for chapter in chapters:
    with Image.open(ROOT/'assets'/chapter['image']) as image:
        pixels = image.convert('RGBA').resize((120, 80), Image.Resampling.BILINEAR)
        samples.append(dict(id=chapter['id'], width=image.width, height=image.height,
                            pixels=list(pixels.tobytes()), flow=chapter['flow']))
subprocess.run(['node', str(ROOT/'tests/fluid_regions.mjs')], cwd=ROOT,
               input=json.dumps(samples), text=True, encoding='utf-8', check=True)
