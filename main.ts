// Port Solano — main.ts, the make.fun hand-in program.
// Copies the static game and its screenshots into the output directory
// (MAKEFUN_OUTPUT_DIR locally, /output on the grader) and writes the
// dossier with the kit library. Deterministic: sorted copies only, no
// clock, no randomness, no network, so both grader runs agree byte for
// byte.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
const CAPS = { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, game_max_files: 993, game_max_bytes: 50331648 };

function copyTree(name: string): void {
  const src = join(here, name);
  const dst = join(outDir, name);
  if (!existsSync(src)) throw new Error("main.ts: missing " + name + "/ next to main.ts");
  rmSync(dst, { recursive: true, force: true });
  cpSync(src, dst, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyTree("game");
copyTree("screenshots");
const dossier = buildDossier(outDir, CAPS);
writeFileSync(join(outDir, "dossier.json"), dossier);
console.log("Port Solano: wrote game/, screenshots/ and dossier.json (" + dossier.length + " bytes) to " + outDir);
