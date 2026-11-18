// Port Solano — traffic.js
// AI traffic that drives the road grid with right-hand lanes, plus the
// parked cars that line the streets waiting to be stolen. Traffic brains are
// simple on purpose: follow your lane to the next junction, sometimes turn,
// brake for whatever is ahead, and stop dead when your car is wrecked or
// your driver has been pulled out.

import { ROAD_WIDTH } from './config.js';
import { G } from './state.js';
import { ROAD_LINES, nearestRoadLine } from './city.js';
import { makeCar, stepCar, carSpeed } from './vehicles.js';
import { clamp, angleDelta } from './random.js';

const LANE = ROAD_WIDTH / 4; // right-hand lane offset from the centreline
const TRAFFIC_TYPES = ['sedan', 'sedan', 'coupe', 'van', 'taxi', 'sedan', 'coupe'];
const TRAFFIC_COUNT = 15;
const PARKED_COUNT = 26;

// A traffic brain: the car travels along one axis; `fixed` is the centreline
// of the road it is on, `dir` its direction sign along the moving axis.
function newBrain(rng) {
  const horizontal = rng.chance(0.5);
  return {
    horizontal,
    fixed: rng.pick(ROAD_LINES),
    dir: rng.sign(),
    cruise: rng.range(130, 195),
    turnCooldown: 0,
  };
}

export function spawnTraffic(rng) {
  for (let i = 0; i < TRAFFIC_COUNT; i++) {
    const brain = newBrain(rng);
    const along = rng.range(150, 3450);
    const x = brain.horizontal ? along : brain.fixed + LANE * brain.dir;
    const y = brain.horizontal ? brain.fixed - LANE * brain.dir : along;
    // Right-hand traffic: heading along +axis uses the lane on its right.
    const angle = brain.horizontal ? (brain.dir > 0 ? 0 : Math.PI) : (brain.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const car = makeCar(x, y, angle, rng.pick(TRAFFIC_TYPES), { driver: 'traffic' });
    if (brain.horizontal) { car.x = along; car.y = brain.fixed + (brain.dir > 0 ? LANE : -LANE); }
    else { car.x = brain.fixed + (brain.dir > 0 ? -LANE : LANE); car.y = along; }
    car.ai = brain;
  }
}

export function spawnParkedCars(rng) {
  let placed = 0, guard = 0;
  while (placed < PARKED_COUNT && guard++ < 400) {
    const vertical = rng.chance(0.5);
    const line = rng.pick(ROAD_LINES);
    const along = rng.range(120, 3480);
    const side = rng.sign();
    const x = vertical ? line + side * (ROAD_WIDTH / 2 - 13) : along;
    const y = vertical ? along : line + side * (ROAD_WIDTH / 2 - 13);
    if (y > 3100) continue; // not on the beach
    if (G.cars.some((c) => Math.hypot(c.x - x, c.y - y) < 70)) continue;
    const angle = vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? Math.PI : 0);
    const type = rng.pick(TRAFFIC_TYPES.concat(['sport']));
    // Roughly a third of parked cars are locked: those need a break-in.
    makeCar(x, y, angle, type, { parked: true, locked: rng.chance(0.34) });
    placed++;
  }
}

// Is there a car or the player just ahead of this one? Traffic brakes for it.
function obstacleAhead(car, lookDist) {
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  const px = car.x + fx * lookDist, py = car.y + fy * lookDist;
  for (const other of G.cars) {
    if (other === car) continue;
    if (Math.hypot(other.x - px, other.y - py) < 30) return true;
  }
  const p = G.player;
  if (p && !p.car && Math.hypot(p.x - px, p.y - py) < 24) return true;
  return false;
}

export function updateTraffic(dt) {
  for (const car of G.cars) {
    if (car.driver !== 'traffic' || !car.ai) continue;
    if (car.wrecked) continue;
    const brain = car.ai;
    brain.turnCooldown -= dt;

    // Where the lane centre is, and which junction comes next.
    let targetX, targetY;
    if (brain.horizontal) {
      targetY = brain.fixed + (brain.dir > 0 ? LANE : -LANE);
      targetX = car.x + brain.dir * 120;
    } else {
      targetX = brain.fixed + (brain.dir > 0 ? -LANE : LANE);
      targetY = car.y + brain.dir * 120;
    }

    // At a junction, sometimes pick a new road to follow.
    const nearX = nearestRoadLine(car.x), nearY = nearestRoadLine(car.y);
    const atJunction = Math.abs(car.x - nearX) < 30 && Math.abs(car.y - nearY) < 30;
    if (atJunction && brain.turnCooldown <= 0 && G.fxRng.chance(0.4)) {
      brain.turnCooldown = 2.5;
      if (brain.horizontal) {
        brain.horizontal = false;
        brain.fixed = nearX;
        brain.dir = G.fxRng.sign();
        if ((brain.dir > 0 && car.y > nearY + 4) || (brain.dir < 0 && car.y < nearY - 4)) brain.dir = -brain.dir;
      } else {
        brain.horizontal = true;
        brain.fixed = nearY;
        brain.dir = G.fxRng.sign();
        if ((brain.dir > 0 && car.x > nearX + 4) || (brain.dir < 0 && car.x < nearX - 4)) brain.dir = -brain.dir;
      }
    }
    // Off the south edge the road ends at the beach: turn around.
    if (car.y > 3060 && !brain.horizontal && brain.dir > 0) { brain.horizontal = true; brain.fixed = nearestRoadLine(car.y); brain.dir = G.fxRng.sign(); }
    if (car.x < 130 && brain.horizontal && brain.dir < 0) brain.dir = 1;
    if (car.x > 3470 && brain.horizontal && brain.dir > 0) brain.dir = -1;
    if (car.y < 130 && !brain.horizontal && brain.dir < 0) brain.dir = 1;

    const desired = Math.atan2(targetY - car.y, targetX - car.x);
    const steer = clamp(angleDelta(car.angle, desired) * 2.4, -1, 1);
    let throttle = 0.85;
    const speed = carSpeed(car);
    if (speed > brain.cruise) throttle = 0;
    if (obstacleAhead(car, 58)) throttle = speed > 30 ? -0.9 : 0;
    stepCar(car, throttle, steer, false, dt);
  }
}

// Keep the city populated: if traffic drifts too far from the player or gets
// wrecked, quietly recycle it to a road a few blocks away.
export function maintainTraffic(dt) {
  const p = G.player;
  if (!p) return;
  for (const car of G.cars) {
    if (car.driver !== 'traffic') continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d > 1500 || (car.wrecked && d > 500)) {
      const brain = newBrain(G.fxRng);
      const along = clamp((brain.horizontal ? p.x : p.y) + G.fxRng.range(-700, 700), 150, 3450);
      car.ai = brain;
      car.hp = car.maxHp; car.wrecked = false; car.vx = 0; car.vy = 0;
      if (brain.horizontal) { car.x = along; car.y = brain.fixed + (brain.dir > 0 ? LANE : -LANE); car.angle = brain.dir > 0 ? 0 : Math.PI; }
      else { car.x = brain.fixed + (brain.dir > 0 ? -LANE : LANE); car.y = along; car.angle = brain.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    }
  }
}
