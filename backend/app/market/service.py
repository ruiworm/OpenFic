"""
网文大盘与扫榜业务逻辑服务 (Market Analysis Service)
"""

import json
from typing import List, Optional
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.settings import settings
from app.market.crawler import market_crawler
from app.market.schemas import (
    AITopicRequest,
    AITopicResponse,
    BookDetailResponse,
    MarketOverviewResponse,
    MarketRankResponse,
    TopicSuggestion,
)
from app.models.clients import LLMClient, LLMConfig
from app.models.repos import model_provider_repo, model_repo
from app.models.services.model_provider_service import ModelProviderService
from app.core.encryption import EncryptionService


# 针对各热门赛道的预置微创新选题蓝图库 (用于无 Key 或快速体验)
CATEGORY_PRESET_TOPICS = {
    "都市脑洞": [
        TopicSuggestion(
            title="让你当保安，你怎么把世界巨头全赶出去了？",
            one_sentence_hook="重生成陆家嘴最严门卫大爷，觉醒【安防神圣领域】，凡有敌意者踏入百米内当场被按在地上摩擦！",
            golden_finger="【万界安防神域系统】：所看守的区域绝对无敌，击退擅闯者随机掉落对方核心资产与顶级科研图纸。",
            protagonist_setup="表面是保温杯里泡枸杞的摆烂大爷，实则是全球顶级特工闻风丧胆的神秘规则掌控者。",
            three_chapter_rhythm="第1章：开局拒绝身价千亿的前女友豪车进门；第2章：国外顶尖窃密间谍硬闯被当场拧成麻花；第3章：国防军工大佬连夜送来锦旗，全球震惊！",
            market_logic="契合近期都市脑洞‘摆烂大爷+降维打击+反差强国’的黄金流量模板，读者爽感即时释放。",
        ),
        TopicSuggestion(
            title="开局推演百年国运，全网以为我是神棍",
            one_sentence_hook="重生回到大国博弈前夕，开启【历史未来演化沙盘】，直播预言全部应验，国家队直接全副武装护送进紫禁城！",
            golden_finger="【百世文明演化天平】：消耗推演点数可提前窥探全球金融、军事与自然异变走向。",
            protagonist_setup="冷静理智的学术型狂人，面对质疑从不废话，只用一次次震撼全球的事实验证铁律。",
            three_chapter_rhythm="第1章：直播间预警明日股市崩盘与海啸被全网群嘲；第2章：预言次日百分百精准应验，全网头皮发麻；第3章：国家安全局特工封锁整栋楼，恭请先生出山！",
            market_logic="踩中‘爱国情怀+全网打脸+预言家降维打击’题材，留存率居高不下。",
        ),
        TopicSuggestion(
            title="让你当代课老师，你怎么教出全员天尊了？",
            one_sentence_hook="修仙界散修穿越现代武道高中，把中二学生当仙尊胚子养，期末全班御剑飞行上清北！",
            golden_finger="【授徒万倍返还系统】：徒弟突破大境界，宿主自动继承圆满仙帝道果并获得现代工业仙化改造。",
            protagonist_setup="看似温和随和的年轻班主任，实际上护犊子狂魔，谁敢欺负他学生直接引天雷轰平。",
            three_chapter_rhythm="第1章：接盘全校最差的放牛班刺头；第2章：随手传授呼吸法，倒数第一当晚引气入体震惊武协；第3章：省城重点高中登门踢馆，被全班围殴怀疑人生！",
            market_logic="校园轻松+逆袭打脸+师徒养成，番茄中学生与年轻读者基本盘极大。",
        ),
    ],
    "玄幻脑洞": [
        TopicSuggestion(
            title="人在娘胎，我把双胞胎天命之子的气运吸干了",
            one_sentence_hook="穿成娘胎婴儿，发现隔壁龙凤胎姐姐是重生的绝世女帝，弟弟是转世无上剑尊？果断先下手为强！",
            golden_finger="【鸿蒙吞噬道种】：在娘胎中每天吸取天地灵蕴与天命气运，出生即混沌重瞳。",
            protagonist_setup="外表纯良可爱的肉嘟嘟婴儿，内心杀伐果断的大魔王，把气运之子耍得团团转。",
            three_chapter_rhythm="第1章：娘胎争夺先天紫气，把未来女帝踹到角落抢先吸收；第2章：出生之日万龙朝拜天道震动，天降九色神雷；第3章：抓周大典一把捏碎上古魔皇剑，全族老祖疯狂膜拜！",
            market_logic="娘胎反套路+萌娃反差+团宠打脸，开篇留存率通常超60%。",
        ),
        TopicSuggestion(
            title="让你代管魔教，你怎么把正道圣女全策反了？",
            one_sentence_hook="魔教卧底十余载，教主闭关把烂摊子扔给主角，半年后正道第一圣地宣布全员并入魔宗圣教！",
            golden_finger="【真理反转魔典】：凡对主角产生敌意的名门正派，其道心誓言会自动扭曲为狂热崇拜。",
            protagonist_setup="温润如玉、白衣胜雪的魔门副教主，以仁义道德行魔道之实。",
            three_chapter_rhythm="第1章：魔宗账目亏空八千万灵石，正道圣女领命下山围剿；第2章：主角设鸿门宴以茶论道，圣女道心崩溃发现师门全是伪君子；第3章：圣女当场立下心魔大誓，誓死追随副教主革新天下！",
            market_logic="反套路伪君子与策反打脸，男频读者极具沉浸感与征服感。",
        ),
        TopicSuggestion(
            title="我用现代物理修仙，给天劫装了避雷针",
            one_sentence_hook="修真界绝灵体质穿越者，造不出飞剑就手搓电磁轨道炮，九九天劫劈下直接给整个宗门充饱了电！",
            golden_finger="【微观量子炼器法门】：用热力学、电磁学解构天道法则，万物皆可科技赋能。",
            protagonist_setup="重度火力不足恐惧症物理学硕士，口头禅是‘一切恐惧源于能量密度不够’。",
            three_chapter_rhythm="第1章：被嘲笑毫无灵根配不上修仙，开局手搓高斯步枪一枪崩灭妖王；第2章：九天雷劫轰顶，宗门上下瑟瑟发抖，主角反手竖起超导避雷针蓄电池；第3章：全宗门通上电灯电梯，掌门老祖跪求安装Wi-Fi！",
            market_logic="科技修仙+硬核搞笑+文化自信，番茄大热流派，受众极广。",
        ),
    ],
    "规则怪谈": [
        TopicSuggestion(
            title="规则怪谈：我给诡异当心理医生，诡异全治愈了",
            one_sentence_hook="被选中进入恐怖怪谈副本，别人都在找规则逃命，拥有【职业神医面板】的秦诺却坐诊接客：你这红衣煞气，明显是产后抑郁！",
            golden_finger="【万物心理诊疗系统】：精准诊断诡异生物的精神创伤，治愈后诡异自愿认主成为护道仆从。",
            protagonist_setup="戴金丝眼镜的禁欲系暖男医生，手持电击治疗仪与心理咨询病例本，以理服人，不服就物理电疗。",
            three_chapter_rhythm="第1章：午夜凶宅副本，红衣厉鬼敲门，主角直接开始问诊填表；第2章：三言两语戳中厉鬼生前痛处，恶灵当场痛哭流涕认义父；第3章：全球天选者团灭，只有主角带着一帮诡异护士查房！",
            market_logic="极致反差搞笑+解压反套路，完全颠覆怪谈的传统恐怖氛围，传播度极高。",
        ),
        TopicSuggestion(
            title="规则怪谈：只要我足够穷，诡异就诈骗不到我",
            one_sentence_hook="天选者被拉入诡异金融大厦，别人被规则扣除寿命，负债两百个亿的主角直接反向找诡异要借呗！",
            golden_finger="【绝对贫困庇护权杖】：个人资产为负时触发神级反伤，任何试图掠夺其生命或精神的诡异必须替其承担同等债务。",
            protagonist_setup="深谙社会人情世故的终极老油条，把一切恐怖诡异规则全当成催收套路反向套现。",
            three_chapter_rhythm="第1章：开局诡异售货员诱导购买高价违禁品，主角掏出征信报告哭穷反借十万鬼币；第2章：高阶厉鬼逼签买命契约，当场被系统判定为连带担保人强扣百年修为；第3章：诡异BOSS集体连夜给主角众筹买机票求他通关滚蛋！",
            market_logic="切中年轻人打工人共鸣，以疯批幽默化解现实压力，留存与互动率封顶。",
        ),
        TopicSuggestion(
            title="规则怪谈：我的外卖订单来自旧日支配者",
            one_sentence_hook="深夜配送订单：送往枉死城无尽深渊，超时一秒当场肢解。主角接单后：亲，给个五星好评可以饶你不死哦！",
            golden_finger="【超时赔付万界骑手系统】：只要准时送达外卖，顾客必须用自身核心权能或不可名状遗物抵扣好评佣金。",
            protagonist_setup="风雨无阻的骑手狂人，谁耽误他冲单拿月度销冠他就把谁物理超度。",
            three_chapter_rhythm="第1章：接单送一杯全糖奶茶到冥界鬼母寝宫；第2章：半路恶鬼拦路抢单，主角电瓶车直接变身纳米机甲碾压通关；第3章：鬼母喝完热泪盈眶赏赐万鬼统帅符印，全网直播观众下巴惊掉！",
            market_logic="职业文+怪谈碰撞，节奏快，单元剧模式利于超长篇连载。",
        ),
    ],
    "古言种田": [
        TopicSuggestion(
            title="抄家流放？我带万吨粮仓搬空贪官全族",
            one_sentence_hook="刚穿成流放犯妇，反手开启十万亩现代农业试验田空间，流放路上别人啃树皮，她带娘家顿顿山珍海味！",
            golden_finger="【超级智慧农业空间】：不仅有无限物资仓库，还能一键催熟高产杂交水稻与抗旱粮种。",
            protagonist_setup="又飒又爽的农学女博士，懂医术擅经商，绝不圣母，有仇当场报。",
            three_chapter_rhythm="第1章：抄家前夜夜探仇人府邸，连地窖银冬瓜和老母鸡一并搬走；第2章：流放恶劣荒野，官差抢粮不成反被下巴豆拉脱水；第3章：荒无人烟的岭南被她开辟成鱼米之乡，全京城跪求一粒仙米！",
            market_logic="种田文长青树模板，女性读者黏性极高，付费完读率稳定。",
        ),
        TopicSuggestion(
            title="全家偷听我心声，暴君爹爹杀疯了",
            one_sentence_hook="穿成暴君怀里的奶团子，天天在心里疯狂吐槽朝堂大瓜，结果暴君和皇兄们竟然全能读心！",
            golden_finger="【吃瓜读心天道系统】：内心吐槽被特定皇族听到，主角可获得功德气运反哺强化肉身与国运。",
            protagonist_setup="软萌可爱的啃奶瓶小公主，表面咿咿呀呀，心里弹幕疯狂剧透满朝文武的绿帽子与叛国阴谋。",
            three_chapter_rhythm="第1章：【爹啊，这御史下周就要投靠敌国把你毒死啦！】暴君当朝脸色大变当场拿下奸臣；第2章：【大皇兄真惨，被侧妃戴了三顶绿帽还乐呵呵呢！】大皇兄连夜抄了侧妃全家；第3章：全朝野争着抱小公主求剧透自保，主角成护国祥瑞！",
            market_logic="番茄女频现役T0题材‘全家偷听心声’，开篇3章吸睛度高，完读率惊人。",
        ),
        TopicSuggestion(
            title="带拼多多穿荒年，糙汉王爷被我娇养了",
            one_sentence_hook="穿成荒年被卖的冲喜小娘子，绑定【砍一刀万界商城】，一分钱抢购抗生素和加特林，把残疾战神喂成了忠犬摄政王！",
            golden_finger="【万界砍价神级平台】：可以用古代废弃瓦片铜钱直接兑换现代抗生素、化肥和高精机械图纸。",
            protagonist_setup="精打细算、战斗力爆表的带货达人，护夫狂魔，赚钱搞基建两不误。",
            three_chapter_rhythm="第1章：婆家逼她把瘫痪夫君扔上山自生自灭，主角当场一刀分家；第2章：拼多多首单新人特惠秒杀一盒青霉素，神效救活战神夫君；第3章：靠红薯高产粮种拯救全村荒灾，曾经欺辱他们的人跪求赏饭！",
            market_logic="先婚后爱+基建爽文+忠犬互宠，女频下沉市场爆款发动机。",
        ),
    ],
}


