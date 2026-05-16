"""Observability: access logging + response timing dalam satu hook."""

from __future__ import annotations

import logging
import time

from flask import Flask, g, request

logger = logging.getLogger("dramsi.access")


def _ensure_logger() -> None:
    if logger.handlers:
        return
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s %(message)s"))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)


def register_observability(app: Flask) -> None:
    _ensure_logger()

    @app.before_request
    def _start_timer() -> None:
        g._t_start = time.time()

    @app.after_request
    def _emit(response):
        start = getattr(g, "_t_start", None)
        elapsed = (time.time() - start) if start is not None else 0.0
        response.headers["X-Response-Time"] = f"{elapsed:.3f}s"
        logger.info(
            "%s %s -> %s in %.3fs",
            request.method,
            request.path,
            response.status_code,
            elapsed,
        )
        return response
