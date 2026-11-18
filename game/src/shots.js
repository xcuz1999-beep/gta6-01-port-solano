// Port Solano — shots.js
// Deterministic screenshot scenes for ?shot=<name>&seed=1. Each scene
// poses the live game (never a fake render): the cover on foot downtown,
// a three-star chase, a gun-shop shootout, and a beach-avenue drive.

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
    G.heat = 60;
    banner("Three stars — lose the Solano PD");
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
