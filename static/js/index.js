/* =====================================================================
   Home page · hero carousel + horizontal rails per category.
   ===================================================================== */
(function () {
  const D = window.DramSi;

  const tabsEl = document.getElementById('platformTabs');
  const heroTrack = document.getElementById('heroTrack');
  const heroDots = document.getElementById('heroDots');
  const trendingRail = document.getElementById('trendingRail');
  const newReleaseRail = document.getElementById('newReleaseRail');
  const forYouGrid = document.getElementById('forYouGrid');

  let heroTimer = null;
  let heroIndex = 0;
  let heroSlides = [];

  function buildHero(items) {
    heroSlides = items.slice(0, 5);
    if (heroSlides.length === 0) {
      heroTrack.innerHTML = '';
      heroDots.innerHTML = '';
      return;
    }

    const platform = D.getPlatform();
    const platformLabel = (D.Platforms[platform] && D.Platforms[platform].label) || platform;

    heroTrack.innerHTML = heroSlides.map((it) => {
      const cover = it.cover || it.image || it.banner || D.placeholderImg(it.title);
      const synopsis = (it.synopsis || it.introduction || '').slice(0, 100);
      const eps = it.episodes || it.chapterCount || it.totalEpisodes || '';
      const epsLabel = eps ? `${eps} ${D.t('common.episodes')}` : '';
      return `
        <a class="hero-slide relative block w-full shrink-0 aspect-[16/11] sm:aspect-[21/9] overflow-hidden"
           href="/watch?platform=${platform}&id=${encodeURIComponent(it.id)}">
          <img src="${cover}" alt="${it.title || ''}"
               onerror="this.src='${D.placeholderImg(it.title)}'"
               class="absolute inset-0 h-full w-full object-cover" />
          <div class="hero-gradient absolute inset-0"></div>
          <div class="absolute inset-x-5 bottom-5 z-[2]">
            <span class="inline-flex items-center gap-1 rounded-full border border-primary/55 bg-primary/25 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-primary-soft backdrop-blur">
              <i data-lucide="layers" class="h-3 w-3"></i>${platformLabel}
            </span>
            <h3 class="mt-2.5 line-clamp-2 max-w-[28ch] font-display text-[clamp(20px,4vw,32px)] font-extrabold leading-[1.15] tracking-tight">${it.title || ''}</h3>
            <p class="mt-1.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-white/65">
              ${epsLabel ? `<span>${epsLabel}</span><span class="h-1 w-1 rounded-full bg-white/40"></span>` : ''}
              <span class="line-clamp-1 max-w-[60ch]">${synopsis || '—'}</span>
            </p>
            <span class="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-primary to-secondary px-5 py-2 text-[13px] font-bold text-white shadow-glow">
              <i data-lucide="play" class="h-3.5 w-3.5 fill-current"></i>${D.t('common.watch_now')}
            </span>
          </div>
        </a>`;
    }).join('');

    heroDots.innerHTML = heroSlides.map((_, i) => `
      <span class="block h-1.5 rounded-full transition-all ${i === 0 ? 'w-5 bg-gradient-to-r from-primary to-secondary' : 'w-1.5 bg-white/35'}"></span>
    `).join('');

    heroIndex = 0;
    moveHero(0);
    startHeroAutoplay();
    window.refreshIcons?.();
  }

  function moveHero(idx) {
    if (heroSlides.length === 0) return;
    heroIndex = (idx + heroSlides.length) % heroSlides.length;
    heroTrack.style.transform = `translateX(-${heroIndex * 100}%)`;
    heroDots.querySelectorAll('span').forEach((d, i) => {
      const active = i === heroIndex;
      d.className = `block h-1.5 rounded-full transition-all ${active ? 'w-5 bg-gradient-to-r from-primary to-secondary' : 'w-1.5 bg-white/35'}`;
    });
  }

  function startHeroAutoplay() {
    clearInterval(heroTimer);
    heroTimer = setInterval(() => moveHero(heroIndex + 1), 5000);
  }

  ['mouseenter', 'touchstart'].forEach((e) => heroTrack.addEventListener(e, () => clearInterval(heroTimer), { passive: true }));
  ['mouseleave', 'touchend'].forEach((e) => heroTrack.addEventListener(e, startHeroAutoplay, { passive: true }));

  let touchStartX = 0;
  heroTrack.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  heroTrack.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) moveHero(heroIndex + (dx < 0 ? 1 : -1));
  }, { passive: true });

  function renderRail(container, items, platform, opts = {}) {
    if (!container) return;
    if (!items || items.length === 0) {
      container.innerHTML = '<div class="text-sm text-white/45 px-2">Belum ada data.</div>';
      return;
    }
    container.innerHTML = items.map((it, i) => D.buildPoster(it, platform, opts.ranked ? { rank: i + 1 } : {})).join('');
    window.refreshIcons?.();
  }

  function renderGrid(container, items, platform) {
    if (!container) return;
    if (!items || items.length === 0) {
      container.innerHTML = '<div class="col-span-full py-8 text-center text-sm text-white/45">Belum ada data.</div>';
      return;
    }
    container.innerHTML = items.map((it) => D.buildPoster(it, platform)).join('');
    window.refreshIcons?.();
  }

  function setRailLoading(container, count = 6) {
    if (!container) return;
    container.innerHTML = D.buildSkeletons(count);
  }

  async function loadHome(platform) {
    setRailLoading(trendingRail, 8);
    setRailLoading(newReleaseRail, 8);
    forYouGrid.innerHTML = D.buildSkeletons(12);

    try {
      const homeRes = await D.Platforms[platform].home(1);
      const data = D.unwrap(homeRes) || {};
      let items = data.items || [];

      if (data.sections && data.sections.length) {
        const allFromSections = data.sections.flatMap((s) => s.items || s.books || []);
        if (items.length === 0) items = allFromSections;
      }

      buildHero(items.slice(0, 5));
      renderRail(trendingRail, items.slice(0, 12), platform, { ranked: true });
      renderRail(newReleaseRail, items.slice(12, 24), platform);
      renderGrid(forYouGrid, items.slice(24, 60), platform);

      if (items.length < 24) {
        renderRail(newReleaseRail, items.slice(0, 12).reverse(), platform);
        renderGrid(forYouGrid, items.slice(0, 24), platform);
      }
    } catch (e) {
      [trendingRail, newReleaseRail].forEach((c) => {
        c.innerHTML = `<div class="text-sm text-white/45 px-2">Gagal memuat: ${e.message}</div>`;
      });
      forYouGrid.innerHTML = '';
    }
  }

  D.renderPlatformTabs(tabsEl, (id) => loadHome(id));
  document.addEventListener('lang:changed', () => loadHome(D.getPlatform()));
  document.addEventListener('platform:changed', (e) => loadHome(e.detail));

  loadHome(D.getPlatform());
})();
