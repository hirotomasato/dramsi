/* Discover page · paginated catalog browser. */
(function () {
  const D = window.DramSi;

  const tabsEl = document.getElementById('platformTabs');
  const grid = document.getElementById('discoverGrid');
  const filterChips = document.getElementById('filterChips');
  const loadMoreBtn = document.getElementById('loadMoreBtn');

  const FILTERS = [
    { key: 'all', label: 'Semua' },
    { key: 'free', label: 'Gratis' },
    { key: 'completed', label: 'Tamat' },
    { key: 'ongoing', label: 'Berjalan' },
  ];

  const state = { platform: D.getPlatform(), page: 1, items: [], filter: 'all' };

  function chipClasses(active) {
    return active
      ? 'rounded-full px-4 py-1.5 text-xs font-semibold border border-transparent bg-gradient-to-br from-primary to-secondary text-white transition'
      : 'rounded-full px-4 py-1.5 text-xs font-semibold border border-line bg-ink-700 text-white/65 hover:text-white transition';
  }

  function renderFilters() {
    filterChips.innerHTML = FILTERS.map(
      (f) => `<button data-filter="${f.key}" class="${chipClasses(f.key === state.filter)}">${f.label}</button>`
    ).join('');
    filterChips.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.filter = btn.dataset.filter;
        renderFilters();
        applyFilter();
      });
    });
  }

  function applyFilter() {
    const items = state.items.filter((it) => {
      if (state.filter === 'free') return !it.locked;
      if (state.filter === 'completed') return it.isCompleted === true;
      if (state.filter === 'ongoing') return it.isCompleted === false;
      return true;
    });
    if (items.length === 0) {
      grid.innerHTML = '<div class="col-span-full py-12 text-center text-sm text-white/45">Tidak ada hasil. Coba ganti filter.</div>';
      return;
    }
    grid.innerHTML = items.map((it) => D.buildPoster(it, state.platform)).join('');
    window.refreshIcons?.();
  }

  async function load(reset = true) {
    if (reset) {
      state.page = 1;
      state.items = [];
      grid.innerHTML = D.buildSkeletons(12);
    }
    try {
      const res = await D.Platforms[state.platform].home(state.page);
      const data = D.unwrap(res) || {};
      const items = data.items
        || (data.sections ? data.sections.flatMap((s) => s.items || s.books || []) : []);
      state.items = reset ? items : [...state.items, ...items];
      applyFilter();
      loadMoreBtn.hidden = items.length < 6;
    } catch (e) {
      grid.innerHTML = `<div class="col-span-full py-12 text-center text-sm text-white/45">Gagal memuat: ${e.message}</div>`;
    }
  }

  loadMoreBtn.addEventListener('click', () => {
    state.page += 1;
    load(false);
  });

  D.renderPlatformTabs(tabsEl, (id) => {
    state.platform = id;
    load(true);
  });
  document.addEventListener('lang:changed', () => load(true));
  document.addEventListener('platform:changed', (e) => {
    state.platform = e.detail;
    load(true);
  });

  renderFilters();
  load(true);
})();
