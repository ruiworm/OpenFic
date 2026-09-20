# -*- coding: utf-8 -*-
"""伏笔与线索 API 测试。"""

import pytest
from httpx import AsyncClient


async def create_project(client: AsyncClient, title: str) -> str:
    response = await client.post("/api/v1/projects", data={"title": title})
    assert response.status_code == 201
    return response.json()["id"]


@pytest.mark.asyncio
async def test_create_and_get_foreshadowing(client: AsyncClient) -> None:
    project_id = await create_project(client, "伏笔测试项目")

    # 创建伏笔
    payload = {
        "title": "黑色指环的灼热异象",
        "description": "每次遇到魔教中人，主角手指上的黑色指环都会发烫",
        "status": "planted",
        "importance": "major",
        "character_ids": ["char_hero_1"],
        "notes": "计划在第三卷收束为掌门当年的定情信物",
    }
    create_res = await client.post(
        f"/api/v1/projects/{project_id}/foreshadowings",
        json=payload,
    )
    assert create_res.status_code == 201
    data = create_res.json()
    assert data["title"] == payload["title"]
    assert data["status"] == "planted"
    assert data["importance"] == "major"
    assert data["character_ids"] == ["char_hero_1"]
    foreshadowing_id = data["id"]

    # 查询详情
    get_res = await client.get(
        f"/api/v1/projects/{project_id}/foreshadowings/{foreshadowing_id}"
    )
    assert get_res.status_code == 200
    detail = get_res.json()
    assert detail["id"] == foreshadowing_id
    assert detail["notes"] == payload["notes"]


@pytest.mark.asyncio
async def test_list_foreshadowings_with_filters(client: AsyncClient) -> None:
    project_id = await create_project(client, "伏笔筛选测试项目")

    # 创建 3 个不同状态的伏笔
    f1 = await client.post(
        f"/api/v1/projects/{project_id}/foreshadowings",
        json={"title": "伏笔1", "status": "planted", "importance": "major"},
    )
    assert f1.status_code == 201

    f2 = await client.post(
        f"/api/v1/projects/{project_id}/foreshadowings",
        json={"title": "伏笔2", "status": "resolved", "importance": "minor"},
    )
    assert f2.status_code == 201

    # 查全部
    list_all = await client.get(f"/api/v1/projects/{project_id}/foreshadowings")
    assert list_all.status_code == 200
    assert list_all.json()["total"] == 2

    # 按 status 过滤
    list_planted = await client.get(
        f"/api/v1/projects/{project_id}/foreshadowings?status=planted"
    )
    assert list_planted.status_code == 200
    items = list_planted.json()["items"]
    assert len(items) == 1
    assert items[0]["title"] == "伏笔1"

    # 按 importance 过滤
    list_minor = await client.get(
        f"/api/v1/projects/{project_id}/foreshadowings?importance=minor"
    )
    assert list_minor.status_code == 200
    assert len(list_minor.json()["items"]) == 1
    assert list_minor.json()["items"][0]["title"] == "伏笔2"


@pytest.mark.asyncio
async def test_update_and_delete_foreshadowing(client: AsyncClient) -> None:
    project_id = await create_project(client, "伏笔更新与删除测试")

    create_res = await client.post(
        f"/api/v1/projects/{project_id}/foreshadowings",
        json={"title": "古玉碎片", "status": "planted"},
    )
    assert create_res.status_code == 201
    f_id = create_res.json()["id"]

    # 更新为 resolved
    patch_res = await client.patch(
        f"/api/v1/projects/{project_id}/foreshadowings/{f_id}",
        json={
            "status": "resolved",
            "resolved_chapter_id": "chap_10",
            "notes": "已在第十章与玉佩合为一体",
        },
    )
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["status"] == "resolved"
    assert updated["resolved_chapter_id"] == "chap_10"
    assert "玉佩" in updated["notes"]

    # 删除
    del_res = await client.delete(
        f"/api/v1/projects/{project_id}/foreshadowings/{f_id}"
    )
    assert del_res.status_code == 204

    # 再次查询应返回 404
    get_res = await client.get(
        f"/api/v1/projects/{project_id}/foreshadowings/{f_id}"
    )
    assert get_res.status_code == 404
