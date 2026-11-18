// Port Solano — shots.js
// Deterministic screenshot scenes for ?shot=<name>&seed=1. Each scene
// poses the live game (never a fake render): the cover on foot downtown,
// a four-star chase under the PD helicopter, a gun-shop shootout, and a
// beach-avenue drive.

import { G, banner } from "./state.js";
import { makeRng } from "./random.js";
import { makeCar } from "./vehicles.js";
import { makeGunman } from "./combat.js";
import { enterCar } from "./player.js";
import { startStoryMission } from "./missions.js";

export function setupShot(name) {
  const pl = G.player;
  const rng = makeRng(99);
  if (name === "cover") {
    pl.x = 1000; pl.y = 1040; pl.angle = 0.4;
    startStoryMission(0);
    banner("Port Solano — Alba's Chop Shop run");
  } else if (name === "chase") {
    pl.x = 1800; pl.y = 1800;
    const car = makeCar(1800, 1800, -0.4, rng, {});
    car.color = "#e8b13a"; G.cars.push(car); enterCar(car);
    car.vx = 190; car.vy = -60;
    G.heat = 95;
    banner("Four stars — PD helicopter overhead");
    G.heli = { x: pl.x - 150, y: pl.y - 170, angle: 0.8 };
    for (const [ox, oy] of [[-170, 90], [-260, -40]]) {
      const copCar = makeCar(pl.x + ox, pl.y + oy, -0.4, rng, { cop: true, color: "#f4f6f8" });
      copCar.copAI = { officerOut: false, officer: null, shootCd: 0 };
      G.cars.push(copCar); G.cops.push(copCar);
    }
  } else if (name === "combat") {
    pl.x = 1880; pl.y = 1900; pl.angle = 0.2;
    G.weapons.pistol = true; G.ammo.pistol = 42; G.weapon = "pistol";
    G.gunmen = [makeGunman(1980, 1840), makeGunman(2030, 1920), makeGunman(1960, 1980)];
    G.gunmen[2].dead = true; G.gunmen[2].hp = 0;
    G.mission = { def: { title: "Rival Colors", reward: 2000, steps: [{ type: "fight", x: 2050, y: 1800, count: 3, label: "Clear the Vantrek crew" }] }, index: 4, step: 0, kind: "story" };
    banner("Rival Colors — clear the Vantrek crew");
  } else if (name === "drive") {
    pl.x = 2900; pl.y = 3060;
    const car = makeCar(2900, 3060, 0, rng, {});
    car.color = "#3d7bd9"; G.cars.push(car); enterCar(car);
    car.vx = 230; car.vy = 0;
    banner("Beach avenue — Marina Azul ahead");
  }
  G.mode = "playing";
}
