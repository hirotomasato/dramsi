"""
HTTP client tipis di atas `requests.Session`.
Satu session dipakai bareng semua service (keep-alive + connection pooling).
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import requests
from flask import Flask, current_app

logger = logging.getLogger(__name__)

_SESSION: Optional[requests.Session] = None


def init_http_session(app: Flask) -> requests.Session:
    """Initialize global session berdasarkan config."""
    global _SESSION
    session = requests.Session()
    session.headers.update(app.config["DEFAULT_HEADERS"])
    _SESSION = session
    app.extensions = getattr(app, "extensions", {})
    app.extensions["http_session"] = session
    return session


def get_http_session() -> requests.Session:
    """Ambil session global (lazy init kalau belum ada)."""
    global _SESSION
    if _SESSION is None:
        _SESSION = requests.Session()
    return _SESSION


class HttpClient:
    """Wrapper kecil supaya service cuma panggil `client.get_json(...)`."""

    def __init__(self, base_url: str, default_headers: Optional[Dict[str, str]] = None):
        self.base_url = base_url.rstrip("/")
        self.default_headers = default_headers or {}

    def _build_url(self, path: str) -> str:
        if path.startswith("http://") or path.startswith("https://"):
            return path
        if not path.startswith("/"):
            path = "/" + path
        return f"{self.base_url}{path}"

    def get_json(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[int] = None,
    ) -> Optional[Dict[str, Any]]:
        url = self._build_url(path)
        merged = {**self.default_headers, **(headers or {})}
        try:
            timeout = timeout or current_app.config.get("REQUEST_TIMEOUT", 8)
        except RuntimeError:
            timeout = timeout or 8

        try:
            r = get_http_session().get(
                url, params=params, headers=merged, timeout=timeout
            )
            if r.status_code != 200:
                logger.warning("HTTP %s for %s", r.status_code, url)
                return None
            return r.json()
        except (requests.RequestException, ValueError) as exc:
            logger.warning("HTTP request gagal %s: %s", url, exc)
            return None

    def get_raw(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[int] = None,
        stream: bool = False,
        allow_redirects: bool = True,
    ) -> requests.Response:
        url = self._build_url(path)
        merged = {**self.default_headers, **(headers or {})}
        try:
            timeout = timeout or current_app.config.get("REQUEST_TIMEOUT", 25)
        except RuntimeError:
            timeout = timeout or 25
        return get_http_session().get(
            url,
            params=params,
            headers=merged,
            timeout=timeout,
            stream=stream,
            allow_redirects=allow_redirects,
        )
