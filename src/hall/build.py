"""Shared exhibition chrome. All eight destinations are emitted as ordinary links."""
import base64
import html
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def render(current, output, inline=False):
    studies = json.loads((ROOT / 'src/studies/catalog.json').read_text(encoding='utf-8'))
    entries = [
        dict(id='transport', number='01', title='寻色迁移', english='CHROMATIC TRANSPORT', slug='index'),
        dict(id='matrix', number='02', title='动态显影', english='MATRIX MOTION', slug='matrix-battle'),
        *studies,
    ]
    esc = html.escape
    rel = lambda p: Path(os.path.relpath(p, output.parent)).as_posix()
    active = next(i for i, entry in enumerate(entries) if entry['id'] == current)

    def link(entry):
        if not output.is_relative_to(ROOT):
            filename = 'starrail_color_transport_v3_1' if entry['id'] == 'transport' else entry['slug']
            return './' + filename + '.html'
        return esc(rel(ROOT / f'dist/{entry["slug"]}.html'), quote=True)

    def thumbnail(entry):
        path = ROOT / f'assets/studies/atlas/{entry["id"]}.webp'
        return 'data:image/webp;base64,' + base64.b64encode(path.read_bytes()).decode() if inline else rel(path)

    def card(entry):
        selected = entry['id'] == current
        return (f'<a class="hall-card" href="{link(entry)}"' + (' aria-current="page"' if selected else '') + '>'
                f'<span class="hall-thumb"><img src="{thumbnail(entry)}" alt="" width="160" height="96"></span>'
                f'<span class="hall-card-copy"><small>{entry["number"]} / EXPERIENCE</small>'
                f'<strong>{esc(entry["title"])}</strong></span></a>')

    primary = ''.join(f'<a href="{link(e)}"' + (' aria-current="page"' if e['id'] == current else '') +
                      f'>{e["number"]} {esc(e["english"] if e["id"] == "matrix" else e["title"])}</a>' for e in entries)
    nav = f'<nav class="hall-modes" aria-label="效果导航">{primary}</nav>'
    close = '<button class="hall-close-atlas" type="button">返回当前影像 ↗</button>'
    atlas = (f'<footer id="hall-experience-atlas" class="hall-atlas" aria-label="八个体验导航" style="--hall-position:{active / 7:.5f}">'
             f'<div class="hall-folio"><span class="hall-label">THE EXPERIENCE ATLAS</span><div><b>{entries[active]["number"]}</b><span>/ 08</span><i></i></div>{close}</div>'
             '<div class="hall-strip-wrap"><div class="hall-track" aria-hidden="true"><i></i></div>'
             '<nav class="hall-strip" aria-label="切换体验">' + ''.join(card(e) for e in entries) + '</nav></div>'
             f'<div class="hall-transport"><div><a href="{link(entries[(active - 1) % 8])}" aria-label="上一个体验">←</a>'
             f'<a href="{link(entries[(active + 1) % 8])}" aria-label="下一个体验">→</a></div>'
             '<span><kbd>SPACE</kbd> 播放 / 暂停</span></div></footer>')
    # Studies keep page-local footers only; top bar already lists all eight experiences.
    study_ids = {item['id'] for item in studies}
    atlas_html = '' if current in study_ids else atlas
    return dict(nav=nav, atlas=atlas_html,
                style=(ROOT / 'src/hall/style.css').read_text(encoding='utf-8'),
                script=(ROOT / 'src/hall/main.js').read_text(encoding='utf-8'))
