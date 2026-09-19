(() => {
  if (typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) return;
  const photos = document.querySelectorAll('.game-figure img, .activity-figure img');
  if (!photos.length) return;

  const viewer = document.createElement('dialog');
  viewer.className = 'photo-viewer';
  viewer.setAttribute('aria-label', '사진 크게 보기');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'photo-viewer-close';
  close.append(document.createTextNode('닫기'));
  const closeIcon = document.createElement('img');
  closeIcon.src = './assets/icons/x.svg';
  closeIcon.alt = '';
  closeIcon.setAttribute('aria-hidden', 'true');
  close.append(closeIcon);
  const image = document.createElement('img');
  image.className = 'photo-viewer-image';
  viewer.append(close, image);
  document.body.append(viewer);

  let opener = null;
  for (const photo of photos) {
    const description = photo.closest('figure').querySelector('figcaption')?.textContent.trim() || photo.alt;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'photo-trigger';
    button.setAttribute('aria-label', `사진 크게 보기: ${description}`);
    button.setAttribute('aria-haspopup', 'dialog');
    photo.before(button);
    button.append(photo);
    const zoomLabel = document.createElement('span');
    zoomLabel.className = 'photo-trigger-label';
    const zoomIcon = document.createElement('img');
    zoomIcon.src = './assets/icons/zoom-in.svg';
    zoomIcon.alt = '';
    zoomIcon.setAttribute('aria-hidden', 'true');
    zoomLabel.append(zoomIcon, document.createTextNode('확대'));
    button.append(zoomLabel);
    button.addEventListener('click', () => {
      opener = button;
      image.src = photo.getAttribute('data-full-src') || photo.currentSrc || photo.src;
      image.alt = photo.alt;
      viewer.showModal();
      document.documentElement.classList.add('photo-viewer-open');
      close.focus({ preventScroll: true });
    });
  }

  close.addEventListener('click', () => viewer.close());
  let startedOutside = false;
  const outside = event => {
    const rect = viewer.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };
  viewer.addEventListener('pointerdown', event => { startedOutside = outside(event); });
  viewer.addEventListener('click', event => {
    if (startedOutside && outside(event)) viewer.close();
    startedOutside = false;
  });
  viewer.addEventListener('close', () => {
    document.documentElement.classList.remove('photo-viewer-open');
    image.removeAttribute('src');
    opener?.focus({ preventScroll: true });
    opener = null;
  });
})();
