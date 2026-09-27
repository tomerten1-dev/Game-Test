import { DEFAULT_SETTINGS } from '../meta/Profile.js';

const BINDABLE = [
  ['forward', 'Move forward'], ['back', 'Move back'], ['left', 'Move left'], ['right', 'Move right'],
  ['jump', 'Jump'], ['sprint', 'Sprint'], ['crouch', 'Crouch / slide'], ['reload', 'Reload'], ['interact', 'Interact'],
  ['wall', 'Wall'], ['floor', 'Floor'], ['ramp', 'Ramp'], ['cone', 'Cone'], ['build', 'Build mode'], ['edit', 'Edit'], ['ninety', 'Quick 90s'],
  ['map', 'Map'], ['emote', 'Emote'], ['mute', 'Mute'],
];
const SLIDERS = [
  ['sensitivity', 'Mouse sensitivity', 0.3, 3, 0.05, (v) => `${v.toFixed(2)}×`],
  ['fov', 'Field of view', 60, 95, 1, (v) => `${v}°`],
  ['master', 'Master volume', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`],
  ['music', 'Music volume', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`],
  ['hudScale', 'HUD scale', 0.75, 1.3, 0.05, (v) => `${Math.round(v * 100)}%`],
];
const keyName = (code) => code ? code.replace(/^Key/, '').replace(/^Digit/, '').replace('Left', ' L').replace('Right', ' R') : '—';

// Apply saved settings to the running game.
export function applySettings(game) {
  const s = game.meta.profile.d.settings;
  game.input.sensitivity = 0.0022 * s.sensitivity;
  game.rig.baseFov = s.fov;
  game.sound.setVolumes(s.master, s.music);
  document.documentElement.style.setProperty('--hud-scale', String(s.hudScale));
  game.hud?.setSoundViz(!!s.soundViz);
  game.input.applyBindings(s.keys || {});
}

// Settings panel (sliders, toggles, graphics, key bindings). Used in the lobby and pause menu.
export function renderSettings(el, game, { compact = false } = {}) {
  const prof = game.meta.profile;
  const s = prof.d.settings;
  const save = () => { prof.save(); applySettings(game); };
  el.innerHTML = `
    <div class="set-grid">
      ${SLIDERS.map(([k, label, min, max, step]) => `
        <label class="set-row"><span>${label}</span><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${s[k]}"><b data-v="${k}"></b></label>`).join('')}
      <div class="set-row"><span>Graphics</span><div class="seg">${['auto', 'low', 'medium', 'high'].map((q) => `<button data-q="${q}">${q[0].toUpperCase() + q.slice(1)}</button>`).join('')}</div></div>
      <div class="set-row"><span>Visualize sound</span><div class="seg"><button data-sv="0">Off</button><button data-sv="1">On</button></div></div>
    </div>
    ${compact ? '' : `<div class="set-sub">Key bindings <small>click a key, then press the new one</small></div>
    <div class="binds">${BINDABLE.map(([a, label]) => `<div class="bind"><span>${label}</span><button data-bind="${a}"></button></div>`).join('')}</div>
    <div class="set-actions"><button class="lb-btn" data-act="keys">Reset keys</button><button class="lb-btn danger" data-act="wipe">Reset all progress</button></div>`}`;
  const sync = () => {
    for (const [k, , , , , fmt] of SLIDERS) el.querySelector(`[data-v="${k}"]`).textContent = fmt(Number(s[k]));
    const q = game.quality?.setting || 'auto';
    el.querySelectorAll('[data-q]').forEach((b) => b.classList.toggle('on', b.dataset.q === q));
    el.querySelectorAll('[data-sv]').forEach((b) => b.classList.toggle('on', (b.dataset.sv === '1') === !!s.soundViz));
    el.querySelectorAll('[data-bind]').forEach((b) => { b.textContent = keyName(game.input.keyFor(b.dataset.bind)); b.classList.remove('wait'); });
  };
  el.querySelectorAll('input[type=range]').forEach((inp) => inp.addEventListener('input', () => { s[inp.dataset.k] = Number(inp.value); save(); sync(); }));
  el.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); game.quality.set(b.dataset.q); s.quality = b.dataset.q; save(); sync(); }));
  el.querySelectorAll('[data-sv]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); s.soundViz = b.dataset.sv === '1'; save(); sync(); }));
  el.querySelectorAll('[data-bind]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    b.textContent = 'press a key…';
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
  el.querySelector('[data-act="keys"]')?.addEventListener('click', (e) => { e.stopPropagation(); s.keys = {}; save(); sync(); });
  el.querySelector('[data-act="wipe"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!window.confirm('Reset level, coins, locker and stats? This cannot be undone.')) return;
    prof.reset();
    Object.assign(prof.d.settings, DEFAULT_SETTINGS);
    applySettings(game);
    game.menus?.refresh();
  });
  sync();
}
