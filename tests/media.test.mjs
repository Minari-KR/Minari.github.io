import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { compileSite, validateFiles } from '../scripts/site.mjs';
import { root, post, fixture, copyFixtureTree, imageBytes } from './fixture.mjs';

test('media collection and link validation use the same attribute rules', t => {
  const dir = fixture(t);
  const home = path.join(dir, 'src/templates/home.html');
  const source = fs.readFileSync(home, 'utf8').replaceAll('src="./assets/images/', "SRC='./assets/images/").replace(/(SRC='[^"\n]+)"/g, "$1'");
  fs.writeFileSync(home, source.replace('src="./assets/videos/reflectory-gameplay.mp4"', "SRC='./assets/videos/reflectory-gameplay.mp4'"));
  const result = compileSite(dir);
  for (const name of ['assets/images/cards/reflectory-title.webp', 'assets/images/cards/barrel-good-barrel-title.webp', 'assets/videos/reflectory-gameplay.mp4']) {
    assert.ok(result.publicFiles.get(name).equals(fs.readFileSync(path.join(dir, 'public', name))));
  }
  assert.doesNotMatch(result.publicFiles.get('index.html'), /data-full-src="\.\/assets\/images\/(?:reflectory-title|barrel-good-barrel-title)\.png"/);
});

test('card previews and full-size images are both published and full-size paths are validated', () => {
  const { publicFiles } = compileSite(root);
  const html = publicFiles.get('index.html');
  const originals = [...html.matchAll(/data-full-src="\.\/([^\"]+)"/g)].map(match => match[1]);
  assert.equal(originals.length, 10);
  for (const removed of ['reflectory-gameplay.png', 'barrel-good-barrel-prototype.png', 'cards/barrel-good-barrel-prototype.webp', 'barrel-good-barrel-traits.png', 'cards/barrel-good-barrel-traits.webp', 'barrel-good-barrel-tutorial.png', 'cards/barrel-good-barrel-tutorial.webp', 'reflectory-title.png', 'barrel-good-barrel-title.png']) {
    assert.equal(publicFiles.has(`assets/images/${removed}`), false);
  }
  for (const replaced of ['cards/reflectory-gameplay.webp', 'barrel-good-barrel-poster.webp']) assert.equal(publicFiles.has(`assets/images/${replaced}`), false);
  assert.match(html, /poster="\.\/assets\/images\/cards\/reflectory-title\.webp(?:\?v=[a-f0-9]{12})?"/);
  assert.match(html, /poster="\.\/assets\/images\/cards\/barrel-good-barrel-title\.webp(?:\?v=[a-f0-9]{12})?"/);
  assert.ok(publicFiles.has('assets/images/cards/reflectory-title.webp'));
  assert.ok(publicFiles.has('assets/images/cards/barrel-good-barrel-title.webp'));
  for (const original of originals) {
    const preview = original.replace(/\/([^/]+)\.(png|jpg)$/, '/cards/$1.webp');
    assert.ok(publicFiles.get(original).equals(fs.readFileSync(path.join(root, 'public', original))));
    assert.ok(publicFiles.has(preview));
    assert.ok(publicFiles.get(preview).length < publicFiles.get(original).length);
  }
  for (const ref of ['', './assets/images/missing.png', 'https://example.com/photo.png', '../secret.png', './assets/js/photos.js']) {
    const changed = new Map(publicFiles);
    changed.set('index.html', html.replace(/data-full-src="[^"]+"/, `data-full-src="${ref}"`));
    assert.throws(() => validateFiles(changed));
  }
});

test('missing image and fake raster file fail before output is written', t => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, 'content/journal/2026-09-15-new.md'), post('2026-09-15', '이미지') + '\n![화면](assets/images/missing.png)\n');
  assert.throws(() => compileSite(dir), /연결 대상/);
  fs.mkdirSync(path.join(dir, 'public/assets/images'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'public/assets/images/missing.png'), '<script>not a picture</script>');
  assert.throws(() => compileSite(dir), /확장자/);
});

test('published video is copied unchanged and unreferenced video is excluded', t => {
  const dir = fixture(t);
  const videos = path.join(dir, 'public/assets/videos');
  const original = fs.readFileSync(path.join(videos, 'reflectory-gameplay.mp4'));
  fs.writeFileSync(path.join(videos, 'unused.mp4'), original);
  const result = compileSite(dir);
  for (const files of [result.files, result.publicFiles]) {
    assert.ok(files.get('assets/videos/reflectory-gameplay.mp4').equals(original));
    assert.ok(!files.has('assets/videos/unused.mp4'));
  }
});

