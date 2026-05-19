/* =====================================================================
   Watch page · player + episode picker + history + favorites + auto-next.
   ===================================================================== */
(function () {
  const D = window.DramSi;

  const params = new URLSearchParams(window.location.search);
  const platform = params.get('platform') || 'dramanova';
  const dramaId = params.get('id') || '';
  const initialEp = parseInt(params.get('ep') || '1', 10);

  const dom = {
    title: document.getElementById('dramaTitle'),
    titleMobile: document.getElementById('dramaTitleMobile'),
    epLabel: document.getElementById('epLabel'),
    epLabelMobile: document.getElementById('epLabelMobile'),
    totalLabel: document.getElementById('totalLabel'),
    platformLabel: document.getElementById('platformLabel'),
    platformLabelMobile: document.getElementById('platformLabelMobile'),
    synopsis: document.getElementById('dramaSynopsis'),
    toggleSynopsis: document.getElementById('toggleSynopsisBtn'),
    epList: document.getElementById('epList'),
    epListMobile: document.getElementById('epListMobile'),
    epCount: document.getElementById('epCount'),
    epBadgeMobile: document.getElementById('epBadgeMobile'),
    epSheetSub: document.getElementById('epSheetSub'),
    qualityRow: document.getElementById('qualityRow'),
    video: document.getElementById('video'),
    overlay: document.getElementById('playerOverlay'),
    overlayText: document.getElementById('playerOverlayText'),
    playerWrap: document.getElementById('playerWrap'),
    playerInner: document.getElementById('playerInner'),
    favBtn: document.getElementById('favoriteBtn'),
    favBtnMobile: document.getElementById('favoriteBtnMobile'),
    prevBtn: document.getElementById('prevEpBtn'),
    nextBtn: document.getElementById('nextEpBtn'),
    prevBtnMobile: document.getElementById('prevEpBtnMobile'),
    nextBtnMobile: document.getElementById('nextEpBtnMobile'),
    openEpSheetBtn: document.getElementById('openEpSheetBtn'),
    epSheet: document.getElementById('epSheet'),
    epSheetBackdrop: document.getElementById('epSheetBackdrop'),
    epSheetCloseBtn: document.getElementById('epSheetCloseBtn'),
    swipeHint: document.getElementById('swipeHint'),
  };

  const state = {
    drama: null,
    episodes: [],
    currentEp: initialEp,
    qualities: [],
    currentQuality: null,
    subtitles: [],
    hls: null,
    fallbackTimer: null,
    triedProxy: false,
    lastSrc: null,
  };

  if (!dramaId || !D.Platforms[platform]) {
    dom.title.textContent = 'Parameter tidak valid';
    dom.epLabel.textContent = 'Buka kembali dari halaman utama.';
    return;
  }

  // Adjust player aspect ratio for vertical drama
  const orientation = D.Platforms[platform].orientation;
  if (orientation === 'vertical') {
    dom.playerInner.classList.remove('aspect-video');
    dom.playerInner.classList.add('aspect-vertical', 'max-w-[420px]');
  }
  dom.platformLabel.querySelector('span').textContent = D.Platforms[platform].label;
  dom.platformLabelMobile.querySelector('span').textContent = D.Platforms[platform].label;

  // Aktifkan mode immersive di mobile (CSS akan menyembunyikan topbar + bottom nav)
  document.body.classList.add('is-watch');
  document.body.classList.add(orientation === 'vertical' ? 'is-vertical' : 'is-horizontal');
  window.addEventListener('beforeunload', () => {
    document.body.classList.remove('is-watch', 'is-vertical', 'is-horizontal');
  });

  // ── Smart back: kalau datang dari discover, "minimize" pakai history.back() ──
  const cameFromDiscover = (() => {
    if (params.get('from') === 'discover') return true;
    try {
      const ref = new URL(document.referrer || '');
      if (ref.origin === window.location.origin && ref.pathname === '/discover') return true;
    } catch (_) {}
    return false;
  })();
  const backBtn = document.getElementById('backBtnMobile');
  const backIcon = document.getElementById('backBtnIcon');
  if (backBtn) {
    if (cameFromDiscover) {
      // Ubah icon ke minimize agar visualnya match konsep "kecilkan kembali"
      if (backIcon) backIcon.setAttribute('data-lucide', 'minimize-2');
      backBtn.setAttribute('aria-label', 'Kecilkan, kembali ke jelajah');
    }
    backBtn.addEventListener('click', () => {
      if (cameFromDiscover && history.length > 1) {
        history.back();
      } else {
        window.location.href = '/';
      }
    });
  }

  // ── Helpers ────────────────────────────────────────────────────
  function showOverlay(text) {
    dom.overlay.classList.remove('hidden');
    if (text) dom.overlayText.textContent = text;
  }
  function hideOverlay() {
    dom.overlay.classList.add('hidden');
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
    } catch (_) {
      return rawUrl;
    }
  }
  function viaProxy(rawUrl) {
    return `/proxy/stream?url=${encodeURIComponent(rawUrl)}`;
  }

  function setSrc(url, type, opts = {}) {
    if (state.hls) {
      state.hls.destroy();
      state.hls = null;
    }
    if (!url) {
      showOverlay('URL video tidak tersedia.');
      return;
    }

    const video = dom.video;
    const isHls = type === 'hls' || /\.m3u8(\?|$)/i.test(url);
    const finalUrl = opts.forceProxy ? viaProxy(url) : maybeProxy(url);

    // Bersihkan track lama supaya gak menumpuk antar episode
    Array.from(video.querySelectorAll('track')).forEach((t) => t.remove());

    if (isHls) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = finalUrl;
      } else if (window.Hls && window.Hls.isSupported()) {
        const hls = new window.Hls({ enableWorker: true, lowLatencyMode: true });
        hls.loadSource(finalUrl);
        hls.attachMedia(video);
        hls.on(window.Hls.Events.ERROR, (_e, data) => {
          if (data.fatal && !opts.forceProxy) {
            setSrc(url, type, { forceProxy: true });
          }
        });
        state.hls = hls;
      } else {
        showOverlay('Browser tidak mendukung HLS.');
        return;
      }
    } else {
      video.src = finalUrl;
    }
    video.load();

    // Inject subtitle tracks (kalau ada)
    injectSubtitles();

    video.play().catch(() => {});

    state.lastSrc = { url, type };
    if (!opts.forceProxy) {
      clearTimeout(state.fallbackTimer);
      state.fallbackTimer = setTimeout(() => {
        if (video.readyState < 2) {
          console.warn('[DramSi] native playback timeout, fallback ke proxy');
          setSrc(url, type, { forceProxy: true });
        }
      }, 8000);
    }
  }

  function injectSubtitles() {
    const subs = state.subtitles || [];
    if (subs.length === 0) return;

    const video = dom.video;
    // Pilih track default: cocokkan dengan bahasa global (id), fallback ke first.
    const userLang = D.getLang ? D.getLang() : 'id';
    const langPriority = (s) => {
      const l = (s.lang || '').toLowerCase();
      // 'in' adalah ISO lama untuk Indonesia, alias 'id'
      if (userLang === 'id' && (l === 'id' || l === 'in')) return 0;
      if (l === userLang) return 0;
      if (l === 'en') return 1;
      return 2;
    };
    const sorted = [...subs].sort((a, b) => langPriority(a) - langPriority(b));

    sorted.forEach((s, idx) => {
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.label = s.label || s.lang || 'Subtitle';
      // browser native srclang harus pakai BCP47, 'in' di-normalize ke 'id'
      const sl = (s.lang || '').toLowerCase();
      track.srclang = sl === 'in' ? 'id' : sl || 'id';
      track.src = s.proxiedUrl || `/proxy/subtitle?url=${encodeURIComponent(s.url)}`;
      if (idx === 0) track.default = true;
      video.appendChild(track);
    });

    // Aktifkan track default begitu loaded + posisi subtitle yang rapi
    setTimeout(() => {
      if (video.textTracks && video.textTracks.length) {
        for (let i = 0; i < video.textTracks.length; i++) {
          const tt = video.textTracks[i];
          tt.mode = i === 0 ? 'showing' : 'disabled';
          // Begitu cue mulai aktif, geser ke posisi yang gak ketabrak controls
          tt.addEventListener('cuechange', () => {
            for (const cue of tt.activeCues || []) {
              // line=85 ≈ 85% dari atas video → cukup ruang untuk control bar
              cue.line = 85;
              cue.snapToLines = false;
              cue.position = 50;
              cue.align = 'center';
            }
          });
        }
      }
    }, 200);
  }

  function renderQualities() {
    if (!state.qualities || state.qualities.length === 0) {
      dom.qualityRow.innerHTML = '';
      return;
    }
    dom.qualityRow.innerHTML = state.qualities
      .map((q, i) => {
        const active = i === 0;
        return `<button data-idx="${i}"
          class="quality-btn rounded-lg border ${active ? 'border-transparent bg-gradient-to-br from-primary to-secondary text-white' : 'border-line bg-ink-700 text-white/65 hover:text-white'} px-3 py-1.5 text-[12px] font-semibold transition">${q.label || 'Auto'}</button>`;
      })
      .join('');
    dom.qualityRow.querySelectorAll('.quality-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        dom.qualityRow.querySelectorAll('.quality-btn').forEach((b) => {
          b.className = 'quality-btn rounded-lg border border-line bg-ink-700 text-white/65 hover:text-white px-3 py-1.5 text-[12px] font-semibold transition';
        });
        btn.className = 'quality-btn rounded-lg border border-transparent bg-gradient-to-br from-primary to-secondary text-white px-3 py-1.5 text-[12px] font-semibold transition';
        const q = state.qualities[parseInt(btn.dataset.idx, 10)];
        state.currentQuality = q;
        state.triedProxy = false;
        setSrc(q.url, q.type);
      });
    });
  }

  function epButtonHTML(ep, i) {
    const num = ep.episode || ep.number || i + 1;
    const locked = ep.locked || ep.isLocked;
    const isActive = num === state.currentEp;
    const cls = isActive
      ? 'relative aspect-square rounded-xl border border-transparent bg-gradient-to-br from-primary to-secondary text-white text-[13px] font-bold grid place-items-center shadow-glow transition active:scale-95'
      : 'relative aspect-square rounded-xl border border-line bg-ink-600 text-white/70 hover:text-white hover:border-primary/50 text-[13px] font-bold grid place-items-center transition active:scale-95';
    const lock = locked ? '<span class="absolute top-0.5 right-1 text-[9px] opacity-80">🔒</span>' : '';
    return `<button data-ep="${num}" class="${cls}">${lock}${num}</button>`;
  }

  function renderEpisodes() {
    if (!state.episodes || state.episodes.length === 0) {
      const msg = '<p class="col-span-full text-sm text-white/45">Daftar episode belum tersedia.</p>';
      dom.epList.innerHTML = msg;
      dom.epListMobile.innerHTML = msg;
      dom.epCount.textContent = '';
      if (dom.epBadgeMobile) dom.epBadgeMobile.textContent = '0';
      if (dom.epSheetSub) dom.epSheetSub.textContent = '—';
      return;
    }
    const html = state.episodes.map((ep, i) => epButtonHTML(ep, i)).join('');
    dom.epList.innerHTML = html;
    dom.epListMobile.innerHTML = html;

    const lbl = `${state.episodes.length} ${D.t('common.episodes')}`;
    dom.epCount.textContent = lbl;
    dom.totalLabel.textContent = lbl;
    if (dom.epBadgeMobile) dom.epBadgeMobile.textContent = String(state.episodes.length);
    if (dom.epSheetSub) dom.epSheetSub.textContent = `Ep ${state.currentEp} · ${lbl}`;

    const handler = (btn) => {
      const ep = parseInt(btn.dataset.ep, 10);
      if (!ep) return;
      closeEpSheet();
      if (ep === state.currentEp) return;
      gotoEp(ep);
    };
    dom.epList.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => handler(b)));
    dom.epListMobile.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => handler(b)));

    syncPrevNextDisabled();
    scrollActiveEpIntoView();
  }

  function syncPrevNextDisabled() {
    const atStart = state.currentEp <= 1;
    const atEnd = state.currentEp >= state.episodes.length;
    dom.prevBtn.disabled = atStart;
    dom.nextBtn.disabled = atEnd;
    if (dom.prevBtnMobile) dom.prevBtnMobile.disabled = atStart;
    if (dom.nextBtnMobile) dom.nextBtnMobile.disabled = atEnd;
  }

  function scrollActiveEpIntoView() {
    const sel = `[data-ep="${state.currentEp}"]`;
    [dom.epList, dom.epListMobile].forEach((c) => {
      const btn = c.querySelector(sel);
      if (btn) btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  function gotoEp(ep) {
    state.currentEp = ep;
    const url = new URL(window.location.href);
    url.searchParams.set('ep', String(ep));
    history.replaceState(null, '', url.toString());
    loadStream(ep);
    renderEpisodes();
  }

  function syncFavBtn() {
    if (!state.drama) return;
    const fav = D.isFavorite({ id: state.drama.id || dramaId, platform });
    // Desktop button (di dalam meta-block)
    const icon = dom.favBtn.querySelector('[data-lucide]');
    if (fav) {
      dom.favBtn.classList.add('bg-gradient-to-br', 'from-primary', 'to-secondary', 'text-white', 'border-transparent');
      dom.favBtn.classList.remove('bg-ink-700', 'border-line', 'text-white/85');
      if (icon) icon.classList.add('fill-current');
    } else {
      dom.favBtn.classList.remove('bg-gradient-to-br', 'from-primary', 'to-secondary', 'text-white', 'border-transparent');
      dom.favBtn.classList.add('bg-ink-700', 'border-line', 'text-white/85');
      if (icon) icon.classList.remove('fill-current');
    }
    // Mobile floating button (di overlay)
    if (dom.favBtnMobile) {
      const iconM = dom.favBtnMobile.querySelector('[data-lucide]');
      dom.favBtnMobile.classList.toggle('text-secondary', fav);
      if (iconM) iconM.classList.toggle('fill-current', fav);
    }
  }

  // ── Auto-next ─────────────────────────────────────────────────
  // Diam-diam aja: kalau video selesai dan masih ada episode setelahnya,
  // langsung lompat ke episode berikutnya tanpa overlay.
  function autoNext() {
    if (state.currentEp < state.episodes.length) {
      gotoEp(state.currentEp + 1);
    }
  }

  // ── Loaders ────────────────────────────────────────────────────
  async function loadDetail() {
    showOverlay(D.t('player.loading'));
    try {
      const res = await D.Platforms[platform].detail(dramaId);
      const data = D.unwrap(res) || {};
      const drama = data.data || data;
      state.drama = drama;
      state.episodes = drama.episodes || data.episodes || [];

      const title = drama.title || drama.bookName || 'Tanpa judul';
      dom.title.textContent = title;
      if (dom.titleMobile) dom.titleMobile.textContent = title;

      const synopsis = drama.synopsis || drama.description || '';
      dom.synopsis.textContent = synopsis;
      // Show "Selengkapnya" toggle when overflow
      requestAnimationFrame(() => {
        const el = dom.synopsis;
        if (el.scrollHeight > el.clientHeight + 2) {
          dom.toggleSynopsis.hidden = false;
          dom.toggleSynopsis.onclick = () => {
            el.classList.toggle('line-clamp-3');
            dom.toggleSynopsis.textContent = el.classList.contains('line-clamp-3') ? 'Selengkapnya' : 'Lebih sedikit';
          };
        }
      });

      renderEpisodes();
      syncFavBtn();

      D.pushHistory({
        id: drama.id || dramaId,
        platform,
        title,
        cover: drama.cover || drama.coverWap || '',
        episodes: state.episodes.length,
      });
      window.refreshIcons?.();
    } catch (e) {
      showOverlay(`Gagal load detail: ${e.message}`);
    }
  }

  async function loadStream(ep) {
    showOverlay(`${D.t('player.loading')} (Ep ${ep})`);
    dom.epLabel.textContent = `Ep ${ep}`;
    if (dom.epLabelMobile) dom.epLabelMobile.textContent = `Ep ${ep}`;
    state.triedProxy = false;
    try {
      const res = await D.Platforms[platform].stream(dramaId, ep);
      const data = D.unwrap(res) || {};
      const url = data.videoUrl || data.url;
      const ql = data.qualityList || (url ? [{ label: 'auto', url, type: 'hls' }] : []);
      state.qualities = ql;
      state.currentQuality = ql[0] || null;
      state.subtitles = data.subtitles || [];

      if (data.epTitle) {
        dom.epLabel.textContent = `Ep ${ep} · ${data.epTitle}`;
        if (dom.epLabelMobile) dom.epLabelMobile.textContent = `Ep ${ep} · ${data.epTitle}`;
      }

      // Update sub-label di sheet episode
      if (dom.epSheetSub && state.episodes.length) {
        dom.epSheetSub.textContent = `Ep ${ep} · ${state.episodes.length} ${D.t('common.episodes')}`;
      }

      renderQualities();

      if (state.currentQuality) {
        setSrc(state.currentQuality.url, state.currentQuality.type);
        hideOverlay();
      } else {
        showOverlay('Episode terkunci atau tidak tersedia.');
      }
    } catch (e) {
      showOverlay(`Gagal load video: ${e.message}`);
    }
  }

  // ── Events ─────────────────────────────────────────────────────
  dom.video.addEventListener('loadeddata', () => {
    clearTimeout(state.fallbackTimer);
    hideOverlay();
  });
  dom.video.addEventListener('error', () => {
    if (state.lastSrc && !state.triedProxy) {
      state.triedProxy = true;
      setSrc(state.lastSrc.url, state.lastSrc.type, { forceProxy: true });
    } else {
      showOverlay('Gagal memutar video.');
    }
  });
  dom.video.addEventListener('ended', autoNext);

  dom.prevBtn.addEventListener('click', () => {
    if (state.currentEp > 1) gotoEp(state.currentEp - 1);
  });
  dom.nextBtn.addEventListener('click', () => {
    if (state.currentEp < state.episodes.length) gotoEp(state.currentEp + 1);
  });
  dom.favBtn.addEventListener('click', () => {
    if (!state.drama) return;
    D.toggleFavorite({
      id: state.drama.id || dramaId,
      platform,
      title: state.drama.title || state.drama.bookName || '—',
      cover: state.drama.cover || '',
      episodes: state.episodes.length,
    });
    syncFavBtn();
  });

  // Mobile twin-buttons reuse the same handlers
  if (dom.prevBtnMobile) dom.prevBtnMobile.addEventListener('click', () => {
    if (state.currentEp > 1) gotoEp(state.currentEp - 1);
  });
  if (dom.nextBtnMobile) dom.nextBtnMobile.addEventListener('click', () => {
    if (state.currentEp < state.episodes.length) gotoEp(state.currentEp + 1);
  });
  if (dom.favBtnMobile) dom.favBtnMobile.addEventListener('click', () => {
    if (!state.drama) return;
    D.toggleFavorite({
      id: state.drama.id || dramaId,
      platform,
      title: state.drama.title || state.drama.bookName || '—',
      cover: state.drama.cover || '',
      episodes: state.episodes.length,
    });
    syncFavBtn();
  });

  // ── Bottom-sheet daftar episode (mobile) ─────────────────────
  function openEpSheet() {
    if (!dom.epSheet) return;
    dom.epSheetBackdrop.classList.remove('hidden');
    requestAnimationFrame(() => dom.epSheet.classList.add('is-open'));
    // pause overlay video sebentar supaya scroll list lancar (opsional)
    scrollActiveEpIntoView();
  }
  function closeEpSheet() {
    if (!dom.epSheet) return;
    dom.epSheet.classList.remove('is-open');
    setTimeout(() => dom.epSheetBackdrop.classList.add('hidden'), 280);
  }
  if (dom.openEpSheetBtn) dom.openEpSheetBtn.addEventListener('click', openEpSheet);
  if (dom.epSheetCloseBtn) dom.epSheetCloseBtn.addEventListener('click', closeEpSheet);
  if (dom.epSheetBackdrop) dom.epSheetBackdrop.addEventListener('click', closeEpSheet);

  // ── Swipe gesture ↑/↓ untuk ganti episode ────────────────────
  // Mendengarkan di player container supaya bisa di-swipe dari mana saja
  // (termasuk area tengah video). Tetap tidak menelan klik tombol.
  (function bindSwipe() {
    const target = dom.playerInner;
    if (!target) return;
    let sx = 0, sy = 0, st = 0, tracking = false;
    const THRESHOLD_Y = 70;   // jarak minimum vertikal
    const MAX_OFFSET_X = 60;  // toleransi horizontal
    const MAX_DURATION = 800; // ms

    target.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      // Jangan menangkap swipe yang dimulai di tombol/anchor
      if (e.target.closest('button, a')) { tracking = false; return; }
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      st = Date.now();
      tracking = true;
    }, { passive: true });

    target.addEventListener('touchend', (e) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      const dt = Date.now() - st;
      if (dt > MAX_DURATION) return;
      if (Math.abs(dx) > MAX_OFFSET_X) return;
      if (Math.abs(dy) < THRESHOLD_Y) return;

      hideSwipeHint();
      if (dy < 0) {
        // swipe up → episode berikutnya
        if (state.currentEp < state.episodes.length) gotoEp(state.currentEp + 1);
      } else {
        // swipe down → episode sebelumnya
        if (state.currentEp > 1) gotoEp(state.currentEp - 1);
      }
    }, { passive: true });
  })();

  function hideSwipeHint() {
    if (dom.swipeHint && !dom.swipeHint.classList.contains('hidden-fade')) {
      dom.swipeHint.classList.add('hidden-fade');
    }
  }

  // ── Auto-hide overlay saat playback ──────────────────────────
  // - Saat video diputar, overlay (top bar + right rail) fade out otomatis
  //   setelah idle ~2.5 detik supaya tampilannya benar-benar immersive.
  // - Tap di area video memunculkan overlay kembali; tap kedua menyembunyikannya.
  // - Saat pause / loading, overlay selalu terlihat.
  const mobileOverlay = document.getElementById('mobileOverlay');
  let hideTimer = null;
  const IDLE_MS = 2500;

  // Tap-catcher transparan: muncul di atas video saat overlay ter-hide
  // supaya tap pertama dijamin diterima oleh kita (bukan diserap controls
  // bawaan video). Ditempatkan di playerInner sebagai sibling video.
  const tapCatcher = document.createElement('div');
  tapCatcher.id = 'tapCatcher';
  tapCatcher.className = 'md:hidden hidden absolute inset-0 z-[15]';
  // Pakai inline style supaya nggak dependant pada Tailwind purge
  tapCatcher.style.background = 'transparent';
  dom.playerInner?.appendChild(tapCatcher);

  function setOverlayVisible(visible) {
    if (!mobileOverlay) return;
    mobileOverlay.classList.toggle('is-hidden', !visible);
    // Saat overlay tersembunyi, aktifkan tap-catcher untuk menangkap tap
    if (tapCatcher) {
      if (visible) tapCatcher.classList.add('hidden');
      else tapCatcher.classList.remove('hidden');
    }
  }
  function showOverlayUI() {
    setOverlayVisible(true);
    scheduleHide();
  }
  function scheduleHide() {
    clearTimeout(hideTimer);
    if (dom.video.paused || dom.video.ended) return; // jangan auto-hide saat pause
    hideTimer = setTimeout(() => setOverlayVisible(false), IDLE_MS);
  }

  // Tap di tap-catcher → munculkan overlay (tap pertama)
  tapCatcher.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    showOverlayUI();
  });
  tapCatcher.addEventListener('touchend', (e) => {
    e.stopPropagation();
    e.preventDefault();
    showOverlayUI();
  });

  // Tap pada player saat overlay TERLIHAT → sembunyikan (kalau lagi play)
  if (dom.playerInner) {
    dom.playerInner.addEventListener('click', (e) => {
      // Klik berasal dari tap-catcher sudah di-handle di atas
      if (e.target === tapCatcher) return;
      // Abaikan klik tombol/anchor di overlay
      if (e.target.closest('button, a')) return;
      // Abaikan klik di video element (controls native akan menangani)
      if (e.target === dom.video) return;
      const isHidden = mobileOverlay?.classList.contains('is-hidden');
      if (isHidden) {
        showOverlayUI();
      } else if (!dom.video.paused) {
        setOverlayVisible(false);
      }
    });
  }

  // Sinkronkan dengan event video
  dom.video.addEventListener('play', () => { showOverlayUI(); });
  dom.video.addEventListener('playing', () => { scheduleHide(); });
  dom.video.addEventListener('pause', () => { clearTimeout(hideTimer); setOverlayVisible(true); });
  dom.video.addEventListener('ended', () => { clearTimeout(hideTimer); setOverlayVisible(true); });
  dom.video.addEventListener('seeking', () => { showOverlayUI(); });
  dom.video.addEventListener('waiting', () => { setOverlayVisible(true); });

  // Saat overlay disentuh (tap tombol / hover), reset timer biar nggak hilang mendadak
  ['touchstart', 'mousemove'].forEach((evt) => {
    mobileOverlay?.addEventListener(evt, () => {
      if (mobileOverlay.classList.contains('is-hidden')) return;
      scheduleHide();
    }, { passive: true });
  });

  // Sembunyikan hint setelah beberapa detik atau saat user pertama kali tap player
  setTimeout(hideSwipeHint, 4500);
  dom.playerInner?.addEventListener('click', () => {
    setTimeout(hideSwipeHint, 1200);
  }, { once: true });

  // Keyboard shortcuts on watch page
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowRight' && (e.shiftKey || e.altKey)) {
      e.preventDefault();
      if (state.currentEp < state.episodes.length) gotoEp(state.currentEp + 1);
    } else if (e.key === 'ArrowLeft' && (e.shiftKey || e.altKey)) {
      e.preventDefault();
      if (state.currentEp > 1) gotoEp(state.currentEp - 1);
    }
  });

  // ── Init ───────────────────────────────────────────────────────
  (async function init() {
    await loadDetail();
    await loadStream(state.currentEp);
  })();
})();
