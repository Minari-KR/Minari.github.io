(() => {
  const list = document.querySelector('.journal-list');
  const pagination = document.querySelector('.journal-pagination');
  if (!list || !pagination) return;
  const cards = Array.from(list.querySelectorAll('.journal-card'));
  const pageSize = 5;
  const pages = Math.ceil(cards.length / pageSize);
  if (pages <= 1) return;
  const storageKey = `minari:journal-page:${window.location.pathname.replace(/\/index\.html$/, '/')}`;
  let initialPage = 1;
  try {
    const saved = Number(window.sessionStorage.getItem(storageKey));
    if (Number.isSafeInteger(saved) && saved > 0) initialPage = Math.min(saved, pages);
  } catch { /* Pagination still works when browser storage is unavailable. */ }
  const showPage = (page) => {
    cards.forEach((card, index) => { card.hidden = index < (page - 1) * pageSize || index >= page * pageSize; });
    pagination.querySelectorAll('button').forEach((button) => {
      if (Number(button.dataset.page) === page) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    try { window.sessionStorage.setItem(storageKey, String(page)); } catch { /* Optional tab-local memory. */ }
  };
  for (let page = 1; page <= pages; page += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = String(page);
    button.dataset.page = String(page);
    button.setAttribute('aria-label', `일지 ${page}페이지`);
    button.addEventListener('click', () => showPage(page));
    pagination.append(button);
  }
  pagination.hidden = false;
  showPage(initialPage);
})();
