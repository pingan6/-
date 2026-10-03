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
