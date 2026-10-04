"""Feed the actual chapter artwork to the Node region/solver regression tests."""
from pathlib import Path
import json
import base64
import subprocess
import sys
import hashlib

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
catalog = json.loads((ROOT/'src/studies/catalog.json').read_text(encoding='utf-8'))
chapters = next(item['chapters'] for item in catalog if item['id'] == 'fluid')
samples = []
manifest = json.loads((ROOT/'assets/studies/fluid-masks.json').read_text(encoding='utf-8'))
for chapter in chapters:
    with Image.open(ROOT/'assets'/chapter['image']) as image:
        pixels = image.convert('RGBA').resize((120, 80), Image.Resampling.BILINEAR)
        mask_image = f'studies/fluid-{chapter["id"]}-mask.png'
        entry = next(a for a in manifest['assets'] if a['file'] == Path(mask_image).name)
        assert entry['reference'] == Path(chapter['image']).name
        assert hashlib.sha256((ROOT/'assets'/mask_image).read_bytes()).hexdigest() == entry['sha256']
        assert hashlib.sha256((ROOT/'assets'/chapter['image']).read_bytes()).hexdigest() == entry['reference_sha256']
        with Image.open(ROOT/'assets'/mask_image) as plate:
            assert plate.size == image.size, 'material mask must align with artwork'
            mask = dict(width=plate.width, height=plate.height,
                        pixels=base64.b64encode(plate.convert('RGB').getchannel('R').tobytes()).decode('ascii'))
        samples.append(dict(id=chapter['id'], width=image.width, height=image.height,
                            image=chapter['image'], pixels=list(pixels.tobytes()), flow=chapter['flow'],
                            maskImage=mask_image, mask=mask))
tests = sys.argv[1:] or ('fluid_regions.mjs', 'fluid_stage.mjs')
assert all(test in ('fluid_regions.mjs', 'fluid_stage.mjs') for test in tests)
for test in tests:
    subprocess.run(['node', str(ROOT/'tests'/test)], cwd=ROOT,
                   input=json.dumps(samples), text=True, encoding='utf-8', check=True)
