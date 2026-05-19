/* =====================================================================
   DramSi · Global state, i18n, persistent storage helpers.
   ===================================================================== */
(function () {
  const STORAGE = {
    LANG: 'dramsi.lang',
    PLATFORM: 'dramsi.platform',
    LIBRARY: 'dramsi.library',
    HISTORY: 'dramsi.history',
  };

  const LANGS = [
    { code: 'id', label: 'Bahasa Indonesia', short: 'ID' },
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'pt', label: 'Português', short: 'PT' },
    { code: 'th', label: 'ภาษาไทย', short: 'TH' },
  ];

  // Mapping bahasa global ke parameter masing-masing platform.
  // Beberapa platform pakai kode "in" untuk Indonesia, sebagian "id".
  const LANG_MAP = {
    id: { goodshort: 'id', dramabite: 'id', dramanova: 'in' },
    en: { goodshort: 'en', dramabite: 'en', dramanova: 'en' },
    pt: { goodshort: 'pt', dramabite: 'pt', dramanova: 'pt' },
    th: { goodshort: 'th', dramabite: 'th', dramanova: 'th' },
  };

  const I18N = {
    id: {
      'home.trending': 'Sedang Trending',
      'home.trending_sub': 'Konten paling banyak ditonton sekarang.',
      'home.new': 'Rilis Baru',
      'home.new_sub': 'Drama segar yang baru ditambahkan.',
      'home.for_you': 'Untuk Kamu',
      'home.for_you_sub': 'Pilihan terkurasi dari semua platform.',
      'home.see_all': 'Lihat semua →',
      'discover.title': 'Jelajahi',
      'discover.sub': 'Temukan drama dari semua platform.',
      'search.hint': 'Ketik judul, atau coba: CEO, balas dendam, romansa.',
      'library.title': 'Riwayat & Favorit',
      'library.sub': 'Drama yang baru kamu tonton akan muncul di sini.',
      'library.recent': 'Baru ditonton',
      'library.favorite': 'Favorit',
      'library.empty_title': 'Belum ada riwayat.',
      'library.empty_sub': 'Mulai tonton drama pertamamu di Beranda.',
      'library.settings': 'Pengaturan',
      'library.lang_title': 'Bahasa',
      'library.lang_sub': 'Atur bahasa konten dan antarmuka.',
      'common.load_more': 'Muat Lebih Banyak',
      'common.watch_now': 'Tonton sekarang',
      'common.episodes': 'episode',
      'player.loading': 'Memuat video…',
      'player.episodes': 'Episode',
      'player.prev': 'Sebelumnya',
      'player.next': 'Berikutnya',
      'player.favorite': 'Favoritkan',
      'sheet.lang': 'Bahasa',
      'sheet.platform': 'Pilih Platform',
    },
    en: {
      'home.trending': 'Trending now',
      'home.trending_sub': 'Most watched right now.',
      'home.new': 'New releases',
      'home.new_sub': 'Fresh dramas just added.',
      'home.for_you': 'For You',
      'home.for_you_sub': 'Curated picks across platforms.',
      'home.see_all': 'See all →',
      'discover.title': 'Discover',
      'discover.sub': 'Browse dramas across all platforms.',
      'search.hint': 'Type a title or try: CEO, revenge, romance.',
      'library.title': 'History & Favorites',
      'library.sub': 'Recently watched dramas show up here.',
      'library.recent': 'Recent',
      'library.favorite': 'Favorites',
      'library.empty_title': 'Nothing here yet.',
      'library.empty_sub': 'Start watching from the home page.',
      'library.settings': 'Settings',
      'library.lang_title': 'Language',
      'library.lang_sub': 'Set content and interface language.',
      'common.load_more': 'Load more',
      'common.watch_now': 'Watch now',
      'common.episodes': 'episodes',
      'player.loading': 'Loading video…',
      'player.episodes': 'Episodes',
      'player.prev': 'Previous',
      'player.next': 'Next',
      'player.favorite': 'Favorite',
      'sheet.lang': 'Language',
      'sheet.platform': 'Choose platform',
    },
    pt: {
      'home.trending': 'Em alta',
      'home.trending_sub': 'Mais assistidos no momento.',
      'home.new': 'Novidades',
      'home.new_sub': 'Dramas recém-adicionados.',
      'home.for_you': 'Para Você',
      'home.for_you_sub': 'Seleção entre todas as plataformas.',
      'home.see_all': 'Ver tudo →',
      'discover.title': 'Descobrir',
      'discover.sub': 'Explore dramas em todas as plataformas.',
      'search.hint': 'Digite um título ou tente: CEO, vingança, romance.',
      'library.title': 'Histórico e Favoritos',
      'library.sub': 'Dramas vistos recentemente aparecem aqui.',
      'library.recent': 'Recentes',
      'library.favorite': 'Favoritos',
      'library.empty_title': 'Vazio por enquanto.',
      'library.empty_sub': 'Comece a assistir na página inicial.',
      'library.settings': 'Configurações',
      'library.lang_title': 'Idioma',
      'library.lang_sub': 'Defina o idioma de conteúdo e interface.',
      'common.load_more': 'Carregar mais',
      'common.watch_now': 'Assistir',
      'common.episodes': 'episódios',
      'player.loading': 'Carregando vídeo…',
      'player.episodes': 'Episódios',
      'player.prev': 'Anterior',
      'player.next': 'Próximo',
      'player.favorite': 'Favoritar',
      'sheet.lang': 'Idioma',
      'sheet.platform': 'Escolher plataforma',
    },
    th: {
      'home.trending': 'มาแรง',
      'home.trending_sub': 'ดูมากที่สุดตอนนี้',
      'home.new': 'มาใหม่',
      'home.new_sub': 'ละครใหม่ล่าสุด',
      'home.for_you': 'สำหรับคุณ',
      'home.for_you_sub': 'คัดเลือกจากทุกแพลตฟอร์ม',
      'home.see_all': 'ดูทั้งหมด →',
      'discover.title': 'สำรวจ',
      'discover.sub': 'ค้นหาละครจากทุกแพลตฟอร์ม',
      'search.hint': 'พิมพ์ชื่อเรื่อง หรือลอง: CEO, แก้แค้น, โรแมนติก',
      'library.title': 'ประวัติ & รายการโปรด',
      'library.sub': 'ละครที่คุณดูล่าสุดจะปรากฏที่นี่',
      'library.recent': 'ดูล่าสุด',
      'library.favorite': 'รายการโปรด',
      'library.empty_title': 'ยังไม่มีประวัติ',
      'library.empty_sub': 'เริ่มดูละครเรื่องแรกของคุณที่หน้าแรก',
      'library.settings': 'การตั้งค่า',
      'library.lang_title': 'ภาษา',
      'library.lang_sub': 'ตั้งค่าภาษาเนื้อหาและส่วนติดต่อ',
      'common.load_more': 'โหลดเพิ่ม',
      'common.watch_now': 'ดูเลย',
      'common.episodes': 'ตอน',
      'player.loading': 'กำลังโหลดวิดีโอ…',
      'player.episodes': 'ตอน',
      'player.prev': 'ก่อนหน้า',
      'player.next': 'ถัดไป',
      'player.favorite': 'ถูกใจ',
      'sheet.lang': 'ภาษา',
      'sheet.platform': 'เลือกแพลตฟอร์ม',
    },
  };

  const PLATFORMS = [
    { id: 'dramanova', label: 'DramaNova', orientation: 'horizontal' },
    { id: 'goodshort', label: 'GoodShort', orientation: 'vertical' },
    { id: 'dramabite', label: 'DramaBite', orientation: 'vertical' },
  ];

  const Store = {
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (_) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (_) {}
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch (_) {}
    },
  };

  function getLang() {
    return Store.get(STORAGE.LANG, 'id') || 'id';
  }
  function setLang(code) {
    Store.set(STORAGE.LANG, code);
    document.documentElement.lang = code;
    applyTranslations();
    document.dispatchEvent(new CustomEvent('lang:changed', { detail: code }));
  }

  function getPlatform() {
    return Store.get(STORAGE.PLATFORM, 'dramanova') || 'dramanova';
  }
  function setPlatform(id) {
    Store.set(STORAGE.PLATFORM, id);
    document.dispatchEvent(new CustomEvent('platform:changed', { detail: id }));
  }

  function langFor(platform) {
    const lang = getLang();
    return (LANG_MAP[lang] && LANG_MAP[lang][platform]) || 'id';
  }

  function t(key) {
    const lang = getLang();
    return (I18N[lang] && I18N[lang][key]) || I18N.id[key] || key;
  }

  function applyTranslations(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      el.textContent = t(key);
    });
  }

  // History (recent watches) and favorites
  function pushHistory(item) {
    const list = Store.get(STORAGE.HISTORY, []) || [];
    const filtered = list.filter((x) => !(x.id === item.id && x.platform === item.platform));
    filtered.unshift({ ...item, ts: Date.now() });
    Store.set(STORAGE.HISTORY, filtered.slice(0, 60));
  }
  function getHistory() { return Store.get(STORAGE.HISTORY, []) || []; }

  function toggleFavorite(item) {
    const list = Store.get(STORAGE.LIBRARY, []) || [];
    const idx = list.findIndex((x) => x.id === item.id && x.platform === item.platform);
    if (idx >= 0) {
      list.splice(idx, 1);
      Store.set(STORAGE.LIBRARY, list);
      return false;
    }
    list.unshift({ ...item, ts: Date.now() });
    Store.set(STORAGE.LIBRARY, list);
    return true;
  }
  function isFavorite(item) {
    const list = Store.get(STORAGE.LIBRARY, []) || [];
    return list.some((x) => x.id === item.id && x.platform === item.platform);
  }
  function getFavorites() { return Store.get(STORAGE.LIBRARY, []) || []; }

  // Init lang on load
  document.documentElement.lang = getLang();
  document.addEventListener('DOMContentLoaded', () => applyTranslations());

  window.DramSi = window.DramSi || {};
  Object.assign(window.DramSi, {
    LANGS, PLATFORMS, STORAGE,
    getLang, setLang, getPlatform, setPlatform, langFor,
    t, applyTranslations,
    pushHistory, getHistory,
    toggleFavorite, isFavorite, getFavorites,
  });
})();
