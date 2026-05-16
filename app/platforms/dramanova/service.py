"""DramaNova service."""

from __future__ import annotations

from urllib.parse import quote

from flask import current_app

from app.core import HttpClient, clean_html, err, ok

PLATFORM = "dramanova"


_SUB_LANG_LABELS = {
    "in": "Indonesia",
    "id": "Indonesia",
    "en": "English",
    "pt": "Português",
    "th": "ไทย",
    "vi": "Tiếng Việt",
    "es": "Español",
}


def _label_for_lang(lang_code: str, fallback: str = "") -> str:
    if not lang_code:
        return fallback or "Subtitle"
    return _SUB_LANG_LABELS.get(lang_code.lower(), fallback or lang_code.upper())


def _normalize_subs(raw_subs):
    """Bentuk subtitle yang konsisten + URL siap dipakai via proxy."""
    out = []
    for s in raw_subs or []:
        if not isinstance(s, dict):
            continue
        url = s.get("url", "")
        if not url:
            continue
        lang = s.get("lang", "")
        out.append(
            {
                "lang": lang,
                "label": _label_for_lang(lang, s.get("label", "")),
                "url": url,
                "proxiedUrl": f"/proxy/subtitle?url={quote(url, safe='')}",
            }
        )
    return out


def _client() -> HttpClient:
    cfg = current_app.config
    headers = {
        "token": cfg["TOKEN_MAIN"],
        "Authorization": f"Bearer {cfg['TOKEN_MAIN']}",
        "Content-Type": "application/json",
    }
    return HttpClient(cfg["DNV_BASE"], headers)


def _normalize_card(x):
    return {
        "id": str(x.get("id", "")),
        "title": x.get("title", ""),
        "cover": x.get("cover", ""),
        "episodes": x.get("episodes", 0),
        "synopsis": clean_html(x.get("description", "")),
        "categoryNames": x.get("categoryNames", []) or [],
        "viewCount": x.get("viewCount", 0),
        "likeCount": x.get("likeCount", 0),
        "favoriteCount": x.get("favoriteCount", 0),
        "isCompleted": x.get("isCompleted", False),
        "publishedAt": x.get("publishedAt", ""),
        "platform": PLATFORM,
    }


def dramas(lang: str = "in", page: int = 1, size: int = 20):
    r = _client().get_json("/api/v1/dramas", {"lang": lang, "page": page, "size": size})
    if r is None or not isinstance(r, dict):
        return err("dramas", PLATFORM, "gagal request")
    rows = r.get("rows", []) or []
    items = [_normalize_card(x) for x in rows if isinstance(x, dict)]
    return ok(
        "dramas",
        PLATFORM,
        {
            "lang": lang,
            "page": page,
            "size": size,
            "items": items,
            "total": r.get("total", len(items)),
            "hasMore": len(items) >= size,
        },
    )


def detail(drama_id: str, lang: str = "in"):
    r = _client().get_json(f"/api/v1/drama/{drama_id}", {"lang": lang})
    if r is None or not isinstance(r, dict):
        return err("detail", PLATFORM, "gagal request")

    eps_raw = r.get("episodes", []) or []
    episodes = []
    for i, ep in enumerate(eps_raw):
        if not isinstance(ep, dict):
            continue
        subs = _normalize_subs(ep.get("subtitles", []))
        episodes.append(
            {
                "episode": ep.get("number", i + 1),
                "id": str(ep.get("id", "")),
                "title": ep.get("title", f"Episode {i+1}"),
                "fileId": str(ep.get("fileId", "")),
                "cover": ep.get("cover", ""),
                "free": ep.get("free", False),
                "locked": not ep.get("free", False),
                "subtitles": subs,
            }
        )
    return ok(
        "detail",
        PLATFORM,
        {
            "data": {
                "id": str(r.get("id", drama_id)),
                "title": r.get("title", ""),
                "cover": r.get("cover") or "",
                "banner": r.get("banner") or "",
                "synopsis": clean_html(r.get("description", "")),
                "totalEpisodes": r.get("totalEpisodes", len(episodes)),
                "isCompleted": r.get("isCompleted", False),
                "viewCount": r.get("viewCount", 0),
                "likeCount": r.get("likeCount", 0),
                "publishedAt": r.get("publishedAt", ""),
                "episodes": episodes,
                "platform": PLATFORM,
            }
        },
    )


