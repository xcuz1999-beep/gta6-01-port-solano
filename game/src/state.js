// Port Solano — state.js
// The single shared game-state object. Every system reads and writes G;
// keeping it in one module avoids import cycles and makes save/load easy.

export const G = {
  mode: "title", // title | playing | paused | busted | wasted | complete | help
  time: 0,
  clock: 0.32, // 0..1 day cycle, starts mid-morning
  seed: 1,
  cash: 120,
  heat: 0,
  wanted: 0,
  seenTimer: 0,
  bust: 0,
  shake: 0,
  muted: false,
  player: null,
  cars: [],
  peds: [],
  cops: [],
  gunmen: [],
  bullets: [],
  particles: [],
  floaters: [],
  skids: [],
  mission: null,
  storyIndex: 0,
  courierCount: 0,
  weapons: { pistol: false, smg: false },
  ammo: { pistol: 0, smg: 0 },
  weapon: "fists",
  postcards: [],
  message: "",
  messageTimer: 0,
  banner: "",
  bannerTimer: 0,
  breakIn: null,
  heli: null,
  radio: 0,
  shopTimer: 0,
};

export function toast(text, seconds = 3.2) {
  G.message = text;
  G.messageTimer = seconds;
}

export function banner(text, seconds = 4) {
  G.banner = text;
  G.bannerTimer = seconds;
}

export function earnPostcard(id, label) {
  if (G.postcards.includes(id)) return;
  G.postcards.push(id);
  toast("Postcard found: " + label);
}
