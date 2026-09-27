// Tiny Web Audio synth: every sound is generated, no audio files needed.

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.listener = null; // THREE.Vector3 (camera position)
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
      this.master.gain.value = 0.55;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
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
    src.connect(f); f.connect(g); g.connect(this.master);
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
    o.connect(g); g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  play(name, pos = null, opts = {}) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const v = pos ? this._vol(pos, opts.range || 110) : 1;
    if (v <= 0.01) return;
    switch (name) {
      case 'pistol':
        this._noise(t, 0.16, { freq: 3200, freqEnd: 500, gain: 0.6 * v });
        this._tone(t, 0.08, { type: 'square', freq: 220, freqEnd: 70, gain: 0.25 * v });
        break;
      case 'ar':
        this._noise(t, 0.2, { freq: 2600, freqEnd: 400, gain: 0.65 * v });
        this._tone(t, 0.1, { type: 'sawtooth', freq: 160, freqEnd: 50, gain: 0.25 * v });
        break;
      case 'smg':
        this._noise(t, 0.11, { freq: 4000, freqEnd: 800, gain: 0.45 * v });
        this._tone(t, 0.06, { type: 'square', freq: 260, freqEnd: 90, gain: 0.15 * v });
        break;
      case 'shotgun':
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
      case 'victory':
        [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this._tone(t + i * 0.13, 0.4, { type: 'triangle', freq: f, gain: 0.2 }));
        break;
      case 'defeat':
        [392, 330, 262, 196].forEach((f, i) => this._tone(t + i * 0.18, 0.5, { type: 'triangle', freq: f, gain: 0.18 }));
        break;
      case 'phase':
        this._tone(t, 0.9, { type: 'sine', freq: 220, freqEnd: 440, gain: 0.2, attack: 0.2 });
        break;
    }
  }
}
