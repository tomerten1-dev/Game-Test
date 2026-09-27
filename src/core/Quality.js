import { isMobile } from './device.js';

// Graphics presets. "auto" starts high on desktop / low on phones and steps down if FPS is low.
const dpr = Math.min(window.devicePixelRatio || 1, 2);
export const PRESETS = {
  low: { pixelRatio: Math.min(dpr, 1), shadowSize: 1024, shadowRange: 40, grass: 0.35, post: false, ao: false, bloom: false },
  medium: { pixelRatio: Math.min(dpr, 1.25), shadowSize: 2048, shadowRange: 55, grass: 0.7, post: true, ao: false, bloom: true },
  high: { pixelRatio: Math.min(dpr, 1.6), shadowSize: 2048, shadowRange: 65, grass: 1, post: true, ao: true, bloom: true },
};
export const LEVELS = ['low', 'medium', 'high'];

const KEY = 'stormbound.graphics';
export function loadSetting() {
  try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; }
}
export function saveSetting(v) {
  try { localStorage.setItem(KEY, v); } catch { /* ignore */ }
}
export function autoLevel() { return isMobile ? 'low' : 'high'; }

export class Quality {
  constructor(game) {
    this.game = game;
    this.setting = loadSetting();
    this.level = this.setting === 'auto' ? autoLevel() : this.setting;
    this.fpsAcc = 0;
    this.fpsFrames = 0;
    this.lowStreak = 0;
  }

  set(setting) {
    this.setting = setting;
    saveSetting(setting);
    this.apply(setting === 'auto' ? autoLevel() : setting);
  }

  apply(level = this.level) {
    this.level = level;
    const p = PRESETS[level];
    const g = this.game;
    g.renderer.setPixelRatio(p.pixelRatio);
    g.renderer.setSize(window.innerWidth, window.innerHeight);
    g.world.lighting.setShadowQuality(p.shadowSize, p.shadowRange);
    g.world.foliage.setGrassDensity(isMobile ? 1 : p.grass);
    g.post.configure(p);
    g.post.setSize(window.innerWidth, window.innerHeight);
  }

  // Called every frame while playing; only adapts in auto mode.
  monitor(dt) {
    if (this.setting !== 'auto' || this.level === 'low') return;
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc < 3) return;
    const fps = this.fpsFrames / this.fpsAcc;
    this.fpsAcc = 0;
    this.fpsFrames = 0;
    this.lowStreak = fps < 42 ? this.lowStreak + 1 : 0;
    if (this.lowStreak >= 2) {
      this.lowStreak = 0;
      const next = LEVELS[LEVELS.indexOf(this.level) - 1];
      this.apply(next);
      this.game.hud.toast(`Graphics set to ${next} for smoother play`);
    }
  }
}
