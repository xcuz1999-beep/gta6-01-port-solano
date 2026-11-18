// Port Solano — city.js
// Seeded city generation: a regular road grid over a 3600px world, city
// blocks filled with buildings, a sandy beach and sea along the south and
// east edges, palm trees, and the five named story zones.

import { WORLD_SIZE, ROAD_STEP, ROAD_WIDTH, ZONES } from "./config.js";
import { makeRng, pick } from "./random.js";

export const city = { buildings: [], palms: [], roads: [], zones: ZONES };

const PALETTE = ["#e8d8b0", "#d9a066", "#c96f4a", "#a8c3cf", "#e3e0d5", "#b5838d", "#84a98c", "#e9c46a"];

export function roadCenters() {
  const out = [];
  for (let c = ROAD_STEP / 2; c < WORLD_SIZE; c += ROAD_STEP) out.push(c);
  return out;
}

export function isOnRoad(x, y) {
  const half = ROAD_WIDTH / 2 + 6;
  for (const c of roadCenters()) {
    if (Math.abs(x - c) < half || Math.abs(y - c) < half) return true;
  }
  return false;
}

export function isWater(x, y) { return x > 3380 || y > 3380; }
export function isBeach(x, y) { return (x > 3220 && x <= 3380) || (y > 3220 && y <= 3380); }

export function buildCity(seed) {
  const rng = makeRng(seed * 7919 + 13);
  city.buildings = []; city.palms = []; city.roads = roadCenters();
  const centers = roadCenters();
  for (let i = 0; i < centers.length - 1; i++) {
    for (let j = 0; j < centers.length - 1; j++) {
      const x0 = centers[i] + ROAD_WIDTH / 2 + 14, y0 = centers[j] + ROAD_WIDTH / 2 + 14;
      const size = ROAD_STEP - ROAD_WIDTH - 28;
      const nearZone = ZONES.some((z) => Math.abs(z.x - (x0 + size / 2)) < 260 && Math.abs(z.y - (y0 + size / 2)) < 260);
      if (nearZone && rng() < 0.55) continue;
      const cols = rng() < 0.5 ? 1 : 2;
      for (let a = 0; a < cols; a++) for (let b = 0; b < cols; b++) {
        const w = size / cols - 16, h = size / cols - 16;
        city.buildings.push({
          x: x0 + a * (size / cols) + 8, y: y0 + b * (size / cols) + 8, w, h,
          color: pick(rng, PALETTE), floors: 2 + Math.floor(rng() * 6),
          seed: Math.floor(rng() * 1e9),
        });
      }
    }
  }
  for (let n = 0; n < 90; n++) {
    const along = rng() * 3200 + 100;
    const south = rng() < 0.5;
    city.palms.push(south ? { x: along, y: 3260 + rng() * 90 } : { x: 3260 + rng() * 90, y: along });
  }
  return city;
}

