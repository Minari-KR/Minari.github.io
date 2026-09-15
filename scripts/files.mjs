import fs from 'node:fs';
import path from 'node:path';

export function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  if (fs.lstatSync(directory).isSymbolicLink()) throw new Error('심볼릭 링크 폴더는 사용할 수 없습니다.');
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`심볼릭 링크는 배포할 수 없습니다: ${entry.name}`);
    return entry.isDirectory() ? walk(file) : [file];
  }).sort();
}
