import { escapeHtml, fillTemplate } from './content.mjs';

// Renders the "출시 앱" section only when site-config.mjs provides a release entry.
// With `release = null` the home page contains no trace of the section.
export function releaseSection(template, release) {
  if (!release) return '';
  for (const key of ['title', 'status', 'image']) {
    if (typeof release[key] !== 'string' || !release[key].trim()) throw new Error(`출시 앱 정보에 ${key} 값이 필요합니다.`);
  }
  if (!/^assets\/images\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:png|jpe?g|webp|gif|avif)$/.test(release.image)) throw new Error('출시 앱 이미지는 assets/images/ 아래 로컬 파일이어야 합니다.');
  const [imageWidth, imageHeight] = [release.imageWidth ?? 960, release.imageHeight ?? 540];
  if (![imageWidth, imageHeight].every(n => Number.isInteger(n) && n > 0)) throw new Error('출시 앱 이미지 크기는 양의 정수여야 합니다.');
  const meta = (release.meta ?? []).map(part => `<span>${escapeHtml(part)}</span>`).join('<span class="meta-sep" aria-hidden="true">/</span>');
  const links = (release.links ?? []).map(({ label, url }, index) => {
    if (!/^https:\/\//.test(url ?? '')) throw new Error(`출시 앱 링크는 https 주소여야 합니다: ${label}`);
    const kind = index === 0 ? 'action action-primary' : 'action';
    return `          <a class="${kind}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
  }).join('\n');
  const actions = links ? `        <div class="project-actions">\n${links}\n        </div>\n` : '';
  return fillTemplate(template, {
    image: release.image,
    image_width: String(imageWidth),
    image_height: String(imageHeight),
    image_class: release.imageStyle === 'icon' ? ' release-icon' : ' project-image',
    status: escapeHtml(release.status),
    title: escapeHtml(release.title),
    meta,
    actions,
  });
}
