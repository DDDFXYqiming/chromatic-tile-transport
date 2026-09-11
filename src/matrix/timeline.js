/* Deterministic Matrix Motion choreography. All times are seconds, not frame counts. */
(function (root) {
  'use strict';
  const DEFAULTS = Object.freeze({shotSeconds: 6.8, bridgeSeconds: .48, density: 144,
    zoom: 1.65, parallax: .65, palette: 'ice', mode: 'auto', autoplay: true, layerMotion:true, cameraX:0, cameraY:0,
    deformation:true, deformationStrength:1, motionStudy:false, videoMotion:true});
  const MODES = Object.freeze(['auto', 'original', 'duotone', 'poster', 'line', 'matrix']);
  const STYLE = Object.freeze({original: 0, duotone: 1, poster: 2, line: 3});
  const clip = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = v => {v = clip(v); return v * v * (3 - 2 * v);};
  const span = (a, b, v) => smooth((v - a) / (b - a));
  const wrap = (v, n) => { const r = v % n; return r < 0 ? r + n : r; };
  // Local cell reveal/recovery overlaps the flip, instead of fading one full-screen grid.
  const GRID_HANDOFF = Object.freeze({enterDelay:.20, enterDuration:.32, exitStart:.52, exitDelay:.18, exitDuration:.30});
  function gridEnvelope(progress, wave) {
    const c=GRID_HANDOFF, enter=c.enterDelay*wave, exit=c.exitStart+c.exitDelay*wave;
    return span(enter,enter+c.enterDuration,progress)*(1-span(exit,exit+c.exitDuration,progress));
  }
  function validate(patch = {}, base = DEFAULTS) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('Configuration must be an object');
    const c = {...base, ...patch};
    const bounds = {shotSeconds: [4, 14], bridgeSeconds: [.3, 1.6], density: [48, 224], zoom: [1, 2.1], parallax: [0, 1],cameraX:[-.3,.3],cameraY:[-.3,.3],deformationStrength:[0,1.5]};
    for (const [k, v] of Object.entries(patch)) {
      if (!(k in DEFAULTS)) throw new TypeError('Unknown matrix option: ' + k);
      if (k in bounds && (typeof v !== 'number' || !Number.isFinite(v) || v < bounds[k][0] || v > bounds[k][1])) throw new RangeError('Invalid matrix option: ' + k);
      if (k === 'density' && !Number.isInteger(v)) throw new TypeError('density must be an integer');
      if (k === 'mode' && !MODES.includes(v)) throw new TypeError('Unknown visual mode');
      if (k === 'palette' && !['ice', 'scene', 'mono'].includes(v)) throw new TypeError('Unknown palette');
      if (['autoplay','layerMotion','deformation','motionStudy','videoMotion'].includes(k) && typeof v !== 'boolean') throw new TypeError(k+' must be boolean');
    }
    return Object.freeze(c);
  }
  // Give the original art most of the shot; use the other styles as short accents.
  const EDITS = Object.freeze([
    [0, .04, 3, 0, '显影 / DEVELOP'],
    [.04, .80, 0, 0, '原画 / ORIGINAL'],
    [.80, .86, 0, 2, '色阶 / POSTERIZE'],
    [.86, .92, 2, 1, '双色 / DUOTONE'],
    [.92, .98, 1, 3, '线描 / CONTOUR'],
    [.98, 1.001, 3, 3, '线描 / CONTOUR']
  ]);
  function timing(config=DEFAULTS){
    const imageSeconds=config.shotSeconds-config.bridgeSeconds;
    const originalFraction=EDITS.filter(e=>e[2]===0&&e[3]===0).reduce((sum,e)=>sum+Math.min(1,e[1])-e[0],0);
    const originalSeconds=imageSeconds*originalFraction;
    return {shotSeconds:config.shotSeconds,originalSeconds,bridgeSeconds:config.bridgeSeconds,accentSeconds:imageSeconds-originalSeconds};
  }
  function frame(seconds, count, config = DEFAULTS, reduced = false) {
    if (!Number.isFinite(seconds) || !Number.isInteger(count) || count < 2) throw new TypeError('Invalid timeline position');
    const total = count * config.shotSeconds;
    const position = wrap(seconds, total);
    const scene = Math.min(count - 1, Math.floor(position / config.shotSeconds));
    const local = position - scene * config.shotSeconds;
    const bridgeStart = config.shotSeconds - config.bridgeSeconds;
    const bridge = clip((local - bridgeStart) / config.bridgeSeconds);
    const phase = clip(local / bridgeStart);
    const edit = EDITS.find(e => phase < e[1]) || EDITS[EDITS.length - 1];
    let from = edit[2], to = edit[3], reveal = span(edit[0], edit[1], phase);
    let label = bridge > 0 ? '点阵桥 / MATRIX BRIDGE' : edit[4];
    if (config.mode !== 'auto') {
      from = to = STYLE[config.mode] ?? 1; reveal = 0;
      label = config.mode === 'matrix' ? '定格点阵 / DOT MATRIX' : config.mode.toUpperCase();
    }
    if (reduced) { from = to = 0; reveal = 0; label = '静态浏览 / REDUCED MOTION'; }
    const focus = reduced ? 0 : span(.24, .9, phase);
    const zoom = reduced ? 1 : 1.015 + .075 * span(0, .34, phase) + (config.zoom - 1.09) * span(.35, .95, phase);
    const activeBridge = reduced || config.mode !== 'auto' ? 0 : bridge;
    const styleShade = (from === 0 ? 1-reveal : 0) + (to === 0 ? reveal : 0);
    const shade = Math.max(styleShade,span(0,.25,activeBridge)*(1-span(.72,1,activeBridge)),!reduced && config.mode === 'matrix' ? 1 : 0);
    return {position, total, scene, next: (scene + 1) % count, local, phase, reduced,
      bridge: activeBridge,
      from, to, reveal, zoom, focus, label, shade,
      forceMatrix: !reduced && config.mode === 'matrix',
      // Driven by the scrub position, not wall time: pause/reverse/export match exactly.
      drift: reduced ? 0 : Math.sin(phase * Math.PI) * config.parallax,
      direction: scene % 2 === 0 ? 1 : -1};
  }
  function grid(width, height, density) {
    const cols = Math.round(density);
    return {cols, rows: Math.max(2, Math.round(cols * height / width))};
  }
  function cellCenter(column, row, cols, rows) { return [(column + .5) / cols, (row + .5) / rows]; }
  // The card preview retraces a complete pair of shots, with time to see both originals.
  // Only its clock slows the bridge; the normal choreography and renderers stay shared.
  function previewPosition(elapsed, scene, count, config = DEFAULTS) {
    if (!Number.isFinite(elapsed) || !Number.isInteger(scene) || !Number.isInteger(count) || count < 2) throw new TypeError('Invalid preview position');
    const hold = 1.5, bridgeSeconds = Math.max(.96, config.bridgeSeconds * 1.5);
    const original = EDITS.find(e => e[2] === STYLE.original && e[3] === STYLE.original);
    const view = (config.shotSeconds - config.bridgeSeconds) * (original[0] + original[1]) / 2;
    const start = wrap(scene, count) * config.shotSeconds + view;
    const lead = config.shotSeconds - config.bridgeSeconds - view;
    const travel = lead + bridgeSeconds + view, cycleSeconds = 2 * (hold + travel);
    const clock = wrap(elapsed, cycleSeconds);
    let distance, phase;
    if (clock < hold) { distance = 0; phase = 'hold-source'; }
    else if (clock < hold + travel) { distance = clock - hold; phase = 'forward'; }
    else if (clock < 2 * hold + travel) { distance = travel; phase = 'hold-target'; }
    else { distance = cycleSeconds - clock; phase = 'reverse'; }
    const offset = distance <= lead ? distance : distance <= lead + bridgeSeconds
      ? lead + (distance - lead) * config.bridgeSeconds / bridgeSeconds
      : distance - (bridgeSeconds - config.bridgeSeconds);
    return {position: wrap(start + offset, count * config.shotSeconds), phase, cycleSeconds, bridgeSeconds};
  }
  const api = Object.freeze({DEFAULTS, MODES, STYLE, EDITS, GRID_HANDOFF, gridEnvelope, validate, frame, timing, previewPosition, grid, cellCenter, clip, smooth, span, wrap});
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MatrixTimeline = api;
})(typeof globalThis === 'object' ? globalThis : this);
