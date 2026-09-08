/* Shared deterministic timing for WebGL, Canvas, Worker-independent tests.
 * Only the time parametrization changes; assignments and Bézier controls do not.
 */
(function (scope) {
  'use strict';
  const DEFAULTS = Object.freeze({
    launchBase: 0.015, launchSpread: 0.035,
    landBase: 0.950, landSpread: 0.035,
    ramp: 0.08, splitEnd: 0.10, fillStart: 0.88
  });
  const clamp = x => Math.max(0, Math.min(1, x));
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  function create(overrides = {}) {
    for (const k of Object.keys(overrides)) if (!(k in DEFAULTS)) throw new TypeError('Unknown motion parameter: ' + k);
    const c = Object.freeze({...DEFAULTS, ...overrides});
    for (const [k, v] of Object.entries(c)) if (!Number.isFinite(v)) throw new TypeError('Non-finite motion parameter: ' + k);
    if (c.launchBase < 0 || c.launchSpread < 0 || c.launchBase + c.launchSpread > 0.12 ||
        c.landBase < 0.88 || c.landSpread < 0 || c.landBase + c.landSpread > 1 ||
        c.landBase <= c.launchBase + c.launchSpread || c.ramp < 0.02 || c.ramp > 0.20 ||
        c.splitEnd < 0.04 || c.splitEnd > 0.25 || c.fillStart < 0.75 || c.fillStart > 0.96) {
      throw new RangeError('Motion configuration would recreate a long dead zone or an invalid schedule');
    }
    function schedule(legacyStart, legacyEnd) {
      // Preserve the colour-dependent ordering already carried by the V3 plan.
      return [c.launchBase + c.launchSpread * clamp((legacyStart - 0.06) / 0.195),
              c.landBase + c.landSpread * clamp((legacyEnd - 0.77) / 0.08)];
    }
    function travel(u) {
      u = clamp(u);
      const r = c.ramp, norm = 1 - r;
      const edge = x => (x - r / Math.PI * Math.sin(Math.PI * x / r)) / (2 * norm);
      if (u < r) return edge(u);
      if (u > 1 - r) return 1 - edge(1 - u);
      return (u - r / 2) / norm;
    }
    function mosaic(u) {
      return smooth(u / c.splitEnd) * (1 - smooth((u - c.fillStart) / (1 - c.fillStart)));
    }
    function envelope(p) { return smooth(p / 0.12) * (1 - smooth((p - 0.88) / 0.12)); }
    function sample(p, legacyStart, legacyEnd, ghost = 0) {
      const [start, end] = schedule(legacyStart, legacyEnd);
      const raw = clamp((p - start) / (end - start));
      return {raw, t: travel(raw - ghost * 0.018), mosaic: mosaic(raw), start, end};
    }
    // Generate GLSL from the very same validated constants; no second timing table.
    const f = n => Number(n).toFixed(9);
    const glsl = `
vec2 transportSchedule(float oldStart, float oldEnd) {
  return vec2(${f(c.launchBase)} + ${f(c.launchSpread)} * clamp((oldStart - 0.06) / 0.195, 0.0, 1.0),
              ${f(c.landBase)} + ${f(c.landSpread)} * clamp((oldEnd - 0.77) / 0.08, 0.0, 1.0));
}
float transportEdge(float x) {
  return (x - ${f(c.ramp)} / 3.14159265359 * sin(3.14159265359 * x / ${f(c.ramp)})) / ${f(2 * (1 - c.ramp))};
}
float transportTravel(float u) {
  u = clamp(u, 0.0, 1.0);
  if (u < ${f(c.ramp)}) return transportEdge(u);
  if (u > ${f(1-c.ramp)}) return 1.0 - transportEdge(1.0 - u);
  return (u - ${f(c.ramp/2)}) / ${f(1-c.ramp)};
}
float transportMosaic(float u) {
  return smoothstep(0.0, ${f(c.splitEnd)}, u) * (1.0 - smoothstep(${f(c.fillStart)}, 1.0, u));
}`;
    return Object.freeze({config: c, schedule, travel, mosaic, envelope, sample, glsl});
  }
  const api = Object.freeze({DEFAULTS, create});
  if (typeof module === 'object' && module.exports) module.exports = api;
  else scope.TransportTiming = api;
})(typeof globalThis === 'object' ? globalThis : this);
