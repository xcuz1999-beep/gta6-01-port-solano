// Port Solano — combat.js
// Fists, pistol and SMG with mouse aim, plus rival gunmen who hold ground
// near mission fights and shoot back. Bullets are short-lived tracers.

import { WEAPONS } from "./config.js";
import { G, toast } from "./state.js";
import { dist } from "./random.js";
import { sfx } from "./audio.js";
import { burst, floater } from "./effects.js";
import { witnessCrime } from "./pedestrians.js";

export function makeGunman(x, y, hp = 55) {
  return { x, y, hp, maxHp: hp, cooldown: Math.random() * 0.6, dead: false, flash: 0 };
}

export function playerAttack(dt, aimX, aimY) {
  const pl = G.player;
  if (!pl || pl.car) return;
  pl.cooldown -= dt;
  const wantFire = window.__psMouseDown;
  if (!wantFire || pl.cooldown > 0) return;
  const w = WEAPONS[G.weapon];
  if (G.weapon !== "fists") {
    if (G.ammo[G.weapon] <= 0) { toast("Out of ammo — visit Armeria Solano"); pl.cooldown = 0.4; return; }
    G.ammo[G.weapon]--;
  }
  pl.cooldown = w.cooldown;
  const a = Math.atan2(aimY - pl.y, aimX - pl.x) + (Math.random() - 0.5) * 2 * w.spread;
  pl.angle = a;
  if (G.weapon === "fists") {
    sfx.punch();
    for (const target of [...G.gunmen, ...G.peds]) {
      if (target.dead || target.down > 0) continue;
      if (dist(pl.x, pl.y, target.x, target.y) < w.range + 8) {
        hurtTarget(target, w.damage, pl.x, pl.y);
        witnessCrime(pl.x, pl.y, 14);
        break;
      }
    }
    return;
  }
  sfx.shot();
  burst(pl.x + Math.cos(a) * 16, pl.y + Math.sin(a) * 16, 2, "#ffd34d");
  G.bullets.push({ x: pl.x, y: pl.y, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, life: w.range / w.speed, damage: w.damage, foe: false });
  witnessCrime(pl.x, pl.y, 10);
  G.shake = Math.max(G.shake, 1.2);
}

export function hurtTarget(t, damage, sx, sy) {
  t.hp -= damage; t.flash = 0.12;
  burst(t.x, t.y, 4, "#d94f3d"); sfx.hit();
  if (t.down !== undefined && t.hp <= 0) t.down = 8;
  if (t.dead !== undefined && t.hp <= 0 && !t.dead) {
    t.dead = true;
    floater(t.x, t.y - 14, "Down", "#ff9d7a");
  }
  const dx = t.x - sx, dy = t.y - sy, len = Math.hypot(dx, dy) || 1;
  t.x += (dx / len) * 7; t.y += (dy / len) * 7;
}

export function updateCombat(dt) {
  const pl = G.player;
  for (const b of G.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.foe && pl && !pl.car && dist(b.x, b.y, pl.x, pl.y) < 13) {
      b.life = 0; pl.hp -= b.damage; burst(pl.x, pl.y, 5, "#d94f3d"); G.shake = Math.max(G.shake, 2.5);
    }
    if (!b.foe) {
      for (const g of G.gunmen) {
        if (!g.dead && dist(b.x, b.y, g.x, g.y) < 13) { b.life = 0; hurtTarget(g, b.damage, b.x - b.vx * 0.02, b.y - b.vy * 0.02); break; }
      }
    }
  }
  G.bullets = G.bullets.filter((b) => b.life > 0);
  for (const g of G.gunmen) {
    if (g.dead) continue;
    g.flash = Math.max(0, (g.flash || 0) - dt);
    if (!pl) continue;
    const d = dist(g.x, g.y, pl.x, pl.y);
    g.cooldown -= dt;
    if (d < 330 && g.cooldown <= 0 && !pl.car) {
      g.cooldown = 0.85 + Math.random() * 0.5;
      const a = Math.atan2(pl.y - g.y, pl.x - g.x) + (Math.random() - 0.5) * 0.14;
      G.bullets.push({ x: g.x, y: g.y, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, life: 0.55, damage: 9, foe: true });
      sfx.shot();
    } else if (d > 130 && d < 420) {
      g.x += ((pl.x - g.x) / d) * 34 * dt; g.y += ((pl.y - g.y) / d) * 34 * dt;
    }
  }
}

export function drawGunman(ctx, g) {
  if (g.dead) {
    ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(0.6);
    ctx.fillStyle = "#5a2d2d"; ctx.fillRect(-12, -4, 24, 8);
    ctx.fillStyle = "#e8b88a"; ctx.beginPath(); ctx.arc(14, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore(); return;
  }
  ctx.fillStyle = g.flash > 0 ? "#fff" : "#7a2430";
  ctx.beginPath(); ctx.arc(g.x, g.y - 1, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#e8b88a"; ctx.beginPath(); ctx.arc(g.x, g.y - 3, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#20242c"; ctx.fillRect(g.x + 4, g.y - 2, 11, 3);
  ctx.fillStyle = "#40151c"; ctx.fillRect(g.x - 9, g.y - 20, 18, 4);
  ctx.fillStyle = "#e5484d"; ctx.fillRect(g.x - 9, g.y - 20, 18 * Math.max(0, g.hp / g.maxHp), 4);
}

export function drawBullets(ctx) {
  ctx.strokeStyle = "#ffe9a3"; ctx.lineWidth = 2;
  for (const b of G.bullets) {
    ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
}
