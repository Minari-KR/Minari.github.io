import { escapeHtml } from './content.mjs';

const shells = new Set(['gray', 'yellow', 'purple', 'black']);
const fields = ['platform', 'genre', 'hours', 'achievements', 'note'];

// Renders the home page's game packs ("게임 플레이 경험") from site-config.mjs `games`, dealt into two rows inside the game screen.
// Each pack is a cartridge shell image (assets/images/packs) with the game's picture, or its name, showing through the label window.
// Every value is escaped; the record view reads the data-* attributes in games.js.
export function gamePacks(games) {
  if (!Array.isArray(games) || !games.length) throw new Error('게임팩 목록(games)이 비어 있습니다.');
  const rows = [[], []];
  games.forEach((game, index) => {
    if (typeof game.title !== 'string' || !game.title.trim()) throw new Error(`게임팩 ${index + 1}번에 title 값이 필요합니다.`);
    if (!shells.has(game.shell)) throw new Error(`게임팩 색은 gray, yellow, purple, black 중 하나여야 합니다: ${game.title}`);
    for (const key of fields) {
      if (game[key] !== undefined && typeof game[key] !== 'string') throw new Error(`게임팩 ${key} 값은 문자열이어야 합니다: ${game.title}`);
    }
    if (game.image !== undefined && (typeof game.image !== 'string' || !/^assets\/images\/games\/[a-z0-9_-]+\.(?:png|jpe?g|webp|gif|avif)$/.test(game.image))) throw new Error(`게임 그림은 assets/images/games/ 아래 이미지 파일이어야 합니다: ${game.title}`);
    const title = escapeHtml(game.title);
    const data = fields.map(key => ` data-${key}="${escapeHtml(game[key] ?? '')}"`).join('');
    const art = game.image
      ? `<img class="pack-img" src="./${game.image}" width="600" height="600" alt="" loading="lazy" decoding="async">`
      : `<span class="pack-name">${title}</span>`;
    rows[index % rows.length].push(`              <button class="pack" type="button" data-title="${title}"${data} aria-label="${title} 기록 보기"><span class="pack-art">${art}</span><img class="pack-shell is-${game.shell}" src="./assets/images/packs/shell-${game.shell}.webp" width="440" height="540" alt="" loading="lazy" decoding="async"></button>`);
  });
  return rows.filter(row => row.length)
    .map(row => `          <div class="pack-row">\n            <div class="pack-track">\n${row.join('\n')}\n            </div>\n          </div>`)
    .join('\n');
}
