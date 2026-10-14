import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const template = fs.readFileSync(new URL('../src/templates/home.html', import.meta.url), 'utf8');
const homeStyles = fs.readFileSync(new URL('../src/styles/home.css', import.meta.url), 'utf8');
const scripts = ['games.js', 'project-tabs.js'].map(name => fs.readFileSync(new URL(`../src/scripts/${name}`, import.meta.url), 'utf8')).join('\n');

test('email remains a mail link without copy controls or clipboard code', () => {
  assert.match(template, /class="action action-primary" href="mailto:bkpark0226@naver.com">bkpark0226@naver.com</);
  assert.doesNotMatch(template, /email-copy|copy-status|email-actions/);
  assert.doesNotMatch(scripts, /clipboard|email-copy|copy-status/);
});

test('intro, awards and projects follow the single-column order with the approved copy', () => {
  assert.doesNotMatch(template, /생년월일|2003\.02\.26|profile-birthday|게임 기획</);
  const order = ['id="intro-title"', '게임 디자이너</p>', '우송대학교 게임멀티미디어학과', 'class="intro-statement"', 'href="mailto:bkpark0226@naver.com"', 'href="https://minari-kr.itch.io/"', 'id="games-title"', 'id="awards-title"', 'id="projects-title"', 'id="reflectory-title"', 'id="barrel-good-barrel-title"'];
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

test('action buttons share one transition and darken on hover and press', () => {
  assert.match(homeStyles, /\.action, \.home-link, \.play-link \{ transition: var\(--action-transition\); \}/);
  assert.match(homeStyles, /\.action-primary:hover, \.play-link:hover \{ background: #163b32;/);
  assert.match(homeStyles, /\.action-primary:active, \.play-link:active \{ background: #163b32; \}/);
});

test('projects open their own pages without JavaScript, and the page has no back-to-top button', () => {
  for (const slug of ['reflectory', 'barrel-good-barrel']) {
    assert.ok(template.includes(`<a class="action" href="./projects/${slug}.html">플레이 영상</a>`));
    const page = fs.readFileSync(new URL(`../src/templates/projects/${slug}.html`, import.meta.url), 'utf8');
    assert.match(page, /class="home-link" href="\.\.\/index\.html#projects"/);
    assert.match(page, /<p class="project-award">[^<]+<\/p>/);
    assert.match(page, /<video controls playsinline preload="none"/);
    assert.match(page, /class="play-link" href="https:\/\/minari-kr\.itch\.io\/[a-z-]+" target="_blank" rel="noopener noreferrer"/);
  }
  // The back-to-top button was taken out at the user's request (2026-10-14).
  assert.doesNotMatch(template, /back-to-top|home-actions|circle-arrow-up/);
});
