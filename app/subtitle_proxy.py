"""
Subtitle proxy.
Fetch SRT dari CDN upstream lalu convert ke WebVTT supaya:
  1. Browser native `<track>` bisa load (cuma support VTT, bukan SRT).
  2. CORS dari CDN gak masalah karena response kita yang kasih ACAO.
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

import requests
from flask import Blueprint, Response, current_app, jsonify, request

bp = Blueprint("subtitle_proxy", __name__)

# Whitelist host subtitle CDN
_DEFAULT_WHITELIST_SUFFIXES = (
    ".yfeitrade.com",
    ".aasleeimg.yfeitrade.com",
    ".hikeuniverses.xyz",
    ".miniepisode.media",
    ".sapimu.au",
)


def _is_allowed(hostname: str) -> bool:
    if not hostname:
        return False
    extra = current_app.config.get("SUBTITLE_PROXY_HOSTS") or []
    if hostname in extra:
        return True
    for suffix in _DEFAULT_WHITELIST_SUFFIXES:
        if hostname.endswith(suffix):
            return True
    return False


# SRT timestamp: 00:00:14,040 → VTT: 00:00:14.040
_TS_RE = re.compile(r"(\d{2}:\d{2}:\d{2}),(\d{3})")


def srt_to_vtt(srt_text: str) -> str:
    """Convert SRT plain text ke WebVTT.

    Aturan ringkas:
    - Replace koma di timestamp jadi titik.
    - Hapus index numeric line di awal cue (opsional di VTT).
    - Tambah header WEBVTT.
    """
    text = srt_text.replace("\r\n", "\n").replace("\r", "\n").strip()
    text = _TS_RE.sub(r"\1.\2", text)

    # Hapus BOM kalau ada
    if text.startswith("\ufeff"):
        text = text[1:]

    # Strip leading numeric index (line `1`, `2`, ...) sebelum cue timing.
    out_blocks = []
    for block in text.split("\n\n"):
        lines = block.strip().split("\n")
        if not lines:
            continue
        # Kalau line pertama murni angka, drop
        if lines[0].strip().isdigit() and len(lines) > 1 and "-->" in lines[1]:
            lines = lines[1:]
        out_blocks.append("\n".join(lines))

    return "WEBVTT\n\n" + "\n\n".join(out_blocks) + "\n"


@bp.route("/subtitle", methods=["GET", "OPTIONS"])
def subtitle():
    if request.method == "OPTIONS":
        resp = Response("")
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
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

    try:
        upstream = requests.get(
            url,
            headers={
                "User-Agent": "Mozilla/5.0",
                "Accept": "*/*",
                "Referer": "https://dramacina.vip/",
            },
            timeout=15,
        )
    except requests.RequestException as exc:
        return jsonify({"error": str(exc)}), 502

    if upstream.status_code != 200:
        return jsonify({"error": f"upstream HTTP {upstream.status_code}"}), 502

    body = upstream.text or ""
    is_vtt = body.lstrip().upper().startswith("WEBVTT")

    if is_vtt:
        vtt = body
    else:
        # Anggap SRT (atau format mirip) — convert
        try:
            vtt = srt_to_vtt(body)
        except Exception:  # noqa: BLE001
            # Kalau gagal convert, tetap kirim raw text supaya gak mati total
            vtt = body

    headers = {
        "Content-Type": "text/vtt; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
    }
    return Response(vtt, status=200, headers=headers)
