// Port Solano — serve.ts, a zero-dependency static server for local play.
// Run `node serve.ts` and open http://localhost:8080 — it serves the files
// under game/ exactly as they ship, with no build step in between.

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const gameDir = join(dirname(fileURLToPath(import.meta.url)), "game");
const PORT = 8080;
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

createServer((req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    let rel = decodeURIComponent(url.pathname);
    if (rel === "/") rel = "/index.html";
    const file = normalize(join(gameDir, rel));
    if (!file.startsWith(gameDir) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
      return;
    }
    res.writeHead(200, { "content-type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(readFileSync(file));
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("error: " + String(err));
  }
}).listen(PORT, () => console.log("Port Solano dev server listening on http://localhost:" + PORT));
