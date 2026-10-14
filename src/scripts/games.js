// "게임 플레이 경험" on the home page: two rows of cartridges flow across a small game screen → a pressed cartridge shows
// its record on the same screen; a press anywhere on it, Esc, Enter or Space goes back.
(() => {
  const screen = document.querySelector('[data-game-screen]');
  const rows = screen?.querySelector('[data-pack-rows]');
  if (!screen || !rows) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // 8-bit sound: square-wave blips made in the browser (no sound files). Browsers only allow sound after the visitor clicks,
  // taps or presses a key on the page, so the sound engine starts on that first press; pointing before it stays silent.
  let audio = null;
  const volume = 0.035;
  const tunes = {
    point: [[1320, 0, 0.035]],
    open: [[660, 0, 0.06], [990, 0.07, 0.1]],
    close: [[990, 0, 0.05], [660, 0.06, 0.08]]
  };
  const sound = name => {
    if (!audio || audio.state !== 'running') return;
    const now = audio.currentTime;
    for (const [frequency, at, length] of tunes[name]) {
      const tone = audio.createOscillator();
      const level = audio.createGain();
      tone.type = 'square';
      tone.frequency.value = frequency;
      level.gain.setValueAtTime(volume, now + at);
      level.gain.exponentialRampToValueAtTime(0.0001, now + at + length);
      tone.connect(level).connect(audio.destination);
      tone.start(now + at);
      tone.stop(now + at + length + 0.02);
    }
  };
  const wake = () => {
    if (!audio) {
      const Context = window.AudioContext || window.webkitAudioContext;
      audio = Context ? new Context() : null;
    }
    if (audio?.state === 'suspended') audio.resume?.();
  };
  for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, wake, { capture: true, passive: true });

  const detail = screen.querySelector('.gs-detail');
  const big = detail.querySelector('.gs-big');
  const name = detail.querySelector('.gs-name');
  const status = screen.querySelector('[data-game-status]');
  let selected = null;

  let lastPoint = 0;
  let pointed = null;
  // A short blip when a cartridge is pointed at or focused (at most one every 80ms while rows slide under the pointer).
  const point = pack => {
    if (!pack || pack === pointed) return;
    pointed = pack;
    const now = performance.now();
    if (now - lastPoint < 80) return;
    lastPoint = now;
    sound('point');
  };
  rows.addEventListener('pointerover', event => point(event.target.closest('.pack')));
  rows.addEventListener('pointerleave', () => { pointed = null; });
  rows.addEventListener('focusin', event => point(event.target.closest('.pack')));

  const restart = (element, className) => {
    element.classList.remove(className);
    void element.offsetWidth; // restart the CSS animation
    element.classList.add(className);
  };
  const open = pack => {
    const from = pack.getBoundingClientRect();
    selected = pack;
    pack.classList.add('is-selected');
    for (const field of detail.querySelectorAll('[data-field]')) {
      const value = pack.dataset[field.dataset.field] || '';
      field.textContent = value;
      field.hidden = !value;
    }
    for (const stat of detail.querySelectorAll('[data-stat]')) stat.hidden = !pack.dataset[stat.dataset.stat];
    // A group with nothing to show (e.g. no hours or achievements yet) drops out with its dashed rule.
    for (const group of detail.querySelectorAll('.gs-info, .gs-stat')) group.hidden = [...group.children].every(stat => stat.hidden);
    const copy = pack.cloneNode(true);
    for (const attribute of ['aria-label', 'aria-hidden', 'data-clone']) copy.removeAttribute(attribute);
    copy.classList.remove('is-selected');
    copy.disabled = true;
    copy.tabIndex = -1;
    big.replaceChildren(copy);
    screen.dataset.state = 'detail';
    detail.hidden = false;
    rows.inert = true;
    restart(detail, 'is-on');
    sound('open');
    const { title, hours, achievements } = pack.dataset;
    status.textContent = [`${title} 기록`, hours && `플레이 시간 ${hours}`, achievements && `업적 ${achievements}`, '화면을 누르거나 Esc로 돌아가기'].filter(Boolean).join(', ');
    // The chosen cartridge flies from its place in the row to the record view.
    if (!motion.matches && copy.animate) {
      const to = copy.getBoundingClientRect();
      const dx = from.left + from.width / 2 - (to.left + to.width / 2);
      const dy = from.top + from.height / 2 - (to.top + to.height / 2);
      copy.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width})` }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.2, .7, .2, 1)' });
    }
    name.focus({ preventScroll: true });
  };
  const close = () => {
    if (detail.hidden) return;
    detail.hidden = true;
    detail.classList.remove('is-on');
    rows.inert = false;
    screen.dataset.state = 'select';
    sound('close');
    status.textContent = '';
    if (!selected) return;
    selected.classList.remove('is-selected');
    const original = selected.hasAttribute('data-clone') ? [...rows.querySelectorAll('.pack:not([data-clone])')].find(pack => pack.dataset.title === selected.dataset.title) : selected;
    original?.focus({ preventScroll: true });
    selected = null;
  };
  // The record closes with a press anywhere on the screen, Esc, Enter or Space.
  detail.addEventListener('click', close);
  screen.addEventListener('keydown', event => {
    if (screen.dataset.state === 'detail' && ['Escape', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      close();
    }
  });
  rows.addEventListener('click', event => {
    const pack = event.target.closest('.pack');
    if (pack) open(pack);
  });

  // Repeat each row until half of it is wider than the screen, then duplicate that half so the row can wrap around
  // without a seam.
  const tracks = [...rows.querySelectorAll('.pack-track')];
  const originals = tracks.map(track => [...track.children]);

  // Rows are moved here frame by frame so they handle like cartridges on a table (2026-10-14 user choice "탄성 카트리지"):
  // a grabbed row brakes within about 0.15s and then follows the pointer; let go, it glides on at the speed it was thrown
  // and blends back into its own flow without ever stopping. While a row runs faster or slower than its flow, its
  // cartridges lean against the motion (up to --pack-tilt) and wobble back on a spring as it settles. The top row runs
  // right, the lower one left and a little slower. A row eases to a stop while a cartridge in it has keyboard focus, and
  // behind an open record every row crawls at 0.3×. Only transforms are written per frame; sizes are read on layout.
  const lanes = tracks.map((track, index) => ({ track, flow: (index % 2 ? -1 : 1) * (index ? 0.8 : 1), x: 0, half: 0, v: 0, grab: null, focused: false, tilt: 0, spin: 0, shown: '' }));
  const setting = (name, fallback) => {
    const value = Number.parseFloat(getComputedStyle(screen).getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  };
  let speed = 32;
  let maxTilt = 9;
  let frame = 0;
  let last = 0;
  let away = false;
  const step = now => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    const pace = screen.dataset.state === 'detail' ? 0.3 : 1;
    for (const lane of lanes) {
      if (!lane.half) continue;
      const flow = lane.focused ? 0 : lane.flow * speed * pace;
      const { grab } = lane;
      if (grab?.moved) {
        // Following the pointer.
        lane.x = grab.left + grab.dx;
        lane.v = grab.speed;
      } else if (grab) {
        // Caught: brakes within about 0.15s.
        lane.v *= Math.exp(-dt * 22);
        lane.x += lane.v * dt;
      } else {
        // Thrown or let go: glides back into its own flow.
        lane.v = flow + (lane.v - flow) * Math.exp(-dt * 2.6);
        lane.x += lane.v * dt;
      }
      lane.x = ((lane.x % lane.half) + lane.half) % lane.half;
      // The lean follows how far the row is from its own flow, on a damped spring so it wobbles a little as it settles.
      const lean = Math.max(-maxTilt, Math.min(maxTilt, -(lane.v - flow) * 0.012));
      lane.spin += ((lean - lane.tilt) * 190 - lane.spin * 9) * dt;
      lane.tilt += lane.spin * dt;
      lane.track.style.transform = `translate3d(${(lane.x - lane.half).toFixed(1)}px, 0, 0)`;
      const tilt = Math.abs(lane.tilt) < 0.05 && Math.abs(lane.spin) < 0.05 ? '0deg' : `${Math.max(-maxTilt, Math.min(maxTilt, lane.tilt)).toFixed(2)}deg`;
      if (tilt !== lane.shown) {
        lane.track.style.setProperty('--tilt', tilt);
        lane.shown = tilt;
      }
    }
    frame = window.requestAnimationFrame(step);
  };
  // The rows only run while the screen is on screen and motion is allowed.
  const run = () => {
    const on = !away && !motion.matches && lanes.some(lane => lane.half);
    if (on && !frame) {
      last = 0;
      frame = window.requestAnimationFrame(step);
    }
    if (!on && frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }
  };
  const layout = () => {
    speed = setting('--pack-speed', 32);
    maxTilt = setting('--pack-tilt', 9);
    lanes.forEach((lane, index) => {
      const { track } = lane;
      for (const clone of track.querySelectorAll('[data-clone]')) clone.remove();
      track.classList.remove('is-looping');
      track.style.transform = '';
      track.style.removeProperty('--tilt');
      lane.half = 0;
      lane.shown = '';
      if (motion.matches) return;
      const setWidth = originals[index].reduce((sum, pack) => sum + pack.offsetWidth + Number.parseFloat(getComputedStyle(pack).marginRight || 0), 0);
      if (!setWidth) return;
      const copies = Math.max(1, Math.ceil(rows.clientWidth / setWidth));
      for (let i = 1; i < copies * 2; i += 1) {
        for (const pack of originals[index]) {
          const clone = pack.cloneNode(true);
          clone.dataset.clone = '';
          clone.tabIndex = -1;
          clone.setAttribute('aria-hidden', 'true');
          clone.classList.remove('is-selected');
          track.append(clone);
        }
      }
      lane.half = setWidth * copies;
      lane.x %= lane.half;
      if (!lane.v) lane.v = lane.flow * speed;
      track.classList.add('is-looping');
    });
    run();
  };

  let keyboard = false;
  window.addEventListener('keydown', () => { keyboard = true; }, true);
  window.addEventListener('pointerdown', () => { keyboard = false; }, true);
  // Grab a row and drag or throw it sideways; it wraps around, so it never runs out of cartridges.
  let dragged = false;
  rows.querySelectorAll('.pack-row').forEach((row, index) => {
    const lane = lanes[index];
    if (!lane) return;
    row.addEventListener('focusin', () => { lane.focused = keyboard; });
    row.addEventListener('focusout', event => {
      if (!row.contains(event.relatedTarget)) lane.focused = false;
    });
    row.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !lane.half || screen.dataset.state === 'detail') return;
      lane.grab = { x: event.clientX, last: event.clientX, time: performance.now(), speed: 0, dx: 0, left: lane.x, moved: false };
    });
    row.addEventListener('pointermove', event => {
      const { grab } = lane;
      if (!grab) return;
      const dx = event.clientX - grab.x;
      if (!grab.moved) {
        if (Math.abs(dx) < 6) return;
        grab.moved = true;
        grab.left = lane.x - dx;
        row.setPointerCapture(event.pointerId);
        row.classList.add('is-dragging');
      }
      const now = performance.now();
      grab.speed = grab.speed * 0.6 + ((event.clientX - grab.last) / (Math.max(1, now - grab.time) / 1000)) * 0.4;
      grab.last = event.clientX;
      grab.time = now;
      grab.dx = dx;
    });
    const end = () => {
      const { grab } = lane;
      if (!grab) return;
      lane.grab = null;
      dragged = grab.moved;
      row.classList.remove('is-dragging');
      // Thrown at the speed of the drag's last moment; a pause before letting go throws nothing.
      if (grab.moved) lane.v = performance.now() - grab.time < 80 ? Math.max(-1600, Math.min(1600, grab.speed)) : 0;
    };
    row.addEventListener('pointerup', end);
    row.addEventListener('pointercancel', end);
    // A drag is not a press: the cartridge under the pointer does not open.
    row.addEventListener('click', event => {
      if (!dragged) return;
      dragged = false;
      event.preventDefault();
      event.stopPropagation();
    }, true);
  });

  // The rows stop while the screen is off screen (and the hint's blinking with them, games.css: .is-away).
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      away = !entry.isIntersecting;
      screen.classList.toggle('is-away', away);
      run();
    }).observe(screen);
  }
  // Lay the rows out again once the pixel font is ready and after the window is resized.
  let resizeTimer;
  let width = rows.clientWidth;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (rows.clientWidth === width) return;
      width = rows.clientWidth;
      layout();
    }, 200);
  });
  motion.addEventListener('change', layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  else layout();
})();
