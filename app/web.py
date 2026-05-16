"""Frontend web routes & PWA assets."""

from __future__ import annotations

from flask import Blueprint, jsonify, redirect, render_template

web_bp = Blueprint("web", __name__)


_MANIFEST = {
    "name": "DramSi · Streaming Drama Pendek",
    "short_name": "DramSi",
    "description": "Aggregator drama pendek lintas platform dengan tampilan modern.",
    "start_url": "/",
    "scope": "/",
    "display": "standalone",
    "orientation": "portrait",
    "background_color": "#0a0b14",
    "theme_color": "#7c5cff",
    "categories": ["entertainment", "video"],
    "icons": [
        {
            "src": "/static/img/favicon.svg",
            "sizes": "any",
            "type": "image/svg+xml",
        },
        {
            "src": "/static/img/icon-192.svg",
            "sizes": "192x192",
            "type": "image/svg+xml",
            "purpose": "any maskable",
        },
        {
            "src": "/static/img/icon-512.svg",
            "sizes": "512x512",
            "type": "image/svg+xml",
            "purpose": "any maskable",
        },
    ],
}


@web_bp.get("/")
def index():
    return render_template("index.html")


@web_bp.get("/discover")
def discover():
    return render_template("discover.html")


@web_bp.get("/search")
def search():
    return render_template("search.html")


@web_bp.get("/library")
def library():
    return render_template("library.html")


@web_bp.get("/watch")
def watch():
    return render_template("watch.html")


@web_bp.get("/manifest.webmanifest")
def manifest():
    return jsonify(_MANIFEST)


@web_bp.get("/favicon.ico")
def favicon():
    """Browser kadang request /favicon.ico — redirect ke SVG."""
    return redirect("/static/img/favicon.svg", code=301)


@web_bp.get("/health")
def health():
    return {"status": "ok"}
