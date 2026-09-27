import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// CC0 models: Kenney (env/) and KayKit by Kay Lousberg (kk/). See the CREDITS.md files.
const KK = [
  'home_A_blue', 'home_A_red', 'home_A_yellow', 'home_A_green', 'home_B_blue', 'home_B_red', 'home_B_yellow', 'home_B_green',
  'tavern_red', 'tavern_blue', 'blacksmith_yellow', 'blacksmith_green', 'market_red', 'market_yellow', 'church_blue', 'church_red',
  'windmill_yellow', 'windmill_green', 'tower_A_green', 'tower_A_red', 'lumbermill_red', 'castle_blue',
  'tree_single_A', 'tree_single_B', 'rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D', 'rock_single_E',
  'cloud_big', 'cloud_small', 'barrel', 'crate_A_big', 'sack', 'wheelbarrow', 'tent',
  'flag_blue', 'flag_red', 'flag_yellow', 'flag_green', 'resource_lumber', 'weaponrack', 'bucket_water', 'chest_gold', 'axe_1handed',
  // KayKit City Builder Bits + Furniture Bits (CC0)
  'city_building_A', 'city_building_B', 'city_building_C', 'city_building_D', 'city_building_E', 'city_building_F', 'city_building_G', 'city_building_H',
  'city_road_straight', 'city_road_junction', 'city_car_hatchback', 'city_car_police', 'city_car_sedan', 'city_car_stationwagon', 'city_car_taxi',
  'city_streetlight', 'city_bench', 'city_firehydrant', 'city_dumpster', 'city_trash_A', 'city_watertower',
  'furn_table_small', 'furn_chair_A_wood', 'furn_chair_B_wood', 'furn_armchair', 'furn_couch_pillows', 'furn_lamp_standing', 'furn_cactus_medium_A', 'furn_cactus_small_A',
].map((n) => `kk/${n}`);
// Quaternius Medieval Village MegaKit + Fantasy Props MegaKit (CC0): modular house pieces and props.
// These keep their authored pivots (so pieces snap together on the kit's 2 m grid).
export const KIT_PIECES = [
  'Wall_Plaster_Straight', 'Wall_Plaster_Window_Wide_Round', 'Wall_Plaster_Door_Round', 'Wall_Plaster_Door_Flat',
  'Wall_UnevenBrick_Straight', 'Wall_UnevenBrick_Window_Wide_Round', 'Wall_UnevenBrick_Door_Round',
  'Window_Wide_Round1', 'WindowShutters_Wide_Round_Open', 'Corner_Exterior_Wood', 'Floor_WoodDark', 'Floor_Brick', 'Stair_Interior_Rails',
  'Roof_RoundTiles_6x8', 'Roof_RoundTiles_8x10', 'Roof_Front_Brick6', 'Roof_Front_Brick8', 'Prop_Chimney', 'Door_1_Round', 'Door_1_Flat',
  'Prop_ExteriorBorder_Straight1', 'Prop_Vine1', 'Prop_Vine4', 'Prop_Wagon', 'Prop_WoodenFence_Single',
].map((n) => `village/${n}`);
export const KIT_PROPS = [
  'Bed_Twin1', 'Bed_Twin2', 'Bookcase_2', 'Table_Large', 'Chair_1', 'Stool', 'Bench', 'Cabinet', 'Nightstand_Shelf', 'Chandelier',
  'CandleStick_Stand', 'Chest_Wood', 'Barrel', 'Barrel_Apples', 'Crate_Wooden', 'Shelf_Small_Bottles', 'WeaponStand', 'Workbench',
  'Cauldron', 'Anvil', 'BookStand', 'Lantern_Wall', 'Pot_1_Lid', 'Vase_2', 'Stall_Empty', 'Stall_Cart_Empty', 'FarmCrate_Apple',
  'FarmCrate_Carrot', 'Dummy', 'Banner_1', 'Barrel_Holder',
].map((n) => `props/${n}`);
// KayKit Resource Bits (CC0): lumber, stone, fuel and metal piles for village dressing.
export const RES_PROPS = [
  'Wood_Log_Stack', 'Wood_Planks_Stack_Medium', 'Stone_Bricks_Stack_Medium', 'Stone_Chunks_Large', 'Pallet_Wood', 'Pallet_Wood_Covered_A',
  'Fuel_A_Barrel', 'Fuel_A_Barrels', 'Fuel_B_Barrels', 'Parts_Pile_Large', 'Iron_Bars_Stack_Medium', 'Textiles_Stack_Large_Colored', 'Gold_Bars_Stack_Small',
].map((n) => `res/${n}`);
const KEEP_PIVOT = /^(village|props|res)\//;

