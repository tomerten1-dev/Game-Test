import { MODS, MOD_SLOTS, MOD_COST, RARITIES } from '../weapons/WeaponDefs.js';
import { itemIcon } from './ItemIcons.js';

// Mod bench screen (Fortnite): four attachment slots on the gun you hold. Adding or swapping an
// attachment costs 75 gold bars; taking one off is free. Mythic and exotic guns can't be modded.
export class ModBench {
  constructor(root, game) {
    this.game = game;
    this.open = false;
    root.insertAdjacentHTML('beforeend', `
      <div id="modbench" class="hidden">
        <div class="inv-panel mb-panel">
          <div class="inv-title">MOD BENCH</div>
          <div class="mb-gun" id="mb-gun"></div>
          <div class="mb-slots" id="mb-slots"></div>
          <div class="inv-help">${MOD_COST} gold to add or swap a mod · removing is free · pick another gun with 1-6 · Esc: close</div>
          <button id="mb-close" class="btn">CLOSE</button>
        </div>
      </div>`);
    this.el = root.querySelector('#modbench');
    this.gunEl = root.querySelector('#mb-gun');
    this.slotsEl = root.querySelector('#mb-slots');
    root.querySelector('#mb-close').addEventListener('click', (e) => { e.stopPropagation(); game.toggleModBench(false); });
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-slot]');
      if (!b || b.disabled) return;
      e.stopPropagation();
      const msg = this.apply(b.dataset.slot, b.dataset.mod || null);
      if (msg) game.hud.toast?.(msg);
      this.render();
    });
  }

  show(v) {
    this.open = v;
    this.el.classList.toggle('hidden', !v);
    if (v) { this._slot = -1; this.render(); }
  }

  // Put `mod` in `slot` on the held gun (null takes it off). Returns an error message or null.
  apply(slot, mod) {
    const g = this.game, p = g.player, w = p.held;
    if (!w?.isGun || !w.canMod) return 'Hold a gun that takes mods';
    if ((w.mods[slot] || null) === mod) return null;
    if (mod) {
      if (p.gold < MOD_COST) return `Need ${MOD_COST} gold (you have ${p.gold})`;
      p.gold -= MOD_COST;
      g.sound.play('buy');
    }
    const wasFull = w.ammo >= w.mag;
    if (mod) w.mods[slot] = mod; else delete w.mods[slot];
    // a drum mag fills up when fitted; taking it off drops the extra rounds back in your pocket
    if (w.ammo > w.mag) { p.addAmmo?.(w.def.ammoType, w.ammo - w.mag); w.ammo = w.mag; }
    else if (slot === 'mag' && wasFull) { const add = Math.min(w.mag - w.ammo, p.ammoFor(w.def.ammoType)); if (Number.isFinite(add) && add > 0) { w.ammo += add; p.ammo[w.def.ammoType] -= add; } }
    p._equip?.(); // redraw the gun with its new parts
    g.meta?.track?.('mod');
    return null;
  }

  tick() {
    if (this.open && this._slot !== this.game.player.slot) this.render();
  }

  render() {
    const p = this.game.player, w = p?.held;
    this._slot = p?.slot;
    if (!w?.isGun || !w.canMod) {
      this.gunEl.innerHTML = `<div class="mb-none">${w?.isGun ? `${w.name} can't take mods` : 'Hold a gun to mod it'}</div>`;
      this.slotsEl.innerHTML = '';
      return;
    }
    const icon = itemIcon(w);
    this.gunEl.innerHTML = `${icon ? `<img src="${icon}" alt="">` : ''}<b style="color:${RARITIES[w.rarity].color}">${w.name}</b><span>Gold: ${p.gold}</span>`;
    this.slotsEl.innerHTML = MOD_SLOTS.map(([slot, label]) => {
      const cur = w.mods[slot] || null;
      const opts = MODS[slot].filter(([k]) => !(slot === 'optic' && w.def.scope));
      return `<div class="mb-col"><div class="inv-sub">${label}</div>
        <button class="mb-opt ${!cur ? 'on' : ''}" data-slot="${slot}"><b>None</b><small>${cur ? 'Remove · free' : 'Empty'}</small></button>
        ${opts.map(([k, name, desc]) => `<button class="mb-opt ${cur === k ? 'on' : ''}" data-slot="${slot}" data-mod="${k}" ${cur !== k && p.gold < MOD_COST ? 'disabled' : ''}><b>${name}</b><small>${desc}</small></button>`).join('')}
      </div>`;
    }).join('');
  }
}
