import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileSite, walk } from './site.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');
const compiled = compileSite(root); // Validate all content before touching generated files.
const manifestPath = path.join(root, '.generated-files.json');
const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];

function targetPath(base, name) {
  if (typeof name !== 'string' || !/^(?:index\.html|mobile-preview\.html|\.nojekyll|journal\/[a-z0-9-]+\.html|assets\/(?:css|js|images)\/[a-z0-9_./-]+)$/.test(name)) throw new Error('생성 파일 목록에 허용되지 않는 경로가 있습니다.');
  if (name.split('/').some(part => part === '..' || part === '.')) throw new Error('상위 경로 이동은 허용되지 않습니다.');
  const target = path.resolve(base, name);
  if (!target.startsWith(path.resolve(base) + path.sep)) throw new Error('프로젝트 밖의 경로는 수정할 수 없습니다.');
  let parent = target;
  while (parent.startsWith(root + path.sep)) {
    if (fs.existsSync(parent) && fs.lstatSync(parent).isSymbolicLink()) throw new Error('심볼릭 링크 경로는 수정할 수 없습니다.');
    parent = path.dirname(parent);
  }
  return target;
}
function writeFiles(base, files) {
  for (const [name, value] of files) {
    const target = targetPath(base, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, value);
  }
}
// Check every removal and output directory before changing any generated file.
if (!Array.isArray(previous)) throw new Error('생성 파일 목록은 배열이어야 합니다.');
for (const name of previous) targetPath(root, name);
const previousFiles = new Set(previous);
for (const [base, expected, folders] of [
  [root, compiled.files, ['journal', 'assets']],
  [path.join(root, 'dist'), compiled.publicFiles, ['']]
]) {
  for (const folder of folders) {
    for (const file of walk(path.join(base, folder))) {
      const name = path.relative(base, file).replaceAll('\\', '/');
      if (expected.has(name)) continue;
      if (!checkOnly && previousFiles.has(name)) continue;
      const reason = previousFiles.has(name) ? '오래된 생성 파일입니다. npm run build를 실행하세요' : '관리하지 않는 파일입니다. 백업 후 원본 폴더로 옮기거나 제거하세요';
      throw new Error(`${reason}: ${path.relative(root, file).replaceAll('\\', '/')}`);
    }
  }
}
if (checkOnly) {
  for (const [base, files] of [[root, compiled.files], [path.join(root, 'dist'), compiled.publicFiles]]) {
    for (const [name, value] of files) {
      const target = targetPath(base, name);
      if (!fs.existsSync(target) || !fs.readFileSync(target).equals(Buffer.from(value))) throw new Error(`생성 결과가 최신이 아닙니다. npm run build 후 다시 확인하세요: ${name}`);
    }
  }
} else {
  // Only remove obsolete files recorded by our generator, after validating their paths.
  for (const name of previous) {
    if (!compiled.files.has(name)) {
      const target = targetPath(root, name);
      if (fs.existsSync(target)) fs.unlinkSync(target);
    }
  }
  // dist is generated-only. Refuse unknown files instead of silently deleting them.
  for (const file of walk(path.join(root, 'dist'))) {
    const name = path.relative(path.join(root, 'dist'), file).replaceAll('\\', '/');
    if (!compiled.publicFiles.has(name)) {
      if (!previous.includes(name)) throw new Error(`dist에 생성기가 관리하지 않는 파일이 있습니다: ${name}`);
      fs.unlinkSync(targetPath(path.join(root, 'dist'), name));
    }
  }
  writeFiles(root, compiled.files);
  writeFiles(path.join(root, 'dist'), compiled.publicFiles);
  fs.writeFileSync(manifestPath, JSON.stringify([...compiled.files.keys()].sort(), null, 2) + '\n');
}
const actualPublic = walk(path.join(root, 'dist')).map(file => path.relative(path.join(root, 'dist'), file).replaceAll('\\', '/')).sort();
const expectedPublic = [...compiled.publicFiles.keys()].sort();
if (JSON.stringify(actualPublic) !== JSON.stringify(expectedPublic)) throw new Error('배포 폴더에 누락되거나 허용되지 않은 파일이 있습니다.');
console.log(`${checkOnly ? '검사' : '생성'} 완료: 공개 일지 ${compiled.posts.length}개, 배포 파일 ${actualPublic.length}개. 원고·관리 문서·미리보기는 배포 대상에서 제외됩니다.`);
