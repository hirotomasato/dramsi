"""
Application factory.
Buat instance Flask sekali pakai dan register semua komponen di sini.
"""

from __future__ import annotations

from flask import Flask

from config import get_config

from .core.http import init_http_session
from .middleware import register_middleware
from .platforms import register_platforms
from .stream_proxy import bp as stream_proxy_bp
from .subtitle_proxy import bp as subtitle_proxy_bp
from .web import web_bp


def create_app(config_class=None) -> Flask:
    config_class = config_class or get_config()

    app = Flask(
        __name__,
        template_folder="../templates",
        static_folder="../static",
    )
    app.config.from_object(config_class)

    # HTTP session global (dipakai semua services)
    init_http_session(app)

    # Middleware (CORS, error handler, security headers, dll)
    register_middleware(app)

    # Web (frontend) blueprint
    app.register_blueprint(web_bp)

    # Generic stream proxy (CORS / mixed-content fallback)
    app.register_blueprint(stream_proxy_bp, url_prefix="/proxy")

    # Subtitle proxy (SRT → WebVTT + CORS)
    app.register_blueprint(subtitle_proxy_bp, url_prefix="/proxy")

    # Platform API blueprints
    register_platforms(app)

    return app
