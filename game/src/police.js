// Port Solano — police.js
// The wanted system. Witnessed crimes add heat; heat converts to stars.
// Patrol cars spawn off-screen and pursue, officers step out and shoot at
// three stars and up, a bust meter fills when the player is cornered, and
// heat quietly decays while nobody can see the player.

import { STAR_THRESHOLDS, BUST_TIME, HEAT_DECAY } from "./config.js";
import { G } from "./state.js";
import { dist, clamp } from "./random.js";
import { makeCar, stepCar } from "./vehicles.js";
import { makeRng } from "./random.js";
import { sfx } from "./audio.js";

export function reportCrime(severity) { G.heat += severity; }
window.__psHooks = { reportCrime };

export function wantedFromHeat(heat) {
  let stars = 0;
  for (let i = 1; i < STAR_THRESHOLDS.length; i++) if (heat >= STAR_THRESHOLDS[i]) stars = i;
  return stars;
}

export function clearHeat() { G.heat = 0; G.wanted = 0; G.bust = 0; }

export function spawnCop() {
  const pl = G.player; if (!pl) return;
  const rng = makeRng(Math.floor(Math.random() * 1e9));
  const a = Math.random() * Math.PI * 2;
  const car = makeCar(pl.x + Math.cos(a) * 620, pl.y + Math.sin(a) * 620, a + Math.PI, rng, { cop: true, color: "#f4f6f8" });
  car.copAI = { officerOut: false, officer: null, shootCd: 0 };
  G.cops.push(car); G.cars.push(car);
}

export function updatePolice(dt) {
  G.wanted = wantedFromHeat(G.heat);
  const pl = G.player; if (!pl) return;
  let anyoneSees = false;
  for (const cop of G.cops) if (dist(cop.x, cop.y, pl.x, pl.y) < 430) anyoneSees = true;
  for (const p of G.peds) if (p.down <= 0 && dist(p.x, p.y, pl.x, pl.y) < 200 && G.heat > 0) anyoneSees = true;
  if (anyoneSees) G.seenTimer = 0; else G.seenTimer += dt;
  if (G.seenTimer > 4 && G.heat > 0) G.heat = Math.max(0, G.heat - dt * HEAT_DECAY);

  const wantCops = G.wanted === 0 ? 0 : 1 + G.wanted;
  if (G.cops.length < wantCops && G.wanted > 0 && Math.random() < dt * 0.8) spawnCop();
  if (G.wanted === 0 && G.cops.length) {
    G.cars = G.cars.filter((c) => !G.cops.includes(c));
    G.cops = [];
  }

  let boxed = false;
  for (const cop of [...G.cops]) {
    const d = dist(cop.x, cop.y, pl.x, pl.y);
    if (d > 1500) { G.cops.splice(G.cops.indexOf(cop), 1); G.cars.splice(G.cars.indexOf(cop), 1); continue; }
    const target = pl.car || pl;
    const a = Math.atan2(target.y - cop.y, target.x - cop.x);
    let da = a - cop.angle;
    while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    const input = { up: d > 46, down: d < 30, left: da < -0.08, right: da > 0.08, drift: Math.abs(da) > 1.1 };
    if (!cop.copAI.officerOut) stepCar(cop, dt, input);
    // foot officers at 3 stars and up
    if (G.wanted >= 3 && d < 190 && !cop.copAI.officerOut) {
      cop.copAI.officerOut = true;
      cop.copAI.officer = { x: cop.x + 18, y: cop.y, hp: 45 };
    }
    const off = cop.copAI.officer;
    if (off) {
      const od = dist(off.x, off.y, pl.x, pl.y);
      if (od > 120 && !pl.car) { off.x += ((pl.x - off.x) / od) * 95 * dt; off.y += ((pl.y - off.y) / od) * 95 * dt; }
      cop.copAI.shootCd -= dt;
      if (od < 300 && cop.copAI.shootCd <= 0 && !pl.car) {
        cop.copAI.shootCd = 1 + Math.random() * 0.6;
        const ba = Math.atan2(pl.y - off.y, pl.x - off.x) + (Math.random() - 0.5) * 0.16;
        G.bullets.push({ x: off.x, y: off.y, vx: Math.cos(ba) * 620, vy: Math.sin(ba) * 620, life: 0.5, damage: 8, foe: true });
        sfx.shot();
      }
      if (od < 34 && !pl.car) boxed = true;
    }
    if (pl.car && d < 44 && Math.hypot(pl.car.vx, pl.car.vy) < 26) boxed = true;
    if (!pl.car && d < 40) boxed = true;
  }
  if (boxed && G.wanted > 0) {
    G.bust += dt / BUST_TIME;
    if (G.bust >= 1) { G.mode = "busted"; sfx.stinger(false); }
  } else G.bust = Math.max(0, G.bust - dt * 0.7);
  G.bust = clamp(G.bust, 0, 1);
}
