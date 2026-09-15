import fs from 'node:fs';
import path from 'node:path';
import { escapeHtml, parsePost, fillTemplate } from './content.mjs';
import { walk } from './files.mjs';
import { addReferencedMedia } from './media.mjs';
import { checkSecrets, securityMeta, validateFiles } from './validation.mjs';

export { walk } from './files.mjs';
export { securityMeta, validateFiles } from './validation.mjs';

export function compileSite(root) {
  for (const folder of ['content', 'src']) {
    for (const file of walk(path.join(root, folder))) checkSecrets(fs.readFileSync(file, 'utf8'), path.relative(root, file));
  }
  const template = name => fs.readFileSync(path.join(root, 'src/templates', name), 'utf8');
  const allPosts = walk(path.join(root, 'content/journal')).filter(file => file.endsWith('.md')).map(file => parsePost(fs.readFileSync(file, 'utf8'), path.basename(file)));
  if (new Set(allPosts.map(post => post.slug)).size !== allPosts.length) throw new Error('중복된 일지 주소가 있습니다.');
  const posts = allPosts.filter(post => !post.draft).sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  const files = new Map();
  const cards = posts.map(post => `        <article class="journal-card">\n          <div>\n            <span class="activity-tag">${escapeHtml(post.display_date)}</span>\n            <h3>${escapeHtml(post.list_title)}</h3>\n          </div>\n          <a class="activity-link" href="./journal/${post.slug}.html">일지 보기</a>\n        </article>`).join('\n');
  files.set('index.html', fillTemplate(template('home.html'), { security: securityMeta(), journal_cards: cards || '<p class="journal-empty">아직 등록된 일지가 없습니다.</p>' }));
  for (const post of posts) {
    files.set(`journal/${post.slug}.html`, fillTemplate(template('journal.html'), {
      security: securityMeta(), title: escapeHtml(post.title), summary: escapeHtml(post.summary), date: post.date,
      display_date: post.display_date, body: post.html
    }));
  }
  const options = posts.map(post => `          <option value="./journal/${post.slug}.html">${escapeHtml(post.list_title)}</option>`).join('\n');
  files.set('mobile-preview.html', fillTemplate(template('mobile-preview.html'), { security: securityMeta(true), journal_options: options }));
  for (const [folder, ext, destination] of [['styles', '.css', 'css'], ['scripts', '.js', 'js']]) {
    for (const file of walk(path.join(root, 'src', folder))) {
      if (!file.endsWith(ext)) throw new Error(`지원하지 않는 소스 파일: ${file}`);
      files.set(`assets/${destination}/${path.relative(path.join(root, 'src', folder), file).replaceAll('\\', '/')}`, fs.readFileSync(file));
    }
  }
  addReferencedMedia(root, files);
  files.set('.nojekyll', '');
  const publicFiles = new Map([...files].filter(([name]) => !['mobile-preview.html', 'assets/css/preview.css', 'assets/js/preview.js'].includes(name)));
  validateFiles(files);
  validateFiles(publicFiles);
  return { files, publicFiles, posts };
}
