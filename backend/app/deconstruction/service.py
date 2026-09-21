# -*- coding: utf-8 -*-
"""小说拆书业务逻辑与仿写项目生成服务。"""

import json
import re
from typing import Any, AsyncGenerator

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import EncryptionService
from app.core.errors import NotFoundError
from app.deconstruction.prompt import (
    DEFAULT_DECONSTRUCTION_PROMPT,
    build_deconstruction_messages,
)
from app.models.clients import LLMClient, LLMConfig
from app.models.repos import model_provider_repo, model_repo
from app.models.services.model_provider_service import ModelProviderService
from app.settings import settings
from app.storage.models.character import Character
from app.storage.models.deconstruction import Deconstruction
from app.storage.models.note import Note
from app.storage.models.project import Project
from app.storage.models.world_info import WorldInfo
from app.storage.models.world_info_entry import WorldInfoEntry
from app.storage.repos import (
    character_repo,
    deconstruction_repo,
    note_repo,
    project_repo,
    setting_repo,
    volume_repo,
    world_info_entry_repo,
    world_info_repo,
)
from app.storage.services import chapter_service, volume_service


async def resolve_deconstruction_llm(
    session: AsyncSession,
    *,
    model_id: str | None = None,
    provider_id: str | None = None,
) -> LLMClient:
    """
    智能解析用于拆书分析的 LLM 客户端：
    1. 优先使用传入的 provider_id（直接解密该服务商用户配置的 API Key 并配合指定 model_id/模型名称）；
    2. 支持 model_id 格式形如 'provider_id::model_name' 的组合参数；
    3. 支持 model_id 匹配已登记的本地模型 ID；
    4. 兜底回退到系统 default_model，或寻找用户已配置 API Key 的第一个有效服务商。
    """
    encryption_service = EncryptionService(settings.encryption_key)
    provider_service = ModelProviderService(encryption_service)

    # 1. 检查 model_id 是否带有 provider 前缀 "provider_id::model_name"
    target_provider_id = provider_id
    target_model_name = model_id

    if target_model_name and "::" in target_model_name:
        parts = target_model_name.split("::", 1)
        if not target_provider_id:
            target_provider_id = parts[0]
        target_model_name = parts[1]

    # 2. 如果指定了 provider_id
    if target_provider_id:
        provider = await model_provider_repo.get_by_id(session, target_provider_id)
        if not provider:
            raise ValueError(f"指定的模型服务商不存在 (ID: {target_provider_id})")

        api_key = encryption_service.decrypt(provider.api_key_encrypted)
        if not api_key or not api_key.strip():
            raise ValueError(f"服务商「{provider.name}」尚未配置有效 API Key，请在设置中配置 API Key 后再试")

        custom_headers = provider_service.get_decrypted_custom_headers(provider)
        actual_model_name = target_model_name
        if not actual_model_name or actual_model_name == "default":
            registered = await model_repo.get_by_provider_id(session, provider.id)
            llm_registered = [m for m in registered if m.task_type == "llm"]
            if llm_registered:
                actual_model_name = llm_registered[0].model_id
            else:
                if provider.provider_type == "deepseek":
                    actual_model_name = "deepseek-chat"
                elif provider.provider_type in ("openai", "azure"):
                    actual_model_name = "gpt-4o"
                elif provider.provider_type == "anthropic":
                    actual_model_name = "claude-3-5-sonnet-20241022"
                elif provider.provider_type == "google_genai":
                    actual_model_name = "gemini-1.5-pro"
                else:
                    actual_model_name = "default"

        return LLMClient(
            LLMConfig(
                provider_type=provider.provider_type,
                base_url=provider.url,
                api_key=api_key,
                model_id=actual_model_name,
                custom_headers=custom_headers or None,
                request_timeout=int(settings.llm_request_timeout),
            )
        )

    # 3. 如果指定了已登记的 model_id (通过 model_repo 查找)
    if target_model_name:
        model = await model_repo.get_by_id(session, target_model_name)
        if model:
            provider = await model_provider_repo.get_by_id(session, model.provider_id)
            if not provider:
                raise ValueError(f"模型关联的服务商不存在 (ID: {model.provider_id})")
            api_key = encryption_service.decrypt(provider.api_key_encrypted)
            if not api_key or not api_key.strip():
                raise ValueError(f"服务商「{provider.name}」尚未配置有效 API Key，请在设置中配置 API Key 后再试")
            custom_headers = provider_service.get_decrypted_custom_headers(provider)
            return LLMClient(
                LLMConfig(
                    provider_type=provider.provider_type,
                    base_url=provider.url,
                    api_key=api_key,
                    model_id=model.model_id,
                    custom_headers=custom_headers or None,
                    temperature=model.temperature,
                    top_p=model.top_p,
                    top_k=model.top_k,
                    min_p=model.min_p,
                    top_a=model.top_a,
                    max_tokens=model.max_tokens,
                    frequency_penalty=model.frequency_penalty,
                    presence_penalty=model.presence_penalty,
                    repetition_penalty=model.repetition_penalty,
                    request_timeout=int(settings.llm_request_timeout),
                )
            )

    # 4. 尝试通过 default_model 设置
    default_setting = await setting_repo.get_by_key(session, "default_model")
    if default_setting and default_setting.value and default_setting.value.strip():
        def_model = await model_repo.get_by_id(session, default_setting.value.strip())
        if def_model:
            provider = await model_provider_repo.get_by_id(session, def_model.provider_id)
            if provider and provider.api_key_encrypted:
                api_key = encryption_service.decrypt(provider.api_key_encrypted)
                if api_key and api_key.strip():
                    custom_headers = provider_service.get_decrypted_custom_headers(provider)
                    return LLMClient(
                        LLMConfig(
                            provider_type=provider.provider_type,
                            base_url=provider.url,
                            api_key=api_key,
                            model_id=def_model.model_id,
                            custom_headers=custom_headers or None,
                            request_timeout=int(settings.llm_request_timeout),
                        )
                    )

    # 5. 寻找第一个配置了 API Key 的外部服务商
    all_providers = await model_provider_repo.get_all(session)
    for prov in all_providers:
        if prov.is_builtin:
            continue
        api_key = encryption_service.decrypt(prov.api_key_encrypted)
        if api_key and api_key.strip():
            custom_headers = provider_service.get_decrypted_custom_headers(prov)
            registered = await model_repo.get_by_provider_id(session, prov.id)
            llm_models = [m for m in registered if m.task_type == "llm"]
            fallback_model = llm_models[0].model_id if llm_models else "default"
            return LLMClient(
                LLMConfig(
                    provider_type=prov.provider_type,
                    base_url=prov.url,
                    api_key=api_key,
                    model_id=fallback_model,
                    custom_headers=custom_headers or None,
                    request_timeout=int(settings.llm_request_timeout),
                )
            )

    raise ValueError("尚未配置任何大语言模型 API Key。请在「系统设置 -> 外部连接」中配置 API Key 后再试。")


