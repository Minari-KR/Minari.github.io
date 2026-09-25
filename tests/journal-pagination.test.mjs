import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function paginationFixture({ count = 11, storage = new Map(), pathname = '/index.html', blocked = false } = {}) {
  const cards = Array.from({ length: count }, () => ({ hidden: false }));
  const buttons = [];
  const pagination = { hidden: true, append: b => buttons.push(b), querySelectorAll: () => buttons };
  const document = {
    querySelector: name => name === '.journal-list' ? { querySelectorAll: () => cards } : pagination,
    createElement: () => ({ dataset: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; }, addEventListener(_, callback) { this.click = callback; } })
  };
  const window = { location: { pathname }, sessionStorage: {
    getItem(key) { if (blocked) throw new Error('Storage blocked'); return storage.get(key) ?? null; },
    setItem(key, value) { if (blocked) throw new Error('Storage blocked'); storage.set(key, value); }
  } };
  assert.equal(cards.filter(c => !c.hidden).length, count);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/scripts/journal.js'), 'utf8'), { document, window });
  return { cards, buttons, pagination };
}

test('pagination shows correct cards on page 2 and remains usable without JS', () => {
  const { cards, buttons } = paginationFixture();
  assert.equal(buttons.length, 3);
  buttons[1].click();
  assert.deepEqual(cards.map(c => c.hidden), [true, true, true, true, true, false, false, false, false, false, true]);
  assert.equal(buttons[1].attrs['aria-current'], 'page');
  assert.equal(buttons[0].attrs['aria-current'], undefined);
});

test('pagination restores the selected page on return and isolates other site paths', () => {
  const storage = new Map();
  paginationFixture({ storage, pathname: '/' }).buttons[1].click();
  const restored = paginationFixture({ storage });
  assert.equal(restored.buttons[1].attrs['aria-current'], 'page');
  assert.equal(restored.cards[5].hidden, false);
  assert.equal(restored.cards[0].hidden, true);
  const otherSite = paginationFixture({ storage, pathname: '/other/index.html' });
  assert.equal(otherSite.buttons[0].attrs['aria-current'], 'page');
});

test('pagination clamps removed pages and handles invalid or unavailable storage', () => {
  const key = 'minari:journal-page:/';
  const storage = new Map([[key, '3']]);
  const reduced = paginationFixture({ storage, count: 6 });
  assert.equal(reduced.buttons[1].attrs['aria-current'], 'page');
  for (const value of ['garbage', '-1', '0', '1.5', 'Infinity']) {
    const result = paginationFixture({ storage: new Map([[key, value]]) });
    assert.equal(result.buttons[0].attrs['aria-current'], 'page');
  }
  const blocked = paginationFixture({ blocked: true });
  blocked.buttons[1].click();
  assert.equal(blocked.cards[5].hidden, false);
});