test('video type and size are checked before publishing', t => {
  const dir = fixture(t);
  const video = path.join(dir, 'public/assets/videos/reflectory-gameplay.mp4');
  fs.writeFileSync(video, 'version https://git-lfs.github.com/spec/v1\noid sha256:' + '0'.repeat(64) + '\nsize 1000\n');
  assert.throws(() => compileSite(dir), /LFS 실제 영상/);
  fs.writeFileSync(video, '<script>not a video</script>');
  assert.throws(() => compileSite(dir), /영상 내용과 확장자/);
  fs.truncateSync(video, 50 * 1024 * 1024 + 1);
  assert.throws(() => compileSite(dir), /영상은 50MB/);
  fs.unlinkSync(video);
  assert.throws(() => compileSite(dir), /연결 대상/);
});

test('video sources and posters reject missing and external resources', () => {
  const result = compileSite(root);
  for (const injection of [
    '<video src="./assets/videos/missing.mp4"></video>',
    '<video src="./assets/videos/reflectory-gameplay.mp4" poster="./assets/images/missing.png"></video>',
    '<video src="https://example.com/video.mp4"></video>',
    '<video><source src="https://example.com/video.mp4"></video>',
    '<video poster="https://example.com/poster.png"></video>'
  ]) {
    const changed = new Map(result.files);
    changed.set('index.html', changed.get('index.html').replace('</main>', injection + '</main>'));
    assert.throws(() => validateFiles(changed), /연결 대상|외부 리소스/);
  }
});

test('only images referenced by published posts or home are generated', t => {
  const dir = fixture(t);
  const images = path.join(dir, 'public/assets/images');
  fs.mkdirSync(images, { recursive: true });
  for (const name of ['published', 'draft', 'unused', 'home', 'shared']) fs.writeFileSync(path.join(images, name + '.png'), imageBytes);
  fs.writeFileSync(path.join(dir, 'content/journal/2026-09-15-published.md'), post('2026-09-15', '공개') + '\n![공개](assets/images/published.png)\n\n![공유](assets/images/shared.png)\n');
  fs.writeFileSync(path.join(dir, 'content/journal/2026-09-16-draft.md'), post('2026-09-16', '초안', 'draft: true\n') + '\n![초안](assets/images/draft.png)\n\n![공유](assets/images/shared.png)\n');
  const home = path.join(dir, 'src/templates/home.html');
  fs.writeFileSync(home, fs.readFileSync(home, 'utf8').replace('</main>', '<img src="./assets/images/home.png" alt="홈 사진">\n<!-- <img src="./assets/images/unused.png"> -->\n</main>'));
  const result = compileSite(dir);
  for (const files of [result.files, result.publicFiles]) {
    for (const name of ['published', 'home', 'shared']) assert.ok(files.has(`assets/images/${name}.png`));
    for (const name of ['draft', 'unused']) assert.ok(!files.has(`assets/images/${name}.png`));
  }
});

test('changing a published post to draft removes generated images but keeps originals', t => {
  const dir = fixture(t);
  copyFixtureTree(path.join(root, 'scripts'), path.join(dir, 'scripts'));
  const images = path.join(dir, 'public/assets/images');
  fs.mkdirSync(images, { recursive: true });
  fs.writeFileSync(path.join(images, 'photo.png'), imageBytes);
  const article = path.join(dir, 'content/journal/2026-09-15-photo.md');
  const body = '\n![사진](assets/images/photo.png)\n';
  fs.writeFileSync(article, post('2026-09-15', '사진') + body);
  const build = (...args) => execFileSync(process.execPath, [path.join(dir, 'scripts/build.mjs'), ...args], { stdio: 'pipe' });
  build();
  assert.ok(fs.existsSync(path.join(dir, 'dist/assets/images/photo.png')));
  fs.writeFileSync(article, post('2026-09-15', '사진', 'draft: true\n') + body);
  assert.throws(() => build('--check'));
  build();
  build('--check');
  for (const folder of ['', 'dist']) {
    assert.ok(!fs.existsSync(path.join(dir, folder, 'assets/images/photo.png')));
    assert.ok(!fs.existsSync(path.join(dir, folder, 'journal/2026-09-15-photo.html')));
  }
  assert.ok(fs.readFileSync(path.join(images, 'photo.png')).equals(imageBytes));
});
