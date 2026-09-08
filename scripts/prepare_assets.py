#!/usr/bin/env python3
"""Convert a folder of images to WebP and generate a starter scene manifest. Requires Pillow."""
from __future__ import annotations
import argparse, json, os, re
from pathlib import Path
from PIL import Image, ImageOps
ROOT=Path(__file__).resolve().parents[1]

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--input',type=Path,required=True)
    p.add_argument('--output',type=Path,required=True)
    p.add_argument('--manifest',type=Path,required=True)
    p.add_argument('--max-width',type=int,default=2048)
    p.add_argument('--quality',type=int,default=86)
    args=p.parse_args()
    for path in (args.input,args.output,args.manifest):
        if not path.resolve().is_relative_to(ROOT):p.error('Keep input and output paths inside the project directory')
    if not 256<=args.max_width<=4096 or not 50<=args.quality<=100:p.error('max-width: 256–4096; quality: 50–100')
    files=sorted([f for f in args.input.iterdir() if f.suffix.lower() in ('.png','.jpg','.jpeg','.webp')])
    if not 2<=len(files)<=24:p.error('Provide 2–24 images')
    args.output.mkdir(parents=True,exist_ok=True);args.manifest.parent.mkdir(parents=True,exist_ok=True)
    if args.manifest.exists():p.error('Manifest already exists; choose a new path rather than overwriting scene text')
    scenes=[]
    for i,source in enumerate(files,1):
        slug=f'{i:02d}-image';target=args.output/f'{slug}.webp'
        if target.exists():p.error(f'Asset already exists: {target}')
        with Image.open(source) as raw:
            im=ImageOps.exif_transpose(raw).convert('RGB')
            im.thumbnail((args.max_width,args.max_width),Image.Resampling.LANCZOS)
            im.save(target,'WEBP',quality=args.quality,method=6)
            width,height=im.size
        scenes.append(dict(slug=slug,name=source.stem,en=f'MEMORY {i:02d}',line1='每一种颜色，',line2='都有下一站。',caption='将自己的图片与故事写在这里。',tag='IMAGE-DRIVEN TRANSPORT',accent='#c4b9ed',position=[.5,.5],width=width,height=height,src=Path(os.path.relpath(target,args.manifest.parent)).as_posix()))
    args.manifest.write_text(json.dumps(scenes,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Prepared {len(scenes)} images; edit focal points and text in {args.manifest}')

if __name__=='__main__':main()
