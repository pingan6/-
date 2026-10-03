"""Free local API smoke tests; preserve all test records and never invoke a model."""

from pathlib import Path
from uuid import uuid4

import httpx
import pytest

BASE_URL = "http://127.0.0.1:8010"
ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="module")
def api():
    """Connect only to this isolated local deployment, without inherited proxies."""
    with httpx.Client(base_url=BASE_URL, timeout=30, trust_env=False) as client:
        yield client


def data(response, expected=200):
    """Check the official response envelope without logging credentials or bodies."""
    assert response.status_code == expected, f"HTTP {response.status_code}: {response.request.url.path}"
    payload = response.json()
    assert payload["code"] == expected
    return payload["data"]


@pytest.fixture(scope="module")
def sample(api):
    """Create an identifiable test-only project, chapter and manual shot in MySQL."""
    project_id, chapter_id, shot_id = (str(uuid4()) for _ in range(3))
    options = data(api.get("/api/v1/studio/projects/style-options"))
    visual_style = options["visual_styles"][0]["value"]
    style = options["default_style_by_visual_style"][visual_style]
    project = data(api.post("/api/v1/studio/projects", json={
        "id": project_id, "name": "自动验收样本（无模型调用）",
        "description": "本机免费管理流程验收，保留用于追溯。",
        "style": style, "visual_style": visual_style,
    }), 201)
    chapter = data(api.post("/api/v1/studio/chapters", json={
        "id": chapter_id, "project_id": project_id, "index": 1,
        "title": "管理流程验收", "raw_text": "人物把文件放在桌上。",
    }), 201)
    shot = data(api.post("/api/v1/studio/shots", json={
        "id": shot_id, "chapter_id": chapter_id, "index": 1,
        "title": "验收镜头", "script_excerpt": chapter["raw_text"],
    }), 201)
    # Manual/API-created shots need their separate official detail resource.
    data(api.post("/api/v1/studio/shot-details", json={
        "id": shot_id, "camera_shot": "MS", "angle": "EYE_LEVEL",
        "movement": "STATIC", "duration": 4, "action_beats": ["把文件放在桌上"],
    }), 201)
    return {"project": project, "chapter": chapter, "shot": shot}


def test_health_and_original_ui(api):
    """Verify real API health and the original built frontend, not a mock server."""
    assert data(api.get("/health"))["status"] == "ok"
    response = api.get("http://127.0.0.1:7788")
    assert response.status_code == 200
    assert "平安科技" in response.text


@pytest.mark.parametrize("path", ["/projects", "/assets?tab=actor", "/prompts", "/models", "/settings"])
def test_frontend_routes_refresh_without_redirect(api, path):
    """SPA routes must serve the app directly, including the static-directory collision."""
    response = api.get(f"http://127.0.0.1:7788{path}")
    assert response.status_code == 200
    assert "location" not in response.headers
    assert "平安科技" in response.text


def test_project_chapter_shot_persistence(api, sample):
    """Verify the hierarchy round-trips and a manual edit persists."""
    for kind, route in (("project", "projects"), ("chapter", "chapters"), ("shot", "shots")):
        item = sample[kind]
        assert data(api.get(f"/api/v1/studio/{route}/{item['id']}"))["id"] == item["id"]
    shot_id = sample["shot"]["id"]
    assert data(api.get(f"/api/v1/studio/shot-details/{shot_id}"))["id"] == shot_id
    data(api.patch(f"/api/v1/studio/shots/{shot_id}", json={"title": "已保存的验收镜头"}))
    assert data(api.get(f"/api/v1/studio/shots/{shot_id}"))["title"] == "已保存的验收镜头"


@pytest.mark.parametrize("kind", ["actor", "character", "scene", "prop", "costume"])
def test_asset_management(api, sample, kind):
    """Verify each original asset type can be created, read and edited without AI."""
    project = sample["project"]
    entity_id = str(uuid4())
    payload = {
        "id": entity_id, "name": f"本机验收 {kind} {entity_id[:8]}", "project_id": project["id"],
        "description": "手工验收资料", "style": project["style"],
        "visual_style": project["visual_style"],
    }
    path = f"/api/v1/studio/entities/{kind}"
    assert data(api.post(path, json=payload), 201)["id"] == entity_id
    data(api.patch(f"{path}/{entity_id}", json={"description": "已验证编辑保存"}))
    assert data(api.get(f"{path}/{entity_id}"))["description"] == "已验证编辑保存"


def test_prompt_model_task_management_reads(api):
    """Read official management endpoints; do not dispatch extraction or generation."""
    templates = data(api.get("/api/v1/studio/prompts"))["items"]
    assert len(templates) >= 6
    for path in ("/api/v1/llm/providers", "/api/v1/llm/models", "/api/v1/film/tasks"):
        data(api.get(path))


def test_file_upload_download_and_browser_url(api):
    """Verify real S3 upload, API download and browser-accessible media URL."""
    image = ROOT / "site/static/images/screenshots/project.png"
    content = image.read_bytes()
    filename = f"local-acceptance-{uuid4()}.png"
    uploaded = data(api.post("/api/v1/studio/files/upload", files={
        "file": (filename, content, "image/png"),
    }), 201)
    downloaded = api.get(f"/api/v1/studio/files/{uploaded['id']}/download")
    assert downloaded.status_code == 200
    assert downloaded.content == content
    thumbnail = uploaded["thumbnail"]
    assert thumbnail.startswith("http://127.0.0.1:9002/")
    public_file = api.get(thumbnail)
    assert public_file.status_code == 200
    assert public_file.content == content


def test_manual_shot_preparation_queries(api, sample):
    """Read editing and generation readiness without approving or running a model."""
    shot_id = sample["shot"]["id"]
    for suffix in ("preparation-state", "video-readiness", "linked-assets", "extracted-candidates"):
        data(api.get(f"/api/v1/studio/shots/{shot_id}/{suffix}"))


def test_api_validation(api):
    """Verify malformed project input is rejected rather than persisted."""
    response = api.post("/api/v1/studio/projects", json={"name": "缺失字段"})
    assert response.status_code == 422
