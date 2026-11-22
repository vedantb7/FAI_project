"""Flask application factory and production entry point (P08).

Initializes application blueprints, JSON error handlers, and serves the built
React frontend if present in `web/frontend/dist`.
"""
from __future__ import annotations

import argparse
import os
import signal
import sys
from flask import Flask, jsonify, request, send_from_directory

from web.backend.routes_games import games_bp
from web.backend.routes_data import data_bp


def create_app(test_config: dict | None = None) -> Flask:
    """Creates and configures the Flask web application."""
    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False

    if test_config:
        app.config.update(test_config)

    # Register blueprints
    app.register_blueprint(games_bp)
    app.register_blueprint(data_bp)

    # Split hosting (site on GitHub Pages, API on a Hugging Face Space): allow exactly the
    # configured site origin. Unset = same-origin only, as before.
    allowed_origin = app.config.get("ALLOWED_ORIGIN", os.environ.get("WALLZ_ALLOWED_ORIGIN", "")).rstrip("/")
    # Public deployments disable the CPU-heavy live training and replay uploads.
    public = bool(app.config.get("PUBLIC", os.environ.get("WALLZ_PUBLIC") == "1"))

    @app.before_request
    def guard_public():
        if request.method == "OPTIONS" and allowed_origin:
            return "", 204  # CORS preflight; headers added below
        if public and (request.path.startswith("/api/training/live") or request.path == "/api/replays/upload"):
            return jsonify({"error": "Disabled on the public demo; run the app locally to use it.", "code": 403}), 403

    @app.after_request
    def add_cors(resp):
        if allowed_origin and request.headers.get("Origin", "").rstrip("/") == allowed_origin:
            resp.headers["Access-Control-Allow-Origin"] = allowed_origin
            resp.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
            resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
            resp.headers["Vary"] = "Origin"
        return resp

    # Global JSON error handlers
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"error": getattr(e, "description", "Bad Request"), "code": 400}), 400

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": getattr(e, "description", "Not Found"), "code": 404}), 404

    @app.errorhandler(409)
    def conflict(e):
        return jsonify({"error": getattr(e, "description", "Conflict"), "code": 409}), 409

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": getattr(e, "description", "Internal Server Error"), "code": 500}), 500

    # Serve built React frontend if present
    frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path):
        if path.startswith("api/"):
            return jsonify({"error": "Endpoint not found", "code": 404}), 404
        if os.path.exists(os.path.join(frontend_dist, path)) and path != "":
            return send_from_directory(frontend_dist, path)
        if os.path.exists(os.path.join(frontend_dist, "index.html")):
            return send_from_directory(frontend_dist, "index.html")
        return jsonify({
            "message": "Modified Wallz Web API Running",
            "frontend_status": "built dist not found (run npm build in web/frontend)",
            "api_endpoints": [
                "/api/config/defaults",
                "/api/agents",
                "/api/games",
            ],
        })

    return app


def main():
    parser = argparse.ArgumentParser(description="Run Modified Wallz Web Server.")
    parser.add_argument("--port", type=int, default=5000, help="Port to listen on (default 5000)")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host interface (default 127.0.0.1)")
    parser.add_argument("--debug", action="store_true", help="Enable Flask debug mode")
    parser.add_argument("--no-warmup", action="store_true",
                        help="Do not pre-solve exact-solver presets in the background")

    args = parser.parse_args()
    # As PID 1 in a container, Python ignores SIGTERM unless it installs a handler
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    app = create_app()
    # With --debug the reloader starts a watcher process plus a serving child; warm up only
    # in the process that actually serves requests.
    serving_process = not args.debug or os.environ.get("WERKZEUG_RUN_MAIN") == "true"
    if serving_process and not args.no_warmup:
        from web.backend.registry import warm_exact_presets
        warm_exact_presets()
    print(f"Starting Wallz Web Demo server on http://{args.host}:{args.port}")
    app.run(host=args.host, port=args.port, debug=args.debug)


if __name__ == "__main__":
    main()
