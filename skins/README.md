# Your skins

Put character models here (`.glb` is best; `.gltf` works on the dev server). Every file becomes a
built-in hero in the Locker, always owned, named after the file (`fishstick.glb` -> "Fishstick").

- This folder is git-ignored (only this README is tracked), so the models stay on your computer.
- Rigs with Unreal-mannequin bone names (pelvis, spine_01, thigh_l, hand_r...) or Mixamo names are
  driven by the game's animations; other models load but stand still.
- Restart `npm run dev` (or rebuild) after adding or removing files.
