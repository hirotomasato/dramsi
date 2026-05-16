"""Error handler global dengan response envelope yang konsisten."""

from __future__ import annotations

import logging

from flask import Flask, jsonify, request

logger = logging.getLogger(__name__)


def _envelope(code: int, message: str, **extra):
    body = {
        "creator": "MasantoID",
        "status": False,
        "code": code,
        "message": message,
        "path": request.path,
    }
    body.update(extra)
    return jsonify(body), code


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(400)
    def _bad_request(e):
        return _envelope(400, "Bad Request", error=str(e))

    @app.errorhandler(403)
    def _forbidden(e):
        return _envelope(403, "Forbidden", error=str(e))

    @app.errorhandler(404)
    def _not_found(e):
        return _envelope(404, "Endpoint tidak ditemukan")

    @app.errorhandler(405)
    def _method_not_allowed(e):
        return _envelope(405, "Method tidak diizinkan")

    @app.errorhandler(500)
    def _internal(e):
        logger.exception("Internal Server Error")
        return _envelope(500, "Internal Server Error", error=str(e))