async def stream_deconstruction_analysis(
    session: AsyncSession,
    text: str,
    model_id: str | None = None,
    provider_id: str | None = None,
    prompt_template: str | None = None,
) -> AsyncGenerator[str, None]:
    """
    流式调用大模型执行 22 维深度拆书。

    Yields:
        SSE 格式字符串: data: {"content": "..."}\n\n
    """
    try:
        llm_client = await resolve_deconstruction_llm(
            session,
            model_id=model_id,
            provider_id=provider_id,
        )
    except Exception as exc:
        logger.error(f"解析拆书大模型失败: {exc}")
        error_payload = json.dumps({"error": str(exc)}, ensure_ascii=False)
        yield f"data: {error_payload}\n\n"
        return

    messages = build_deconstruction_messages(text, prompt_template)

    try:
        async for chunk in llm_client.generate_stream_chunks(messages):
            if chunk.content:
                payload = json.dumps({"content": chunk.content}, ensure_ascii=False)
                yield f"data: {payload}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as exc:
        logger.error(f"拆书分析生成异常: {exc}")
        error_payload = json.dumps({"error": str(exc)}, ensure_ascii=False)
        yield f"data: {error_payload}\n\n"


def parse_deconstruction_report(report_markdown: str) -> dict[str, Any]:
    """
    从 22 维分析报告中智能提取结构化数据，供仿写脚手架与新书创建使用。
    """
    result: dict[str, Any] = {
        "synopsis": "",
        "world_view": "",
        "core_framework": "",
        "characters": [],
        "chapters": [],
    }

    if not report_markdown:
        return result

    # 1. 提取梗概
    synopsis_match = re.search(r"【梗概】[^\n]*\n+([\s\S]*?)(?=\n*【|\Z)", report_markdown)
    if synopsis_match:
        result["synopsis"] = synopsis_match.group(1).strip()

    # 2. 提取核心框架
    framework_match = re.search(r"【本文核心框架】[^\n]*\n+([\s\S]*?)(?=\n*【|\Z)", report_markdown)
    if framework_match:
        result["core_framework"] = framework_match.group(1).strip()

    # 3. 提取世界观
    world_match = re.search(r"【世界观】[^\n]*\n+([\s\S]*?)(?=\n*【|\Z)", report_markdown)
    if world_match:
        result["world_view"] = world_match.group(1).strip()

    # 4. 提取人物设定 (人设 + 男女主角欲望目标)
    character_section = ""
    char_match = re.search(r"【人设】[^\n]*\n+([\s\S]*?)(?=\n*【|\Z)", report_markdown)
    if char_match:
        character_section += char_match.group(1) + "\n"

    desire_match = re.search(r"【男女主角的欲望目标】[^\n]*\n+([\s\S]*?)(?=\n*【|\Z)", report_markdown)
    if desire_match:
        character_section += desire_match.group(1) + "\n"

    # 解析角色列表
    characters: list[dict[str, str]] = []
    # 查找男主与女主
    male_desire = re.search(r"男主角[：:]\s*(.*?)(?=\n|$)", character_section)
    female_desire = re.search(r"女主角[：:]\s*(.*?)(?=\n|$)", character_section)

    protagonist_env = re.search(r"主角生存环境[：:]\s*(.*?)(?=\n|$)", character_section)
    protagonist_pos = re.search(r"人物性格正面[：:]\s*(.*?)(?=\n|$)", character_section)
    protagonist_contrast = re.search(r"反差面[：:]\s*(.*?)(?=\n|$)", character_section)

    protagonist_desc_parts = []
    if protagonist_env:
        protagonist_desc_parts.append(f"生存环境：{protagonist_env.group(1).strip()}")
    if protagonist_pos:
        protagonist_desc_parts.append(f"性格特征：{protagonist_pos.group(1).strip()}")
    if protagonist_contrast:
        protagonist_desc_parts.append(f"反差面：{protagonist_contrast.group(1).strip()}")

    # 创建男女主角色卡
    if male_desire and male_desire.group(1).strip():
        male_desc = f"欲望目标：{male_desire.group(1).strip()}"
        if protagonist_desc_parts:
            male_desc += "\n" + "\n".join(protagonist_desc_parts)
        characters.append({"name": "男主角", "description": male_desc})

    if female_desire and female_desire.group(1).strip():
        female_desc = f"欲望目标：{female_desire.group(1).strip()}"
        # 如果男主没用上主角描述，或者女主为核心
        characters.append({"name": "女主角", "description": female_desc})

    if not characters and protagonist_desc_parts:
        characters.append({"name": "主角", "description": "\n".join(protagonist_desc_parts)})

    result["characters"] = characters

    # 5. 提取结构大纲 (章节列表)
    chapters: list[dict[str, str]] = []
    outline_match = re.search(r"【结构大纲】[^\n]*\n+([\s\S]*?)(?=\n*【|\Z)", report_markdown)
    if outline_match:
        outline_content = outline_match.group(1)
        # 寻找诸如 第一章：... 或 第1章 ... 或 导言结构：...
        preface_match = re.search(r"导言结构[：:]\s*(.*?)(?=\n|$)", outline_content)
        if preface_match and preface_match.group(1).strip() and preface_match.group(1).strip() != "无":
            chapters.append({
                "title": "序章 / 引子",
                "summary": preface_match.group(1).strip(),
            })

        # 匹配所有形如 "第X章[：:] 描述" 的行
        chapter_matches = list(re.finditer(
            r"(第[一二三四五六七八九十百千万\d]+章)[：:\s]*(.*?)(?=\n第[一二三四五六七八九十百千万\d]+章|\n*$)",
            outline_content,
            re.MULTILINE | re.DOTALL,
        ))
        for m in chapter_matches:
            chap_label = m.group(1).strip()
            chap_body = m.group(2).strip()
            # 分离第一行作为标题后缀（如果有）
            lines = [l.strip() for l in chap_body.splitlines() if l.strip()]
            sub_title = lines[0] if lines else ""
            if len(sub_title) > 30:
                sub_title = sub_title[:30] + "..."
            full_title = f"{chap_label} {sub_title}".strip()
            chapters.append({
                "title": full_title,
                "summary": chap_body,
            })

    # 若未能提取到具体章节，则以【起承转合】构建默认四幕大纲
    if not chapters:
        stage_match = re.search(r"【起承转合】[^\n]*\n+([\s\S]*?)(?=\n*【|\Z)", report_markdown)
        if stage_match:
            stage_text = stage_match.group(1)
            stages = [
                ("起", "第一章：起·开篇局势与初次冲突"),
                ("承", "第二章：承·矛盾升级与暗流涌动"),
                ("转", "第三章：转·核心冲突与高潮转折"),
                ("合", "第四章：合·冲突解决与新局收尾"),
            ]
            for prefix, chap_title in stages:
                m = re.search(rf"-?\s*{prefix}[：:]\s*(.*?)(?=\n-?\s*[起承转合][：:]|\Z)", stage_text, re.DOTALL)
                summary = m.group(1).strip() if m else ""
                chapters.append({
                    "title": chap_title,
                    "summary": summary,
                })

    result["chapters"] = chapters
    return result


