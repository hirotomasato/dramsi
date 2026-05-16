"""DramaBite service.

Catatan upstream:
- `/api/v1/drama/<id>` cuma return id+cover+episodes (title kosong).
  Kita enrich pakai `/api/v1/search?q=<id>` untuk ambil title & cover.
- `/api/v1/drama/<id>/episode/<ep>` selalu return URL m3u8 walau `free=false`
  (ditandai oleh field `validFor` selama beberapa menit).
"""

from __future__ import annotations

from typing import Any, Dict

from flask import current_app

from app.core import HttpClient, err, ok

PLATFORM = "dramabite"


def _client() -> HttpClient:
    cfg = current_app.config
    headers = {
        "token": cfg["TOKEN_MAIN"],
        "Authorization": f"Bearer {cfg['TOKEN_MAIN']}",
        "Content-Type": "application/json",
    }
    return HttpClient(cfg["DBT_BASE"], headers)


def _normalize_card(x: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(x.get("id", "")),
        "title": x.get("title", ""),
        "cover": x.get("cover", ""),
        "episodes": x.get("episodes", 0),
        "platform": PLATFORM,
    }


def _list_endpoint(action: str, path: str, params: dict, lang: str, page: int):
    r = _client().get_json(path, params)
    if r is None:
        return err(action, PLATFORM, "gagal request")
    items = r if isinstance(r, list) else []
    dramas = [_normalize_card(x) for x in items if isinstance(x, dict)]
    return ok(
        action,
        PLATFORM,
        {
            "lang": lang,
            "page": page,
            "items": dramas,
            "total": len(dramas),
            "hasMore": len(dramas) > 0,
        },
    )


def dramas(lang: str = "id", page: int = 0):
    return _list_endpoint("dramas", "/api/v1/dramas", {"lang": lang, "page": page}, lang, page)


def foryou(lang: str = "id", page: int = 0):
    return _list_endpoint("foryou", "/api/v1/foryou", {"lang": lang, "page": page}, lang, page)


def recommend(lang: str = "id", page: int = 0):
    return _list_endpoint(
        "recommend", "/api/v1/recommend", {"lang": lang, "page": page}, lang, page
    )


def hot(lang: str = "id"):
    r = _client().get_json("/api/v1/hot", {"lang": lang})
    if r is None:
        return err("hot", PLATFORM, "gagal request")
    items = r if isinstance(r, list) else []
    keywords = [
        {"keyword": k.get("title", ""), "dramaId": str(k.get("cid", ""))}
        for k in items
        if isinstance(k, dict)
    ]
    return ok("hot", PLATFORM, {"lang": lang, "keywords": keywords, "total": len(keywords)})


def search(keyword: str, lang: str = "id", limit: int = 20):
    r = _client().get_json(
        "/api/v1/search", {"q": keyword, "lang": lang, "limit": limit}
    )
    if r is None:
        return err("search", PLATFORM, "gagal request")
    items = r if isinstance(r, list) else []
    dramas_list = [_normalize_card(x) for x in items if isinstance(x, dict)]
    return ok(
        "search",
        PLATFORM,
        {
            "keyword": keyword,
            "lang": lang,
            "limit": limit,
            "items": dramas_list,
            "total": len(dramas_list),
        },
    )


def _enrich_metadata(drama_id: str, lang: str) -> Dict[str, Any]:
    """Ambil title + cover dari endpoint search (upstream detail kosong)."""
    sr = _client().get_json(
        "/api/v1/search", {"q": drama_id, "lang": lang, "limit": 5}
    )
    if not isinstance(sr, list):
        return {}
    for item in sr:
        if isinstance(item, dict) and str(item.get("id", "")) == drama_id:
            return {
                "title": item.get("title", ""),
                "cover": item.get("cover", ""),
                "episodes": item.get("episodes", 0),
            }
    return {}


def _likes_summary(drama_id: str, lang: str) -> Dict[str, Any]:
    r = _client().get_json(f"/api/v1/drama/{drama_id}/likes", {"lang": lang})
    if not isinstance(r, dict):
        return {}
    return {
        "likeCount": r.get("like_num", 0),
        "shareCount": r.get("share_num", 0),
        "collectCount": r.get("collected_num", 0),
    }


def detail(drama_id: str, lang: str = "id"):
    r = _client().get_json(f"/api/v1/drama/{drama_id}", {"lang": lang})
    if r is None or not isinstance(r, dict):
        return err("detail", PLATFORM, "gagal request")

    # Enrich metadata + stats
    meta = _enrich_metadata(drama_id, lang)
    stats = _likes_summary(drama_id, lang)

    eps_raw = r.get("episodes", []) or []
    episodes = [
        {
            "episode": ep.get("number", ep.get("id", 0)),
            "id": ep.get("id", 0),
            "title": ep.get("title", ""),
            # Walau upstream tandai `free=false`, video URL tetap dikasih
            # oleh /episode endpoint, jadi kita tidak set locked.
            "free": True,
            "locked": False,
        }
        for ep in eps_raw
        if isinstance(ep, dict)
    ]

    return ok(
        "detail",
        PLATFORM,
        {
            "data": {
                "id": str(r.get("id", drama_id)),
                "title": meta.get("title", ""),
                "cover": meta.get("cover") or r.get("cover") or "",
                "synopsis": "",
                "totalEpisodes": meta.get("episodes") or len(episodes),
                "episodes": episodes,
                "stats": stats,
                "platform": PLATFORM,
            }
        },
    )


def likes(drama_id: str, lang: str = "id"):
    r = _client().get_json(f"/api/v1/drama/{drama_id}/likes", {"lang": lang})
    if r is None or not isinstance(r, dict):
        return err("likes", PLATFORM, "gagal request")
    return ok(
        "likes",
        PLATFORM,
        {
            "dramaId": str(r.get("cid", drama_id)),
            "likeCount": r.get("like_num", 0),
            "shareCount": r.get("share_num", 0),
            "collectCount": r.get("collected_num", 0),
            "platform": PLATFORM,
        },
    )


def episode(drama_id: str, ep: int, lang: str = "id", quality: str = "default"):
    r = _client().get_json(
        f"/api/v1/drama/{drama_id}/episode/{ep}",
        {"lang": lang, "quality": quality},
    )
    if r is None or not isinstance(r, dict):
        return err("episode", PLATFORM, "gagal request")

    raw_url = r.get("video", "")
    if not raw_url:
        return err("episode", PLATFORM, "video URL tidak tersedia")

    # CDN miniepisode.media sudah set CORS (ACAO: *) dan segmen-nya path
    # relatif. Stream langsung lebih reliable; frontend `maybeProxy()` akan
    # otomatis bungkus kalau halaman HTTPS tapi URL HTTP (mixed-content).
    vid_type = "hls" if ".m3u8" in raw_url else "mp4"
    quality_label = quality if quality != "default" else "auto"

    return ok(
        "episode",
        PLATFORM,
        {
            "dramaId": drama_id,
            "episode": r.get("number", ep),
            "id": r.get("id", 0),
            "title": r.get("title", f"Episode {ep}"),
            "videoUrl": raw_url,
            "quality": quality_label,
            "validFor": r.get("validFor", 0),
            "qualityList": [{"label": quality_label, "url": raw_url, "type": vid_type}],
            "platform": PLATFORM,
        },
    )
