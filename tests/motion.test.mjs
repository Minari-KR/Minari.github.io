import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { readHtmlTags } from '../scripts/html.mjs';

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const source = read('src/scripts/image-loading.js');

function setup({ complete = false, naturalWidth = 954, reduced = false, visibility = 'visible', unsupported = false, throws = false } = {}) {
  const events = new Map();
  const animations = [];
  const image = {
    complete, naturalWidth,
    addEventListener(name, callback) { events.set(name, callback); },
    removeEventListener(name) { events.delete(name); },
    animate(frames, options) {
      if (throws) throw new Error('Animation unavailable');
      const listeners = {};
      const animation = {
        frames, options, cancelled: false,
        addEventListener(name, callback) { listeners[name] = callback; },
        cancel() { this.cancelled = true; listeners.cancel?.(); },
        finish() { listeners.finish?.(); },
      };
      animations.push(animation);
      return animation;
    },
  };
  if (unsupported) delete image.animate;
  const motion = { matches: reduced, addEventListener(name, callback) { this.change = callback; } };
  const windowEvents = {};
  vm.runInNewContext(source, {
    document: { visibilityState: visibility, querySelectorAll: () => [image] },
    window: { matchMedia: () => motion, addEventListener: (name, callback) => { windowEvents[name] = callback; } },
  });
  return { image, events, animations, motion, windowEvents };
}

test('newly loaded photos fade once without changing dimensions or hiding pending content', () => {
  const state = setup();
  assert.equal(state.animations.length, 0);
  state.events.get('load')();
  assert.equal(state.animations.length, 1);
  assert.equal(state.animations[0].options.duration, 200);
  assert.equal(state.animations[0].frames.at(-1).opacity, 1);
  assert.equal(state.events.size, 0);
  assert.doesNotMatch(source, /\.style\b|\.hidden\s*=|setTimeout|requestAnimationFrame/);
});

test('cached and unsupported photos remain untouched; failed photos remove listeners', () => {
  for (const options of [{ complete: true }, { complete: true, naturalWidth: 0 }, { unsupported: true }]) {
    const state = setup(options);
    assert.equal(state.events.size, 0);
    assert.equal(state.animations.length, 0);
  }
  const failed = setup();
  failed.events.get('error')();
  assert.equal(failed.events.size, 0);
  assert.equal(failed.animations.length, 0);
});

test('motion preference, hidden tabs and empty images skip the load effect', () => {
  for (const options of [{ reduced: true }, { visibility: 'hidden' }, { naturalWidth: 0 }]) {
    const state = setup(options);
    state.events.get('load')();
    assert.equal(state.animations.length, 0);
    assert.equal(state.events.size, 0);
  }
  const unavailable = setup({ throws: true });
  assert.doesNotThrow(() => unavailable.events.get('load')());
  assert.equal(unavailable.events.size, 0);
});

test('active image effects cancel on motion preference changes and page exit', () => {
  for (const reason of ['motion', 'pagehide']) {
    const state = setup();
    state.events.get('load')();
    if (reason === 'motion') {
      state.motion.matches = true;
      state.motion.change();
    } else state.windowEvents.pagehide();
    assert.equal(state.animations[0].cancelled, true);
  }
  const finished = setup();
  finished.events.get('load')();
  finished.animations[0].finish();
  finished.windowEvents.pagehide();
  assert.equal(finished.animations[0].cancelled, false);
});

test('missing motion API leaves images unchanged', () => {
  assert.doesNotThrow(() => vm.runInNewContext(source, { window: {} }));
});

test('home photos retain explicit dimensions and each effect has its own removable resource or block', () => {
  const home = read('src/templates/home.html');
  const journal = read('src/templates/journal.html');
  const images = readHtmlTags(home).filter(({ tag }) => tag === 'img');
  assert.ok(images.length > 0);
  for (const { attributes } of images) {
    assert.ok(Number(attributes.width) > 0);
    assert.ok(Number(attributes.height) > 0);
  }
  assert.match(home, /assets\/css\/page-transitions\.css/);
  assert.match(journal, /assets\/css\/page-transitions\.css/);
  assert.match(home, /assets\/js\/image-loading\.js/);
  const transitions = read('src/styles/page-transitions.css');
  assert.match(transitions, /@media \(prefers-reduced-motion: no-preference\)[\s\S]*navigation: auto/);
  assert.match(transitions, /@media \(prefers-reduced-motion: reduce\)[\s\S]*navigation: none/);
  assert.match(read('src/styles/photos.css'), /@media \(prefers-reduced-motion: no-preference\)[\s\S]*\.photo-viewer\[open\][\s\S]*150ms/);
});
