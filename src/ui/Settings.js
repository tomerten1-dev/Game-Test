import { keyLabel } from '../core/Input.js';
import { DEFAULT_SETTINGS } from '../meta/Profile.js';
import { VARIANT_KEY } from '../world/Variant.js';

const BINDABLE = [
  ['fire', 'Shoot / use'], ['aim', 'Aim / zoom'],
  ['forward', 'Move forward'], ['back', 'Move back'], ['left', 'Move left'], ['right', 'Move right'],
  ['jump', 'Jump'], ['sprint', 'Sprint'], ['crouch', 'Crouch / slide'], ['reload', 'Reload'], ['interact', 'Interact'],
  ['wall', 'Wall'], ['floor', 'Floor'], ['ramp', 'Ramp'], ['cone', 'Cone'], ['build', 'Build mode'], ['edit', 'Edit'], ['ninety', 'Quick 90s'],
  ['map', 'Map'], ['emote', 'Emote'], ['mute', 'Mute'],
  ['slot1', 'Harvesting tool'], ['slot2', 'Weapon slot 2'], ['slot3', 'Weapon slot 3'], ['slot4', 'Weapon slot 4'], ['slot5', 'Weapon slot 5'], ['slot6', 'Weapon slot 6'],
  ['inventory', 'Inventory'], ['drop', 'Drop held item'], ['ping', 'Ping (also middle mouse)'], ['shoulder', 'Swap camera shoulder'], ['autorun', 'Auto-run'], ['buildmat', 'Change build material'], ['resetEdit', 'Reset edit'],
];
const SLIDERS = [
  ['sensitivity', 'Mouse sensitivity', 0.3, 3, 0.05, (v) => `${v.toFixed(2)}×`],
  ['fov', 'Field of view', 60, 95, 1, (v) => `${v}°`],
  ['master', 'Master volume', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`],
  ['music', 'Music volume', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`],
  ['sfx', 'Effects volume', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`],
  ['uiVol', 'Interface & voice volume', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`],
  ['hudScale', 'HUD scale', 0.75, 1.3, 0.05, (v) => `${Math.round(v * 100)}%`],
];
const keyName = keyLabel;
// on/off gameplay options (missing from older saves = on)
const TOGGLES = [['autoPickup', 'Auto pick up weapons'], ['stackDamage', 'Stack damage numbers'], ['autoSort', 'Auto sort consumables right'],
  ['weaponReticles', 'Crosshair changes per weapon'], ['throwArc', 'Show throw arc'], ['legacyHitSound', 'Legacy headshot sound', false],
  ['sprintByDefault', 'Sprint by default (sprint key walks)', false], ['toggleSprint', 'Toggle sprint (instead of hold)', false],
  ['tapToSearch', 'Tap to search (no holding)', false], ['holdToSwap', 'Hold to swap when inventory is full', false],
  ['questTracker', 'Quest tracker in matches'], ['showMinimap', 'Show minimap'], ['showCompass', 'Show compass'], ['showKillfeed', 'Show kill feed'], ['showFps', 'FPS counter', false],
  ['simpleBuild', 'Simple Build (fire: wall · aim: floor / ramp / cone by where you look)', false], ['preEdits', 'Pre-edits (edit in build mode to pre-shape the piece)'], ['editOnRelease', 'Confirm edit on release', false]];
// preferred inventory slot per kind of gun (0 = any)
const PREF_ROWS = [['shotgun', 'Shotgun slot'], ['rifle', 'Assault rifle slot'], ['smg', 'SMG / pistol slot'], ['sniper', 'Sniper slot'], ['explosive', 'Explosive slot']];
const TOGGLE_DEFAULT = Object.fromEntries(TOGGLES.map(([k, , d = true]) => [k, d]));
// A saved on/off setting (missing = its default).
export const setting = (game, k, def = TOGGLE_DEFAULT[k] ?? true) => { const v = game.meta?.profile?.d?.settings?.[k]; return v === undefined ? def : v !== false; };

