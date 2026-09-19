import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/scripts/photos.js', import.meta.url), 'utf8');

function setup(original) {
  const elements = [];
  const classes = new Set();
  function element(tag) {
    const node = {
      tag, attributes: {}, children: [], events: {},
      setAttribute(key, value) { this.attributes[key] = value; },
      getAttribute(key) { return this.attributes[key] ?? null; },
      removeAttribute(key) { delete this.attributes[key]; delete this[key]; },
      append(...children) { this.children.push(...children); },
      addEventListener(key, handler) { this.events[key] = handler; },
      focus() { this.focused = true; },
      showModal() { this.open = true; },
      close() { this.open = false; this.events.close(); },
    };
    elements.push(node);
    return node;
  }
  const photo = element('img');
  photo.src = './assets/images/cards/photo.webp';
  photo.currentSrc = photo.src;
  photo.alt = '사진 설명';
  if (original) photo.setAttribute('data-full-src', original);
  photo.closest = () => ({ querySelector: () => ({ textContent: '사진 캡션' }) });
  photo.before = button => { photo.button = button; };
  vm.runInNewContext(source, {
    HTMLDialogElement: { prototype: { showModal() {} } },
    document: {
      querySelectorAll: () => [photo], createElement: element, createTextNode: text => text,
      body: { append() {} },
      documentElement: { classList: { add: name => classes.add(name), remove: name => classes.delete(name) } },
    },
  });
  return { photo, viewer: elements.find(node => node.tag === 'dialog'),
    image: elements.find(node => node.className === 'photo-viewer-image'), classes };
}

test('full-size photo is requested only on opening and closing restores focus', () => {
  const { photo, viewer, image, classes } = setup('./assets/images/original.jpg');
  assert.equal(image.src, undefined);
  assert.equal(photo.src, './assets/images/cards/photo.webp');
  photo.button.events.click();
  assert.equal(image.src, './assets/images/original.jpg');
  assert.equal(image.alt, photo.alt);
  assert.equal(viewer.open, true);
  assert.ok(classes.has('photo-viewer-open'));
  viewer.close();
  assert.equal(image.src, undefined);
  assert.equal(photo.button.focused, true);
  assert.equal(classes.size, 0);
});

test('photos without a full-size attribute still open their existing image', () => {
  const { photo, image } = setup();
  photo.button.events.click();
  assert.equal(image.src, photo.currentSrc);
});
