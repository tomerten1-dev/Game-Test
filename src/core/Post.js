import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, SMAAEffect, SMAAPreset,
  ToneMappingEffect, ToneMappingMode, HueSaturationEffect, BrightnessContrastEffect, Effect, BlendFunction,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

// Warm/cool split-tone grade: slightly warm highlights, cool shadows (Fortnite-ish "sunny" look).
class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', /* glsl */ `
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        vec3 shadows = vec3(0.93, 0.97, 1.08);
        vec3 highs = vec3(1.05, 1.01, 0.94);
        c *= mix(shadows, highs, smoothstep(0.05, 0.7, l));
        outputColor = vec4(c, inputColor.a);
      }`, { blendFunction: BlendFunction.NORMAL });
  }
}

// Post-processing chain: AO -> bloom -> grade -> ACES tone mapping -> SMAA.
export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabled = false;
    this.aoEnabled = false;
  }

  configure({ post, ao, bloom }) {
    this.dispose();
    this.enabled = post;
    this.renderer.toneMapping = post ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    if (!post) return;
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    composer.addPass(new RenderPass(this.scene, this.camera));
    if (ao) {
      const n8 = new N8AOPostPass(this.scene, this.camera, size.x, size.y);
      n8.configuration.aoRadius = 3.0;
      n8.configuration.distanceFalloff = 1.2;
      n8.configuration.intensity = 3.6;
      n8.configuration.color = new THREE.Color('#1c2440');
      n8.configuration.gammaCorrection = false;
      n8.setQualityMode('Medium');
      n8.configuration.halfRes = true;
      composer.addPass(n8);
      this.n8 = n8;
    }
    const effects = [];
    if (bloom) {
      this.bloom = new BloomEffect({ luminanceThreshold: 0.82, luminanceSmoothing: 0.3, intensity: 1.15, mipmapBlur: true, radius: 0.75 });
      effects.push(this.bloom);
    }
    effects.push(
      new GradeEffect(),
      new HueSaturationEffect({ saturation: 0.16 }),
      new BrightnessContrastEffect({ brightness: 0.0, contrast: 0.07 }),
      new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }),
    );
    composer.addPass(new EffectPass(this.camera, ...effects));
    composer.addPass(new EffectPass(this.camera, new SMAAEffect({ preset: SMAAPreset.MEDIUM })));
    this.composer = composer;
  }

  setSize(w, h) { this.composer?.setSize(w, h); }

  render(dt) {
    if (this.enabled && this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.composer?.dispose();
    this.composer = null;
    this.n8 = null;
    this.bloom = null;
  }
}
