import fs from 'fs';
import path from 'path';

// Every named import must actually be exported by the file it comes from.
//
// This exists because that failed, in the app, on a phone. A module was
// renamed — `TOES` became `FRONT_TOES` — and one of the two files that used it
// was updated. The other imported a name that no longer existed, which in
// JavaScript is not an error: it is `undefined`, and it stays quiet until
// something calls `.map` on it. The home screen crashed on open and the only
// reason anyone knew was Sentry.
//
// ESLint cannot see it: the config here has no resolver, so an import is just
// a string to it. The test suite can, because it can read both files.

const SRC = path.join(__dirname, '..', 'src');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith('.js')) out.push(p);
  }
  return out;
}

// `import { a, b as c } from './x'` — default and namespace imports are not
// checked, because those cannot be missing in the same silent way.
function namedImports(source) {
  const found = [];
  for (const m of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*'(\.[^']+)'/g)) {
    const names = m[1]
      .split(',')
      .map((n) => n.trim().split(/\s+as\s+/)[0].trim())
      .filter(Boolean);
    found.push({ names, from: m[2] });
  }
  // `import Thing, { a } from './x'`
  for (const m of source.matchAll(/import\s+\w+\s*,\s*\{([^}]+)\}\s*from\s*'(\.[^']+)'/g)) {
    const names = m[1]
      .split(',')
      .map((n) => n.trim().split(/\s+as\s+/)[0].trim())
      .filter(Boolean);
    found.push({ names, from: m[2] });
  }
  return found;
}

function exportedNames(source) {
  const names = new Set();
  for (const m of source.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:function|class)\s+(\w+)/g)) names.add(m[1]);
  for (const m of source.matchAll(/export\s+(?:const|let|var)\s+(\w+)/g)) names.add(m[1]);
  // `export { a, b as c }`
  for (const m of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const bits = part.trim().split(/\s+as\s+/);
      const name = (bits[1] || bits[0] || '').trim();
      if (name) names.add(name);
    }
  }
  // `export * from './x'` means anything could come through; treat the file as
  // open rather than reporting names it re-exports as missing.
  if (/export\s*\*\s*from/.test(source)) names.add('*');
  return names;
}

function resolve(fromFile, request) {
  const base = path.resolve(path.dirname(fromFile), request);
  for (const candidate of [`${base}.js`, path.join(base, 'index.js')]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

describe('named imports resolve to real exports', () => {
  const files = walk(SRC);

  it('finds the app to check', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('never imports a name its module does not export', () => {
    const broken = [];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      for (const { names, from } of namedImports(source)) {
        const target = resolve(file, from);
        if (!target) continue; // a package, or an asset — not ours to check
        const exported = exportedNames(fs.readFileSync(target, 'utf8'));
        if (exported.has('*')) continue;
        for (const name of names) {
          if (!exported.has(name)) {
            broken.push(`${path.relative(SRC, file)} imports { ${name} } from ${from}, which does not export it`);
          }
        }
      }
    }
    expect(broken).toEqual([]);
  });
});
