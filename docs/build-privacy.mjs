// Generates the public privacy page from PRIVACY.md.
//
// The markdown stays the single source of truth — a policy that exists in two
// hand-maintained copies drifts, and the version people actually read would be
// the stale one. Run this after editing PRIVACY.md and commit both.
//
//   node docs/build-privacy.mjs
import fs from 'fs';
import path from 'path';

const src = fs.readFileSync(path.join(import.meta.dirname, 'PRIVACY.md'), 'utf8');
const lines = src.split('\n');
const out = [];
let inTable = false;
let paragraph = [];

const inline = (s) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

function flush() {
  if (paragraph.length) {
    out.push('<p>' + inline(paragraph.join(' ')) + '</p>');
    paragraph = [];
  }
}

for (const raw of lines) {
  const line = raw.trimEnd();

  if (/^\|/.test(line)) {
    flush();
    if (/^\|[\s:|-]+\|$/.test(line)) continue; // separator row
    const cells = line.split('|').slice(1, -1).map((c) => inline(c.trim()));
    if (!inTable) {
      out.push('<table><thead><tr>' + cells.map((c) => `<th>${c}</th>`).join('') + '</tr></thead><tbody>');
      inTable = true;
    } else {
      out.push('<tr>' + cells.map((c) => `<td>${c}</td>`).join('') + '</tr>');
    }
    continue;
  }
  if (inTable) {
    out.push('</tbody></table>');
    inTable = false;
  }

  if (!line.trim()) { flush(); continue; }
  if (/^# /.test(line)) { flush(); out.push(`<h1>${inline(line.slice(2))}</h1>`); continue; }
  if (/^## /.test(line)) { flush(); out.push(`<h2>${inline(line.slice(3))}</h2>`); continue; }
  if (/^### /.test(line)) { flush(); out.push(`<h3>${inline(line.slice(4))}</h3>`); continue; }
  if (/^---$/.test(line)) { flush(); out.push('<hr>'); continue; }
  if (/^- /.test(line)) {
    flush();
    if (out[out.length - 1] !== '<ul>' && !/^<li>/.test(out[out.length - 1] || '')) out.push('<ul>');
    out.push(`<li>${inline(line.slice(2))}</li>`);
    continue;
  }
  if (/^\*(.+)\*$/.test(line.trim())) { flush(); out.push(`<p class="note">${inline(line.trim().slice(1, -1))}</p>`); continue; }
  paragraph.push(line.trim());
}
flush();
if (inTable) out.push('</tbody></table>');

// Close any list that ran to the end of the document.
const html = out
  .join('\n')
  .replace(/(<li>.*<\/li>)(?!\n<li>)/gs, (m) => m)
  .replace(/<ul>\n((?:<li>.*<\/li>\n?)+)/g, (m, items) => `<ul>\n${items}</ul>\n`);

const page = `<!doctype html>
<html lang="sr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Politika privatnosti — Duo Tracker</title>
<style>
  :root { color-scheme: light dark; }
  body {
    max-width: 46rem; margin: 0 auto; padding: 2.5rem 1.25rem 5rem;
    font: 16px/1.7 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #1a1a1a; background: #ffffff;
  }
  h1 { font-size: 1.7rem; line-height: 1.3; margin: 0 0 .5rem; }
  h2 { font-size: 1.2rem; margin: 2.2rem 0 .6rem; }
  h3 { font-size: 1rem; margin: 1.4rem 0 .4rem; }
  p { margin: 0 0 1rem; }
  hr { border: 0; border-top: 1px solid #e3e3e3; margin: 2rem 0; }
  table { border-collapse: collapse; width: 100%; margin: 0 0 1.2rem; font-size: .95rem; }
  th, td { text-align: left; padding: .55rem .6rem; border-bottom: 1px solid #e3e3e3; vertical-align: top; }
  th { font-weight: 600; }
  ul { margin: 0 0 1rem; padding-left: 1.3rem; }
  li { margin: .3rem 0; }
  code { font-size: .9em; background: #f2f2f2; padding: .1em .35em; border-radius: 3px; }
  a { color: #0C447C; }
  .note { font-size: .9rem; color: #666; }
  @media (prefers-color-scheme: dark) {
    body { color: #e8e8e8; background: #141618; }
    hr, th, td { border-color: #2c3034; }
    code { background: #23272b; }
    a { color: #7fb2f0; }
    .note { color: #9aa0a6; }
  }
</style>
</head>
<body>
${html}
</body>
</html>
`;

fs.mkdirSync(path.join(import.meta.dirname, 'public'), { recursive: true });
fs.writeFileSync(path.join(import.meta.dirname, 'public', 'index.html'), page);
console.log('Wrote docs/public/index.html (' + page.length + ' bytes)');
