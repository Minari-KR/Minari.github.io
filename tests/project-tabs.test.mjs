import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compileSite } from '../scripts/site.mjs';
import { root } from './fixture.mjs';

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('projects show as thumbnail tabs over one large card, and nothing of the other cards shows', () => {
  const home = compileSite(root).files.get('index.html');
  const section = home.slice(home.indexOf('id="projects"'), home.indexOf('</section>', home.indexOf('id="projects"')));
  // One tab per card, in the same order, each pointing at its card; the tabs stay hidden until the script runs.
  const tabs = [...section.matchAll(/<button class="ptabs-tab" type="button" role="tab" id="tab-([a-z-]+)" aria-controls="project-\1" aria-selected="(true|false)">/g)];
  assert.deepEqual(tabs.map(tab => tab[1]), ['reflectory', 'barrel-good-barrel']);
  assert.deepEqual(tabs.map(tab => tab[2]), ['true', 'false']);
  assert.match(section, /<div class="ptabs-list" role="tablist" aria-label="프로젝트 고르기" hidden>/);
  for (const slug of ['reflectory', 'barrel-good-barrel']) assert.match(section, new RegExp(`<article class="project" id="project-${slug}" aria-labelledby="${slug}-title">`));
  assert.match(home, /<script src="\.\/assets\/js\/project-tabs\.js\?v=[a-f0-9]{12}" defer><\/script>/);
  // The cards share one place: the others are hidden, not slid to the side, and none of the old slider is left.
  const styles = read('src/styles/home.css');
  assert.match(styles, /\.ptabs\.is-ready \.ptabs-cards > \.project \{ grid-area: 1 \/ 1; \}/);
  assert.match(styles, /\.ptabs\.is-ready \.ptabs-cards > \.project:not\(\.is-current\) \{ visibility: hidden; opacity: 0; \}/);
  assert.doesNotMatch(styles + section, /slider|translateX|translate: -?\d+px 0/);
  assert.ok(!fs.existsSync(new URL('../src/scripts/slider.js', import.meta.url)));
});

test('the tabs follow the ARIA tabs pattern and the card change is gentle only without reduced motion', () => {
  const script = read('src/scripts/project-tabs.js');
  const styles = read('src/styles/home.css');
  // Arrow keys, Home and End move along the tabs; only the shown card is reachable; one card alone needs no tabs.
  for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) assert.ok(script.includes(key), key);
  assert.ok(script.includes("tab.setAttribute('aria-selected', String(on));"));
  assert.ok(script.includes('tab.tabIndex = on ? 0 : -1;'));
  assert.ok(script.includes('cards[i].inert = !on;'));
  assert.match(script, /tabs\.length < 2 \|\| cards\.some\(card => !card\)\) continue;/);
  // A row of more tabs than fit scrolls sideways: a plain wheel moves it (and gives the scroll back to the page at its ends),
  // a mouse can pull it without that counting as a press, and a chosen tab slides fully into view without moving the page.
  assert.ok(script.includes("list.addEventListener('wheel'"));
  assert.ok(script.includes('if (room < 1) return;'));
  assert.ok(script.includes('list.scrollLeft = pull.left - dx;'));
  assert.ok(script.includes('if (!pulled) return;'));
  assert.ok(script.includes('tabs[to].focus({ preventScroll: true })'));
  // More tabs than fit: the row flows like the cartridge rows, with copies that are hidden from screen readers, keep no ids
  // and take no Tab stop; it leaves up-and-down wheel turns to the page, stops for keyboard focus, and stays still with
  // reduced motion or when everything fits.
  assert.ok(script.includes("if (!motion.matches && list.scrollWidth > list.clientWidth + 1) {"));
  for (const line of ["copy.removeAttribute('id');", "copy.setAttribute('aria-hidden', 'true');", 'copy.tabIndex = -1;', 'const flow = lane.focused ? 0 : -speed;', 'if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;']) assert.ok(script.includes(line), line);
  const frame = script.slice(script.indexOf('const step = now =>'), script.indexOf('const run = () =>'));
  assert.doesNotMatch(frame, /getComputedStyle|getBoundingClientRect|offsetWidth|clientWidth|scrollWidth/);
  assert.match(styles, /\.ptabs \{ --tab-speed: \d+;/);
  assert.match(styles, /\.ptabs-list\.is-looping \{ overflow: hidden; touch-action: pan-y;/);
  // A sideways swipe on the card is for touch only and leaves vertical scrolling to the page.
  assert.match(script, /event\.pointerType === 'mouse'/);
  assert.match(styles, /\.ptabs\.is-ready \.ptabs-cards \{ display: grid; touch-action: pan-y; \}/);
  const motion = styles.slice(styles.indexOf('@media (prefers-reduced-motion: no-preference)'));
  assert.ok(motion.includes('.ptabs.is-ready .ptabs-cards > .project { transition:'));
  assert.ok(!styles.slice(0, styles.indexOf('@media (prefers-reduced-motion: no-preference)')).includes('.ptabs.is-ready .ptabs-cards > .project { transition:'));
});