async def create_project_from_deconstruction(
    session: AsyncSession,
    deconstruction_id: str,
    project_title: str | None = None,
    project_description: str | None = None,
) -> Project:
    """
    根据拆书分析报告一键生成全新小说仿写项目脚手架。
    自动建立：
    1. Project 实体
    2. WorldInfoEntry 设定条目（基于世界观）
    3. Character 角色列表（男女主）
    4. Volume & Chapters 章节列表（基于结构大纲）
    5. Note 拆书参考笔记（全文对照）
    """
    deconstruction = await deconstruction_repo.get_by_id(session, deconstruction_id)
    if not deconstruction:
        raise NotFoundError(f"拆书报告不存在: {deconstruction_id}")

    parsed = parse_deconstruction_report(deconstruction.report_markdown)

    # 1. 确定项目名称与简介
    title = (project_title or "").strip()
    if not title:
        title = f"《{deconstruction.source_title or deconstruction.title}》仿写创作"

    description = (project_description or "").strip()
    if not description:
        description = parsed.get("core_framework") or parsed.get("synopsis") or deconstruction.source_preview[:200]

    project = Project(title=title, description=description)
    project = await project_repo.create(session, project)

    # 创建默认分卷
    default_volume = await volume_service.create_default_volume(session, project.id)

    # 2. 创建世界观条目
    world_view_content = parsed.get("world_view", "")
    if world_view_content:
        # 获取或创建项目的 WorldInfo
        world_info = await world_info_repo.get_by_project_id(session, project.id)
        if not world_info:
            world_info = WorldInfo(project_id=project.id, name=f"{title} 世界书", description="由拆书分析自动生成的仿写世界观")
            world_info = await world_info_repo.create(session, world_info)

        entry = WorldInfoEntry(
            world_info_id=world_info.id,
            uid=1,
            name="核心世界观与规则设定",
            order=1,
            content=world_view_content,
        )
        await world_info_entry_repo.create(session, entry)

    # 3. 创建角色卡片
    for char_data in parsed.get("characters", []):
        char = Character(
            project_id=project.id,
            name=char_data["name"],
            description=char_data.get("description", ""),
        )
        await character_repo.create(session, char)

    # 4. 创建各章节大纲
    chapter_list = parsed.get("chapters", [])
    if chapter_list:
        for idx, chap_data in enumerate(chapter_list):
            chap_title = chap_data["title"]
            chap_summary = chap_data.get("summary", "")
            content = f"<!-- 章节大纲与写作导引 -->\n\n{chap_summary}\n\n<!-- 在此开始仿写正文 -->\n\n" if chap_summary else ""
            await chapter_service.create_chapter(
                session=session,
                project_id=project.id,
                volume_id=default_volume.id,
                title=chap_title,
                content=content,
            )
    else:
        # 兜底创建第一章
        await chapter_service.create_chapter(
            session=session,
            project_id=project.id,
            volume_id=default_volume.id,
            title="第一章 初始冲突",
            content="",
        )

    # 5. 保存完整拆解报告至项目笔记
    note_content = (
        f"# 《{deconstruction.source_title or deconstruction.title}》深度拆书与仿写参考报告\n\n"
        f"> 本笔记由拆书工坊深度分析生成，可在仿写创作时随时对照节奏、冲突与伏笔。\n\n"
        f"{deconstruction.report_markdown}"
    )
    note = Note(
        project_id=project.id,
        title=f"拆书参考：{deconstruction.source_title or deconstruction.title}",
        content=note_content,
    )
    await note_repo.create(session, note)

    return project


async def export_deconstruction_to_note(
    session: AsyncSession,
    deconstruction_id: str,
    target_project_id: str,
) -> Note:
    """将拆书报告存入指定项目的笔记库中。"""
    deconstruction = await deconstruction_repo.get_by_id(session, deconstruction_id)
    if not deconstruction:
        raise NotFoundError(f"拆书报告不存在: {deconstruction_id}")

    project = await project_repo.get_by_id(session, target_project_id)
    if not project:
        raise NotFoundError(f"目标项目不存在: {target_project_id}")

    note_title = f"拆书参考：{deconstruction.source_title or deconstruction.title}"
    note_content = (
        f"# 《{deconstruction.source_title or deconstruction.title}》深度拆书与仿写参考报告\n\n"
        f"{deconstruction.report_markdown}"
    )
    note = Note(
        project_id=target_project_id,
        title=note_title,
        content=note_content,
    )
    return await note_repo.create(session, note)
