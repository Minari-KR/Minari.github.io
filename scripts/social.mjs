import { escapeHtml } from './content.mjs';

export const siteUrl = 'https://minari-kr.github.io/Minari.github.io/';
export const shareImage = 'assets/images/minari-share.png';

// Only the site's own published pages and raster images can be sharing targets.
export function socialTarget(url) {
  if (!url.startsWith(siteUrl)) throw new Error('공유 주소는 공개 사이트의 HTTPS 주소여야 합니다.');
  const relative = url.slice(siteUrl.length);
  if (!/^(?:|journal\/[a-z0-9-]+\.html|assets\/images\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:png|jpe?g|webp|gif|avif))$/.test(relative)) throw new Error('허용되지 않는 공유 주소입니다.');
  return relative || 'index.html';
}

export function socialMeta({ title, description, page = '', article = false }) {
  const image = siteUrl + shareImage;
  const alt = 'Minari 박종찬 · 게임 시스템 기획 포트폴리오. 아이디어를 프로토타입으로 만들고, 플레이하며 재미를 검증합니다.';
  const properties = {
    'og:type': article ? 'article' : 'website',
    'og:locale': 'ko_KR',
    'og:site_name': 'Minari 포트폴리오',
    'og:title': title,
    'og:description': description,
    'og:url': siteUrl + page,
    'og:image': image,
    'og:image:type': 'image/png',
    'og:image:width': '1200',
    'og:image:height': '630',
    'og:image:alt': alt,
  };
  const names = {
    'twitter:card': 'summary_large_image',
    'twitter:title': title,
    'twitter:description': description,
    'twitter:image': image,
    'twitter:image:alt': alt,
  };
  return [
    ...Object.entries(properties).map(([key, value]) => `<meta property="${key}" content="${escapeHtml(value)}">`),
    ...Object.entries(names).map(([key, value]) => `<meta name="${key}" content="${escapeHtml(value)}">`),
  ].join('\n  ');
}
