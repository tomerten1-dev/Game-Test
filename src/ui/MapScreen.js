import { TOWNS, WORLD_HALF } from '../world/Terrain.js';
import { MAP_N, MAP_CELL } from '../world/IslandMap.js';

// half-extent shown at zoom 1: the island map's square, so the A-J / 1-10 grid lines up with Fortnite's
const EXT = (MAP_N * MAP_CELL) / 2;
const COLS = 'ABCDEFGHIJ';

const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// Full-screen island map: grid, POIs, storm circles, bus route, your marker and pings.
// Click to drop a marker, right-click to clear it, wheel to zoom, drag to pan.
export class MapScreen {
  constructor(root, game) {
    this.game = game;
    root.insertAdjacentHTML('beforeend', `
      <div id="bigmap" class="hidden">
        <div class="bm-frame"><canvas id="bm-canvas"></canvas></div>
        <div class="bm-side">
          <div class="bm-title">STORMBOUND ISLAND</div>
          <div id="bm-storm" class="bm-storm"></div>
          <div id="bm-alive" class="bm-line"></div>
          <div class="bm-legend">
            <div><i class="lg you"></i>You</div><div><i class="lg mark"></i>Your marker</div>
            <div><i class="lg ping"></i>Ping</div><div><i class="lg danger"></i>Danger ping</div><div><i class="lg next"></i>Next safe zone</div>
            ${[['#58a6ff', 'sq', 'Supply drop'], ['#4fd1ff', 'vd', 'Vending machine'], ['#ffb52b', 'vd', 'Upgrade bench'], ['#39e0ff', 'dt', 'Jump pad'], ['#ff8a2a', 'sq', 'Boss'], ['#ffd23f', 'md', 'Medallion carrier'], ['#ffe94d', 'vd', 'Vault']].map(([c, sh, n]) => `<div><i class="lg ic ${sh}" style="--c:${c}"></i>${n}</div>`).join('')}
          </div>
          <div class="bm-help">Click: marker · Middle-click or ping key: ping · Right-click: clear · Wheel: zoom · Drag: pan · M: close</div>
          <button id="bm-close" class="btn">CLOSE MAP</button>
        </div>
      </div>`);
    this.el = root.querySelector('#bigmap');
    this.canvas = root.querySelector('#bm-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.stormEl = root.querySelector('#bm-storm');
    this.aliveEl = root.querySelector('#bm-alive');
    this.terrain = game.world.terrain.buildMinimapCanvas(2048);
    this.open = false;
    this.zoom = 1;
    this.cx = 0;
    this.cz = 0;
    root.querySelector('#bm-close').addEventListener('click', (e) => { e.stopPropagation(); game.toggleMap(false); });

    const c = this.canvas;
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [wx, wz] = this.toWorld(e.offsetX * this.dpr, e.offsetY * this.dpr);
      this.zoom = Math.min(8, Math.max(1, this.zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
      // keep the point under the cursor fixed
      const [nx, nz] = this.toWorld(e.offsetX * this.dpr, e.offsetY * this.dpr);
      this.cx += wx - nx; this.cz += wz - nz;
      this._clamp();
    }, { passive: false });
    c.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (e.button === 2) { game.pings.setMarker(null); return; }
      if (e.button === 1) { this.pingHere(e.offsetX, e.offsetY); return; } // middle-click pings the map spot
      this.drag = { x: e.clientX, y: e.clientY, cx: this.cx, cz: this.cz, moved: false };
      c.setPointerCapture?.(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (Math.hypot(dx, dy) > 6) d.moved = true;
      if (d.moved && this.zoom > 1) {
        const k = this.dpr / this.scale;
        this.cx = d.cx - dx * k; this.cz = d.cz - dy * k;
        this._clamp();
      }
    });
    c.addEventListener('pointerup', (e) => {
      const d = this.drag;
      this.drag = null;
      if (!d || d.moved) return;
      const [x, z] = this.toWorld(e.offsetX * this.dpr, e.offsetY * this.dpr);
      const m = game.pings.marker;
      if (m && Math.hypot(m.x - x, m.z - z) < 8 / this.zoom) game.pings.setMarker(null);
      else game.pings.setMarker({ x, z });
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointermove', (e) => { this.hover = [e.offsetX, e.offsetY]; });
    c.addEventListener('pointerleave', () => { this.hover = null; });
    window.addEventListener('resize', () => this.open && this.resize());
  }

  // Ping a spot on the map (middle-click, or the ping key while hovering the map).
  pingHere(ox, oy) {
    const [x, z] = this.toWorld(ox * this.dpr, oy * this.dpr);
    const g = this.game;
    g.pings.pingAt(new (g.player.pos.constructor)(x, g.world.heightAt(x, z), z));
  }

  show(v) {
    this.open = v;
    this.el.classList.toggle('hidden', !v);
    if (v) {
      this.zoom = 1; this.cx = 0; this.cz = 0;
      this.resize();
      this.draw();
    }
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const side = Math.max(200, Math.min(window.innerHeight - 40, window.innerWidth - (window.innerWidth > 900 ? 320 : 30)));
    this.canvas.style.width = this.canvas.style.height = `${side}px`;
    this.canvas.width = this.canvas.height = Math.round(side * this.dpr);
  }

  get scale() { return (this.canvas.width / (EXT * 2)) * this.zoom; }

  _clamp() {
    const lim = EXT * (1 - 1 / this.zoom);
    this.cx = Math.max(-lim, Math.min(lim, this.cx));
    this.cz = Math.max(-lim, Math.min(lim, this.cz));
  }

  toScreen(x, z) { const W = this.canvas.width, s = this.scale; return [W / 2 + (x - this.cx) * s, W / 2 + (z - this.cz) * s]; }
  toWorld(sx, sy) { const W = this.canvas.width, s = this.scale; return [(sx - W / 2) / s + this.cx, (sy - W / 2) / s + this.cz]; }

  draw() {
    if (!this.open) return;
    const { ctx, game } = this;
    const W = this.canvas.width, s = this.scale;
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = '#3cb4e6';
    ctx.fillRect(0, 0, W, W);
    const [ox, oy] = this.toScreen(-WORLD_HALF, -WORLD_HALF); // the terrain image covers the whole world
    ctx.drawImage(this.terrain, ox, oy, WORLD_HALF * 2 * s, WORLD_HALF * 2 * s);

    // grid A-J / 1-10
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `700 ${Math.round(W * 0.018)}px "Barlow Condensed", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i <= 10; i++) {
      const v = -EXT + (i * EXT * 2) / 10;
      const [gx] = this.toScreen(v, 0), [, gy] = this.toScreen(0, v);
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, W); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      if (i < 10) {
        const [lx] = this.toScreen(v + EXT / 10, 0), [, ly] = this.toScreen(0, v + EXT / 10);
        ctx.fillText(COLS[i], lx, 4);
        ctx.textAlign = 'left';
        ctx.fillText(String(i + 1), 4, ly - W * 0.01);
        ctx.textAlign = 'center';
      }
    }

    // POIs
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(W * 0.028 * Math.min(1.4, this.zoom ** 0.4))}px "Barlow Condensed", sans-serif`;
    ctx.lineWidth = Math.max(3, W * 0.005);
    ctx.strokeStyle = 'rgba(15,25,55,0.75)';
    ctx.fillStyle = '#ffffff';
    for (const t of TOWNS) {
      const [x, y] = this.toScreen(t.x, t.z);
      ctx.strokeText(t.name.toUpperCase(), x, y);
      ctx.fillText(t.name.toUpperCase(), x, y);
    }

    // storm
    const storm = game.storm;
    const [cx, cy] = this.toScreen(storm.center.x, storm.center.y);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, W);
    ctx.arc(cx, cy, Math.max(0, storm.radius * s), 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(140, 40, 230, 0.4)';
    ctx.fill('evenodd');
    ctx.restore();
    ctx.strokeStyle = '#c05cff';
    ctx.lineWidth = Math.max(2, W * 0.004);
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(0, storm.radius * s), 0, Math.PI * 2); ctx.stroke();
    const p = game.player;
    if (storm.stage !== 'done') {
      const [nx, ny] = this.toScreen(storm.nextCenter.x, storm.nextCenter.y);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2, W * 0.004);
      ctx.beginPath(); ctx.arc(nx, ny, Math.max(0, storm.nextRadius * s), 0, Math.PI * 2); ctx.stroke();
      // Storm Scout in hand: the circle after next, dashed cyan
      const fut = p?.alive && (p.held?.def?.exotic === 'scout' || p.scanPhase === storm.phase) ? storm.peekFuture() : null;
      if (fut) {
        const [fx, fy] = this.toScreen(fut.center.x, fut.center.y);
        ctx.save(); ctx.setLineDash([8, 6]); ctx.strokeStyle = '#4ff4ff';
        ctx.beginPath(); ctx.arc(fx, fy, Math.max(2, fut.radius * s), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      // dotted path from you to the safe zone when outside it
      if (p?.alive && !storm.isSafe(p.pos.x, p.pos.z)) {
        const [px, py] = this.toScreen(p.pos.x, p.pos.z);
        const dx = storm.nextCenter.x - p.pos.x, dz = storm.nextCenter.y - p.pos.z, d = Math.hypot(dx, dz);
        const k = Math.max(0, d - storm.nextRadius) / d;
        const [ex, ey] = this.toScreen(p.pos.x + dx * k, p.pos.z + dz * k);
        ctx.setLineDash([W * 0.008, W * 0.01]);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.setLineDash([]);
      }
    }


    // moving zones: arrow from the current eye to the next one
    if (storm.stage !== 'done' && Math.hypot(storm.nextCenter.x - storm.center.x, storm.nextCenter.y - storm.center.y) > 8) {
      const [ax, ay] = this.toScreen(storm.center.x, storm.center.y), [bx, by] = this.toScreen(storm.nextCenter.x, storm.nextCenter.y);
      const ang = Math.atan2(by - ay, bx - ax), hl = W * 0.02;
      ctx.strokeStyle = '#ffd23f'; ctx.fillStyle = '#ffd23f'; ctx.lineWidth = Math.max(2, W * 0.004);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx - Math.cos(ang) * hl, by - Math.sin(ang) * hl); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - Math.cos(ang - 0.45) * hl, by - Math.sin(ang - 0.45) * hl); ctx.lineTo(bx - Math.cos(ang + 0.45) * hl, by - Math.sin(ang + 0.45) * hl); ctx.fill();
    }

    // landmarks (smaller names, shown once you zoom in)
    if (this.zoom >= 1.4) {
      ctx.font = `700 ${Math.round(W * 0.017)}px "Barlow Condensed", sans-serif`;
      ctx.lineWidth = Math.max(2, W * 0.003); ctx.strokeStyle = 'rgba(15,25,55,0.7)'; ctx.fillStyle = '#e8f1ff';
      ctx.textAlign = 'center';
      for (const lm of game.world.towns?.landmarks || []) { const [x, y] = this.toScreen(lm.x, lm.z); ctx.strokeText(lm.name, x, y); ctx.fillText(lm.name, x, y); }
    }

    // world events: supply drops, vending machines, jump pads
    for (const ic of game.events?.mapIcons() || []) {
      const [ix, iy] = this.toScreen(ic.x, ic.z);
      if (ic.ring) { ctx.save(); ctx.setLineDash([6, 5]); ctx.strokeStyle = ic.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ix, iy, ic.ring * this.scale, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      const r = W * 0.009;
      ctx.fillStyle = ic.color; ctx.strokeStyle = '#0b1a33'; ctx.lineWidth = 2;
      ctx.beginPath();
      if (ic.shape === 'square') ctx.rect(ix - r, iy - r, r * 2, r * 2);
      else if (ic.shape === 'vending') ctx.roundRect(ix - r * 0.7, iy - r, r * 1.4, r * 2, r * 0.3);
      else if (ic.shape === 'medal') { ctx.arc(ix, iy, r * 0.95, 0, Math.PI * 2); ctx.moveTo(ix + r * 0.45, iy); ctx.arc(ix, iy, r * 0.45, 0, Math.PI * 2); }
      else ctx.arc(ix, iy, r * 0.6, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }

    // bus route
    const bus = game.bus;
    if (bus.active) {
      const [ax, ay] = this.toScreen(bus.start.x, bus.start.z);
      const [bx, by] = this.toScreen(bus.end.x, bus.end.z);
      ctx.setLineDash([W * 0.02, W * 0.012]);
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = Math.max(3, W * 0.005);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.setLineDash([]);
      const [px, py] = this.toScreen(bus.pos.x, bus.pos.z);
      ctx.fillStyle = '#2f6bff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(px, py, W * 0.013, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    // marker & pings
    const pin = (x, z, color) => {
      const [mx, my] = this.toScreen(x, z);
      const r = W * 0.014;
      ctx.fillStyle = color; ctx.strokeStyle = '#0b1a33'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.bezierCurveTo(mx - r * 1.2, my - r * 1.4, mx - r, my - r * 2.6, mx, my - r * 2.6);
      ctx.bezierCurveTo(mx + r, my - r * 2.6, mx + r * 1.2, my - r * 1.4, mx, my);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#0b1a33';
      ctx.beginPath(); ctx.arc(mx, my - r * 1.75, r * 0.35, 0, Math.PI * 2); ctx.fill();
    };
    for (const pg of game.pings.pings) pin(pg.pos.x, pg.pos.z, pg.danger ? '#ff4d4d' : '#5fd4ff');
    const m = game.pings.marker;
    if (m) pin(m.x, m.z, '#ffd23f');

    // you
    if (p) {
      const src = p.state === 'bus' ? bus.pos : p.pos;
      const [px, py] = this.toScreen(src.x, src.z);
      const yaw = game.rig.yaw;
      const ang = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
      const r = W * 0.022;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(r, 0); ctx.lineTo(-r * 0.7, r * 0.62); ctx.lineTo(-r * 0.35, 0); ctx.lineTo(-r * 0.7, -r * 0.62);
      ctx.closePath();
      ctx.fillStyle = p.alive ? '#20e6c9' : '#ff5a5a'; ctx.strokeStyle = '#0b1a33'; ctx.lineWidth = 3;
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    this.stormEl.textContent = storm.stage === 'done' ? 'Final storm circle' : storm.stage === 'wait' ? `Storm eye shrinks in ${fmt(storm.timer)}` : `Storm eye shrinking: ${fmt(storm.timer)}`;
    this.aliveEl.textContent = `${game.aliveCount} players left · ${p?.kills || 0} eliminations`;
  }
}
