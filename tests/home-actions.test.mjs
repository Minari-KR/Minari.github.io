import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/scripts/home-actions.js', import.meta.url), 'utf8');
const template = fs.readFileSync(new URL('../src/templates/home.html', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../src/styles/home-actions.css', import.meta.url), 'utf8');
const homeStyles = fs.readFileSync(new URL('../src/styles/home.css', import.meta.url), 'utf8');

function setup({ scrollY = 0, reduced = false, missing = false, fadeTime = '0.42s' } = {}) {
  const makeElement = () => {
    const classes = new Set();
    return { hidden: true, textContent: '', events: {}, classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) }, addEventListener(name, callback) { this.events[name] = callback; } };
  };
  const top = makeElement();
  const heading = { focus(options) { this.focusOptions = options; } };
  const nodes = { '.back-to-top': top };
  const frames = new Map();
  const timers = new Map();
  const motion = { matches: reduced, addEventListener(name, callback) { this.events[name] = callback; }, events: {} };
  let nextId = 0;
  const window = {
    scrollY, innerHeight: 700, events: {},
    addEventListener(name, callback) { this.events[name] = callback; },
    matchMedia() { return motion; },
    getComputedStyle() { return { transitionDuration: `${fadeTime}, ${fadeTime}, 0.16s` }; },
    scrollTo(options) { this.scrollOptions = options; },
    requestAnimationFrame(callback) { const id = ++nextId; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(callback, delay) { const id = ++nextId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  vm.runInNewContext(source, {
    document: { querySelector: selector => missing ? null : nodes[selector], getElementById: () => missing ? null : heading },
    window,
  });
  return {
    top, heading, window, motion,
    frame() { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); },
    timeout() { const pending = [...timers.values()]; timers.clear(); pending.forEach(({ callback }) => callback()); },
    timerDelays() { return [...timers.values()].map(({ delay }) => delay); },
  };
}

test('email remains a mail link without copy controls or clipboard code', () => {
  assert.match(template, /class="action action-primary" href="mailto:bkpark0226@naver.com">bkpark0226@naver.com</);
  assert.doesNotMatch(template, /email-copy|copy-status|email-actions/);
  assert.doesNotMatch(source, /clipboard|email-copy|copy-status/);
});

test('intro, awards and projects follow the single-column order with the approved copy', () => {
  assert.doesNotMatch(template, /생년월일|2003\.02\.26|profile-birthday|게임 기획</);
  const order = ['id="intro-title"', '게임 디자이너</p>', '우송대학교 게임멀티미디어학과', 'class="intro-statement"', 'href="mailto:bkpark0226@naver.com"', 'href="https://minari-kr.itch.io/"', 'id="awards-title"', 'id="projects-title"', 'id="reflectory-title"', 'id="barrel-good-barrel-title"'];
  const positions = order.map(marker => template.indexOf(marker));
  assert.ok(positions.every(position => position >= 0), String(positions));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.equal((template.match(/<strong class="award-name">/g) || []).length, 4);
  assert.doesNotMatch(template, /role-list/);
  assert.doesNotMatch(template, /section-shortcuts|project-shortcuts|journal|award-project|<dialog/);
});

test('page drops template chrome: menus, middle-dot meta, link arrows and tile cards', () => {
  const main = template.slice(template.indexOf('<main'), template.indexOf('</main>'));
  assert.doesNotMatch(main, / · |<nav/);
  assert.doesNotMatch(template, /arrow-right\.svg|class="tile|tile-more/);
  assert.doesNotMatch(homeStyles, /#fffefa|--paper-solid/);
});

test('back-to-top follows scroll, resize and restored-page position when motion is reduced', () => {
  const state = setup({ reduced: true });
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

test('back-to-top visibly fades in and out across its scroll threshold', () => {
  const state = setup();
  state.window.scrollY = 701;
  state.window.events.scroll();
  assert.equal(state.top.hidden, false);
  assert.equal(state.top.classList.contains('is-appearing'), true);
  state.frame();
  assert.equal(state.top.classList.contains('is-appearing'), true);
  state.frame();
  assert.equal(state.top.classList.contains('is-appearing'), false);
  state.window.scrollY = 0;
  state.window.events.scroll();
  assert.equal(state.top.hidden, false);
  assert.equal(state.top.classList.contains('is-dismissing'), true);
  state.timeout();
  assert.equal(state.top.hidden, true);
  assert.equal(state.top.classList.contains('is-dismissing'), false);
});

test('dismissal fallback follows the CSS fade duration', () => {
  const state = setup({ scrollY: 1000, fadeTime: '800ms' });
  state.frame();
  state.frame();
  state.window.scrollY = 0;
  state.window.events.scroll();
  assert.ok(state.timerDelays()[0] >= 800);
  assert.equal(state.top.hidden, false);
  state.timeout();
  assert.equal(state.top.hidden, true);
});

test('consecutive scrolling preserves the appearance preparation until both frames finish', () => {
  const state = setup();
  state.window.scrollY = 701;
  state.window.events.scroll();
  state.window.scrollY = 720;
  state.window.events.scroll();
  assert.equal(state.top.classList.contains('is-appearing'), true);
  state.frame();
  state.window.scrollY = 750;
  state.window.events.scroll();
  assert.equal(state.top.classList.contains('is-appearing'), true);
  state.frame();
  assert.equal(state.top.classList.contains('is-appearing'), false);
  assert.equal(state.top.hidden, false);
});

test('reversing scroll cancels pending appearance and dismissal callbacks', () => {
  const state = setup();
  state.window.scrollY = 1000;
  state.window.events.scroll();
  state.frame();
  state.window.scrollY = 0;
  state.window.events.scroll();
  state.frame();
  assert.equal(state.top.classList.contains('is-appearing'), false);
  assert.equal(state.top.classList.contains('is-dismissing'), true);
  state.window.scrollY = 1000;
  state.window.events.scroll();
  state.timeout();
  assert.equal(state.top.hidden, false);
  assert.equal(state.top.classList.contains('is-dismissing'), false);
  state.frame();
  state.frame();
  assert.equal(state.top.classList.contains('is-appearing'), false);
});

test('action buttons share one transition and darken on hover and press', () => {
  assert.match(homeStyles, /\.action, \.home-link, \.play-link \{ transition: var\(--action-transition\); \}/);
  assert.match(homeStyles, /\.action-primary:hover, \.play-link:hover \{ background: #163b32;/);
  assert.match(homeStyles, /\.action-primary:active, \.play-link:active \{ background: #163b32; \}/);
  assert.doesNotMatch(styles, /play-link|\.action/);
});

test('dismissal completes on the opacity transition and adapts when motion preference changes', () => {
  const state = setup({ scrollY: 1000 });
  state.frame();
  state.frame();
  state.window.scrollY = 0;
  state.window.events.scroll();
  state.top.events.transitionend({ target: state.top, propertyName: 'background-color' });
  assert.equal(state.top.hidden, false);
  state.top.events.transitionend({ target: state.top, propertyName: 'opacity' });
  assert.equal(state.top.hidden, true);
  state.window.scrollY = 1000;
  state.window.events.scroll();
  state.motion.matches = true;
  state.motion.events.change();
  assert.equal(state.top.hidden, false);
  assert.equal(state.top.classList.contains('is-appearing'), false);
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

test('optional controls can be absent and projects open their own pages without JavaScript', () => {
  assert.doesNotThrow(() => setup({ missing: true }));
  for (const slug of ['reflectory', 'barrel-good-barrel']) {
    assert.ok(template.includes(`<a class="action" href="./projects/${slug}.html">플레이 영상</a>`));
    const page = fs.readFileSync(new URL(`../src/templates/projects/${slug}.html`, import.meta.url), 'utf8');
    assert.match(page, /class="home-link" href="\.\.\/index\.html#projects"/);
    assert.match(page, /<p class="project-award">[^<]+<\/p>/);
    assert.match(page, /<video controls playsinline preload="none"/);
    assert.match(page, /class="play-link" href="https:\/\/minari-kr\.itch\.io\/[a-z-]+" target="_blank" rel="noopener noreferrer"/);
  }
  assert.match(template, /class="back-to-top"[^>]*hidden/);
  assert.match(template, /class="back-to-top"[^>]*aria-label="페이지 맨 위로 이동"/);
});
