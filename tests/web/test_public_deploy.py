"""Split hosting: CORS for exactly one site origin, and public mode blocks the heavy endpoints."""
from __future__ import annotations

from web.backend.app import create_app

SITE = "https://example.github.io"


def client(**cfg):
    return create_app({"TESTING": True, **cfg}).test_client()


def test_no_cors_by_default():
    resp = client().get("/api/config/defaults", headers={"Origin": SITE})
    assert resp.status_code == 200
    assert "Access-Control-Allow-Origin" not in resp.headers


def test_cors_only_for_the_configured_origin():
    c = client(ALLOWED_ORIGIN=SITE + "/")
    ok = c.get("/api/config/defaults", headers={"Origin": SITE})
    assert ok.headers["Access-Control-Allow-Origin"] == SITE
    other = c.get("/api/config/defaults", headers={"Origin": "https://evil.example"})
    assert "Access-Control-Allow-Origin" not in other.headers
    pre = c.open("/api/games", method="OPTIONS", headers={"Origin": SITE})
    assert pre.status_code == 204 and pre.headers["Access-Control-Allow-Origin"] == SITE


def test_public_mode_blocks_live_training_and_uploads():
    c = client(PUBLIC=True)
    assert c.post("/api/training/live", json={"steps": 10}).status_code == 403
    assert c.post("/api/replays/upload", json={"replay": []}).status_code == 403
    assert c.get("/api/config/defaults").status_code == 200
