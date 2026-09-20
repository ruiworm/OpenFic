# -*- coding: utf-8 -*-
"""拆书报告解析器单元测试。"""

from app.deconstruction.service import parse_deconstruction_report


SAMPLE_REPORT = """
【梗概】
林渊穿越异界修仙界，觉醒神级签到系统，在藏经阁隐忍百年，最终在大道崩殂之夜一剑斩神魔，重定诸天秩序。

【人设】
- 主角生存环境：残破道统青云宗的弃徒杂役，时代处于诸天灵气衰竭的末法时代。
- 人物性格正面：沉稳隐忍、杀伐果断、重诺守信。
- 反差面：外表看似慵懒木讷的小杂役，实则是算无遗策、剑挑万界的幕后黑手。

【世界观】
九品玄天体系，分为炼气、筑基、金丹、元婴、化神、炼虚、合体、大乘、渡劫。上古仙路断绝，宗门之间弱肉强食，外有深渊异族虎视眈眈。

【本文核心框架】
这是一个关于苟道稳健流主角在底层绝境中依靠神级签到系统逆袭并颠覆旧仙界的故事。

【起承转合】
- 起：林渊穿越至杂役处，觉醒签到系统并在藏经阁签到获得万剑归宗。
- 承：外门大比风波起，魔道内奸潜入，林渊暗中出手化解危机，实力飞跃。
- 转：宗门老祖陨落，群魔围山，正道盟友背刺，生死存亡之际林渊显露真身。
- 合：一剑荡平群魔，重塑护宗大阵，受万众敬仰，启程踏入更广阔的仙域。

【主角人物的情绪变化图】
开篇迷茫警惕 → 获得金手指后的狂喜与克制 → 潜修时的宁静专注 → 遭遇危机时的冷静决绝 → 决战时的霸道决然 → 结局时的超然从容。

【男女主角的欲望目标】
- 男主角：追求长生久视与绝对掌控自身命运的自由。
- 女主角：重振家族门楣并查清父母失踪之谜。

【结构大纲】
- 导言结构：序章交代上古仙魔大战背景与仙路断绝的遗留隐患。
- 正文结构：
第一章：穿越与扫地小厮的签到日
第二章：藏经阁顶层的神秘剑诀
第三章：外门执事的贪婪刁难
第四章：暗夜飞剑诛强敌
第五章：全宗震动的无名高人
"""


def test_parse_deconstruction_report_full() -> None:
    """测试完整 22 维报告结构化解析。"""
    parsed = parse_deconstruction_report(SAMPLE_REPORT)

    assert "林渊穿越异界" in parsed["synopsis"]
    assert "这是一个关于苟道稳健流" in parsed["core_framework"]
    assert "九品玄天体系" in parsed["world_view"]

    # 验证人物
    chars = parsed["characters"]
    assert len(chars) >= 2
    male_char = next((c for c in chars if c["name"] == "男主角"), None)
    female_char = next((c for c in chars if c["name"] == "女主角"), None)
    assert male_char is not None
    assert "追求长生久视" in male_char["description"]
    assert "生存环境" in male_char["description"]
    assert female_char is not None
    assert "重振家族门楣" in female_char["description"]

    # 验证章节
    chapters = parsed["chapters"]
    assert len(chapters) >= 5
    # 序章
    assert any("序章" in c["title"] for c in chapters)
    # 第一章到第五章
    assert any("第一章" in c["title"] for c in chapters)
    assert any("第二章" in c["title"] for c in chapters)
    assert any("第三章" in c["title"] for c in chapters)
    assert any("第四章" in c["title"] for c in chapters)
    assert any("第五章" in c["title"] for c in chapters)


def test_parse_deconstruction_report_fallback() -> None:
    """测试在缺少明确章节大纲时自动降级到起承转合四幕大纲。"""
    partial_report = """
【梗概】
短篇测试故事。

【世界观】
现实都市职场。

【起承转合】
- 起：职场小透明被主管抢功。
- 承：暗中搜集证据与核心项目代码。
- 转：集团高层视察现场当众揭发。
- 合：主管被开除，主角升职加薪。
"""
    parsed = parse_deconstruction_report(partial_report)
    assert parsed["synopsis"] == "短篇测试故事。"
    assert parsed["world_view"] == "现实都市职场。"
    chapters = parsed["chapters"]
    assert len(chapters) == 4
    assert "第一章" in chapters[0]["title"]
    assert "第四章" in chapters[3]["title"]
