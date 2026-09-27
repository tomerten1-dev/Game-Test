import { RARITIES } from '../weapons/WeaponDefs.js';

// DOM heads-up display. Built once; update() writes only changed values.
export class HUD {
  constructor(root, game) {
    this.game = game;
    this.root = root;
    root.insertAdjacentHTML('beforeend', `
      <div id="hud" class="hidden">
        <div class="vignette"></div>
        <div id="storm-tint"></div>
        <div id="hurt-flash"></div>
        <div id="crosshair">
          <i class="ch t"></i><i class="ch b"></i><i class="ch l"></i><i class="ch r"></i><i class="dot"></i>
          <div id="hitmarker"><i></i><i></i><i></i><i></i></div>
        </div>
        <div id="banner"></div>
        <div id="prompt" class="hidden"><span class="key">E</span><span id="prompt-text"></span></div>
        <div id="toast"></div>
        <div id="reload-ring" class="hidden"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16"/></svg><span>RELOADING</span></div>
        <div id="bottom-right">
          <div id="ammo"><span id="ammo-cur">0</span><span id="ammo-max">/0</span></div>
          <div id="weapon-name"></div>
          <div id="slots"></div>
          <div id="mats"><span class="wood-icon"></span><span id="wood">0</span></div>
        </div>
      </div>`);
    this.el = {
      hud: root.querySelector('#hud'),
      crosshair: root.querySelector('#crosshair'),
      hitmarker: root.querySelector('#hitmarker'),
      ammoCur: root.querySelector('#ammo-cur'),
      ammoMax: root.querySelector('#ammo-max'),
      weaponName: root.querySelector('#weapon-name'),
      slots: root.querySelector('#slots'),
      reload: root.querySelector('#reload-ring'),
      reloadCircle: root.querySelector('#reload-ring circle'),
      stormTint: root.querySelector('#storm-tint'),
      hurt: root.querySelector('#hurt-flash'),
      banner: root.querySelector('#banner'),
      prompt: root.querySelector('#prompt'),
      promptText: root.querySelector('#prompt-text'),
      toast: root.querySelector('#toast'),
      wood: root.querySelector('#wood'),
    };
    this.el.slots.innerHTML = [0, 1, 2].map((i) => `<div class="slot" data-slot="${i}"><span class="key">${i + 1}</span><span class="icon"></span></div>`).join('');
    this.slotEls = [...this.el.slots.querySelectorAll('.slot')];
    this.slotEls.forEach((s) => s.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.game.player?.switchSlot(+s.dataset.slot); }));
    this.cache = {};
    this.hitT = 0;
  }

  show(v) { this.el.hud.classList.toggle('hidden', !v); }

  set(key, el, value, prop = 'textContent') {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    el[prop] = value;
  }

  hitMarker(head, kill) {
    const hm = this.el.hitmarker;
    hm.className = head ? 'show head' : 'show';
    if (kill) hm.className += ' kill';
    this.hitT = 0.18;
  }

  banner(text, seconds = 3) {
    const b = this.el.banner;
    b.textContent = text;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => b.classList.remove('show'), seconds * 1000);
  }

  prompt(text, rarity) {
    const key = text ? text + rarity : null;
    if (this.cache.prompt === key) return;
    this.cache.prompt = key;
    this.el.prompt.classList.toggle('hidden', !text);
    if (text) {
      this.el.promptText.textContent = text;
      this.el.promptText.style.color = rarity !== undefined ? RARITIES[rarity].color : '#fff';
    }
  }

  toast(text) {
    const t = this.el.toast;
    t.textContent = text;
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
  }

  stormTint(on) {
    if (this.cache.storm === on) return;
    this.cache.storm = on;
    this.el.stormTint.classList.toggle('on', on);
  }

  hurt() {
    this.el.hurt.classList.remove('on');
    void this.el.hurt.offsetWidth;
    this.el.hurt.classList.add('on');
  }

  update(dt) {
    const p = this.game.player;
    if (!p) return;
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) this.el.hitmarker.className = ''; }
    const w = p.weapon;
    // crosshair gap follows current spread
    const spread = w ? w.spread(Math.hypot(p.vel.x, p.vel.z) > 1.5, !p.onGround) : 0.02;
    const px = Math.round(6 + (spread / Math.tan((this.game.camera.fov * Math.PI) / 360)) * window.innerHeight * 0.5);
    if (this.cache.gap !== px) { this.cache.gap = px; this.el.crosshair.style.setProperty('--gap', `${Math.min(px, 90)}px`); }
    this.set('chVis', this.el.crosshair.style, p.state === 'ground' && p.alive ? 'block' : 'none', 'display');
    if (w) {
      this.set('ammoCur', this.el.ammoCur, String(w.ammo));
      this.set('ammoMax', this.el.ammoMax, `/${w.def.mag}`);
      this.set('wname', this.el.weaponName, w.name);
      this.set('wcol', this.el.weaponName.style, RARITIES[w.rarity].color, 'color');
    } else {
      this.set('ammoCur', this.el.ammoCur, '–');
      this.set('ammoMax', this.el.ammoMax, '');
      this.set('wname', this.el.weaponName, 'Unarmed');
    }
    this.slotEls.forEach((s, i) => {
      const sw = p.weapons[i];
      const sig = `${sw ? sw.type + sw.rarity : ''}|${i === p.slot}`;
      if (this.cache['slot' + i] === sig) return;
      this.cache['slot' + i] = sig;
      s.classList.toggle('active', i === p.slot);
      s.style.setProperty('--rar', sw ? RARITIES[sw.rarity].color : 'rgba(255,255,255,0.15)');
      s.querySelector('.icon').textContent = sw ? sw.def.icon : '';
    });
    this.set('wood', this.el.wood, String(p.wood));
    const rl = w?.reloading;
    this.el.reload.classList.toggle('hidden', !rl);
    if (rl) this.el.reloadCircle.style.strokeDashoffset = String(100.5 * (w.reloadT / w.def.reload));
  }
}
