import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/scripts/preview.js', import.meta.url), 'utf8');

function preview({ blocked = false } = {}) {
  const element = () => ({
    listeners: {}, attributes: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(type, callback) { this.listeners[type] = callback; },
    setAttribute(name, value) { this.attributes[name] = value; }
  });
  const buttons = ['w412', 'w390', 'w360', 'w320'].map(size => ({ ...element(), dataset: { size } }));
  const appended = [];
  const doc = {
    URL: 'https://preview.test/index.html', body: {},
    documentElement: { ...element(), clientWidth: 412 },
    head: { append(link) { appended.push(link); } },
    createElement: element,
    getElementById(id) { return appended.find(link => link.id === id); }
  };
  const ids = {
    phoneA: element(), frameA: element(), reload: element(), frameStatus: element(),
    pageSelect: { ...element(), value: './index.html', options: [{ value: './index.html' }, { value: './journal/example.html' }] },
    frameStyles: { href: 'https://preview.test/assets/css/preview-frame.css?v=123456789abc' }
  };
  Object.defineProperty(ids.frameA, 'contentDocument', { get() {
    if (blocked) throw new Error('Access denied');
    return doc;
  } });
  vm.runInNewContext(source, { document: { querySelectorAll: () => buttons, getElementById: id => ids[id] }, Date });
  return { ids, buttons, doc, appended };
}

test('preview remains navigable when the browser denies frame access', () => {
  const { ids, buttons } = preview({ blocked: true });
  assert.match(ids.frameStatus.textContent, /접근을 제한/);
  buttons[2].listeners.click();
  assert.equal(buttons[2].attributes['aria-pressed'], 'true');
  ids.pageSelect.value = './journal/example.html';
  ids.pageSelect.listeners.change();
  assert.match(ids.frameA.src, /^\.\/journal\/example\.html\?v=\d+$/);
  const safeSource = ids.frameA.src;
  ids.pageSelect.value = 'https://unlisted.example/';
  ids.reload.listeners.click();
  assert.equal(ids.frameA.src, safeSource);
});

test('preview measures the content width and reuses the versioned correction stylesheet', () => {
  const { ids, buttons, doc, appended } = preview();
  assert.equal(buttons[0].attributes['aria-pressed'], 'true');
  assert.equal(appended[0].href, ids.frameStyles.href);
  doc.documentElement.clientWidth = 390;
  appended[0].listeners.load();
  assert.match(ids.frameStatus.textContent, /390px/);
  ids.frameA.listeners.load();
  assert.equal(appended.length, 1);
});

test('preview reports a correction stylesheet load failure', () => {
  const { ids, appended } = preview();
  appended[0].listeners.error();
  assert.match(ids.frameStatus.textContent, /보정 파일을 불러오지 못/);
});
