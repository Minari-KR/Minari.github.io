import fs from 'node:fs';
import path from 'node:path';
import { walk } from './files.mjs';
import { readHtmlTags, resourceReferences } from './html.mjs';
import { socialTarget } from './social.mjs';

function readHeader(file, length) {
  const descriptor = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const bytesRead = fs.readSync(descriptor, buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    fs.closeSync(descriptor);
  }
}

export function addReferencedMedia(root, files) {
  // Only media referenced by published pages belong in either generated output.
  const referencedImages = new Set();
  const referencedVideos = new Set();
  for (const [name, value] of files) {
    if (!name.endsWith('.html') || name === 'mobile-preview.html') continue;
    for (const { tag, ref } of resourceReferences(readHtmlTags(value.toString()))) {
      const target = tag === 'meta' ? socialTarget(ref) : path.posix.normalize(path.posix.join(path.posix.dirname(name), ref.split('#')[0]));
      if (target.startsWith('assets/images/')) referencedImages.add(target);
      if (target.startsWith('assets/videos/')) referencedVideos.add(target);
    }
  }
  for (const file of walk(path.join(root, 'public/assets/images'))) {
    const name = 'assets/images/' + path.relative(path.join(root, 'public/assets/images'), file).replaceAll('\\', '/');
    if (!/^assets\/images\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(png|jpe?g|webp|gif|avif)$/.test(name)) throw new Error(`이미지 파일명 또는 확장자를 확인하세요: ${name}`);
    if (fs.statSync(file).size > 5 * 1024 * 1024) throw new Error(`이미지는 5MB 이하로 줄여주세요: ${name}`);
    const bytes = readHeader(file, 32);
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
    if (referencedImages.has(name)) files.set(name, fs.readFileSync(file));
  }
  for (const file of walk(path.join(root, 'public/assets/videos'))) {
    const name = 'assets/videos/' + path.relative(path.join(root, 'public/assets/videos'), file).replaceAll('\\', '/');
    if (!/^assets\/videos\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.mp4$/.test(name)) throw new Error(`영상 파일명 또는 확장자를 확인하세요: ${name}`);
    const size = fs.statSync(file).size;
    if (size > 50 * 1024 * 1024) throw new Error(`영상은 50MB 이하로 줄여주세요: ${name}`);
    const bytes = readHeader(file, 64);
    const boxSize = bytes.length >= 16 ? bytes.readUInt32BE(0) : 0;
    if (bytes.toString('utf8', 0, 42).startsWith('version https://git-lfs.github.com/spec/v1')) throw new Error(`LFS 실제 영상이 없습니다. git lfs pull로 내려받은 뒤 다시 생성하세요: ${name}`);
    if (boxSize < 16 || boxSize > size || bytes.toString('ascii', 4, 8) !== 'ftyp' || !/isom|iso2|mp41|mp42|avc1/.test(bytes.toString('ascii', 8, Math.min(boxSize, 64)))) throw new Error(`영상 내용과 확장자가 다릅니다: ${name}`);
    if (referencedVideos.has(name)) files.set(name, fs.readFileSync(file));
  }
}
