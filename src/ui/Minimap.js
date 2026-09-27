import { TOWNS } from '../world/Terrain.js';

const VIEW = 205; // half-extent in meters shown on the map

// Top-down map: terrain colors, storm, next circle, bus path, player arrow.
export class Minimap {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.terrain = game.world.terrain.buildMinimapCanvas(320);
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = this.canvas.clientWidth || 180;
    this.canvas.width = this.canvas.height = Math.round(size * dpr);
    this.scale = this.canvas.width / (VIEW * 2);
  }

  toMap(x, z) { return [(x + VIEW) * this.scale, (z + VIEW) * this.scale]; }

  draw() {
    const { ctx, game } = this;
    const W = this.canvas.width;
    const s = this.scale;
    ctx.clearRect(0, 0, W, W);
    // terrain image covers [-230,230]; crop to [-VIEW,VIEW]
    const tw = this.terrain.width;
    const crop = ((230 - VIEW) / 460) * tw;
    ctx.drawImage(this.terrain, crop, crop, tw - crop * 2, tw - crop * 2, 0, 0, W, W);

    // town names
    ctx.font = `700 ${Math.round(W * 0.045)}px "Barlow Condensed", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.strokeStyle = 'rgba(20,30,60,0.6)';
    ctx.lineWidth = 3;
    for (const t of TOWNS) {
      const [x, y] = this.toMap(t.x, t.z);
      ctx.strokeText(t.name, x, y);
      ctx.fillText(t.name, x, y);
    }

    const storm = game.storm;
    // storm fill outside the current circle
    const [cx, cy] = this.toMap(storm.center.x, storm.center.y);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, W);
    ctx.arc(cx, cy, Math.max(0, storm.radius * s), 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(140, 40, 230, 0.42)';
    ctx.fill('evenodd');
    ctx.restore();
    ctx.lineWidth = Math.max(2, W * 0.012);
    ctx.strokeStyle = '#c05cff';
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0, storm.radius * s), 0, Math.PI * 2);
    ctx.stroke();
    if (storm.stage !== 'done') {
      const [nx, ny] = this.toMap(storm.nextCenter.x, storm.nextCenter.y);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.5, W * 0.008);
      ctx.beginPath();
      ctx.arc(nx, ny, Math.max(0, storm.nextRadius * s), 0, Math.PI * 2);
      ctx.stroke();
    }


    // world events: supply drops, vending machines, jump pads
    for (const ic of game.events?.mapIcons() || []) {
      const [ix, iy] = this.toMap(ic.x, ic.z);
      const r = W * 0.022;
      ctx.fillStyle = ic.color; ctx.strokeStyle = '#0b1a33'; ctx.lineWidth = 2;
      ctx.beginPath();
      if (ic.shape === 'square') ctx.rect(ix - r, iy - r, r * 2, r * 2);
      else if (ic.shape === 'vending') ctx.roundRect(ix - r * 0.7, iy - r, r * 1.4, r * 2, r * 0.3);
      else ctx.arc(ix, iy, r * 0.6, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }

    // bus path
    const bus = game.bus;
    const p = game.player;
    if (bus.active && p && p.state === 'bus') {
      const [ax, ay] = this.toMap(bus.start.x, bus.start.z);
      const [bx, by] = this.toMap(bus.end.x, bus.end.z);
      ctx.setLineDash([W * 0.03, W * 0.02]);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = Math.max(2, W * 0.012);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.setLineDash([]);
      const [px, py] = this.toMap(bus.pos.x, bus.pos.z);
      ctx.fillStyle = '#2f6bff';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, W * 0.03, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    // player arrow (points along camera look direction)
    if (p) {
      const src = p.state === 'bus' ? bus.pos : p.pos;
      const [px, py] = this.toMap(src.x, src.z);
      const yaw = game.rig.yaw;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const ang = Math.atan2(fz, fx);
      const r = W * 0.045;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(-r * 0.7, r * 0.62);
      ctx.lineTo(-r * 0.35, 0);
      ctx.lineTo(-r * 0.7, -r * 0.62);
      ctx.closePath();
      ctx.fillStyle = p.alive ? '#20e6c9' : '#ff5a5a';
      ctx.strokeStyle = '#0b1a33';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}
