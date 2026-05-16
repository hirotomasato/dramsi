<div align="center">

# DramSi

**Aggregator drama pendek lintas platform — satu UI, banyak sumber.**

Frontend modern mobile-first dengan pengalaman immersive ala DramaBox/TikTok, di-back oleh Flask yang modular dan mudah dikembangkan.

[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0-000000?logo=flask)](https://flask.palletsprojects.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CDN-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![HLS.js](https://img.shields.io/badge/HLS.js-1.5-EB5424)](https://github.com/video-dev/hls.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e)](#license)

</div>

---

## Daftar Isi

- [Ringkasan](#ringkasan)
- [Fitur](#fitur)
- [Demo & Tangkapan Layar](#demo--tangkapan-layar)
- [Arsitektur](#arsitektur)
- [Struktur Direktori](#struktur-direktori)
- [Instalasi Cepat](#instalasi-cepat)
- [Konfigurasi (.env)](#konfigurasi-env)
- [Menjalankan](#menjalankan)
- [Deployment](#deployment)
  - [Gunicorn + systemd (VPS)](#gunicorn--systemd-vps)
  - [Vercel](#vercel)
- [API Reference](#api-reference)
- [Frontend & UX](#frontend--ux)
- [Menambah Platform Baru](#menambah-platform-baru)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Kontribusi](#kontribusi)
- [License](#license)
- [Disclaimer](#disclaimer)

---

## Ringkasan

DramSi adalah single-page experience yang menyatukan beberapa platform drama pendek ke dalam satu aplikasi web yang ringan, mobile-first, dan terasa seperti aplikasi native. Backend-nya kecil (Flask + `requests`) tapi rapi: app factory, blueprint per platform, middleware terpisah, dan proxy stream/subtitle bawaan untuk menyelesaikan masalah CORS dan mixed-content.

Saat ini mendukung tiga platform:

| Platform | Orientasi | ID Internal |
|---|---|---|
| **DramaNova** | Horizontal | `dramanova` |
| **GoodShort** | Vertikal | `goodshort` |
| **DramaBite** | Vertikal | `dramabite` |

---

## Fitur

### Pengalaman Menonton

- **Mode immersive di mobile.** Begitu drama dipilih, player mengisi seluruh viewport. Topbar dan bottom nav ikut tersembunyi, jadi nuansanya benar-benar app, bukan halaman web.
- **Floating control rail** di sisi kanan player: prev episode, daftar episode (badge jumlah), next episode.
- **Swipe vertikal untuk ganti episode.** Geser ke atas → episode berikutnya, geser ke bawah → episode sebelumnya. Threshold yang tuned supaya tidak salah trigger saat scrub.
- **Auto-hide overlay saat playback.** Overlay fade out otomatis setelah idle 2.5 detik saat video berputar; tap di area video untuk memunculkan kembali. Saat pause, overlay tetap terlihat.
- **Bottom-sheet daftar episode** ala app native (slide-up dari bawah) khusus mobile.
- **Auto-next episode** saat video selesai.
- **Auto-fallback proxy.** Kalau native playback gagal atau timeout, stream otomatis dialihkan ke proxy internal `/proxy/stream`.
- **Subtitle Indonesia/English** (saat tersedia) — SRT di-convert ke WebVTT on-the-fly dengan posisi yang tidak menutupi control bar.
- **Object-fit pintar:** drama vertikal pakai `cover`, drama horizontal pakai `contain`.

### UI & Konten

- Hero carousel dengan autoplay + swipe.
- Rail "Trending" (dengan ranking), "Rilis Baru", dan grid "Untuk Kamu".
- Halaman Discover, Search, Library (riwayat + favorit) — semuanya client-side.
- Multi-bahasa UI: **ID / EN / PT / TH** dengan persistensi di localStorage.
- PWA-ready: manifest, theme color, dan ikon maskable.

### Backend

- App factory + blueprint per platform.
- HTTP client global dengan keep-alive dan connection pooling.
- Response envelope konsisten lintas endpoint.
- Generic stream proxy dengan dukungan `Range` header (untuk seek).
- Subtitle proxy SRT → WebVTT.
- HLS playlist proxy + AES key proxy untuk GoodShort.
- Security headers ringan (`X-Content-Type-Options`, `Referrer-Policy`, dll).
- CORS configurable per environment.
- Logging request sederhana (`X-Response-Time` + structured log).

---

## Demo & Tangkapan Layar

> Tambahkan screenshot/GIF kamu di folder `docs/` lalu update gambar di bawah.

| Beranda | Watch · Mobile Immersive | Bottom-sheet Episode |
|---|---|---|
| ![home](docs/home.png) | ![watch](docs/watch.png) | ![episodes](docs/episodes.png) |

---

## Arsitektur

```
                         ┌─────────────────────┐
                         │      Browser        │
                         │ (HTML + Vanilla JS) │
                         └──────────┬──────────┘
                                    │ HTTPS (JSON / HLS / WebVTT)
                                    ▼
                  ┌───────────────────────────────────┐
                  │           Flask App               │
                  │  ┌──────────────────────────────┐ │
                  │  │  Middleware                  │ │
                  │  │  CORS · Security · Errors    │ │
                  │  │  · Observability             │ │
                  │  └──────────────────────────────┘ │
                  │  ┌──────────────────────────────┐ │
                  │  │  Blueprints                  │ │
                  │  │  /goodshort · /dramabite     │ │
                  │  │  /dramanova · /proxy/*       │ │
                  │  │  / (web frontend)            │ │
                  │  └──────────────────────────────┘ │
                  │  ┌──────────────────────────────┐ │
                  │  │  Core (HttpClient · utils)   │ │
                  │  └──────────────────────────────┘ │
                  └─────────────┬─────────────────────┘
                                │ requests.Session (keep-alive)
                                ▼
                       ┌────────────────────┐
                       │  Upstream APIs &   │
                       │  CDN drama pendek  │
                       └────────────────────┘
```

---

## Struktur Direktori

```
dramsi/
├── app/
│   ├── __init__.py             # Application factory
│   ├── core/
│   │   ├── http.py             # HttpClient + global session
│   │   ├── responses.py        # Envelope JSON konsisten
│   │   └── utils.py            # Helper umum
│   ├── middleware/
│   │   ├── errors.py           # Error handler global
│   │   ├── observability.py    # Logging + X-Response-Time
│   │   └── security.py         # Security headers
│   ├── platforms/
│   │   ├── goodshort/          # service.py · routes.py · hls_proxy.py (AES key)
│   │   ├── dramabite/          # service.py · routes.py
│   │   └── dramanova/          # service.py · routes.py
│   ├── stream_proxy.py         # Generic CDN proxy (Range support)
│   ├── subtitle_proxy.py       # SRT → WebVTT
│   └── web.py                  # Frontend routes & PWA manifest
├── templates/                  # Jinja2 (base, index, watch, discover, ...)
├── static/
│   ├── css/app.css             # Tailwind extension layer
│   ├── js/                     # api · state · ui · index · discover · search · library · watch
│   └── img/                    # Favicon + PWA icons (SVG)
├── config.py                   # Environment-aware config
├── run.py                      # Dev entry (python run.py)
├── wsgi.py                     # Production entry (gunicorn / Vercel)
├── requirements.txt
├── vercel.json
└── .env.example
```

---

## Instalasi Cepat

Persyaratan: **Python 3.10+** dan `pip`.

### Linux / macOS

```bash
git clone https://github.com/hirotomasato/dramsi.git
cd dramsi
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python run.py
```

### Windows

```cmd
git clone https://github.com/hirotomasato/dramsi.git
cd dramsi
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python run.py
```

Lalu buka `http://localhost:5000`.

---

## Konfigurasi (.env)

Salin `.env.example` ke `.env` dan sesuaikan. Semua kunci bersifat opsional kecuali `FLASK_ENV` (memilih profil config) dan `PORT` (kalau mau ganti port).

| Variabel | Default | Deskripsi |
|---|---|---|
| `FLASK_ENV` | `development` | `development` atau `production` |
| `PORT` | `5000` | Port HTTP saat dijalankan via `run.py` |
| `REQUEST_TIMEOUT` | `8` | Timeout (detik) ke upstream API |
| `APP_CREATOR` | `MasantoID` | Nilai field `creator` di response envelope |
| `CORS_ORIGINS` | `https://dramacina.vip,https://www.dramacina.vip` | Origin yang diizinkan (comma-separated) di production |
| `CORS_SUPPORTS_CREDENTIALS` | `false` | Set `true` kalau frontend mengirim cookie |
| `TOKEN_MAIN` | preset | Token upstream bersama (override kalau punya sendiri) |
| `GS_BASE` / `DBT_BASE` / `DNV_BASE` | preset | Override base URL upstream per platform |

> **Catatan keamanan:** jangan commit `.env` ke git. File ini sudah diabaikan oleh `.gitignore`.

---

## Menjalankan

### Mode Development

```bash
source .venv/bin/activate
python run.py
```

Auto-reload Flask aktif saat `FLASK_ENV=development`.

### Mode Production (lokal cek)

```bash
export FLASK_ENV=production
gunicorn -w 2 -k gthread --threads 4 -b 0.0.0.0:5000 wsgi:app
```

---

## Deployment

### Gunicorn + systemd (VPS)

Buat `/etc/systemd/system/dramsi.service`:

```ini
[Unit]
Description=DramSi Gunicorn Service
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/dramsi
EnvironmentFile=/opt/dramsi/.env
ExecStart=/opt/dramsi/.venv/bin/gunicorn \
  --workers 2 --threads 4 -k gthread \
  --bind 127.0.0.1:5000 \
  --access-logfile - --error-logfile - \
  wsgi:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Aktifkan:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now dramsi.service
sudo systemctl status dramsi.service
```

Pasang reverse proxy (Nginx/Caddy) di depannya untuk TLS. Stream proxy di `/proxy/*` butuh koneksi yang bisa long-running, jadi pastikan timeout reverse proxy cukup besar (mis. 60–120 detik).

### Vercel

Sudah ada `vercel.json`. Push ke GitHub lalu import project di dashboard Vercel.

> **Limitasi Vercel:** function timeout 10 detik (Hobby) / 60 detik (Pro). Endpoint `/proxy/stream` dan playlist HLS GoodShort kurang cocok di Vercel untuk file besar. Untuk pengalaman penuh, gunakan VPS.

---

## API Reference

Semua response JSON menggunakan envelope berikut:

```json
{
  "creator": "MasantoID",
  "status": true,
  "code": 200,
  "action": "home",
  "source": "goodshort",
  "result": { "...": "..." }
}
```

### GoodShort

| Method | Path | Query |
|---|---|---|
| GET | `/goodshort/home` | `page`, `channel` (`id` / `pt` / `kr` / `th`) |
| GET | `/goodshort/search` | `q`, `page` |
| GET | `/goodshort/detail` | `id` |
| GET | `/goodshort/stream` | `id`, `ep`, `quality` |
| GET | `/goodshort/stream_fast` | `id`, `ep`, `quality` |
| GET | `/goodshort/unlock` | `id`, `quality` |
| GET | `/goodshort/playlist` | `url`, `k` (HLS proxy + AES key URI rewrite) |
| GET | `/goodshort/aeskey` | `k` (raw 16-byte AES key) |

### DramaBite

| Method | Path | Query |
|---|---|---|
| GET | `/dramabite/dramas` | `lang`, `page` |
| GET | `/dramabite/foryou` | `lang`, `page` |
| GET | `/dramabite/hot` | `lang` |
| GET | `/dramabite/recommend` | `lang`, `page` |
| GET | `/dramabite/search` | `q`, `lang`, `limit` |
| GET | `/dramabite/detail` | `id`, `lang` |
| GET | `/dramabite/likes` | `id`, `lang` |
| GET | `/dramabite/episode` | `id`, `ep`, `lang`, `quality` |

### DramaNova

| Method | Path | Query |
|---|---|---|
| GET | `/dramanova/dramas` | `lang`, `page`, `size` |
| GET | `/dramanova/detail` | `id`, `lang` |
| GET | `/dramanova/video` | `id`, `ep`, `lang` |
| GET | `/dramanova/search` | `q`, `lang` |
| GET | `/dramanova/modules` | `lang` |
| GET | `/dramanova/recommend` | `lang`, `category`, `page`, `size`, `limit` |

### Proxy Utilitas

| Method | Path | Query |
|---|---|---|
| GET | `/proxy/stream` | `url` (whitelisted CDN, support `Range`) |
| GET | `/proxy/subtitle` | `url` (SRT → WebVTT, CORS-enabled) |

### Misc

| Method | Path | Deskripsi |
|---|---|---|
| GET | `/health` | Healthcheck `{ "status": "ok" }` |
| GET | `/manifest.webmanifest` | PWA manifest |

---

## Frontend & UX

Vanilla JS murni — tanpa build step. Tailwind di-load via CDN, HLS.js di-load via CDN, dan ikon pakai Lucide.

| File | Tugas |
|---|---|
| `static/js/state.js` | Bahasa, platform aktif, library/history (localStorage), i18n |
| `static/js/api.js` | Wrapper fetch + adapter per platform (`D.Platforms[*]`) |
| `static/js/ui.js` | Komponen umum: bottom sheet, poster, tab platform |
| `static/js/index.js` | Beranda: hero carousel + rails |
| `static/js/discover.js` | Halaman jelajah dengan filter platform |
| `static/js/search.js` | Pencarian lintas platform |
| `static/js/library.js` | Riwayat tonton & favorit |
| `static/js/watch.js` | Player HLS, episode picker, swipe gesture, auto-hide overlay |

### Persistent Settings

| Key | Isi |
|---|---|
| `dramsi.lang` | `id` / `en` / `pt` / `th` |
| `dramsi.platform` | platform aktif |
| `dramsi.history` | sampai 60 entri terakhir |
| `dramsi.library` | favorit |

---

## Menambah Platform Baru

1. Buat folder `app/platforms/<nama>/` berisi `__init__.py`, `service.py`, `routes.py`.
2. Implementasi service-nya pakai `HttpClient` dari `app.core.http`.
3. Daftarkan blueprint di `app/platforms/__init__.py` (tambahkan ke `PLATFORM_BLUEPRINTS`).
4. Tambahkan adapter ke `static/js/api.js` (`D.Platforms.<nama>`) dan masukkan ke `PLATFORMS` list di `static/js/state.js`.
5. (Opsional) Sesuaikan `LANG_MAP` di `state.js` kalau platform pakai kode bahasa berbeda.

Pola adapter di `api.js` cukup ringkas:

```js
D.Platforms.example = {
  id: 'example',
  label: 'Example',
  orientation: 'horizontal', // atau 'vertical'
  home: (page = 1) => D.api(`/example/home?page=${page}`),
  detail: (id) => D.api(`/example/detail?id=${encodeURIComponent(id)}`),
  stream: (id, ep) => D.api(`/example/episode?id=${id}&ep=${ep}`),
};
```

---

## Troubleshooting

**Video stuck di "Memuat video…"**
Browser kemungkinan memblokir mixed-content (HTTPS halaman, HTTP stream). Player akan otomatis mencoba `/proxy/stream` setelah 8 detik. Pastikan kamu tidak menjalankan di lingkungan yang memblokir endpoint tersebut.

**CORS error di production**
Set `CORS_ORIGINS` di `.env` hanya untuk origin yang diperlukan. Wildcard `*` tidak dianjurkan saat `CORS_SUPPORTS_CREDENTIALS=true`.

**Subtitle tidak muncul**
Cek tab Network. Endpoint `/proxy/subtitle?url=...` harus respond `200 text/vtt`. Kalau upstream blokir IP server kamu, stream subtitle akan kosong.

**Video terpotong di drama vertikal**
Cek class `body.is-vertical` aktif. Object-fit untuk vertical adalah `cover` agar mengisi viewport ala TikTok.

**Hot reload tidak jalan**
Pastikan `FLASK_ENV=development` di `.env`.

---

## Roadmap

- [ ] Resume playback dari posisi terakhir per episode
- [ ] Lock orientasi landscape otomatis untuk drama horizontal
- [ ] Cast / AirPlay button
- [ ] Service worker untuk caching shell PWA
- [ ] Tema terang (light mode)
- [ ] Server-side rendering minimal untuk halaman utama (SEO)
- [ ] Adapter platform tambahan

---

## Kontribusi

Pull request dipersilakan. Untuk perubahan besar, buka issue dulu untuk diskusi.

1. Fork repo ini
2. `git checkout -b feature/nama-fitur`
3. Commit perubahan dengan pesan deskriptif
4. Push & buka pull request

Style: ikuti pola yang sudah ada (PEP 8 untuk Python, idiom Vanilla JS yang ringan untuk frontend).

---

## License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.

---

## Disclaimer

DramSi adalah proyek pembelajaran dan client agregator. Aplikasi ini tidak meng-host konten apa pun; semua data dan stream berasal dari layanan pihak ketiga. Pengguna bertanggung jawab atas penggunaan sesuai dengan ketentuan layanan platform asal masing-masing dan hukum yang berlaku di wilayah mereka.

