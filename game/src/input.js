// Port Solano — input.js
// Keyboard and mouse state. Systems poll `keys` and `mouse` each frame;
// edge-triggered presses are tracked in `pressed` and cleared by main.

export const keys = {};
export const pressed = {};
export const mouse = { x: 0, y: 0, down: false, wx: 0, wy: 0 };

export function bindInput(canvas, onPause) {
  addEventListener("keydown", (e) => {
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
    if (e.code === "Escape" && onPause) onPause();
  });
  addEventListener("keyup", (e) => { keys[e.code] = false; });
  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener("mousedown", () => { mouse.down = true; });
  addEventListener("mouseup", () => { mouse.down = false; });
}

export function moveAxis() {
  let x = 0, y = 0;
  if (keys.KeyA || keys.ArrowLeft) x -= 1;
  if (keys.KeyD || keys.ArrowRight) x += 1;
  if (keys.KeyW || keys.ArrowUp) y -= 1;
  if (keys.KeyS || keys.ArrowDown) y += 1;
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

export function clearPressed() {
  for (const k of Object.keys(pressed)) delete pressed[k];
}
