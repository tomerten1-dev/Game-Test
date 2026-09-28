# Your cosmetics

Put models (`.glb`, `.gltf`, `.fbx`, `.dae` or `.obj`) in these folders. Texture / `.bin` / `.mtl` files
next to a model are found by name; a model can also sit in its own sub-folder (`gliders/umbrella/scene.gltf`).

- `gliders/`    - gliders (sized to a ~4.4 m wingspan, shown above you while gliding)
- `pickaxes/`   - harvesting tools (the longest side becomes the handle; sized like the default axe)
- `backblings/` - back blings / backpacks (sized ~0.7 m tall, worn on your back)

Every file becomes a Locker item in that slot, always owned, named after the file
(`umbrella_glider.glb` -> "Umbrella Glider"), and bots use them too. Models are resized and centred to
fit; if one faces the wrong way, turn it in a 3D editor (e.g. Blender) and export again.

The model files are git-ignored (only this README is tracked), so they stay on your computer.
Restart `npm run dev` (or rebuild) after adding or removing files.
