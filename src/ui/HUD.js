import { RARITIES } from '../weapons/WeaponDefs.js';
import { Minimap } from './Minimap.js';
import { TOWNS } from '../world/Terrain.js';

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
        <div id="reload-ring" class="hidden"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16"/></svg><span>RELOADING</span></div>

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
          <div id="slots"></div>
          <div id="mats"><span class="wood-icon"></span><span id="wood">0</span></div>
        </div>
      </div>`);
    const $ = (s) => root.querySelector(s);
    this.el = {
      hud: $('#hud'), crosshair: $('#crosshair'), hitmarker: $('#hitmarker'),
      ammoCur: $('#ammo-cur'), ammoMax: $('#ammo-max'), weaponName: $('#weapon-name'), slots: $('#slots'),
      reload: $('#reload-ring'), reloadCircle: $('#reload-ring circle'), stormTint: $('#storm-tint'), hurt: $('#hurt-flash'),
      banner: $('#banner'), prompt: $('#prompt'), promptText: $('#prompt-text'), toast: $('#toast'), wood: $('#wood'),
      killfeed: $('#killfeed'), alive: $('#st-alive'), kills: $('#st-kills'), storm: $('#st-storm'), stormLabel: $('#storm-label'),
      shieldFill: $('#shield-fill'), shieldNum: $('#shield-num'), healthFill: $('#health-fill'), healthNum: $('#health-num'),
      dmgDir: $('#dmg-dir'),
      speed: $('#speedlines'),
    };
    this.el.slots.innerHTML = [0, 1, 2].map((i) => `<div class="slot" data-slot="${i}"><span class="key">${i + 1}</span><span class="icon"></span></div>`).join('');
    this.slotEls = [...this.el.slots.querySelectorAll('.slot')];
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

  stormTint(on) {
    if (this.cache.stormOn === on) return;
    this.cache.stormOn = on;
    this.el.stormTint.classList.toggle('on', on);
  }

  killFeed(killer, victim) {
    const row = document.createElement('div');
    row.className = 'kf-row' + (victim.isPlayer || killer?.isPlayer ? ' me' : '');
    const name = (a) => `<b style="color:${a.isPlayer ? '#20e6c9' : '#' + a.color.getHexString()}">${a.isPlayer ? 'You' : a.name}</b>`;
    if (!killer || killer === victim) row.innerHTML = `${name(victim)} <span>was lost in the storm</span>`;
    else {
      const w = killer.weapon;
      row.innerHTML = `${name(killer)} <span class="kf-w" style="color:${w ? RARITIES[w.rarity].color : '#fff'}">${w ? w.def.icon : '✦'}</span> ${name(victim)}`;
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
    const spread = w ? w.spread(Math.hypot(p.vel.x, p.vel.z) > 1.5, !p.onGround) : 0.02;
    const px = Math.min(90, Math.round(6 + (spread / Math.tan((g.camera.fov * Math.PI) / 360)) * window.innerHeight * 0.5));
    if (this.cache.gap !== px) { this.cache.gap = px; this.el.crosshair.style.setProperty('--gap', `${px}px`); }
    this.set('chVis', this.el.crosshair.style, p.state === 'ground' && p.alive && !p.victory ? 'block' : 'none', 'display');

    if (w) {
      this.set('ammoCur', this.el.ammoCur, String(w.ammo));
      this.set('ammoMax', this.el.ammoMax, `/${w.def.mag}`);
      this.set('wname', this.el.weaponName, w.name);
      this.set('wcol', this.el.weaponName.style, RARITIES[w.rarity].color, 'color');
    } else {
      this.set('ammoCur', this.el.ammoCur, '–');
      this.set('ammoMax', this.el.ammoMax, '');
      this.set('wname', this.el.weaponName, 'Unarmed');
      this.set('wcol', this.el.weaponName.style, '#ffffff', 'color');
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
