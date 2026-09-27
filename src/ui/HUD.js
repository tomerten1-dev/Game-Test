import { itemIcon } from './ItemIcons.js';
import { keyLabel } from '../core/Input.js';
import { RARITIES } from '../weapons/WeaponDefs.js';
import { Minimap } from './Minimap.js';
import { TOWNS } from '../world/Terrain.js';
import { AMMO, MEDALLIONS } from '../weapons/Items.js';

const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

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
        <div id="dmg-vignette"></div>
        <div id="shield-flash"></div>
        <div id="dmg-dir"><i></i></div>
        <div id="crosshair">
          <i class="ch t"></i><i class="ch b"></i><i class="ch l"></i><i class="ch r"></i><i class="dot"></i>
          <div id="hitmarker"><i></i><i></i><i></i><i></i></div>
        </div>
        <div id="scope" class="hidden"><i class="sc-h"></i><i class="sc-v"></i></div>
        <canvas id="compass"></canvas>
        <div id="bossbar" class="hidden"><b>THE FOREMAN</b><div class="bb"><i id="bb-shield"></i><i id="bb-health"></i></div></div>
        <div id="soundviz"></div>
        <div id="spectate" class="hidden">
          <div class="sp-label">SPECTATING</div>
          <div class="sp-name" id="sp-name"></div>
          <div class="sp-info" id="sp-info"></div>
          <div class="sp-hint">Click: next player · Right-click: previous</div>
          <button class="btn" id="sp-skip">SEE RESULTS <span class="kbd">SPACE</span></button>
        </div>
        <div id="banner"></div>
        <div id="prompt" class="hidden"><span class="key">E</span><span id="prompt-text"></span></div>
        <div id="loot-card" class="hidden"></div>
        <div id="obj-hp" class="hidden"><div class="oh-bar"><div class="oh-fill"></div></div><span class="oh-num"></span></div>
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
          <div id="medals"></div>
          <div class="bar-row overshield hidden" id="os-row"><span class="bar-ico">◈</span><div class="bar"><div class="fill" id="os-fill"></div></div><span class="bar-num" id="os-num">0</span></div>
          <div class="bar-row shield"><span class="bar-ico">⛊</span><div class="bar"><div class="fill" id="shield-fill"></div></div><span class="bar-num" id="shield-num">0</span></div>
          <div class="bar-row stamina" id="stamina-row"><span class="bar-ico">⚡</span><div class="bar"><div class="fill" id="stamina-fill"></div></div></div>
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
            <div class="gold-chip" title="Gold bars: spend them at vending machines and upgrade benches"><span class="gold-icon"></span><span id="gold-n">0</span></div>
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
      dmgDir: $('#dmg-dir'), staminaFill: $('#stamina-fill'), staminaRow: $('#stamina-row'),
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
    $('#minimap-wrap').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (game.state === 'playing') game.toggleMap(true); });
    this.compass = $('#compass');
    this.compassCtx = this.compass.getContext('2d');
    this.sv = { root: $('#soundviz'), items: [] };
    this.spect = { el: $('#spectate'), name: $('#sp-name'), info: $('#sp-info') };
    $('#sp-skip').addEventListener('click', (e) => { e.stopPropagation(); game.finishSpectate(); });
    try { this.soundVizOn = localStorage.getItem('sb.soundviz') === '1'; } catch { this.soundVizOn = false; }
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
    this.hitT = kill ? 0.35 : head ? 0.28 : 0.18;
    if (head || kill) {
      // crosshair pops on headshots / eliminations
      this.el.crosshair.classList.remove('pop'); void this.el.crosshair.offsetWidth; this.el.crosshair.classList.add('pop');
    }
  }

  // Persistent red edges that grow with recent damage (and fade as you recover).
  damageTaken(amount, shieldBroke) {
    this.vig = Math.min(1, (this.vig || 0) + amount / 60);
    if (shieldBroke) {
      const f = this.root.querySelector('#shield-flash');
      f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
    }
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

  prompt(text, rarity, weapon = null) {
    this.lootCard(text ? weapon : null);
    const key = text ? text + rarity : null;
    if (this.cache.prompt === key) return;
    this.cache.prompt = key;
    this.el.prompt.classList.toggle('hidden', !text);
    if (text) {
      const k = this.el.prompt.querySelector('.key');
      if (k && this.game.input?.keyFor) k.textContent = keyLabel(this.game.input.keyFor('interact')).replace('Mouse ', 'M');
      this.el.promptText.textContent = text;
      this.el.promptText.style.color = rarity !== undefined ? RARITIES[rarity].color : '#fff';
    }
  }

  // Fortnite-style health bar on whatever you just hit (builds, house walls and doors, trees, rocks,
  // furniture); it follows the hit point on screen and fades out after a moment.
  objHp(c, pos) {
    if (!c) return;
    const src = c.structure || (c.part && c.part.maxHp ? c.part : null) || c.obj || (c.breakable ? c.breakable : null);
    if (!src) return;
    this._oh = { src, max: src.maxHp || 90, pos: pos.clone(), t: 1.8, mat: c.structure?.mat || src.mat || c.mat || 'wood' };
  }

  _updateObjHp(dt) {
    const o = this._oh, el = this.el.objHp || (this.el.objHp = document.getElementById('obj-hp'));
    if (!o) { if (!el.classList.contains('hidden')) el.classList.add('hidden'); return; }
    o.t -= dt;
    const cam = this.game.camera;
    const v = this._ohV || (this._ohV = o.pos.clone());
    v.copy(o.pos).project(cam);
    if (o.t <= 0 || v.z > 1) { this._oh = null; el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const hp = Math.max(0, Math.ceil(o.src.hp)), max = Math.round(o.max);
    el.style.transform = `translate(${((v.x + 1) / 2) * window.innerWidth}px, ${((1 - v.y) / 2) * window.innerHeight - 46}px) translate(-50%, -100%)`;
    el.style.opacity = String(Math.min(1, o.t * 2.5));
    el.dataset.mat = o.mat;
    el.querySelector('.oh-fill').style.width = `${Math.min(100, (hp / max) * 100)}%`;
    el.querySelector('.oh-num').textContent = `${hp} / ${max}`;
  }

  // Stat card for the weapon you're looking at on the floor, compared with the gun you hold
  // (or the same kind of gun in your inventory): green is better, red is worse.
  lootCard(w) {
    const el = this.el.lootCard || (this.el.lootCard = document.getElementById('loot-card'));
    const p = this.game.player;
    const cmp = !w ? null : p?.held?.isGun ? p.held : p?.items.find((it) => it?.isGun && it.type === w.type) || null;
    const key = w ? `${w.type}${w.rarity}|${cmp ? cmp.type + cmp.rarity : ''}` : null;
    if (this.cache.lootCard === key) return;
    this.cache.lootCard = key;
    el.classList.toggle('hidden', !w);
    if (!w) return;
    const stats = (x) => {
      const d = x.def;
      return [
        ['Damage', Math.round(x.damage) * d.pellets, 1],
        ['Fire rate', +d.rate.toFixed(1), 1],
        ['Magazine', d.mag, 1],
        ['Reload', +(d.shellReload ? d.shellReload * d.mag : d.reload).toFixed(1), -1],
      ];
    };
    const mine = cmp && stats(cmp);
    const rows = stats(w).map(([name, v, better], i) => {
      let tag = '';
      if (mine && mine[i][1] !== v) {
        const up = (v - mine[i][1]) * better > 0;
        tag = `<i class="${up ? 'up' : 'down'}">${up ? '▲' : '▼'}</i>`;
      }
      return `<div class="lc-row"><span>${name}</span><b>${v}${name === 'Reload' ? 's' : ''}</b>${tag}</div>`;
    }).join('');
    const r = RARITIES[w.rarity];
    el.style.setProperty('--rar', r.color);
    el.innerHTML = `<div class="lc-rar">${r.name}</div><div class="lc-name">${w.def.name}</div>${rows}${cmp ? `<div class="lc-vs">vs ${cmp.name}</div>` : ''}`;
  }

  toast(text) {
    const t = this.el.toast;
    t.textContent = text;
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
  }

  // Radial emote picker (desktop: mouse direction; touch: tap a slice).
  emoteWheel(w) {
    let el = this.root.querySelector('#emote-wheel');
    if (!el) {
      this.el.hud.insertAdjacentHTML('beforeend', '<div id="emote-wheel" class="hidden"><div class="ew-center">EMOTE</div></div>');
      el = this.root.querySelector('#emote-wheel');
    }
    if (!w) { el.classList.add('hidden'); el.querySelectorAll('.ew-item').forEach((i) => i.remove()); this._ewKey = null; return; }
    el.classList.remove('hidden');
    const key = w.list.map((c) => c.id).join();
    if (this._ewKey !== key) {
      this._ewKey = key;
      el.querySelectorAll('.ew-item').forEach((i) => i.remove());
      w.list.forEach((c, i) => {
        const a = (i / w.list.length) * Math.PI * 2;
        const b = document.createElement('button');
        b.className = 'ew-item';
        b.style.transform = `translate(${Math.sin(a) * 120}px, ${-Math.cos(a) * 120}px)`;
        b.innerHTML = `<i>♪</i><span>${c.name}</span>`;
        b.addEventListener('pointerdown', (e) => { e.stopPropagation(); w.picked = i; });
        el.appendChild(b);
      });
      if (w.touch) el.addEventListener('pointerdown', () => { w.picked = -1; }, { once: true });
    }
    el.querySelectorAll('.ew-item').forEach((b, i) => b.classList.toggle('on', i === w.sel));
    el.classList.toggle('touch', !!w.touch);
  }

  editHint(on) {
    let el = this.root.querySelector('#edit-hint');
    if (!el) {
      this.el.hud.insertAdjacentHTML('beforeend', '<div id="edit-hint" class="hidden">EDITING · click or drag tiles · <b>G</b> confirm · right-click reset</div>');
      el = this.root.querySelector('#edit-hint');
    }
    el.classList.toggle('hidden', !on);
  }

  scope(on) {
    if (this.cache.scope === on) return;
    this.cache.scope = on;
    this.root.querySelector('#scope').classList.toggle('hidden', !on);
    this.el.crosshair.classList.toggle('scoped', on);
  }

  setSoundViz(on) {
    this.soundVizOn = on;
    try { localStorage.setItem('sb.soundviz', on ? '1' : '0'); } catch { /* private mode */ }
    if (!on) for (const it of this.sv.items) it.el.style.opacity = '0';
  }

  // Accessibility: show where sounds come from as icons around the crosshair.
  soundViz(name, pos, vol = 1) {
    if (!this.soundVizOn || !pos) return;
    const kind = { pistol: 'shot', ar: 'shot', smg: 'shot', shotgun: 'shot', step: 'step', chest: 'chest', build: 'build', break: 'build', harvest_wood: 'build', harvest_stone: 'build', harvest_metal: 'build', glider: 'step', slide: 'step' }[name];
    if (!kind) return;
    const g = this.game, cam = g.camera.position;
    const dx = pos.x - cam.x, dz = pos.z - cam.z;
    if (dx * dx + dz * dz < 4) return;
    // reuse an indicator of the same kind pointing roughly the same way
    const world = Math.atan2(dx, dz);
    let it = this.sv.items.find((i) => i.kind === kind && Math.abs(angleDelta(i.world, world)) < 0.35 && i.t > 0);
    if (!it) it = this.sv.items.find((i) => i.t <= 0);
    if (!it) {
      if (this.sv.items.length >= 10) it = this.sv.items.reduce((a, b) => (a.t < b.t ? a : b));
      else {
        const el = document.createElement('div');
        el.className = 'sv';
        el.innerHTML = '<i></i>';
        this.sv.root.appendChild(el);
        it = { el };
        this.sv.items.push(it);
      }
    }
    it.kind = kind;
    it.world = world;
    it.t = kind === 'step' ? 0.7 : 1.3;
    it.vol = Math.min(1, 0.35 + vol);
    it.el.className = `sv ${kind}`;
  }

  _updateSoundViz(dt) {
    if (!this.soundVizOn) return;
    const yaw = this.game.rig.yaw;
    for (const it of this.sv.items) {
      if (it.t <= 0) continue;
      it.t -= dt;
      // camera looks along (-sin yaw, -cos yaw); 0 rad = straight ahead
      const rel = angleDelta(yaw + Math.PI, it.world);
      it.el.style.transform = `rotate(${-rel}rad) translateY(-150px)`;
      it.el.style.opacity = String(Math.max(0, Math.min(1, it.t * 2)) * it.vol);
    }
  }

  // Heading strip at the top: N/E/S/W, degrees, your marker, pings and the safe zone.
  _drawCompass() {
    const cv = this.compass, ctx = this.compassCtx, g = this.game;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = cv.clientWidth, ch = cv.clientHeight;
    if (cv.width !== Math.round(cw * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const yaw = g.rig.yaw;
    const heading = ((Math.atan2(-Math.sin(yaw), Math.cos(yaw)) * 180) / Math.PI + 360) % 360;
    const span = 150, ppd = W / span;
    const xOf = (deg) => W / 2 + ((((deg - heading) % 360) + 540) % 360 - 180) * ppd;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    for (let d = 0; d < 360; d += 5) {
      const x = xOf(d);
      if (x < -10 || x > W + 10) continue;
      const fade = 1 - Math.abs(x - W / 2) / (W / 2);
      ctx.globalAlpha = Math.max(0, fade) * 0.95;
      ctx.fillStyle = '#fff';
      if (names[d] !== undefined) {
        ctx.font = `800 ${Math.round(H * 0.42)}px "Barlow Condensed", sans-serif`;
        ctx.fillStyle = d === 0 ? '#ffd23f' : '#fff';
        ctx.fillText(names[d], x, H * 0.36);
      } else if (d % 15 === 0) {
        ctx.font = `600 ${Math.round(H * 0.28)}px "Barlow Condensed", sans-serif`;
        ctx.fillText(String(d), x, H * 0.36);
      } else ctx.fillRect(x - dpr * 0.5, H * 0.3, dpr, H * 0.14);
    }
    ctx.globalAlpha = 1;
    const p = g.player;
    const icon = (wx, wz, color, shape) => {
      const b = ((Math.atan2(wx - p.pos.x, -(wz - p.pos.z)) * 180) / Math.PI + 360) % 360;
      let x = xOf(b);
      x = Math.max(8 * dpr, Math.min(W - 8 * dpr, x));
      const y = H * 0.78, r = H * 0.13;
      ctx.fillStyle = color;
      ctx.beginPath();
      if (shape === 'diamond') { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); }
      else ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
    };
    if (p) {
      const storm = g.storm;
      if (p.alive && storm.stage !== 'done' && !storm.isSafe(p.pos.x, p.pos.z)) icon(storm.nextCenter.x, storm.nextCenter.y, '#ffffff', 'circle');
      for (const pg of g.pings.pings) icon(pg.pos.x, pg.pos.z, pg.label === 'Enemy!' ? '#ff6b6b' : '#5fd4ff', 'diamond');
      if (g.pings.marker) icon(g.pings.marker.x, g.pings.marker.z, '#ffd23f', 'diamond');
    }
    // center notch + heading
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.moveTo(W / 2 - 5 * dpr, 0); ctx.lineTo(W / 2 + 5 * dpr, 0); ctx.lineTo(W / 2, 6 * dpr); ctx.fill();
  }

  showSpectate(actor) {
    this.spect.el.classList.toggle('hidden', !actor);
    if (!actor) return;
    this.spect.name.textContent = actor.name;
    this.spect.name.style.color = '#' + actor.color.getHexString();
    this.spectating = actor;
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

  thankDriver(a) {
    const row = document.createElement('div');
    row.className = 'kf-row' + (a.isPlayer ? ' me' : '');
    row.innerHTML = `<b style="color:${a.isPlayer ? '#20e6c9' : '#' + a.color.getHexString()}">${a.isPlayer ? 'You' : a.name}</b> <span>thanked the bus driver</span>`;
    this.el.killfeed.prepend(row);
    while (this.el.killfeed.children.length > 5) this.el.killfeed.lastChild.remove();
    setTimeout(() => row.classList.add('fade'), 5000);
    setTimeout(() => row.remove(), 5600);
  }

  killFeed(killer, victim) {
    const row = document.createElement('div');
    row.className = 'kf-row' + (victim.isPlayer || killer?.isPlayer ? ' me' : '');
    const name = (a) => `<b style="color:${a.isPlayer ? '#20e6c9' : '#' + a.color.getHexString()}">${a.isPlayer ? 'You' : a.name}</b>`;
    if (victim.deathCause === 'fall') row.innerHTML = `${name(victim)} <span>fell to their death</span>`;
    else if (!killer || killer === victim) row.innerHTML = `${name(victim)} <span>was lost in the storm</span>`;
    else {
      const w = killer.weapon;
      const m = Math.round(Math.hypot(killer.pos.x - victim.pos.x, killer.pos.y - victim.pos.y, killer.pos.z - victim.pos.z));
      row.innerHTML = `${name(killer)} <span class="kf-w" style="color:${w ? RARITIES[w.rarity].color : '#fff'}" title="${w ? w.name : 'Harvesting Axe'}">${w ? w.def.icon : '⛏'}</span> ${name(victim)} <span class="kf-d">${m} m</span>`;
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
    this._updateObjHp(dt);
    this._drawCompass();
    if (this.vig > 0) {
      this.vig = Math.max(0, this.vig - dt * 0.35);
      const low = p.alive ? Math.max(0, (40 - p.health) / 40) * 0.5 : 0; // low health keeps a faint pulse
      this.root.querySelector('#dmg-vignette').style.opacity = String(Math.max(this.vig, low * (0.7 + 0.3 * Math.sin(g.time * 4))));
    }
    const boss = g.boss?.boss;
    const showBoss = !!boss && boss.alive && p.alive && p.pos.distanceTo(boss.pos) < 75;
    this.set('bossOn', this.root.querySelector('#bossbar').style, showBoss ? 'flex' : 'none', 'display');
    if (showBoss) {
      this.set('bbH', this.root.querySelector('#bb-health').style, `${(boss.health / 400) * 66.7}%`, 'width');
      this.set('bbS', this.root.querySelector('#bb-shield').style, `${(boss.shield / 200) * 33.3}%`, 'width');
    }
    this._updateSoundViz(dt);
    const sp = g.spectating;
    if (sp) this.set('spinfo', this.spect.info, `${sp.kills} eliminations · ${Math.ceil(sp.health)} HP${sp.shield > 0 ? ` · ${Math.ceil(sp.shield)} shield` : ''}`);
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
      const code = this.game.input.keyFor('slot' + (i + 1));
      const key = code ? keyLabel(code).replace(' Mouse', '').replace('Mouse ', 'M') : '';
      const sig = `${it ? it.type + (it.rarity ?? '') + (it.count ?? '') : ''}|${i === p.slot}|${key}`;
      if (this.cache['slot' + i] === sig) return;
      this.cache['slot' + i] = sig;
      s.querySelector('.key').textContent = key;
      s.classList.toggle('active', i === p.slot);
      const col = !it ? 'rgba(255,255,255,0.15)' : it.isGun ? RARITIES[it.rarity].color : it.isConsumable ? it.def.color : '#e8d7b0';
      s.style.setProperty('--rar', col);
      const url = itemIcon(it);
      const ic = s.querySelector('.icon');
      if (url) ic.innerHTML = `<img src="${url}" alt="">`;
      else ic.textContent = !it ? '' : it.isGun ? it.def.icon : it.isConsumable ? it.def.icon : '⛏';
      s.classList.toggle('has-img', !!url);
      s.querySelector('.count').textContent = it?.isConsumable ? String(it.count) : '';
    });
    for (const k of ['wood', 'stone', 'metal']) this.set('mat' + k, this.el.mats[k], String(p.mats[k]));
    this.set('gold', this.el.gold || (this.el.gold = document.getElementById('gold-n')), String(p.gold || 0));
    const mk = [...(p.medallions || [])].join(',');
    if (this.cache.medals !== mk) {
      this.cache.medals = mk;
      const el = document.getElementById('medals');
      el.innerHTML = [...(p.medallions || [])].map((k) => { const m = MEDALLIONS[k]; return `<div class="medal" style="--c:${m.color}" title="${m.name}: ${m.perk}"><span>${m.icon}</span><b>${m.perk}</b></div>`; }).join('');
    }
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
    const stam = Math.round(p.stamina ?? 100);
    this.set('stam', this.el.staminaFill.style, `${stam}%`, 'width');
    this.set('stamShow', this.el.staminaRow.style, stam < 100 && p.alive ? '1' : '0', 'opacity');
    const view = g.spectating || p;
    const hp = Math.ceil(view.health), sh = Math.ceil(view.shield);
    this.set('hpw', this.el.healthFill.style, `${Math.min(100, hp)}%`, 'width');
    this.set('hpn', this.el.healthNum, String(hp));
    this.set('shw', this.el.shieldFill.style, `${Math.min(100, sh)}%`, 'width');
    this.set('shn', this.el.shieldNum, String(sh));
    const osRow = this.el.osRow || (this.el.osRow = document.getElementById('os-row'));
    if (this.cache.osOn !== !!g.zeroBuild) { this.cache.osOn = !!g.zeroBuild; osRow.classList.toggle('hidden', !g.zeroBuild); }
    if (g.zeroBuild) {
      const os = Math.ceil(view.overshield || 0);
      this.set('osw', document.getElementById('os-fill').style, `${os * 2}%`, 'width');
      this.set('osn', document.getElementById('os-num'), String(os));
    }

    // stats
    this.set('alive', this.el.alive, String(g.aliveCount));
    this.set('kills', this.el.kills, String(p.kills));
    const storm = g.storm;
    if (g.warmup > 0) {
      this.set('storm', this.el.storm, fmtTime(g.warmup));
      this.set('stormLabel', this.el.stormLabel, `Warm-up · bus leaves in ${fmtTime(g.warmup)}`);
    } else {
      this.set('storm', this.el.storm, storm.stage === 'done' ? '0:00' : fmtTime(storm.timer));
      const base = storm.stage === 'done' ? 'Final circle' : storm.stage === 'wait' ? `Storm shrinks in ${fmtTime(storm.timer)}` : 'Storm is shrinking!';
      const s = g.surge;
      // distance to the safe zone when you're outside it
      const out = p.alive && p.state !== 'bus' ? g.storm.distOutsideNext?.(p.pos) || 0 : 0;
      const safe = out > 5 ? ` · Safe zone ${Math.round(out / 5) * 5} m` : '';
      this.set('stormLabel', this.el.stormLabel, s && p.alive ? `${base} · SURGE: ${Math.round(p.dmgDealt || 0)}/${s.need} dmg` : base + safe);
    }
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
