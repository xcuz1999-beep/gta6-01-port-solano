// Port Solano — random.js
// A tiny seeded RNG (mulberry32) plus the math helpers every system shares.
// Seeding is what makes the city, the screenshot scenes and the self-test
// deterministic: same seed, same Port Solano, every load.

export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A small wrapper so call sites read like prose instead of raw rng() calls.
export class Rng {
  constructor(seed) { this.next = mulberry32(seed); }
  float() { return this.next(); }
  range(min, max) { return min + (max - min) * this.next(); }
  int(min, max) { return Math.floor(this.range(min, max + 1)); }
  pick(list) { return list[Math.floor(this.next() * list.length) % list.length]; }
  chance(p) { return this.next() < p; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return Math.hypot(dx, dy); }
export function dist2(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; }
export function angleTo(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); }

// Shortest signed difference between two headings, in (-PI, PI].
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function angleLerp(from, to, t) { return from + angleDelta(from, to) * clamp(t, 0, 1); }
