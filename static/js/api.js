/**
 * DramSi · API helper.
 * Setiap method bisa dipanggil dengan langOverride; default ikut bahasa global.
 */
(function () {
  const root = window.location.origin;

  async function getJSON(path) {
    const res = await fetch(`${root}${path}`, { credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function unwrap(envelope) {
    if (!envelope || envelope.status === false) return null;
    return envelope.result || envelope;
  }

  function lang(platform, override) {
    if (override) return override;
    return (window.DramSi && window.DramSi.langFor(platform)) || 'id';
  }

  const Platforms = {
    dramanova: {
      label: 'DramaNova',
      orientation: 'horizontal',
      home: (page = 1, l) => getJSON(`/dramanova/dramas?lang=${lang('dramanova', l)}&page=${page}&size=24`),
      more: (page, l) => getJSON(`/dramanova/dramas?lang=${lang('dramanova', l)}&page=${page}&size=24`),
      search: (q, l) => getJSON(`/dramanova/search?q=${encodeURIComponent(q)}&lang=${lang('dramanova', l)}`),
      detail: (id, l) => getJSON(`/dramanova/detail?id=${id}&lang=${lang('dramanova', l)}`),
      stream: (id, ep, l) => getJSON(`/dramanova/video?id=${id}&ep=${ep}&lang=${lang('dramanova', l)}`),
    },

    goodshort: {
      label: 'GoodShort',
      orientation: 'vertical',
      home: (page = 1, l) => getJSON(`/goodshort/home?page=${page}&channel=${lang('goodshort', l)}`),
      more: (page, l) => getJSON(`/goodshort/home?page=${page}&channel=${lang('goodshort', l)}`),
      search: (q) => getJSON(`/goodshort/search?q=${encodeURIComponent(q)}`),
      detail: (id) => getJSON(`/goodshort/detail?id=${id}`),
      stream: (id, ep) => getJSON(`/goodshort/stream_fast?id=${id}&ep=${ep}&quality=720p`),
    },

    dramabite: {
      label: 'DramaBite',
      orientation: 'vertical',
      home: (page = 0, l) => getJSON(`/dramabite/foryou?lang=${lang('dramabite', l)}&page=${page}`),
      more: (page, l) => getJSON(`/dramabite/foryou?lang=${lang('dramabite', l)}&page=${page}`),
      search: (q, l) => getJSON(`/dramabite/search?q=${encodeURIComponent(q)}&lang=${lang('dramabite', l)}`),
      detail: (id, l) => getJSON(`/dramabite/detail?id=${id}&lang=${lang('dramabite', l)}`),
      stream: (id, ep, l) => getJSON(`/dramabite/episode?id=${id}&ep=${ep}&lang=${lang('dramabite', l)}`),
    },
  };

  window.DramSi = window.DramSi || {};
  Object.assign(window.DramSi, { Platforms, unwrap });
})();
