import * as THREE from 'three';
import { Terrain, WATER_LEVEL } from './Terrain.js';
import { createSkyMesh, Clouds, SKY_HORIZON, SUN_DIR } from './Sky.js';
import { bakeLighting, bakeTexture } from './Bake.js';
import { Water } from './Water.js';
import { Lighting } from './Lighting.js';
import { Foliage } from './Foliage.js';
import { Towns } from './Towns.js';
import { Colliders, rayBox, rayCylinder, raySphere, rayRamp, rampSurfaceY } from './Colliders.js';

export const GRAVITY = 24;
const STEP = 0.55;
const DEEP_WATER = -1.3;

const _list = [];

export class World {
  constructor(scene, renderer, models) {
    this.models = models;
    this.scene = scene;
    this.colliders = new Colliders();
    this.terrain = new Terrain();
    scene.add(this.terrain.buildMesh());

    this.sky = createSkyMesh();
    scene.add(this.sky);
    scene.fog = new THREE.Fog(SKY_HORIZON.clone(), 130, 600);
    scene.background = SKY_HORIZON.clone();

    // Environment lighting/reflections baked from the sky gradient.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(createSkyMesh(100));
    this.envMap = pmrem.fromScene(envScene, 0.02, 0.1, 500).texture;
    scene.environment = this.envMap;
    scene.environmentIntensity = 0.55;
    pmrem.dispose();

    this.lighting = new Lighting(scene);
    this.heightTex = this.terrain.buildDataTexture();
    this.water = new Water(scene, this.heightTex);
    this.clouds = new Clouds(scene, 26, models);
    this.towns = new Towns(scene, this.terrain, this.colliders, models);
    this.foliage = new Foliage(scene, this.terrain, this.colliders, models, this.heightTex);
    const t0 = performance.now();
    const { shade, ao } = bakeLighting(this.terrain, this.colliders, this.foliage.occluders, SUN_DIR);
    this.terrain.applyBake(shade, ao);
    this.foliage.setBakeTexture(bakeTexture(this.terrain.n, shade, ao));
    this.bakeMs = performance.now() - t0;
  }

  update(dt, t, focus, camera) {
    this.sky.position.copy(camera.position);
    this.clouds.update(dt);
    this.water.update(dt, t);
    this.foliage.update(dt, t, focus);
    this.lighting.follow(focus);
  }

  heightAt(x, z) { return this.terrain.heightAt(x, z); }

  // Highest walkable surface under (x,z) that is not above feetY + step.
  groundAt(x, z, feetY, radius = 0.3) {
    let g = Math.max(this.terrain.heightAt(x, z), WATER_LEVEL - 0.9);
    const list = this.colliders.query(x - radius, x + radius, z - radius, z + radius, _list);
    for (const c of list) {
      if (c.kind === 'box') {
        if (x < c.minX - radius * 0.6 || x > c.maxX + radius * 0.6 || z < c.minZ - radius * 0.6 || z > c.maxZ + radius * 0.6) continue;
        if (c.y1 <= feetY + STEP && c.y1 > g) g = c.y1;
      } else if (c.kind === 'ramp') {
        if (x < c.minX || x > c.maxX || z < c.minZ || z > c.maxZ) continue;
        const s = rampSurfaceY(c, x, z);
        if (s <= feetY + 1.0 && s > g) g = s;
      } else if (c.kind === 'circle' && c.rock) {
        const d = Math.hypot(x - c.x, z - c.z);
        if (d < c.r * 0.7 && c.y1 <= feetY + STEP && c.y1 > g) g = c.y1;
      }
    }
    return g;
  }

  isDeepWater(x, z) { return this.terrain.heightAt(x, z) < DEEP_WATER; }

