import fs from 'fs';
import path from 'path';

// Every `styles.x` must be a style that exists.
//
// A missing one is not an error in React Native: it is `undefined` in a style
// array, which is skipped in silence. The element renders with no padding, no
// colour, no size, and nothing anywhere says why — you find it by looking at
// the screen and noticing that something is slightly wrong.
//
// This is the same family of fault as the missing import that crashed Home,
// and it is cheap to pin: both sides are in one file.

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

// Top-level keys of the object passed to StyleSheet.create, found by counting
// braces rather than by matching indentation — the files here are not all
// indented the same and a regex over line starts quietly misses half of them.
// Comments come out first. A sentence like "quiet on purpose: the figure" has
// a colon in it, and a parser counting colons reads that as a key and then
// skips the real one on the next line — which is how this test first reported
// three styles missing that were all perfectly well defined.
function stripComments(source) {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlocks
    .split(/\r?\n/)
    .map((line) => (/^\s*\/\//.test(line) ? '' : line))
    .join('\n');
}

function sheetKeys(input) {
  const source = stripComments(input);
  const keys = new Set();
  for (const open of [...source.matchAll(/StyleSheet\.create\(\{/g)]) {
    let depth = 1;
    let i = open.index + open[0].length;
    let atTop = true;
    let token = '';
    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (ch === '{' || ch === '[' || ch === '(') depth += 1;
      else if (ch === '}' || ch === ']' || ch === ')') depth -= 1;
      else if (depth === 1) {
        if (ch === ':' && atTop) {
          const name = token.trim().replace(/^\.\.\./, '');
          if (/^[A-Za-z_$][\w$]*$/.test(name)) keys.add(name);
          atTop = false;
          token = '';
        } else if (ch === ',') {
          // A bare `card,` shorthand is a style too.
          const name = token.trim();
          if (/^[A-Za-z_$][\w$]*$/.test(name)) keys.add(name);
          atTop = true;
          token = '';
        } else {
          token += ch;
        }
      }
      if (depth === 1 && (ch === '}' || ch === ']' || ch === ')')) {
        atTop = true;
        token = '';
      }
      i += 1;
    }
  }
  return keys;
}

function usedNames(source) {
  return new Set([...source.matchAll(/\bstyles\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
}

describe('every style used is a style that exists', () => {
  const files = walk(SRC).filter((f) => {
    const s = fs.readFileSync(f, 'utf8');
    return s.includes('StyleSheet.create') && s.includes('styles.');
  });

  it('finds the screens to check', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('never reaches for a style the file does not define', () => {
    const broken = [];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      const defined = sheetKeys(source);
      // A file that builds its styles somewhere else is not ours to judge.
      if (defined.size === 0) continue;
      for (const name of usedNames(source)) {
        if (!defined.has(name)) broken.push(`${path.relative(SRC, file)} uses styles.${name}, which it does not define`);
      }
    }
    expect(broken).toEqual([]);
  });
});
