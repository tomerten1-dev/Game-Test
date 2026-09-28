// Vite plugin: every .blend file in skins/, cosmetics/ or weapons/ is turned into a .glb (with its textures) by
// Blender when the dev server / build starts, so the game can read it. The .glb goes in a
// "_from_blend" folder next to the .blend and is only redone when the .blend changes.
// Blender is found in its usual install places, on the PATH, or at the BLENDER environment variable.
import { existsSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { execFile, spawnSync } from 'node:child_process';

const ROOTS = ['skins', 'cosmetics', 'weapons'];
const OUT_DIR = '_from_blend';

function findBlends(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === OUT_DIR || name.startsWith('.')) continue;
    if (statSync(p).isDirectory()) findBlends(p, out);
    else if (/\.blend$/i.test(name)) out.push(p);
  }
  return out;
}

function findBlender() {
  if (process.env.BLENDER && existsSync(process.env.BLENDER)) return process.env.BLENDER;
  const tries = [];
  if (process.platform === 'win32') {
    for (const base of [process.env.ProgramFiles || 'C:\\Program Files', process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)']) {
      const foundation = join(base, 'Blender Foundation');
      if (existsSync(foundation)) {
        // newest version first
        const versions = readdirSync(foundation).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
        for (const v of versions) tries.push(join(foundation, v, 'blender.exe'));
      }
      tries.push(join(base, 'Steam', 'steamapps', 'common', 'Blender', 'blender.exe'));
    }
    if (process.env.LOCALAPPDATA) {
      const store = join(process.env.LOCALAPPDATA, 'Microsoft', 'WindowsApps', 'blender.exe');
      tries.push(store);
    }
  } else if (process.platform === 'darwin') {
    tries.push('/Applications/Blender.app/Contents/MacOS/Blender');
  } else {
    tries.push('/usr/bin/blender', '/usr/local/bin/blender', '/snap/bin/blender');
  }
  for (const t of tries) if (existsSync(t)) return t;
  const onPath = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['blender'], { encoding: 'utf8' });
  const hit = onPath.status === 0 && onPath.stdout.split(/\r?\n/).find(Boolean);
  return hit || null;
}

const run = (cmd, args) => new Promise((res) => {
  execFile(cmd, args, { maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60 * 1000 }, (err, stdout, stderr) => res({ err, out: `${stdout}\n${stderr}` }));
});

export default function blendPlugin() {
  const status = []; // { file, ok, reason } for the Locker
  let root = process.cwd();
  return {
    name: 'stormbound-blend',
    configResolved(c) { root = c.root; },
    async buildStart() {
      status.length = 0;
      const blends = ROOTS.flatMap((r) => findBlends(join(root, r)));
      if (!blends.length) return;
      const todo = blends.filter((b) => {
        const out = join(dirname(b), OUT_DIR, basename(b).replace(/\.blend$/i, '.glb'));
        return !existsSync(out) || statSync(out).mtimeMs < statSync(b).mtimeMs;
      });
      const rel = (p) => p.slice(root.length + 1).replace(/\\/g, '/');
      for (const b of blends) if (!todo.includes(b)) status.push({ file: rel(b), ok: true });
      if (!todo.length) return;
      const blender = findBlender();
      if (!blender) {
        console.warn('\n[skins] Found .blend files but not Blender, so they can\'t be converted:\n  ' + todo.map(rel).join('\n  ') +
          '\n  Install Blender (free, https://www.blender.org/download/) and restart, or set BLENDER=<path to blender.exe>.\n');
        for (const b of todo) status.push({ file: rel(b), ok: false, reason: 'Blender is not installed (free at blender.org) - install it and restart the game' });
        return;
      }
      const script = resolve(root, 'tools', 'blend2glb.py');
      for (const b of todo) {
        const out = join(dirname(b), OUT_DIR, basename(b).replace(/\.blend$/i, '.glb'));
        mkdirSync(dirname(out), { recursive: true });
        console.log(`[skins] Converting ${rel(b)} with Blender (the first time can take a minute)…`);
        const r = await run(blender, ['-b', b, '--python', script, '--', out]);
        const ok = existsSync(out) && statSync(out).mtimeMs >= statSync(b).mtimeMs;
        if (ok) console.log(`[skins] ${rel(b)} -> ${rel(out)}`);
        else console.warn(`[skins] Couldn't convert ${rel(b)}:\n${r.out.split('\n').filter((l) => /error|blend2glb/i.test(l)).slice(-8).join('\n')}`);
        status.push({ file: rel(b), ok, reason: ok ? null : 'Blender could not export it - see the terminal' });
      }
    },
    resolveId(id) { return id === 'virtual:blend-status' ? '\0virtual:blend-status' : null; },
    load(id) { return id === '\0virtual:blend-status' ? `export default ${JSON.stringify(status)};` : null; },
  };
}
