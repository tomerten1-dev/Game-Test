# Your skins

Put character models here: `.glb`, `.gltf`, `.fbx`, `.dae` (Collada) or `.obj`. Every model becomes a
built-in hero in the Locker, always owned, named after the file (`fishstick.glb` -> "Fishstick").

- Texture files (`.png`, `.jpg`, `.tga`...) and `.bin` / `.mtl` files next to a model are found by
  name, so the model keeps its colours. A model can also sit in its own sub-folder, e.g.
  `skins/fishstick/scene.gltf` (+ `scene.bin` + `textures/`) -> "Fishstick".
- Rigged models (Unreal / Fortnite-style, Mixamo, Blender, 3ds Max Biped bone names) are animated by the
  game: the animations are retargeted onto the model's own skeleton. Models without a skeleton stand still.
- No textures? Pick a colour for each part in Locker -> Hero -> Colours.
- This folder is git-ignored (only this README is tracked), so the models stay on your computer.
- Restart `npm run dev` after adding or removing files (textures next to models need the dev server).
