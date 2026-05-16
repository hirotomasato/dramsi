"""Helper-helper kecil yang dipakai banyak service."""

from __future__ import annotations

import re
from typing import Any

from flask import request

_HTML_TAG_RE = re.compile(r"<[^>]+>")


def clean_html(text: Any) -> str:
    """Strip HTML tag dan trim whitespace."""
    if not text:
        return ""
    return _HTML_TAG_RE.sub("", str(text)).strip()


def params_str(key: str, default: str = "") -> str:
    return request.args.get(key, default)


def params_int(key: str, default: int = 1) -> int:
    raw = request.args.get(key, default)
    try:
        return int(raw)
    except (TypeError, ValueError):
        return default
