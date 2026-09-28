import { defineConfig } from 'vite';
import blendPlugin from './tools/blend-plugin.js';

export default defineConfig({
  server: { host: true },
  build: { chunkSizeWarningLimit: 1500 },
  plugins: [blendPlugin()], // .blend files in skins/ and cosmetics/ -> .glb (needs Blender installed)
});
