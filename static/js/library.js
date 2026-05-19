/* Library page · history & favorites from localStorage. */
(function () {
  const D = window.DramSi;
  const grid = document.getElementById('libraryGrid');
  const empty = document.getElementById('libraryEmpty');
  const chips = document.querySelectorAll('.lib-chip');
  const clearBtn = document.getElementById('clearLibBtn');

  let activeTab = 'recent';

  function chipActiveCls(active) {
    return active
      ? 'lib-chip is-active rounded-full px-4 py-1.5 text-xs font-semibold transition border bg-gradient-to-br from-primary to-secondary border-transparent text-white'
      : 'lib-chip rounded-full px-4 py-1.5 text-xs font-semibold transition border border-line bg-ink-700 text-white/65 hover:text-white';
  }

  function syncChips() {
    chips.forEach((c) => {
      c.className = chipActiveCls(c.dataset.tab === activeTab);
    });
  }

  function load() {
    const items = activeTab === 'favorite' ? D.getFavorites() : D.getHistory();
    if (!items.length) {
      grid.innerHTML = '';
      empty.hidden = false;
      window.refreshIcons?.();
      return;
    }
    empty.hidden = true;
    grid.innerHTML = items.map((it) => D.buildPoster(it, it.platform || 'dramanova')).join('');
    window.refreshIcons?.();
  }

  chips.forEach((c) => {
    c.addEventListener('click', () => {
      activeTab = c.dataset.tab;
      syncChips();
      load();
    });
  });

  clearBtn?.addEventListener('click', () => {
    if (!confirm('Hapus semua data ini?')) return;
    if (activeTab === 'favorite') localStorage.removeItem(D.STORAGE.LIBRARY);
    else localStorage.removeItem(D.STORAGE.HISTORY);
    load();
  });

  syncChips();
  load();

  // ── Pengaturan: Language switcher ───────────────────────────
  const setLangBtn = document.getElementById('setLangBtn');
  const setLangValue = document.getElementById('setLangValue');

  function syncLangValue() {
    if (!setLangValue) return;
    const cur = D.LANGS.find((l) => l.code === D.getLang()) || D.LANGS[0];
    setLangValue.textContent = cur.short;
  }
  syncLangValue();
  document.addEventListener('lang:changed', syncLangValue);

  setLangBtn?.addEventListener('click', () => {
    D.openSheet({
      title: D.t('sheet.lang'),
      current: D.getLang(),
      items: D.LANGS.map((l) => ({ value: l.code, label: l.label, sub: l.short })),
      onPick: (code) => D.setLang(code),
    });
  });
})();
