(() => {
  const sizes = ['w390', 'w412', 'w360', 'w320'];
  const buttons = [...document.querySelectorAll('[data-size]')];
  const phone = document.getElementById('phoneA');
  const frame = document.getElementById('frameA');
  const reload = document.getElementById('reload');
  const pageSelect = document.getElementById('pageSelect');
  const frameStyles = document.getElementById('frameStyles');
  const status = document.getElementById('frameStatus');
  if (!phone || !frame || !reload || !pageSelect) return;
  const pages = new Set([...pageSelect.options].map(option => option.value));

  function updateStatus() {
    if (!status) return;
    try {
      const doc = frame.contentDocument;
      if (!doc || !doc.body || doc.URL === 'about:blank') throw new Error('Frame unavailable');
      status.textContent = `실제 표시 폭 ${doc.documentElement.clientWidth}px · PC 브라우저 미리보기입니다. 휴대폰의 글자 확대·터치·주소창은 재현하지 않습니다.`;
    } catch {
      status.textContent = '브라우저가 내부 화면 접근을 제한하여 실제 폭 확인과 스크롤바 보정을 적용하지 못했습니다.';
    }
  }

  function prepareFrame() {
    try {
      const doc = frame.contentDocument;
      if (!doc || !doc.body || doc.URL === 'about:blank' || !frameStyles) throw new Error('Frame unavailable');
      doc.documentElement.classList.add('preview-frame');
      if (!doc.getElementById('previewFrameStyles')) {
        const link = doc.createElement('link');
        link.id = 'previewFrameStyles';
        link.rel = 'stylesheet';
        link.href = frameStyles.href;
        link.addEventListener('load', updateStatus);
        link.addEventListener('error', () => {
          if (status) status.textContent = '프리뷰 스크롤바 보정 파일을 불러오지 못했습니다. 화면 폭에 차이가 있을 수 있습니다.';
        });
        doc.head.append(link);
      }
    } catch {
      // Local-file policies can deny access; leave the ordinary iframe usable.
    }
    updateStatus();
  }

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
    updateStatus();
  }

  for (const button of buttons) {
    button.addEventListener('click', () => setSize(button.dataset.size));
  }

  pageSelect.addEventListener('change', loadPage);
  reload.addEventListener('click', loadPage);
  frame.addEventListener('load', prepareFrame);
  setSize('w412');
  prepareFrame();
})();
