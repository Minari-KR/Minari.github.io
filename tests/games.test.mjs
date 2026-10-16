import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compileSite, validateFiles } from '../scripts/site.mjs';
import { gamePacks } from '../scripts/games.mjs';
import { root } from './fixture.mjs';

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const sample = (overrides = {}) => ({ title: 'Game <1>', platform: 'PC', genre: 'RPG', hours: '10시간', achievements: '3 / 5', note: '"첫" 기억', shell: 'gray', ...overrides });

test('game packs are cartridge images, escaped, dealt into two rows and carry their record as data', () => {
  const html = gamePacks([sample(), sample({ title: 'B', shell: 'yellow' }), sample({ title: 'C', shell: 'purple' }), sample({ title: 'D', shell: 'black', image: 'assets/images/games/d.webp' })]);
  assert.equal((html.match(/class="pack-row"/g) || []).length, 2);
  assert.equal((html.match(/<button class="pack" /g) || []).length, 4);
  assert.match(html, /data-title="Game &lt;1&gt;"/);
  assert.match(html, /data-genre="RPG"/);
  assert.match(html, /data-note="&quot;첫&quot; 기억"/);
  assert.match(html, /<span class="pack-name">Game &lt;1&gt;<\/span>/);
  assert.match(html, /<img class="pack-shell is-gray" src="\.\/assets\/images\/packs\/shell-gray\.webp" width="440" height="540" alt=""/);
  assert.match(html, /<img class="pack-img" src="\.\/assets\/images\/games\/d\.webp" width="352" height="336" alt=""/);
  assert.doesNotMatch(html, /<1>/);
  assert.equal(gamePacks([sample()]).match(/class="pack-row"/g).length, 1);
});

test('game packs reject a missing title, an unknown shell, non-text fields and pictures outside games/', () => {
  assert.throws(() => gamePacks([]), /비어/);
  assert.throws(() => gamePacks([sample({ title: ' ' })]), /title/);
  assert.throws(() => gamePacks([sample({ shell: 'red' })]), /gray, yellow, purple, black/);
  assert.throws(() => gamePacks([sample({ hours: 10 })]), /hours/);
  for (const image of ['https://example.com/a.webp', 'assets/images/cards/a.webp', 'assets/images/games/../a.webp', 'assets/images/games/a.svg']) {
    assert.throws(() => gamePacks([sample({ image })]), /assets\/images\/games/, image);
  }
});

test('the game-play section comes right after the intro: a small game screen of cartridges and a record view', () => {
  const { files, publicFiles } = compileSite(root);
  const home = files.get('index.html');
  // It follows the intro, above the release app, the awards and the projects; the site is still the portfolio alone.
  assert.ok(home.indexOf('</header>') < home.indexOf('id="games"'));
  for (const later of ['class="section release"', 'id="awards"', 'id="projects"']) assert.ok(home.indexOf('id="games"') < home.indexOf(later), later);
  assert.match(home, /<h2 class="section-title" id="games-title"><span class="marker">게임 플레이 경험<\/span><\/h2>/);
  assert.match(home, /<div class="gs" data-game-screen data-state="select">/);
  assert.equal((home.match(/<button class="pack" /g) || []).length, 29);
  assert.match(home, /assets\/css\/games\.css\?v=[a-f0-9]{12}/);
  assert.match(home, /<script src="\.\/assets\/js\/games\.js\?v=[a-f0-9]{12}" defer><\/script>/);
  for (const name of ['portfolio.html', 'assets/js/prologue.js', 'assets/js/veil.js', 'assets/js/three.js']) assert.ok(!publicFiles.has(name), name);
  // The cartridge shells, the pixel font and its licence are published with the page.
  for (const color of ['gray', 'yellow', 'purple', 'black']) assert.ok(publicFiles.has(`assets/images/packs/shell-${color}.webp`), color);
  assert.ok(publicFiles.has('assets/fonts/neodgm.woff2') && publicFiles.has('assets/fonts/neodgm-ofl.txt'));
  assert.match(home, /font-src 'self' https:\/\/fonts\.gstatic\.com;/);
  // Tab titles: the portfolio's and each project's.
  assert.match(home, /<title>박종찬 \| Game Designer Portfolio<\/title>/);
  assert.match(files.get('projects/reflectory.html'), /<title>Reflectory \| 박종찬<\/title>/);
});

test('stylesheets may only load reviewed local fonts and local SVG icons', () => {
  const { files } = compileSite(root);
  const withCss = css => new Map(files).set('assets/css/fonts-check.css', css);
  assert.doesNotThrow(() => validateFiles(withCss('@font-face { font-family: "A"; src: url("../fonts/neodgm.woff2"); }')));
  assert.doesNotThrow(() => validateFiles(withCss('a { border-image: url("../icons/marker.svg") 0 20 fill; }')));
  for (const css of ['a { background: url("https://example.com/a.png"); }', 'a { background: url(../images/packs/shell-gray.webp); }', '@font-face { src: url("../fonts/missing.woff2"); }', '@font-face { src: url(\'../fonts/a"b.woff2\'); }', '@import "x.css";', 'a { background: url("../icons/missing.svg"); }', 'a { background: url("../icons/house.png"); }']) {
    assert.throws(() => validateFiles(withCss(css)), /외부 리소스|연결 대상/, css);
  }
  // An SVG is only a picture: anything that could run code or load something else is refused.
  for (const svg of ['<svg><script>alert(1)</script></svg>', '<svg onload="x()"/>', '<svg><a href="https://example.com"/></svg>', '<svg><foreignObject/></svg>', '<svg><image xlink:href="a.png"/></svg>']) {
    assert.throws(() => validateFiles(new Map(files).set('assets/icons/marker.svg', svg)), /SVG에 허용되지 않는/, svg);
  }
});

