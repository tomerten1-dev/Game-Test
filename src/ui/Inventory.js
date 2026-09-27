import { itemIcon } from './ItemIcons.js';
import { keyLabel } from '../core/Input.js';
import { RARITIES } from '../weapons/WeaponDefs.js';
import { AMMO, MATS } from '../weapons/Items.js';

// Inventory screen (Tab): your six slots, materials and ammo. Drag a slot onto another to swap them;
// select one to drop it, drop a single item from a stack or split the stack into a free slot.
export class Inventory {
  constructor(root, game) {
    this.game = game;
    this.open = false;
    this.sel = -1;
    root.insertAdjacentHTML('beforeend', `
      <div id="inventory" class="hidden">
        <div class="inv-panel">
          <div class="inv-title">INVENTORY</div>
          <div class="inv-slots" id="inv-slots"></div>
          <div class="inv-detail" id="inv-detail"></div>
          <div class="inv-cols">
            <div><div class="inv-sub">Materials</div><div id="inv-mats" class="inv-list"></div></div>
            <div><div class="inv-sub">Ammo</div><div id="inv-ammo" class="inv-list"></div></div>
          </div>
          <div class="inv-help">Drag a slot onto another to swap, or out of the row to drop it · <span id="inv-key"></span> or Esc: close</div>
          <button id="inv-close" class="btn">CLOSE</button>
        </div>
      </div>`);
    this.el = root.querySelector('#inventory');
    this.slotsEl = root.querySelector('#inv-slots');
    this.detailEl = root.querySelector('#inv-detail');
    this.matsEl = root.querySelector('#inv-mats');
    this.ammoEl = root.querySelector('#inv-ammo');
    root.querySelector('#inv-close').addEventListener('click', (e) => { e.stopPropagation(); game.toggleInventory(false); });
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());

