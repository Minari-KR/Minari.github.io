import fs from 'node:fs';
import path from 'node:path';
import { escapeHtml, fillTemplate } from './content.mjs';
import { walk } from './files.mjs';
import { addReferencedMedia } from './media.mjs';
import { versionAssets } from './assets.mjs';
import { checkSecrets, securityMeta, validateFiles } from './validation.mjs';
import { socialMeta } from './social.mjs';
import { homeTitle, homeDescription, projects, release, games } from './site-config.mjs';
import { releaseSection } from './release.mjs';
import { gamePacks } from './games.mjs';

export { walk } from './files.mjs';
export { securityMeta, validateFiles } from './validation.mjs';

export function compileSite(root) {
  for (const file of walk(path.join(root, 'src'))) checkSecrets(fs.readFileSync(file, 'utf8'), path.relative(root, file));
  const template = name => fs.readFileSync(path.join(root, 'src/templates', name), 'utf8');
  const files = new Map();
  files.set('index.html', fillTemplate(template('home.html'), {
    security: securityMeta(),
    page_title: escapeHtml(homeTitle),
    page_description: escapeHtml(homeDescription),
    social: socialMeta({ title: homeTitle, description: homeDescription }),
    release_section: releaseSection(template('release.html'), release),
    game_packs: gamePacks(games)
  }));
  for (const project of projects) {
    if (!/^[a-z0-9-]+$/.test(project.slug)) throw new Error(`프로젝트 주소를 확인하세요: ${project.slug}`);
    files.set(`projects/${project.slug}.html`, fillTemplate(template(`projects/${project.slug}.html`), {
      security: securityMeta(),
      social: socialMeta({ title: `${project.title} | 박종찬`, description: project.description, page: `projects/${project.slug}.html`, article: true })
    }));
  }
  const options = projects.map(project => `          <option value="./projects/${project.slug}.html">${escapeHtml(project.title)}</option>`).join('\n');
  files.set('mobile-preview.html', fillTemplate(template('mobile-preview.html'), { security: securityMeta(true), project_options: options }));
  for (const [folder, ext, destination] of [['styles', '.css', 'css'], ['scripts', '.js', 'js']]) {
    for (const file of walk(path.join(root, 'src', folder))) {
      if (!file.endsWith(ext)) throw new Error(`지원하지 않는 소스 파일: ${file}`);
      files.set(`assets/${destination}/${path.relative(path.join(root, 'src', folder), file).replaceAll('\\', '/')}`, fs.readFileSync(file));
    }
  }
  addReferencedMedia(root, files);
  for (const file of walk(path.join(root, 'public/assets/icons'))) {
    const relative = path.relative(path.join(root, 'public/assets/icons'), file).replaceAll('\\', '/');
    if (!/^[a-z0-9_-]+\.(?:svg|txt)$/.test(relative)) throw new Error(`아이콘 파일명 또는 확장자를 확인하세요: ${relative}`);
    files.set(`assets/icons/${relative}`, fs.readFileSync(file));
  }
  for (const file of walk(path.join(root, 'public/assets/fonts'))) {
    // Self-hosted fonts and their licence text (the pixel font of the game screen on the home page).
    const relative = path.relative(path.join(root, 'public/assets/fonts'), file).replaceAll('\\', '/');
    if (!/^[a-z0-9_-]+\.(?:woff2|txt)$/.test(relative)) throw new Error(`글꼴 파일명 또는 확장자를 확인하세요: ${relative}`);
    const bytes = fs.readFileSync(file);
    if (bytes.length > 2 * 1024 * 1024) throw new Error(`글꼴은 2MB 이하로 줄여주세요: ${relative}`);
    if (relative.endsWith('.woff2') && bytes.toString('ascii', 0, 4) !== 'wOF2') throw new Error(`글꼴 내용과 확장자가 다릅니다: ${relative}`);
    files.set(`assets/fonts/${relative}`, bytes);
  }
  versionAssets(files);
  files.set('.nojekyll', '');
  const publicFiles = new Map([...files].filter(([name]) => !['mobile-preview.html', 'assets/css/preview.css', 'assets/css/preview-frame.css', 'assets/js/preview.js'].includes(name)));
  validateFiles(files);
  validateFiles(publicFiles);
  return { files, publicFiles };
}