def video(drama_id: str, ep: int = 1, lang: str = "in"):
    detail_r = _client().get_json(f"/api/v1/drama/{drama_id}", {"lang": lang})
    if detail_r is None or not isinstance(detail_r, dict):
        return err("video", PLATFORM, "gagal ambil detail")

    eps_raw = detail_r.get("episodes", []) or []
    if not eps_raw:
        return err("video", PLATFORM, "tidak ada episode")

    idx = min(ep - 1, len(eps_raw) - 1)
    target = eps_raw[idx]
    if not isinstance(target, dict):
        return err("video", PLATFORM, "episode data invalid")

    file_id = str(target.get("fileId", ""))
    if not file_id:
        return err("video", PLATFORM, f"fileId tidak ditemukan di episode {ep}")

    r = _client().get_json("/api/video", {"id": file_id})
    if r is None or not isinstance(r, dict):
        return err("video", PLATFORM, "gagal request video")

    quality_list = []
    for v in r.get("videos", []) or []:
        if not isinstance(v, dict):
            continue
        main_url = v.get("main_url", "")
        vid_type = "hls" if ".m3u8" in main_url else "mp4"
        quality_list.append(
            {
                "label": v.get("definition", "auto"),
                "quality": v.get("quality", ""),
                "url": main_url,
                "backupUrl": v.get("backup_url", ""),
                "type": vid_type,
                "codec": v.get("codec", ""),
                "width": v.get("width", 0),
                "height": v.get("height", 0),
                "bitrate": v.get("bitrate", 0),
                "size": v.get("size", 0),
                "duration": v.get("duration", 0),
            }
        )
    best_url = quality_list[-1]["url"] if quality_list else ""
    subs = _normalize_subs(target.get("subtitles", []))
    return ok(
        "video",
        PLATFORM,
        {
            "dramaId": drama_id,
            "episode": target.get("number", idx + 1),
            "totalEps": len(eps_raw),
            "episodeId": str(target.get("id", "")),
            "fileId": file_id,
            "title": detail_r.get("title", ""),
            "epTitle": target.get("title", f"Episode {idx+1}"),
            "poster": r.get("poster", ""),
            "duration": r.get("duration", 0),
            "videoUrl": best_url,
            "subtitles": subs,
            "qualityList": quality_list,
            "free": target.get("free", False),
            "locked": not target.get("free", False),
            "platform": PLATFORM,
        },
    )


def search(keyword: str, lang: str = "in"):
    r = _client().get_json("/api/v1/search", {"q": keyword, "lang": lang})
    if r is None or not isinstance(r, dict):
        return err("search", PLATFORM, "gagal request")
    rows = r.get("rows", []) or []
    items = [_normalize_card(x) for x in rows if isinstance(x, dict)]
    return ok(
        "search",
        PLATFORM,
        {"keyword": keyword, "lang": lang, "items": items, "total": r.get("total", len(items))},
    )


def modules(lang: str = "in"):
    r = _client().get_json("/api/v1/modules", {"lang": lang})
    if r is None:
        return err("modules", PLATFORM, "gagal request")
    items = r if isinstance(r, list) else []
    modules_list = [
        {
            "categoryKey": x.get("categoryKey", ""),
            "categoryName": x.get("categoryName", ""),
            "dramaCount": x.get("dramaCount", 0),
        }
        for x in items
        if isinstance(x, dict)
    ]
    return ok(
        "modules",
        PLATFORM,
        {"lang": lang, "modules": modules_list, "total": len(modules_list)},
    )


def recommend(
    lang: str = "in",
    category_key: str = "dramanova_hot",
    page: int = 1,
    size: int = 5,
    limit: int = 6,
):
    r = _client().get_json(
        "/api/v1/recommend",
        {
            "lang": lang,
            "categoryKey": category_key,
            "page": page,
            "size": size,
            "limit": limit,
        },
    )
    if r is None or not isinstance(r, dict):
        return err("recommend", PLATFORM, "gagal request")
    drama_list = r.get("dramas", []) or []
    items = [
        {
            "id": str(x.get("id", "")),
            "title": x.get("title", ""),
            "cover": x.get("cover", ""),
            "episodes": x.get("episodes", 0),
            "viewCount": x.get("viewCount", 0),
            "platform": PLATFORM,
        }
        for x in drama_list
        if isinstance(x, dict)
    ]
    return ok(
        "recommend",
        PLATFORM,
        {
            "lang": lang,
            "category": r.get("category", category_key),
            "categoryKey": r.get("categoryKey", category_key),
            "page": page,
            "size": size,
            "limit": limit,
            "items": items,
            "total": len(items),
        },
    )
