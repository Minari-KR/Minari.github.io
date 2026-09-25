(() => {
  const top = document.querySelector('.back-to-top');
  const heading = document.getElementById('intro-title');
  if (!top || !heading) return;

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let state = top.hidden ? 'hidden' : 'visible';
  let appearanceFrame;
  let dismissTimer;
  const shouldShow = () => window.scrollY > Math.max(400, window.innerHeight);
  const cancelAppearance = () => {
    if (appearanceFrame !== undefined) window.cancelAnimationFrame(appearanceFrame);
    appearanceFrame = undefined;
    top.classList.remove('is-appearing');
  };
  const cancelDismissal = () => {
    if (dismissTimer !== undefined) window.clearTimeout(dismissTimer);
    dismissTimer = undefined;
    top.classList.remove('is-dismissing');
  };
  const finishHide = () => {
    if (state !== 'dismissing' || shouldShow()) return;
    cancelDismissal();
    top.hidden = true;
    state = 'hidden';
  };
  const fadeDuration = () => {
    const duration = window.getComputedStyle(top).transitionDuration.split(',')[0].trim();
    const value = Number.parseFloat(duration);
    return Number.isFinite(value) ? value * (duration.endsWith('ms') ? 1 : 1000) : 0;
  };
  const show = () => {
    if (state === 'visible' || state === 'appearing') return;
    const wasHidden = state === 'hidden';
    cancelDismissal();
    if (motion.matches) {
      top.hidden = false;
      state = 'visible';
      return;
    }
    if (wasHidden) {
      top.classList.add('is-appearing');
      top.hidden = false;
    }
    state = 'appearing';
    appearanceFrame = window.requestAnimationFrame(() => {
      appearanceFrame = window.requestAnimationFrame(() => {
        top.classList.remove('is-appearing');
        appearanceFrame = undefined;
        state = 'visible';
      });
    });
  };
  const hide = () => {
    if (state === 'hidden' || state === 'dismissing') return;
    cancelAppearance();
    if (motion.matches) {
      top.hidden = true;
      state = 'hidden';
      return;
    }
    top.classList.add('is-dismissing');
    state = 'dismissing';
    const duration = fadeDuration();
    if (!duration) finishHide();
    else dismissTimer = window.setTimeout(finishHide, duration + 50);
  };
  const updateVisibility = () => {
    if (shouldShow()) show();
    else hide();
  };
  top.addEventListener('transitionend', event => {
    if (event.target === top && event.propertyName === 'opacity') finishHide();
  });
  window.addEventListener('scroll', updateVisibility, { passive: true });
  window.addEventListener('resize', updateVisibility);
  window.addEventListener('pageshow', updateVisibility);
  window.addEventListener('pagehide', () => {
    cancelAppearance();
    cancelDismissal();
    top.hidden = !shouldShow();
    state = top.hidden ? 'hidden' : 'visible';
  });
  if (motion.addEventListener) motion.addEventListener('change', () => {
    if (motion.matches) {
      cancelAppearance();
      cancelDismissal();
      top.hidden = !shouldShow();
      state = top.hidden ? 'hidden' : 'visible';
    } else updateVisibility();
  });
  updateVisibility();
  top.addEventListener('click', () => {
    heading.focus({ preventScroll: true });
    if (motion.matches) {
      top.hidden = true;
      state = 'hidden';
    }
    window.scrollTo({ top: 0, behavior: motion.matches ? 'instant' : 'smooth' });
  });
})();
