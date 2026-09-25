import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { compileSite, validateFiles, securityMeta } from '../scripts/site.mjs';
import { root, post, fixture } from './fixture.mjs';

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

test('phone links permit numbers and reject service codes, parameters and non-link resources', () => {
  const result = compileSite(root);
  const valid = new Map(result.files);
  valid.set('index.html', valid.get('index.html').replace('</main>', '<a href="tel:+12025550123">전화</a></main>'));
  assert.doesNotThrow(() => validateFiles(valid));
  for (const injection of ['<a href="tel:*123#">전화</a>', '<a href="tel:+12025550123;ext=1">전화</a>', '<a href="tel:+12025550123?body=test">전화</a>', '<img src="tel:+12025550123">']) {
    const changed = new Map(result.files);
    changed.set('index.html', changed.get('index.html').replace('</main>', injection + '</main>'));
    assert.throws(() => validateFiles(changed), /허용되지 않는 주소/);
  }
});

test('published pages omit phone contact while preserving the email link', () => {
  const { publicFiles } = compileSite(root);
  assert.ok(publicFiles.get('index.html').includes('href="mailto:bkpark0226@naver.com">bkpark0226@naver.com</a>'));
  for (const [name, value] of publicFiles) {
    if (name.endsWith('.html')) assert.doesNotMatch(value.toString(), /href=["']tel:|contact-phone|010-9892-6002|821098926002/);
  }
});

test('resource validation handles alternate quotes, case, entities and duplicate attributes', () => {
  const { files } = compileSite(root);
  const withMarkup = markup => new Map(files).set('index.html', files.get('index.html').replace('</main>', markup + '</main>'));
  for (const markup of [
    "<a href='missing.html'>link</a>", '<A HREF=missing.html>link</A>',
    "<img SRC='https://example.com/picture.png'>", "<div ID='intro'></div>",
    "<a HREF='java&#115;cript:evil'>link</a>",
    "<a href='https://example.com' TARGET='_blank'>link</a>",
    "<a href='#intro' HREF='missing.html'>link</a>",
    "<script data-src='assets/js/journal.js'></script>",
    "<img srcset='https://example.com/picture.png 2x'>"
  ]) assert.throws(() => validateFiles(withMarkup(markup)), markup);
  assert.doesNotThrow(() => validateFiles(withMarkup("<div ID='quoted' data-id='intro'></div><A HREF='#quoted'>link</A><a href='https://example.com?a=1&amp;b=2' target='_blank' rel='noreferrer noopener'>external</a>")));
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
  assert.ok(securityMeta().includes("media-src 'self'"));
  assert.ok(securityMeta().includes("frame-src 'none'"));
  assert.ok(securityMeta(true).includes("frame-src 'self'"));
  assert.ok(!securityMeta().includes('unsafe-inline'));
});
