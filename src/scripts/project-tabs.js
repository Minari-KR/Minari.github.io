// Projects on the home page (2026-10-14 user choice "썸네일 탭 + 큰 카드"): a row of small title pictures above one large card.
// Every project is visible at a glance as a thumbnail; pressing one (or the arrow keys on the row, or a sideways swipe on the
// card) shows its card. The cards share one place, so the page keeps the height of the tallest and nothing below jumps.
// When there are more thumbnails than fit, the row flows sideways on its own like the game screen's cartridge rows
// (2026-10-14 user request): it can be grabbed, dragged and thrown, and glides back into its flow. With reduced motion it
// stays still and scrolls instead. Without this script the thumbnails stay hidden and the cards simply follow one another.
(() => {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  for (const root of document.querySelectorAll('[data-project-tabs]')) {
    const list = root.querySelector('[role="tablist"]');
    const tabs = list ? [...list.querySelectorAll('[role="tab"]')] : [];
    const cards = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
    if (tabs.length < 2 || cards.some(card => !card)) continue;

    // The tabs move inside one track, so a flowing row only needs one transform.
    const track = document.createElement('div');
    track.className = 'ptabs-track';
    track.setAttribute('role', 'none');
    tabs.forEach((tab, index) => {
      tab.dataset.index = String(index);
      track.append(tab);
    });
    list.append(track);

    const lane = { x: 0, half: 0, v: 0, grab: null, focused: false };
    let current = 0;
    // A chosen tab half out of a still row slides fully into view (without moving the page); a flowing row that stopped
    // for keyboard focus is moved so the tab sits in the middle.
    const reveal = tab => {
      if (lane.half) {
        const at = (list.clientWidth - tab.offsetWidth) / 2 - tab.offsetLeft;
        lane.x = (((at + lane.half) % lane.half) + lane.half) % lane.half;
        track.style.transform = `translate3d(${(lane.x - lane.half).toFixed(1)}px, 0, 0)`;
        return;
      }
      const left = tab.offsetLeft - list.offsetLeft;
      if (left < list.scrollLeft || left + tab.offsetWidth > list.scrollLeft + list.clientWidth) {
        list.scrollTo({ left: left - (list.clientWidth - tab.offsetWidth) / 2, behavior: motion.matches ? 'auto' : 'smooth' });
      }
    };
    const show = (index, { focus = false } = {}) => {
      const to = (index + tabs.length) % tabs.length;
      current = to;
      tabs.forEach((tab, i) => {
        const on = i === to;
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;
        cards[i].classList.toggle('is-current', on);
        cards[i].inert = !on;
      });
      // The copies of a flowing row only mirror the look of the chosen tab.
      for (const copy of track.querySelectorAll('[data-clone]')) copy.setAttribute('aria-selected', String(Number(copy.dataset.index) === to));
      if (focus) {
        reveal(tabs[to]);
        tabs[to].focus({ preventScroll: true });
      }
      else if (!lane.half) reveal(tabs[to]);
    };

    // A press on a tab, or on one of its copies in a flowing row.
    list.addEventListener('click', event => {
      const tab = event.target.closest('.ptabs-tab');
      if (tab) show(Number(tab.dataset.index));
    });
    // Arrow keys move along the thumbnails (and show that card); Home and End jump to the ends.
    let keyboard = false;
    window.addEventListener('keydown', () => { keyboard = true; }, true);
    window.addEventListener('pointerdown', () => { keyboard = false; }, true);
    list.addEventListener('keydown', event => {
      const moves = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: tabs.length - 1 };
      if (!(event.key in moves)) return;
      event.preventDefault();
      show(moves[event.key], { focus: true });
    });
    // A flowing row stops while a tab in it has keyboard focus.
    list.addEventListener('focusin', event => {
      lane.focused = keyboard;
      if (keyboard && lane.half) reveal(event.target.closest('.ptabs-tab') || tabs[current]);
    });
    list.addEventListener('focusout', event => {
      if (!list.contains(event.relatedTarget)) lane.focused = false;
    });
    // A sideways swipe on the card (touch only; the page still scrolls up and down) shows the next or previous project.
    let swipe = null;
    root.addEventListener('pointerdown', event => {
      swipe = event.pointerType === 'mouse' || !event.target.closest('.ptabs-cards') ? null : { x: event.clientX, y: event.clientY };
    });
    root.addEventListener('pointerup', event => {
      if (!swipe) return;
      const dx = event.clientX - swipe.x;
      const dy = event.clientY - swipe.y;
      swipe = null;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) show(current + (dx < 0 ? 1 : -1));
    });
    root.addEventListener('pointercancel', () => { swipe = null; });

    // A still row that overflows scrolls with a plain mouse wheel too, and hands the scroll back to the page at its ends. A
    // flowing row has no ends, so it only takes sideways wheel turns and leaves up and down to the page.
    list.addEventListener('wheel', event => {
      if (lane.half) {
        if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
        event.preventDefault();
        lane.x -= event.deltaX;
        return;
      }
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY) || list.scrollWidth <= list.clientWidth) return;
      const room = event.deltaY > 0 ? list.scrollWidth - list.clientWidth - list.scrollLeft : list.scrollLeft;
      if (room < 1) return;
      event.preventDefault();
      list.scrollLeft += event.deltaY;
    }, { passive: false });
    // A mouse can grab the row (a finger can too while it flows) and pull it; that drag is not a press. A flowing row
    // keeps the speed it was thrown at and glides back into its flow.
    let pull = null;
    let pulled = false;
    list.addEventListener('pointerdown', event => {
      pulled = false;
      pull = null;
      if (event.button !== 0) return;
      if (lane.half) {
        lane.grab = { x: event.clientX, last: event.clientX, time: performance.now(), speed: 0, dx: 0, left: lane.x, moved: false };
        return;
      }
      if (event.pointerType === 'mouse' && list.scrollWidth > list.clientWidth) pull = { x: event.clientX, left: list.scrollLeft, moved: false };
    });
    list.addEventListener('pointermove', event => {
      const grab = lane.grab || pull;
      if (!grab) return;
      const dx = event.clientX - grab.x;
      if (!grab.moved) {
        if (Math.abs(dx) < 6) return;
        grab.moved = true;
        if (lane.grab) grab.left = lane.x - dx;
        list.setPointerCapture(event.pointerId);
        list.classList.add('is-dragging');
      }
      if (!lane.grab) {
        list.scrollLeft = pull.left - dx;
        return;
      }
      const now = performance.now();
      grab.speed = grab.speed * 0.6 + ((event.clientX - grab.last) / (Math.max(1, now - grab.time) / 1000)) * 0.4;
      grab.last = event.clientX;
      grab.time = now;
      grab.dx = dx;
    });
    const letGo = () => {
      const grab = lane.grab || pull;
      if (!grab) return;
      pulled = grab.moved;
      list.classList.remove('is-dragging');
      if (lane.grab && grab.moved) lane.v = performance.now() - grab.time < 80 ? Math.max(-1600, Math.min(1600, grab.speed)) : 0;
      lane.grab = null;
      pull = null;
    };
    list.addEventListener('pointerup', letGo);
    list.addEventListener('pointercancel', letGo);
    list.addEventListener('click', event => {
      if (!pulled) return;
      pulled = false;
      event.preventDefault();
      event.stopPropagation();
    }, true);
    list.addEventListener('dragstart', event => event.preventDefault());

    // The flowing row is moved frame by frame (transform only; sizes are read on layout), and only while it is on screen.
    let speed = 24;
    let frame = 0;
    let last = 0;
    let away = false;
    const step = now => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      const flow = lane.focused ? 0 : -speed;
      const { grab } = lane;
      if (grab?.moved) {
        lane.x = grab.left + grab.dx;
        lane.v = grab.speed;
      } else if (grab) {
        lane.v *= Math.exp(-dt * 22);
        lane.x += lane.v * dt;
      } else {
        lane.v = flow + (lane.v - flow) * Math.exp(-dt * 2.6);
        lane.x += lane.v * dt;
      }
      lane.x = ((lane.x % lane.half) + lane.half) % lane.half;
      track.style.transform = `translate3d(${(lane.x - lane.half).toFixed(1)}px, 0, 0)`;
      frame = window.requestAnimationFrame(step);
    };
    const run = () => {
      const on = !away && Boolean(lane.half);
      if (on && !frame) {
        last = 0;
        frame = window.requestAnimationFrame(step);
      }
      if (!on && frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
    };
    // The row flows only when its tabs do not fit and motion is allowed; then it repeats its tabs until half of it is wider
    // than the row, and doubles that half so it wraps around without a seam.
    const layout = () => {
      for (const copy of track.querySelectorAll('[data-clone]')) copy.remove();
      list.classList.remove('is-looping');
      track.style.transform = '';
      lane.half = 0;
      if (!motion.matches && list.scrollWidth > list.clientWidth + 1) {
        list.classList.add('is-looping');
        list.scrollLeft = 0;
        speed = Number.parseFloat(getComputedStyle(root).getPropertyValue('--tab-speed')) || 24;
        const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
        const setWidth = tabs.reduce((sum, tab) => sum + tab.offsetWidth + gap, 0);
        const copies = Math.max(1, Math.ceil(list.clientWidth / setWidth));
        for (let i = 1; i < copies * 2; i += 1) {
          for (const tab of tabs) {
            const copy = tab.cloneNode(true);
            copy.dataset.clone = '';
            copy.removeAttribute('id');
            copy.removeAttribute('aria-controls');
            copy.tabIndex = -1;
            copy.setAttribute('aria-hidden', 'true');
            track.append(copy);
          }
        }
        lane.half = setWidth * copies;
        lane.x %= lane.half;
        if (!lane.v) lane.v = -speed;
        show(current);
      }
      run();
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        away = !entry.isIntersecting;
        run();
      }).observe(list);
    }
    let resizeTimer;
    let width = 0;
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (list.clientWidth === width) return;
        width = list.clientWidth;
        layout();
      }, 200);
    });
    motion.addEventListener('change', layout);

    cards.forEach(card => card.setAttribute('role', 'tabpanel'));
    root.classList.add('is-ready');
    list.hidden = false;
    show(0);
    width = list.clientWidth;
    layout();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  }
})();
