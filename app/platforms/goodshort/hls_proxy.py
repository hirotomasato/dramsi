"""GoodShort HLS proxy.

GoodShort meng-encrypt HLS dengan AES-128 dan menulis URI key sebagai
`local://offline-key/...` (skema custom yang gak bisa di-fetch browser).

Solusi 2-step:
1. `/goodshort/playlist?url=...&k=<hex>` mem-fetch m3u8 upstream lalu
   - rewrite `URI="local://..."` jadi `URI="/goodshort/aeskey?k=<hex>"`
   - resolve segmen relatif jadi absolute upstream URL
2. `/goodshort/aeskey?k=<hex>` return raw 16-byte AES key (binary).
"""

from __future__ import annotations

import binascii
import re
from urllib.parse import urljoin, urlparse

import requests
from flask import Blueprint, Response, jsonify, request

from app.core import err, params_str

bp = Blueprint("goodshort_hls", __name__, url_prefix="/goodshort")

_KEY_URI_RE = re.compile(r'URI="([^"]*offline-key[^"]*)"')
_ALLOWED_HOST_SUFFIX = "goodreels.com"


@bp.get("/aeskey")
def route_aeskey():
    """Return raw 16-byte AES key untuk HLS GoodShort."""
    hex_key = params_str("k")
    if not hex_key:
        return jsonify(err("aeskey", "goodshort", "param k wajib")), 400

    try:
        raw = binascii.unhexlify(hex_key)
    except (binascii.Error, ValueError):
        return jsonify(err("aeskey", "goodshort", "key hex tidak valid")), 400

    if len(raw) != 16:
        return jsonify(err("aeskey", "goodshort", "panjang key harus 16 byte")), 400

    return Response(
        raw,
        status=200,
        headers={
            "Content-Type": "application/octet-stream",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600",
        },
    )


@bp.route("/playlist", methods=["GET", "OPTIONS"])
def route_playlist():
    if request.method == "OPTIONS":
        return _cors_preflight()

    url = params_str("url")
    aes_key_hex = params_str("k")
    if not url:
        return jsonify(err("playlist", "goodshort", "param url wajib")), 400

    parsed = urlparse(url)
    if not parsed.hostname or _ALLOWED_HOST_SUFFIX not in parsed.hostname:
        return jsonify(err("playlist", "goodshort", "host tidak diizinkan")), 403

    try:
        upstream = requests.get(
            url,
            headers={
                "User-Agent": "Mozilla/5.0",
                "Origin": "https://dramacina.vip",
                "Referer": "https://dramacina.vip/",
            },
            timeout=15,
        )
    except requests.RequestException as exc:
        return jsonify(err("playlist", "goodshort", str(exc))), 502

    if upstream.status_code != 200:
        return (
            jsonify(err("playlist", "goodshort", f"upstream HTTP {upstream.status_code}")),
            502,
        )

    rewritten = _rewrite_playlist(upstream.text, source_url=url, aes_key_hex=aes_key_hex)

    return Response(
        rewritten,
        status=200,
        headers={
            "Content-Type": "application/vnd.apple.mpegurl",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache",
        },
    )


def _rewrite_playlist(text: str, *, source_url: str, aes_key_hex: str) -> str:
    """Replace AES key URI dan resolve relative segment URLs jadi absolute."""
    if aes_key_hex:
        text = _KEY_URI_RE.sub(f'URI="/goodshort/aeskey?k={aes_key_hex}"', text)

    base = source_url.rsplit("/", 1)[0] + "/"
    out_lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or stripped.startswith("http"):
            out_lines.append(line)
            continue
        out_lines.append(urljoin(base, stripped))
    return "\n".join(out_lines)


def _cors_preflight() -> Response:
    resp = Response("")
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Range, Content-Type"
    resp.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    return resp
