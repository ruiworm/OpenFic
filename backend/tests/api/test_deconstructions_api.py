# -*- coding: utf-8 -*-
"""小说拆书 API 集成测试。"""

import pytest
from httpx import AsyncClient

SAMPLE_REPORT_TEXT = """
【梗概】
测试小说梗概内容，五十个字以内快速了解整个故事的主线脉络。

【人设】
- 主角生存环境：赛博朋克霓虹都市底层维修工。
- 人物性格正面：沉着冷静、坚韧执着。
- 反差面：外表机械冷酷，内心留存着对旧时代的温情。

【世界观】
巨型企业托拉斯统治的高科技低生活世界，义体改造普及，脑机接口成为阶级壁垒。

【本文核心框架】
这是一个关于底层维修工利用失落古科技对抗科技寡头的故事。

【起承转合】
- 起：维修工意外拾得一枚未格式化的神秘军用脑核。
- 承：企业私兵登门追杀，主角逃亡废土并逐步解密脑核技术。
- 转：义体反抗军与财阀高层在天基轨道站展开全面对决。
- 合：黑进中央主控网络，解密罪证并公开所有受限科技。

【男女主角的欲望目标】
- 男主角：洗清罪名并揭开自己记忆篡改的真相。
- 女主角：摧毁脑机意识上传计划，解放底层民众。

【结构大纲】
- 导言结构：无
- 正文结构：
第一章：雨夜修配所与染血的芯片
第二章：潜入地下黑市
第三章：天基防御阵列的裂隙
第四章：黎明前夕的终局广播
"""


@pytest.mark.asyncio
async def test_get_default_prompt_template(client: AsyncClient) -> None:
    """测试获取内置 22 维拆书提示词模板。"""
    response = await client.get("/api/v1/deconstructions/prompt-template")
    assert response.status_code == 200
    data = response.json()
    assert "prompt_template" in data
    assert "【梗概】" in data["prompt_template"]
    assert "【结构大纲】" in data["prompt_template"]
    assert "【起承转合】" in data["prompt_template"]


@pytest.mark.asyncio
async def test_deconstruction_crud(client: AsyncClient) -> None:
    """测试拆书报告创建、查询、列表与删除。"""
    # 1. 创建/保存拆书报告
    create_res = await client.post(
        "/api/v1/deconstructions",
        json={
            "title": "《赛博边缘》深度拆解",
            "source_title": "赛博边缘",
            "source_preview": "雨夜修配所里...",
            "source_word_count": 8000,
            "source_text": "小说全文文本...",
            "model_id": "qwen-max",
            "prompt_template": "自定义模板",
            "report_markdown": SAMPLE_REPORT_TEXT,
        },
    )
    assert create_res.status_code == 201
    deconstruction = create_res.json()
    dec_id = deconstruction["id"]
    assert deconstruction["title"] == "《赛博边缘》深度拆解"
    assert deconstruction["source_title"] == "赛博边缘"

    # 2. 获取详情
    get_res = await client.get(f"/api/v1/deconstructions/{dec_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == dec_id
    assert "【梗概】" in get_res.json()["report_markdown"]

    # 3. 获取列表
    list_res = await client.get("/api/v1/deconstructions?search=赛博")
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] >= 1
    assert any(item["id"] == dec_id for item in list_data["items"])

    # 4. 删除
    del_res = await client.delete(f"/api/v1/deconstructions/{dec_id}")
    assert del_res.status_code == 204

    # 再次获取返回 404
    not_found = await client.get(f"/api/v1/deconstructions/{dec_id}")
    assert not_found.status_code == 404


@pytest.mark.asyncio
async def test_create_project_from_deconstruction(client: AsyncClient) -> None:
    """测试根据拆解报告一键生成仿写新书项目。"""
    # 先创建一份拆解报告
    create_res = await client.post(
        "/api/v1/deconstructions",
        json={
            "title": "《赛博新篇》拆解",
            "source_title": "赛博新篇",
            "source_text": "原书内容",
            "report_markdown": SAMPLE_REPORT_TEXT,
        },
    )
    assert create_res.status_code == 201
    dec_id = create_res.json()["id"]

    # 一键转化为新书项目
    scaffold_res = await client.post(
        f"/api/v1/deconstructions/{dec_id}/create-project",
        json={
            "title": "我的仿写赛博大作",
            "description": "自定义简介",
        },
    )
    assert scaffold_res.status_code == 201
    project_data = scaffold_res.json()
    project_id = project_data["project_id"]
    assert project_data["title"] == "我的仿写赛博大作"

    # 验证新项目的角色
    chars_res = await client.get(f"/api/v1/projects/{project_id}/characters")
    assert chars_res.status_code == 200
    chars = chars_res.json()["items"]
    char_names = [c["name"] for c in chars]
    assert "男主角" in char_names
    assert "女主角" in char_names

    # 验证新项目的章节大纲
    volumes_res = await client.get(f"/api/v1/projects/{project_id}/chapters")
    assert volumes_res.status_code == 200
    vol_tree = volumes_res.json()
    assert vol_tree["total_chapters"] >= 4
    first_vol = vol_tree["volumes"][0]
    chapter_titles = [chap["title"] for chap in first_vol["chapters"]]
    assert any("第一章" in t for t in chapter_titles)
    assert any("第四章" in t for t in chapter_titles)

    # 验证新项目的拆解参考笔记
    notes_res = await client.get(f"/api/v1/projects/{project_id}/notes")
    assert notes_res.status_code == 200
    notes_data = notes_res.json()
    assert notes_data["total_notes"] >= 1
    root_notes = notes_data["root_notes"]
    assert any("拆书参考" in n["title"] for n in root_notes)


@pytest.mark.asyncio
async def test_export_deconstruction_to_note(client: AsyncClient) -> None:
    """测试将拆书报告归档到现有小说的笔记中。"""
    # 1. 创建目标项目
    proj_res = await client.post(
        "/api/v1/projects",
        data={"title": "已有小说项目"},
    )
    assert proj_res.status_code == 201
    project_id = proj_res.json()["id"]

    # 2. 创建拆解报告
    create_res = await client.post(
        "/api/v1/deconstructions",
        json={
            "title": "《参考神作》拆解",
            "source_title": "参考神作",
            "report_markdown": SAMPLE_REPORT_TEXT,
        },
    )
    assert create_res.status_code == 201
    dec_id = create_res.json()["id"]

    # 3. 归档到笔记
    export_res = await client.post(
        f"/api/v1/deconstructions/{dec_id}/export-to-note",
        json={"project_id": project_id},
    )
    assert export_res.status_code == 201
    export_data = export_res.json()
    assert export_data["project_id"] == project_id
    assert "参考神作" in export_data["title"]

    # 检查笔记列表
    notes_res = await client.get(f"/api/v1/projects/{project_id}/notes")
    assert notes_res.status_code == 200
    assert notes_res.json()["total_notes"] >= 1
