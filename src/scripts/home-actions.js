(() => {
  const top = document.querySelector('.back-to-top');
  const heading = document.getElementById('intro-title');
  if (top && heading) {
    const updateVisibility = () => { top.hidden = window.scrollY <= Math.max(400, window.innerHeight); };
    window.addEventListener('scroll', updateVisibility, { passive: true });
    window.addEventListener('resize', updateVisibility);
    window.addEventListener('pageshow', updateVisibility);
    updateVisibility();
    top.addEventListener('click', () => {
      heading.focus({ preventScroll: true });
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' });
    });
  }
})();
