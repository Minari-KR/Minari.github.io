import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/scripts/home-actions.js', import.meta.url), 'utf8');
const template = fs.readFileSync(new URL('../src/templates/home.html', import.meta.url), 'utf8');

function setup({ scrollY = 0, reduced = false, missing = false } = {}) {
  const makeElement = () => ({ hidden: true, textContent: '', events: {}, addEventListener(name, callback) { this.events[name] = callback; } });
  const top = makeElement();
  const heading = { focus(options) { this.focusOptions = options; } };
  const nodes = { '.back-to-top': top };
  const window = {
    scrollY, innerHeight: 700, events: {},
    addEventListener(name, callback) { this.events[name] = callback; },
    matchMedia() { return { matches: reduced }; },
    scrollTo(options) { this.scrollOptions = options; },
  };
  vm.runInNewContext(source, {
    document: { querySelector: selector => missing ? null : nodes[selector], getElementById: () => missing ? null : heading },
    window,
  });
  return { top, heading, window };
}

test('email remains a mail link without copy controls or clipboard code', () => {
  assert.match(template, /class="contact-email" href="mailto:bkpark0226@naver.com"/);
  assert.doesNotMatch(template, /email-copy|copy-status|email-actions/);
  assert.doesNotMatch(source, /clipboard|email-copy|copy-status/);
});

test('back-to-top follows scroll, resize and restored-page position', () => {
  const state = setup();
  assert.equal(state.top.hidden, true);
  state.window.scrollY = 701;
  state.window.events.scroll();
  assert.equal(state.top.hidden, false);
  state.window.innerHeight = 800;
  state.window.events.resize();
  assert.equal(state.top.hidden, true);
  state.window.scrollY = 1000;
  state.window.events.pageshow();
  assert.equal(state.top.hidden, false);
  state.window.scrollY = 0;
  state.window.events.scroll();
  assert.equal(state.top.hidden, true);
});

test('back-to-top restores heading focus and honors reduced motion', () => {
  for (const reduced of [false, true]) {
    const state = setup({ scrollY: 1000, reduced });
    state.top.events.click();
    assert.equal(state.heading.focusOptions.preventScroll, true);
    assert.equal(state.window.scrollOptions.top, 0);
    assert.equal(state.window.scrollOptions.behavior, reduced ? 'instant' : 'smooth');
  }
});

test('optional controls can be absent and shortcuts work as ordinary anchors without JavaScript', () => {
  assert.doesNotThrow(() => setup({ missing: true }));
  for (const id of ['games', 'activities', 'journal']) {
    assert.ok(template.includes(`href="#${id}"`));
    assert.ok(template.includes(`id="${id}" tabindex="-1"`));
  }
  assert.match(template, /class="back-to-top"[^>]*hidden/);
  assert.match(template, /class="back-to-top"[^>]*aria-label="페이지 맨 위로 이동"/);
});
