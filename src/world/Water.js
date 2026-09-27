import * as THREE from 'three';

// Tileable normal map from summed sines -> glossy animated water.
function makeWaterNormalMap(size = 256) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const TAU = Math.PI * 2;
  const waves = [
    [3, 1, 0.8, 0.2], [1, 4, 0.6, 1.3], [5, -3, 0.35, 2.1], [-2, 6, 0.3, 0.7], [7, 2, 0.2, 4.0], [-6, -5, 0.18, 3.3],
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dx = 0, dy = 0;
      const u = x / size, v = y / size;
      for (const [kx, ky, a, ph] of waves) {
        const c = Math.cos(TAU * (kx * u + ky * v) + ph) * a;
        dx += c * kx; dy += c * ky;
      }
      const nx = -dx * 0.08, ny = -dy * 0.08, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const o = (y * size + x) * 4;
      img.data[o] = ((nx / l) * 0.5 + 0.5) * 255;
      img.data[o + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      img.data[o + 2] = ((nz / l) * 0.5 + 0.5) * 255;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(90, 90);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

export class Water {
  constructor(scene) {
    this.normalMap = makeWaterNormalMap();
    const mat = new THREE.MeshStandardMaterial({
      color: '#1f9fd6',
      roughness: 0.06,
      metalness: 0.05,
      transparent: true,
      opacity: 0.78,
      normalMap: this.normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      envMapIntensity: 1.2,
    });
    const geo = new THREE.PlaneGeometry(2400, 2400, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = 0;
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = 1;
    this.mesh.name = 'water';
    scene.add(this.mesh);
  }

  update(dt, t) {
    this.normalMap.offset.set(t * 0.004, t * 0.0025);
  }
}