// Apply saved settings to the running game.
export function applySettings(game) {
  const s = game.meta.profile.d.settings;
  game.input.sensitivity = 0.0022 * s.sensitivity;
  game.rig.baseFov = s.fov;
  game.sound.setVolumes(s.master, s.music, s.sfx ?? 1, s.uiVol ?? 1);
  document.documentElement.style.setProperty('--hud-scale', String(s.hudScale));
  game.hud?.setSoundViz(!!s.soundViz);
  if (game.effects) game.effects.stackDamage = s.stackDamage !== false;
  for (const [k, cls] of [['showMinimap', 'no-minimap'], ['showCompass', 'no-compass'], ['showKillfeed', 'no-killfeed']]) document.body.classList.toggle(cls, !setting(game, k));
  game.hud?.applyLayout?.(s.hudOffsets || {});
  game.input.applyBindings(s.keys || {});
}

// Settings are split into tabs like Fortnite's settings screen.
export const SETTING_TABS = [['game', 'Game'], ['video', 'Video'], ['audio', 'Audio'], ['hud', 'HUD'], ['keys', 'Keybinds']];
const SLIDER_TAB = { sensitivity: 'game', fov: 'video', master: 'audio', music: 'audio', sfx: 'audio', uiVol: 'audio', hudScale: 'hud' };
const TOGGLE_TAB = {
  autoPickup: 'game', autoSort: 'game', sprintByDefault: 'game', toggleSprint: 'game', tapToSearch: 'game', holdToSwap: 'game', simpleBuild: 'game', preEdits: 'game', editOnRelease: 'game',
  legacyHitSound: 'audio',
  stackDamage: 'hud', weaponReticles: 'hud', throwArc: 'hud', questTracker: 'hud', showMinimap: 'hud', showCompass: 'hud', showKillfeed: 'hud', showFps: 'hud',
};
let curTab = 'game';

