"""GoodShort service: home, search, detail, stream, unlock."""

from __future__ import annotations

from typing import Any, Dict
from urllib.parse import quote

from flask import current_app

from app.core import HttpClient, clean_html, err, ok

PLATFORM = "goodshort"


def _client() -> HttpClient:
    cfg = current_app.config
    headers = {
        "token": cfg["TOKEN_MAIN"],
        "Authorization": f"Bearer {cfg['TOKEN_MAIN']}",
        "Content-Type": "application/json",
    }
    return HttpClient(cfg["GS_BASE"], headers)


def _proxy_playlist_url(upstream_url: str, aes_key_hex: str = "") -> str:
    """Bungkus URL m3u8 upstream lewat /goodshort/playlist (rewrite AES key URI)."""
    if not upstream_url:
        return ""
    suffix = f"&k={aes_key_hex}" if aes_key_hex else ""
    return f"/goodshort/playlist?url={quote(upstream_url, safe='')}{suffix}"


def _normalize_item(x: Dict[str, Any]) -> Dict[str, Any]:
    bid = str(x.get("bookId") or x.get("action") or "")
    return {
        "id": bid,
        "title": x.get("bookName") or x.get("name", ""),
        "cover": x.get("cover") or x.get("image", ""),
        "image": x.get("image") or x.get("cover", ""),
        "introduction": clean_html(x.get("introduction", "")),
        "labels": x.get("labels", []) or [],
        "labelInfos": x.get("labelInfos", []) or [],
        "viewCount": x.get("viewCount", 0),
        "viewCountDisplay": x.get("viewCountDisplay", ""),
        "chapterCount": x.get("chapterCount", 0),
        "firstChapterId": x.get("firstChapterId", 0),
        "bookType": x.get("bookType", 0),
        "grade": x.get("grade", ""),
        "ratings": x.get("ratings", 0),
        "typeTwoNames": x.get("typeTwoNames", []) or [],
        "platform": PLATFORM,
    }


def home(page: int = 1, channel: str = "id"):
    cfg = current_app.config
    channel_id = cfg["GS_CHANNELS"].get(channel, 562)
    r = _client().get_json(
        "/api/v1/home",
        {"channelId": channel_id, "page": page, "pageSize": 12, "language": "id"},
    )
    if not r:
        return err("home", PLATFORM, "gagal")

    data = r.get("data", {}) or {}
    records = data.get("records", []) or []
    sections, flat_items, seen = [], [], set()

    for rec in records:
        sec = {
            "channelId": rec.get("channelId", 0),
            "columnId": rec.get("columnId", 0),
            "name": rec.get("name", ""),
            "style": rec.get("style", ""),
            "more": rec.get("more", False),
            "items": [],
        }
        for x in rec.get("items", []) or []:
            item = _normalize_item(x)
            if not item["id"]:
                continue
            sec["items"].append(item)
            if item["id"] not in seen and item["title"]:
                seen.add(item["id"])
                flat_items.append(item)
        sections.append(sec)

    return ok(
        "home",
        PLATFORM,
        {
            "page": data.get("current", page),
            "pageSize": data.get("size", 12),
            "totalSections": data.get("total", len(records)),
            "channelId": channel_id,
            "channel": channel,
            "sections": sections,
            "items": flat_items,
            "totalItems": len(flat_items),
        },
    )


def search(keyword: str, page: int = 1):
    r = _client().get_json(
        "/api/v1/search",
        {"q": keyword, "language": "id", "page": page, "pageSize": 20},
    )
    if not r:
        return err("search", PLATFORM, "gagal")

    sr = r.get("data", {}).get("searchResult", {})
    items = sr.get("records", []) if isinstance(sr, dict) else []
    dramas = [_normalize_item(x) for x in items]
    return ok(
        "search",
        PLATFORM,
        {"keyword": keyword, "items": dramas, "total": len(dramas)},
    )


