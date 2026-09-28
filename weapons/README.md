# Your weapons

Put gun models here to replace the game's gun models. Name the file after the weapon, optionally
followed by rarities:

- `ar_legendary.blend` - the legendary Assault Rifle
- `ar_epic_legendary.glb` - epic and legendary Assault Rifles
- `pump.fbx` - every Pump Shotgun

Weapon names: `ar`, `burst`, `pump`, `shotgun`, `smg`, `pistol`, `sniper`, `dmr`, `rocket`, `drum`,
`handcannon`, `minigun`, `launcher`... Rarities: `common`, `uncommon`, `rare`, `epic`, `legendary`,
`mythic`.

Formats: `.glb`, `.gltf`, `.fbx`, `.dae`, `.obj` (texture files next to the model are found by name), or
`.blend` (converted with its textures by Blender when `npm run dev` starts - install Blender first).
Models are turned so the barrel points forward and the grip hangs down, and sized like the gun they
replace. The folder is git-ignored (only this README is tracked). Restart `npm run dev` after changes.
