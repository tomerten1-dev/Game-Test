// On-screen controls for touch devices: floating joystick, look-drag area and action buttons.
export class TouchControls {
  constructor(root, input, game) {
    this.input = input;
    this.game = game;
    root.insertAdjacentHTML('beforeend', `
      <div id="touch" class="hidden">
        <div id="stick-zone"></div>
        <div id="look-zone"></div>
        <div id="stick"><div id="stick-knob"></div></div>
        <div id="tbtns">
          <button class="tbtn fire" data-a="fire">FIRE</button>
          <button class="tbtn jump" data-a="jump">JUMP</button>
          <button class="tbtn reload" data-a="reload">R</button>
          <button class="tbtn use" data-a="interact">USE</button>
          <button class="tbtn wall" data-a="wall">WALL</button>
          <button class="tbtn ramp" data-a="ramp">RAMP</button>
          <button class="tbtn crouch" data-a="crouch">▼</button>
          <button class="tbtn floor" data-a="floor">FLOOR</button>
          <button class="tbtn cone" data-a="cone">CONE</button>
          <button class="tbtn mat" data-a="buildmat">MAT</button>
          <button class="tbtn edit" data-a="edit">EDIT</button>
          <button class="tbtn emote" data-a="emote">♪</button>
        </div>
      </div>`);
    this.el = root.querySelector('#touch');
    this.stick = root.querySelector('#stick');
    this.knob = root.querySelector('#stick-knob');
    this.stickId = null;
    this.lookIds = new Map();
    this.lookSens = 0.0055;

    const zone = root.querySelector('#stick-zone');
    zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      if (this.stickId !== null) return;
      this.stickId = t.identifier;
      this.origin = { x: t.clientX, y: t.clientY };
      this.stick.style.left = `${t.clientX}px`;
      this.stick.style.top = `${t.clientY}px`;
      this.stick.classList.add('on');
      this._stickMove(t);
    }, { passive: false });

    const look = root.querySelector('#look-zone');
    look.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) this.lookIds.set(t.identifier, { x: t.clientX, y: t.clientY });
    }, { passive: false });

    // buttons (fire also works as a look pad while held)
    for (const b of root.querySelectorAll('.tbtn')) {
      const a = b.dataset.a;
      b.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        b.classList.add('down');
        input.press(a);
        if (a === 'fire' || a === 'jump') input.touchHeld.add(a);
        if (a === 'fire') for (const t of e.changedTouches) this.lookIds.set(t.identifier, { x: t.clientX, y: t.clientY, btn: b });
      }, { passive: false });
      const up = (e) => {
        e.preventDefault();
        b.classList.remove('down');
        input.touchHeld.delete(a);
      };
      b.addEventListener('touchend', up, { passive: false });
      b.addEventListener('touchcancel', up, { passive: false });
    }

    window.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stickId) this._stickMove(t);
        const l = this.lookIds.get(t.identifier);
        if (l) {
          input.lookX += ((t.clientX - l.x) * this.lookSens) / input.sensitivity;
          input.lookY += ((t.clientY - l.y) * this.lookSens) / input.sensitivity;
          l.x = t.clientX; l.y = t.clientY;
        }
      }
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stickId) {
          this.stickId = null;
          input.touchMove.x = input.touchMove.y = 0;
          this.stick.classList.remove('on');
          this.knob.style.transform = 'translate(-50%, -50%)';
        }
        this.lookIds.delete(t.identifier);
      }
    };
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
  }

  _stickMove(t) {
    const R = 55;
    let dx = t.clientX - this.origin.x, dy = t.clientY - this.origin.y;
    const l = Math.hypot(dx, dy);
    if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    this.input.touchMove.x = dx / R;
    this.input.touchMove.y = -dy / R;
  }

  show(v) { this.el.classList.toggle('hidden', !v); }
}
