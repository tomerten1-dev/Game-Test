import { RARITIES } from '../weapons/WeaponDefs.js';
import { Minimap } from './Minimap.js';
import { TOWNS } from '../world/Terrain.js';
import { AMMO } from '../weapons/Items.js';

const fmtTime = (s) => {
  s = Math.max(0, Math.ceil(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// DOM heads-up display. Built once; update() writes only changed values.
export class HUD {
  constructor(root, game) {
    this.game = game;
    this.root = root;
    root.insertAdjacentHTML('beforeend', `
      <div id="hud" class="hidden">
        <div class="vignette"></div>
        <div id="speedlines"></div>
        <div id="storm-tint"></div>
        <div id="hurt-flash"></div>
        <div id="dmg-dir"><i></i></div>
        <div id="crosshair">
          <i class="ch t"></i><i class="ch b"></i><i class="ch l"></i><i class="ch r"></i><i class="dot"></i>
          <div id="hitmarker"><i></i><i></i><i></i><i></i></div>
        </div>
        <div id="banner"></div>
        <div id="prompt" class="hidden"><span class="key">E</span><span id="prompt-text"></span></div>
        <div id="toast"></div>
        <div id="reload-ring" class="hidden"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16"/></svg><span id="ring-label">RELOADING</span></div>
        <div id="pickup-notes"></div>

        <div id="killfeed"></div>

        <div id="top-right">
          <div id="minimap-wrap"><canvas id="minimap"></canvas></div>
          <div id="stats">
            <div class="stat" title="Players left"><span class="ico ico-players"></span><span id="st-alive">20</span></div>
            <div class="stat" title="Eliminations"><span class="ico ico-kills"></span><span id="st-kills">0</span></div>
            <div class="stat storm" title="Storm"><span class="ico ico-storm"></span><span id="st-storm">0:00</span></div>
          </div>
          <div id="storm-label"></div>
        </div>

        <div id="bottom-left">
          <div class="bar-row shield"><span class="bar-ico">⛊</span><div class="bar"><div class="fill" id="shield-fill"></div></div><span class="bar-num" id="shield-num">0</span></div>
          <div class="bar-row health"><span class="bar-ico">✚</span><div class="bar"><div class="fill" id="health-fill"></div></div><span class="bar-num" id="health-num">100</span></div>
        </div>

        <div id="bottom-right">
          <div id="ammo"><span id="ammo-cur">0</span><span id="ammo-max">/0</span></div>
          <div id="weapon-name"></div>
          <div id="build-bar" class="hidden">
            <div class="build-pieces">
              <div class="bp" data-p="wall"><span class="key">Q</span><i class="bp-ico wall"></i><b>Wall</b></div>
              <div class="bp" data-p="floor"><span class="key">Z</span><i class="bp-ico floor"></i><b>Floor</b></div>
              <div class="bp" data-p="ramp"><span class="key">V</span><i class="bp-ico ramp"></i><b>Ramp</b></div>
              <div class="bp" data-p="cone"><span class="key">X</span><i class="bp-ico cone"></i><b>Cone</b></div>
            </div>
            <div class="build-hint">Click: place · Right-click: material · G: edit · 1–6: exit</div>
          </div>
          <div id="slots"></div>
          <div id="mats">
            <div class="mat" data-m="wood" title="Wood"><span class="mat-icon wood"></span><span id="mat-wood">0</span></div>
            <div class="mat" data-m="stone" title="Stone"><span class="mat-icon stone"></span><span id="mat-stone">0</span></div>
            <div class="mat" data-m="metal" title="Metal"><span class="mat-icon metal"></span><span id="mat-metal">0</span></div>
          </div>
        </div>
      </div>`);
    const $ = (s) => root.querySelector(s);
    this.el = {
      hud: $('#hud'), crosshair: $('#crosshair'), hitmarker: $('#hitmarker'),
      ammoCur: $('#ammo-cur'), ammoMax: $('#ammo-max'), weaponName: $('#weapon-name'), slots: $('#slots'),
      reload: $('#reload-ring'), reloadCircle: $('#reload-ring circle'), stormTint: $('#storm-tint'), hurt: $('#hurt-flash'),
      banner: $('#banner'), prompt: $('#prompt'), promptText: $('#prompt-text'), toast: $('#toast'), ringLabel: $('#ring-label'), notes: $('#pickup-notes'),
      mats: { wood: $('#mat-wood'), stone: $('#mat-stone'), metal: $('#mat-metal') },
      killfeed: $('#killfeed'), alive: $('#st-alive'), kills: $('#st-kills'), storm: $('#st-storm'), stormLabel: $('#storm-label'),
      shieldFill: $('#shield-fill'), shieldNum: $('#shield-num'), healthFill: $('#health-fill'), healthNum: $('#health-num'),
      dmgDir: $('#dmg-dir'),
      speed: $('#speedlines'),
    };
    this.el.slots.innerHTML = [0, 1, 2, 3, 4, 5].map((i) => `<div class="slot${i === 0 ? ' pick' : ''}" data-slot="${i}"><span class="key">${i + 1}</span><span class="icon"></span><span class="count"></span></div>`).join('');
    this.slotEls = [...this.el.slots.querySelectorAll('.slot')];
    this.buildBar = $('#build-bar');
    this.bpEls = [...root.querySelectorAll('.bp')];
    this.matEls = [...root.querySelectorAll('#mats .mat')];
    this.bpEls.forEach((el) => el.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.game.input.press(el.dataset.p); }));
    this.matEls.forEach((el) => el.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (this.game.player) this.game.player.buildMat = el.dataset.m; }));
    this.slotEls.forEach((s) => s.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.game.player?.switchSlot(+s.dataset.slot); }));
    this.minimap = new Minimap($('#minimap'), game);
    window.addEventListener('resize', () => this.minimap.resize());
    this.cache = {};
    this.hitT = 0;
    this.mapT = 0;
    this.dirT = 0;
    this.currentTown = null;
  }

  show(v) {
    this.el.hud.classList.toggle('hidden', !v);
    if (v) requestAnimationFrame(() => this.minimap.resize());
  }

  reset() {
    this.el.killfeed.innerHTML = '';
    this.cache = {};
    this.currentTown = null;
    this.el.stormTint.classList.remove('on');
  }

  set(key, el, value, prop = 'textContent') {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    el[prop] = value;
  }

  hitMarker(head, kill) {
    const hm = this.el.hitmarker;
    hm.className = 'show' + (head ? ' head' : '') + (kill ? ' kill' : '');
    this.hitT = kill ? 0.35 : 0.18;
  }

  hurt(attacker) {
    this.el.hurt.classList.remove('on');
    void this.el.hurt.offsetWidth;
    this.el.hurt.classList.add('on');
    if (attacker && attacker.pos) {
      this.dirSource = attacker.pos.clone();
      this.dirT = 1.2;
    }
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

  // Small stacked notes for auto-picked ammo / materials.
  pickupNote(text, color = '#fff') {
    const n = document.createElement('div');
    n.className = 'pnote';
    n.textContent = text;
    n.style.color = color;
    this.el.notes.prepend(n);
    while (this.el.notes.children.length > 4) this.el.notes.lastChild.remove();
    setTimeout(() => n.classList.add('fade'), 1800);
    setTimeout(() => n.remove(), 2300);
  }

  stormTint(on) {
    if (this.cache.stormOn === on) return;
    this.cache.stormOn = on;
    this.el.stormTint.classList.toggle('on', on);
  }

  killFeed(killer, victim) {
    const row = document.createElement('div');
    row.className = 'kf-row' + (victim.isPlayer || killer?.isPlayer ? ' me' : '');
    const name = (a) => `<b style="color:${a.isPlayer ? '#20e6c9' : '#' + a.color.getHexString()}">${a.isPlayer ? 'You' : a.name}</b>`;
    if (victim.deathCause === 'fall') row.innerHTML = `${name(victim)} <span>fell to their death</span>`;
    else if (!killer || killer === victim) row.innerHTML = `${name(victim)} <span>was lost in the storm</span>`;
    else {
      const w = killer.weapon;
      row.innerHTML = `${name(killer)} <span class="kf-w" style="color:${w ? RARITIES[w.rarity].color : '#fff'}">${w ? w.def.icon : '⛏'}</span> ${name(victim)}`;
    }
    this.el.killfeed.prepend(row);
    while (this.el.killfeed.children.length > 5) this.el.killfeed.lastChild.remove();
    setTimeout(() => row.classList.add('fade'), 5000);
    setTimeout(() => row.remove(), 5600);
    if (killer?.isPlayer && victim !== killer) this.banner(`Eliminated ${victim.name}`, 2);
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    if (!p) return;
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) this.el.hitmarker.className = ''; }
    const w = p.weapon;

    // crosshair gap follows current spread
    const moving = Math.hypot(p.vel.x, p.vel.z) > 1.5;
    const spread = w ? w.spread(moving, !p.onGround, { crouched: p.crouched, still: !moving, now: g.time }) : 0.02;
    const px = Math.min(90, Math.round(6 + (spread / Math.tan((g.camera.fov * Math.PI) / 360)) * window.innerHeight * 0.5));
    if (this.cache.gap !== px) { this.cache.gap = px; this.el.crosshair.style.setProperty('--gap', `${px}px`); }
    this.set('chVis', this.el.crosshair.style, p.state === 'ground' && p.alive && !p.victory ? 'block' : 'none', 'display');

    const h = p.held;
    if (w) {
      const res = p.ammoFor(w.def.ammoType);
      this.set('ammoCur', this.el.ammoCur, String(w.ammo));
      this.set('ammoMax', this.el.ammoMax, `/${res === Infinity ? '∞' : res}`);
      this.set('wname', this.el.weaponName, w.name);
      this.set('wcol', this.el.weaponName.style, RARITIES[w.rarity].color, 'color');
    } else {
      this.set('ammoCur', this.el.ammoCur, h?.isConsumable ? String(h.count) : '–');
      this.set('ammoMax', this.el.ammoMax, '');
      this.set('wname', this.el.weaponName, h ? h.name : 'Unarmed');
      this.set('wcol', this.el.weaponName.style, h?.isConsumable ? h.def.color : '#ffffff', 'color');
    }
    this.slotEls.forEach((s, i) => {
      const it = p.items[i];
      const sig = `${it ? it.type + (it.rarity ?? '') + (it.count ?? '') : ''}|${i === p.slot}`;
      if (this.cache['slot' + i] === sig) return;
      this.cache['slot' + i] = sig;
      s.classList.toggle('active', i === p.slot);
      const col = !it ? 'rgba(255,255,255,0.15)' : it.isGun ? RARITIES[it.rarity].color : it.isConsumable ? it.def.color : '#e8d7b0';
      s.style.setProperty('--rar', col);
      s.querySelector('.icon').textContent = !it ? '' : it.isGun ? it.def.icon : it.isConsumable ? it.def.icon : '⛏';
      s.querySelector('.count').textContent = it?.isConsumable ? String(it.count) : '';
    });
    for (const k of ['wood', 'stone', 'metal']) this.set('mat' + k, this.el.mats[k], String(p.mats[k]));
    const bm = p.buildMode || '';
    if (this.cache.bm !== bm) {
      this.cache.bm = bm;
      this.buildBar.classList.toggle('hidden', !bm);
      this.el.slots.classList.toggle('dim', !!bm);
      this.bpEls.forEach((el) => el.classList.toggle('active', el.dataset.p === bm));
    }
    if (this.cache.bmat !== p.buildMat) {
      this.cache.bmat = p.buildMat;
      this.matEls.forEach((el) => el.classList.toggle('sel', el.dataset.m === p.buildMat));
    }
    const rl = w?.reloading, using = p.useT > 0 && p.useItem;
    this.el.reload.classList.toggle('hidden', !rl && !using);
    if (rl) {
      this.set('ring', this.el.ringLabel, 'RELOADING');
      this.el.reloadCircle.style.strokeDashoffset = String(100.5 * (w.reloadT / w.def.reload));
    } else if (using) {
      this.set('ring', this.el.ringLabel, `USING ${p.useItem.def.name.toUpperCase()}`);
      this.el.reloadCircle.style.strokeDashoffset = String(100.5 * (p.useT / p.useItem.def.time));
    }

    // speed lines while skydiving
    const sl = p.state === 'skydive' ? Math.min(1, -p.vel.y / 30) : p.state === 'glide' ? 0.25 : 0;
    const slq = Math.round(sl * 20) / 20;
    if (this.cache.sl !== slq) { this.cache.sl = slq; this.el.speed.style.opacity = String(slq); }

    // health / shield
    const hp = Math.ceil(p.health), sh = Math.ceil(p.shield);
    this.set('hpw', this.el.healthFill.style, `${Math.min(100, hp)}%`, 'width');
    this.set('hpn', this.el.healthNum, String(hp));
    this.set('shw', this.el.shieldFill.style, `${Math.min(100, sh)}%`, 'width');
    this.set('shn', this.el.shieldNum, String(sh));

    // stats
    this.set('alive', this.el.alive, String(g.aliveCount));
    this.set('kills', this.el.kills, String(p.kills));
    const storm = g.storm;
    this.set('storm', this.el.storm, storm.stage === 'done' ? '0:00' : fmtTime(storm.timer));
    this.set('stormLabel', this.el.stormLabel, storm.stage === 'done' ? 'Final circle' : storm.stage === 'wait' ? `Storm shrinks in ${fmtTime(storm.timer)}` : 'Storm is shrinking!');
    this.set('stormCls', this.el.stormLabel, storm.stage === 'shrink' ? 'urgent' : '', 'className');

    // damage direction indicator
    if (this.dirT > 0) {
      this.dirT -= dt;
      const dx = this.dirSource.x - p.pos.x, dz = this.dirSource.z - p.pos.z;
      const yaw = g.rig.yaw;
      // angle relative to where the camera looks (0 = in front)
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const ang = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
      this.el.dmgDir.style.transform = `rotate(${ang}rad)`;
      this.el.dmgDir.style.opacity = String(Math.min(1, this.dirT * 1.5));
    } else if (this.cache.dirOff !== true) {
      this.el.dmgDir.style.opacity = '0';
    }

    // entering towns
    if (p.state === 'ground' && p.alive) {
      let town = null;
      for (const t of TOWNS) if (Math.hypot(p.pos.x - t.x, p.pos.z - t.z) < t.r) town = t;
      if (town && town !== this.currentTown) this.banner(town.name, 2.5);
      this.currentTown = town;
    }

    this.mapT -= dt;
    if (this.mapT <= 0) { this.mapT = 1 / 20; this.minimap.draw(); }
  }
}
