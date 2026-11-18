// Port Solano — entrypoint for the make.fun gta6-01 competition.
// Running `node main.ts` assembles the hand-in in the output directory
// (MAKEFUN_OUTPUT_DIR, or /output on the grader): it copies the static game
// and the screenshots across, then asks the kit library to write the
// dossier that describes them. The two grader runs must produce identical
// bytes, so nothing here depends on the clock, randomness or the network —
// just the files in this repository, copied in sorted order.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

// The dossier's text budget: the kit caps the source text it embeds at
// 160 KiB, which comfortably holds Port Solano's hand-written modules.
const DOSSIER_CAPS = { text_max_bytes: 163840 };

function stageDirectory(name: string): void {
  const from = join(repoRoot, name);
  const to = join(outputDir, name);
  if (!existsSync(from)) {
    throw new Error(`main.ts: expected a ${name}/ directory beside main.ts`);
  }
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

mkdirSync(outputDir, { recursive: true });
stageDirectory("game");
stageDirectory("screenshots");

// buildDossier reads game/ and screenshots/ from the directory it is given
// and returns the exact dossier bytes; writing them untouched is what lets
// the gate's rebuild match this file byte for byte.
const dossierBytes = buildDossier(outputDir, DOSSIER_CAPS);
writeFileSync(join(outputDir, "dossier.json"), dossierBytes);

console.log(`Port Solano handed in: game/ + screenshots/ + dossier.json (${dossierBytes.length} bytes) -> ${outputDir}`);
