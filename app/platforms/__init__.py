"""Auto-register semua platform blueprint."""

from __future__ import annotations

from flask import Flask

from .dramabite.routes import bp as dramabite_bp
from .dramanova.routes import bp as dramanova_bp
from .goodshort.hls_proxy import bp as goodshort_hls_bp
from .goodshort.routes import bp as goodshort_bp

PLATFORM_BLUEPRINTS = (
    goodshort_bp,
    goodshort_hls_bp,
    dramanova_bp,
    dramabite_bp,
)


def register_platforms(app: Flask) -> None:
    for bp in PLATFORM_BLUEPRINTS:
        app.register_blueprint(bp)
