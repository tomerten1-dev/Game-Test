// Spatial hash of static + dynamic collision shapes shared by movement, bullets and bots.
// Shapes:
//   circle: { kind:'circle', x, z, r, y0, y1 }            (tree trunks, rocks)
//   box:    { kind:'box', minX, maxX, minZ, maxZ, y0, y1 } (houses, crates, walls)
//   ramp:   { kind:'ramp', minX, maxX, minZ, maxZ, y0, y1, dirX, dirZ } (walkable slope)
//   cone:   { kind:'cone', minX, maxX, minZ, maxZ, y0, y1 }             (walkable pyramid roof)

const CELL = 8;

export class Colliders {
  constructor() {
    this.cells = new Map();
    this._stamp = 0;
  }

  _key(ix, iz) { return ix * 73856093 + iz * 19349663; }

  _bounds(c) {
    if (c.kind === 'circle' || c.kind === 'sphere') return [c.x - c.r, c.x + c.r, c.z - c.r, c.z + c.r];
    return [c.minX, c.maxX, c.minZ, c.maxZ];
  }

  add(c) {
    const [x0, x1, z0, z1] = this._bounds(c);
    c._cells = [];
    c._stamp = 0;
    for (let ix = Math.floor(x0 / CELL); ix <= Math.floor(x1 / CELL); ix++) {
      for (let iz = Math.floor(z0 / CELL); iz <= Math.floor(z1 / CELL); iz++) {
        const k = this._key(ix, iz);
        let arr = this.cells.get(k);
        if (!arr) { arr = []; this.cells.set(k, arr); }
        arr.push(c);
        c._cells.push(arr);
      }
    }
    return c;
  }

  remove(c) {
    if (!c._cells) return;
    for (const arr of c._cells) {
      const i = arr.indexOf(c);
      if (i >= 0) arr.splice(i, 1);
    }
    c._cells = null;
  }

  // Collect unique colliders overlapping an axis-aligned XZ rectangle.
  query(x0, x1, z0, z1, out = []) {
    out.length = 0;
    const stamp = ++this._stamp;
    for (let ix = Math.floor(x0 / CELL); ix <= Math.floor(x1 / CELL); ix++) {
      for (let iz = Math.floor(z0 / CELL); iz <= Math.floor(z1 / CELL); iz++) {
        const arr = this.cells.get(this._key(ix, iz));
        if (!arr) continue;
        for (const c of arr) {
          if (c._stamp === stamp) continue;
          c._stamp = stamp;
          out.push(c);
        }
      }
    }
    return out;
  }

  // Walk grid cells along a segment (2D DDA), collecting colliders once each.
  queryRay(ox, oz, dx, dz, maxT, out = []) {
    out.length = 0;
    const stamp = ++this._stamp;
    let ix = Math.floor(ox / CELL), iz = Math.floor(oz / CELL);
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? Math.abs(CELL / dx) : Infinity;
    const tDeltaZ = dz !== 0 ? Math.abs(CELL / dz) : Infinity;
    let tMaxX = dx !== 0 ? ((dx > 0 ? (ix + 1) * CELL - ox : ox - ix * CELL) / Math.abs(dx)) : Infinity;
    let tMaxZ = dz !== 0 ? ((dz > 0 ? (iz + 1) * CELL - oz : oz - iz * CELL) / Math.abs(dz)) : Infinity;
    let t = 0;
    let guard = 0;
    while (t <= maxT && guard++ < 400) {
      const arr = this.cells.get(this._key(ix, iz));
      if (arr) for (const c of arr) {
        if (c._stamp === stamp) continue;
        c._stamp = stamp;
        out.push(c);
      }
      if (tMaxX < tMaxZ) { t = tMaxX; tMaxX += tDeltaX; ix += stepX; }
      else { t = tMaxZ; tMaxZ += tDeltaZ; iz += stepZ; }
    }
    return out;
  }

