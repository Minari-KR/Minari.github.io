import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readHtmlTags } from '../scripts/html.mjs';

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('home images retain explicit dimensions and page transitions respect reduced motion', () => {
  const home = read('src/templates/home.html');
  const journal = read('src/templates/journal.html');
  for (const { tag, attributes } of readHtmlTags(home)) {
    if (tag !== 'img') continue;
    assert.ok(Number(attributes.width) > 0);
    assert.ok(Number(attributes.height) > 0);
  }
  assert.match(home, /assets\/css\/page-transitions\.css/);
  assert.match(journal, /assets\/css\/page-transitions\.css/);
  const transitions = read('src/styles/page-transitions.css');
  assert.match(transitions, /@media \(prefers-reduced-motion: no-preference\)[\s\S]*navigation: auto/);
  assert.match(transitions, /@media \(prefers-reduced-motion: reduce\)[\s\S]*navigation: none/);
});
