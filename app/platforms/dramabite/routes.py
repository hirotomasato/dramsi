"""DramaBite HTTP routes."""

from __future__ import annotations

from flask import Blueprint, jsonify

from app.core import err, params_int, params_str

from . import service

bp = Blueprint("dramabite", __name__, url_prefix="/dramabite")


@bp.get("/dramas")
def route_dramas():
    return jsonify(service.dramas(params_str("lang", "id"), params_int("page", 0)))


@bp.get("/foryou")
def route_foryou():
    return jsonify(service.foryou(params_str("lang", "id"), params_int("page", 0)))


@bp.get("/hot")
def route_hot():
    return jsonify(service.hot(params_str("lang", "id")))


@bp.get("/recommend")
def route_recommend():
    return jsonify(service.recommend(params_str("lang", "id"), params_int("page", 0)))


@bp.get("/search")
def route_search():
    kw = params_str("q") or params_str("kw")
    if not kw:
        return jsonify(err("search", "dramabite", "param q wajib diisi"))
    return jsonify(
        service.search(kw, params_str("lang", "id"), params_int("limit", 20))
    )


@bp.get("/detail")
def route_detail():
    did = params_str("id")
    if not did:
        return jsonify(err("detail", "dramabite", "param id wajib diisi"))
    return jsonify(service.detail(did, params_str("lang", "id")))


@bp.get("/likes")
def route_likes():
    did = params_str("id")
    if not did:
        return jsonify(err("likes", "dramabite", "param id wajib diisi"))
    return jsonify(service.likes(did, params_str("lang", "id")))


@bp.get("/episode")
def route_episode():
    did = params_str("id")
    ep = params_int("ep", 0)
    if not did:
        return jsonify(err("episode", "dramabite", "param id wajib diisi"))
    if not ep:
        return jsonify(err("episode", "dramabite", "param ep wajib diisi"))
    return jsonify(
        service.episode(did, ep, params_str("lang", "id"), params_str("quality", "default"))
    )
