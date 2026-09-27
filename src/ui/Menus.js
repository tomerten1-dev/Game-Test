import { isTouch } from '../core/device.js';

const DESKTOP_CONTROLS = [
  ['WASD', 'Move'], ['Mouse', 'Aim'], ['Left Click', 'Shoot'], ['Right Click', 'Zoom'],
  ['Space', 'Jump / Drop'], ['R', 'Reload'], ['E', 'Open / Pick up'], ['Q', 'Build Wall'],
  ['V', 'Build Ramp'], ['1-3 / Wheel', 'Weapons'], ['M', 'Mute'], ['Esc', 'Pause'],
];
const TOUCH_CONTROLS = [
  ['Left stick', 'Move'], ['Drag right side', 'Look'], ['FIRE', 'Hold to shoot'], ['JUMP', 'Jump / Drop'],
  ['WALL / RAMP', 'Build (10 wood)'], ['USE', 'Open / Pick up'], ['Slots', 'Tap to switch'],
];

// Start screen, pause overlay and end-of-match screens.
export class Menus {
  constructor(root, game) {
    this.game = game;
    const controls = (isTouch ? TOUCH_CONTROLS : DESKTOP_CONTROLS)
      .map(([k, v]) => `<div class="ctl"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('');
    const gfx = `<div class="gfx"><span>Graphics</span>${['auto', 'low', 'medium', 'high'].map((q) => `<button class="gfx-btn" data-q="${q}">${q[0].toUpperCase() + q.slice(1)}</button>`).join('')}</div>`;
    root.insertAdjacentHTML('beforeend', `
      <div id="menu" class="screen">
        <div class="menu-inner">
          <div class="logo"><span class="bolt">⚡</span>STORMBOUND</div>
          <div class="tagline">Drop in. Loot up. Outlast the storm.</div>
          <button id="play-btn" class="btn big">PLAY</button>
          <div class="sub">You vs 19 bots · 1 winner</div>
          ${gfx}
          <div class="controls">${controls}</div>
        </div>
      </div>
      <div id="pause" class="screen hidden">
        <div class="menu-inner small">
          <div class="logo mid">PAUSED</div>
          <button id="resume-btn" class="btn">RESUME</button>
          ${gfx}
          <div class="controls">${controls}</div>
        </div>
      </div>
      <div id="end" class="screen hidden">
        <div class="menu-inner">
          <div id="end-rank" class="rank">#1</div>
          <div id="end-title" class="logo">VICTORY</div>
          <div id="end-sub" class="tagline"></div>
          <div class="end-stats">
            <div><b id="end-kills">0</b><span>Eliminations</span></div>
            <div><b id="end-time">0:00</b><span>Time alive</span></div>
            <div><b id="end-place">#1</b><span>Placement</span></div>
          </div>
          <button id="again-btn" class="btn big">PLAY AGAIN</button>
        </div>
      </div>`);
    this.el = {
      menu: root.querySelector('#menu'), pause: root.querySelector('#pause'), end: root.querySelector('#end'),
    };
    const tap = (id, fn) => root.querySelector(id).addEventListener('click', (e) => { e.stopPropagation(); game.sound.ensure(); game.sound.play('click'); fn(); });
    tap('#play-btn', () => game.play());
    tap('#again-btn', () => game.play());
    tap('#resume-btn', () => game.resume());
    this.gfxBtns = [...root.querySelectorAll('.gfx-btn')];
    for (const b of this.gfxBtns) {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        game.quality.set(b.dataset.q);
        this.syncGfx();
      });
    }
    this.syncGfx();
  }

  syncGfx() {
    const q = this.game.quality?.setting || 'auto';
    for (const b of this.gfxBtns) b.classList.toggle('active', b.dataset.q === q);
  }

  showMenu(v) { this.el.menu.classList.toggle('hidden', !v); }
  showPause(v) { this.el.pause.classList.toggle('hidden', !v); }

  showEnd({ victory, place, killer, kills, time }) {
    const $ = (id) => document.getElementById(id);
    $('end-rank').textContent = `#${place}`;
    $('end-title').textContent = victory ? 'VICTORY!' : 'ELIMINATED';
    $('end-title').className = 'logo' + (victory ? ' gold' : ' red');
    $('end-sub').textContent = victory ? 'Last hero standing on Stormbound Island' : `Eliminated by ${killer || 'the storm'} — placed #${place}`;
    $('end-kills').textContent = kills;
    $('end-time').textContent = `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;
    $('end-place').textContent = `#${place}`;
    this.el.end.classList.toggle('victory', victory);
    this.el.end.classList.remove('hidden');
  }

  hideEnd() { this.el.end.classList.add('hidden'); }
}
