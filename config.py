"""
Konfigurasi terpusat aplikasi.
Override default lewat environment variables (.env / sistem) tanpa menyentuh kode.
"""

from __future__ import annotations

import os
from typing import Dict, List, Type


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def _env_bool(key: str, default: bool = False) -> bool:
    return _env(key, str(default)).lower() in ("1", "true", "yes", "on")


def _env_int(key: str, default: int) -> int:
    try:
        return int(_env(key, str(default)))
    except ValueError:
        return default


class BaseConfig:
    """Konfigurasi default. Subclass override sesuai environment."""

    CREATOR = _env("APP_CREATOR", "MasantoID")
    DEBUG = False
    REQUEST_TIMEOUT = _env_int("REQUEST_TIMEOUT", 8)

    # Upstream endpoints
    GS_BASE = _env("GS_BASE", "https://captain.sapimu.au/goodshort")
    DBT_BASE = _env("DBT_BASE", "https://captain.sapimu.au/dramabite")
    DNV_BASE = _env("DNV_BASE", "https://captain.sapimu.au/dramanova")

    # Token upstream bersama (dipakai semua platform)
    TOKEN_MAIN = _env(
        "TOKEN_MAIN",
        "5a6df8230521283fad1e9d4590b619171793e8173953af434e478929c761b2ed",
    )

    # HTTP defaults
    DEFAULT_HEADERS: Dict[str, str] = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        ),
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://dramacina.vip",
        "Referer": "https://dramacina.vip/",
    }

    # GoodShort: mapping bahasa ke channel-id
    GS_CHANNELS: Dict[str, int] = {"id": 562, "pt": 564, "kr": 565, "th": 568}

    # CORS
    CORS_ORIGINS: List[str] = ["*"]
    CORS_SUPPORTS_CREDENTIALS = False


class DevelopmentConfig(BaseConfig):
    DEBUG = True


class ProductionConfig(BaseConfig):
    CORS_ORIGINS = [
        o.strip()
        for o in _env(
            "CORS_ORIGINS", "https://dramacina.vip,https://www.dramacina.vip"
        ).split(",")
        if o.strip()
    ]
    CORS_SUPPORTS_CREDENTIALS = _env_bool("CORS_SUPPORTS_CREDENTIALS", True)


_CONFIG_MAP: Dict[str, Type[BaseConfig]] = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
}


def get_config() -> Type[BaseConfig]:
    env = _env("FLASK_ENV", "development").lower()
    return _CONFIG_MAP.get(env, DevelopmentConfig)
