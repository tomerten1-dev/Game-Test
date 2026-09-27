import * as THREE from 'three';
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

  show(v) { this.group.visible = v; }

  // look: { hero, tint, glider: [c, accent], trail, wrap, preview: slot being previewed }
  setLook(look) {
    const key = `${look.hero}|${look.tint}`;
    if (key !== this._key) {
      this._key = key;
      if (this.character) { this.heroRoot.remove(this.character.root); this.character.dispose(); }
      this.character = new Character(this.game.assets, '#ffffff', look.hero, 0, look.tint);
      this.heroRoot.add(this.character.root);
      this.character.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    }
    if (this.glider) this.character.root.remove(this.glider);
    this.glider = makeGlider(look.glider[0], look.glider[1]);
    this.glider.visible = look.preview === 'glider';
    this.character.root.add(this.glider);
    this.character.setWeapon(look.preview === 'wrap' ? applyWrap(makeWeaponMesh('ar', 3), look.wrap) : null);
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
    this.heroRoot.rotation.y = this.yaw + Math.sin(this.t * 0.4) * 0.08;
    const look = this.look;
    if (look?.preview === 'glider') {
      ch.setPose('Jump_Idle', null, 0.3);
      this.glider.rotation.z = Math.sin(this.t * 1.3) * 0.06;
    } else if (this.emoteT > 0) {
      this.emoteT -= dt;
      ch.setPose(this.emoteClip, null, 0.25);
    } else if (look?.preview === 'wrap') ch.setPose('2H_Ranged_Aiming', null, 0.25);
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
