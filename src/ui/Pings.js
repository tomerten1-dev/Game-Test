import * as THREE from 'three';

const PING_LIFE = 14;
const _v = new THREE.Vector3();

// Map marker (one, yours) + quick pings (middle mouse): a light beam in the world and an
// on-screen tag with distance that sticks to the screen edge when off-view.
export class Pings {
  constructor(game, root) {
    this.game = game;
    this.marker = null; // { x, z }
    this.pings = [];    // { pos, t, label }
    this.beamGeo = new THREE.CylinderGeometry(0.35, 0.35, 90, 8, 1, true).translate(0, 45, 0);
    root.insertAdjacentHTML('beforeend', '<div id="world-tags"></div>');
    this.tagRoot = root.querySelector('#world-tags');
    this.markerBeam = this._beam('#ffd23f');
    this.markerTag = this._tag('mark');
  }

  _beam(color) {
    const m = new THREE.Mesh(this.beamGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    m.visible = false;
    m.renderOrder = 4;
    this.game.scene.add(m);
    return m;
  }

  _tag(kind) {
    const el = document.createElement('div');
    el.className = `wtag ${kind} hidden`;
    el.innerHTML = '<i></i><span class="lbl"></span><span class="dist"></span>';
    this.tagRoot.appendChild(el);
    return { el, lbl: el.querySelector('.lbl'), dist: el.querySelector('.dist') };
  }

  setMarker(m) {
    this.marker = m;
    this.markerBeam.visible = !!m;
    this.markerTag.el.classList.toggle('hidden', !m);
    this.markerTag.lbl.textContent = m ? 'Marker' : '';
    this.game.sound.play('click');
  }

  // Ping what's under the crosshair and describe it.
  ping(origin, dir) {
    const g = this.game;
    const hit = g.world.raycast(origin, dir, 350);
    const t = hit ? hit.t : 120;
    const pos = origin.clone().addScaledVector(dir, t);
    pos.y = Math.max(pos.y, g.world.heightAt(pos.x, pos.z));
    let label = 'Location';
    for (const a of g.actors) {
      if (a.isPlayer || !a.alive || a.state === 'bus') continue;
      if (a.pos.distanceTo(pos) < 3.5) { label = 'Enemy!'; break; }
    }
    if (label === 'Location') {
      const c = g.loot.nearestChest(pos, 4);
      if (c) label = 'Chest';
      else if (hit?.collider?.structure) label = 'Build';
    }
    while (this.pings.length >= 3) this._removePing(this.pings[0]);
    const p = { pos, t: 0, label, beam: this._beam(label === 'Enemy!' ? '#ff6b6b' : '#5fd4ff'), tag: this._tag(label === 'Enemy!' ? 'ping enemy' : 'ping') };
    p.beam.visible = true;
    p.beam.position.copy(pos);
    p.tag.lbl.textContent = label;
    p.tag.el.classList.remove('hidden');
    this.pings.push(p);
    g.sound.play('ping');
    return p;
  }

  _removePing(p) {
    this.game.scene.remove(p.beam);
    p.beam.material.dispose();
    p.tag.el.remove();
    this.pings.splice(this.pings.indexOf(p), 1);
  }

  reset() {
    for (const p of [...this.pings]) this._removePing(p);
    if (this.marker) this.setMarker(null);
  }

  update(dt) {
    const g = this.game, cam = g.camera, p = g.player;
    const W = window.innerWidth, H = window.innerHeight;
    const place = (tag, pos) => {
      _v.copy(pos).setY(pos.y + 2.5).project(cam);
      let x = _v.x, y = _v.y;
      const behind = _v.z > 1;
      if (behind) { x = -x; y = -y; }
      const off = behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.86;
      if (off) {
        const k = Math.min(0.92 / Math.max(Math.abs(x), 1e-3), 0.86 / Math.max(Math.abs(y), 1e-3));
        x *= k; y *= k;
        if (behind) y = Math.min(y, -0.6);
      }
      tag.el.style.transform = `translate(${((x + 1) / 2) * W}px, ${((1 - y) / 2) * H}px)`;
      tag.el.classList.toggle('edge', off);
      tag.dist.textContent = `${Math.round(Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z))}m`;
    };
    if (this.marker) {
      const m = this.marker;
      this.markerBeam.position.set(m.x, g.world.heightAt(m.x, m.z), m.z);
      place(this.markerTag, this.markerBeam.position);
      if (p.alive && p.state === 'ground' && Math.hypot(m.x - p.pos.x, m.z - p.pos.z) < 5) this.setMarker(null);
    }
    for (const pg of [...this.pings]) {
      pg.t += dt;
      pg.beam.material.opacity = 0.5 * Math.min(1, (PING_LIFE - pg.t) / 2);
      if (pg.t > PING_LIFE) { this._removePing(pg); continue; }
      place(pg.tag, pg.pos);
    }
  }
}
