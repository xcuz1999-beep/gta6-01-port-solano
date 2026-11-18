// Port Solano — pedestrians.js
// Sidewalk walkers with simple goals. They stroll, flee from gunfire and
// fast cars, can be knocked down (a crime), and act as witnesses: a crime
// committed in front of one is what raises the player's heat.

import { WORLD_SIZE } from "./config.js";
import { makeRng, clamp } from "./random.js";
import { city, resolveCollision } from "./city.js";
import { G } from "./state.js";
import { dist } from "./random.js";

const SHIRTS = ["#e2725b", "#5b8e7d", "#f4d35e", "#6a8eae", "#c08497", "#f7ede2"];

export function spawnPeds(seed) {
  const rng = makeRng(seed * 977 + 31);
  const peds = [];
  for (let i = 0; i < 42; i++) {
    const road = city.roads[Math.floor(rng() * city.roads.length)];
    const along = 120 + rng() * 3300;
    const vertical = rng() < 0.5;
    peds.push({
      x: vertical ? road + (rng() < 0.5 ? -58 : 58) : along,
      y: vertical ? along : road + (rng() < 0.5 ? -58 : 58),
      tx: 0, ty: 0, wait: rng() * 2, state: "walk", hp: 30,
      color: SHIRTS[Math.floor(rng() * SHIRTS.length)], flee: 0, down: 0, reported: 0,
    });
    const p = peds[peds.length - 1];
    p.tx = p.x; p.ty = p.y;
  }
  return peds;
}

export function witnessCrime(x, y, severity) {
  let witnessed = false;
  for (const p of G.peds) {
    if (p.down > 0) continue;
    if (dist(p.x, p.y, x, y) < 240) { witnessed = true; p.flee = 2.2; }
  }
  if (witnessed) {
    const { reportCrime } = window.__psHooks || {};
    if (reportCrime) reportCrime(severity);
    else G.heat += severity;
  }
  return witnessed;
}

export function updatePeds(dt) {
  const pl = G.player;
  for (const p of G.peds) {
    if (p.down > 0) { p.down -= dt; continue; }
    let dx = p.tx - p.x, dy = p.ty - p.y;
    let speed = 52;
    if (p.flee > 0 && pl) {
      p.flee -= dt;
      dx = p.x - pl.x; dy = p.y - pl.y; speed = 138;
    } else if (Math.hypot(dx, dy) < 12 || p.wait > 0) {
      p.wait -= dt;
      if (p.wait <= 0) {
        const road = city.roads[Math.floor(Math.random() * city.roads.length)];
        if (Math.random() < 0.5) { p.tx = road + (Math.random() < 0.5 ? -58 : 58); p.ty = clamp(p.y + (Math.random() - 0.5) * 700, 60, 3400); }
        else { p.ty = road + (Math.random() < 0.5 ? -58 : 58); p.tx = clamp(p.x + (Math.random() - 0.5) * 700, 60, 3400); }
        p.wait = 1 + Math.random() * 3;
      }
      continue;
    }
    const len = Math.hypot(dx, dy) || 1;
    p.x += (dx / len) * speed * dt; p.y += (dy / len) * speed * dt;
    p.x = clamp(p.x, 24, WORLD_SIZE - 24); p.y = clamp(p.y, 24, WORLD_SIZE - 24);
    resolveCollision(p, 10);
    // knocked down by a fast car
    for (const car of G.cars) {
      if (Math.hypot(car.vx, car.vy) > 90 && dist(p.x, p.y, car.x, car.y) < 26) {
        p.down = 6; p.hp -= 20;
        witnessCrime(p.x, p.y, 22);
        G.shake = Math.max(G.shake, 4);
      }
    }
  }
}

export function drawPed(ctx, p) {
  if (p.down > 0) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(1.2);
    ctx.fillStyle = p.color; ctx.fillRect(-11, -4, 22, 8);
    ctx.fillStyle = "#e8b88a"; ctx.beginPath(); ctx.arc(13, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore(); return;
  }
  ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.arc(p.x + 2, p.y + 3, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#2f3a4a"; ctx.fillRect(p.x - 4, p.y + 2, 8, 8);
  ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y - 1, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#e8b88a"; ctx.beginPath(); ctx.arc(p.x, p.y - 3, 4.5, 0, Math.PI * 2); ctx.fill();
}