// Settings panel with tabs (Game / Video / Audio / HUD / Keybinds). Used in the lobby and the pause
// menu (compact: without the lobby-only rows - island season and resetting progress).
export function renderSettings(el, game, { compact = false } = {}) {
  const prof = game.meta.profile;
  const s = prof.d.settings;
  const save = () => { prof.save(); applySettings(game); };
  const t = curTab;
  const seg = (label, buttons) => `<div class="set-row"><span>${label}</span><div class="seg">${buttons}</div></div>`;
  const onOff = (attr) => `<button ${attr} data-val="0">Off</button><button ${attr} data-val="1">On</button>`;
  const rows = [];
  for (const [k, label, min, max, step] of SLIDERS) if (SLIDER_TAB[k] === t) rows.push(`<label class="set-row"><span>${label}</span><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${s[k]}"><b data-v="${k}"></b></label>`);
  if (t === 'video') {
    rows.push(seg('Graphics quality', ['auto', 'low', 'medium', 'high'].map((q) => `<button data-q="${q}">${q[0].toUpperCase() + q.slice(1)}</button>`).join('')));
    if (!compact) rows.push(seg('Island season', [['auto', 'Auto'], ['summer', 'Summer'], ['winter', 'Winter'], ['desert', 'Desert']].map(([k, n]) => `<button data-island="${k}">${n}</button>`).join('')),
      '<div class="set-row island-note hidden"><span></span><div class="seg"><button data-act="reload">Reload to build the new island</button></div></div>');
  }
  if (t === 'audio') rows.push(seg('Visualize sound', '<button data-sv="0">Off</button><button data-sv="1">On</button>'));
  for (const [k, label] of TOGGLES) if (TOGGLE_TAB[k] === t) rows.push(seg(label, onOff(`data-tog="${k}"`)));
  if (t === 'game') for (const [k, label] of PREF_ROWS) rows.push(seg(label, [0, 2, 3, 4, 5, 6].map((n) => `<button data-pref="${k}" data-n="${n}">${n || 'Any'}</button>`).join('')));
  if (t === 'hud') rows.push(seg('HUD layout', '<button data-act="hudedit">Edit layout</button><button data-act="hudreset">Reset</button>'));
  el.innerHTML = `
    <div class="set-tabs">${SETTING_TABS.map(([k, n]) => `<button data-stab="${k}" class="${k === t ? 'on' : ''}">${n}</button>`).join('')}</div>
    ${t === 'keys' ? `<div class="set-sub">Key bindings <small>click a key, then press the new one</small></div>
    <div class="binds">${BINDABLE.map(([a, label]) => `<div class="bind"><span>${label}</span><button data-bind="${a}"></button></div>`).join('')}</div>
    <div class="set-actions"><button class="lb-btn" data-act="keys">Reset keys</button></div>`
    : `<div class="set-grid">${rows.join('')}</div>`}
    ${t === 'game' && !compact ? '<div class="set-actions"><button class="lb-btn danger" data-act="wipe">Reset all progress</button></div>' : ''}`;
  el.querySelectorAll('[data-stab]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); curTab = b.dataset.stab; game.sound?.play?.('click'); renderSettings(el, game, { compact }); }));
  const sync = () => {
    for (const [k, , , , , fmt] of SLIDERS) { const v = el.querySelector(`[data-v="${k}"]`); if (v) v.textContent = fmt(Number(s[k])); }
    const q = game.quality?.setting || 'auto';
    el.querySelectorAll('[data-q]').forEach((b) => b.classList.toggle('on', b.dataset.q === q));
    el.querySelectorAll('[data-sv]').forEach((b) => b.classList.toggle('on', (b.dataset.sv === '1') === !!s.soundViz));
    el.querySelectorAll('[data-island]').forEach((b) => b.classList.toggle('on', b.dataset.island === (s.island || 'auto')));
    el.querySelectorAll('[data-pref]').forEach((b) => b.classList.toggle('on', +b.dataset.n === (s.prefSlots?.[b.dataset.pref] || 0)));
    el.querySelectorAll('[data-tog]').forEach((b) => b.classList.toggle('on', (b.dataset.val === '1') === (s[b.dataset.tog] === undefined ? TOGGLE_DEFAULT[b.dataset.tog] : s[b.dataset.tog] !== false)));
    const want = s.island && s.island !== 'auto' ? s.island : null;
    el.querySelector('.island-note')?.classList.toggle('hidden', !want || want === VARIANT_KEY);
    el.querySelectorAll('[data-bind]').forEach((b) => { b.textContent = keyName(game.input.keyFor(b.dataset.bind)); b.classList.remove('wait'); });
  };
  el.querySelectorAll('input[type=range]').forEach((inp) => inp.addEventListener('input', () => { s[inp.dataset.k] = Number(inp.value); save(); sync(); }));
  el.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); game.quality.set(b.dataset.q); s.quality = b.dataset.q; save(); sync(); }));
  el.querySelectorAll('[data-sv]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); s.soundViz = b.dataset.sv === '1'; save(); sync(); }));
  el.querySelectorAll('[data-pref]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); s.prefSlots = { ...(s.prefSlots || {}), [b.dataset.pref]: +b.dataset.n }; save(); sync(); }));
  el.querySelector('[data-act="hudreset"]')?.addEventListener('click', (e) => { e.stopPropagation(); s.hudOffsets = {}; save(); game.hud?.toast?.('HUD layout reset'); });
  el.querySelector('[data-act="hudedit"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (game.state !== 'playing') { game.hud?.toast?.('Start a match, then use Edit layout from the pause menu'); return; }
    const pause = game.menus?.el?.pause;
    pause?.classList.add('hidden');
    game.hud.editLayout((offsets) => { s.hudOffsets = offsets; save(); pause?.classList.remove('hidden'); });
  });
  el.querySelectorAll('[data-tog]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); s[b.dataset.tog] = b.dataset.val === '1'; save(); sync(); }));
  el.querySelectorAll('[data-bind]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    b.textContent = 'press a key or mouse button…';
    b.classList.add('wait');
    game.input.capture = (code) => {
      if (code !== 'Escape') {
        s.keys = { ...s.keys, [b.dataset.bind]: code };
        // a key can only do one thing: drop it from other actions
        for (const [a, c] of Object.entries(s.keys)) if (a !== b.dataset.bind && c === code) delete s.keys[a];
        save();
      }
      sync();
    };
  }));
  el.querySelectorAll('[data-island]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); s.island = b.dataset.island; save(); sync(); }));
  el.querySelector('[data-act="reload"]')?.addEventListener('click', (e) => { e.stopPropagation(); window.location.reload(); });
  el.querySelector('[data-act="keys"]')?.addEventListener('click', (e) => { e.stopPropagation(); s.keys = {}; save(); sync(); });
  el.querySelector('[data-act="wipe"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!window.confirm('Reset level, coins, locker and stats? This cannot be undone.')) return;
    prof.reset();
    Object.assign(prof.d.settings, DEFAULT_SETTINGS);
    game.sound.lobbyPick = null;
    applySettings(game);
    game.menus?.refresh();
  });
  sync();
}
