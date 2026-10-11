(() => {
  if (typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) return;
  const dialogs = new Map(Array.from(document.querySelectorAll('dialog.project-dialog[id]'), dialog => [dialog.id, dialog]));
  if (!dialogs.size) return;
  const root = document.documentElement;
  root.classList.add('has-project-dialogs');

  let current = null;
  let opener = null;
  // Runs once per opening from whichever close path happens first; the close event can be delayed in background tabs.
  const finish = dialog => {
    if (current !== dialog) return;
    current = null;
    for (const video of dialog.querySelectorAll('video')) video.pause();
    root.classList.remove('dialog-open');
    const target = opener;
    opener = null;
    target?.focus({ preventScroll: true });
  };
  const shut = dialog => {
    dialog.close();
    finish(dialog);
  };
  const open = (dialog, trigger) => {
    if (dialog.open) return;
    current = dialog;
    opener = trigger;
    dialog.showModal();
    root.classList.add('dialog-open');
    dialog.querySelector('.project-dialog-close')?.focus({ preventScroll: true });
  };

  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href^="#"]');
    const dialog = link && dialogs.get(link.getAttribute('href').slice(1));
    if (!dialog) return;
    event.preventDefault();
    open(dialog, link);
  });

  for (const dialog of dialogs.values()) {
    dialog.querySelector('.project-dialog-close')?.addEventListener('click', event => {
      event.preventDefault();
      shut(dialog);
    });
    let startedOutside = false;
    const outside = event => {
      const rect = dialog.getBoundingClientRect();
      return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    };
    dialog.addEventListener('pointerdown', event => { startedOutside = outside(event); });
    dialog.addEventListener('click', event => {
      if (startedOutside && outside(event)) shut(dialog);
      startedOutside = false;
    });
    dialog.addEventListener('cancel', () => finish(dialog));
    dialog.addEventListener('close', () => finish(dialog));
  }

  const initial = dialogs.get(window.location.hash.slice(1));
  if (initial) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    open(initial, null);
  }
})();
