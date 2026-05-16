"""GoodShort HTTP routes."""

from __future__ import annotations

from flask import Blueprint, jsonify

from app.core import err, params_int, params_str

from . import service

bp = Blueprint("goodshort", __name__, url_prefix="/goodshort")


@bp.get("/home")
def route_home():
    return jsonify(service.home(params_int("page", 1), params_str("channel", "id")))


@bp.get("/search")
def route_search():
    kw = params_str("q") or params_str("kw")
    if not kw:
        return jsonify(err("search", "goodshort", "param q wajib diisi"))
    return jsonify(service.search(kw, params_int("page", 1)))


@bp.get("/detail")
def route_detail():
    bid = params_str("id")
    if not bid:
        return jsonify(err("detail", "goodshort", "param id wajib diisi"))
    return jsonify(service.detail(bid))


@bp.get("/stream")
def route_stream():
    bid = params_str("id")
    if not bid:
        return jsonify(err("stream", "goodshort", "param id wajib diisi"))
    return jsonify(
        service.stream(bid, params_int("ep", 1), params_str("quality", "720p"))
    )


@bp.get("/stream_fast")
def route_stream_fast():
    bid = params_str("id")
    if not bid:
        return jsonify(err("stream_fast", "goodshort", "param id wajib diisi"))
    return jsonify(
        service.stream_fast(bid, params_int("ep", 1), params_str("quality", "720p"))
    )


@bp.get("/unlock")
def route_unlock():
    bid = params_str("id")
    if not bid:
        return jsonify(err("unlock", "goodshort", "param id wajib diisi"))
    return jsonify(service.unlock_all(bid, params_str("quality", "720p")))