export const ENV_MODELS = [
  'palm-long', 'palm-short', 'formation-large-stone', 'formation-stone',
  // Styloo "Guns Asset Pack" (user-provided), see public/models/guns/CREDITS.md
  ...['ak47', 'ak47variant', 'awp', 'ammobox', 'pew', 'mac10', 'shotgun', 'rocket', 'rocketvariant', 'quadrocket', 'nade', 'smoke', 'incendiary', 'flashbang',
    'bullet_light', 'bullet_medium', 'bullet_shells', 'bullet_heavy', 'board'].map((n) => `guns/${n}`),
  ...KK,
  // Quaternius "Stylized Nature" (CC0), textures assigned in world/Nature.js
  'nature/CommonTree_1', 'nature/CommonTree_3', 'nature/Bush_Common_Flowers', 'nature/Clover_1', 'nature/Clover_2',
  ...KIT_PIECES, ...KIT_PROPS, ...RES_PROPS,
  // Elijah Cobden "Stylized Trees Pack" (user-provided), see public/models/trees/CREDITS.md
  ...['STOak1', 'STOak2', 'STOak3', 'STOak5', 'STColumnar1', 'STColumnar3', 'STColumnar5', 'STPine1', 'STPine2', 'STPine3', 'STPine4', 'STPine5', 'STPine6', 'STPine7',
    'STWillow1', 'STWillow2', 'STWillow3', 'STSwiggly1', 'STSwiggly2', 'STSwiggly3', 'STSwiggly4'].map((n) => `trees/${n}`),
];

// Loads GLBs and flattens each into "parts" (one merged geometry per material),
// normalized so the model is centered on X/Z with its base at y = 0.
export class Models {
  constructor() { this.lib = new Map(); this.sharedMats = new Map(); }

  async load(names = ENV_MODELS, onProgress = () => {}) {
    const loader = new GLTFLoader();
    let done = 0;
    await Promise.all(names.map(async (n) => {
      const kit = KEEP_PIVOT.test(n);
      let gltf;
      try { gltf = await loader.loadAsync(kit ? `/models/${n}.gltf` : `/models/${n.includes('/') ? n : `env/${n}`}.glb`); } catch (e) { if (kit) { onProgress(++done / names.length); return; } throw e; }
      const flat = this._flatten(gltf.scene, kit);
      flat.scene = gltf.scene;
      this.lib.set(n, flat);
      onProgress(++done / names.length);
    }));
  }

  // keepPivot: leave the model where it was authored (kit pieces snap on a grid) and share one
  // material per name across all kit pieces (they use the same few trim sheets).
  _flatten(root, keepPivot = false) {
    root.updateMatrixWorld(true);
    const byMat = new Map();
    root.traverse((o) => {
      if (!o.isMesh) return;
      if (keepPivot) {
        const nm = o.material.name || 'm';
        if (!this.sharedMats.has(nm)) { o.material.envMapIntensity = 0.6; this.sharedMats.set(nm, o.material); }
        o.material = this.sharedMats.get(nm);
      }
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
      const key = o.material.name + (o.material.map ? ':t' : '');
      if (!byMat.has(key)) byMat.set(key, { material: o.material, geos: [] });
      byMat.get(key).geos.push(g.index ? g.toNonIndexed() : g);
    });
    // geometries merged per material must share one attribute set
    for (const entry of byMat.values()) {
      const common = ['position', 'normal', 'uv', 'color'].filter((k) => entry.geos.every((g) => g.attributes[k]));
      for (const g of entry.geos) for (const k of Object.keys(g.attributes)) if (!common.includes(k)) g.deleteAttribute(k);
    }
    const box = new THREE.Box3();
    const parts = [];
    for (const { material, geos } of byMat.values()) {
      const geometry = geos.length > 1 ? mergeGeometries(geos) : geos[0];
      geometry.computeBoundingBox();
      box.union(geometry.boundingBox);
      parts.push({ name: material.name.replace(/\.\d+$/, ''), material, geometry });
    }
    const c = box.getCenter(new THREE.Vector3());
    for (const p of parts) {
      if (!keepPivot) p.geometry.translate(-c.x, -box.min.y, -c.z);
      p.geometry.computeBoundingSphere();
    }
    const size = box.getSize(new THREE.Vector3());
    return { parts, size, center: keepPivot ? c : new THREE.Vector3(0, size.y / 2, 0) };
  }

  get(name) { return this.lib.get(name); }

  // A regular (non-instanced) group, e.g. for held weapons.
  instance(name, materialFn) {
    const m = this.get(name);
    const g = new THREE.Group();
    for (const p of m.parts) {
      const mesh = new THREE.Mesh(p.geometry, materialFn ? materialFn(p) : p.material);
      mesh.castShadow = true;
      g.add(mesh);
    }
    return g;
  }

  /**
   * One InstancedMesh per part for many placements.
   * placements: [{ x, y, z, rot, rx?, rz?, scale (number | Vector3), colors?: { [partName]: Color } }]
   */
  instanced(name, placements, { castShadow = true, receiveShadow = true, material } = {}) {
    const m = this.get(name);
    const group = new THREE.Group();
    const mat4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const e = new THREE.Euler();
    for (const part of m.parts) {
      const tinted = placements.some((pl) => pl.colors && pl.colors[part.name]);
      let mat = material ? material(part) : part.material.clone();
      if (tinted) mat.color.set('#ffffff');
      const im = new THREE.InstancedMesh(part.geometry, mat, placements.length);
      placements.forEach((pl, i) => {
        q.setFromEuler(e.set(pl.rx || 0, pl.rot || 0, pl.rz || 0, 'YXZ'));
        if (typeof pl.scale === 'number' || pl.scale === undefined) s.setScalar(pl.scale ?? 1); else s.copy(pl.scale);
        mat4.compose(p.set(pl.x, pl.y, pl.z), q, s);
        im.setMatrixAt(i, mat4);
        if (tinted) im.setColorAt(i, pl.colors?.[part.name] || part.material.color);
      });
      im.castShadow = castShadow;
      im.receiveShadow = receiveShadow;
      im.computeBoundingSphere();
      group.add(im);
    }
    return group;
  }
}