test('section titles and award lines use the drawn highlighter stroke, not a flat band', () => {
  const styles = fs.readFileSync(new URL('../src/styles/home.css', import.meta.url), 'utf8');
  const stroke = fs.readFileSync(new URL('../public/assets/icons/marker.svg', import.meta.url), 'utf8');
  assert.match(styles, /\.marker \{[^}]*border-image: url\("\.\.\/icons\/marker\.svg"\) 0 20 fill \/ 0 \.7em stretch;/);
  assert.match(styles, /\.project-award \{[^}]*border-image: url\("\.\.\/icons\/marker\.svg"\)/);
  assert.doesNotMatch(styles, /var\(--marker\)/);
  assert.match(stroke, /width="120" height="40"/);
  // The intro's four key words get the same stroke in four colour steps, in sentence order.
  const home = fs.readFileSync(new URL('../src/templates/home.html', import.meta.url), 'utf8');
  const words = ['아이디어', '프로토타입', '플레이', '재미'];
  words.forEach((word, i) => {
    assert.match(home, new RegExp(`<span class="marker marker-step-${i + 1}">${word}</span>`));
    assert.ok(styles.includes(`.marker-step-${i + 1} { border-image-source: url("../icons/marker-step-${i + 1}.svg"); }`), word);
    assert.ok(fs.existsSync(new URL(`../public/assets/icons/marker-step-${i + 1}.svg`, import.meta.url)));
  });
});

test('the game screen moves only without a reduced-motion preference and goes back with a press, Esc, Enter or Space', () => {
  const styles = read('src/styles/games.css');
  const script = read('src/scripts/games.js');
  const template = read('src/templates/home.html');
  const start = styles.indexOf('@media (prefers-reduced-motion: no-preference)');
  for (const name of ['gs-blink', 'gs-fade', 'gs-bob']) {
    assert.ok(styles.slice(start).includes(`@keyframes ${name}`), name);
    assert.ok(!styles.slice(0, start).includes(name), name);
  }
  assert.match(script, /prefers-reduced-motion: reduce/);
  assert.match(script, /if \(motion\.matches\) return;/);
  assert.match(script, /!away && !motion\.matches/);
  assert.match(script, /!motion\.matches && copy\.animate/);
  // No back button: a press anywhere on the record, Esc, Enter or Space returns.
  assert.ok(script.includes("detail.addEventListener('click', close);"));
  assert.ok(script.includes("['Escape', 'Enter', ' '].includes(event.key)"));
  assert.match(template, /<p class="gs-exit">화면을 누르면 돌아가요<\/p>/);
  // Rows never stop on hover. "탄성 카트리지": a caught row brakes, a thrown one glides back into its flow and never rests;
  // cartridges lean while a row runs off its flow and wobble back on a spring. Only keyboard focus eases a row to a stop.
  assert.doesNotMatch(styles, /\.pack-row:hover \.pack-track|:focus-within \.pack-track|@keyframes gs-flow/);
  assert.doesNotMatch(script + styles, /--pack-rest|resting|playbackRate/);
  assert.ok(script.includes('lane.v = flow + (lane.v - flow) * Math.exp(-dt * 2.6);'));
  assert.ok(script.includes('lane.v *= Math.exp(-dt * 22);'));
  assert.ok(script.includes('row.addEventListener(\'focusin\', () => { lane.focused = keyboard; });'));
  assert.match(styles, /--pack-tilt: \d+;/);
  assert.match(styles, /\.pack-track\.is-looping \.pack \{ rotate: var\(--tilt, 0deg\); transform-origin: 50% 100%; \}/);
  // Each frame writes transforms only; the rows stop off screen.
  const frame = script.slice(script.indexOf('const step = now =>'), script.indexOf('const run = () =>'));
  assert.doesNotMatch(frame, /getComputedStyle|getBoundingClientRect|offsetWidth|clientWidth|scrollWidth/);
  assert.match(script, /away = !entry\.isIntersecting;/);
  // Sound starts only after the visitor's first press, quietly, and is made in the browser (no sound files).
  assert.ok(script.includes("for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, wake"));
  assert.ok(script.includes('const volume = 0.035;'));
  assert.doesNotMatch(template + script, /\.(?:mp3|wav|ogg)\b|<audio/);
});

test('the game screen keeps its pixel type crisp and readable on phones', () => {
  const styles = read('src/styles/games.css');
  // The screen's edge is a sunken glass: a thin line and a soft top shadow laid over the cartridges, never taking a press.
  assert.match(styles, /\.gs::after \{[^}]*box-shadow: inset 0 0 0 2px var\(--lcd-mid\), inset 0 6px 12px rgba\(15, 56, 15, \.45\);[^}]*pointer-events: none;/);
  // One font declaration, on the reviewed local file; Korean words keep an ordinary quarter-cell space.
  assert.equal((styles.match(/@font-face/g) || []).length, 1);
  assert.match(styles, /\.gs \{[^}]*word-spacing: -\.25em;/);
  // Cartridge names snap to the font's 8px grid; a stat or detail left empty is hidden for real, label included.
  assert.ok(styles.includes('--px-pack: max(16px, round(nearest, 11cqi, 8px));'));
  assert.match(styles, /\.pack-name \{[^}]*font-size: var\(--px-pack\)/);
  assert.ok(styles.includes('.gs-info div:not([hidden]) { display: contents; }'));
  // Phones: the record reads down the middle under its cartridge.
  const phone = styles.slice(styles.indexOf('@media (max-width: 640px)'));
  assert.match(phone, /\.gs-detail \{[^}]*grid-template-columns: minmax\(0, 1fr\); justify-items: center;/);
  assert.match(phone, /\.gs-record \{[^}]*text-align: center;/);
});
