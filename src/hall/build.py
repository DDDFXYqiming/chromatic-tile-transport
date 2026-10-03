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

    def card(entry, menu=False):
        selected = entry['id'] == current
        return (f'<a class="hall-card" href="{link(entry)}"' + (' aria-current="page"' if selected else '') + '>'
                f'<span class="hall-thumb"><img src="{thumbnail(entry)}" alt="" width="160" height="96"></span>'
                f'<span class="hall-card-copy"><small>{entry["number"]} / {"EXPERIENCE" if menu else "STUDY"}</small>'
                f'<strong>{esc(entry["title"])}</strong></span></a>')

    primary = ''.join(f'<a href="{link(e)}"' + (' aria-current="page"' if e['id'] == current else '') +
                      f'>{e["number"]} {esc(e["title"] if e["id"] == "transport" else e["english"])}</a>' for e in entries[:2])
    summary = f'{entries[active]["number"]} {esc(entries[active]["title"])}' if active > 1 else '03—08 六个体验'
    nav = (f'<nav class="hall-modes" aria-label="效果导航">{primary}'
           f'<details class="hall-menu"><summary' + (' class="selected"' if active > 1 else '') + f'>{summary}<span aria-hidden="true">⌄</span></summary>'
           '<div class="hall-menu-panel"><span class="hall-label">THE EXPERIENCE ATLAS / 01—08</span>'
           '<div class="hall-menu-grid">' + ''.join(card(e, True) for e in entries) + '</div></div></details></nav>')
    close = '<button class="hall-close-atlas" type="button">返回当前影像 ↗</button>' if active < 2 else '<span class="hall-note">八种想象，同一片星海</span>'
    atlas = (f'<footer class="hall-atlas" aria-label="八个体验导航" style="--hall-position:{active / 7:.5f}">'
             f'<div class="hall-folio"><span class="hall-label">THE EXPERIENCE ATLAS</span><div><b>{entries[active]["number"]}</b><span>/ 08</span><i></i></div>{close}</div>'
             '<div class="hall-strip-wrap"><div class="hall-track" aria-hidden="true"><i></i></div>'
             '<nav class="hall-strip" aria-label="切换体验">' + ''.join(card(e) for e in entries) + '</nav></div>'
             f'<div class="hall-transport"><div><a href="{link(entries[(active - 1) % 8])}" aria-label="上一个体验">←</a>'
             f'<a href="{link(entries[(active + 1) % 8])}" aria-label="下一个体验">→</a></div>'
             '<span><kbd>SPACE</kbd> 播放 / 暂停</span></div></footer>')
    return dict(nav=nav, atlas=atlas,
                style=(ROOT / 'src/hall/style.css').read_text(encoding='utf-8'),
                script=(ROOT / 'src/hall/main.js').read_text(encoding='utf-8'))
