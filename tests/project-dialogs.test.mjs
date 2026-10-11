import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/scripts/project-dialogs.js', import.meta.url), 'utf8');
const template = fs.readFileSync(new URL('../src/templates/home.html', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../src/styles/project-dialogs.css', import.meta.url), 'utf8');

function setup({ hash = '', supported = true } = {}) {
  const listen = target => Object.assign(target, { events: {}, addEventListener(name, callback) { this.events[name] = callback; } });
  const classes = new Set();
  const root = { classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) } };
  const video = { paused: false, pause() { this.paused = true; } };
  const close = listen({ focus() { this.focused = true; } });
  const dialog = listen({
    id: 'reflectory', open: false,
    showModal() { this.open = true; },
    // The native close event is asynchronous (and can be held in background tabs), so it is not fired here.
    close() { this.open = false; },
    querySelector: selector => selector === '.project-dialog-close' ? close : null,
    querySelectorAll: () => [video],
    getBoundingClientRect: () => ({ left: 100, right: 500, top: 100, bottom: 500 }),
  });
  const link = { href: '#reflectory', getAttribute: () => '#reflectory', closest() { return this; }, focus() { this.focused = true; } };
  const other = { getAttribute: () => '#main', closest() { return this; } };
  const document = listen({ documentElement: root, querySelectorAll: () => [dialog] });
  const window = {
    location: { hash, pathname: '/', search: '' },
    history: { replaceState(...args) { this.args = args; } },
  };
  function HTMLDialogElement() {}
  if (supported) HTMLDialogElement.prototype.showModal = () => {};
  vm.runInNewContext(source, { document, window, HTMLDialogElement });
  const click = target => {
    const event = { target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    document.events.click?.(event);
    return event;
  };
  return { root, dialog, close, link, other, video, window, click };
}

test('project links open their dialog and closing pauses video and restores focus', () => {
  const state = setup();
  assert.equal(state.root.classList.contains('has-project-dialogs'), true);
  const event = state.click(state.link);
  assert.equal(event.defaultPrevented, true);
  assert.equal(state.dialog.open, true);
  assert.equal(state.close.focused, true);
  assert.equal(state.root.classList.contains('dialog-open'), true);
  state.close.events.click({ preventDefault() {} });
  assert.equal(state.dialog.open, false);
  assert.equal(state.video.paused, true);
  assert.equal(state.link.focused, true);
  assert.equal(state.root.classList.contains('dialog-open'), false);
});

test('Escape cleanup runs once and a later close event does not steal focus again', () => {
  const state = setup();
  state.click(state.link);
  state.dialog.open = false;
  state.dialog.events.cancel();
  assert.equal(state.video.paused, true);
  assert.equal(state.link.focused, true);
  assert.equal(state.root.classList.contains('dialog-open'), false);
  state.link.focused = false;
  state.dialog.events.close();
  assert.equal(state.link.focused, false);
});

test('unrelated anchors are left alone and only outside clicks dismiss', () => {
  const state = setup();
  assert.equal(state.click(state.other).defaultPrevented, false);
  state.click(state.link);
  state.dialog.events.pointerdown({ clientX: 300, clientY: 300 });
  state.dialog.events.click({ clientX: 300, clientY: 300 });
  assert.equal(state.dialog.open, true);
  state.dialog.events.pointerdown({ clientX: 20, clientY: 20 });
  state.dialog.events.click({ clientX: 20, clientY: 20 });
  assert.equal(state.dialog.open, false);
});

test('a shared project hash opens its dialog once and clears the hash', () => {
  const state = setup({ hash: '#reflectory' });
  assert.equal(state.dialog.open, true);
  assert.deepEqual(state.window.history.args, [null, '', '/']);
});

test('without dialog support the script leaves the CSS :target fallback in place', () => {
  const state = setup({ supported: false });
  assert.equal(state.root.classList.contains('has-project-dialogs'), false);
  assert.equal(state.click(state.link).defaultPrevented, false);
  assert.match(styles, /html:not\(\.has-project-dialogs\) \.project-dialog:target/);
  for (const id of ['reflectory', 'barrel-good-barrel']) {
    assert.match(template, new RegExp(`class="tile-project-link" href="#${id}" aria-haspopup="dialog"`));
    assert.match(template, new RegExp(`<dialog class="project-dialog" id="${id}"[\\s\\S]*?class="project-dialog-close" href="#main"`));
  }
});
