import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('application element references exist in the HTML', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  const block = app.match(/Object\.fromEntries\(\[([^\]]+)\]\.map/);
  assert.ok(block, 'element reference list exists');
  const references = [...block[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  assert.deepEqual(references.filter(id => !ids.has(id)), []);
});
