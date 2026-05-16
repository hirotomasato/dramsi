"""Response envelope yang konsisten untuk semua endpoint API."""

from __future__ import annotations

from typing import Any, Dict

from flask import current_app


def _creator() -> str:
    try:
        return current_app.config.get("CREATOR", "MasantoID")
    except RuntimeError:
        return "MasantoID"


def ok(action: str, source: str, result: Any) -> Dict[str, Any]:
    return {
        "creator": _creator(),
        "status": True,
        "code": 200,
        "action": action,
        "source": source,
        "result": result,
    }


def err(action: str, source: str, message: str, code: int = 400) -> Dict[str, Any]:
    return {
        "creator": _creator(),
        "status": False,
        "code": code,
        "action": action,
        "source": source,
        "message": message,
    }