    // one delegated handler for every button in the panel
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      e.stopPropagation();
      const g = this.game, a = b.dataset.act, arg = b.dataset.arg;
      if (a === 'sel') { this.sel = +arg === this.sel ? -1 : +arg; if (this.sel >= 0 && g.player.items[this.sel]) g.player.switchSlot(this.sel); }
      else if (a === 'drop') g.dropFromSlot(this.sel, Infinity);
      else if (a === 'drop1') g.dropFromSlot(this.sel, 1);
      else if (a === 'split') g.splitSlot(this.sel);
      else if (a === 'mat') g.dropMat(arg, +b.dataset.n);
      else if (a === 'ammo') g.dropAmmo(arg, +b.dataset.n);
      this.render();
    });
    // drag & drop to swap slots
    this.el.addEventListener('pointerdown', () => { this.pointerDown = true; }, true);
    window.addEventListener('pointerup', () => { this.pointerDown = false; });
    this.slotsEl.addEventListener('dragstart', (e) => { const s = e.target.closest('[data-slot]'); if (s) { this.dragging = true; e.dataTransfer.setData('text/plain', s.dataset.slot); } });
    this.slotsEl.addEventListener('dragend', () => { this.dragging = false; this.pointerDown = false; });
    // drop on another slot: swap; drop anywhere else on the screen: throw the item out
    this.el.addEventListener('dragover', (e) => e.preventDefault());
    this.el.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dragging = false;
      const from = +e.dataTransfer.getData('text/plain');
      if (Number.isNaN(from) || from <= 0) return;
      const to = e.target.closest('[data-slot]');
      if (to) { if (this.game.swapSlots(from, +to.dataset.slot)) this.sel = +to.dataset.slot; }
      else if (!e.target.closest('.inv-slots')) { this.game.dropFromSlot(from, Infinity); this.sel = -1; }
      this.render();
    });
  }

  // Refresh a few times a second (ammo, counts), but never mid-click or mid-drag.
  tick(dt) {
    this.t = (this.t || 0) - dt;
    if (this.t > 0 || this.dragging || this.pointerDown) return;
    this.t = 0.4;
    this.render();
  }

  show(v) {
    this.open = v;
    this.el.classList.toggle('hidden', !v);
    if (v) { this.sel = this.game.player.slot > 0 ? this.game.player.slot : -1; this.render(); }
  }

  render() {
    const p = this.game.player;
    if (!p) return;
    const keyName = (c) => keyLabel(c).replace(' Mouse', '').replace('Mouse ', 'M');
    this.el.querySelector('#inv-key').textContent = keyName(this.game.input.keyFor('inventory'));
    this.slotsEl.innerHTML = p.items.map((it, i) => {
      const col = !it ? 'rgba(255,255,255,0.15)' : it.isGun ? RARITIES[it.rarity].color : it.isConsumable ? it.def.color : '#e8d7b0';
      const url = itemIcon(it);
      const icon = url ? `<img src="${url}" alt="">` : !it ? '' : it.isGun ? it.def.icon : it.isConsumable ? it.def.icon : '⛏';
      const sub = !it ? 'Empty' : it.isGun ? `${it.ammo}/${it.def.mag}` : it.isConsumable ? `×${it.count}` : '';
      const drag = i > 0 && it ? 'draggable="true"' : '';
      return `<div class="inv-slot${i === this.sel ? ' sel' : ''}${i === 0 ? ' fixed' : ''}" data-slot="${i}" data-act="sel" data-arg="${i}" ${drag} style="--rar:${col}">
        <span class="k">${keyName(this.game.input.keyFor('slot' + (i + 1)))}</span><span class="ic">${icon}</span><span class="nm">${it ? it.name : ''}</span><span class="sb">${sub}</span></div>`;
    }).join('');
    const it = this.sel > 0 ? p.items[this.sel] : null;
    if (!it) this.detailEl.innerHTML = `<div class="inv-hint">${this.sel === 0 ? 'The harvesting axe can’t be dropped.' : 'Select an item to drop or split it.'}</div>`;
    else {
      const rar = it.isGun ? `<span class="rar" style="color:${RARITIES[it.rarity].color}">${RARITIES[it.rarity].name}</span> ` : '';
      const stats = it.isGun ? `${Math.round(it.damage)} damage · ${it.def.mag} mag · ${AMMO[it.def.ammoType].name}` : it.def.heal ? `+${it.def.heal} health` : it.def.shield ? `+${it.def.shield} shield` : it.def.desc || '';
      const free = p.items.some((x, i) => i > 0 && !x);
      this.detailEl.innerHTML = `<div class="inv-name">${rar}${it.name}</div><div class="inv-stats">${stats}</div>
        <div class="inv-btns"><button class="btn" data-act="drop">Drop${it.isConsumable && it.count > 1 ? ' all' : ''}</button>
        ${it.isConsumable && it.count > 1 ? `<button class="btn" data-act="drop1">Drop 1</button>` : ''}
        ${it.isConsumable && it.count > 1 && free ? `<button class="btn" data-act="split">Split</button>` : ''}</div>`;
    }
    this.matsEl.innerHTML = Object.keys(MATS).map((m) => `<div class="inv-row"><span style="color:${MATS[m].color}">${MATS[m].name}</span><b>${p.mats[m]}</b>
      <button class="btn sm" data-act="mat" data-arg="${m}" data-n="10" ${p.mats[m] < 1 ? 'disabled' : ''}>Drop 10</button>
      <button class="btn sm" data-act="mat" data-arg="${m}" data-n="50" ${p.mats[m] < 1 ? 'disabled' : ''}>50</button></div>`).join('');
    this.ammoEl.innerHTML = Object.keys(AMMO).map((a) => {
      const n = p.ammoFor(a);
      return `<div class="inv-row"><span style="color:${AMMO[a].color}">${AMMO[a].name}</span><b>${Number.isFinite(n) ? n : '∞'}</b>
        <button class="btn sm" data-act="ammo" data-arg="${a}" data-n="${AMMO[a].box}" ${!(n > 0) || !Number.isFinite(n) ? 'disabled' : ''}>Drop ${AMMO[a].box}</button></div>`;
    }).join('');
  }
}