  // Push a vertical capsule (feet pos, radius, height) out of static/dynamic shapes.
  resolveHorizontal(pos, radius, height) {
    const feet = pos.y, head = pos.y + height;
    const list = this.colliders.query(pos.x - radius - 1, pos.x + radius + 1, pos.z - radius - 1, pos.z + radius + 1, _list);
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      for (const c of list) {
        if (c.kind === 'ramp') continue;
        if (feet >= c.y1 - STEP || head <= c.y0) continue;
        if (c.kind === 'circle') {
          const dx = pos.x - c.x, dz = pos.z - c.z;
          const d = Math.hypot(dx, dz), min = c.r + radius;
          if (d < min && d > 1e-5) { pos.x = c.x + (dx / d) * min; pos.z = c.z + (dz / d) * min; hit = true; }
        } else {
          const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
          const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
          const dx = pos.x - cx, dz = pos.z - cz;
          const d2 = dx * dx + dz * dz;
          if (d2 > 1e-8) {
            if (d2 < radius * radius) {
              const d = Math.sqrt(d2);
              pos.x = cx + (dx / d) * radius; pos.z = cz + (dz / d) * radius; hit = true;
            }
          } else {
            // center inside the box: push out along the smallest axis
            const pl = pos.x - c.minX, pr = c.maxX - pos.x, pb = pos.z - c.minZ, pf = c.maxZ - pos.z;
            const m = Math.min(pl, pr, pb, pf);
            if (m === pl) pos.x = c.minX - radius; else if (m === pr) pos.x = c.maxX + radius;
            else if (m === pb) pos.z = c.minZ - radius; else pos.z = c.maxZ + radius;
            hit = true;
          }
        }
      }
    }
    return hit;
  }

  // Integrate an actor-like body { pos, vel, radius, height, onGround }.
  moveBody(body, dt, gravityScale = 1) {
    const pos = body.pos, vel = body.vel;
    const ox = pos.x, oz = pos.z;
    let nx = pos.x + vel.x * dt, nz = pos.z + vel.z * dt;
    // deep water blocks walking (only near water level)
    if (pos.y < 2 && !this.isDeepWater(ox, oz) && this.isDeepWater(nx, nz)) {
      if (!this.isDeepWater(nx, oz)) nz = oz;
      else if (!this.isDeepWater(ox, nz)) nx = ox;
      else { nx = ox; nz = oz; }
    }
    pos.x = nx; pos.z = nz;
    body.blocked = this.resolveHorizontal(pos, body.radius, body.height);
    // keep inside world bounds
    const lim = 225;
    pos.x = Math.max(-lim, Math.min(lim, pos.x));
    pos.z = Math.max(-lim, Math.min(lim, pos.z));

    vel.y -= GRAVITY * gravityScale * dt;
    const feetBefore = pos.y;
    pos.y += vel.y * dt;
    const ground = this.groundAt(pos.x, pos.z, Math.max(feetBefore, pos.y), body.radius);
    const wasGround = body.onGround;
    if (pos.y <= ground) {
      pos.y = ground;
      if (vel.y < 0) { body.landSpeed = -vel.y; vel.y = 0; }
      body.onGround = true;
    } else if (wasGround && vel.y <= 0 && pos.y - ground < 0.6) {
      pos.y = ground; // stick to slopes when walking downhill
      vel.y = 0;
      body.onGround = true;
    } else {
      body.onGround = false;
    }
    body.groundY = ground;
    body.inWater = ground < WATER_LEVEL - 0.2 && pos.y < WATER_LEVEL + 0.1;
  }

  // Ray vs terrain + colliders. Returns { t, collider } or null.
  raycast(o, d, maxT, out = {}) {
    let best = maxT, bestC = null;
    const list = this.colliders.queryRay(o.x, o.z, d.x, d.z, maxT, _list);
    for (const c of list) {
      let t = -1;
      if (c.kind === 'box') t = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, c, best);
      else if (c.kind === 'circle') {
        t = c.rock
          ? raySphere(o.x, o.y, o.z, d.x, d.y, d.z, c.x, c.y1 - c.r * 0.6, c.z, c.r, best)
          : rayCylinder(o.x, o.y, o.z, d.x, d.y, d.z, c, best);
      } else if (c.kind === 'ramp') t = rayRamp(o.x, o.y, o.z, d.x, d.y, d.z, c, best);
      if (t >= 0 && t < best) { best = t; bestC = c; }
    }
    const tt = this.rayTerrain(o, d, best);
    if (tt >= 0 && tt < best) { best = tt; bestC = null; out.terrain = true; } else out.terrain = false;
    if (best >= maxT) return null;
    out.t = best;
    out.collider = bestC;
    return out;
  }

  rayTerrain(o, d, maxT) {
    const step = 1.0;
    let prevT = 0;
    let prevDiff = o.y - Math.max(this.terrain.heightAt(o.x, o.z), WATER_LEVEL - 50);
    if (prevDiff < 0) return 0;
    for (let t = step; t <= maxT + step; t += step) {
      const tt = Math.min(t, maxT);
      const y = o.y + d.y * tt;
      if (y > 60 && d.y >= 0) return -1;
      const diff = y - this.terrain.heightAt(o.x + d.x * tt, o.z + d.z * tt);
      if (diff < 0) {
        let a = prevT, b = tt;
        for (let i = 0; i < 6; i++) {
          const m = (a + b) / 2;
          const dm = o.y + d.y * m - this.terrain.heightAt(o.x + d.x * m, o.z + d.z * m);
          if (dm < 0) b = m; else a = m;
        }
        return (a + b) / 2;
      }
      prevT = tt; prevDiff = diff;
      if (tt >= maxT) break;
    }
    return -1;
  }

  // Clear line between two points?
  lineOfSight(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-3) return true;
    _o.copy(a); _d.set(dx / len, dy / len, dz / len);
    return this.raycast(_o, _d, len - 0.3, _hit) === null;
  }
}

const _o = new THREE.Vector3(), _d = new THREE.Vector3();
const _hit = {};
