import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { compileSite, validateFiles } from '../scripts/site.mjs';
import { root, post, fixture } from './fixture.mjs';

test('one new post automatically updates detail, home list and preview list', t => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, 'content/journal/2026-09-15-new.md'), post('2026-09-15', '새 일지'));
  const result = compileSite(dir);
  assert.ok(result.files.has('journal/2026-09-15-new.html'));
  assert.ok(result.files.get('index.html').includes('2026-09-15-new.html'));
  assert.ok(result.files.get('mobile-preview.html').includes('2026-09-15-new.html'));
});

test('posts are newest first and drafts are never published', t => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, 'content/journal/2026-08-01-old.md'), post('2026-08-01', '이전 글'));
  fs.writeFileSync(path.join(dir, 'content/journal/2026-09-15-new.md'), post('2026-09-15', '최신 글'));
  fs.writeFileSync(path.join(dir, 'content/journal/2026-09-16-draft.md'), post('2026-09-16', '작성 중', 'draft: true\n'));
  const result = compileSite(dir);
  assert.deepEqual(result.posts.map(p => p.title), ['최신 글', '이전 글']);
  assert.ok(!result.files.has('journal/2026-09-16-draft.html'));
});

test('zero posts has a useful empty state and builds successfully', t => {
  const result = compileSite(fixture(t));
  assert.ok(result.files.get('index.html').includes('아직 등록된 일지가 없습니다.'));
  assert.equal(result.posts.length, 0);
});

test('same source produces byte-identical output', () => {
  const a = compileSite(root), b = compileSite(root);
  assert.deepEqual([...a.files.keys()], [...b.files.keys()]);
  for (const [key, value] of a.files) assert.ok(Buffer.from(value).equals(Buffer.from(b.files.get(key))));
});

test('CSS and script versions follow file contents and reject stale or arbitrary queries', t => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, 'content/journal/2026-09-15-version.md'), post('2026-09-15', '버전 검사'));
  const before = compileSite(dir);
  const versionOf = (result, page, file) => {
    const ref = [...result.files.get(page).matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1]).find(ref => ref.includes(file + '?'));
    assert.ok(ref, `${page}: ${file}`);
    return ref.split('?v=')[1];
  };
  const oldCss = versionOf(before, 'index.html', 'home.css');
  const oldScript = versionOf(before, 'index.html', 'photos.js');
  assert.equal(versionOf(before, 'index.html', 'common.css'), versionOf(before, 'journal/2026-09-15-version.html', 'common.css'));
  fs.appendFileSync(path.join(dir, 'src/styles/home.css'), '\n/* cache revision */\n');
  const after = compileSite(dir);
  assert.notEqual(versionOf(after, 'index.html', 'home.css'), oldCss);
  assert.equal(versionOf(after, 'index.html', 'photos.js'), oldScript);
  for (const query of [`?v=${oldCss}`, '?v=../../private', '?anything=1']) {
    const changed = new Map(after.files);
    changed.set('index.html', changed.get('index.html').replace(/home\.css\?v=[a-f0-9]{12}/, 'home.css' + query));
    assert.throws(() => validateFiles(changed));
  }
});
