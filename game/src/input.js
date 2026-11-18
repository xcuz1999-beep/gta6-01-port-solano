// Port Solano — input.js
// Keyboard and mouse state. Game code polls `keys` / `mouse` each frame and
// uses consume() for one-shot actions (enter car, pause, weapon swap) so a
// held key never retriggers them.

export const keys = new Set();
export const pressedOnce = new Set();
export const mouse = { x: 0, y: 0, down: false, rightDown: false };

let attached = false;

export function attachInput(canvas) {
  if (attached) return;
  attached = true;
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!keys.has(e.code)) pressedOnce.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) mouse.down = true; if (e.button === 2) mouse.rightDown = true; });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; if (e.button === 2) mouse.rightDown = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// True once per physical press of the given code.
export function consume(code) {
  if (pressedOnce.has(code)) { pressedOnce.delete(code); return true; }
  return false;
}

export function endFrameInput() { pressedOnce.clear(); }

// Test hooks: the self-test drives the game through the same key state a
// player would produce, never by reaching into gameplay internals.
export function setKey(code, down) {
  if (down) { if (!keys.has(code)) pressedOnce.add(code); keys.add(code); }
  else keys.delete(code);
}
export function clearKeys() { keys.clear(); pressedOnce.clear(); mouse.down = false; }