  clearDynamic() {
    for (const arr of this.cells.values()) {
      for (let i = arr.length - 1; i >= 0; i--) if (arr[i].dynamic) { arr[i]._cells = null; arr.splice(i, 1); }
    }
  }
}

// Ray (origin o, unit dir d) vs shapes. Return distance or -1.
export function rayBox(ox, oy, oz, dx, dy, dz, b, maxT) {
  let tmin = 0, tmax = maxT;
  const bmin = [b.minX, b.y0, b.minZ], bmax = [b.maxX, b.y1, b.maxZ];
  const o = [ox, oy, oz], d = [dx, dy, dz];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-8) {
      if (o[a] < bmin[a] || o[a] > bmax[a]) return -1;
    } else {
      const inv = 1 / d[a];
      let t1 = (bmin[a] - o[a]) * inv, t2 = (bmax[a] - o[a]) * inv;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

export function rayCylinder(ox, oy, oz, dx, dy, dz, c, maxT) {
  // vertical infinite cylinder clipped to [y0,y1]
  const px = ox - c.x, pz = oz - c.z;
  const a = dx * dx + dz * dz;
  if (a < 1e-10) return -1;
  const b = 2 * (px * dx + pz * dz);
  const cc = px * px + pz * pz - c.r * c.r;
  const disc = b * b - 4 * a * cc;
  if (disc < 0) return -1;
  const s = Math.sqrt(disc);
  let t = (-b - s) / (2 * a);
  if (t < 0) t = (-b + s) / (2 * a);
  if (t < 0 || t > maxT) return -1;
  const y = oy + dy * t;
  if (y < c.y0 || y > c.y1) return -1;
  return t;
}

export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r, maxT) {
  const px = ox - cx, py = oy - cy, pz = oz - cz;
  const b = px * dx + py * dy + pz * dz;
  const c = px * px + py * py + pz * pz - r * r;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const s = Math.sqrt(disc);
  let t = -b - s;
  if (t < 0) t = -b + s;
  if (t < 0 || t > maxT) return -1;
  return t;
}

// Ramp = slanted plane inside its footprint rectangle.
export function rampSurfaceY(r, x, z) {
  if (r.kind === 'cone') {
    // four-sided roof: highest at the cell center
    const hx = (r.maxX - r.minX) / 2, hz = (r.maxZ - r.minZ) / 2;
    const k = Math.max(Math.abs(x - (r.minX + hx)) / hx, Math.abs(z - (r.minZ + hz)) / hz);
    return r.y0 + (r.y1 - r.y0) * Math.max(0, 1 - k);
  }
  // progress 0..1 along dir from the low edge
  let t;
  if (r.dirX > 0) t = (x - r.minX) / (r.maxX - r.minX);
  else if (r.dirX < 0) t = (r.maxX - x) / (r.maxX - r.minX);
  else if (r.dirZ > 0) t = (z - r.minZ) / (r.maxZ - r.minZ);
  else t = (r.maxZ - z) / (r.maxZ - r.minZ);
  t = Math.min(1, Math.max(0, t));
  return r.y0 + (r.y1 - r.y0) * t;
}

export function rayRamp(ox, oy, oz, dx, dy, dz, r, maxT) {
  // march coarse then refine: ramps are small, 24 steps is plenty
  const tEnter = rayBox(ox, oy, oz, dx, dy, dz, r, maxT);
  if (tEnter < 0) return -1;
  const tExit = Math.min(maxT, tEnter + 8);
  let prev = oy + dy * tEnter - rampSurfaceY(r, ox + dx * tEnter, oz + dz * tEnter);
  const N = 24;
  for (let i = 1; i <= N; i++) {
    const t = tEnter + ((tExit - tEnter) * i) / N;
    const x = ox + dx * t, z = oz + dz * t;
    if (x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ) break;
    const diff = oy + dy * t - rampSurfaceY(r, x, z);
    if ((diff <= 0) !== (prev <= 0)) return t;
    prev = diff;
  }
  return prev <= 0 ? tEnter : -1;
}
