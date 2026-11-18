// Port Solano — vehicles.js
// Car factory plus arcade driving physics: acceleration, handbrake drift,
// steering that tightens with speed, and a single damage pool per car that
// smokes, then wrecks the car when it runs out.

import { CAR_TYPES } from "./config.js";
import { makeRng, pick, clamp } from "./random.js";
import { collidesBuilding } from "./city.js";
import { G } from "./state.js";
import { burst } from "./effects.js";

let nextCarId = 1;

export function makeCar(x, y, angle, rng, opts = {}) {
  const type = opts.type || pick(rng, CAR_TYPES);
  return {
    id: nextCarId++, x, y, angle, vx: 0, vy: 0, speed: 0,
    type, color: opts.color || pick(rng, type.colors),
    w: type.w, h: type.h, hp: 100, locked: !!opts.locked,
    parked: !!opts.parked, driver: opts.driver || null, cop: !!opts.cop,
    wrecked: false, alarm: 0, smokeTimer: 0,
  };
}

export function carSpeed(car) { return Math.hypot(car.vx, car.vy); }

export function damageCar(car, amount, x, y) {
  if (car.wrecked) return;
  car.hp -= amount;
  burst(x ?? car.x, y ?? car.y, 6, "#ffb347");
  if (car.hp <= 0) { car.hp = 0; car.wrecked = true; burst(car.x, car.y, 26, "#555"); G.shake = Math.max(G.shake, 7); }
}

export function stepCar(car, dt, input) {
  if (car.wrecked) { car.vx *= 0.9; car.vy *= 0.9; car.x += car.vx * dt; car.y += car.vy * dt; return; }
  const fwdX = Math.cos(car.angle), fwdY = Math.sin(car.angle);
  const fwdSpeed = car.vx * fwdX + car.vy * fwdY;
  let steer = 0;
  if (input.left) steer -= 1;
  if (input.right) steer += 1;
  const steerPower = clamp(Math.abs(fwdSpeed) / 90, 0, 1) * (fwdSpeed < 0 ? -1 : 1);
  car.angle += steer * 2.15 * steerPower * dt * (input.drift ? 1.45 : 1);
  if (input.up) car.speed = Math.min(car.type.top, (fwdSpeed + car.type.accel * dt));
  else if (input.down) car.speed = Math.max(-110, fwdSpeed - 240 * dt);
  else car.speed = fwdSpeed * Math.pow(0.55, dt);
  if (input.drift) car.speed *= Math.pow(0.82, dt);
  const grip = input.drift ? 0.86 : car.type.grip;
  const latX = -fwdY, latY = fwdX;
  const latSpeed = car.vx * latX + car.vy * latY;
  const nfX = Math.cos(car.angle), nfY = Math.sin(car.angle);
  car.vx = nfX * car.speed + latX * latSpeed * grip;
  car.vy = nfY * car.speed + latY * latSpeed * grip;
  const nx = car.x + car.vx * dt, ny = car.y + car.vy * dt;
  if (collidesBuilding(nx, ny, 20)) {
    const impact = Math.abs(car.speed);
    if (impact > 120) damageCar(car, impact * 0.06, nx, ny);
    if (impact > 60) G.shake = Math.max(G.shake, 3);
    car.speed *= -0.25; car.vx *= -0.25; car.vy *= -0.25;
  } else { car.x = nx; car.y = ny; }
  car.x = clamp(car.x, 30, 3570); car.y = clamp(car.y, 30, 3570);
  if (car.hp < 45) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) { car.smokeTimer = 0.12; burst(car.x, car.y, 1, car.hp < 20 ? "#333" : "#bbb"); }
  }
  if (Math.abs(latSpeed) > 55 && Math.abs(car.speed) > 60) {
    G.skids.push({ x: car.x - nfX * 14, y: car.y - nfY * 14, life: 6 });
    if (G.skids.length > 420) G.skids.splice(0, G.skids.length - 420);
  }
}

export function drawCar(ctx, car) {
  ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.angle);
  ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(-car.w / 2 + 3, -car.h / 2 + 4, car.w, car.h);
  ctx.fillStyle = car.wrecked ? "#3a3a3a" : car.color;
  ctx.fillRect(-car.w / 2, -car.h / 2, car.w, car.h);
  if (car.cop) { ctx.fillStyle = "#f4f6f8"; ctx.fillRect(-car.w / 2, -car.h / 2, car.w, car.h); ctx.fillStyle = "#22406e"; ctx.fillRect(-6, -car.h / 2, 13, car.h); ctx.fillStyle = "#e33"; ctx.fillRect(-2, -5, 5, 4); ctx.fillStyle = "#37e"; ctx.fillRect(-2, 1, 5, 4); }
  ctx.fillStyle = "#bfe3ef"; ctx.fillRect(car.w * 0.08, -car.h / 2 + 3, 9, car.h - 6);
  ctx.fillStyle = "#22303c"; ctx.fillRect(-car.w * 0.28, -car.h / 2 + 3, 8, car.h - 6);
  ctx.fillStyle = "#14181d";
  for (const [wx, wy] of [[-car.w / 2 + 7, -car.h / 2 - 2], [car.w / 2 - 7, -car.h / 2 - 2], [-car.w / 2 + 7, car.h / 2 - 2], [car.w / 2 - 7, car.h / 2 - 2]]) ctx.fillRect(wx - 4, wy, 8, 4);
  if (car.locked) { ctx.fillStyle = "#ffd34d"; ctx.fillRect(-3, -3, 6, 6); }
  ctx.restore();
  if (car.alarm > 0 && Math.floor(car.alarm * 6) % 2 === 0) {
    ctx.fillStyle = "#ffdf5e"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("!", car.x, car.y - 26);
  }
}
