// Projects on the home page (2026-10-14 user choice "썸네일 탭 + 큰 카드"): a row of small title pictures above one large card.
// Every project is visible at a glance as a thumbnail; pressing one (or the arrow keys on the row, or a sideways swipe on the
// card) shows its card. The cards share one place, so the page keeps the height of the tallest and nothing below jumps.
// Without this script the thumbnails stay hidden and the cards simply follow one another.
(() => {
  for (const root of document.querySelectorAll('[data-project-tabs]')) {
    const list = root.querySelector('[role="tablist"]');
    const tabs = list ? [...list.querySelectorAll('[role="tab"]')] : [];
    const cards = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
    if (tabs.length < 2 || cards.some(card => !card)) continue;

    let current = 0;
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
      // A chosen tab half out of the row slides fully into view (without moving the page).
      const tab = tabs[to];
      const left = tab.offsetLeft - list.offsetLeft;
      if (left < list.scrollLeft || left + tab.offsetWidth > list.scrollLeft + list.clientWidth) {
        list.scrollTo({ left: left - (list.clientWidth - tab.offsetWidth) / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
      if (focus) tab.focus({ preventScroll: true });
    };

    tabs.forEach((tab, index) => tab.addEventListener('click', () => show(index)));
    // Arrow keys move along the thumbnails (and show that card); Home and End jump to the ends.
    list.addEventListener('keydown', event => {
      const moves = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: tabs.length - 1 };
      if (!(event.key in moves)) return;
      event.preventDefault();
      show(moves[event.key], { focus: true });
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

    // When there are more tabs than fit, the row scrolls sideways (fingers and trackpads already can). A plain mouse wheel
    // over the row moves it sideways too, and hands the scroll back to the page once the row reaches its end; a mouse can
    // also grab the row and pull it, and that drag is not a press.
    list.addEventListener('wheel', event => {
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY) || list.scrollWidth <= list.clientWidth) return;
      const room = event.deltaY > 0 ? list.scrollWidth - list.clientWidth - list.scrollLeft : list.scrollLeft;
      if (room < 1) return;
      event.preventDefault();
      list.scrollLeft += event.deltaY;
    }, { passive: false });
    let pull = null;
    let pulled = false;
    list.addEventListener('pointerdown', event => {
      pulled = false;
      pull = event.pointerType === 'mouse' && event.button === 0 && list.scrollWidth > list.clientWidth ? { x: event.clientX, left: list.scrollLeft, moved: false } : null;
    });
    list.addEventListener('pointermove', event => {
      if (!pull) return;
      const dx = event.clientX - pull.x;
      if (!pull.moved) {
        if (Math.abs(dx) < 6) return;
        pull.moved = true;
        list.setPointerCapture(event.pointerId);
        list.classList.add('is-dragging');
      }
      list.scrollLeft = pull.left - dx;
    });
    const letGo = () => {
      if (!pull) return;
      pulled = pull.moved;
      pull = null;
      list.classList.remove('is-dragging');
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

    cards.forEach(card => card.setAttribute('role', 'tabpanel'));
    root.classList.add('is-ready');
    list.hidden = false;
    show(0);
  }
})();
