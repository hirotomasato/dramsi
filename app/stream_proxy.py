"""
Generic stream proxy.
Dipakai sebagai fallback supaya:
  1. Halaman HTTPS bisa memutar video CDN HTTP (mixed-content).
  2. CDN yang gak return CORS header tetap playable lewat <video crossorigin>.
  3. Range request tetap forwarded supaya seekable.

Whitelist host di-config via `STREAM_PROXY_HOSTS` (env), atau bisa pakai
default yang otomatis ikut domain dari upstream yang udah dikenal.
"""

from __future__ import annotations

from urllib.parse import urlparse

import requests
from flask import Blueprint, Response, current_app, jsonify, request

bp = Blueprint("stream_proxy", __name__)


# Daftar hostname/wildcard yang pasti aman jadi sumber video.
_DEFAULT_WHITELIST_SUFFIXES = (
    ".montagehub.xyz",
    ".hikeuniverses.xyz",
    ".yfeitrade.com",
    ".dramabos.pro",
    ".dramabos.my.id",
    ".sapimu.au",
    ".cloudfront.net",
    ".tos-sgcomm1-v.com",
    ".miniepisode.media",
    ".goodreels.com",
)


def _is_allowed(hostname: str) -> bool:
    if not hostname:
        return False
    extra = current_app.config.get("STREAM_PROXY_HOSTS") or []
    if hostname in extra:
        return True
    for suffix in _DEFAULT_WHITELIST_SUFFIXES:
        if hostname.endswith(suffix):
            return True
    return False


@bp.route("/stream", methods=["GET", "OPTIONS"])
def stream():
    if request.method == "OPTIONS":
        resp = Response("")
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Headers"] = "Range, Content-Type"
        resp.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        return resp

    url = request.args.get("url", "").strip()
    if not url:
        return jsonify({"error": "param url wajib"}), 400

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return jsonify({"error": "url tidak valid"}), 400
    if not _is_allowed(parsed.hostname):
        return jsonify({"error": f"host tidak diizinkan: {parsed.hostname}"}), 403

    upstream_headers = {
        "User-Agent": (
            "Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
        ),
        "Accept": "*/*",
        "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
    }
    range_header = request.headers.get("Range")
    if range_header:
        upstream_headers["Range"] = range_header

    try:
        upstream = requests.get(
            url,
            headers=upstream_headers,
            stream=True,
            timeout=25,
            allow_redirects=True,
        )
    except requests.RequestException as exc:
        return jsonify({"error": str(exc)}), 502

    resp_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Range",
        "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
        "Cache-Control": "public, max-age=600",
    }
    for h in (
        "Content-Type",
        "Content-Length",
        "Content-Range",
        "Accept-Ranges",
        "Last-Modified",
        "ETag",
    ):
        val = upstream.headers.get(h)
        if val:
            resp_headers[h] = val

    def generate():
        try:
            for chunk in upstream.iter_content(chunk_size=64 * 1024):
                if chunk:
                    yield chunk
        finally:
            upstream.close()

    return Response(generate(), status=upstream.status_code, headers=resp_headers)
