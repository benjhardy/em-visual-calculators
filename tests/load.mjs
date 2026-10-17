// Load the maths core that ships inside a built calculator page (the <script id="core"> block),
// so the tests check exactly the code the browser runs.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function loadCore(page, name) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  const m = html.match(/<script id="core">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no core script in ' + page);
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(m[1], ctx, { filename: page + '#core' });
  if (!ctx[name]) throw new Error(name + ' not exported by ' + page);
  return ctx[name];
}
// relative closeness
export const rel = (a, b) => Math.abs(a / b - 1);
