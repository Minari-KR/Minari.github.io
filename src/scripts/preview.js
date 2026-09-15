(() => {
  const sizes = ['w390', 'w412', 'w360', 'w320'];
  const buttons = [...document.querySelectorAll('[data-size]')];
  const phone = document.getElementById('phoneA');
  const frame = document.getElementById('frameA');
  const reload = document.getElementById('reload');
  const pageSelect = document.getElementById('pageSelect');
  if (!phone || !frame || !reload || !pageSelect) return;
  const pages = new Set([...pageSelect.options].map(option => option.value));

  function loadPage() {
    if (!pages.has(pageSelect.value)) return;
    frame.src = `${pageSelect.value}?v=${Date.now()}`;
  }

  function setSize(size) {
    if (!sizes.includes(size)) return;
    phone.classList.remove(...sizes);
    phone.classList.add(size);
    for (const button of buttons) {
      const selected = button.dataset.size === size;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
  }

  for (const button of buttons) {
    button.addEventListener('click', () => setSize(button.dataset.size));
  }

  pageSelect.addEventListener('change', loadPage);
  reload.addEventListener('click', loadPage);
  setSize('w390');
})();
