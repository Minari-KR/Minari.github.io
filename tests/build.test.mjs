import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { root, post, fixture, copyFixtureTree } from './fixture.mjs';

test('unknown output files stop build and check without deleting files or overwriting pages', t => {
  for (const name of ['journal/2020-01-01-old.html', 'assets/css/manual.css', 'dist/private.txt']) {
    const dir = fixture(t);
    copyFixtureTree(path.join(root, 'scripts'), path.join(dir, 'scripts'));
    const build = (...args) => execFileSync(process.execPath, [path.join(dir, 'scripts/build.mjs'), ...args], { stdio: 'pipe' });
    build();
    const before = fs.readFileSync(path.join(dir, 'index.html'));
    const unknown = path.join(dir, name);
    fs.mkdirSync(path.dirname(unknown), { recursive: true });
    fs.writeFileSync(unknown, 'Keep this file');
    assert.throws(() => build('--check'), error => error.stderr.toString().includes('관리하지 않는 파일'));
    fs.writeFileSync(path.join(dir, 'content/journal/2026-09-15-new.md'), post('2026-09-15', '새 글'));
    assert.throws(() => build(), error => error.stderr.toString().includes('관리하지 않는 파일'));
    assert.equal(fs.readFileSync(unknown, 'utf8'), 'Keep this file');
    assert.ok(fs.readFileSync(path.join(dir, 'index.html')).equals(before));
  }
});

test('build removes deleted generated posts and refuses to overwrite output on bad content', t => {
  const dir = fixture(t);
  copyFixtureTree(path.join(root, 'scripts'), path.join(dir, 'scripts'));
  const first = path.join(dir, 'content/journal/2026-09-15-first.md');
  const second = path.join(dir, 'content/journal/2026-09-16-second.md');
  fs.writeFileSync(first, post('2026-09-15', '첫 글'));
  fs.writeFileSync(second, post('2026-09-16', '둘째 글'));
  const build = (...args) => execFileSync(process.execPath, [path.join(dir, 'scripts/build.mjs'), ...args], { stdio: 'pipe' });
  build();
  fs.unlinkSync(first);
  build();
  build('--check');
  assert.ok(!fs.existsSync(path.join(dir, 'journal/2026-09-15-first.html')));
  assert.ok(!fs.existsSync(path.join(dir, 'dist/journal/2026-09-15-first.html')));
  const before = fs.readFileSync(path.join(dir, 'index.html'));
  fs.appendFileSync(second, '\n[잘못된 링크](javascript:evil)\n');
  assert.throws(() => build());
  assert.ok(fs.readFileSync(path.join(dir, 'index.html')).equals(before));
});

test('generated-file manifest cannot delete source through a parent path', t => {
  const dir = fixture(t);
  copyFixtureTree(path.join(root, 'scripts'), path.join(dir, 'scripts'));
  const target = path.join(dir, 'src/styles/home.css');
  const before = fs.readFileSync(target);
  fs.writeFileSync(path.join(dir, '.generated-files.json'), JSON.stringify(['assets/css/../../src/styles/home.css']));
  assert.throws(() => execFileSync(process.execPath, [path.join(dir, 'scripts/build.mjs')], { stdio: 'pipe' }));
  assert.ok(fs.readFileSync(target).equals(before));
});

test('rebuilding preserves unchanged file timestamps and repairs changed output', t => {
  const dir = fixture(t);
  copyFixtureTree(path.join(root, 'scripts'), path.join(dir, 'scripts'));
  const build = (...args) => execFileSync(process.execPath, [path.join(dir, 'scripts/build.mjs'), ...args], { stdio: 'pipe' });
  build();
  const names = ['index.html', 'dist/index.html', '.generated-files.json', 'assets/videos/reflectory-gameplay.mp4', 'dist/assets/videos/reflectory-gameplay.mp4'];
  const oldTime = new Date('2020-01-01T00:00:00Z');
  for (const name of names) fs.utimesSync(path.join(dir, name), oldTime, oldTime);
  build();
  for (const name of names) assert.equal(fs.statSync(path.join(dir, name)).mtimeMs, oldTime.getTime(), name);
  const page = path.join(dir, 'dist/index.html');
  const expected = fs.readFileSync(page, 'utf8');
  fs.writeFileSync(page, expected.replace('Minari', 'Broken'));
  assert.throws(() => build('--check'));
  build();
  assert.equal(fs.readFileSync(page, 'utf8'), expected);
  build('--check');
});
