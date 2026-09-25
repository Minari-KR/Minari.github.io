import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml, safeUrl, parsePost, renderMarkdown } from '../scripts/content.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const originalPost = fs.readFileSync(path.join(root, 'content/journal/2026-08-12-gamejam-retrospective.md'), 'utf8');
const post = (date, title, extra = '') => `---\ntitle: ${title}\ndate: ${date}\n${extra}---\n\n## 경험\n\n본문입니다.\n`;

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
