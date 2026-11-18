// Port Solano — state.js
// The single game-state object G. Every module reads and writes G instead of
// keeping private copies, which is what makes save/load and the deterministic
// screenshot scenes simple: rebuild G, and you rebuild the world.

import { START_MINUTES, PLAYER_MAX_HP } from './config.js';

export const G = {
  mode: 'title',            // title | playing | paused | help | busted | wasted | complete
  modeBeforePause: 'playing',
  seed: 1,
  rng: null,                // Rng instance for world generation
  fxRng: null,              // Rng instance for cosmetic randomness
  time: 0,                  // seconds since boot (always advances, drives anim)
  clock: START_MINUTES,     // in-game minutes of the day, 0..1440
  day: 1,
  cash: 120,
  wanted: 0,                // 0..5 stars
  heat: 0,                  // seconds spent unseen at current wanted level
  seenByCop: false,         // refreshed every frame by the police module
  bust: 0,                  // 0..1 bust meter; full means busted
  shake: 0,                 // screen-shake energy, decays in effects
  slowmo: 1,

  camera: { x: 0, y: 0 },
  mouse: { x: 0, y: 0, wx: 0, wy: 0, down: false },

  player: null,             // built by resetPlayer below
  cars: [],                 // every vehicle: traffic, parked, police, player's
  peds: [],
  officers: [],             // police on foot (high wanted levels)
  gunmen: [],               // hostile shooters (missions / rival crew)
  bullets: [],
  particles: [],
  skids: [],
  texts: [],                // floating world-space labels (cash, damage)
  buildings: [],
  palms: [],
  zones: [],
  reports: [],              // witness reports waiting for the police module

  weapon: 'fists',
  owned: { fists: true, pistol: false, smg: false },
  ammo: { pistol: 0, smg: 0 },
  fireCooldown: 0,

  missionIndex: 0,          // next story mission to offer
  mission: null,            // active mission instance {def, step, data}
  courier: null,            // active courier run {x, y, reward, timeLeft}
  storyDone: false,
  banner: null,             // {title, sub, t} objective banner
  toasts: [],               // small stacked notifications, newest last
  postcards: [],            // collected city-moment names

  stats: { stolen: 0, knockdowns: 0, shotsFired: 0, missionsDone: 0, earned: 0 },
  commitCrime: null,        // installed by police.js (avoids an import cycle)
  autosaveT: 0,
};

export function resetPlayer(x, y) {
  G.player = {
    x, y, r: 11, angle: -Math.PI / 2, hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP,
    car: null,              // vehicle object while driving
    breakIn: null,          // {car, t} while forcing a locked door
    walkPhase: 0,
    dead: false,
  };
  return G.player;
}

export function toast(text, color = '#ffd75e') {
  G.toasts.push({ text, color, t: 0, life: 3.4 });
  if (G.toasts.length > 4) G.toasts.shift();
}

export function showBanner(title, sub = '') {
  G.banner = { title, sub, t: 0, life: 4.2 };
}

export function addCash(amount, x = null, y = null) {
  G.cash += amount;
  if (amount > 0) G.stats.earned += amount;
  if (x !== null) {
    G.texts.push({ x, y, text: (amount >= 0 ? '+$' : '-$') + Math.abs(amount), color: amount >= 0 ? '#7be495' : '#ff8a7a', t: 0, life: 1.4 });
  }
}

export function formatClock(minutes) {
  const m = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return hh + ':' + mm;
}
