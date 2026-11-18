// Port Solano — shots.js
// Deterministic screenshot scenes (?shot=cover|chase|combat|drive&seed=1).
// Each scene rebuilds the same seeded world, then stages Reyes, traffic,
// police and gunmen so a single frame shows as many real systems as
// possible: HUD, minimap, wanted stars, a mission objective, live traffic.
// The staging only places entities — rendering and simulation are the
// game's own, so the shots are honest renders of actual play state.

import { G, showBanner } from './state.js';
import { makeCar } from './vehicles.js';
import { spawnGunman } from './combat.js';
import { startStoryMission } from './missions.js';
import { applyWanted } from './police.js';

function placePlayer(x, y, angle = -Math.PI / 2) {
  const p = G.player;
  p.x = x; p.y = y; p.angle = angle;
  p.car = null;
}

function putPlayerInCar(x, y, angle, type, color) {
  const car = makeCar(x, y, angle, type, { color });
  car.driver = 'player';
  car.parked = false;
  G.player.car = car;
  G.player.x = x; G.player.y = y;
  car.vx = Math.cos(angle) * 190;
  car.vy = Math.sin(angle) * 190;
  return car;
}

export function setupShot(name) {
  G.mode = 'playing';
  G.cash = 2450;
  G.owned.pistol = true; G.ammo.pistol = 36;
  startStoryMission(0);

  if (name === 'cover') {
    // Reyes on foot at a busy junction, traffic rolling past, the Chop Shop
    // gold marker ahead — the whole game in one frame.
    placePlayer(648, 690, -Math.PI / 2);
    G.weapon = 'pistol';
    const a = makeCar(600, 470, Math.PI / 2, 'taxi', { driver: 'traffic' });
    a.ai = { horizontal: false, fixed: 600, dir: 1, cruise: 150, turnCooldown: 9 };
    const b = makeCar(430, 600, 0, 'coupe', { driver: 'traffic' });
    b.ai = { horizontal: true, fixed: 600, dir: 1, cruise: 160, turnCooldown: 9 };
    showBanner('Port Solano', 'Meet Alba at the Chop Shop — your story starts here.');
  } else if (name === 'chase') {
    // Three stars, a gold coupe at speed, a patrol car on its tail.
    const car = putPlayerInCar(1420, 1800, 0, 'coupe', '#d9a441');
    void car;
    const cop = makeCar(1180, 1800, 0, 'cop', { isCop: true, driver: 'cop' });
    cop.vx = 210;
    makeCar(1980, 1740, Math.PI, 'sedan', { driver: 'traffic' });
    applyWanted(3);
    G.bust = 0.25;
    showBanner('Hot Cargo', 'Lose the heat — or do not get boxed in.');
  } else if (name === 'combat') {
    // Shootout outside the Armeria: Vantrek gunmen, one already down, a
    // patrol car arriving, Reyes returning fire with the pistol.
    placePlayer(2870, 1870, -0.5);
    G.weapon = 'pistol';
    G.missionIndex = 4;
    const g1 = spawnGunman(3050, 1760, {});
    const g2 = spawnGunman(3120, 1900, {});
    const g3 = spawnGunman(2980, 1690, {});
    g3.dead = true; g3.hp = 0;
    void g1; void g2;
    const cop = makeCar(2680, 1800, 0, 'cop', { isCop: true, driver: 'cop' });
    void cop;
    applyWanted(2);
    showBanner('Rival Colors', 'Break up the arms sale at the Armería.');
  } else if (name === 'drive') {
    // Cruising the beach avenue: palms, sand, the sea, traffic ahead.
    putPlayerInCar(1000, 3000, 0, 'sport', '#17bebb');
    const ahead = makeCar(1420, 3000, 0, 'sedan', { driver: 'traffic' });
    ahead.vx = 120;
    const oncoming = makeCar(1500, 2940, Math.PI, 'van', { driver: 'traffic' });
    oncoming.vx = -110;
    showBanner('Night Run', 'Finish the run at Marina Azul.');
  }
  // Snap the camera onto Reyes so the first rendered frame is the scene.
  const focus = G.player.car || G.player;
  G.camera.x = focus.x - 640;
  G.camera.y = focus.y - 400;
}
