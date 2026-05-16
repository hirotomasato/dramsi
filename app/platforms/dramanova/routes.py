"""DramaNova HTTP routes."""

from __future__ import annotations

from flask import Blueprint, jsonify

from app.core import err, params_int, params_str

from . import service

bp = Blueprint("dramanova", __name__, url_prefix="/dramanova")


@bp.get("/dramas")
def route_dramas():
    return jsonify(
        service.dramas(
            params_str("lang", "in"), params_int("page", 1), params_int("size", 20)
        )
    )


@bp.get("/detail")
def route_detail():
    did = params_str("id")
    if not did:
        return jsonify(err("detail", "dramanova", "param id wajib diisi"))
    return jsonify(service.detail(did, params_str("lang", "in")))


@bp.get("/video")
def route_video():
    did = params_str("id")
    if not did:
        return jsonify(err("video", "dramanova", "param id wajib diisi"))
    return jsonify(service.video(did, params_int("ep", 1), params_str("lang", "in")))


@bp.get("/search")
def route_search():
    kw = params_str("q") or params_str("kw")
    if not kw:
        return jsonify(err("search", "dramanova", "param q wajib diisi"))
    return jsonify(service.search(kw, params_str("lang", "in")))


@bp.get("/modules")
def route_modules():
    return jsonify(service.modules(params_str("lang", "in")))


@bp.get("/recommend")
def route_recommend():
    return jsonify(
        service.recommend(
            params_str("lang", "in"),
            params_str("category", "dramanova_hot"),
            params_int("page", 1),
            params_int("size", 5),
            params_int("limit", 6),
        )
    )
