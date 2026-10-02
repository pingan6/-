"""Regression: acknowledge a database write only after its transaction commits."""

import pytest
from fastapi import Depends, FastAPI, HTTPException
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from app import dependencies
from app.main import app as official_app


class Session:
    """Track transaction outcomes without a database or external provider."""

    def __init__(self, events, fail_commit=False):
        self.events = events
        self.fail_commit = fail_commit

    async def __aenter__(self):
        """Return the fake per-request session."""
        return self

    async def __aexit__(self, *_args):
        """Leave closing to the real dependency's finally block."""

    async def commit(self):
        """Record commit and optionally simulate storage failure."""
        self.events.append("commit")
        if self.fail_commit:
            raise RuntimeError("test-only commit failure")

    async def rollback(self):
        """Record rollback for failure assertions."""
        self.events.append("rollback")

    async def close(self):
        """Record resource cleanup."""
        self.events.append("close")


def transaction_app(monkeypatch, events, *, fail_commit=False, fail_handler=False):
    """Exercise the real dependency and observe actual ASGI response start ordering."""
    monkeypatch.setattr(dependencies, "async_session_maker", lambda: Session(events, fail_commit))
    local_app = FastAPI()

    @local_app.post("/write")
    async def write(_db=Depends(dependencies.get_db, scope="function")):
        """Simulate business execution inside the same transaction boundary."""
        if fail_handler:
            raise HTTPException(400, "test-only rejected write")
        return {"saved": True}

    async def observe(scope, receive, send):
        """Observe response start without changing response content."""
        async def record(message):
            """Record sending the HTTP status before passing it through."""
            if message["type"] == "http.response.start":
                events.append(f"http_{message['status']}")
            await send(message)
        await local_app(scope, receive, record)

    return observe


def test_commit_before_success_response(monkeypatch):
    """Successful acknowledgement must follow commit and cleanup."""
    events = []
    with TestClient(transaction_app(monkeypatch, events)) as client:
        assert client.post("/write").status_code == 200
    assert events.index("commit") < events.index("http_200")
    assert "rollback" not in events


def test_commit_failure_never_returns_success(monkeypatch):
    """A failing commit must roll back and produce an error, not a late hidden failure."""
    events = []
    with TestClient(transaction_app(monkeypatch, events, fail_commit=True), raise_server_exceptions=False) as client:
        assert client.post("/write").status_code == 500
    assert "rollback" in events
    assert "close" in events
    assert "http_200" not in events


def test_rejected_write_rolls_back(monkeypatch):
    """Business rejection preserves rollback and cannot commit the request."""
    events = []
    with TestClient(transaction_app(monkeypatch, events, fail_handler=True)) as client:
        assert client.post("/write").status_code == 400
    assert "rollback" in events
    assert "commit" not in events


def test_every_registered_db_dependency_uses_function_scope():
    """Ensure existing API paths do not accidentally retain the old late-commit behavior."""
    checked = 0

    def check(dependant):
        """Check nested LLM/service dependencies as well as direct route dependencies."""
        nonlocal checked
        if dependant.call is dependencies.get_db:
            assert dependant.scope == "function"
            checked += 1
        for child in dependant.dependencies:
            check(child)

    for route in official_app.routes:
        if isinstance(route, APIRoute):
            check(route.dependant)
    assert checked > 20
