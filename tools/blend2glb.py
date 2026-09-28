"""Turn a .blend file into a .glb the game can read, keeping its textures (colours) inside.

Run by the dev server for every .blend in skins/ or cosmetics/ (see vite.config.js):
    blender -b model.blend --python tools/blend2glb.py -- out.glb
It also works with the `bpy` Python module:
    python tools/blend2glb.py model.blend out.glb

Materials whose colour comes from a texture the glTF exporter can't follow (custom node groups, as in
many game rips) get a plain Principled BSDF wired to that texture, so the colours still come through.
"""
import re
import sys

import bpy

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
if len(args) >= 2:
    bpy.ops.wm.open_mainfile(filepath=args[0])
out = args[-1]

# textures saved next to the .blend (not packed inside) are found relative to it
try:
    bpy.ops.file.make_paths_absolute()
except Exception:
    pass

COLOR_NAME = re.compile(r'(diff|albedo|base.?col|colou?r|_d$|_d[._]|_bc$|_bc[._]|_c$|_c[._]|tex)', re.I)
SKIP_NAME = re.compile(r'(normal|_n$|_n[._]|nrm|rough|metal|spec|_s$|_s[._]|_m$|_m[._]|ao|occlusion|emiss|mask|height|disp|bump|opac|alpha)', re.I)


def base_image(nodes):
    imgs = [n for n in nodes if n.type == 'TEX_IMAGE' and n.image]
    if not imgs:
        return None
    named = lambda n: f'{n.image.name} {n.label} {n.name}'
    good = [n for n in imgs if COLOR_NAME.search(named(n)) and not SKIP_NAME.search(named(n))]
    plain = [n for n in imgs if not SKIP_NAME.search(named(n))]
    pick = (good or plain or imgs)
    return max(pick, key=lambda n: n.image.size[0] * n.image.size[1])


def fed_by_image(sock):
    """True if a texture reaches this socket in a way the exporter understands."""
    if not sock.is_linked:
        return False
    node = sock.links[0].from_node
    for _ in range(4):
        if node.type == 'TEX_IMAGE':
            return True
        ins = [i for i in node.inputs if i.is_linked and i.type == 'RGBA']
        if node.type not in ('MIX', 'MIX_RGB', 'GAMMA', 'HUE_SAT', 'BRIGHTCONTRAST', 'CURVE_RGB') or not ins:
            return False
        node = ins[0].links[0].from_node
    return False


fixed = 0
for mat in bpy.data.materials:
    if not mat.use_nodes or not mat.node_tree:
        continue
    nt = mat.node_tree
    out_node = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL' and n.is_active_output), None) or next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None)
    if not out_node:
        continue
    surf = out_node.inputs['Surface']
    shader = surf.links[0].from_node if surf.is_linked else None
    if shader and shader.type == 'BSDF_PRINCIPLED' and fed_by_image(shader.inputs['Base Color']):
        continue
    img = base_image(nt.nodes)
    if not img:
        continue
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (out_node.location.x - 300, out_node.location.y - 400)
    nt.links.new(img.outputs['Color'], bsdf.inputs['Base Color'])
    if 'Roughness' in bsdf.inputs:
        bsdf.inputs['Roughness'].default_value = 0.7
    nt.links.new(bsdf.outputs['BSDF'], surf)
    fixed += 1
if fixed:
    print(f'blend2glb: wired textures into {fixed} material(s)')

opts = dict(filepath=out, export_format='GLB', export_animations=False, export_apply=False, use_renderable=True)
while True:
    try:
        bpy.ops.export_scene.gltf(**opts)
        break
    except TypeError as e:  # an option this Blender version doesn't have
        bad = next((k for k in list(opts) if k in str(e) and k not in ('filepath', 'export_format')), None)
        if not bad:
            raise
        opts.pop(bad)
print(f'blend2glb: wrote {out}')
