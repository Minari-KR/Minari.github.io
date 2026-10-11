import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Recursive cpSync terminates Node in the current Windows/OneDrive environment.
// Copy the same fixture files individually so assertions still run unchanged.
export function copyFixtureTree(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyFixtureTree(from, to);
    else if (entry.isFile() && path.extname(from) === '.mp4') {
      // Most fixtures exercise references and file validation; real media is covered by compileSite(root).
      const video = Buffer.alloc(24);
      video.writeUInt32BE(video.length, 0);
      video.write('ftypisom', 4, 'ascii');
      fs.writeFileSync(to, video);
    } else if (entry.isFile()) fs.copyFileSync(from, to);
    else throw new Error(`Unexpected fixture entry: ${from}`);
  }
}

export function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'minari-portfolio-test-'));
  copyFixtureTree(path.join(root, 'src'), path.join(directory, 'src'));
  copyFixtureTree(path.join(root, 'public'), path.join(directory, 'public'));
  t.after(() => {
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('minari-portfolio-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return directory;
}

export const imageBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3i8AAAAASUVORK5CYII=', 'base64');
