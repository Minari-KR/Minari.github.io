import path from 'node:path';
import vm from 'node:vm';
import { readHtmlTags, resourceReferences } from './html.mjs';

export function securityMeta(preview = false) {
  const policy = "default-src 'none'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self'; media-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src " + (preview ? "'self'" : "'none'");
  return `<meta http-equiv="Content-Security-Policy" content="${policy}">\n  <meta name="referrer" content="no-referrer">` + (preview ? '\n  <meta name="robots" content="noindex, nofollow">' : '');
}

export function checkSecrets(text, name) {
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{30,}\b|\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/.test(text)) throw new Error(`비밀키로 의심되는 내용이 있습니다: ${name}`);
}

export function validateFiles(files) {
  const ids = new Map();
  const pages = new Map();
  for (const [name, value] of files) {
    if (!name.endsWith('.html')) continue;
    const html = value.toString().replace(/<!--[\s\S]*?-->/g, '');
    const tags = readHtmlTags(html);
    pages.set(name, tags);
    const pageIds = tags.filter(({ attributes }) => Object.hasOwn(attributes, 'id')).map(({ attributes }) => attributes.id);
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
    const tags = pages.get(name);
    if (tags.filter(({ tag }) => tag === 'h1').length !== 1 || !tags.some(({ tag }) => tag === 'main')) throw new Error(`본문 또는 대표 제목을 확인하세요: ${name}`);
    if (/<style\b|\sstyle\s*=|\son[a-z]+\s*=|<base\b|<form\b|<object\b|<embed\b|<svg\b/i.test(html)) throw new Error(`허용되지 않는 HTML 또는 인라인 코드: ${name}`);
    for (const { tag, attributes } of tags) {
      if (Object.hasOwn(attributes, 'srcset')) throw new Error(`srcset 리소스는 별도 검토가 필요합니다: ${name}`);
      if (tag === 'script' && !/^(?:\.\/)?assets\/js\/[a-z-]+\.js$/.test(attributes.src ?? '')) throw new Error(`스크립트는 검토된 로컬 파일만 허용합니다: ${name}`);
    }
    for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (m[2].trim()) throw new Error(`스크립트는 검토된 로컬 파일만 허용합니다: ${name}`);
    }
    if (!html.includes(securityMeta(name === 'mobile-preview.html'))) throw new Error(`보안 정책이 누락되었거나 변경됐습니다: ${name}`);
    if (html.indexOf('Content-Security-Policy') > html.indexOf('<link')) throw new Error(`보안 정책은 리소스보다 먼저 선언해야 합니다: ${name}`);
    for (const { tag, attributes, ref } of resourceReferences(pages.get(name))) {
      if (!ref) continue;
      if (/[\u0000-\u0020\u007f\\]/.test(ref)) throw new Error(`잘못된 주소: ${name}`);
      if (/^https:\/\//.test(ref)) {
        const url = new URL(ref);
        if (url.username || url.password) throw new Error(`주소에 계정정보를 포함할 수 없습니다: ${name}`);
        if (tag !== 'a' && !(tag === 'link' && ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname))) throw new Error(`승인되지 않은 외부 리소스: ${name}`);
        if (tag === 'a' && attributes.target === '_blank' && !['noopener', 'noreferrer'].every(token => (attributes.rel ?? '').split(/\s+/).includes(token))) throw new Error(`새 탭 보호 속성 누락: ${name}`);
      } else if (/^mailto:[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(ref) && tag === 'a') {
        // Public contact address; query strings and injected headers are not supported.
      } else if (/^tel:\+?[0-9]{7,15}$/.test(ref) && tag === 'a') {
        // Phone links contain only a number; service codes and parameters are not allowed.
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
