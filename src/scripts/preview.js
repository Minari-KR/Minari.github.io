const sizes = ["w390", "w412", "w360", "w320"];
    const buttons = [...document.querySelectorAll("[data-size]")];
    const phoneA = document.getElementById("phoneA");
    const frameA = document.getElementById("frameA");
    const reloadBtn = document.getElementById("reload");
    const pageSelect = document.getElementById("pageSelect");
    const pages = new Set([...pageSelect.options].map(option => option.value));

    function loadPage() {
      if (!pages.has(pageSelect.value)) return;
      const stamp = Date.now();
      frameA.src = `${pageSelect.value}?v=${stamp}`;
    }

    function setSize(size) {
      if (!sizes.includes(size)) return;
      phoneA.classList.remove(...sizes);
      phoneA.classList.add(size);
      buttons.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.size === size);
        btn.setAttribute('aria-pressed', String(btn.dataset.size === size));
      });
    }

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => setSize(btn.dataset.size));
    });

    pageSelect.addEventListener("change", loadPage);
    reloadBtn.addEventListener("click", loadPage);
    setSize('w390');
