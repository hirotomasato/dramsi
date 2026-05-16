/* =====================================================================
   DramSi · Shared UI helpers (nav highlight, sheet, poster cards, tabs).
   ===================================================================== */
(function () {
  const D = window.DramSi;

  // ── Active nav highlight ────────────────────────────────────────
  function highlightNav() {
    const path = location.pathname.replace(/\/$/, '') || '/';
    document.querySelectorAll('[data-route]').forEach((el) => {
      const route = el.dataset.route;
      const active = route === path || (route !== '/' && path.startsWith(route));

      // Bottom nav items
      if (el.classList.contains('bnav-item')) {
        el.classList.toggle('text-white', active);
        el.classList.toggle('text-white/55', !active);
        // top accent bar
        let bar = el.querySelector('.nav-accent');
        if (active && !bar) {
          bar = document.createElement('span');
          bar.className = 'nav-accent absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-7 rounded-b bg-gradient-to-r from-primary to-secondary';
          el.appendChild(bar);
        } else if (!active && bar) {
          bar.remove();
        }
        const icon = el.querySelector('[data-lucide]');
        if (icon) icon.classList.toggle('text-primary-soft', active);
      } else {
        // Desktop topbar
        el.classList.toggle('bg-gradient-to-br', active);
        el.classList.toggle('from-primary', active);
        el.classList.toggle('to-secondary', active);
        el.classList.toggle('text-white', active);
        el.classList.toggle('text-white/60', !active);
      }
    });
  }

  // ── Bottom Sheet engine ─────────────────────────────────────────
  const sheet = document.getElementById('sheet');
  const backdrop = document.getElementById('sheetBackdrop');
  const sheetTitle = document.getElementById('sheetTitle');
  const sheetList = document.getElementById('sheetList');
  const sheetCloseBtn = document.getElementById('sheetCloseBtn');

  function openSheet({ title, items, current, onPick }) {
    sheetTitle.textContent = title;
    sheetList.innerHTML = items
      .map((it) => {
        const active = it.value === current;
        return `
        <button data-value="${it.value}"
                class="sheet-item flex items-center gap-3 rounded-xl border ${active ? 'border-primary/60 bg-primary/10' : 'border-transparent bg-ink-700'} px-4 py-3 text-left text-sm font-semibold text-white transition active:scale-[.98]">
          <span class="flex-1">${it.label}</span>
          ${it.sub ? `<span class="text-[11px] font-medium text-white/45">${it.sub}</span>` : ''}
          <i data-lucide="check" class="h-4 w-4 ${active ? 'text-primary-soft' : 'opacity-0'}"></i>
        </button>`;
      })
      .join('');
    sheetList.querySelectorAll('.sheet-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        onPick(btn.dataset.value);
        closeSheet();
      });
    });
    backdrop.classList.remove('hidden');
    requestAnimationFrame(() => sheet.classList.add('is-open'));
    window.refreshIcons?.();
  }

  function closeSheet() {
    sheet.classList.remove('is-open');
    setTimeout(() => backdrop.classList.add('hidden'), 280);
  }

  if (backdrop) backdrop.addEventListener('click', closeSheet);
  if (sheetCloseBtn) sheetCloseBtn.addEventListener('click', closeSheet);

  // ── Language switcher ───────────────────────────────────────────
  const langBtn = document.getElementById('langBtn');
  const langLabel = document.getElementById('langLabel');

  function syncLangLabel() {
    if (!langLabel) return;
    const cur = D.LANGS.find((l) => l.code === D.getLang()) || D.LANGS[0];
    langLabel.textContent = cur.short;
  }
  syncLangLabel();
  document.addEventListener('lang:changed', syncLangLabel);

  if (langBtn) {
    langBtn.addEventListener('click', () => {
      openSheet({
        title: D.t('sheet.lang'),
        current: D.getLang(),
        items: D.LANGS.map((l) => ({ value: l.code, label: l.label, sub: l.short })),
        onPick: (code) => D.setLang(code),
      });
    });
  }

  function showPlatformSheet(callback) {
    openSheet({
      title: D.t('sheet.platform'),
      current: D.getPlatform(),
      items: D.PLATFORMS.map((p) => ({ value: p.id, label: p.label })),
      onPick: (id) => {
        D.setPlatform(id);
        if (callback) callback(id);
      },
    });
  }

  // ── Platform tabs renderer ──────────────────────────────────────
  function renderPlatformTabs(container, onChange) {
    if (!container) return;
    container.innerHTML = D.PLATFORMS.map((p) => {
      const active = p.id === D.getPlatform();
      return `
        <button data-platform="${p.id}"
                class="ptab relative shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${active ? 'tab-active text-white' : 'text-white/55 hover:text-white'}">
          ${p.label}
        </button>`;
    }).join('');

    container.querySelectorAll('.ptab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.platform;
        D.setPlatform(id);
        container.querySelectorAll('.ptab').forEach((b) => {
          const a = b.dataset.platform === id;
          b.classList.toggle('tab-active', a);
          b.classList.toggle('text-white', a);
          b.classList.toggle('text-white/55', !a);
        });
        if (onChange) onChange(id);
      });
    });
  }

  // ── Poster builder ──────────────────────────────────────────────
  function placeholderImg(title) {
    const text = encodeURIComponent((title || 'DramSi').slice(0, 18));
    return `https://placehold.co/300x450/15172a/aab0cf?text=${text}`;
  }

  function buildPoster(item, platform, opts = {}) {
    const img = item.cover || item.image || placeholderImg(item.title);
    const eps = item.episodes || item.chapterCount || item.totalEpisodes || 0;
    const platformLabel = (D.Platforms?.[platform]?.label) || platform;

    return `
      <a class="poster group relative block snap-start"
         data-id="${item.id}" data-platform="${platform}"
         href="/watch?platform=${platform}&id=${encodeURIComponent(item.id)}">
        <div class="relative aspect-[2/3] overflow-hidden rounded-xl bg-ink-700 shadow-card transition group-hover:shadow-elev group-active:scale-[.97]">
          ${opts.rank ? `<div class="rank-text absolute -top-1 left-2 z-[2]">${opts.rank}</div>` : ''}
          <span class="absolute right-2 top-2 z-[2] rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">${platformLabel}</span>
          <img src="${img}" alt="${item.title || ''}" loading="lazy"
               onerror="this.src='${placeholderImg(item.title)}'"
               class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
          <span class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent"></span>
          ${eps ? `<span class="absolute left-2 bottom-2 z-[2] inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur">
            <i data-lucide="play" class="h-2.5 w-2.5 fill-current"></i>${eps}
          </span>` : ''}
        </div>
        <div class="px-1 pt-2">
          <h4 class="text-[13px] font-bold leading-snug line-clamp-2">${item.title || 'Tanpa judul'}</h4>
          ${item.synopsis || item.introduction ? `<p class="mt-0.5 text-[11.5px] text-white/55 line-clamp-1">${(item.synopsis || item.introduction).slice(0, 50)}</p>` : ''}
        </div>
      </a>`;
  }

  function buildSkeletons(count = 6) {
    return Array.from({ length: count }).map(() => `
      <div class="block snap-start">
        <div class="aspect-[2/3] rounded-xl skeleton"></div>
        <div class="mt-2 h-3 w-full rounded skeleton"></div>
        <div class="mt-1.5 h-2.5 w-3/5 rounded skeleton"></div>
      </div>`).join('');
  }

  // ── Init ───────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', highlightNav);

  Object.assign(D, {
    openSheet, closeSheet,
    showPlatformSheet, renderPlatformTabs,
    buildPoster, buildSkeletons, placeholderImg,
  });
})();
