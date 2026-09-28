import { SLOTS, COSMETIC_LIST, COSMETICS } from '../meta/Cosmetics.js';
import { SPRITES, spriteLevel } from '../player/Sprites.js';
import { RARITIES } from '../weapons/WeaponDefs.js';
import { TRACK, SEASON, xpForLevel, QUEST_REWARD, WEEKLY_REWARD, milestoneReward, arenaDivision, PASS_PAGES, PAGE_UNLOCK, passState, claimPass } from '../meta/Progression.js';
import { renderSettings } from './Settings.js';

const HERO_ICON = { Knight: '🛡️', Barbarian: '🪓', Mage: '🔮', Rogue: '🗡️', Rogue_Hooded: '🏹', Male_Ranger: '🏹', Female_Ranger: '🏹', Male_Peasant: '🌾', Female_Peasant: '🌾' };
const HAT_ICON = { party: '🥳', cowboy: '🤠', ice_horns: '❄️', pumpkin: '🎃', pirate: '🏴‍☠️', ninja: '🥷', astro: '🧑‍🚀', halo: '😇' };
const BACK_ICON = { antenna: '📡', quiver: '🏹', shield: '🛡️', llama: '🦙', guitar: '🎸', cape: '🧣', sword: '⚔️', jetpack: '🚀', wings: '🪽', crystal: '💎' };
const TOOL_ICON = { pan: '🍳', wrench: '🔧', candy: '🍬', hammer: '🔨', crystal: '❄️', neon: '⚡', gold: '🪙' };
const TIPS = [
  'Harvest with the axe before a fight — walls save lives.',
  'Supply drops follow the next safe zone. Watch for blue smoke.',
  'Stand still for a perfectly accurate first shot.',
  'Jump pads cancel fall damage.',
  'Rare chests shine brighter gold and hold rarer loot.',
  'Storm Coins are earned by playing — spend them in the Item Shop.',
  'Press G on your own wall to cut a door or window.',
];
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const coin = '<i class="coin"></i>';

export function itemIcon(c) {
  const v = c.value;
  if (c.type === 'hero') return `<i class="ic ic-hero" style="${c.tint ? `--tint:${c.tint}` : ''}">${HAT_ICON[c.hat] || HERO_ICON[v] || '★'}</i>`;
  if (c.type === 'backbling') return `<i class="ic ic-hero">${BACK_ICON[v] || '∅'}</i>`;
  if (c.type === 'pickaxe') return `<i class="ic ic-hero">${TOOL_ICON[v] || '🪓'}</i>`;
  if (c.type === 'tint') return `<i class="ic ic-swatch" style="background:${v || 'conic-gradient(#20d6c0, #2f6bff, #ff4d5e, #ffc93c, #20d6c0)'}"></i>`;
  if (c.type === 'glider') return `<i class="ic ic-glider" style="--a:${v[0]};--b:${v[1]}"></i>`;
  if (c.type === 'trail') return `<i class="ic ic-trail" style="background:${!v ? 'rgba(255,255,255,0.15)' : v === 'rainbow' ? 'linear-gradient(90deg,#ff5a5f,#ffd23f,#6ef0a8,#5fd4ff,#a15cff)' : `linear-gradient(90deg,transparent,${v[0]},${v[1]})`}"></i>`;
  if (c.type === 'emote') return '<i class="ic ic-emote">♪</i>';
  if (c.type === 'kicks') return v ? `<i class="ic ic-hero" style="color:${v.base};text-shadow:0 2px 0 ${v.sole}">👟</i>` : '<i class="ic ic-hero">∅</i>';
  if (c.type === 'sidekick') return `<i class="ic ic-hero">${{ pup: '🐶', kitty: '🐱', penguin: '🐧' }[v] || '∅'}</i>`;
  if (c.type === 'spray') return `<i class="ic ic-swatch" style="background:linear-gradient(135deg,${v.a},${v.b});color:#fff;font-weight:900;display:flex;align-items:center;justify-content:center;font-size:${v.text.length > 3 ? 10 : 18}px">${v.text}</i>`;
  if (c.type === 'loading') return `<i class="ic ic-swatch" style="background:linear-gradient(160deg,${v.a},${v.b})"></i>`;
  if (c.type === 'lobbymusic') return '<i class="ic ic-emote">♫</i>';
  if (c.type === 'sprite') return `<i class="ic ic-hero" style="${v ? `color:${SPRITES[v].color}` : ''}">${v ? { water: '💧', earth: '🌿', fire: '🔥' }[v] : '∅'}</i>`;
  return `<i class="ic ic-wrap" style="background:${v ? v.color : '#4a505c'}"></i>`;
}

