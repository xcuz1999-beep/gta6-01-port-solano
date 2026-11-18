// Port Solano — traffic.js
// Ambient traffic: AI cars follow the road grid in right-hand lanes,
// pause briefly at intersections, and a scatter of parked cars waits to
// be borrowed. Traffic drivers are ejected when the player steals a car.

import { WORLD_SIZE } from "./config.js";
import { makeRng, pick, clamp } from "./random.js";
import { city } from "./city.js";
import { makeCar, stepCar, carSpeed } from "./vehicles.js";
import { G } from "./state.js";

export function spawnTraffic(seed) {
  const rng = makeRng(seed * 331 + 7);
  const cars = [];
  for (let i = 0; i < 14; i++) {
    const horizontal = rng() < 0.5;
    const lane = pick(rng, city.roads);
    const along = 200 + rng() * 3200;
    const dir = rng() < 0.5 ? 1 : -1;
    const off = 23 * dir;
    const car = horizontal
      ? makeCar(along, lane + off, dir > 0 ? 0 : Math.PI, rng, {})
      : makeCar(lane + (dir > 0 ? -23 : 23), along, dir > 0 ? Math.PI / 2 : -Math.PI / 2, rng, {});
    car.ai = { horizontal, dir, pause: 0 };
    car.driver = { name: "driver" };
    cars.push(car);
  }
  // parked cars near block edges; roughly half are unlocked
  for (let i = 0; i < 26; i++) {
    const horizontal = rng() < 0.5;
    const lane = pick(rng, city.roads);
    const along = 160 + rng() * 3250;
    const side = rng() < 0.5 ? -56 : 56;
    const car = horizontal
      ? makeCar(along, lane + side, 0, rng, { parked: true, locked: rng() < 0.45 })
      : makeCar(lane + side, along, Math.PI / 2, rng, { parked: true, locked: rng() < 0.45 });
    cars.push(car);
  }
  return cars;
}

export function updateTraffic(dt) {
  for (const car of G.cars) {
    if (!car.ai || car === (G.player && G.player.car) || car.wrecked) continue;
    if (car.pause > 0) { car.pause -= dt; stepCar(car, dt, {}); continue; }
    const nearIntersection = city.roads.some((c) => Math.abs((car.ai.horizontal ? car.x : car.y) - c) < 60);
    if (nearIntersection && Math.random() < dt * 0.5) car.pause = 0.5 + Math.random() * 0.7;
    const input = { up: carSpeed(car) < 150, down: false, left: false, right: false, drift: false };
    // turn at world edges / intersections occasionally
    if ((car.ai.horizontal && (car.x < 120 || car.x > WORLD_SIZE - 120)) || (!car.ai.horizontal && (car.y < 120 || car.y > WORLD_SIZE - 120))) {
      car.angle += Math.PI; car.ai.dir *= -1;
      car.x = clamp(car.x, 60, WORLD_SIZE - 60); car.y = clamp(car.y, 60, WORLD_SIZE - 60);
    }
    stepCar(car, dt, input);
  }
}
