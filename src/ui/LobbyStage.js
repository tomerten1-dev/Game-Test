import * as THREE from 'three';
import { attachHat, attachBackBling, makeHarvestTool, headAnchor, attachKicks } from '../player/Gear.js';
import { makeCrownMesh } from '../world/ItemMeshes.js';
import { Character } from '../player/Character.js';
import { makeGlider } from '../player/Glider.js';
import { makeWeaponMesh } from '../weapons/WeaponModels.js';
import { applyWrap } from '../player/Actor.js';

// Floating lobby platform off the island's coast: your hero, locker previews and emotes.
export const STAGE_POS = new THREE.Vector3(0, 62, 262);
const _c = new THREE.Color();

export class LobbyStage {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.group.position.copy(STAGE_POS);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 2.4, 0.8, 40), new THREE.MeshStandardMaterial({ color: '#e9eef8', roughness: 0.5 }));
    base.position.y = -0.4;
    base.receiveShadow = true;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.09, 8, 60), new THREE.MeshStandardMaterial({ color: '#5fd4ff', emissive: '#2fb6ff', emissiveIntensity: 1.6 }));
    rim.rotation.x = Math.PI / 2;
    const under = new THREE.Mesh(new THREE.ConeGeometry(2.3, 3.2, 40), new THREE.MeshStandardMaterial({ color: '#8fa0c0', roughness: 0.8 }));
    under.rotation.x = Math.PI;
    under.position.y = -2.4;
    this.group.add(base, rim, under);
    // rim + fill lights so the hero pops against the sky
    const key = new THREE.PointLight('#bfe8ff', 18, 14, 1.6);
    key.position.set(2.5, 3.5, 4);
    const back = new THREE.PointLight('#ff9ad5', 14, 12, 1.6);
    back.position.set(-2.6, 2.8, -2.4);
    this.group.add(key, back);
    this.heroRoot = new THREE.Group();
    this.group.add(this.heroRoot);
    this._partySlots();
    // nameplate over the hero (name, level, wins)
    this.plate = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
    this.plate.scale.set(1.7, 0.43, 1);
    this.plate.position.set(0, 2.35, 0);
    this.group.add(this.plate);
    this.idleT = 0;
    const wake = () => { this.idleT = 0; if (this.idleDance) { this.idleDance = false; this.emoteT = 0; } };
    window.addEventListener('pointermove', wake);
    window.addEventListener('keydown', wake);
    this.group.visible = false;
    game.scene.add(this.group);
    this.yaw = 0.35;
    this.emoteT = 0;
    this.look = null;
    this.t = 0;

    // drag to spin the hero
    const cv = game.renderer.domElement;
    cv.addEventListener('pointerdown', (e) => { if (this.group.visible) this.drag = e.clientX; });
    window.addEventListener('pointermove', (e) => { if (this.drag != null) { this.yaw += (e.clientX - this.drag) * 0.01; this.drag = e.clientX; } });
    window.addEventListener('pointerup', () => { this.drag = null; });
  }

  // Three empty party pads beside you (party play needs online multiplayer).
  _partySlots() {
    const padMat = new THREE.MeshStandardMaterial({ color: '#dfe7f5', roughness: 0.5, transparent: true, opacity: 0.85 });
    const glow = new THREE.MeshStandardMaterial({ color: '#5fd4ff', emissive: '#2fb6ff', emissiveIntensity: 1.2, transparent: true, opacity: 0.8 });
    const tex = (() => {
      const c = document.createElement('canvas'); c.width = 128; c.height = 160;
      const x = c.getContext('2d');
      x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 10; x.lineCap = 'round';
      x.beginPath(); x.moveTo(64, 30); x.lineTo(64, 98); x.moveTo(30, 64); x.lineTo(98, 64); x.stroke();
      x.fillStyle = '#ffffff'; x.font = 'bold 26px sans-serif'; x.textAlign = 'center'; x.fillText('INVITE', 64, 145);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    this.pads = [];
    for (const [x, z] of [[-2.3, -1.6], [2.3, -1.6], [0, -3.1]]) {
      const pad = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.08, 32), padMat);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.035, 6, 40), glow);
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.05;
      const plus = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 1, depthWrite: false, color: "#e8f7ff" }));
      plus.scale.set(0.8, 1.0, 1); plus.position.y = 1.0;
      pad.add(disc, ring, plus);
      pad.position.set(x, 0.02, z);
      this.group.add(pad);
      this.pads.push({ pad, plus, ring });
    }
  }

  // name · level · wins, drawn onto the nameplate sprite
  setPlate(name, level, wins) {
    const key = `${name}|${level}|${wins}`;
    if (key === this._plateKey) return;
    this._plateKey = key;
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(10,18,40,0.6)';
    x.beginPath(); x.roundRect(8, 12, 496, 104, 26); x.fill();
    x.textAlign = 'center';
    x.fillStyle = '#ffffff'; x.font = 'bold 44px sans-serif'; x.fillText(name, 256, 62);
    x.fillStyle = '#ffd23f'; x.font = 'bold 28px sans-serif'; x.fillText(`LEVEL ${level}${wins ? `  ·  ${wins} WIN${wins === 1 ? '' : 'S'}` : ''}`, 256, 100);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    this.plate.material.map?.dispose();
    this.plate.material.map = t;
    this.plate.material.needsUpdate = true;
  }

  show(v) { this.group.visible = v; this.idleT = 0; }
  get heroPos() { return STAGE_POS; }

  // look: { hero, tint, glider: [c, accent], trail, wrap, preview: slot being previewed }
  setLook(look) {
    const key = `${look.hero}|${look.tint}|${look.hat}|${look.backbling}|${look.crowned}|${look.kicks?.base}`;
    if (key !== this._key) {
      this._key = key;
      if (this.character) { this.heroRoot.remove(this.character.root); this.character.dispose(); }
      this.character = new Character(this.game.assets, '#ffffff', look.hero, 0, look.tint);
      this.heroRoot.add(this.character.root);
      if (look.hat) attachHat(this.character, look.hat);
      if (look.backbling) attachBackBling(this.character, look.backbling);
      if (look.kicks) attachKicks(this.character, look.kicks);
      if (look.crowned) { const c = makeCrownMesh(); c.position.copy(headAnchor(this.character, look.hat ? 0.12 : -0.08)); this.character.root.add(c); this.character.root.updateMatrixWorld(true); this.character.head?.attach(c); }
      this.character.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    }
    if (this.glider) this.character.root.remove(this.glider);
    this.glider = makeGlider(look.glider[0], look.glider[1]);
    this.glider.visible = look.preview === 'glider';
    this.character.root.add(this.glider);
    this.character.setWeapon(look.preview === 'wrap' ? applyWrap(makeWeaponMesh('ar', 3), look.wrap) : look.preview === 'pickaxe' ? makeHarvestTool(look.pickaxe) : null, look.preview === 'pickaxe');
    this.look = look;
    if (look.preview !== 'emote') this.emoteT = 0;
  }

  emote(clip, seconds = 4.5) {
    if (!this.character) return;
    this.emoteClip = clip;
    this.emoteT = seconds;
  }

  // Camera framing: hero slightly left of centre so the panels on the right stay clear.
  frameCamera(camera, dt) {
    const p = STAGE_POS;
    const sway = Math.sin(this.t * 0.35) * 0.25;
    camera.position.set(p.x + 1.9 + sway, p.y + 1.45, p.z + 5.6);
    camera.lookAt(p.x + 1.75 + sway * 0.5, p.y + 1.2, p.z);
    if (camera.fov !== 50) { camera.fov = 50; camera.updateProjectionMatrix(); }
  }

  update(dt) {
    this.t += dt;
    const ch = this.character;
    if (!ch) return;
    for (const [i, p] of (this.pads || []).entries()) {
      p.plus.position.y = 1.0 + Math.sin(this.t * 1.6 + i) * 0.06;
      p.ring.material.emissiveIntensity = 0.9 + Math.sin(this.t * 2 + i) * 0.4;
    }
    // AFK: after a while the hero starts dancing the equipped emote
    this.idleT += dt;
    if (this.idleT > 12 && !this.idleDance && this.emoteT <= 0 && this.idleEmote && (!this.look || !this.look.preview)) {
      this.idleDance = true;
      this.emote(this.idleEmote, 1e9);
    }
    this.heroRoot.rotation.y = this.yaw + Math.sin(this.t * 0.4) * 0.08;
    const look = this.look;
    if (look?.preview === 'glider') {
      ch.setPose('Jump_Idle', null, 0.3);
      this.glider.rotation.z = Math.sin(this.t * 1.3) * 0.06;
    } else if (this.emoteT > 0) {
      this.emoteT -= dt;
      ch.setPose(this.emoteClip, null, 0.25);
    } else if (look?.preview === 'wrap') ch.setPose('2H_Ranged_Aiming', null, 0.25);
    else if (look?.preview === 'pickaxe') ch.setPose('Idle', null, 0.25);
    else ch.setPose('Idle', null, 0.3);
    ch.update(dt, 0, look?.preview === 'wrap', 0);
    // contrail preview: ribbons circling the hero
    const trail = look?.trail;
    if (trail && look.preview === 'trail') {
      const fx = this.game.effects;
      for (let k = 0; k < 2; k++) {
        const a = this.t * 2.2 + k * Math.PI;
        if (trail === 'rainbow') _c.setHSL((this.t * 0.4 + k * 0.5) % 1, 1, 0.45); else _c.set(trail[k]);
        fx.sparks.emit(STAGE_POS.x + Math.cos(a) * 1.3, STAGE_POS.y + 1 + Math.sin(this.t * 1.7 + k) * 0.6, STAGE_POS.z + Math.sin(a) * 1.3, 0, 0.3, 0, _c, 1.1, 0.14, 0);
      }
    }
  }
}
