import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { escapeHtml, parsePost, fillTemplate } from './content.mjs';

export function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  if (fs.lstatSync(directory).isSymbolicLink()) throw new Error('심볼릭 링크 폴더는 사용할 수 없습니다.');
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`심볼릭 링크는 배포할 수 없습니다: ${entry.name}`);
    return entry.isDirectory() ? walk(file) : [file];
  }).sort();
}

export function securityMeta(preview = false) {
  const policy = "default-src 'none'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src " + (preview ? "'self'" : "'none'");
  return `<meta http-equiv="Content-Security-Policy" content="${policy}">\n  <meta name="referrer" content="no-referrer">` + (preview ? '\n  <meta name="robots" content="noindex, nofollow">' : '');
}

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
  // Only images referenced by published pages belong in either generated output.
  const referencedImages = new Set();
  for (const [name, value] of files) {
    if (!name.endsWith('.html') || name === 'mobile-preview.html') continue;
    const html = value.toString().replace(/<!--[\s\S]*?-->/g, '');
    for (const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(name), match[1].split('#')[0]));
      if (target.startsWith('assets/images/')) referencedImages.add(target);
    }
  }
  for (const file of walk(path.join(root, 'public/assets/images'))) {
    const name = 'assets/images/' + path.relative(path.join(root, 'public/assets/images'), file).replaceAll('\\', '/');
    if (!/^assets\/images\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(png|jpe?g|webp|gif|avif)$/.test(name)) throw new Error(`이미지 파일명 또는 확장자를 확인하세요: ${name}`);
    const bytes = fs.readFileSync(file);
    const ext = path.extname(name).toLowerCase();
    const signatures = {
      '.png': bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
      '.jpg': bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
      '.jpeg': bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
      '.gif': /^GIF8[79]a/.test(bytes.toString('ascii', 0, 6)),
      '.webp': bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP',
      '.avif': bytes.toString('ascii', 4, 8) === 'ftyp' && /avif|avis/.test(bytes.toString('ascii', 8, 32))
    };
    if (!signatures[ext]) throw new Error(`이미지 내용과 확장자가 다릅니다: ${name}`);
    if (bytes.length > 5 * 1024 * 1024) throw new Error(`이미지는 5MB 이하로 줄여주세요: ${name}`);
    if (referencedImages.has(name)) files.set(name, bytes);
  }
  files.set('.nojekyll', '');
  const publicFiles = new Map([...files].filter(([name]) => !['mobile-preview.html', 'assets/css/preview.css', 'assets/js/preview.js'].includes(name)));
  validateFiles(files);
  validateFiles(publicFiles);
  return { files, publicFiles, posts };
}

function checkSecrets(text, name) {
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{30,}\b|\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/.test(text)) throw new Error(`비밀키로 의심되는 내용이 있습니다: ${name}`);
}

export function validateFiles(files) {
  const ids = new Map();
  for (const [name, value] of files) {
    if (!name.endsWith('.html')) continue;
    const html = value.toString().replace(/<!--[\s\S]*?-->/g, '');
    const pageIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    if (new Set(pageIds).size !== pageIds.length) throw new Error(`중복 ID: ${name}`);
    ids.set(name, new Set(pageIds));
  }
  for (const [name, value] of files) {
    if (!/\.(html|css|js)$/.test(name)) continue;
    const text = value.toString();
    // High-confidence patterns only; never print matched secrets in an error.
    checkSecrets(text, name);
    if (name.endsWith('.js')) {
      new vm.Script(text, { filename: name });
      if (/\b(?:eval|Function)\s*\(|\.innerHTML\s*=|\.outerHTML\s*=|document\.write\s*\(|insertAdjacentHTML\s*\(/.test(text)) throw new Error(`위험한 스크립트 삽입 방식: ${name}`);
    }
    if (name.endsWith('.css')) {
      const clean = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"[^"\n]*"|'[^'\n]*'/g, '');
      if ((clean.match(/{/g) || []).length !== (clean.match(/}/g) || []).length) throw new Error(`CSS 괄호 오류: ${name}`);
      if (/@import\b|url\s*\(|expression\s*\(/i.test(text)) throw new Error(`CSS 외부 리소스는 별도 검토가 필요합니다: ${name}`);
    }
    if (!name.endsWith('.html')) continue;
    const html = text.replace(/<!--[\s\S]*?-->/g, '');
    if ((html.match(/<h1\b/g) || []).length !== 1 || !/<(?:main)\b/.test(html)) throw new Error(`본문 또는 대표 제목을 확인하세요: ${name}`);
    if (/<style\b|\sstyle\s*=|\son[a-z]+\s*=|<base\b|<form\b|<object\b|<embed\b|<svg\b/i.test(html)) throw new Error(`허용되지 않는 HTML 또는 인라인 코드: ${name}`);
    for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (!/\bsrc="(?:\.\/)?assets\/js\/[a-z-]+\.js"/.test(m[1]) || m[2].trim()) throw new Error(`스크립트는 검토된 로컬 파일만 허용합니다: ${name}`);
    }
    if (!html.includes(securityMeta(name === 'mobile-preview.html'))) throw new Error(`보안 정책이 누락되었거나 변경됐습니다: ${name}`);
    if (html.indexOf('Content-Security-Policy') > html.indexOf('<link')) throw new Error(`보안 정책은 리소스보다 먼저 선언해야 합니다: ${name}`);
    for (const m of html.matchAll(/<(a|link|script|img|iframe|option)\b([^>]*)>/gi)) {
      const attrs = m[2];
      const ref = /\b(?:href|src|value)="([^"]*)"/.exec(attrs)?.[1]?.replaceAll('&amp;', '&');
      if (!ref) continue;
      if (/[\u0000-\u0020\u007f\\]/.test(ref)) throw new Error(`잘못된 주소: ${name}`);
      if (/^https:\/\//.test(ref)) {
        const url = new URL(ref);
        if (url.username || url.password) throw new Error(`주소에 계정정보를 포함할 수 없습니다: ${name}`);
        if (m[1] !== 'a' && !(m[1] === 'link' && ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname))) throw new Error(`승인되지 않은 외부 리소스: ${name}`);
        if (m[1] === 'a' && /target="_blank"/.test(attrs) && !/rel="noopener noreferrer"/.test(attrs)) throw new Error(`새 탭 보호 속성 누락: ${name}`);
      } else if (/^mailto:[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(ref) && m[1] === 'a') {
        // Public contact address; query strings and injected headers are not supported.
      } else {
        if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(ref) || /[<>"'%]/.test(ref)) throw new Error(`허용되지 않는 주소: ${name}`);
        const [relative, fragment] = ref.split('#');
        const target = relative ? path.posix.normalize(path.posix.join(path.posix.dirname(name), relative)) : name;
        if (!files.has(target)) throw new Error(`연결 대상이 없습니다: ${name} → ${target}`);
        if (fragment && !ids.get(target)?.has(fragment)) throw new Error(`연결된 위치가 없습니다: ${name} → ${target}#${fragment}`);
      }
    }
  }
}