// Lobby (play / locker / shop / quests / career / settings), matchmaking, pause and results.
export class Menus {
  constructor(root, game) {
    this.game = game;
    this.meta = game.meta;
    this.tab = 'play';
    this.lockerSlot = 'hero';
    this.shopSel = null;
    this.mode = 'solo';
    root.insertAdjacentHTML('beforeend', `
      <div id="lobby" class="lobby hidden">
        <div class="lb-top">
          <div class="lb-brand"><span class="bolt">⚡</span>STORMBOUND</div>
          <nav class="lb-tabs">
            ${[['play', 'Play'], ['locker', 'Locker'], ['shop', 'Item Shop'], ['quests', 'Quests'], ['career', 'Career'], ['settings', 'Settings']]
    .map(([k, n]) => `<button data-tab="${k}">${n}</button>`).join('')}
          </nav>
          <div class="lb-wallet">
            <div class="lb-level"><b id="lb-lvl">1</b><div><div class="xpbar"><i id="lb-xpfill"></i></div><small id="lb-xptext"></small></div></div>
            <div class="lb-crown" title="You won your last match: you start the next one wearing the Victory Crown">♛</div>
            <div class="lb-arena" id="lb-arena" title="Ranked rank"></div>
            <div class="lb-coins" title="Storm Coins — earned by playing, never sold">${coin}<b id="lb-coins">0</b></div>
          </div>
        </div>
        <div class="lb-body">
          <section class="lb-panel" data-panel="play">
            <div class="play-left">
              <div class="lb-card pass-mini" id="pass-mini"></div>
              <div class="lb-card quests-mini"><div class="card-h">Daily quests</div><div id="qmini"></div></div>
              <button class="lb-btn" id="emote-btn">Emote</button>
            </div>
            <div class="play-right" id="play-right">
              <button class="mode-card" id="mode-card"><small>Battle Royale</small><b id="mc-name">Solo</b><span id="mc-sub"></span><em>Change</em></button>
              <div class="modes">
                <button class="mode m-solo" data-mode="solo"><i class="mi">⚔</i><b>Solo</b><span>You vs 99 bots</span></button>
                <button class="mode m-quick" data-mode="quick"><i class="mi">⚡</i><b>Quick Match</b><span>29 bots · faster storm</span></button>
                <button class="mode m-zb" data-mode="zb"><i class="mi">◈</i><b>Zero Build</b><span>No building · overshield</span></button>
                <button class="mode m-reload" data-mode="reload"><i class="mi">↻</i><b>Reload</b><span>40 players · 2 reboots · small map</span></button>
                <button class="mode m-blitz" data-mode="blitz"><i class="mi">⏱</i><b>Blitz Royale</b><span>32 players · same kit · ~5 min</span></button>
                <button class="mode arena" data-mode="arena"><i class="mi">🏆</i><b>Ranked</b><span id="arena-div">Bronze I</span></button>
              </div>
              <button id="play-btn" class="btn big">PLAY!</button>
              <div class="sub">Straight onto the Storm Bus</div>
            </div>
          </section>
          <section class="lb-panel side" data-panel="locker"><div class="locker-slots" id="locker-slots"></div><div class="grid" id="locker-grid"></div></section>
          <section class="lb-panel side" data-panel="shop"><div id="shop"></div></section>
          <section class="lb-panel side" data-panel="quests"><div id="quests"></div></section>
          <section class="lb-panel side" data-panel="career"><div id="career"></div></section>
          <section class="lb-panel side" data-panel="settings"><div id="settings"></div></section>
        </div>
      </div>
      <div id="mm" class="screen hidden">
        <div class="menu-inner"><div class="logo mid">MATCHMAKING</div><div class="mm-count" id="mm-count"></div><div class="spinner"></div><div class="tagline" id="mm-tip"></div>
        <button class="lb-btn" id="mm-cancel">Cancel</button></div>
      </div>
      <div id="pause" class="screen hidden">
        <div class="menu-inner small">
          <div class="logo mid">PAUSED</div>
          <button id="resume-btn" class="btn">RESUME</button>
          <div class="lb-card pause-settings" id="pause-settings"></div>
          <button class="lb-btn danger" id="leave-btn">Leave match</button>
        </div>
      </div>
      <div id="end" class="screen hidden">
        <div class="menu-inner end-panel">
          <div id="end-rank" class="rank">#1</div>
          <div id="end-title" class="logo">VICTORY</div>
          <div id="end-sub" class="tagline"></div>
          <div class="end-stats">
            <div><b id="end-kills">0</b><span>Eliminations</span></div>
            <div><b id="end-time">0:00</b><span>Time alive</span></div>
            <div><b id="end-place">#1</b><span>Placement</span></div>
          </div>
          <div class="lb-card rewards" id="end-rewards"></div>
          <div class="end-btns"><button id="again-btn" class="btn big">PLAY AGAIN</button><button id="lobby-btn" class="btn alt">LOBBY</button></div>
        </div>
      </div>`);
    const $ = (s) => root.querySelector(s);
    this.$ = $;
    this.el = { lobby: $('#lobby'), pause: $('#pause'), end: $('#end'), mm: $('#mm') };
    const tap = (sel, fn) => $(sel).addEventListener('click', (e) => { e.stopPropagation(); game.sound.ensure(); game.sound.play('click'); fn(e); });
    tap('#play-btn', () => game.play(this.mode));
    tap('#again-btn', () => game.play(this.mode));
    tap('#lobby-btn', () => game.toLobby());
    tap('#resume-btn', () => game.resume());
    tap('#leave-btn', () => game.leaveMatch());
    tap('#mm-cancel', () => game.cancelMatchmaking());
    tap('#emote-btn', () => game.stage.emote(this.meta.profile.equippedItem('emote').value));
    root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); game.sound.ensure(); game.sound.play('click'); this.setTab(b.dataset.tab); }));
    root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); game.sound.play('click'); this.mode = b.dataset.mode; $('#play-right').classList.remove('picking'); this.refresh(); }));
    // Fortnite-style: one card for the selected mode above PLAY; "Change" opens the mode list
    tap('#mode-card', () => $('#play-right').classList.toggle('picking'));
    this.refresh();
  }

  setTab(t) {
    this.tab = t;
    this.shopSel = null;
    this.refresh();
  }

  // Current look for the 3D stage (equipped items, or the shop / locker preview).
  stageLook() {
    const prof = this.meta.profile;
    const val = (slot) => prof.equippedItem(slot).value;
    const hero = prof.equippedItem('hero');
    const style = hero.styles?.[prof.d.heroStyles?.[hero.id] || 0]?.[1];
    const look = { hero: val('hero'), tint: style || val('tint') || hero.tint || null, kicks: val('kicks'), hat: hero.hat || null, backbling: val('backbling'), pickaxe: val('pickaxe'), glider: val('glider'), trail: val('trail'), wrap: val('wrap'), emote: val('emote'), preview: null, crowned: !!prof.d.crowned };
    if (this.tab === 'locker') look.preview = this.lockerSlot;
    if (this.tab === 'shop' && this.shopSel) {
      const c = COSMETICS[this.shopSel];
      look[c.type] = c.value;
      if (c.type === 'hero') { look.hat = c.hat || null; look.tint = val('tint') || c.tint || null; }
      look.preview = c.type;
    }
    return look;
  }

  refresh() {
    const $ = this.$, prof = this.meta.profile, d = prof.d;
    this.el.lobby.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === this.tab));
    this.el.lobby.querySelectorAll('[data-panel]').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== this.tab));
    this.el.lobby.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === this.mode));
    $('#lb-lvl').textContent = d.level;
    $('#lb-xpfill').style.width = `${Math.min(100, (d.xp / xpForLevel(d.level)) * 100)}%`;
    $('#lb-xptext').textContent = `${d.xp} / ${xpForLevel(d.level)} XP`;
    $('#lb-coins').textContent = d.coins.toLocaleString();
    const ad = arenaDivision(d.arena?.points || 0);
    $('#arena-div').innerHTML = `<i style="color:${ad.color}">${ad.name}</i> · ${d.arena?.points || 0} pts`;
    $('#lb-arena').innerHTML = `<span style="background:${ad.color}"></span>${ad.name}`;
    const mb = this.el.lobby.querySelector(`[data-mode="${this.mode}"]`);
    if (mb) { $('#mc-name').textContent = mb.querySelector('b').textContent; $('#mc-sub').innerHTML = mb.querySelector('span').innerHTML; }
    const quests = this.meta.quests();
    $('#qmini').innerHTML = quests.map((q) => `<div class="qrow ${q.done ? 'done' : ''}"><div class="qline"><span>${q.def.text}</span><b>${q.done ? '✓' : `${Math.floor(q.progress)}/${q.def.target}`}</b></div><div class="qbar"><i style="width:${Math.min(100, (q.progress / q.def.target) * 100)}%"></i></div></div>`).join('');
    // battle pass: claims waiting, or the next unclaimed reward
    const ps = passState(this.meta.profile);
    const nextId = PASS_PAGES.flat().find((id) => !this.meta.profile.owns(id));
    const nextItem = nextId && COSMETICS[nextId];
    $('#pass-mini').innerHTML = nextItem ? `<div class="card-h">Battle Pass</div><div class="pm-row" style="--rar:${RARITIES[nextItem.rarity].color}">${itemIcon(nextItem)}<div><b>${ps.claims ? `${ps.claims} reward${ps.claims > 1 ? 's' : ''} to claim!` : nextItem.name}</b><small>${ps.claims ? 'Open Quests → Battle Pass' : 'Level up to earn a claim'}</small><div class="qbar"><i style="width:${Math.min(100, (d.xp / xpForLevel(d.level)) * 100)}%"></i></div></div></div>` : '<div class="card-h">Battle Pass</div><small>Every reward claimed!</small>';
    this.el.lobby.classList.toggle('crowned', !!d.crowned);
    if (this.tab === 'locker') this.renderLocker();
    if (this.tab === 'shop') this.renderShop();
    if (this.tab === 'quests') this.renderQuests();
    if (this.tab === 'career') this.renderCareer();
    if (this.tab === 'settings') renderSettings($('#settings'), this.game);
    this.game.stage?.setLook(this.stageLook());
    const pd = this.meta.profile.d;
    this.game.stage?.setPlate?.('You', pd.level, pd.stats.wins);
    if (this.game.stage) this.game.stage.idleEmote = this.meta.profile.equippedItem('emote')?.value;
  }

  renderLocker() {
    const $ = this.$, prof = this.meta.profile;
    $('#locker-slots').innerHTML = SLOTS.map((s) => {
      const c = prof.equippedItem(s.key);
      return `<button class="lslot ${s.key === this.lockerSlot ? 'on' : ''}" data-slot="${s.key}" style="--rar:${RARITIES[c.rarity].color}">${itemIcon(c)}<span><small>${s.name}</small>${c.name}</span></button>`;
    }).join('');
    const items = COSMETIC_LIST.filter((c) => c.type === this.lockerSlot);
    const trackLevel = (id) => Object.entries(TRACK).find(([, r]) => r.item === id)?.[0];
    $('#locker-grid').innerHTML = items.map((c) => {
      const owned = prof.owns(c.id), eq = prof.d.equipped[c.type] === c.id;
      const lock = owned ? '' : trackLevel(c.id) ? 'Battle Pass' : 'Item Shop';
      const sub = c.type === 'sprite' && c.value ? `Level ${spriteLevel(prof.d.spriteXp?.[c.value])} · ${SPRITES[c.value].desc}` : null;
      return `<button class="card ${owned ? '' : 'locked'} ${eq ? 'eq' : ''}" data-id="${c.id}" style="--rar:${RARITIES[c.rarity].color}" ${sub ? `title="${sub}"` : ''}>${itemIcon(c)}<b>${c.name}</b><small>${eq ? 'Equipped' : lock || (sub ? sub.split(' · ')[0] : RARITIES[c.rarity].name)}</small></button>`;
    }).join('');
    // outfit styles for the equipped hero
    const hero = prof.equippedItem('hero');
    if (this.lockerSlot === 'hero' && hero?.styles) {
      const cur = prof.d.heroStyles?.[hero.id] || 0;
      $('#locker-grid').insertAdjacentHTML('afterbegin', `<div class="styles-row"><b>${hero.name} styles</b>${hero.styles.map(([n, t], i) => `<button class="style-btn ${i === cur ? 'on' : ''}" data-style="${i}"><i style="background:${t || 'linear-gradient(135deg,#20d6c0,#2f6bff)'}"></i>${n}</button>`).join('')}</div>`);
      $('#locker-grid').querySelectorAll('[data-style]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); (prof.d.heroStyles ||= {})[hero.id] = +b.dataset.style; prof.save(); this.game.sound.play('click'); this.refresh(); }));
    }
    $('#locker-slots').querySelectorAll('[data-slot]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.lockerSlot = b.dataset.slot; this.refresh(); }));
    $('#locker-grid').querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const c = COSMETICS[b.dataset.id];
      if (!prof.owns(c.id)) { this.flash('Claim it in the Battle Pass (Quests tab) or buy it in the Item Shop'); return; }
      prof.equip(c.type, c.id);
      this.game.sound.play('click');
      if (c.type === 'lobbymusic') { const s = this.game.sound; s.lobbyPick = c.value; s.musicName = null; s._plIdx = undefined; s.music('lobby'); }
      this.refresh();
      if (c.type === 'emote') { this.game.stage.emote(c.value); this.game.emoteFx?.(null, c.value, this.game.stage.heroPos); }
    }));
  }

  renderShop() {
    const $ = this.$, prof = this.meta.profile;
    const shop = this.meta.shop();
    const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
    const left = Math.max(0, (mid - now) / 1000);
    const card = ({ item: c, owned }) => `<button class="card shop ${owned ? 'owned' : ''} ${this.shopSel === c.id ? 'sel' : ''}" data-id="${c.id}" style="--rar:${RARITIES[c.rarity].color}">${itemIcon(c)}<b>${c.name}</b><small>${SLOTS.find((s) => s.key === c.type).name}</small><span class="price">${owned ? 'Owned' : `${coin}${c.price}`}</span></button>`;
    const sel = this.shopSel && COSMETICS[this.shopSel];
    $('#shop').innerHTML = `
      <div class="shop-h"><div><div class="card-h big">Item Shop</div><small>New items in ${Math.floor(left / 3600)}h ${Math.floor((left % 3600) / 60)}m</small></div>
        <div class="shop-note">Storm Coins are earned by playing matches, quests and level-ups. Nothing here costs real money.</div></div>
      <div class="card-h">Featured</div>
      <div class="featured">${shop.featured.map(card).join('')}
        <button class="card bundle ${shop.bundle.owned ? 'owned' : ''}" data-bundle="1"><b>Featured bundle</b><small>Both featured items · 20% off</small><span class="price">${shop.bundle.owned ? 'Owned' : `${coin}${shop.bundle.price}`}</span></button></div>
      <div class="card-h">Daily</div>
      <div class="grid">${shop.daily.map(card).join('')}</div>
      <div class="shop-buy ${sel ? '' : 'hidden'}">${sel ? `${itemIcon(sel)}<div><b>${sel.name}</b><small>${RARITIES[sel.rarity].name} ${SLOTS.find((s) => s.key === sel.type).name}</small></div>
        <button class="btn" id="buy-btn" ${prof.owns(sel.id) ? 'disabled' : ''}>${prof.owns(sel.id) ? 'OWNED' : `BUY · ${sel.price}`}</button>` : ''}</div>`;
    $('#shop').querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      this.shopSel = b.dataset.id;
      this.refresh();
      const c = COSMETICS[this.shopSel];
      if (c.type === 'emote') { this.game.stage.emote(c.value); this.game.emoteFx?.(null, c.value, this.game.stage.heroPos); }
    }));
    $('#shop').querySelector('[data-bundle]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const err = this.meta.buy(shop.bundle.items.map((c) => c.id), shop.bundle.price);
      this.afterBuy(err);
    });
    $('#buy-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const err = this.meta.buy([sel.id], sel.price);
      this.afterBuy(err);
    });
  }

  afterBuy(err) {
    if (err) { this.flash(err); this.game.sound.play('empty'); return; }
    this.game.sound.play('buy');
    this.flash('Added to your locker!');
    this.refresh();
  }

  // Lobby toast (the in-match HUD is hidden here).
  flash(text) {
    let f = this.$('#lb-flash');
    if (!f) { this.el.lobby.insertAdjacentHTML('beforeend', '<div id="lb-flash"></div>'); f = this.$('#lb-flash'); }
    f.textContent = text;
    f.classList.remove('show'); void f.offsetWidth; f.classList.add('show');
  }

  renderQuests() {
    const d = this.meta.profile.d;
    const ps = passState(this.meta.profile);
    if (this.passPage === undefined) this.passPage = Math.max(0, ps.unlocked.lastIndexOf(true));
    const quests = this.meta.quests();
    const levels = Object.keys(TRACK).map(Number);
    this.$('#quests').innerHTML = `
      <div class="card-h big">Daily quests</div>
      ${quests.map((q) => `<div class="quest ${q.done ? 'done' : ''}"><div class="qt"><b>${q.def.text}</b><span>+${QUEST_REWARD.xp} XP · ${coin}${QUEST_REWARD.coins}</span></div>
        <div class="xpbar"><i style="width:${(q.progress / q.def.target) * 100}%"></i></div><small>${q.done ? 'Complete!' : `${Math.floor(q.progress)} / ${q.def.target}`}</small></div>`).join('')}
      <div class="card-h big">Weekly quests <small class="h-sub">new set in ${this._weekLeft()}</small></div>
      ${this.meta.weekly().map((q) => `<div class="quest weekly ${q.done ? 'done' : ''}"><div class="qt"><b>${q.def.text}</b><span>+${WEEKLY_REWARD.xp} XP · ${coin}${WEEKLY_REWARD.coins}</span></div>
        <div class="xpbar"><i style="width:${(q.progress / q.def.target) * 100}%"></i></div><small>${q.done ? 'Complete!' : `${Math.floor(q.progress).toLocaleString()} / ${q.def.target.toLocaleString()}`}</small></div>`).join('')}
      <div class="card-h big">Milestones</div>
      <div class="milestones">${this.meta.milestones().map((m) => {
    const prev = m.tier ? m.tiers[m.tier - 1] : 0, next = m.next;
    const pct = next ? ((m.value - prev) / (next - prev)) * 100 : 100;
    const r = next ? milestoneReward(m.tier) : null;
    return `<div class="ms"><div class="qt"><b>${m.name}</b><span>${'★'.repeat(m.tier)}${'☆'.repeat(m.tiers.length - m.tier)}</span></div>
      <div class="xpbar"><i style="width:${Math.min(100, pct)}%"></i></div><small>${next ? `${m.value.toLocaleString()} / ${next.toLocaleString()} · next: +${r.xp} XP, ${r.coins} coins` : 'All tiers done!'}</small></div>`;
  }).join('')}</div>
      <div class="card-h big">${SEASON.name} · Battle Pass <small class="h-sub">${ps.claims} claim${ps.claims === 1 ? '' : 's'} left · one per level</small></div>
      <div class="bp-pages">${PASS_PAGES.map((_, i) => `<button class="bp-tab ${i === this.passPage ? 'on' : ''} ${ps.unlocked[i] ? '' : 'locked'}" data-page="${i}">Page ${i + 1}<small>${ps.claimedOn[i]}/${PASS_PAGES[i].length}</small></button>`).join('')}</div>
      <div class="bp-grid">${PASS_PAGES[this.passPage].map((id) => {
    const c = COSMETICS[id], own = this.meta.profile.owns(id), open = ps.unlocked[this.passPage];
    return `<button class="card bp-item ${own ? 'eq' : open ? '' : 'locked'}" data-claim="${id}" style="--rar:${RARITIES[c.rarity].color}">${itemIcon(c)}<b>${c.name}</b><small>${own ? 'Claimed' : open ? (ps.claims ? 'Click to claim' : 'Needs a level-up') : `Claim ${PAGE_UNLOCK} on page ${this.passPage}`}</small></button>`;
  }).join('')}</div>
      <div class="card-h">Coin rewards on the level track</div>
      <div class="track">${levels.filter((l) => TRACK[l].coins).map((l) => `<div class="tier ${d.level >= l ? 'got' : ''}" style="--rar:#ffd23f"><small>Lv ${l}</small><i class="ic">${coin}</i><b>${TRACK[l].coins}</b></div>`).join('')}</div>`;
    this.$('#quests').querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.passPage = +b.dataset.page; this.renderQuests(); }));
    this.$('#quests').querySelectorAll('[data-claim]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const msg = claimPass(this.meta.profile, b.dataset.claim);
      if (msg) this.flash(msg); else { this.game.sound.play('buy'); this.flash(`Claimed ${COSMETICS[b.dataset.claim].name}!`); }
      this.refresh();
    }));
  }

  _weekLeft() {
    const now = new Date(), d = (now.getDay() + 6) % 7;
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d + 7);
    const h = Math.max(0, (next - now) / 3600000);
    return h > 24 ? `${Math.floor(h / 24)}d ${Math.floor(h % 24)}h` : `${Math.floor(h)}h`;
  }

  renderCareer() {
    const d = this.meta.profile.d, s = d.stats;
    const rows = [
      ['Level', d.level], ['Matches', s.matches], ['Wins', s.wins], ['Win rate', s.matches ? `${Math.round((s.wins / s.matches) * 100)}%` : '—'],
      ['Top 5', s.top5], ['Top 10', s.top10], ['Eliminations', s.kills], ['K/D', s.matches - s.wins ? (s.kills / Math.max(1, s.matches - s.wins)).toFixed(2) : s.kills],
      ['Damage dealt', s.damage.toLocaleString()], ['Chests opened', s.chests], ['Pieces built', s.built], ['Materials harvested', s.harvested],
      ['Time alive', `${Math.floor(s.timeAlive / 3600)}h ${Math.floor((s.timeAlive % 3600) / 60)}m`], ['Best placement', s.bestPlace ? `#${s.bestPlace}` : '—'],
      ['Storm Coins', d.coins], ['Items owned', `${d.owned.length} / ${COSMETIC_LIST.length}`],
    ];
    const A = d.arena || { points: 0, best: 0, matches: 0, wins: 0 }, ad = arenaDivision(A.points);
    const arena = [['Rank', `<i style="color:${ad.color}">${ad.name}</i>`], ['Rank points', A.points], ['Best', A.best], ['Ranked matches', A.matches], ['Ranked wins', A.wins], ['Crowned wins', s.crownedWins || 0]];
    this.$('#career').innerHTML = `<div class="card-h big">Career</div><div class="stats">${rows.map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('')}</div>
      <div class="card-h">Ranked</div><div class="stats">${arena.map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('')}</div>`;
  }

  // ---- screens ----
  showMenu(v) {
    this.el.lobby.classList.toggle('hidden', !v);
    if (v) this.refresh();
  }

  showPause(v) {
    this.el.pause.classList.toggle('hidden', !v);
    if (v) renderSettings(this.$('#pause-settings'), this.game, { compact: true });
  }

  showMatchmaking(v) {
    this.el.mm.classList.toggle('hidden', !v);
    if (v) this.$('#mm-tip').textContent = `Tip: ${TIPS[Math.floor(Math.random() * TIPS.length)]}`;
  }

  setMatchmaking(found, total) { this.$('#mm-count').textContent = `Finding players… ${found} / ${total}`; }

  showEnd({ victory, place, killer, kills, time, cause, rewards }) {
    const $ = (id) => document.getElementById(id);
    $('end-rank').textContent = `#${place}`;
    $('end-title').textContent = victory ? 'VICTORY ROYALE' : 'ELIMINATED';
    $('end-title').className = 'logo' + (victory ? ' gold' : ' red');
    $('end-sub').textContent = victory ? 'Last hero standing on Stormbound Island' : (killer ? `Eliminated by ${killer}` : cause === 'fall' ? 'You fell to your death' : cause === 'left' ? 'You left the match' : 'Eliminated by the storm') + ` — placed #${place}`;
    $('end-kills').textContent = kills;
    $('end-time').textContent = fmt(time);
    $('end-place').textContent = `#${place}`;
    const r = rewards;
    const el = $('end-rewards');
    if (r) {
      const d = this.meta.profile.d;
      const st = r.stats || {};
      const acc = st.shots ? Math.round((st.hits / st.shots) * 100) : 0;
      const statRows = [['Accuracy', st.shots ? `${acc}%` : '—'], ['Headshots', st.heads || 0], ['Damage to players', Math.round(st.damage || 0)], ['Damage to builds', Math.round(st.buildDamage || 0)],
        ['Longest elimination', st.longest ? `${Math.round(st.longest)} m` : '—'], ['Materials harvested', st.harvested || 0], ['Pieces built', st.built || 0], ['Chests opened', st.chests || 0]];
      el.innerHTML = `
        ${r.medals?.length ? `<div class="medal-row">${r.medals.map((m, i) => `<div class="medal-b" style="animation-delay:${0.15 * i}s"><span>${m.icon}</span><b>${m.name}</b>${m.xp ? `<small>+${m.xp} XP</small>` : ''}</div>`).join('')}</div>` : ''}
        <div class="match-stats">${statRows.map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('')}</div>
        <div class="rw-cols">
          <div><div class="card-h">XP earned</div>${r.xp.map(([k, v]) => `<div class="rw"><span>${k}</span><b>+${v}</b></div>`).join('')}<div class="rw total"><span>Total</span><b>+${r.totalXp} XP</b></div></div>
          <div><div class="card-h">Storm Coins</div>${r.coins.map(([k, v]) => `<div class="rw"><span>${k}</span><b>+${v}</b></div>`).join('')}${r.levelUps.length ? `<div class="rw"><span>Level-ups</span><b>+${r.levelUps.reduce((a, e) => a + e.coins, 0)}</b></div>` : ''}<div class="rw total"><span>Total</span><b>${coin}${r.totalCoins + r.levelUps.reduce((a, e) => a + e.coins, 0)}</b></div></div>
        </div>
        <div class="lvl-line"><b>Level ${d.level}</b><div class="xpbar"><i style="width:${(d.xp / xpForLevel(d.level)) * 100}%"></i></div><small>${d.xp} / ${xpForLevel(d.level)}</small></div>
        ${r.arena ? this._arenaCard(r.arena) : ''}
        ${r.levelUps.map((e) => `<div class="lvlup">LEVEL ${e.level}!${e.claim ? ' +1 Battle Pass claim' : ''}</div>`).join('')}`;
    } else el.innerHTML = '';
    this.el.end.classList.toggle('victory', victory);
    this.el.end.classList.remove('hidden');
  }

  // Arena result: hype rows, division bar and any promotion.
  _arenaCard(a) {
    const div = a.division, next = div.next;
    const k = next ? (a.to - div.min) / (next.min - div.min) : 1;
    return `<div class="arena-card" style="--div:${div.color}">
      <div class="ac-h"><span>RANKED</span><b>${div.name}</b><em>${a.from} → ${a.to} points (${a.total >= 0 ? '+' : ''}${a.total})</em></div>
      <div class="ac-rows">${a.rows.map(([n, v]) => `<div class="rw"><span>${n}</span><b class="${v < 0 ? 'neg' : ''}">${v >= 0 ? '+' : ''}${v}</b></div>`).join('')}</div>
      <div class="ac-bar"><i style="width:${Math.max(2, Math.min(100, k * 100))}%"></i></div>
      <small>${next ? `${next.min - a.to} points to ${next.name}` : 'Unreal!'}</small>
      ${a.promoted ? `<div class="lvlup">RANKED UP: ${div.name.toUpperCase()}!</div>` : ''}
    </div>`;
  }

  hideEnd() { this.el.end.classList.add('hidden'); }
  syncGfx() {}
}

