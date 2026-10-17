// Inline the shared CSS/JS and each page's maths core into self-contained HTML files at the repo root.
// Usage: node tools/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = p => fs.readFileSync(path.join(root, 'src', p), 'utf8');
const css = src('common.css'), js = src('common.js');
const HEAD = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Public+Sans:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
${css}</style>`;

const pages = fs.readdirSync(path.join(root, 'src', 'pages')).filter(f => f.endsWith('.html'));
for (const p of pages) {
  let html = src(path.join('pages', p));
  html = html.replace('<!--@HEAD-->', () => HEAD);
  html = html.replace('<!--@COMMONJS-->', () => `<script>\n${js}</script>`);
  html = html.replace(/<!--@CORE ([\w.-]+)-->/g, (_, f) => `<script id="core">\n${src(f)}</script>`);
  if (/<!--@/.test(html)) throw new Error('unresolved marker in ' + p);
  fs.writeFileSync(path.join(root, p), html);
  console.log('built', p, (html.length / 1024).toFixed(1) + ' kB');
}
