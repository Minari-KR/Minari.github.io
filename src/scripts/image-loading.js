/* Optional load fade for home photos with reserved width/height. Never hide pending images. */
(() => {
  if (typeof window.matchMedia !== 'function') return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const active = new Set();
  const cancelAnimations = () => {
    for (const animation of active) animation.cancel();
    active.clear();
  };
  motion.addEventListener?.('change', () => { if (motion.matches) cancelAnimations(); });
  window.addEventListener('pagehide', cancelAnimations);

  for (const image of document.querySelectorAll('.game-figure img, .activity-figure img')) {
    // Cached photos are already visible; do not flash them again.
    if (image.complete || typeof image.animate !== 'function') continue;
    const cleanup = () => {
      image.removeEventListener('load', reveal);
      image.removeEventListener('error', cleanup);
    };
    const reveal = () => {
      cleanup();
      if (!image.naturalWidth || motion.matches || document.visibilityState === 'hidden') return;
      try {
        const animation = image.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
        active.add(animation);
        const release = () => active.delete(animation);
        animation.addEventListener('finish', release, { once: true });
        animation.addEventListener('cancel', release, { once: true });
      } catch {
        // The normal image remains visible if animation is unavailable.
      }
    };
    image.addEventListener('load', reveal, { once: true });
    image.addEventListener('error', cleanup, { once: true });
    if (image.complete) reveal();
  }
})();
