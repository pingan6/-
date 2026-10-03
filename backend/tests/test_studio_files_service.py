from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import Base
from app.models.studio import (
    Chapter,
    FileItem,
    FileType,
    FileUsageKind,
    Project,
    ProjectStyle,
    ProjectVisualStyle,
    Shot,
)
from app.schemas.studio.files import FileUpdate
from app.services.studio.files import get_file_detail, list_files_paginated, update_file_meta


@pytest.mark.asyncio
@pytest.mark.parametrize("field", ["name", "thumbnail", "tags"])
async def test_null_file_metadata_is_rejected_before_mutation(field) -> None:
    """Explicit null cannot become a database 500 or destroy existing metadata."""
    from fastapi import HTTPException

    db, engine = await _build_session()
    async with db:
        file = FileItem(id="f", type=FileType.image, name="Original", thumbnail="thumb", tags=["tag"], storage_key="original.png")
        db.add(file)
        await db.commit()
        with pytest.raises(HTTPException) as exc:
            await update_file_meta(db, file_id="f", body=FileUpdate(**{field: None}))
        assert exc.value.status_code == 400
        assert exc.value.detail == f"{field} cannot be null"
        assert file.name == "Original"
        assert file.thumbnail == "thumb"
        assert file.tags == ["tag"]
        await update_file_meta(db, file_id="f", body=FileUpdate(name="", thumbnail="", tags=[]))
        assert file.name == "" and file.thumbnail == "" and file.tags == []
    await engine.dispose()


@pytest.mark.asyncio
async def test_file_usage_rejects_cross_project_and_cross_chapter_references() -> None:
    """Foreign keys alone cannot protect the hierarchy; mismatched valid IDs must fail."""
    from fastapi import HTTPException
    from app.services.studio.file_usages import validate_file_usage_scope

    db, engine = await _build_session()
    async with db:
        await _seed_scope_graph(db)
        db.add_all([
            Project(id="p2", name="Other", description="", style=ProjectStyle.real_people_city, visual_style=ProjectVisualStyle.live_action),
            Chapter(id="c2", project_id="p2", index=1, title="Other"),
            Chapter(id="c3", project_id="p1", index=2, title="Same project, different chapter"),
            Shot(id="s2", chapter_id="c2", index=1, title="Other"),
        ])
        await db.commit()
        await validate_file_usage_scope(db, project_id="p1", chapter_id="c1", shot_id="s1")
        await validate_file_usage_scope(db, project_id="p1", chapter_id=None, shot_id="s1")
        for project_id, chapter_id, shot_id in [
            ("missing", None, None), ("p1", "missing", None), ("p1", None, "missing"),
            ("p1", "c2", None), ("p1", None, "s2"), ("p1", "c3", "s1"),
        ]:
            with pytest.raises(HTTPException) as exc:
                await validate_file_usage_scope(db, project_id=project_id, chapter_id=chapter_id, shot_id=shot_id)
            assert exc.value.status_code == 400
    await engine.dispose()


@pytest.mark.asyncio
async def test_invalid_upload_scope_never_writes_storage(monkeypatch) -> None:
    """Invalid references must be rejected before remote storage side effects."""
    from io import BytesIO
    from fastapi import HTTPException, UploadFile
    from app.services.studio import files

    calls = []

    async def upload(**kwargs):
        """An invalid request must never reach this storage replacement."""
        calls.append(kwargs)
        raise AssertionError("unexpected storage write")

    monkeypatch.setattr(files.storage, "upload_file", upload)
    db, engine = await _build_session()
    async with db:
        for kwargs in [{"project_id": "missing"}, {"chapter_id": "c1"}, {"shot_id": "s1"}]:
            with pytest.raises(HTTPException) as exc:
                await files.upload_file(db, file=UploadFile(filename="image.png", file=BytesIO(b"image")), **kwargs)
            assert exc.value.status_code == 400
        assert calls == []
    await engine.dispose()


@pytest.mark.asyncio
async def test_same_filename_uploads_preserve_independent_objects(monkeypatch) -> None:
    """Repeated names and client paths cannot overwrite an earlier upload's content."""
    from io import BytesIO
    from types import SimpleNamespace
    from fastapi import UploadFile
    from app.services.studio import files

    objects = {}

    async def upload(*, key, data, **_kwargs):
        """Simulate object storage, where the same key would overwrite prior bytes."""
        objects[key] = data
        return SimpleNamespace(url=f"https://storage.invalid/{key}")

    monkeypatch.setattr(files.storage, "upload_file", upload)
    db, engine = await _build_session()
    async with db:
        first = await files.upload_file(db, file=UploadFile(filename="../poster.png", file=BytesIO(b"first")))
        second = await files.upload_file(db, file=UploadFile(filename="C:\\images\\poster.png", file=BytesIO(b"second")))
        await db.commit()
        assert first.id != second.id
        assert first.storage_key != second.storage_key
        assert objects[first.storage_key] == b"first"
        assert objects[second.storage_key] == b"second"
        for key in objects:
            assert key.startswith("files/")
            assert key.endswith("/poster.png")
            assert ".." not in key and "\\" not in key and "C:" not in key
    await engine.dispose()


