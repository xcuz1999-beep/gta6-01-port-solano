// Port Solano — save.js
// localStorage persistence: where Reyes stands, what he carries, how far the
// story has come. Autosaves on a timer and at every mission end; the title
// screen's Continue button reads exactly what saveGame wrote.

import { SAVE_KEY } from './config.js';
import { G } from './state.js';

export function hasSave() {
  try { return !!window.localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export function saveGame() {
  const p = G.player;
  if (!p) return false;
  const data = {
    version: 1,
    x: p.car ? p.car.x : p.x,
    y: p.car ? p.car.y : p.y,
    hp: p.hp,
    cash: G.cash,
    clock: G.clock,
    day: G.day,
    weapon: G.weapon,
    owned: G.owned,
    ammo: G.ammo,
    missionIndex: G.missionIndex,
    storyDone: G.storyDone,
    postcards: G.postcards,
    stats: G.stats,
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadGame() {
  let raw = null;
  try { raw = window.localStorage.getItem(SAVE_KEY); } catch { raw = null; }
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch { return null; }
}

// Apply a loaded record to the live state. The world itself (city, traffic)
// is rebuilt from the seed by main.js; only Reyes and his progress move.
export function applySave(data) {
  const p = G.player;
  if (!p || !data) return false;
  if (p.car) { p.car.driver = null; p.car = null; }
  p.x = data.x; p.y = data.y;
  p.hp = Math.max(20, data.hp || 100);
  p.dead = false;
  G.cash = data.cash ?? G.cash;
  G.clock = data.clock ?? G.clock;
  G.day = data.day ?? 1;
  G.weapon = data.weapon || 'fists';
  G.owned = { fists: true, ...(data.owned || {}) };
  G.ammo = { pistol: 0, smg: 0, ...(data.ammo || {}) };
  G.missionIndex = data.missionIndex || 0;
  G.storyDone = !!data.storyDone;
  G.postcards = data.postcards || [];
  G.stats = { stolen: 0, knockdowns: 0, shotsFired: 0, missionsDone: 0, earned: 0, ...(data.stats || {}) };
  G.mission = null;
  G.courier = null;
  G.wanted = 0; G.heat = 0; G.bust = 0;
  return true;
}

export function wipeSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* nothing to wipe */ }
}
