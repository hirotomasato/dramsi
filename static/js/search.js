/* Search page · platform-aware search with debounce + clear button. */
(function () {
  const D = window.DramSi;

  const form = document.getElementById('searchForm');
  const input = document.getElementById('searchInput');
  const grid = document.getElementById('searchGrid');
  const hint = document.getElementById('searchHint');
  const platformBtn = document.getElementById('searchPlatformBtn');
  const clearBtn = document.getElementById('clearSearchBtn');

  const state = { platform: D.getPlatform(), keyword: '' };
  let debounceId = null;

  const urlParams = new URLSearchParams(location.search);
  if (urlParams.get('q')) input.value = urlParams.get('q');

  function syncClearBtn() {
    clearBtn.hidden = !input.value.trim();
  }

  async function doSearch(keyword) {
    syncClearBtn();
    if (!keyword || keyword.trim().length === 0) {
      grid.innerHTML = '';
      hint.style.display = '';
      return;
    }
    hint.style.display = 'none';
    state.keyword = keyword.trim();
    grid.innerHTML = D.buildSkeletons(9);
    try {
      const res = await D.Platforms[state.platform].search(state.keyword);
      const data = D.unwrap(res) || {};
      const items = data.items || [];
      if (items.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-12 text-center text-sm text-white/55">
          <div class="font-semibold text-white">Tidak ada hasil untuk "${state.keyword}".</div>
          <div class="mt-1">Coba platform lain atau ubah kata kunci.</div>
        </div>`;
      } else {
        grid.innerHTML = items.map((it) => D.buildPoster(it, state.platform)).join('');
        window.refreshIcons?.();
      }
    } catch (e) {
      grid.innerHTML = `<div class="col-span-full py-12 text-center text-sm text-white/45">Gagal mencari: ${e.message}</div>`;
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    doSearch(input.value);
  });

  input.addEventListener('input', () => {
    clearTimeout(debounceId);
    debounceId = setTimeout(() => doSearch(input.value), 450);
    syncClearBtn();
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    syncClearBtn();
    doSearch('');
    input.focus();
  });

  platformBtn.addEventListener('click', () => {
    D.showPlatformSheet((id) => {
      state.platform = id;
      doSearch(state.keyword);
    });
  });

  document.addEventListener('lang:changed', () => doSearch(state.keyword));
  document.addEventListener('platform:changed', (e) => {
    state.platform = e.detail;
    doSearch(state.keyword);
  });

  if (input.value.trim()) doSearch(input.value);
  syncClearBtn();
})();
