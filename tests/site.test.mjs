import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escapeHtml, safeUrl, parsePost, renderMarkdown } from '../scripts/content.mjs';
import { compileSite, validateFiles, securityMeta } from '../scripts/site.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const originalPost = fs.readFileSync(path.join(root, 'content/journal/2026-08-12-gamejam-retrospective.md'), 'utf8');
const post = (date, title, extra = '') => `---\ntitle: ${title}\ndate: ${date}\n${extra}---\n\n## 경험\n\n본문입니다.\n`;

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'minari-portfolio-test-'));
  fs.cpSync(path.join(root, 'src'), path.join(directory, 'src'), { recursive: true });
  fs.cpSync(path.join(root, 'public'), path.join(directory, 'public'), { recursive: true });
  // Synthetic journals have their own posts; keep the editorial link independent of those fixtures.
  // compileSite(root) tests below still validate the real home-to-article link and screenshot.
  const home = path.join(directory, 'src/templates/home.html');
  fs.writeFileSync(home, fs.readFileSync(home, 'utf8').replace('href="./journal/2026-08-12-gamejam-retrospective.html"', 'href="#journal"'));
  fs.mkdirSync(path.join(directory, 'content/journal'), { recursive: true });
  t.after(() => {
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('minari-portfolio-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return directory;
}

test('HTML in text cannot become executable markup', () => {
  const input = '<script>alert(1)</script> & "quoted"';
  assert.equal(escapeHtml(input), '&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quoted&quot;');
  assert.ok(!renderMarkdown(input).includes('<script>'));
  assert.ok(renderMarkdown('**<img src=x onerror=alert(1)>**').includes('&lt;img'));
});

test('supported Markdown keeps headings, paragraphs, lists and bold semantic', () => {
  const result = renderMarkdown('## 제목\n\n첫 문단\n이어지는 문장\n\n두 번째 **강조**\n\n- 하나\n- 둘\n\n1. 첫째\n2. 둘째');
  assert.match(result, /<h2>제목<\/h2>/);
  assert.match(result, /<p>첫 문단 이어지는 문장<\/p>/);
  assert.match(result, /<strong>강조<\/strong>/);
  assert.match(result, /<ul>[\s\S]*<li>둘<\/li>[\s\S]*<\/ul>/);
  assert.match(result, /<ol>[\s\S]*<li>둘째<\/li>[\s\S]*<\/ol>/);
});

test('unsafe URL schemes, controls, credential URLs and traversal are rejected', () => {
  for (const url of ['javascript:alert', 'data:text/html,test', 'http://example.com', '//example.com', '../secret.html', 'https://user:pass@example.com', 'https://example.com/%0aevil', 'https://example.com\\evil', 'assets/images/../secret.png']) assert.throws(() => safeUrl(url));
  assert.throws(() => renderMarkdown('[클릭](javascript:evil)'));
});

test('HTTPS links and local article links are escaped and resolved correctly', () => {
  assert.equal(safeUrl('https://example.com/?a=1&b=2'), 'https://example.com/?a=1&b=2');
  const result = renderMarkdown('[외부](https://example.com/?a=1&b=2) [일지](journal/2026-08-12-gamejam-retrospective.html)');
  assert.ok(result.includes('a=1&amp;b=2'));
  assert.ok(result.includes('rel="noopener noreferrer"'));
  assert.ok(result.includes('href="../journal/2026-08-12-gamejam-retrospective.html"'));
});

test('images must be local raster images with alternative text', () => {
  const result = renderMarkdown('![플레이 화면](assets/images/game.webp)');
  assert.ok(result.includes('src="../assets/images/game.webp" alt="플레이 화면"'));
  assert.ok(result.includes('loading="lazy"'));
  for (const url of ['https://example.com/image.png', 'assets/images/game.svg', 'assets/images/../../private.png', 'data:image/png;base64,AA']) assert.throws(() => safeUrl(url, { image: true }));
});

test('date validation rejects impossible dates and mismatched filenames', () => {
  for (const date of ['2026-02-30', '2026-13-01', 'not-a-date']) assert.throws(() => parsePost(post(date, '제목'), '2026-02-30-test.md'));
  assert.throws(() => parsePost(post('2026-08-12', '제목'), '2026-08-13-test.md'));
});

test('unknown metadata, duplicate fields, empty content and invalid slug fail clearly', () => {
  assert.throws(() => parsePost(post('2026-08-12', '제목', 'layout: evil\n'), '2026-08-12-test.md'));
  assert.throws(() => parsePost(post('2026-08-12', '제목', 'title: 중복\n'), '2026-08-12-test.md'));
  assert.throws(() => parsePost('---\ntitle: 제목\ndate: 2026-08-12\n---\n', '2026-08-12-test.md'));
  assert.throws(() => parsePost(originalPost, '../2026-08-12-evil.md'));
});

test('current article preserves Korean text and all six sections', () => {
  const parsed = parsePost(originalPost, '2026-08-12-gamejam-retrospective.md');
  assert.equal(parsed.list_title, '게임잼 참여 후기');
  assert.equal((parsed.html.match(/<h2>/g) || []).length, 6);
  assert.ok(parsed.html.includes('기획 1명과 프로그래머 3명'));
});

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

test('deployment output excludes preview, original Markdown and management files', () => {
  const result = compileSite(root);
  for (const name of result.publicFiles.keys()) {
    assert.ok(!/^(?:src|content|docs|tests|scripts)\//.test(name));
    assert.ok(!/preview|AGENTS|README|\.md$/.test(name));
  }
  assert.ok(result.publicFiles.has('.nojekyll'));
});

test('missing local links, duplicate IDs, inline handlers and external scripts fail', () => {
  const result = compileSite(root);
  for (const injection of ['<a href="missing.html">링크</a>', '<div id="intro"></div>', '<a onclick="alert(1)">클릭</a>', '<script src="https://example.com/evil.js"></script>']) {
    const changed = new Map(result.files);
    changed.set('index.html', changed.get('index.html').replace('</main>', injection + '</main>'));
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

test('key-like content is blocked without echoing the value', t => {
  const dir = fixture(t);
  const fake = 'gh' + 'p_' + 'X'.repeat(36);
  fs.writeFileSync(path.join(dir, 'content/journal/2026-09-15-new.md'), post('2026-09-15', '테스트') + fake);
  assert.throws(() => compileSite(dir), error => error.message.includes('비밀키') && !error.message.includes(fake));
});

test('CSP denies inline execution and network requests, with preview-only frames', () => {
  assert.ok(securityMeta().includes("script-src 'self'"));
  assert.ok(securityMeta().includes("connect-src 'none'"));
  assert.ok(securityMeta().includes("frame-src 'none'"));
  assert.ok(securityMeta(true).includes("frame-src 'self'"));
  assert.ok(!securityMeta().includes('unsafe-inline'));
});

test('same source produces byte-identical output', () => {
  const a = compileSite(root), b = compileSite(root);
  assert.deepEqual([...a.files.keys()], [...b.files.keys()]);
  for (const [key, value] of a.files) assert.ok(Buffer.from(value).equals(Buffer.from(b.files.get(key))));
});

function paginationFixture({ count = 11, storage = new Map(), pathname = '/index.html', blocked = false } = {}) {
  const cards = Array.from({ length: count }, () => ({ hidden: false }));
  const buttons = [];
  const pagination = { hidden: true, append: b => buttons.push(b), querySelectorAll: () => buttons };
  const document = {
    querySelector: name => name === '.journal-list' ? { querySelectorAll: () => cards } : pagination,
    createElement: () => ({ dataset: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; }, addEventListener(_, callback) { this.click = callback; } })
  };
  const window = { location: { pathname }, sessionStorage: {
    getItem(key) { if (blocked) throw new Error('Storage blocked'); return storage.get(key) ?? null; },
    setItem(key, value) { if (blocked) throw new Error('Storage blocked'); storage.set(key, value); }
  } };
  assert.equal(cards.filter(c => !c.hidden).length, count);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/scripts/journal.js'), 'utf8'), { document, window });
  return { cards, buttons, pagination };
}

test('pagination shows correct cards on page 2 and remains usable without JS', () => {
  const { cards, buttons } = paginationFixture();
  assert.equal(buttons.length, 3);
  buttons[1].click();
  assert.deepEqual(cards.map(c => c.hidden), [true, true, true, true, true, false, false, false, false, false, true]);
  assert.equal(buttons[1].attrs['aria-current'], 'page');
  assert.equal(buttons[0].attrs['aria-current'], undefined);
});

test('pagination restores the selected page on return and isolates other site paths', () => {
  const storage = new Map();
  paginationFixture({ storage, pathname: '/' }).buttons[1].click();
  const restored = paginationFixture({ storage });
  assert.equal(restored.buttons[1].attrs['aria-current'], 'page');
  assert.equal(restored.cards[5].hidden, false);
  assert.equal(restored.cards[0].hidden, true);
  const otherSite = paginationFixture({ storage, pathname: '/other/index.html' });
  assert.equal(otherSite.buttons[0].attrs['aria-current'], 'page');
});

test('pagination clamps removed pages and handles invalid or unavailable storage', () => {
  const key = 'minari:journal-page:/';
  const storage = new Map([[key, '3']]);
  const reduced = paginationFixture({ storage, count: 6 });
  assert.equal(reduced.buttons[1].attrs['aria-current'], 'page');
  for (const value of ['garbage', '-1', '0', '1.5', 'Infinity']) {
    const result = paginationFixture({ storage: new Map([[key, value]]) });
    assert.equal(result.buttons[0].attrs['aria-current'], 'page');
  }
  const blocked = paginationFixture({ blocked: true });
  blocked.buttons[1].click();
  assert.equal(blocked.cards[5].hidden, false);
});

const imageBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3i8AAAAASUVORK5CYII=', 'base64');

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
  fs.cpSync(path.join(root, 'scripts'), path.join(dir, 'scripts'), { recursive: true });
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

test('unknown output files stop build and check without deleting files or overwriting pages', t => {
  for (const name of ['journal/2020-01-01-old.html', 'assets/css/manual.css', 'dist/private.txt']) {
    const dir = fixture(t);
    fs.cpSync(path.join(root, 'scripts'), path.join(dir, 'scripts'), { recursive: true });
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
  fs.cpSync(path.join(root, 'scripts'), path.join(dir, 'scripts'), { recursive: true });
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
  fs.cpSync(path.join(root, 'scripts'), path.join(dir, 'scripts'), { recursive: true });
  const target = path.join(dir, 'src/styles/home.css');
  const before = fs.readFileSync(target);
  fs.writeFileSync(path.join(dir, '.generated-files.json'), JSON.stringify(['assets/css/../../src/styles/home.css']));
  assert.throws(() => execFileSync(process.execPath, [path.join(dir, 'scripts/build.mjs')], { stdio: 'pipe' }));
  assert.ok(fs.readFileSync(target).equals(before));
});
