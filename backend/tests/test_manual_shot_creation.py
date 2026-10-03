"""Manual creation persists explicit director choices without invented camera defaults."""

import pytest
from pydantic import ValidationError
from app.schemas.studio.shots import ShotCreate
from app.services.studio import shots


def test_manual_detail_requires_explicit_camera_choices():
    """Partial camera choices must not silently receive fabricated defaults."""
    with pytest.raises(ValidationError):
        ShotCreate(id="s", chapter_id="c", index=1, title="Manual", detail={"duration": 3})


@pytest.mark.asyncio
async def test_manual_creation_persists_shot_and_detail_without_commit(monkeypatch):
    """Both writes remain within the caller's transaction with the same immutable ID."""
    saved = []

    async def check(*args, **kwargs):
        """Use in-memory existence checks without a real database."""
        return None

    async def persist(db, obj):
        """Capture writes while deliberately leaving commit to the request dependency."""
        saved.append(obj)
        return obj

    monkeypatch.setattr(shots, "ensure_not_exists", check)
    monkeypatch.setattr(shots, "require_entity", check)
    monkeypatch.setattr(shots, "create_and_refresh", persist)
    body = ShotCreate(id="s", chapter_id="c", index=1, title="Manual", detail={
        "camera_shot": "CU", "angle": "EYE_LEVEL", "movement": "STATIC", "duration": 3,
    })
    result = await shots.create(object(), body=body)
    assert len(saved) == 2
    assert result.id == saved[1].id == "s"
    assert saved[1].camera_shot == "CU"
    assert saved[1].duration == 3
    assert result.status == "pending"

def test_detail_write_failure_rolls_back_request(monkeypatch):
    """Exercise the real request transaction: second-write failure cannot acknowledge success."""
    from fastapi import Depends, FastAPI
    from fastapi.testclient import TestClient
    from app import dependencies

    events = []

    class Session:
        """Track staging and rollback without touching live project data."""
        async def __aenter__(self):
            """Open the request session."""
            return self

        async def __aexit__(self, *_args):
            """The dependency manages explicit cleanup."""

        async def commit(self):
            """A broken detail write must never reach this method."""
            events.append("commit")

        async def rollback(self):
            """Record rollback of the staged shot."""
            events.append("rollback")

        async def close(self):
            """Record cleanup."""
            events.append("close")

    async def check(*_args, **_kwargs):
        """Keep existence checks independent of external databases."""

    async def persist(_db, obj):
        """Fail the detail write after the first shot has been staged."""
        events.append(type(obj).__name__)
        if len(events) == 2:
            raise RuntimeError("test-only detail persistence failure")
        return obj

    monkeypatch.setattr(dependencies, "async_session_maker", Session)
    monkeypatch.setattr(shots, "ensure_not_exists", check)
    monkeypatch.setattr(shots, "require_entity", check)
    monkeypatch.setattr(shots, "create_and_refresh", persist)
    app = FastAPI()

    @app.post("/manual-shot")
    async def create(body: ShotCreate, db=Depends(dependencies.get_db, scope="function")):
        """Run the actual service under the production transaction dependency."""
        return await shots.create(db, body=body)

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.post("/manual-shot", json={
            "id": "s", "chapter_id": "c", "index": 1, "title": "Manual",
            "detail": {"camera_shot": "CU", "angle": "EYE_LEVEL", "movement": "STATIC", "duration": 3},
        })
    assert response.status_code == 500
    assert events == ["Shot", "ShotDetail", "rollback", "close"]
