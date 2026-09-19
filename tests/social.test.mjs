import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { compileSite, validateFiles } from '../scripts/site.mjs';
import { readHtmlTags } from '../scripts/html.mjs';
import { socialMeta, siteUrl, shareImage } from '../scripts/social.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('home and journal share their own URLs and titles with a published 1200x630 PNG', () => {
  const { publicFiles, files, posts } = compileSite(root);
  const image = publicFiles.get(shareImage);
  assert.equal(image.readUInt32BE(16), 1200);
  assert.equal(image.readUInt32BE(20), 630);
  for (const [name, html] of publicFiles) {
    if (!name.endsWith('.html')) continue;
    const meta = Object.fromEntries(readHtmlTags(html.toString()).filter(tag => tag.tag === 'meta')
      .map(({ attributes: a }) => [a.property ?? a.name, a.content]));
    assert.equal(meta['og:url'], siteUrl + (name === 'index.html' ? '' : name));
    assert.equal(meta['og:image'], siteUrl + shareImage);
    assert.equal(meta['twitter:image'], meta['og:image']);
    assert.equal(meta['twitter:title'], meta['og:title']);
    assert.equal(meta['og:type'], name === 'index.html' ? 'website' : 'article');
    if (name !== 'index.html') {
      const post = posts.find(post => name === `journal/${post.slug}.html`);
      assert.equal(meta['og:title'], `${post.title} | Minari`);
      assert.equal(meta['og:description'], post.summary);
    }
  }
  assert.doesNotMatch(files.get('mobile-preview.html'), /og:image/);
});

test('sharing metadata rejects missing images, outside URLs and mismatched page URLs', () => {
  const { publicFiles } = compileSite(root);
  const missing = new Map(publicFiles);
  missing.delete(shareImage);
  assert.throws(() => validateFiles(missing), /공유 연결 대상/);
  for (const target of ['https://example.com/photo.png', siteUrl + '../secret.png', siteUrl + shareImage + '?x=1', siteUrl + 'index.html']) {
    const changed = new Map(publicFiles);
    changed.set('index.html', publicFiles.get('index.html').replaceAll(siteUrl + shareImage, target));
    assert.throws(() => validateFiles(changed));
  }
  const wrongPage = new Map(publicFiles);
  wrongPage.set('index.html', publicFiles.get('index.html').replace(`property="og:url" content="${siteUrl}"`, `property="og:url" content="${siteUrl}${shareImage}"`));
  assert.throws(() => validateFiles(wrongPage), /공유 대상/);
});

test('quotes and HTML in journal metadata remain attribute text', () => {
  const title = '제목 " & <script>test</script>';
  const result = socialMeta({ title, description: title });
  assert.doesNotMatch(result, /<script>/);
  const tags = readHtmlTags(result);
  assert.ok(tags.every(({ tag }) => tag === 'meta'));
  assert.equal(tags.find(({ attributes }) => attributes.property === 'og:title').attributes.content, title);
});