def detail(book_id: str):
    r = _client().get_json(f"/api/v1/book/{book_id}", {"language": "id"})
    if not r:
        return err("detail", PLATFORM, "gagal")

    data = r.get("data", {}) or {}
    book = data.get("book", {}) or {}
    chapters = data.get("list", []) or []

    # Kalau detail cuma return sedikit chapter (paywall), augmentasi dari /unlock
    # supaya UI bisa nampilin semua episode.
    total_count = book.get("chapterCount") or 0
    if total_count and len(chapters) < total_count:
        unlock = _client().get_json(f"/api/v1/unlock/{book_id}", {"q": "720p"})
        if unlock:
            unlock_videos = unlock.get("videos", []) or []
            if len(unlock_videos) > len(chapters):
                # Map existing chapters by id supaya metadata-nya gak hilang
                existing_by_id = {str(c.get("id", "")): c for c in chapters}
                merged = []
                for v in unlock_videos:
                    cid = str(v.get("id", ""))
                    if cid in existing_by_id:
                        merged.append(existing_by_id[cid])
                    else:
                        merged.append(
                            {
                                "id": cid,
                                "chapterName": v.get("name", ""),
                                "charged": True,  # belum di-unlock manual
                                "price": 0,
                                "playTime": 0,
                                "playCount": 0,
                                "image": "",
                                "cdn": "",
                                "cdnList": [],
                                "multiVideos": [],
                            }
                        )
                chapters = merged

    episodes = []
    for i, ch in enumerate(chapters):
        chapter_id = str(ch.get("id", ""))
        qualities = []
        for mv in ch.get("multiVideos", []) or []:
            cdn = mv.get("cdnList", []) or []
            url = cdn[0].get("videoPath", "") if cdn else mv.get("filePath", "")
            if url:
                qualities.append({"label": mv.get("type", ""), "url": url, "type": "hls"})
        cdn_urls = [
            c.get("videoPath", "")
            for c in (ch.get("cdnList", []) or [])
            if c.get("videoPath")
        ]
        episodes.append(
            {
                "episode": i + 1,
                "chapterId": chapter_id,
                "title": ch.get("chapterName", f"Episode {i+1}"),
                "locked": bool(ch.get("charged", False)),
                "free": ch.get("price", 0) == 0,
                "price": ch.get("price", 0),
                "playTime": ch.get("playTime", 0),
                "playCount": ch.get("playCount", 0),
                "image": ch.get("image", ""),
                "cdnUrl": ch.get("cdn", ""),
                "cdnUrls": cdn_urls,
                "qualities": qualities,
            }
        )

    return ok(
        "detail",
        PLATFORM,
        {
            "data": {
                "id": str(book.get("bookId", book_id)),
                "title": book.get("bookName", ""),
                "cover": book.get("cover", ""),
                "detailCover": book.get("bookDetailCover", ""),
                "synopsis": clean_html(book.get("introduction", "")),
                "totalEpisodes": book.get("chapterCount", len(episodes)),
                "viewCount": book.get("viewCount", 0),
                "ratings": book.get("ratings", 0),
                "tags": book.get("labels", []),
                "labelInfos": book.get("labelInfos", []),
                "language": book.get("languageDisplay", ""),
                "grade": book.get("grade", ""),
                "freeEpisodes": book.get("free", 0),
                "episodes": episodes,
                "platform": PLATFORM,
            }
        },
    )


def _key(book_id: str, chapter_id: str) -> str:
    r = _client().get_json("/api/v1/key", {"bookId": book_id, "chapterId": chapter_id})
    return r.get("key", "") if r else ""


