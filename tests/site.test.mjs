import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { compileSite, validateFiles } from '../scripts/site.mjs';
import { projects } from '../scripts/site-config.mjs';
import { root, fixture } from './fixture.mjs';

test('home, every project page and the preview list are generated; no journal output remains', () => {
  const { files } = compileSite(root);
  assert.ok(files.has('index.html'));
  for (const project of projects) {
    assert.ok(files.has(`projects/${project.slug}.html`));
    assert.ok(files.get('mobile-preview.html').includes(`./projects/${project.slug}.html`));
  }
  assert.ok(![...files.keys()].some(name => name.startsWith('journal/') || name.includes('journal')));
});

test('same source produces byte-identical output', () => {
  const a = compileSite(root), b = compileSite(root);
  assert.deepEqual([...a.files.keys()], [...b.files.keys()]);
  for (const [key, value] of a.files) assert.ok(Buffer.from(value).equals(Buffer.from(b.files.get(key))));
});

test('CSS and script versions follow file contents and reject stale or arbitrary queries', t => {
  const dir = fixture(t);
  const before = compileSite(dir);
  const versionOf = (result, page, file) => {
    const ref = [...result.files.get(page).matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1]).find(ref => ref.includes(file + '?'));
    assert.ok(ref, `${page}: ${file}`);
    return ref.split('?v=')[1];
  };
  const oldCss = versionOf(before, 'index.html', 'home.css');
  const oldScript = versionOf(before, 'index.html', 'home-actions.js');
  assert.equal(versionOf(before, 'index.html', 'common.css'), versionOf(before, 'projects/reflectory.html', 'common.css'));
  fs.appendFileSync(path.join(dir, 'src/styles/home.css'), '\n/* cache revision */\n');
  const after = compileSite(dir);
  assert.notEqual(versionOf(after, 'index.html', 'home.css'), oldCss);
  assert.equal(versionOf(after, 'index.html', 'home-actions.js'), oldScript);
  for (const query of [`?v=${oldCss}`, '?v=../../private', '?anything=1']) {
    const changed = new Map(after.files);
    changed.set('index.html', changed.get('index.html').replace(/home\.css\?v=[a-f0-9]{12}/, 'home.css' + query));
    assert.throws(() => validateFiles(changed));
  }
});