async def _build_session() -> tuple[AsyncSession, object]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    session_local = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    return session_local(), engine


async def _seed_scope_graph(db: AsyncSession) -> None:
    project = Project(
        id="p1",
        name="项目一",
        description="",
        style=ProjectStyle.real_people_city,
        visual_style=ProjectVisualStyle.live_action,
    )
    chapter = Chapter(id="c1", project_id="p1", index=1, title="第一章")
    shot = Shot(id="s1", chapter_id="c1", index=1, title="镜头一")
    db.add_all([project, chapter, shot])
    await db.commit()


@pytest.mark.asyncio
async def test_list_files_paginated_filters_by_keyword() -> None:
    db, engine = await _build_session()
    async with db:
        db.add_all(
            [
                FileItem(id="f1", type=FileType.image, name="角色主图", thumbnail="", tags=[], storage_key="files/a.png"),
                FileItem(id="f2", type=FileType.video, name="片段视频", thumbnail="", tags=[], storage_key="files/b.mp4"),
            ]
        )
        await db.commit()

        resp = await list_files_paginated(
            db,
            q="角色",
            order="name",
            is_desc=False,
            page=1,
            page_size=10,
        )

        assert resp.data is not None
        assert resp.data.pagination.total == 1
        assert [item.id for item in resp.data.items] == ["f1"]
    await engine.dispose()


@pytest.mark.asyncio
async def test_get_file_detail_includes_usages() -> None:
    db, engine = await _build_session()
    async with db:
        await _seed_scope_graph(db)
        db.add(
            FileItem(
                id="f1",
                type=FileType.image,
                name="角色主图",
                thumbnail="thumb",
                tags=["hero"],
                storage_key="files/a.png",
            )
        )
        await db.commit()

        await update_file_meta(
            db,
            file_id="f1",
            body=FileUpdate(
                usage={
                    "project_id": "p1",
                    "chapter_id": "c1",
                    "shot_id": "s1",
                    "usage_kind": FileUsageKind.upload,
                    "source_ref": "manual",
                }
            ),
        )

        detail = await get_file_detail(db, file_id="f1")

        assert detail.id == "f1"
        assert len(detail.usages) == 1
        assert detail.usages[0].project_id == "p1"
        assert detail.usages[0].chapter_id == "c1"
        assert detail.usages[0].shot_id == "s1"
        assert detail.usages[0].usage_kind == FileUsageKind.upload
    await engine.dispose()


@pytest.mark.asyncio
async def test_update_file_meta_updates_fields_and_upserts_usage() -> None:
    db, engine = await _build_session()
    async with db:
        await _seed_scope_graph(db)
        db.add(
            FileItem(
                id="f1",
                type=FileType.image,
                name="旧名称",
                thumbnail="old",
                tags=["old"],
                storage_key="files/a.png",
            )
        )
        await db.commit()

        updated = await update_file_meta(
            db,
            file_id="f1",
            body=FileUpdate(
                name="新名称",
                thumbnail="new-thumb",
                tags=["hero", "poster"],
                usage={
                    "project_id": "p1",
                    "chapter_id": "c1",
                    "shot_id": "s1",
                    "usage_kind": FileUsageKind.asset_image,
                    "source_ref": "slot-1",
                },
            ),
        )
        updated_again = await update_file_meta(
            db,
            file_id="f1",
            body=FileUpdate(
                usage={
                    "project_id": "p1",
                    "chapter_id": "c1",
                    "shot_id": "s1",
                    "usage_kind": FileUsageKind.asset_image,
                    "source_ref": "slot-1",
                }
            ),
        )
        detail = await get_file_detail(db, file_id="f1")

        assert updated.name == "新名称"
        assert updated.thumbnail == "new-thumb"
        assert updated.tags == ["hero", "poster"]
        assert updated_again.id == "f1"
        assert len(detail.usages) == 1
        assert detail.usages[0].usage_kind == FileUsageKind.asset_image
        assert detail.usages[0].source_ref == "slot-1"
    await engine.dispose()
