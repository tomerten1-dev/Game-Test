// Web Audio: CC0 Kenney samples for the main sounds (public/audio), a small synth for the
// rest and as a fallback if a sample can't be decoded.

// CC0 music (public/audio/music, see CREDITS.md). Loops fade in and out; jingles play once.
const MUSIC_TRACKS = { lobby: { loop: true, gain: 0.8 }, bus: { loop: true, gain: 0.7 }, endgame: { loop: true, gain: 0.7 }, victory: { loop: false, gain: 1 }, defeat: { loop: false, gain: 1 } };
const SAMPLE_FILES = ['blaster', 'blaster_repeater', 'enemy_destroy', 'enemy_hurt', 'jump_a', 'jump_b', 'jump_c', 'land', 'walking', 'weapon_change', 'coin', 'break', 'fall', 'impact', 'engine', 'ui-tap', 'build'];
// sound name -> [sample, playbackRate, gain, (optional) synth layer too]
const SAMPLE_MAP = {
  pistol: ['blaster', 1.05, 0.8],
  smg: ['blaster_repeater', 1.2, 0.6],
  ar: ['blaster_repeater', 0.88, 0.75, true],
  burst: ['blaster_repeater', 1.0, 0.7, true],
  shotgun: ['blaster', 0.62, 1.0, true],
  pump: ['blaster', 0.55, 1.1, true],
  sniper: ['blaster', 0.45, 1.1, true],
  rocket: ['blaster', 0.4, 0.7, true],
  explosion: ['impact', 0.55, 1.2, true],
  jump: ['jump_a', 1, 0.45],
  land: ['land', 1, 0.6],
  fall: ['fall', 1, 0.8, true],
  elim: ['enemy_destroy', 1, 0.8, true],
  break: ['break', 1, 0.8],
  pickup: ['coin', 1.1, 0.45],
  ammo: ['coin', 1.35, 0.35],
  buy: ['coin', 0.9, 0.6],
  reload: ['weapon_change', 1, 0.6],
  reloaded: ['weapon_change', 1.3, 0.45],
  click: ['ui-tap', 1.1, 0.5],
  build: ['build', 0.8, 0.7],
  harvest_wood: ['build', 1.25, 0.6],
  bounce: ['land', 1.6, 0.4],
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.volume = 0.55;
    this.musicVolume = 0.5;
    this.musicName = null;
    this.listener = null; // THREE.Vector3 (camera position)
    this.right = { x: 1, y: 0, z: 0 }; // listener right vector for stereo panning
    const unlock = () => this.ensure();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.master);
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.loadSamples();
    // music asked for before audio was unlocked: start it now
    if (this.musicName && !this._track) { const n = this.musicName; this.musicName = null; this.music(n); }
    return this.ctx;
  }

  // Keep the stereo "right" vector in sync with the camera.
  updateListener(camera) {
    const e = camera.matrixWorld.elements;
    this.right = { x: e[0], y: e[1], z: e[2] };
    this.up = { x: e[4], y: e[5], z: e[6] };
    this.back = { x: e[8], y: e[9], z: e[10] };
  }

  // Soft shimmering loop that swells as you get close to an unopened chest.
  chestHum(chest, pos) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (!this._hum) {
      const ctx = this.ctx;
      const g = ctx.createGain();
      g.gain.value = 0;
      const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
      lfo.frequency.value = 5; lfoG.gain.value = 12;
      lfo.connect(lfoG);
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      for (const f of [880, 1318.5, 1760]) {
        const o = ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = f;
        lfoG.connect(o.frequency);
        const og = ctx.createGain(); og.gain.value = f === 880 ? 0.5 : 0.25;
        o.connect(og); og.connect(g); o.start();
      }
      lfo.start();
      g.connect(pan); pan.connect(this.master);
      this._hum = { g, pan };
    }
    let target = 0;
    if (chest && !this.muted) {
      const dx = chest.x - pos.x, dz = chest.z - pos.z;
      const d = Math.hypot(dx, dz);
      target = Math.max(0, 1 - d / 18) ** 1.5 * 0.05;
      if (this._hum.pan.pan) this._hum.pan.pan.value = Math.max(-1, Math.min(1, (dx * this.right.x + dz * this.right.z) / (d || 1))) * 0.8;
    }
    this._hum.g.gain.setTargetAtTime(target, this.ctx.currentTime, 0.2);
  }

  // Fetch + decode the CC0 samples (after the audio context exists).
  async loadSamples() {
    if (this._loading || !this.ctx) return;
    this._loading = true;
    this.buffers = {};
    await Promise.all(SAMPLE_FILES.map(async (n) => {
      try {
        const res = await fetch(`/audio/${n}.ogg`);
        this.buffers[n] = await this.ctx.decodeAudioData(await res.arrayBuffer());
      } catch { /* keep the synth version */ }
    }));
  }

  _sample(name, t, { rate = 1, gain = 1, offset = 0, dur } = {}) {
    const buf = this.buffers?.[name];
    if (!buf) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * (0.94 + Math.random() * 0.12);
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g); g.connect(this._out || this.master);
    if (dur) {
      g.gain.setValueAtTime(gain, t + dur * 0.7);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      src.start(t, offset, dur + 0.02);
    } else src.start(t, offset);
    return true;
  }

  // Engine drone while riding the bus.
  busEngine(on) {
    if (!this.ctx || this.ctx.state !== 'running' || !this.buffers?.engine) return;
    if (on && !this._engine) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers.engine; src.loop = true; src.playbackRate.value = 0.7;
      const g = this.ctx.createGain(); g.gain.value = 0.18;
      src.connect(g); g.connect(this.master); src.start();
      this._engine = { src, g };
    } else if (!on && this._engine) {
      this._engine.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
      const e = this._engine; setTimeout(() => e.src.stop(), 1200);
      this._engine = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    return this.muted;
  }

  // master: 0..1 (UI slider), music: 0..1
  setVolumes(master, music) {
    this.volume = 0.7 * master;
    this.musicVolume = music * 0.6;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    if (this.musicGain) this.musicGain.gain.value = this.musicVolume;
  }

  _loadTrack(name) {
    this._trackBufs ||= {};
    if (!this._trackBufs[name]) {
      this._trackBufs[name] = fetch(`/audio/music/${name}.ogg`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
        .then((b) => this.ctx.decodeAudioData(b))
        .catch(() => null);
    }
    return this._trackBufs[name];
  }

  _stopTrack(fade = 1.2) {
    const tr = this._track;
    this._track = null;
    if (!tr || !this.ctx) return;
    const t = this.ctx.currentTime;
    tr.g.gain.cancelScheduledValues(t);
    tr.g.gain.setValueAtTime(tr.g.gain.value, t);
    tr.g.gain.linearRampToValueAtTime(0.0001, t + fade);
    tr.src.stop(t + fade + 0.05);
  }

  // Music: a CC0 track when there is one (falls back to the procedural lobby loop / synth stings).
  music(name) {
    if (name === this.musicName) return;
    this.musicName = name;
    clearInterval(this._musicTimer);
    this._musicTimer = null;
    this._stopTrack(name === 'victory' || name === 'defeat' ? 0.3 : 1.2);
    if (!name) return;
    const cfg = MUSIC_TRACKS[name];
    if (cfg && this.ctx) {
      this._loadTrack(name).then((buf) => {
        if (this.musicName !== name || this._track) return;
        if (!buf) { this._proceduralMusic(name); return; }
        const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
        src.buffer = buf;
        src.loop = cfg.loop;
        const t = this.ctx.currentTime;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(cfg.gain, t + (cfg.loop ? 1.5 : 0.05));
        src.connect(g); g.connect(this.musicGain);
        src.start(t);
        src.onended = () => { if (this._track?.src === src) { this._track = null; if (!cfg.loop && this.musicName === name) this.musicName = null; } };
        this._track = { src, g, name };
      });
      return;
    }
    this._proceduralMusic(name);
  }

  _proceduralMusic(name) {
    if (name === 'victory' || name === 'defeat') { this.play(name); return; }
    if (name !== 'lobby') return;
    this._bar = 0;
    const tick = () => {
      if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
      if (this.musicName === 'lobby') this._lobbyBar();
    };
    this._musicTimer = setInterval(tick, 2400);
    tick();
  }

  _note(t, freq, dur, type, gain, attack = 0.02) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // One 2.4 s bar: soft pad chord, bass, and a bouncy arpeggio (I–V–vi–IV in C).
  _lobbyBar() {
    const t = this.ctx.currentTime + 0.05;
    const chords = [[261.6, 329.6, 392.0], [196.0, 246.9, 293.7], [220.0, 261.6, 329.6], [174.6, 220.0, 261.6]];
    const ch = chords[this._bar % 4];
    this._bar++;
    for (const f of ch) this._note(t, f, 2.3, 'triangle', 0.05, 0.25);
    this._note(t, ch[0] / 2, 1.1, 'sine', 0.12, 0.01);
    this._note(t + 1.2, ch[0] / 2, 1.1, 'sine', 0.1, 0.01);
    const arp = [0, 1, 2, 1, 2, 0, 2, 1];
    arp.forEach((k, i) => this._note(t + i * 0.3, ch[k] * 2, 0.26, 'square', 0.022, 0.005));
    // soft hat
    if (this.noise) for (let i = 0; i < 8; i++) {
      const src = this.ctx.createBufferSource(); src.buffer = this.noise;
      const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      const g = this.ctx.createGain(); const tt = t + i * 0.3 + 0.15;
      g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(i % 2 ? 0.03 : 0.015, tt + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.08);
      src.connect(f); f.connect(g); g.connect(this.musicGain); src.start(tt, Math.random() * 0.5); src.stop(tt + 0.1);
    }
  }

  // Drop-in sting when the bus takes off.
  sting() {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
    const t = this.ctx.currentTime + 0.02;
    [392, 523.3, 659.3, 784, 1046.5].forEach((f, i) => this._note(t + i * 0.09, f, 0.5, 'square', 0.035, 0.005));
    this._note(t + 0.45, 196, 1.2, 'triangle', 0.12, 0.02);
    this._note(t + 0.45, 392, 1.2, 'triangle', 0.08, 0.02);
  }

  _vol(pos, range = 90) {
    if (!pos || !this.listener) return 1;
    const d = this.listener.distanceTo(pos);
    return Math.max(0, 1 - d / range) ** 1.6;
  }

  _noise(t, dur, { type = 'lowpass', freq = 2000, q = 0.7, gain = 1, attack = 0.002, freqEnd } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this._out || this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  _tone(t, dur, { type = 'sine', freq = 440, freqEnd, gain = 0.3, attack = 0.005 } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this._out || this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  play(name, pos = null, opts = {}) {
    // visual sound cues work even when muted or before audio is unlocked
    if (pos && this.onPositional) {
      const vv = this._vol(pos, opts.range || 110) * (opts.vol ?? 1);
      if (vv > 0.02) this.onPositional(name, pos, vv);
    }
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    let v = pos ? this._vol(pos, opts.range || 110) : 1;
    if (opts.vol != null) v *= opts.vol;
    if (v <= 0.01) return;
    // positional sounds pan left/right relative to the camera
    this._out = null;
    // positional sounds use HRTF 3D panning, so you can tell in front from behind and above from below
    // (loudness still comes from our own distance falloff, the panner only gives direction)
    if (pos && this.listener) {
      const dx = pos.x - this.listener.x, dy = pos.y - this.listener.y, dz = pos.z - this.listener.z;
      const d = Math.hypot(dx, dy, dz) || 1;
      const r = this.right, u = this.up, b = this.back;
      if (ctx.createPanner && u && b && d > 1.5) {
        const pan = ctx.createPanner();
        pan.panningModel = 'HRTF';
        pan.distanceModel = 'linear';
        pan.rolloffFactor = 0;
        const lx = (dx * r.x + dy * r.y + dz * r.z) / d, ly = (dx * u.x + dy * u.y + dz * u.z) / d, lz = (dx * b.x + dy * b.y + dz * b.z) / d;
        if (pan.positionX) { pan.positionX.value = lx; pan.positionY.value = ly; pan.positionZ.value = lz; } else pan.setPosition(lx, ly, lz);
        pan.connect(this.master);
        this._out = pan;
      } else if (ctx.createStereoPanner) {
        const pan = ctx.createStereoPanner();
        pan.pan.value = Math.max(-1, Math.min(1, (dx * r.x + dz * r.z) / d)) * 0.85;
        pan.connect(this.master);
        this._out = pan;
      }
    }
    // recorded CC0 sample first (footsteps use short slices of Kenney's walking loop)
    if (name === 'step' && this.buffers?.walking) {
      const d = this.buffers.walking.duration;
      if (this._sample('walking', t, { rate: 1, gain: 0.9 * v, offset: Math.floor(Math.random() * (d / 0.42)) * 0.42, dur: 0.22 })) return;
    }
    if (name === 'jump' && this.buffers?.jump_a) { this._sample(['jump_a', 'jump_b', 'jump_c'][Math.floor(Math.random() * 3)], t, { gain: 0.45 * v }); return; }
    const sm = SAMPLE_MAP[name];
    if (sm && this._sample(sm[0], t, { rate: sm[1], gain: sm[2] * v }) && !sm[3]) return;
    switch (name) {
      case 'pistol':
        this._noise(t, 0.16, { freq: 3200, freqEnd: 500, gain: 0.6 * v });
        this._tone(t, 0.08, { type: 'square', freq: 220, freqEnd: 70, gain: 0.25 * v });
        break;
      case 'ar':
      case 'burst':
        this._noise(t, 0.2, { freq: 2600, freqEnd: 400, gain: 0.65 * v });
        this._tone(t, 0.1, { type: 'sawtooth', freq: 160, freqEnd: 50, gain: 0.25 * v });
        break;
      case 'smg':
        this._noise(t, 0.11, { freq: 4000, freqEnd: 800, gain: 0.45 * v });
        this._tone(t, 0.06, { type: 'square', freq: 260, freqEnd: 90, gain: 0.15 * v });
        break;
      case 'shotgun':
      case 'pump':
        this._noise(t, 0.45, { freq: 1800, freqEnd: 200, gain: 0.9 * v });
        this._tone(t, 0.25, { type: 'sine', freq: 110, freqEnd: 35, gain: 0.6 * v });
        break;
      case 'hit':
        this._tone(t, 0.07, { type: 'triangle', freq: 1400, freqEnd: 1100, gain: 0.18 });
        break;
      case 'headshot':
        this._tone(t, 0.18, { type: 'sine', freq: 1900, gain: 0.2 });
        this._tone(t + 0.04, 0.2, { type: 'sine', freq: 2600, gain: 0.14 });
        break;
      case 'shieldHit':
        this._tone(t, 0.1, { type: 'triangle', freq: 900, freqEnd: 1300, gain: 0.15 });
        break;
      case 'hurt':
        this._noise(t, 0.2, { type: 'bandpass', freq: 500, q: 1.5, gain: 0.5 });
        this._tone(t, 0.15, { type: 'sawtooth', freq: 180, freqEnd: 90, gain: 0.12 });
        break;
      case 'impact':
        this._noise(t, 0.06, { type: 'highpass', freq: 3000, gain: 0.15 * v });
        break;
      case 'reload':
        this._noise(t, 0.05, { type: 'bandpass', freq: 2500, q: 3, gain: 0.35 });
        this._noise(t + 0.18, 0.06, { type: 'bandpass', freq: 1800, q: 3, gain: 0.4 });
        break;
      case 'reloaded':
        this._noise(t, 0.05, { type: 'bandpass', freq: 3200, q: 4, gain: 0.35 });
        break;
      case 'empty':
        this._tone(t, 0.04, { type: 'square', freq: 900, gain: 0.08 });
        break;
      case 'chest':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this._tone(t + i * 0.07, 0.35, { type: 'triangle', freq: f, gain: 0.16 * v }));
        this._noise(t, 0.6, { type: 'highpass', freq: 6000, gain: 0.08 * v, attack: 0.2 });
        break;
      case 'pickup':
        this._tone(t, 0.1, { type: 'sine', freq: 660, freqEnd: 990, gain: 0.2 });
        break;
      case 'heal':
        [440, 554, 659].forEach((f, i) => this._tone(t + i * 0.08, 0.25, { type: 'sine', freq: f, gain: 0.15 }));
        break;
      case 'shield':
        [523, 784, 1047].forEach((f, i) => this._tone(t + i * 0.08, 0.3, { type: 'triangle', freq: f, gain: 0.14 }));
        break;
      case 'build':
        this._noise(t, 0.12, { type: 'lowpass', freq: 900, gain: 0.5 * v });
        this._tone(t, 0.12, { type: 'sine', freq: 180, freqEnd: 90, gain: 0.35 * v });
        break;
      case 'break':
        this._noise(t, 0.35, { type: 'lowpass', freq: 1200, freqEnd: 200, gain: 0.6 * v });
        break;
      case 'elim':
        this._tone(t, 0.12, { type: 'square', freq: 880, gain: 0.12 });
        this._tone(t + 0.1, 0.3, { type: 'square', freq: 1320, gain: 0.12 });
        this._noise(t, 0.4, { freq: 800, freqEnd: 100, gain: 0.3 });
        break;
      case 'jump':
        this._noise(t, 0.15, { type: 'bandpass', freq: 700, q: 1, gain: 0.08 * v });
        break;
      case 'glider':
        this._noise(t, 0.5, { type: 'bandpass', freq: 400, freqEnd: 1400, q: 1, gain: 0.25, attack: 0.1 });
        break;
      case 'storm':
        this._tone(t, 0.3, { type: 'sawtooth', freq: 70, freqEnd: 55, gain: 0.18 });
        this._noise(t, 0.3, { type: 'bandpass', freq: 300, gain: 0.2 });
        break;
      case 'bus':
        this._tone(t, 0.6, { type: 'triangle', freq: 392, gain: 0.2 });
        this._tone(t + 0.25, 0.8, { type: 'triangle', freq: 523, gain: 0.2 });
        break;
      case 'click':
        this._tone(t, 0.05, { type: 'triangle', freq: 1200, gain: 0.1 });
        break;
      case 'door': // wooden creak + latch knock
        this._tone(t, 0.32, { type: 'sawtooth', freq: 190, freqEnd: 260, gain: 0.05 * v, attack: 0.04 });
        this._noise(t, 0.3, { type: 'bandpass', freq: 700, freqEnd: 1100, q: 4, gain: 0.12 * v, attack: 0.05 });
        this._noise(t + 0.3, 0.08, { type: 'lowpass', freq: 500, gain: 0.35 * v });
        break;
      case 'glass': // shatter: bright noise burst + tinkles
        this._noise(t, 0.28, { type: 'highpass', freq: 2500, freqEnd: 5000, gain: 0.4 * v });
        for (let i = 0; i < 5; i++) this._tone(t + 0.03 + i * 0.045, 0.12, { type: 'sine', freq: 2600 + Math.random() * 2400, gain: 0.05 * v });
        break;
      case 'victory':
        [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this._tone(t + i * 0.13, 0.4, { type: 'triangle', freq: f, gain: 0.2 }));
        break;
      case 'defeat':
        [392, 330, 262, 196].forEach((f, i) => this._tone(t + i * 0.18, 0.5, { type: 'triangle', freq: f, gain: 0.18 }));
        break;
      case 'step':
        this._noise(t, 0.07, { type: 'bandpass', freq: 380 + Math.random() * 160, q: 1.2, gain: 0.22 * v });
        break;
      case 'slide':
        this._noise(t, 0.6, { type: 'bandpass', freq: 900, freqEnd: 300, q: 0.8, gain: 0.3 * v, attack: 0.03 });
        break;
      case 'fall':
        this._noise(t, 0.25, { type: 'lowpass', freq: 500, freqEnd: 120, gain: 0.6 * v });
        this._tone(t, 0.2, { type: 'sine', freq: 120, freqEnd: 50, gain: 0.4 * v });
        break;
      case 'swing':
        this._noise(t, 0.18, { type: 'bandpass', freq: 600, freqEnd: 2400, q: 1.5, gain: 0.22 * v, attack: 0.04 });
        break;
      case 'harvest_wood':
        this._tone(t, 0.12, { type: 'triangle', freq: 260, freqEnd: 140, gain: 0.35 * v });
        this._noise(t, 0.1, { type: 'bandpass', freq: 900, q: 2, gain: 0.4 * v });
        break;
      case 'harvest_stone':
        this._noise(t, 0.12, { type: 'highpass', freq: 2200, gain: 0.35 * v });
        this._tone(t, 0.08, { type: 'square', freq: 520, freqEnd: 300, gain: 0.12 * v });
        break;
      case 'harvest_metal':
        this._tone(t, 0.35, { type: 'triangle', freq: 1250, gain: 0.16 * v });
        this._tone(t, 0.3, { type: 'sine', freq: 1870, gain: 0.1 * v });
        break;
      case 'ammo':
        this._noise(t, 0.04, { type: 'bandpass', freq: 3500, q: 4, gain: 0.3 });
        this._noise(t + 0.06, 0.04, { type: 'bandpass', freq: 3000, q: 4, gain: 0.25 });
        break;
      case 'use':
        this._noise(t, 0.3, { type: 'bandpass', freq: 1500, q: 2, gain: 0.15, attack: 0.05 });
        break;
      case 'sniper':
        this._noise(t, 0.5, { freq: 3800, freqEnd: 300, gain: 0.95 * v });
        this._tone(t, 0.3, { type: 'sawtooth', freq: 140, freqEnd: 40, gain: 0.35 * v });
        this._noise(t + 0.12, 0.6, { type: 'bandpass', freq: 600, freqEnd: 200, q: 0.8, gain: 0.25 * v, attack: 0.05 });
        break;
      case 'rocket':
        this._noise(t, 0.7, { type: 'bandpass', freq: 900, freqEnd: 2600, q: 0.7, gain: 0.6 * v, attack: 0.03 });
        this._tone(t, 0.25, { type: 'sine', freq: 90, freqEnd: 50, gain: 0.5 * v });
        break;
      case 'explosion':
        this._noise(t, 1.2, { freq: 1400, freqEnd: 80, gain: 1.2 * v });
        this._tone(t, 0.7, { type: 'sine', freq: 70, freqEnd: 28, gain: 0.9 * v });
        this._noise(t + 0.05, 0.4, { type: 'highpass', freq: 2500, gain: 0.3 * v });
        break;
      case 'throw':
        this._noise(t, 0.2, { type: 'bandpass', freq: 800, freqEnd: 2200, q: 1.2, gain: 0.25 * v, attack: 0.03 });
        break;
      case 'bounce':
        this._tone(t, 0.07, { type: 'triangle', freq: 520, freqEnd: 300, gain: 0.25 * v });
        break;
      case 'launch':
        this._tone(t, 0.6, { type: 'sine', freq: 180, freqEnd: 900, gain: 0.3 * v, attack: 0.02 });
        this._noise(t, 0.8, { type: 'bandpass', freq: 500, freqEnd: 2000, q: 0.6, gain: 0.35 * v, attack: 0.05 });
        break;
      case 'jumppad':
        this._tone(t, 0.3, { type: 'square', freq: 220, freqEnd: 660, gain: 0.12 * v });
        this._tone(t + 0.05, 0.3, { type: 'sine', freq: 440, freqEnd: 1320, gain: 0.15 * v });
        break;
      case 'buy':
        [784, 988, 1319].forEach((f, i) => this._tone(t + i * 0.06, 0.2, { type: 'square', freq: f, gain: 0.08 }));
        break;
      case 'supply':
        [392, 523, 659, 784].forEach((f, i) => this._tone(t + i * 0.12, 0.5, { type: 'triangle', freq: f, gain: 0.16 }));
        break;
      case 'shieldBreak':
        this._noise(t, 0.35, { type: 'highpass', freq: 3500, gain: 0.5, attack: 0.002 });
        [1760, 1318, 988].forEach((f, i) => this._tone(t + i * 0.04, 0.25, { type: 'triangle', freq: f, freqEnd: f * 0.7, gain: 0.12 }));
        break;
      case 'ping':
        this._tone(t, 0.12, { type: 'sine', freq: 1320, gain: 0.14 });
        this._tone(t + 0.1, 0.2, { type: 'sine', freq: 1760, gain: 0.12 });
        break;
      case 'phase':
        this._tone(t, 0.9, { type: 'sine', freq: 220, freqEnd: 440, gain: 0.2, attack: 0.2 });
        break;
    }
  }
}
