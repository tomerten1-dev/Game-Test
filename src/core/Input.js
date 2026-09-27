// Keyboard + mouse (pointer lock) + touch controls merged into one action state.

export const DEFAULT_KEYMAP = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'jump',
  KeyR: 'reload',
  KeyE: 'interact', KeyF: 'interact',
  KeyQ: 'wall', KeyZ: 'floor', KeyV: 'ramp', KeyX: 'cone',
  KeyB: 'build', KeyG: 'edit', KeyT: 'emote', KeyH: 'ninety',
  Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3', Digit4: 'slot4', Digit5: 'slot5', Digit6: 'slot6',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  KeyC: 'crouch', ControlLeft: 'crouch',
  Escape: 'pause',
  KeyM: 'map', KeyN: 'mute',
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.held = new Set();
    this.pressedSet = new Set();
    this.lookX = 0;
    this.lookY = 0;
    this.wheel = 0;
    this.sensitivity = 0.0022;
    this.enabled = false;
    // touch-provided analog move vector (x = right, y = forward)
    this.touchMove = { x: 0, y: 0 };
    this.touchHeld = new Set();

    this.keymap = { ...DEFAULT_KEYMAP };
    this.capture = null; // callback while the settings screen waits for a key
    window.addEventListener('keydown', (e) => {
      if (this.capture) { e.preventDefault(); const cb = this.capture; this.capture = null; cb(e.code); return; }
      const a = this.keymap[e.code];
      if (!a) return;
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!this.held.has(a)) this.pressedSet.add(a);
      this.held.add(a);
    });
    window.addEventListener('keyup', (e) => {
      const a = this.keymap[e.code];
      if (a) this.held.delete(a);
    });
    window.addEventListener('blur', () => { this.held.clear(); this.touchHeld.clear(); });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (document.pointerLockElement !== canvas) { this.requestLock(); return; }
      if (e.button === 0) { this.held.add('fire'); this.pressedSet.add('fire'); }
      if (e.button === 2) { this.held.add('aim'); this.pressedSet.add('aim'); }
      if (e.button === 1) { e.preventDefault(); this.pressedSet.add('ping'); }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.held.delete('fire');
      if (e.button === 2) this.held.delete('aim');
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas) return;
      this.lookX += e.movementX;
      this.lookY += e.movementY;
    });
    window.addEventListener('wheel', (e) => {
      if (document.pointerLockElement === canvas) this.wheel += Math.sign(e.deltaY);
    }, { passive: true });
  }

  // Rebinding: `custom` maps action -> key code (from settings). Arrow keys stay as extra movement keys.
  applyBindings(custom = {}) {
    this.keymap = { ...DEFAULT_KEYMAP };
    for (const [action, code] of Object.entries(custom)) {
      for (const [c, a] of Object.entries(this.keymap)) if (a === action && !c.startsWith('Arrow')) delete this.keymap[c];
      delete this.keymap[code];
      this.keymap[code] = action;
    }
    this.held.clear();
  }

  keyFor(action) {
    return Object.keys(this.keymap).find((c) => this.keymap[c] === action && !c.startsWith('Arrow')) || '';
  }

  requestLock() {
    try {
      const p = this.canvas.requestPointerLock?.();
      if (p && p.catch) p.catch(() => {});
    } catch { /* ignore */ }
  }

  get locked() { return document.pointerLockElement === this.canvas; }

  down(a) { return this.held.has(a) || this.touchHeld.has(a); }
  pressed(a) { return this.pressedSet.has(a); }
  press(a) { this.pressedSet.add(a); }

  // x = strafe right, y = forward
  move() {
    let x = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
    let y = (this.down('forward') ? 1 : 0) - (this.down('back') ? 1 : 0);
    x += this.touchMove.x;
    y += this.touchMove.y;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }

  consumeLook() {
    const r = { x: this.lookX * this.sensitivity, y: this.lookY * this.sensitivity };
    this.lookX = 0;
    this.lookY = 0;
    return r;
  }

  consumeWheel() { const w = this.wheel; this.wheel = 0; return w; }

  endFrame() { this.pressedSet.clear(); }

  reset() { this.held.clear(); this.touchHeld.clear(); this.pressedSet.clear(); this.lookX = this.lookY = 0; this.wheel = 0; }
}
