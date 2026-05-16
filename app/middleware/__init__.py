"""Composer middleware: panggil `register_middleware(app)` sekali."""

from __future__ import annotations

import logging

from flask import Flask
from flask_cors import CORS

from .errors import register_error_handlers
from .observability import register_observability
from .security import register_security_headers

logger = logging.getLogger(__name__)


def register_middleware(app: Flask) -> None:
    CORS(
        app,
        origins=app.config.get("CORS_ORIGINS", ["*"]),
        supports_credentials=app.config.get("CORS_SUPPORTS_CREDENTIALS", False),
        expose_headers=["Content-Type", "Content-Length", "X-Response-Time"],
    )
    register_error_handlers(app)
    register_security_headers(app)
    register_observability(app)
    logger.info("Middleware terpasang.")
