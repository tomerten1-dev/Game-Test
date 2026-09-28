import * as THREE from 'three';

// On a Fortnite-sized island one InstancedMesh can hold thousands of trees spread over 3 km,
// and the GPU would draw every one of them each frame (fog hides everything past ~600 m).
// A StreamedInstancedMesh keeps the full list of instance matrices on the CPU and only uploads
// the ones near the camera. Callers use setMatrixAt / getMatrixAt / setColorAt / count with
// their usual (full-list) indices, so felled trees, broken house parts etc. work unchanged.
export const STREAM_RANGE = 540; // fog is ~85% thick by here
const REFRESH_MOVE = 24; // re-pick the visible set after the camera moves this far
const all = new Set();
let rangeMul = 1; // grows while you're high up (bus, skydive) so forests show below you

export class StreamedInstancedMesh extends THREE.InstancedMesh {
  constructor(geometry, material, count, range = STREAM_RANGE) {
    super(geometry, material, count);
    this.range = range;
    this._total = count;
    this._m = new Float32Array(count * 16);
    for (let i = 0; i < count; i++) this._m[i * 16] = this._m[i * 16 + 5] = this._m[i * 16 + 10] = this._m[i * 16 + 15] = 1;
    this._cols = null;
    this._drawn = 0;
    this._dirty = true;
    this._cx = Infinity; this._cz = Infinity;
    this.frustumCulled = false; // we cull by distance ourselves
    all.add(this);
  }

  // `count` is the logical number of instances; the renderer is handed the streamed subset.
  get count() { return this._m ? this._drawn : this._logical; }
  set count(v) { this._logical = v; this._dirty = true; }

  setMatrixAt(i, m) {
    if (!this._m) return super.setMatrixAt(i, m);
    m.toArray(this._m, i * 16);
    this._dirty = true;
  }

  getMatrixAt(i, m) { return this._m ? m.fromArray(this._m, i * 16) : super.getMatrixAt(i, m); }

  setColorAt(i, c) {
    if (!this._m) return super.setColorAt(i, c);
    if (!this._cols) { this._cols = new Float32Array(this._total * 3).fill(1); super.setColorAt(0, c); }
    c.toArray(this._cols, i * 3);
    this._dirty = true;
  }

  getColorAt(i, c) { return this._cols ? c.fromArray(this._cols, i * 3) : super.getColorAt(i, c); }

  refresh(cx, cz) {
    this._dirty = false;
    this._cx = cx; this._cz = cz;
    const src = this._m, dst = this.instanceMatrix.array, n = Math.min(this._logical, this._total);
    const R2 = (this.range * rangeMul) ** 2;
    const cs = this._cols, cd = this.instanceColor?.array;
    let k = 0;
    for (let i = 0; i < n; i++) {
      const o = i * 16;
      if (src[o] === 0 && src[o + 5] === 0 && src[o + 10] === 0) continue; // hidden (scaled to zero)
      const dx = src[o + 12] - cx, dz = src[o + 14] - cz;
      if (dx * dx + dz * dz > R2) continue;
      dst.set(src.subarray(o, o + 16), k * 16);
      if (cs && cd) { cd[k * 3] = cs[i * 3]; cd[k * 3 + 1] = cs[i * 3 + 1]; cd[k * 3 + 2] = cs[i * 3 + 2]; }
      k++;
    }
    this._drawn = k;
    this.instanceMatrix.needsUpdate = true;
    if (this.instanceColor) this.instanceColor.needsUpdate = true;
  }

  dispose() {
    all.delete(this);
    return super.dispose();
  }
}

// Called every frame with the camera position.
export function updateStreamed(pos) {
  const m = 1 + 0.8 * Math.max(0, Math.min(1, (pos.y - 50) / 250));
  const redo = Math.abs(m - rangeMul) > 0.05;
  if (redo) rangeMul = m;
  for (const im of all) {
    if (redo) im._dirty = true;
    if (!im.parent) continue;
    if (im._dirty || Math.abs(im._cx - pos.x) > REFRESH_MOVE || Math.abs(im._cz - pos.z) > REFRESH_MOVE) im.refresh(pos.x, pos.z);
  }
}


// Scene-wide distance culling for small placed things (chests, props, tunnel beams, towers…):
// three.js only culls by the view frustum, so without this everything up to the far plane is drawn
// even though fog hides it. Objects at the origin (merged meshes, actors' rigs), instanced meshes,
// sprites and anything flagged userData.noCull or frustumCulled = false are left alone.
const CULL_RANGE = 380;
const _box = new THREE.Box3(), _sph = new THREE.Sphere();
let _lastCull = { x: Infinity, z: Infinity, t: 0 };

export function cullScene(scene, pos, time) {
  if (Math.abs(_lastCull.x - pos.x) < 12 && Math.abs(_lastCull.z - pos.z) < 12 && time - _lastCull.t < 0.5) return;
  _lastCull = { x: pos.x, z: pos.z, t: time };
  for (const o of scene.children) {
    if (!(o.isMesh || o.isGroup) || o.isInstancedMesh || o.frustumCulled === false) continue;
    const ud = o.userData;
    if (ud.noCull) continue;
    if (ud.cullR === undefined) {
      // size it once (static props); huge things and origin-anchored aggregates are never culled
      if (o.position.lengthSq() < 1) { ud.noCull = true; continue; }
      _box.setFromObject(o);
      ud.cullR = _box.isEmpty() ? 0 : _box.getBoundingSphere(_sph).radius;
      if (ud.cullR > 60) { ud.noCull = true; continue; }
    }
    const dx = o.position.x - pos.x, dz = o.position.z - pos.z;
    const far = dx * dx + dz * dz > (CULL_RANGE + ud.cullR) ** 2;
    if (far) { if (o.visible) { o.visible = false; ud.culled = true; } }
    else if (ud.culled) { o.visible = true; ud.culled = false; }
  }
}
