// Deliberately small Markdown subset: headings, paragraphs, lists, bold, links and local images.
// Raw HTML is always text. No plugin execution, imports, includes or template evaluation.
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function safeUrl(value, { image = false, prefix = '../' } = {}) {
  if (typeof value !== 'string' || /[\s<>"'\\\u0000-\u001f\u007f]/u.test(value)) throw new Error('주소에 허용되지 않는 문자가 있습니다.');
  let decoded;
  try { decoded = decodeURIComponent(value); } catch { throw new Error('주소의 인코딩이 올바르지 않습니다.'); }
  if (/[\u0000-\u001f\u007f]/u.test(decoded)) throw new Error('주소에 제어 문자를 사용할 수 없습니다.');
  if (image) {
    if (!/^assets\/images\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:png|jpe?g|webp|gif|avif)$/.test(value)) throw new Error('이미지는 assets/images/ 안의 PNG·JPG·WebP·GIF·AVIF 파일을 사용하세요.');
    return prefix + value;
  }
  if (value.startsWith('https://')) {
    const url = new URL(value);
    if (url.username || url.password || !url.hostname) throw new Error('계정정보가 포함된 주소를 사용할 수 없습니다.');
    return value;
  }
  if (/^(?:index\.html|journal\/[a-z0-9-]+\.html)(?:#[a-z][a-z0-9-]*)?$/.test(value)) return prefix + value;
  throw new Error('링크는 HTTPS 주소 또는 사이트 내부 HTML 경로만 사용할 수 있습니다.');
}

function inline(text) {
  const token = /\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\(([^()\s]+)\)/g;
  let out = '', start = 0;
  for (const match of text.matchAll(token)) {
    out += escapeHtml(text.slice(start, match.index));
    if (match[1] !== undefined) out += `<strong>${escapeHtml(match[1])}</strong>`;
    else {
      const href = safeUrl(match[3]);
      const external = href.startsWith('https://');
      out += `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(match[2])}</a>`;
    }
    start = match.index + match[0].length;
  }
  return out + escapeHtml(text.slice(start));
}

export function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const output = [];
  let paragraph = [], items = [], listType = null;
  const flushParagraph = () => { if (paragraph.length) output.push(`<p>${inline(paragraph.join(' '))}</p>`); paragraph = []; };
  const flushList = () => { if (items.length) output.push(`<${listType}>\n${items.map(x => `<li>${inline(x)}</li>`).join('\n')}\n</${listType}>`); items = []; listType = null; };
  for (const line of lines) {
    const text = line.trim();
    if (!text) { flushParagraph(); flushList(); continue; }
    const heading = /^(#{2,3})\s+(.+)$/.exec(text);
    const picture = /^!\[([^\]]+)\]\(([^()\s]+)\)$/.exec(text);
    const item = /^(?:(-) |\d+\. )(.+)$/.exec(text);
    if (heading) { flushParagraph(); flushList(); output.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); }
    else if (picture) {
      flushParagraph(); flushList();
      output.push(`<figure><img src="${escapeHtml(safeUrl(picture[2], { image: true }))}" alt="${escapeHtml(picture[1])}" loading="lazy" decoding="async"><figcaption>${escapeHtml(picture[1])}</figcaption></figure>`);
    } else if (item) {
      flushParagraph(); const type = item[1] ? 'ul' : 'ol';
      if (listType && listType !== type) flushList();
      listType = type; items.push(item[2]);
    } else { flushList(); paragraph.push(text); }
  }
  flushParagraph(); flushList();
  return output.join('\n');
}

export function parsePost(text, filename) {
  if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(filename)) throw new Error(`일지 파일명 형식 오류: ${filename}`);
  if (text.length > 300_000) throw new Error(`원고가 너무 큽니다: ${filename}`);
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n'));
  if (!match) throw new Error(`원고 맨 위에 제목·날짜 정보를 작성하세요: ${filename}`);
  const meta = {};
  for (const line of match[1].split('\n')) {
    const field = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (!field || !['title', 'list_title', 'date', 'summary', 'draft'].includes(field[1])) throw new Error(`지원하지 않는 원고 정보: ${filename}`);
    if (Object.hasOwn(meta, field[1])) throw new Error(`중복된 원고 정보: ${field[1]}`);
    meta[field[1]] = field[2].trim();
  }
  if (!meta.title || meta.title.length > 160) throw new Error(`제목은 1~160자로 작성하세요: ${filename}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date || '')) throw new Error(`날짜 형식 오류: ${filename}`);
  const date = new Date(`${meta.date}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== meta.date || !filename.startsWith(meta.date + '-')) throw new Error(`날짜와 파일명을 확인하세요: ${filename}`);
  if (meta.draft && !['true', 'false'].includes(meta.draft)) throw new Error('draft는 true 또는 false만 가능합니다.');
  if (!match[2].trim()) throw new Error(`본문이 비어 있습니다: ${filename}`);
  const slug = filename.slice(0, -3);
  return { ...meta, slug, list_title: meta.list_title || meta.title, summary: meta.summary || meta.title, draft: meta.draft === 'true', html: renderMarkdown(match[2]), display_date: meta.date.replaceAll('-', '. ') };
}

export function fillTemplate(template, values) {
  return template.replace(/\{\{([a-z_]+)\}\}/g, (_, key) => {
    if (!Object.hasOwn(values, key)) throw new Error(`템플릿 값이 없습니다: ${key}`);
    return values[key];
  });
}
