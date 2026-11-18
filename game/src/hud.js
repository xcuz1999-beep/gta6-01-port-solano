// Port Solano — hud.js
// Heads-up display drawn on the canvas: cash, clock, health, weapon and
// wanted stars across the top, a live minimap in the corner, the mission
// banner and objective line, and every full-screen menu (title, pause,
// help, busted, wasted, story complete).

import { WORLD_SIZE, WEAPONS, ZONES } from "./config.js";
import { G } from "./state.js";
import { city } from "./city.js";
import { missionMarker, STORY } from "./missions.js";
import { STATION_NAMES } from "./audio.js";
import { dist } from "./random.js";

function starsText() {
  let s = "";
  for (let i = 0; i < 5; i++) s += i < G.wanted ? "★" : "☆";
  return s;
}

function clockText() {
  const mins = Math.floor(G.clock * 24 * 60);
  const hh = String(Math.floor(mins / 60)).padStart(2, "0");
  const mm = String(mins % 60).padStart(2, "0");
  return hh + ":" + mm;
}

export function drawMinimap(ctx, x, y, size) {
  const scale = size / WORLD_SIZE;
  ctx.fillStyle = "#20303c"; ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "#2e7fb8"; ctx.fillRect(x + 3380 * scale, y, 220 * scale, size); ctx.fillRect(x, y + 3380 * scale, size, 220 * scale);
  ctx.strokeStyle = "#7d8590"; ctx.lineWidth = 1;
  for (const c of city.roads) {
    ctx.beginPath(); ctx.moveTo(x + c * scale, y); ctx.lineTo(x + c * scale, y + size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + c * scale); ctx.lineTo(x + size, y + c * scale); ctx.stroke();
  }
  // named zones as colored dots with a dark outline
  for (const z of ZONES) {
    ctx.fillStyle = z.color;
    ctx.beginPath(); ctx.arc(x + z.x * scale, y + z.y * scale, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#0e141c"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x + z.x * scale, y + z.y * scale, 3, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = "#e8e8e8";
  for (const p of G.peds) ctx.fillRect(x + p.x * scale - 1, y + p.y * scale - 1, 2, 2);
  ctx.fillStyle = "#8e1f1f";
  for (const g of G.gunmen) if (!g.dead) ctx.fillRect(x + g.x * scale - 1.5, y + g.y * scale - 1.5, 3, 3);
  if (G.heli) {
    const hx = x + G.heli.x * scale, hy = y + G.heli.y * scale;
    ctx.fillStyle = "#39d5e8";
    ctx.beginPath(); ctx.moveTo(hx, hy - 3.5); ctx.lineTo(hx + 3.5, hy); ctx.lineTo(hx, hy + 3.5); ctx.lineTo(hx - 3.5, hy); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = "#d94f3d";
  for (const c of G.cars) if (!c.cop) ctx.fillRect(x + c.x * scale - 1, y + c.y * scale - 1, 3, 3);
  for (const cop of G.cops) { ctx.fillStyle = "#4da3ff"; ctx.fillRect(x + cop.x * scale - 2, y + cop.y * scale - 2, 4, 4); }
  const mark = missionMarker();
  if (mark) {
    const pulse = 3 + Math.sin(G.time * 5) * 1.2;
    ctx.fillStyle = "#ffd34d"; ctx.beginPath(); ctx.arc(x + mark.x * scale, y + mark.y * scale, pulse, 0, Math.PI * 2); ctx.fill();
  }
  const pl = G.player;
  if (pl) {
    ctx.save(); ctx.translate(x + pl.x * scale, y + pl.y * scale); ctx.rotate(pl.angle);
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = "#0e141c"; ctx.strokeRect(x, y, size, size);
}

export function drawHUD(ctx, w, h) {
  const pl = G.player; if (!pl) return;
  ctx.fillStyle = "rgba(10,16,24,0.72)"; ctx.fillRect(0, 0, w, 52);
  ctx.fillStyle = "#7ee787"; ctx.font = "bold 22px sans-serif"; ctx.textAlign = "left";
  ctx.fillText("$" + G.cash, 16, 35);
  ctx.fillStyle = "#f2f2f2"; ctx.font = "16px sans-serif";
  ctx.fillText(clockText(), 130, 34);
  const wname = WEAPONS[G.weapon].name;
  const ammo = G.weapon === "fists" ? "" : "  " + G.ammo[G.weapon];
  ctx.fillText(wname + ammo, 210, 34);
  if (pl.car) {
    const kmh = Math.round(Math.hypot(pl.car.vx, pl.car.vy) * 0.36);
    ctx.fillStyle = "#ffd34d"; ctx.font = "bold 16px sans-serif";
    ctx.fillText(kmh + " km/h", 330, 34);
    ctx.fillStyle = "#40151c"; ctx.fillRect(330, 40, 90, 5);
    ctx.fillStyle = "#e8b13a"; ctx.fillRect(330, 40, 90 * Math.max(0, pl.car.hp / 100), 5);
    if (G.radio > 0) {
      ctx.fillStyle = "#9be7ff"; ctx.font = "14px sans-serif"; ctx.textAlign = "left";
      ctx.fillText("♪ " + STATION_NAMES[G.radio], 440, 34);
    }
  }
  ctx.fillStyle = "#ffd34d"; ctx.font = "22px sans-serif"; ctx.textAlign = "right";
  ctx.fillText(starsText(), w - 16, 35);
  // health bar
  ctx.fillStyle = "#40151c"; ctx.fillRect(16, h - 26, 190, 13);
  ctx.fillStyle = pl.hp > 30 ? "#57d977" : "#e5484d"; ctx.fillRect(16, h - 26, 190 * Math.max(0, pl.hp / pl.maxHp), 13);
  ctx.fillStyle = "#fff"; ctx.font = "11px sans-serif"; ctx.textAlign = "left";
  ctx.fillText("REYES — PORT SOLANO", 18, h - 30);
  if (G.bust > 0.02) {
    ctx.fillStyle = "#40151c"; ctx.fillRect(w / 2 - 110, 64, 220, 14);
    ctx.fillStyle = "#e5484d"; ctx.fillRect(w / 2 - 110, 64, 220 * G.bust, 14);
    ctx.fillStyle = "#fff"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("BUSTED?", w / 2, 60);
  }
  if (G.breakIn) {
    ctx.fillStyle = "#fff"; ctx.font = "bold 15px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Breaking in… hold E", w / 2, h - 90);
    ctx.fillStyle = "#ffd34d"; ctx.fillRect(w / 2 - 70, h - 82, 140 * (G.breakIn.t / G.breakIn.need), 7);
  }
  if (G.bannerTimer > 0) {
    ctx.fillStyle = "rgba(10,16,24,0.8)"; ctx.fillRect(w / 2 - 300, 66, 600, 34);
    ctx.fillStyle = "#ffd34d"; ctx.font = "bold 18px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(G.banner, w / 2, 89);
  }
  const mark = missionMarker();
  if (mark) {
    ctx.fillStyle = "rgba(10,16,24,0.66)"; ctx.fillRect(14, 62, 430, 28);
    ctx.fillStyle = "#ffe9a3"; ctx.font = "14px sans-serif"; ctx.textAlign = "left";
    const objective = mark.title
      ? "» " + mark.title + " — " + mark.label + "  (" + Math.round(dist(pl.x, pl.y, mark.x, mark.y)) + "m)"
      : "» " + mark.label + "  (" + Math.round(dist(pl.x, pl.y, mark.x, mark.y)) + "m)";
    ctx.fillText(objective, 22, 81);
    // off-screen direction arrow
    const sx = pl.x, sy = pl.y;
    if (Math.abs(mark.x - sx) > 420 || Math.abs(mark.y - sy) > 300) {
      const a = Math.atan2(mark.y - sy, mark.x - sx);
      const ax = w / 2 + Math.cos(a) * 120, ay = h / 2 + Math.sin(a) * 90;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
      ctx.fillStyle = "#ffd34d"; ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(-8, -7); ctx.lineTo(-8, 7); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  if (G.messageTimer > 0) {
    ctx.fillStyle = "rgba(10,16,24,0.78)";
    const tw = ctx.measureText(G.message).width + 30;
    ctx.fillRect(w / 2 - tw / 2, h - 64, tw, 30);
    ctx.fillStyle = "#fff"; ctx.font = "15px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(G.message, w / 2, h - 44);
  }
  drawMinimap(ctx, w - 182, h - 182, 168);
}

function overlay(ctx, w, h, title, lines, accent = "#ffd34d") {
  ctx.fillStyle = "rgba(8,12,20,0.78)"; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = accent; ctx.font = "bold 44px sans-serif"; ctx.textAlign = "center";
  ctx.fillText(title, w / 2, h / 2 - 90);
  ctx.fillStyle = "#f2f2f2"; ctx.font = "17px sans-serif";
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h / 2 - 40 + i * 26));
}

export function drawScreens(ctx, w, h) {
  if (G.mode === "title") overlay(ctx, w, h, "PORT SOLANO", ["Reyes is back. Alba needs wheels, Bruno Vane needs a lesson.", "", "N — New Game      C — Continue      H — Help", "WASD move · E enter car · mouse aim · click/F fight · M mute"], "#ffcf5c");
  else if (G.mode === "paused") overlay(ctx, w, h, "PAUSED", ["Esc — Resume", "S — Save game", "H — Controls", "R — Restart run", "", "Story: " + Math.min(G.storyIndex, STORY.length) + "/" + STORY.length + " missions · Postcards: " + G.postcards.length + "/7"]);
  else if (G.mode === "help") overlay(ctx, w, h, "CONTROLS", ["WASD / arrows — move & drive", "E — enter / exit car (hold E to break into locked cars)", "Space — handbrake drift · Shift — sprint", "Mouse — aim · click or F — punch / shoot", "1 / 2 / 3 — fists / pistol / SMG", "Esc — pause · M — mute · gold marker — objective"], "#7fd6a4");
  else if (G.mode === "busted") overlay(ctx, w, h, "BUSTED", ["The Solano PD took you in and fined you $150.", "Press Enter to get back on the street."], "#e5484d");
  else if (G.mode === "wasted") overlay(ctx, w, h, "WASTED", ["Clinica del Sol patched you up for $100.", "Press Enter to leave the clinic."], "#e5484d");
  else if (G.mode === "complete") overlay(ctx, w, h, "SOLANO IS YOURS", ["Bruno Vane is gone and Alba's yard is safe.", "Story complete — courier runs are open at any zone marker.", "Press Enter to keep cruising Port Solano."], "#7ee787");
}