class MarketService:
    """网文大盘洞察服务类"""

    async def get_overview(self) -> MarketOverviewResponse:
        """获取全网大盘各题材概览与核心指标"""
        data = await market_crawler.fetch_overview()
        return MarketOverviewResponse(**data)

    async def get_rankings(
        self,
        channel: Optional[str] = None,
        category: Optional[str] = None,
        rank_type: str = "read_count",
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> MarketRankResponse:
        """获取排行榜单"""
        data = await market_crawler.fetch_rankings(
            channel=channel,
            category=category,
            rank_type=rank_type,
            search=search,
            page=page,
            page_size=page_size,
        )
        return MarketRankResponse(**data)

    async def get_book_detail(self, book_id: str) -> Optional[BookDetailResponse]:
        """获取书籍详细数据，包含走势折线点与前三章"""
        data = await market_crawler.get_book_detail(book_id)
        if not data:
            return None
        return BookDetailResponse(**data)

    async def generate_ai_topics(
        self,
        session: AsyncSession,
        request: AITopicRequest,
    ) -> AITopicResponse:
        """针对指定赛道或对标作品，由AI输出 3 个高转化微创新选题"""
        target_category = request.category or request.genre or "都市脑洞"
        source_title: Optional[str] = request.reference_novel or None
        source_intro: Optional[str] = None
        source_tags: List[str] = []

        if request.book_id:
            book_info = await market_crawler.get_book_detail(request.book_id)
            if book_info:
                target_category = book_info["category"]
                if not source_title:
                    source_title = book_info["title"]
                source_intro = book_info.get("intro", "")
                source_tags = book_info.get("tags", [])

        # 尝试调用大模型生成个性化选题方案
        try:
            llm_client = await self._try_resolve_llm(
                session,
                model_id=request.model_id,
                provider_id=request.provider_id,
            )
            if llm_client:
                prompt_text = f"""你是一位顶尖的网文爆款策划总监与市场商业选题专家。
请根据以下目标赛道与参考爆款，输出 3 个具有极高成神潜质、吸量且高留存的原创微创新网文选题方案：

【目标赛道】：{target_category}
【频道倾向】：{request.channel or '默认全频'}
【对标作品】：{source_title or '该赛道头部榜首爆款'}
【参考标签】：{', '.join(source_tags) if source_tags else '爽文, 脑洞, 反转'}
【参考简介】：{source_intro or '紧扣读者核心欲望与反差期待'}
【微创新灵感与反差诉求】：{request.custom_angle or '金手指机制反套路，首章冲突强烈，3章内必拿首胜'}

请严格按照以下 JSON 格式输出 3 个选题，不要包含任何 markdown 代码块标记以外的杂质：
[
  {{
    "title": "爆款书名（必须具备强烈反差感、主角身份与吸引眼球的核心动作）",
    "one_sentence_hook": "一句话核心卖点与首章黄金钩子",
    "golden_finger": "核心金手指/系统/异能的规则设定与微创新点",
    "protagonist_setup": "主角性格正面、生存处境与反差萌/反差爽点",
    "three_chapter_rhythm": "开篇前三章的具体情节推进节奏（第1章引爆矛盾、第2章金手指破局、第3章爽点变现）",
    "market_logic": "该选题为什么能在当前赛道脱颖而出的商业底层逻辑"
  }}
]"""
                response_str = await llm_client.acomplete(prompt_text)
                # 解析 JSON
                clean_json = response_str.strip()
                if clean_json.startswith("```"):
                    lines = clean_json.split("\n")
                    if lines[0].startswith("```"):
                        lines = lines[1:]
                    if lines and lines[-1].startswith("```"):
                        lines = lines[:-1]
                    clean_json = "\n".join(lines).strip()

                parsed = json.loads(clean_json)
                if isinstance(parsed, list) and len(parsed) > 0:
                    suggestions = [TopicSuggestion(**item) for item in parsed[:3]]
                    return AITopicResponse(
                        category=target_category,
                        source_book_title=source_title,
                        suggestions=suggestions,
                    )
        except Exception as e:
            logger.warning(f"调用大模型生成选题遇到问题，自动平滑启用高质量精选蓝图池: {e}")

        # 兜底：使用高质量专家精选蓝图库
        presets = CATEGORY_PRESET_TOPICS.get(target_category) or CATEGORY_PRESET_TOPICS["都市脑洞"]
        return AITopicResponse(
            category=target_category,
            source_book_title=source_title,
            suggestions=presets,
        )

    async def _try_resolve_llm(
        self,
        session: AsyncSession,
        model_id: Optional[str],
        provider_id: Optional[str],
    ) -> Optional[LLMClient]:
        """尝试获取可用的大模型客户端实例"""
        encryption_service = EncryptionService(settings.encryption_key)
        provider_service = ModelProviderService(encryption_service)

        target_provider_id = provider_id
        target_model_name = model_id

        if target_model_name and "::" in target_model_name:
            parts = target_model_name.split("::", 1)
            target_provider_id = parts[0]
            target_model_name = parts[1]

        if target_provider_id:
            provider = await model_provider_repo.get_by_id(session, target_provider_id)
            if provider and provider.api_key_encrypted:
                api_key = encryption_service.decrypt(provider.api_key_encrypted)
                if api_key and api_key.strip():
                    custom_headers = provider_service.get_decrypted_custom_headers(provider)
                    actual_model = target_model_name or "default"
                    if actual_model == "default":
                        actual_model = "deepseek-chat" if provider.provider_type == "deepseek" else "gpt-4o"
                    return LLMClient(
                        LLMConfig(
                            provider_type=provider.provider_type,
                            base_url=provider.url,
                            api_key=api_key,
                            model_id=actual_model,
                            custom_headers=custom_headers or None,
                        )
                    )

        # 寻找首个配置了有效 API Key 的提供商
        providers = await model_provider_repo.get_all(session)
        for p in providers:
            if not p.is_builtin and p.api_key_encrypted:
                api_key = encryption_service.decrypt(p.api_key_encrypted)
                if api_key and api_key.strip():
                    custom_headers = provider_service.get_decrypted_custom_headers(p)
                    actual_model = "deepseek-chat" if p.provider_type == "deepseek" else "gpt-4o"
                    return LLMClient(
                        LLMConfig(
                            provider_type=p.provider_type,
                            base_url=p.url,
                            api_key=api_key,
                            model_id=actual_model,
                            custom_headers=custom_headers or None,
                        )
                    )

        return None


# 全局单例服务
market_service = MarketService()