export function collidesBuilding(x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

export function resolveCollision(ent, r) {
  const b = collidesBuilding(ent.x, ent.y, r);
  if (!b) return;
  const left = ent.x + r - b.x, right = b.x + b.w - (ent.x - r);
  const top = ent.y + r - b.y, bottom = b.y + b.h - (ent.y - r);
  const m = Math.min(left, right, top, bottom);
  if (m === left) ent.x = b.x - r; else if (m === right) ent.x = b.x + b.w + r;
  else if (m === top) ent.y = b.y - r; else ent.y = b.y + b.h + r;
}

export function nearestRoadPoint(x, y) {
  let best = null, bd = 1e18;
  for (const cx of city.roads) for (const cy of city.roads) {
    const d = (cx - x) ** 2 + (cy - y) ** 2;
    if (d < bd) { bd = d; best = { x: cx, y: cy }; }
  }
  return best;
}

export function drawCity(ctx, cam, w, h, clock) {
  const x0 = cam.x - 60, y0 = cam.y - 60, x1 = cam.x + w + 60, y1 = cam.y + h + 60;
  ctx.fillStyle = "#9db38a"; ctx.fillRect(cam.x, cam.y, w, h);
  // sea and beach
  ctx.fillStyle = "#e6d29a"; ctx.fillRect(3220, 0, 380, WORLD_SIZE); ctx.fillRect(0, 3220, WORLD_SIZE, 380);
  ctx.fillStyle = "#2e7fb8"; ctx.fillRect(3380, 0, 220, WORLD_SIZE); ctx.fillRect(0, 3380, WORLD_SIZE, 220);
  // marina docks reaching into the water
  ctx.fillStyle = "#8a6b45";
  for (let d = 0; d < 5; d++) { ctx.fillRect(3380, 2820 + d * 130, 120, 12); ctx.fillRect(2820 + d * 130, 3380, 12, 120); }
  ctx.fillStyle = "#f4f6f8";
  for (let d = 0; d < 5; d++) { ctx.fillRect(3430, 2796 + d * 130, 26, 10); ctx.fillRect(2796 + d * 130, 3430, 10, 26); }
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  for (let y = 40; y < WORLD_SIZE; y += 90) ctx.fillRect(3400 + ((y * 7) % 60), y, 46, 4);
  // roads
  ctx.fillStyle = "#3c4148";
  for (const c of city.roads) {
    ctx.fillRect(c - ROAD_WIDTH / 2, 0, ROAD_WIDTH, WORLD_SIZE);
    ctx.fillRect(0, c - ROAD_WIDTH / 2, WORLD_SIZE, ROAD_WIDTH);
  }
  ctx.strokeStyle = "#e8c95a"; ctx.lineWidth = 3; ctx.setLineDash([22, 18]);
  for (const c of city.roads) {
    ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(c, WORLD_SIZE); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, c); ctx.lineTo(WORLD_SIZE, c); ctx.stroke();
  }
  ctx.setLineDash([]);
  // sidewalks
  ctx.strokeStyle = "#cbbfa5"; ctx.lineWidth = 8;
  for (const c of city.roads) {
    ctx.strokeRect(c - ROAD_WIDTH / 2 - 6, -6, ROAD_WIDTH + 12, WORLD_SIZE + 12);
  }
  // buildings with simple lit windows at night
  const night = clock < 0.22 || clock > 0.78;
  for (const b of city.buildings) {
    if (b.x + b.w < x0 || b.y + b.h < y0 || b.x > x1 || b.y > y1) continue;
    ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = "rgba(255,255,255,0.16)"; ctx.fillRect(b.x, b.y, b.w, 7);
    const wrng = (n) => { const v = Math.sin(b.seed + n * 127.1) * 43758.5; return v - Math.floor(v); };
    ctx.fillStyle = night ? "#ffd97a" : "rgba(40,60,80,0.45)";
    for (let wy = 16; wy < b.h - 10; wy += 27) for (let wx = 12; wx < b.w - 10; wx += 27) {
      if (wrng(wx * 3 + wy) < 0.3) continue;
      if (night && wrng(wx * wy) < 0.45) continue;
      ctx.fillRect(b.x + wx, b.y + wy, 11, 14);
    }
  }
  // palms
  for (const p of city.palms) {
    if (p.x < x0 || p.y < y0 || p.x > x1 || p.y > y1) continue;
    ctx.fillStyle = "#6d4c2f"; ctx.fillRect(p.x - 2, p.y - 3, 4, 12);
    ctx.strokeStyle = "#3e7d44"; ctx.lineWidth = 3;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y - 3); ctx.lineTo(p.x + Math.cos(a) * 15, p.y - 8 + Math.sin(a) * 6); ctx.stroke();
    }
  }
  // zone markers on the ground
  for (const z of ZONES) {
    ctx.fillStyle = z.color; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(z.x, z.y, 26, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = "#1d2430";
    ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(z.name, z.x, z.y + 44);
  }
}
