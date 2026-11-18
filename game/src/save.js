// Port Solano — save.js
// localStorage persistence: position, cash, health, story progress,
// owned weapons and ammo, and collected postcards. Autosaves whenever a
// mission ends; Continue on the title screen reads it back.

import { SAVE_KEY } from "./config.js";
import { G } from "./state.js";

export function saveGame() {
  const pl = G.player; if (!pl) return false;
  try {
    const data = {
      x: pl.x, y: pl.y, hp: pl.hp, cash: G.cash,
      storyIndex: G.storyIndex, courierCount: G.courierCount,
      weapons: G.weapons, ammo: G.ammo, postcards: G.postcards, clock: G.clock,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function hasSave() { return loadGame() !== null; }

export function applySave(data) {
  if (!data || !G.player) return false;
  G.player.x = data.x ?? G.player.x;
  G.player.y = data.y ?? G.player.y;
  G.player.hp = data.hp ?? 100;
  G.cash = data.cash ?? 120;
  G.storyIndex = data.storyIndex ?? 0;
  G.courierCount = data.courierCount ?? 0;
  G.weapons = data.weapons ?? G.weapons;
  G.ammo = data.ammo ?? G.ammo;
  G.postcards = data.postcards ?? [];
  G.clock = data.clock ?? 0.32;
  return true;
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* private mode */ }
}
