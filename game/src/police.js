// Port Solano — police.js
// The wanted system. Witnessed crimes add heat; heat converts to stars.
// Patrol cars spawn off-screen and pursue, officers step out and shoot at
// three stars and up, a PD helicopter orbits with a searchlight at four
// stars and up, a bust meter fills when the player is cornered, and
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
  // PD helicopter: joins at four stars, orbits the player under its
  // searchlight, and breaks off once the heat drops to two stars.
  if (G.wanted >= 4 && !G.heli) G.heli = { x: pl.x + 320, y: pl.y - 320, angle: 0 };
  if (G.heli) {
    const heli = G.heli;
    if (G.wanted <= 2) {
      const fx = pl.x - 700, fy = pl.y - 700;
      const fd = dist(heli.x, heli.y, fx, fy) || 1;
      heli.x += ((fx - heli.x) / fd) * 300 * dt;
      heli.y += ((fy - heli.y) / fd) * 300 * dt;
      if (dist(heli.x, heli.y, pl.x, pl.y) > 950) G.heli = null;
    } else {
      heli.angle += dt * 0.45;
      const tx = pl.x + Math.cos(heli.angle) * 130;
      const ty = pl.y + Math.sin(heli.angle) * 130;
      const dx = tx - heli.x, dy = ty - heli.y;
      const dd = Math.hypot(dx, dy);
      if (dd > 0.01) {
        const stepLen = Math.min(dd, 300 * dt);
        heli.x += (dx / dd) * stepLen; heli.y += (dy / dd) * stepLen;
      }
    }
  }
  let anyoneSees = false;
  for (const cop of G.cops) if (dist(cop.x, cop.y, pl.x, pl.y) < 430) anyoneSees = true;
  for (const p of G.peds) if (p.down <= 0 && dist(p.x, p.y, pl.x, pl.y) < 200 && G.heat > 0) anyoneSees = true;
  if (G.heli && dist(G.heli.x, G.heli.y, pl.x, pl.y) < 470) anyoneSees = true;
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

// The helicopter is drawn in world space: heli.x/heli.y is its ground
// point (shadow + searchlight pool), the airframe hovers up-left of it.
export function drawHeli(ctx) {
  const heli = G.heli; if (!heli) return;
  const gx = heli.x, gy = heli.y;
  ctx.save();
  // soft shadow on the ground point
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(gx, gy, 26, 10, 0, 0, Math.PI * 2); ctx.fill();
  // searchlight pool
  const light = ctx.createRadialGradient(gx, gy, 8, gx, gy, 90);
  light.addColorStop(0, "rgba(255,244,200,0.15)");
  light.addColorStop(1, "rgba(255,244,200,0.02)");
  ctx.fillStyle = light;
  ctx.beginPath(); ctx.arc(gx, gy, 90, 0, Math.PI * 2); ctx.fill();
  // airframe, offset up-left of the ground point
  ctx.translate(gx - 26, gy - 34);
  // tail boom + fin
  ctx.strokeStyle = "#1c2733"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-34, -4); ctx.stroke();
  ctx.fillStyle = "#1c2733"; ctx.fillRect(-38, -9, 5, 9);
  // tail rotor tick
  ctx.strokeStyle = "#9fb4c4"; ctx.lineWidth = 2;
  const tick = Math.sin(G.time * 40) * 4;
  ctx.beginPath(); ctx.moveTo(-36, -9 + tick * 0.25); ctx.lineTo(-36, 1 - tick * 0.25); ctx.stroke();
  // body blob
  ctx.fillStyle = "#24344a";
  ctx.beginPath(); ctx.ellipse(0, 0, 17, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#4da3ff"; ctx.fillRect(7, -3, 6, 6);
  // skids
  ctx.strokeStyle = "#10161d"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-11, 9); ctx.lineTo(12, 9); ctx.stroke();
  // main rotor, spinning with game time
  const rot = G.time * 22;
  ctx.strokeStyle = "rgba(205,225,240,0.85)"; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(Math.cos(rot) * -27, -9 + Math.sin(rot) * -3);
  ctx.lineTo(Math.cos(rot) * 27, -9 + Math.sin(rot) * 3);
  ctx.stroke();
  ctx.fillStyle = "#dfe9f2"; ctx.fillRect(-2, -11, 4, 4);
  // blinking red beacon
  if (Math.floor(G.time * 2) % 2 === 0) {
    ctx.fillStyle = "#ff3b30";
    ctx.beginPath(); ctx.arc(-4, -8, 2.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
