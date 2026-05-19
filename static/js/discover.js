/* =====================================================================
   Discover page · TikTok-style vertical feed (mobile) + grid (desktop).
   - Tiap item: 1 drama, autoplay episode 1 (muted), tap = play/pause,
     tap "fullscreen" → ke /watch.
   - Scroll/swipe vertikal untuk drama berikutnya.
   - Hanya video yang aktif (terlihat) yang di-play.
   ===================================================================== */
(function () {
  const D = window.DramSi;

  // ── Desktop bits (tetap pakai grid lama) ───────────────────────
  const tabsEl = document.getElementById('platformTabs');
  const grid = document.getElementById('discoverGrid');
  const loadMoreBtn = document.getElementById('loadMoreBtn');

  const desktop = { platform: D.getPlatform(), page: 1, items: [] };

  async function loadDesktop(reset = true) {
    if (!grid) return;
    if (reset) {
      desktop.page = 1;
      desktop.items = [];
      grid.innerHTML = D.buildSkeletons(12);
    }
    try {
      const res = await D.Platforms[desktop.platform].home(desktop.page);
      const data = D.unwrap(res) || {};
      const items = data.items
        || (data.sections ? data.sections.flatMap((s) => s.items || s.books || []) : []);
      desktop.items = reset ? items : [...desktop.items, ...items];
      if (desktop.items.length === 0) {
        grid.innerHTML = '<div class="col-span-full py-12 text-center text-sm text-white/45">Tidak ada hasil.</div>';
      } else {
        grid.innerHTML = desktop.items.map((it) => D.buildPoster(it, desktop.platform)).join('');
        window.refreshIcons?.();
      }
      if (loadMoreBtn) loadMoreBtn.hidden = items.length < 6;
    } catch (e) {
      grid.innerHTML = `<div class="col-span-full py-12 text-center text-sm text-white/45">Gagal memuat: ${e.message}</div>`;
    }
  }

  if (tabsEl) {
    D.renderPlatformTabs(tabsEl, (id) => {
      desktop.platform = id;
      loadDesktop(true);
    });
    if (loadMoreBtn) loadMoreBtn.addEventListener('click', () => {
      desktop.page += 1;
      loadDesktop(false);
    });
  }

  // ── Mobile TikTok-style feed ─────────────────────────────────
  const feed = document.getElementById('discoverFeed');
  const feedTrack = document.getElementById('feedTrack');
  const feedPlatformBtn = document.getElementById('feedPlatformBtn');
  const feedPlatformLabel = document.getElementById('feedPlatformLabel');

  const isMobile = () => window.matchMedia('(max-width: 767.98px)').matches;

  if (!feed || !feedTrack) {
    // Hanya jalankan grid desktop kalau elemen feed tidak ada
    loadDesktop(true);
    document.addEventListener('lang:changed', () => loadDesktop(true));
    document.addEventListener('platform:changed', (e) => {
      desktop.platform = e.detail;
      loadDesktop(true);
    });
    return;
  }

  // Aktifkan mode immersive feed di mobile
  if (isMobile()) document.body.classList.add('is-discover-feed');
  window.addEventListener('beforeunload', () => {
    document.body.classList.remove('is-discover-feed');
  });

  const feedState = {
    platform: D.getPlatform(),
    page: 1,
    items: [],            // metadata drama
    loadedStreams: {},    // dramaId+ep → stream payload (videoUrl, qualities, ...)
    streamMeta: {},       // dramaId → {totalEps, lastEp}
    activeIdx: -1,
    perItemEp: {},        // idx → episode yang sedang diputar di preview
    hlsByEl: new WeakMap(),
    isLoadingMore: false,
    hasMore: true,
    audioOn: false,       // global: muted vs unmuted
  };

  const SESSION_KEY = 'dramsi.discover.session';
  function saveSession() {
    try {
      const data = {
        platform: feedState.platform,
        activeIdx: feedState.activeIdx,
        ids: feedState.items.map((x) => x.id),
        // Simpan posisi & episode video aktif supaya bisa resume
        perItemEp: feedState.perItemEp,
        currentTime: (() => {
          const el = feedTrack.querySelector('.feed-item.is-active');
          const v = el?.querySelector('.feed-video');
          return v && !v.paused && v.currentTime > 0.5 ? v.currentTime : 0;
        })(),
        audioOn: feedState.audioOn,
        ts: Date.now(),
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch (_) {}
  }
  function readSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      // Expired setelah 30 menit
      if (Date.now() - (data.ts || 0) > 30 * 60 * 1000) return null;
      return data;
    } catch (_) { return null; }
  }
  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
  }

  // Simpan posisi sebelum navigate ke /watch (atau apapun)
  window.addEventListener('pagehide', saveSession);
  window.addEventListener('beforeunload', saveSession);

  function platformLabel(id) {
    return (D.Platforms?.[id]?.label) || id;
  }
  function syncPlatformLabel() {
    feedPlatformLabel.textContent = platformLabel(feedState.platform);
  }
  syncPlatformLabel();

  feedPlatformBtn.addEventListener('click', () => {
    D.openSheet({
      title: D.t('sheet.platform'),
      current: feedState.platform,
      items: D.PLATFORMS.map((p) => ({ value: p.id, label: p.label })),
      onPick: (id) => {
        if (id === feedState.platform) return;
        feedState.platform = id;
        D.setPlatform(id);
        syncPlatformLabel();
        resetFeed();
      },
    });
  });

  document.addEventListener('lang:changed', () => resetFeed());
  document.addEventListener('platform:changed', (e) => {
    if (e.detail !== feedState.platform) {
      feedState.platform = e.detail;
      syncPlatformLabel();
      resetFeed();
    }
  });

  function resetFeed(opts = {}) {
    cleanupAllVideos();
    feedTrack.innerHTML = '';
    feedState.items = [];
    feedState.loadedStreams = {};
    feedState.streamMeta = {};
    feedState.perItemEp = {};
    feedState.page = 1;
    feedState.activeIdx = -1;
    feedState.hasMore = true;
    showFeedSpinner(true);
    loadMore(true, opts);
  }

  function showFeedSpinner(visible) {
    if (visible && !feedTrack.querySelector('.feed-spinner-global')) {
      feedTrack.insertAdjacentHTML('beforeend', `
        <div class="feed-spinner-global pointer-events-none fixed inset-0 z-30 grid place-items-center">
          <div class="h-10 w-10 rounded-full border-[3px] border-white/15 border-t-primary animate-spin-slow"></div>
        </div>`);
    } else if (!visible) {
      feedTrack.querySelector('.feed-spinner-global')?.remove();
    }
  }

  function buildItemHtml(item, idx) {
    const platform = feedState.platform;
    const orientation = D.Platforms[platform]?.orientation || 'horizontal';
    const cover = item.cover || item.image || D.placeholderImg(item.title);
    const title = item.title || item.bookName || 'Tanpa judul';
    const eps = item.episodes || item.chapterCount || item.totalEpisodes || 0;
    const synopsis = (item.synopsis || item.introduction || '').slice(0, 140);
    const dramaId = encodeURIComponent(item.id);

    return `
      <article class="feed-item is-${orientation} is-loading" data-idx="${idx}" data-id="${item.id}">
        <!-- Background blur cover (untuk drama horizontal yang ada letterbox) -->
        <div class="feed-media" style="background-image:url('${cover}'); filter: blur(28px) brightness(0.5); transform: scale(1.1);"></div>

        <!-- Cover poster sebagai placeholder sebelum video ready -->
        <img class="feed-poster absolute inset-0 m-auto max-h-full max-w-full object-cover" src="${cover}" alt="${title}" />

        <!-- Video element (diisi via JS saat aktif) -->
        <video class="feed-video hidden" playsinline preload="none"></video>

        <div class="feed-bottom-grad"></div>

        <!-- Tap indicator (saat paused) -->
        <div class="feed-tap-indicator">
          <div class="grid h-20 w-20 place-items-center rounded-full bg-black/55 backdrop-blur">
            <i data-lucide="play" class="h-10 w-10 text-white fill-current"></i>
          </div>
        </div>

        <!-- Spinner -->
        <div class="feed-spinner">
          <div class="h-10 w-10 rounded-full border-[3px] border-white/15 border-t-primary animate-spin-slow"></div>
        </div>

        <!-- Info kiri-bawah -->
        <div class="absolute inset-x-0 bottom-0 z-10 px-4 pb-4">
          <span class="inline-flex items-center gap-1 rounded-full border border-primary/55 bg-primary/25 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-primary-soft backdrop-blur">
            <i data-lucide="layers" class="h-3 w-3"></i>${platformLabel(platform)}
          </span>
          <h3 class="mt-2 font-display text-[19px] font-extrabold leading-tight tracking-tight line-clamp-2 drop-shadow">${title}</h3>
          <p class="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-white/75">
            <span class="feed-ep-label">Ep 1</span>
            ${eps ? `<span class="text-white/40">·</span><span>${eps} ep</span>` : ''}
          </p>
          ${synopsis ? `<p class="mt-1.5 text-[12.5px] leading-relaxed text-white/80 line-clamp-2 drop-shadow">${synopsis}</p>` : ''}
        </div>

        <!-- Right rail action -->
        <div class="absolute right-3 bottom-4 z-10 flex flex-col items-center gap-3">          <button class="feed-fav grid h-11 w-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur border border-white/10 active:scale-90 transition" aria-label="Favoritkan">
            <i data-lucide="heart" class="h-5 w-5"></i>
          </button>
          <button class="feed-audio grid h-11 w-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur border border-white/10 active:scale-90 transition" aria-label="Suara">
            <i data-lucide="volume-x" class="h-5 w-5"></i>
          </button>
          <a class="feed-watch grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary text-white shadow-glow active:scale-90 transition"
             href="/watch?platform=${platform}&id=${dramaId}&from=discover&ep=1" aria-label="Buka layar penuh">
            <i data-lucide="maximize-2" class="h-5 w-5"></i>
          </a>
          ${eps ? `<div class="grid h-11 w-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur border border-white/10">
            <div class="flex flex-col items-center -space-y-0.5">
              <i data-lucide="list-video" class="h-4 w-4"></i>
              <span class="text-[10px] font-extrabold">${eps}</span>
            </div>
          </div>` : ''}
        </div>
      </article>
    `;
  }

  async function loadMore(initial = false, opts = {}) {
    if (feedState.isLoadingMore || !feedState.hasMore) return;
    feedState.isLoadingMore = true;
    try {
      const res = await D.Platforms[feedState.platform].home(feedState.page);
      const data = D.unwrap(res) || {};
      let items = data.items
        || (data.sections ? data.sections.flatMap((s) => s.items || s.books || []) : []);

      // Bersihkan duplikat dan filter yang punya id
      items = items.filter((it) => it && it.id != null);
      const existingIds = new Set(feedState.items.map((x) => String(x.id)));
      items = items.filter((it) => !existingIds.has(String(it.id)));

      if (items.length === 0) {
        feedState.hasMore = false;
        return;
      }

      const startIdx = feedState.items.length;
      feedState.items = feedState.items.concat(items);

      const html = items.map((it, i) => buildItemHtml(it, startIdx + i)).join('');
      feedTrack.insertAdjacentHTML('beforeend', html);
      window.refreshIcons?.();

      // Pasang observer ke item baru
      const newEls = feedTrack.querySelectorAll('.feed-item');
      newEls.forEach((el, i) => {
        if (i < startIdx) return;
        observeItem(el);
        bindItemEvents(el);
      });

      feedState.page += 1;
      if (initial && newEls.length > 0) {
        // Cek session: kalau ada activeIdx tersimpan dan ada di list, scroll ke sana
        const targetIdx = opts.restoreIdx;
        if (typeof targetIdx === 'number' && targetIdx >= 0 && newEls[targetIdx]) {
          // Scroll tanpa animasi (instant restore)
          newEls[targetIdx].scrollIntoView({ behavior: 'auto', block: 'start' });
          // activate akan dipicu oleh observer; trigger manual juga sebagai jaminan
          setTimeout(() => activateItem(newEls[targetIdx]), 80);
        } else {
          setTimeout(() => activateItem(newEls[0]), 50);
        }
      }
    } catch (e) {
      console.warn('[discover] loadMore error', e);
    } finally {
      feedState.isLoadingMore = false;
      showFeedSpinner(false);
    }
  }

  // ── IntersectionObserver: hanya video yang dominan terlihat yang play ──
  let observer = null;
  function observeItem(el) {
    if (!observer) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.intersectionRatio >= 0.7) {
            activateItem(entry.target);
          }
        });
      }, { threshold: [0, 0.3, 0.7, 1], root: feedTrack });
    }
    observer.observe(el);
  }

  async function activateItem(el) {
    const idx = parseInt(el.dataset.idx, 10);
    if (idx === feedState.activeIdx) return;

    // Jeda video sebelumnya
    const prev = feedTrack.querySelector('.feed-item.is-active');
    if (prev) {
      prev.classList.remove('is-active');
      const prevVid = prev.querySelector('.feed-video');
      pauseAndDetach(prevVid, prev);
    }

    el.classList.add('is-active');
    feedState.activeIdx = idx;

    // Load stream dan play
    const drama = feedState.items[idx];
    if (!drama) return;
    const ep = feedState.perItemEp[idx] || 1;
    feedState.perItemEp[idx] = ep;
    updateEpLabel(el, ep);
    await playStreamFor(el, drama, ep);

    // Prefetch next 1 item supaya transisi mulus
    const next = feedState.items[idx + 1];
    if (next) prefetchStream(next);

    // Lazy load lebih banyak saat mendekati akhir
    if (idx >= feedState.items.length - 3) loadMore();
  }

  function updateEpLabel(el, ep) {
    const lbl = el.querySelector('.feed-ep-label');
    if (lbl) lbl.textContent = `Ep ${ep}`;
    // Update juga link maximize biar continue dari ep yang sedang preview
    const watchLink = el.querySelector('.feed-watch');
    if (watchLink) {
      const id = el.dataset.id;
      watchLink.href = `/watch?platform=${feedState.platform}&id=${encodeURIComponent(id)}&from=discover&ep=${ep}`;
    }
  }

  async function getStream(drama, ep = 1) {
    const key = `${feedState.platform}:${drama.id}:${ep}`;
    if (feedState.loadedStreams[key]) return feedState.loadedStreams[key];
    try {
      const res = await D.Platforms[feedState.platform].stream(drama.id, ep);
      const data = D.unwrap(res) || {};
      const url = data.videoUrl || data.url;
      const quality = (data.qualityList && data.qualityList[0]) || (url ? { url, type: 'hls' } : null);
      const payload = quality ? { ...quality } : null;
      feedState.loadedStreams[key] = payload;
      // Simpan info totalEps biar tahu kapan harus berhenti auto-next
      if (data.totalEps) {
        feedState.streamMeta[drama.id] = feedState.streamMeta[drama.id] || {};
        feedState.streamMeta[drama.id].totalEps = data.totalEps;
      }
      return payload;
    } catch (_) {
      feedState.loadedStreams[key] = null;
      return null;
    }
  }

  function prefetchStream(drama, ep = 1) {
    const key = `${feedState.platform}:${drama.id}:${ep}`;
    if (feedState.loadedStreams[key] !== undefined) return;
    feedState.loadedStreams[key] = null; // claim slot
    D.Platforms[feedState.platform].stream(drama.id, ep)
      .then((res) => {
        const data = D.unwrap(res) || {};
        const url = data.videoUrl || data.url;
        const quality = (data.qualityList && data.qualityList[0]) || (url ? { url, type: 'hls' } : null);
        feedState.loadedStreams[key] = quality ? { ...quality } : null;
        if (data.totalEps) {
          feedState.streamMeta[drama.id] = feedState.streamMeta[drama.id] || {};
          feedState.streamMeta[drama.id].totalEps = data.totalEps;
        }
      })
      .catch(() => {});
  }

  function maybeProxy(rawUrl) {
    if (!rawUrl) return rawUrl;
    try {
      const u = new URL(rawUrl, window.location.href);
      const pageHttps = window.location.protocol === 'https:';
      if (pageHttps && u.protocol === 'http:') {
        return `/proxy/stream?url=${encodeURIComponent(rawUrl)}`;
      }
      return rawUrl;
    } catch (_) { return rawUrl; }
  }
  function viaProxy(rawUrl) {
    return `/proxy/stream?url=${encodeURIComponent(rawUrl)}`;
  }

  async function playStreamFor(el, drama, ep = 1) {
    const video = el.querySelector('.feed-video');
    const poster = el.querySelector('.feed-poster');
    if (!video) return;

    el.classList.add('is-loading');
    el.classList.remove('is-paused');

    const quality = await getStream(drama, ep);
    if (!quality || !quality.url) {
      el.classList.remove('is-loading');
      el.classList.add('is-paused'); // tampilkan tap-to-play hint juga
      return;
    }

    // Track upaya supaya bisa retry sekali via proxy kalau gagal
    let triedProxy = false;
    const rawUrl = quality.url;
    const startWith = (forceProxy) => {
      const url = forceProxy ? viaProxy(rawUrl) : maybeProxy(rawUrl);
      bootStream(el, video, poster, url, quality.type, drama, ep, () => {
        if (!triedProxy) {
          triedProxy = true;
          startWith(true);
        } else {
          el.classList.remove('is-loading');
          el.classList.add('is-paused');
        }
      });
    };
    startWith(false);
  }

  function bootStream(el, video, poster, url, type, drama, ep, onFail) {
    const isHls = type === 'hls' || /\.m3u8(\?|$)/i.test(url);

    cleanupVideo(video, el);
    // Audio: ikuti state global; kalau audioOn=true tetap muted dulu, di-unmute
    // setelah `play()` resolve agar autoplay tidak diblokir.
    video.muted = true;
    video.loop = false; // jangan loop—biar bisa auto-next ke ep berikutnya
    video.playsInline = true;
    video.controls = false;
    video.preload = 'auto';

    let failed = false;
    let timer = null;
    const fail = () => {
      if (failed) return;
      failed = true;
      clearTimeout(timer);
      try { onFail?.(); } catch (_) {}
    };

    const onReady = () => {
      if (failed) return;
      clearTimeout(timer);
      el.classList.remove('is-loading');
      if (poster) poster.classList.add('hidden');
      video.classList.remove('hidden');
      const playPromise = video.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(() => {
          // Setelah berhasil play (autoplay diizinkan), terapkan state audio
          if (feedState.audioOn) {
            try { video.muted = false; video.volume = 1.0; } catch (_) {}
          }
        }).catch(() => {
          if (poster) poster.classList.remove('hidden');
          video.classList.add('hidden');
          el.classList.add('is-paused');
        });
      }
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
    };
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('canplay', onReady);

    const onErr = () => fail();
    video.addEventListener('error', onErr);

    // Auto-next saat episode preview habis
    const onEnded = () => {
      const idx = parseInt(el.dataset.idx, 10);
      const totalEps = (feedState.streamMeta[drama.id]?.totalEps)
        || drama.episodes || drama.chapterCount || drama.totalEps || 0;
      const nextEp = ep + 1;
      if (totalEps && nextEp <= totalEps) {
        feedState.perItemEp[idx] = nextEp;
        updateEpLabel(el, nextEp);
        playStreamFor(el, drama, nextEp);
      } else {
        // Sudah ep terakhir → kembali ke ep 1
        feedState.perItemEp[idx] = 1;
        updateEpLabel(el, 1);
        playStreamFor(el, drama, 1);
      }
    };
    video.addEventListener('ended', onEnded);

    if (isHls) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
      } else if (window.Hls && window.Hls.isSupported()) {
        const hls = new window.Hls({ enableWorker: true, lowLatencyMode: true });
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(window.Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) fail();
        });
        feedState.hlsByEl.set(el, hls);
      } else {
        fail();
        return;
      }
    } else {
      video.src = url;
    }

    timer = setTimeout(() => {
      if (video.readyState < 2) fail();
    }, 9000);
  }

  function cleanupVideo(video, el) {
    if (!video) return;
    video.pause();
    const hls = feedState.hlsByEl.get(el);
    if (hls) {
      try { hls.destroy(); } catch (_) {}
      feedState.hlsByEl.delete(el);
    }
    video.removeAttribute('src');
    try { video.load(); } catch (_) {}
  }

  function pauseAndDetach(video, el) {
    cleanupVideo(video, el);
    if (!el) return;
    const poster = el.querySelector('.feed-poster');
    el.classList.remove('is-loading', 'is-paused');
    video?.classList.add('hidden');
    if (poster) poster.classList.remove('hidden');
  }

  function cleanupAllVideos() {
    feedTrack.querySelectorAll('.feed-item').forEach((el) => {
      const video = el.querySelector('.feed-video');
      pauseAndDetach(video, el);
    });
    if (observer) {
      try { observer.disconnect(); } catch (_) {}
      observer = null;
    }
  }

  function bindItemEvents(el) {
    const video = el.querySelector('.feed-video');
    const drama = feedState.items[parseInt(el.dataset.idx, 10)];

    // Tap di area video → play/pause (atau coba play kalau belum)
    el.addEventListener('click', (e) => {
      // Jangan ganggu klik tombol/anchor di rail kanan
      if (e.target.closest('button, a')) return;
      if (!video) return;
      if (video.classList.contains('hidden')) {
        // Belum jalan (autoplay diblokir / belum siap) → user gesture, coba play
        if (video.src) {
          const poster = el.querySelector('.feed-poster');
          video.play().then(() => {
            video.classList.remove('hidden');
            poster?.classList.add('hidden');
            el.classList.remove('is-paused');
          }).catch(() => {/* tetap diam */});
        } else {
          // Belum di-boot → trigger ulang
          const drama = feedState.items[parseInt(el.dataset.idx, 10)];
          if (drama) playStreamFor(el, drama);
        }
        return;
      }
      if (video.paused) {
        video.play().catch(() => {});
        el.classList.remove('is-paused');
      } else {
        video.pause();
        el.classList.add('is-paused');
      }
    });

    // Double-tap → favorite (TikTok-like)
    let lastTap = 0;
    el.addEventListener('touchend', (e) => {
      if (e.target.closest('button, a')) return;
      const now = Date.now();
      if (now - lastTap < 300) {
        triggerFavorite(el, drama);
      }
      lastTap = now;
    });

    // Tombol favorite di rail
    el.querySelector('.feed-fav')?.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerFavorite(el, drama);
    });

    // Tombol audio (mute/unmute) di rail
    el.querySelector('.feed-audio')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleAudio();
    });

    // Sinkronkan ikon
    syncFavIcon(el, drama);
    syncAudioIcon(el);
  }

  function toggleAudio() {
    feedState.audioOn = !feedState.audioOn;
    // Terapkan ke video aktif
    const activeEl = feedTrack.querySelector('.feed-item.is-active');
    const video = activeEl?.querySelector('.feed-video');
    if (video) {
      try {
        video.muted = !feedState.audioOn;
        if (feedState.audioOn) video.volume = 1.0;
        // Pastikan tetap play setelah unmute (beberapa browser pause saat unmute manual)
        if (video.paused && !video.ended && video.src) {
          video.play().catch(() => {});
        }
      } catch (_) {}
    }
    // Sync icon di semua item (state global)
    feedTrack.querySelectorAll('.feed-item').forEach((it) => syncAudioIcon(it));
  }

  function syncAudioIcon(el) {
    const btn = el.querySelector('.feed-audio');
    if (!btn) return;
    const icon = btn.querySelector('[data-lucide]');
    const name = feedState.audioOn ? 'volume-2' : 'volume-x';
    if (icon) {
      icon.setAttribute('data-lucide', name);
      // Refresh hanya tombol ini supaya cepat
      window.refreshIcons?.();
    }
    btn.classList.toggle('text-primary-soft', feedState.audioOn);
    btn.setAttribute('aria-label', feedState.audioOn ? 'Matikan suara' : 'Nyalakan suara');
  }

  function syncFavIcon(el, drama) {
    if (!drama) return;
    const fav = D.isFavorite({ id: drama.id, platform: feedState.platform });
    const btn = el.querySelector('.feed-fav');
    const icon = btn?.querySelector('[data-lucide]');
    btn?.classList.toggle('text-secondary', fav);
    icon?.classList.toggle('fill-current', fav);
  }

  function triggerFavorite(el, drama) {
    if (!drama) return;
    D.toggleFavorite({
      id: drama.id,
      platform: feedState.platform,
      title: drama.title || drama.bookName || '—',
      cover: drama.cover || '',
      episodes: drama.episodes || drama.chapterCount || drama.totalEpisodes || 0,
    });
    syncFavIcon(el, drama);
  }

  // ── Init dengan kemungkinan restore dari session ────────────
  function initFeed() {
    const saved = readSession();
    if (saved && saved.platform === feedState.platform && Array.isArray(saved.ids) && saved.ids.length) {
      // Restore: paksa load page demi page sampai mencakup activeIdx
      feedState.audioOn = !!saved.audioOn;
      feedState.perItemEp = saved.perItemEp || {};
      const targetIdx = Math.min(saved.activeIdx ?? 0, saved.ids.length - 1);
      restoreFeed(saved, targetIdx);
    } else {
      resetFeed();
    }
  }

  async function restoreFeed(saved, targetIdx) {
    cleanupAllVideos();
    feedTrack.innerHTML = '';
    feedState.items = [];
    feedState.loadedStreams = {};
    feedState.streamMeta = {};
    feedState.page = 1;
    feedState.activeIdx = -1;
    feedState.hasMore = true;
    showFeedSpinner(true);

    // Muat halaman pertama dulu, terus kalau target belum ada, lanjut next
    let attempts = 0;
    while (feedState.items.length <= targetIdx && feedState.hasMore && attempts < 6) {
      attempts += 1;
      await loadMore(true, { restoreIdx: targetIdx });
      // Setelah call pertama dgn initial=true, panggil berikutnya tanpa initial
      // sampai jumlah cukup
      if (feedState.items.length > targetIdx) break;
      await loadMore(false);
    }
    showFeedSpinner(false);
  }

  // Mulai
  if (isMobile()) {
    initFeed();
  } else {
    // Desktop: pakai grid
    loadDesktop(true);
  }

  // Re-init kalau resize melewati breakpoint (jarang terjadi tapi handle)
  let lastIsMobile = isMobile();
  window.addEventListener('resize', () => {
    const cur = isMobile();
    if (cur !== lastIsMobile) {
      lastIsMobile = cur;
      if (cur) {
        document.body.classList.add('is-discover-feed');
        resetFeed();
      } else {
        document.body.classList.remove('is-discover-feed');
        cleanupAllVideos();
      }
    }
  });
})();