def stream(book_id: str, ep: int = 1, quality: str = "720p"):
    rd = _client().get_json(f"/api/v1/book/{book_id}", {"language": "id"})
    if not rd:
        return err("stream", PLATFORM, "gagal ambil detail")

    data = rd.get("data", {}) or {}
    book = data.get("book", {}) or {}
    chapters = data.get("list", []) or []
    if not chapters:
        return err("stream", PLATFORM, "tidak ada episode")

    idx = min(ep - 1, len(chapters) - 1)
    ch = chapters[idx]
    chapter_id = str(ch.get("id", ""))
    if not chapter_id:
        return err("stream", PLATFORM, "chapterId tidak ditemukan")

    rp = _client().get_json(
        f"/api/v1/play/{book_id}/{chapter_id}", {"q": quality, "language": "id"}
    )
    if not rp:
        return err("stream", PLATFORM, "gagal ambil video")

    m3u8 = rp.get("m3u8", "")
    aes = _key(book_id, chapter_id)

    qualities = []
    for mv in ch.get("multiVideos", []) or []:
        cdn = mv.get("cdnList", []) or []
        url = cdn[0].get("videoPath", "") if cdn else mv.get("filePath", "")
        if url:
            qualities.append({"label": mv.get("type", ""), "url": url, "type": "hls"})
    if not qualities and m3u8:
        qualities.append({"label": quality, "url": m3u8, "type": "hls"})

    return ok(
        "stream",
        PLATFORM,
        {
            "bookId": book_id,
            "chapterId": chapter_id,
            "episode": idx + 1,
            "totalEps": len(chapters),
            "title": book.get("bookName", ""),
            "epTitle": ch.get("chapterName", f"Episode {idx+1}"),
            "videoUrl": m3u8,
            "quality": quality,
            "aesKey": aes,
            "kEncrypted": rp.get("k", ""),
            "sSeed": rp.get("s", ""),
            "isLocked": bool(ch.get("charged", False)),
            "isFree": not bool(ch.get("charged", False)),
            "qualityList": qualities,
        },
    )


def stream_fast(book_id: str, ep: int = 1, quality: str = "720p"):
    r = _client().get_json(f"/api/v1/unlock/{book_id}", {"q": quality})
    if not r:
        return err("stream_fast", PLATFORM, "gagal unlock")

    videos = r.get("videos", []) or []
    total = r.get("total", len(videos))
    if not videos:
        return err("stream_fast", PLATFORM, "tidak ada episode")

    idx = min(ep - 1, len(videos) - 1)
    target = videos[idx]
    chapter_id = str(target.get("id", ""))
    url = target.get("url", "")
    aes = _key(book_id, chapter_id) if chapter_id else ""

    proxied_url = _proxy_playlist_url(url, aes)

    all_eps = [
        {
            "episode": i + 1,
            "chapterId": str(v.get("id", "")),
            "name": v.get("name", ""),
            "url": _proxy_playlist_url(v.get("url", ""), aes),
            "type": "hls",
        }
        for i, v in enumerate(videos)
    ]

    return ok(
        "stream_fast",
        PLATFORM,
        {
            "bookId": book_id,
            "chapterId": chapter_id,
            "episode": idx + 1,
            "totalEps": total,
            "videoUrl": proxied_url,
            "quality": quality,
            "aesKey": aes,
            "qualityList": [{"label": quality, "url": proxied_url, "type": "hls"}] if proxied_url else [],
            "allEpisodes": all_eps,
        },
    )


def unlock_all(book_id: str, quality: str = "720p"):
    r = _client().get_json(f"/api/v1/unlock/{book_id}", {"q": quality})
    if not r:
        return err("unlock", PLATFORM, "gagal")
    videos = r.get("videos", []) or []
    episodes = [
        {
            "episode": i + 1,
            "chapterId": str(v.get("id", "")),
            "name": v.get("name", ""),
            "url": v.get("url", ""),
            "type": "hls",
        }
        for i, v in enumerate(videos)
    ]
    return ok(
        "unlock",
        PLATFORM,
        {
            "bookId": book_id,
            "quality": quality,
            "total": r.get("total", len(videos)),
            "episodes": episodes,
        },
    )
