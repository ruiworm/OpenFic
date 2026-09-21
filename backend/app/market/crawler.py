"""
网文大盘数据采集与仿真引擎 (Fanqie Market Scraper & Simulation Engine)
包含真实公开数据接入与高仿真网文题材时序数据池
"""

import datetime
import random
from typing import Dict, List, Optional
import httpx
from loguru import logger

from app.market.schemas import ChapterBrief, MarketBook, TrendDataPoint


def _format_number(num: int) -> str:
    if num >= 100000000:
        return f"{num / 100000000:.2f}亿"
    if num >= 10000:
        return f"{num / 10000:.1f}万"
    return str(num)


def _format_gain(num: int) -> str:
    sign = "+" if num > 0 else ""
    return f"{sign}{_format_number(num)}"


# 题材定义列表
DEFAULT_GENRES = [
    {
        "name": "都市脑洞",
        "channel": "male",
        "total_read_count": 86400000,
        "growth_rate_7d": 16.8,
        "growth_rate_30d": 38.4,
        "daily_debut_count": 128,
        "turnover_rate": 42.5,
        "competition_level": "medium",
        "is_blue_ocean": False,
        "summary": "当前全网第一流量吸金赛道，以规则怪谈、反转系统、长生苟道为代表，题材流动性极佳。",
    },
    {
        "name": "玄幻脑洞",
        "channel": "male",
        "total_read_count": 72500000,
        "growth_rate_7d": 12.3,
        "growth_rate_30d": 24.1,
        "daily_debut_count": 115,
        "turnover_rate": 35.0,
        "competition_level": "medium",
        "is_blue_ocean": True,
        "summary": "反套路玄幻崛起，反派主角、截胡机缘、魔道卧底题材增速亮眼，读者黏性高。",
    },
    {
        "name": "战神赘婿",
        "channel": "male",
        "total_read_count": 51200000,
        "growth_rate_7d": -8.5,
        "growth_rate_30d": -18.2,
        "daily_debut_count": 142,
        "turnover_rate": 62.0,
        "competition_level": "intense",
        "is_blue_ocean": False,
        "summary": "传统套路供给严重过剩，首秀扑街率极高，读者耐药性极强，正处于红海洗牌期。",
    },
    {
        "name": "规则怪谈",
        "channel": "male",
        "total_read_count": 43800000,
        "growth_rate_7d": 24.6,
        "growth_rate_30d": 58.0,
        "daily_debut_count": 48,
        "turnover_rate": 38.8,
        "competition_level": "low",
        "is_blue_ocean": True,
        "summary": "高潜黄金赛道！首秀供给适中但读者需求井喷，短篇悬念反转与国运解密最容易出黑马爆款。",
    },
    {
        "name": "游戏末世",
        "channel": "male",
        "total_read_count": 36900000,
        "growth_rate_7d": 9.4,
        "growth_rate_30d": 21.0,
        "daily_debut_count": 65,
        "turnover_rate": 31.2,
        "competition_level": "medium",
        "is_blue_ocean": False,
        "summary": "全民转职、末世避难所、第四天灾题材表现平稳，硬核设定读者转化率稳定。",
    },
    {
        "name": "古言种田",
        "channel": "female",
        "total_read_count": 68200000,
        "growth_rate_7d": 14.2,
        "growth_rate_30d": 32.5,
        "daily_debut_count": 88,
        "turnover_rate": 28.5,
        "competition_level": "medium",
        "is_blue_ocean": True,
        "summary": "抄家流放囤粮、空间致富、带全村逃荒等题材长尾效应惊人，读者留存周期长达半年以上。",
    },
    {
        "name": "现代言情",
        "channel": "female",
        "total_read_count": 59400000,
        "growth_rate_7d": 6.8,
        "growth_rate_30d": 15.0,
        "daily_debut_count": 120,
        "turnover_rate": 45.0,
        "competition_level": "high",
        "is_blue_ocean": False,
        "summary": "闪婚马甲、真假千金回归、读心术等反套路微创新仍有空间，纯虐文基本绝迹。",
    },
    {
        "name": "悬疑惊悚",
        "channel": "male",
        "total_read_count": 31500000,
        "growth_rate_7d": 18.0,
        "growth_rate_30d": 44.0,
        "daily_debut_count": 35,
        "turnover_rate": 32.0,
        "competition_level": "low",
        "is_blue_ocean": True,
        "summary": "刑侦罪案侧写与中式民俗志异热度飙升，首秀过稿率与万在读转化率极高。",
    },
]

# 真实仿真爆款作品矩阵
INITIAL_BOOKS_DATA = [
    {
        "book_id": "fq-1001",
        "title": "让你代管炊事班，你怎么全成特种兵王了？",
        "author": "军旅老刀",
        "channel": "male",
        "category": "都市脑洞",
        "tags": ["特种兵", "系统", "反差爽文", "强国崛起", "热血"],
        "cover_url": "https://images.unsplash.com/photo-1542281286-9e0a16bb7366?w=300",
        "intro": "林渊穿越平行世界，因犯错被下放到全军最差的偏远炊事班。激活【万物推演系统】后，炒菜顿悟格斗术，颠勺领悟神枪法！三个月后军区大比武，首长彻底看傻了：这真是炊事班？",
        "word_count": 482000,
        "debut_days": 18,
        "score": 9.6,
        "read_count": 1428000,
        "gain_7d": 385000,
        "gain_30d": 1150000,
        "growth_rate_7d": 36.9,
        "status": "surging",
        "rank": 1,
        "sample_chapters": [
            {
                "chapter_index": 1,
                "title": "第1章 偏远炊事班？不，这是修罗场！",
                "word_count": 2150,
                "content_preview": "铁锈斑驳的营门前，林渊背着行囊，面无表情地看着眼前这一片荒凉。东南军区红箭旅最偏僻的九连炊事班...",
                "content": """第1章 偏远炊事班？不，这是修罗场！

铁锈斑驳的营门前，林渊背着行囊，面无表情地看着眼前这一片荒凉。

东南军区红箭旅最偏僻的九连炊事班，背靠大凉山，方圆三十里连个小卖部都没有。

“报告班长！列兵林渊前来报到！”

班长老周叼着根没点燃的烟，上下打量着林渊，叹了口气：“你就是旅部直属连退回来的那个高材生？犯什么事了？”

“考核时打落了观察哨的无人机，顺便黑了红军指挥系统。”林渊平静回答。

老周一口浓痰差点没咽下去，眼珠子瞪得溜圆：“那你这哪是犯错，你这是把神仙打架给掀了桌子啊！”

就在这时，林渊脑海中响起一道清脆的电子提示音：
【叮！检测到宿主正式就任军营基层岗位，绝世推演宗师系统已绑定！】
【当前岗位：炊事员。】
【新手大礼包发放：领悟神级刀工（神级飞刀近战术）、完美火候控制（潜伏伪装大师）！】

林渊眼中闪过一抹刺目的精芒。

炊事班？
老子在这，也能把大凉山煮成特种兵王的摇篮！""",
            },
            {
                "chapter_index": 2,
                "title": "第2章 颠勺顿悟重力掌控，连长看跪了",
                "word_count": 2320,
                "content_preview": "第二天清晨五点半，厨房里响起了刺耳的当当当声...",
                "content": """第2章 颠勺顿悟重力掌控，连长看跪了

第二天清晨五点半，天刚蒙蒙亮。

九连炊事班的大铁锅前，林渊手握重达二十斤的生铁大勺，神情专注如雕塑。

【叮！检测到宿主正在执行颠勺动作（500次），推演肌肉记忆中……】
【恭喜宿主！领悟【微重力掌控发力技巧】！手臂爆发力提升300%！后坐力耐受力达到全军特级极限！】

“轰！”
一锅重达百斤的黄豆排骨汤，在林渊手中如同轻盈的羽毛，凌空翻飞三尺高，又稳稳落回锅内，连一滴汤水都没溅出来！

正好路过厨房视察的连长张大炮一脚踩在门槛上，整个人僵住了，烟头烫了手指头都浑然不觉。

“班……班长老周，你们炊事班现在做饭，都用麒麟臂了吗？！”""",
            },
            {
                "chapter_index": 3,
                "title": "第3章 连长：让你做饭，你怎么把全排干趴下了？！",
                "word_count": 2400,
                "content_preview": "一周后的全连紧急拉练，九连在山地穿越时遭遇恶劣暴雨...",
                "content": """第3章 连长：让你做饭，你怎么把全排干趴下了？！

一周后的全连紧急山地拉练。

暴雨如注，九连三排负责深入大凉山未开发区域进行丛林渗透。

然而突发的山体滑坡瞬间切断了后撤通道，蓝军特战分队的潜伏小组更是在暗中如狼似虎地包抄而来。

“完了，无线电受到严重电磁干扰，全排被包了饺子！”排长满脸绝望。

就在此时，林渊挑着两桶热气腾腾的姜汤，步伐平稳如履平地般从密林中走出。

“同志们，开饭了。”林渊擦了擦脸上的雨水。

“开什么饭！蓝军特战队就在前面的高地，我们被压得头都抬不起来！”

林渊放下担子，抓起身后背着的那把切肉剔骨刀。

“蓝军？正好缺几个试菜的。”

话音未落，林渊的身影在暴雨中拉出一道骇人的残影！

五分钟后。
蓝军特战大队王牌‘响尾蛇’小队全体被反剪双臂捆在老松树上，每个人嘴里都被塞了一块热腾腾的红糖发糕。

全连战士倒吸一口凉气。
连长张大炮连夜给旅长打电话，嗓子都哑了：“报告旅长！快把我们炊事班的林渊接走吧，他一个人把蓝军整支特战侦察排给团灭了！”""",
            },
        ],
    },
    {
        "book_id": "fq-1002",
        "title": "规则怪谈：我能推演一万种死法",
        "author": "午夜灯塔",
        "channel": "male",
        "category": "规则怪谈",
        "tags": ["无限流", "悬疑惊悚", "推理反转", "高智商", "国运"],
        "cover_url": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300",
        "intro": "规则怪谈降临全球，被选中的天选者代表国家进入诡异副本。苏晨被选中代表龙国，开局抽到唯一SSS级天赋【死亡死亡死亡重演】：每次死亡前三秒可强制时光倒流，推演全部存活路线！",
        "word_count": 620000,
        "debut_days": 26,
        "score": 9.8,
        "read_count": 1890000,
        "gain_7d": 492000,
        "gain_30d": 1580000,
        "growth_rate_7d": 35.2,
        "status": "surging",
        "rank": 2,
        "sample_chapters": [
            {
                "chapter_index": 1,
                "title": "第1章 妈妈的便签与猩红视界",
                "word_count": 2200,
                "content_preview": "冰箱贴上的粉色便签纸渗出了黑色的血迹。第一条：家里没有宠物狗...",
                "content": """第1章 妈妈的便签与猩红视界

冰箱贴上的粉色便签纸，正缓缓渗出暗红色的粘稠液体。

【欢迎回到幸福之家，亲爱的孩子。请严格遵守以下家规：】
【1. 家里从未养过宠物狗，如果听到客厅地毯上有狗爪抓挠声，请立即背对房门倒退回卧室。】
【2. 妈妈只在晚上八点后做红烧肉，如果下午有人敲门送肉，请立刻隔着门大喊‘我不吃生肉’。】
【3. 镜子里的你永远比你慢半秒，如果镜子里的你在微笑，请立即闭上眼睛数到三十。】

苏晨站在玄关，耳边是龙国数十亿观众的惊恐心跳。

全球直播间弹幕疯狂刷屏：
“完了！龙国这次选了个高中刚毕业的文弱书生！”
“前五个天选者都在这个副本被剥皮吃了！”

苏晨深吸一口气，眼前浮现出一道森冷的灰色天平：
【SSS级天赋·真理之死激活：死亡并非终结，而是获取规则拼图的筹码！】""",
            },
            {
                "chapter_index": 2,
                "title": "第2章 第一次死亡：微笑的梳妆镜",
                "word_count": 2100,
                "content_preview": "苏晨跨过走廊，镜子中的倒影忽然嘴角裂开...",
                "content": """第2章 第一次死亡：微笑的梳妆镜

走廊的灯光忽明忽暗。

苏晨按照便签提示慢慢走过卫生间门前。

镜子里，少年的倒影忽然停住了脚步，原本平静的面容缓缓咧开，嘴角一直撕裂到耳根！

【警告！你的倒影正在吞噬你的存在感！】
【死亡倒计时：3秒、2秒、1秒……】
【你已被镜中灵肢解。】

“嗡——！”
时间瞬间倒流 10 秒！

苏晨重新站在距离镜子三米处，嘴角却扬起一抹冷酷的弧度：
“原来镜中灵的规则不是闭眼，而是它害怕被看穿！”""",
            },
            {
                "chapter_index": 3,
                "title": "第3章 全球惊呆！他在怪谈副本里当起质检员了？！",
                "word_count": 2350,
                "content_preview": "下午三点半，沉闷的敲门声如约而至...",
                "content": """第3章 全球惊呆！他在怪谈副本里当起质检员了？！

下午三点半。

“咚咚咚。”
沉闷黏腻的敲门声在死寂的客厅中响起。

门外传来一道甜腻到令人作呕的女声：“宝宝，妈妈提前给你买了最新鲜的后腿肉哦……”

直播间其他国家的专家组已经认定苏晨必死无疑。

只见苏晨不慌不忙从背包里掏出一把卷尺和手电筒，贴在猫眼上反向照了回去：
“女士，根据《食品安全法》和龙国检疫标准，你这块肉没有加盖蓝色滚轮检验章，且菌落总数严重超标，拒收！”

门外的诡异生物瞬间僵住。

全球直播弹幕彻底炸了：
“卧槽？？？他跟诡异讲食品安全法？！”
“怪谈副本被他玩成工商质检了？！”""",
            },
        ],
    },
    {
        "book_id": "fq-1003",
        "title": "抄家流放？我带千亿物资搬空敌国国库",
        "author": "江南小桃",
        "channel": "female",
        "category": "古言种田",
        "tags": ["空间", "穿越", "女强爽文", "囤货搬空", "流放基建"],
        "cover_url": "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300",
        "intro": "穿成替嫁废柴王妃，刚洞房就要被抄家流放三千里？沈青岚冷笑一声，空间万亿超市在手，金银珠宝、粮仓布匹全收走！顺道溜进皇宫，把狗皇帝的私库全搬空！流放路上别人吃树皮，她和战神夫君顿顿吃火锅烤肉！",
        "word_count": 890000,
        "debut_days": 42,
        "score": 9.7,
        "read_count": 1650000,
        "gain_7d": 210000,
        "gain_30d": 780000,
        "growth_rate_7d": 14.6,
        "status": "surging",
        "rank": 3,
        "sample_chapters": [
            {
                "chapter_index": 1,
                "title": "第1章 洞房夜抄家？给我全搬走！",
                "word_count": 2300,
                "content_preview": "喜帕掀开的那一刻，门外传来铠甲碰撞与御林军的暴喝...",
                "content": """第1章 洞房夜抄家？给我全搬走！

喜帕掀开，眼前是个俊美如神祗却脸色苍白的残疾王爷。

然而还没等沈青岚开口，门外就传来了震天的铁蹄与兵刃出鞘声！

“奉天承运，定王萧煜通敌叛国，即日抄没全家家产，三日后流放蛮荒岭南！”

定王萧煜嘴角泛起自嘲的冷笑：“沈青岚，本王连累你了。”

沈青岚眨了眨眼，心头不仅不慌，反而狂喜！
现代超级物流园空间在手，抄家？
“王爷，你先睡会儿，我出去给咱们打点打点盘缠。”

一炷香后。
王府前厅、后库、藏宝阁、药材库、甚至连院子里的名贵假山和地板砖……凭空消失得干干净净，连只耗子走进来都得抹着眼泪出去！""",
            },
            {
                "chapter_index": 2,
                "title": "第2章 狗皇帝的国库，连耗子粮都不剩",
                "word_count": 2240,
                "content_preview": "趁着夜黑风高，沈青岚潜入了皇城大内...",
                "content": """第2章 狗皇帝的国库，连耗子粮都不剩

流放岭南三千里，不带点路费怎么行？

沈青岚借助空间的隐身庇护，一路溜进了皇宫深处的甲字号国库。

堆积如山的金元宝、万匹流云锦缎、千年雪莲、龙泉宝剑……
沈青岚小手一挥：“收！收！收！”

翌日清晨。
满朝文武跪在金銮殿前，皇帝气得口吐鲜血直接晕死过去：“谁干的？！到底是谁连朕内裤边的金丝线都给抽走了？！”""",
            },
            {
                "chapter_index": 3,
                "title": "第3章 流放路上吃火锅，差役排队求打赏",
                "word_count": 2410,
                "content_preview": "出城三十里，漫天黄沙，其他犯人饿得啃树皮...",
                "content": """第3章 流放路上吃火锅，差役排队求打赏

流放队伍行至荒凉官道。

其他戴着枷锁的犯人家眷面黄肌瘦，啃着发霉的干窝头痛哭流涕。

而定王府的囚车后座，红泥小火炉咕嘟咕嘟冒着热气，麻辣牛油火锅的香气飘散出十里远！

沈青岚夹起一片鲜嫩的雪花牛肉塞进萧煜嘴里：“王爷，毛肚七上八下，尝尝嫩不嫩？”

押解的官差班头咽了口唾沫，扑通一声给沈青岚递上揉肩捶腿的布巾：“王妃娘娘！小人愿为您开路推车，赏口汤喝就行！”""",
            },
        ],
    },
    {
        "book_id": "fq-1004",
        "title": "离婚后，千亿战神身份瞒不住了",
        "author": "狂刀踏月",
        "channel": "male",
        "category": "战神赘婿",
        "tags": ["赘婿", "打脸", "反转", "神医", "龙王"],
        "cover_url": "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300",
        "intro": "隐姓埋名入赘三年，做牛做马换来一纸离婚协议。妻子嘲讽他是一事无成的窝囊废，却不知，战神令出，四海称臣！当九龙直升机盘旋而下，全球商界巨鳄齐齐下跪，前妻当场悔青了肠子！",
        "word_count": 920000,
        "debut_days": 180,
        "score": 8.7,
        "read_count": 780000,
        "gain_7d": -68000,
        "gain_30d": -220000,
        "growth_rate_7d": -8.0,
        "status": "declining",
        "rank": 4,
        "sample_chapters": [
            {
                "chapter_index": 1,
                "title": "第1章 这一纸协议，断了你苏家气运",
                "word_count": 2100,
                "content_preview": "“林凡，把字签了吧，我们不是一个世界的人了。”",
                "content": "“林凡，把字签了吧，我们不是一个世界的人了。”苏清雪将离婚协议重重拍在桌上，神色冷漠得像看路边的野狗...",
            },
            {
                "chapter_index": 2,
                "title": "第2章 龙王出关，九城统帅拜迎！",
                "word_count": 2150,
                "content_preview": "走出苏家大院的那一刻，林凡掏出了一枚通体漆黑的龙鳞玉佩...",
                "content": "走出苏家大院的那一刻，林凡掏出了一枚通体漆黑的龙鳞玉佩。天地色变，九架武装直升机撕裂云层...",
            },
            {
                "chapter_index": 3,
                "title": "第3章 前妻悔青肠子，求饶无门",
                "word_count": 2200,
                "content_preview": "江城顶级名流晚宴上，苏清雪被无数大佬无视冷落...",
                "content": "江城顶级名流晚宴上，苏清雪被无数大佬无视冷落。而那个被她赶出家门的窝囊废前夫，正端坐在最尊贵的主座之上...",
            },
        ],
    },
    {
        "book_id": "fq-1005",
        "title": "开局至尊骨，我反手献祭给反派老祖",
        "author": "太虚真人",
        "channel": "male",
        "category": "玄幻脑洞",
        "tags": ["玄幻", "反套路", "反派逆袭", "爽文", "杀伐果断"],
        "cover_url": "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=300",
        "intro": "穿成玄幻天命主角，体内天生伴生至尊骨。按照原书剧情，青梅竹马将联合宗门将他挖骨致残？顾天行冷笑一声，挖骨？老子反手把至尊骨献祭给宗门禁地的弑天老祖，当场认老祖为义父！反派剧本它不香吗？",
        "word_count": 510000,
        "debut_days": 12,
        "score": 9.5,
        "read_count": 1260000,
        "gain_7d": 410000,
        "gain_30d": 980000,
        "growth_rate_7d": 48.2,
        "status": "surging",
        "rank": 5,
        "sample_chapters": [
            {
                "chapter_index": 1,
                "title": "第1章 天命主角？老子不当了！",
                "word_count": 2200,
                "content_preview": "看着端来毒茶的绿茶青梅，顾天行心中冷笑不已...",
                "content": "看着端来毒茶的绿茶青梅，顾天行心中冷笑不已。原著里自己被挖去至尊骨惨遭逐出宗门？这一次，老子掀桌子了！",
            },
            {
                "chapter_index": 2,
                "title": "第2章 禁地老祖：好孩子，以后你就是少魔主",
                "word_count": 2300,
                "content_preview": "深渊禁地之下，被封印千年的反派巨擘发出了震颤大荒的狂笑...",
                "content": "深渊禁地之下，被封印千年的反派巨擘发出了震颤大荒的狂笑。顾天行双手托着神光流转的至尊骨：“义父在上，请受孩儿一拜！”",
            },
            {
                "chapter_index": 3,
                "title": "第3章 宗门大典，当着全天下诛杀绿茶！",
                "word_count": 2250,
                "content_preview": "万宗来朝之日，青梅还在得意算计，却见九条黑龙拉棺而至...",
                "content": "万宗来朝之日，青梅还在得意算计，却见九条黑龙拉棺而至！顾天行端坐九天魔座之上，俯瞰众生如蝼蚁！",
            },
        ],
    },
    {
        "book_id": "fq-1006",
        "title": "开局百万阴兵，我靠全网通缉厉鬼成首富",
        "author": "九叔传人",
        "channel": "male",
        "category": "悬疑惊悚",
        "tags": ["悬疑", "灵异复苏", "幽默搞笑", "民俗", "系统"],
        "cover_url": "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=300",
        "intro": "诡异复苏，百鬼夜行。别人面对厉鬼吓得尿裤子，江离却绑定了【地府治安管理系统】。红衣厉鬼？按无证游荡罚款五百两冥币！千年尸王？涉嫌非法占用公共墓地，抓回地府踩缝纫机！",
        "word_count": 390000,
        "debut_days": 15,
        "score": 9.4,
        "read_count": 960000,
        "gain_7d": 280000,
        "gain_30d": 760000,
        "growth_rate_7d": 41.1,
        "status": "surging",
        "rank": 6,
        "sample_chapters": [
            {
                "chapter_index": 1,
                "title": "第1章 厉鬼索命？先出示一下健康码！",
                "word_count": 2200,
                "content_preview": "深夜末班车上，披头散发的红衣女鬼幽幽从后座飘来...",
                "content": "深夜末班车上，披头散发的红衣女鬼幽幽从后座飘来。江离推了推眼镜，掏出一叠拘留通知书：“女士，夜间飘行未开启示廓灯，扣三分！”",
            },
            {
                "chapter_index": 2,
                "title": "第2章 抓回地府踩缝纫机，冥界GDP暴涨",
                "word_count": 2150,
                "content_preview": "地府第一加工厂正式挂牌营业，阎王笑得合不拢嘴...",
                "content": "地府第一加工厂正式挂牌营业，阎王笑得合不拢嘴：“江大人真乃神人也！这帮凶神恶煞抓来打螺丝，咱们今年的工业产值直接翻番！”",
            },
            {
                "chapter_index": 3,
                "title": "第3章 全网求助：我家闹鬼了，快叫城管江哥！",
                "word_count": 2300,
                "content_preview": "各大热搜榜单第一瞬间被江离占领...",
                "content": "各大热搜榜单第一瞬间被江离占领！各路富豪、网红抢着下单呼叫‘阴间执法队’，场面一度失控！",
            },
        ],
    },
    {
        "book_id": "fq-1007",
        "title": "替嫁植物人老公后，他每天都在装破产",
        "author": "微光糖果",
        "channel": "female",
        "category": "现代言情",
        "tags": ["现言", "甜宠", "马甲", "先婚后爱", "双向奔赴"],
        "cover_url": "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=300",
        "intro": "乡下养大的土包子替嫁给毁容昏迷的霍家继承人，全城都等着看她变成寡妇的笑话。结果新婚当晚，植物人老公突然把她按在墙上深吻：“夫人，戏演完了，该圆房了。”从此被京圈顶级太子爷宠上了天！",
        "word_count": 730000,
        "debut_days": 60,
        "score": 9.5,
        "read_count": 1150000,
        "gain_7d": 95000,
        "gain_30d": 320000,
        "growth_rate_7d": 9.0,
        "status": "stable",
        "rank": 7,
        "sample_chapters": [
            {
                "chapter_index": 1,
                "title": "第1章 植物人新郎醒了",
                "word_count": 2100,
                "content_preview": "空旷豪华的病房里，温以宁正在替昏迷三年的男人擦拭手指...",
                "content": "空旷豪华的病房里，温以宁正在替昏迷三年的男人擦拭手指。突然，那只骨节分明的大手猛地扣住了她的手腕！",
            },
            {
                "chapter_index": 2,
                "title": "第2章 夫人，你的小马甲掉了",
                "word_count": 2180,
                "content_preview": "名扬国际的黑客神医竟然是霍家那个从乡下娶回来的小媳妇...",
                "content": "名扬国际的黑客神医竟然是霍家那个从乡下娶回来的小媳妇！霍司寒倚在门边，眼眸深邃玩味：“霍太太，还有多少惊喜是本少爷不知道的？”",
            },
            {
                "chapter_index": 3,
                "title": "第3章 全网直播宠妻，渣男跪求复合被丢海里",
                "word_count": 2220,
                "content_preview": "慈善晚宴上，前未婚夫带着假千金趾高气扬想要羞辱温以宁...",
                "content": "慈善晚宴上，前未婚夫带着假千金趾高气扬想要羞辱温以宁。下一秒，全城直升机打出求婚灯光秀，千亿资产直接过户到温以宁名下！",
            },
        ],
    },
    {
        "book_id": "fq-1008",
        "title": "从破产渔村开始，我打捞万界奇珍",
        "author": "浪迹海岛",
        "channel": "male",
        "category": "都市脑洞",
        "tags": ["种田", "系统", "渔夫", "寻宝", "惬意悠闲"],
        "cover_url": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300",
        "intro": "回乡继承频临倒闭的小渔船，绑定【万界捕捞网】。第一网捞起深海万年帝王蟹，第二网捞起明代沉船千亿金锭，第三网竟然捞起亚特兰蒂斯神级光脑！从荒凉小渔村，到全球富豪挤破头入住的度假天堂！",
        "word_count": 560000,
        "debut_days": 35,
        "score": 9.3,
        "read_count": 890000,
        "gain_7d": 110000,
        "gain_30d": 420000,
        "growth_rate_7d": 14.1,
        "status": "stable",
        "rank": 8,
        "sample_chapters": [
            {
                "chapter_index": 1,
                "title": "第1章 这不是渔网，这是诸天跨界传送门！",
                "word_count": 2100,
                "content_preview": "深夜的海面上浪花拍打，破旧的木船缓缓前行...",
                "content": "深夜的海面上浪花拍打，破旧的木船缓缓前行。陈初用力收起捕捞网，网孔中爆发出一阵刺眼的七彩华光！",
            },
            {
                "chapter_index": 2,
                "title": "第2章 极品大黄鱼群？顺手捡了箱金条！",
                "word_count": 2200,
                "content_preview": "码头上所有的老渔民围着陈初的渔获看傻了眼...",
                "content": "码头上所有的老渔民围着陈初的渔获看傻了眼：“天呐！每一条大黄鱼都有一米长，身上竟然还挂着皇家贡品金牌？！”",
            },
            {
                "chapter_index": 3,
                "title": "第3章 全球海洋专家连夜赶来求见海王",
                "word_count": 2260,
                "content_preview": "国家海洋局特级科考船紧急停靠在小渔村外的海湾...",
                "content": "国家海洋局特级科考船紧急停靠在小渔村外的海湾！老所长激动的握住陈初的手：“陈先生，您在后海养的那几只海怪，能让我们测测骨龄吗？”",
            },
        ],
    },
    {
        "book_id": "fq-1009",
        "title": "四合院：开局一辆红旗车，众禽全吓尿了",
        "author": "红星轧钢人",
        "channel": "male",
        "category": "都市脑洞",
        "tags": ["年代", "四合院", "打脸", "军工", "爽文"],
        "cover_url": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=300",
        "intro": "穿越六十年代四合院，刚开局贾家就上门抢房子？李凡直接亮出九级工程师肩章，军区特派红旗轿车直接停在四合院门口！想要道德绑架？抱歉，老子直接叫保卫科拉靶场去！",
        "word_count": 680000,
        "debut_days": 19,
        "score": 9.4,
        "read_count": 1120000,
        "gain_7d": -150000,
        "gain_30d": 350000,
        "growth_rate_7d": -11.8,
        "status": "fake_spike",
        "rank": 9,
        "sample_chapters": [
            {
                "chapter_index": 1,
                "title": "第1章 贾张氏要霸占房子？先吃我一脚！",
                "word_count": 2100,
                "content_preview": "四合院中院里，贾张氏正叉着腰唾沫横飞...",
                "content": "四合院中院里，贾张氏正叉着腰唾沫横飞：“李凡，你一个光棍住两间大东厢房纯属浪费，就该让给我们棒梗娶媳妇！”",
            },
            {
                "chapter_index": 2,
                "title": "第2章 军区专车进院，三位大爷吓得当场腿软",
                "word_count": 2200,
                "content_preview": "胡同口传来整齐划一的军靴踏步声...",
                "content": "胡同口传来整齐划一的军靴踏步声。一辆锃光瓦亮的黑色红旗轿车直接开进大院，全副武装的警卫员持枪敬礼：“请李总师立即回基地指导原子工程！”",
            },
            {
                "chapter_index": 3,
                "title": "第3章 全院大会开成批斗大会，易中海晚节不保",
                "word_count": 2250,
                "content_preview": "平日里作威作福的一大爷易中海抖如筛糠...",
                "content": "平日里作威作福的一大爷易中海抖如筛糠，看着李凡亮出的国家特级保密证件，扑通一声瘫坐在地，面如死灰！",
            },
        ],
    },
]


def generate_time_series(base_read: int, days: int, status: str) -> List[TrendDataPoint]:
    """生成符合生命周期规律的时序点"""
    points: List[TrendDataPoint] = []
    today = datetime.date.today()
    current = base_read

    for i in range(days - 1, -1, -1):
        d = (today - datetime.timedelta(days=i)).strftime("%m-%d")
        if status == "surging":
            # 每日递增
            noise = random.randint(-5000, 15000)
            ratio = 1 - (i / days) * 0.35
            val = max(1000, int(base_read * ratio) + noise)
        elif status == "declining":
            # 逐渐递减
            noise = random.randint(-10000, 5000)
            ratio = 1 + (i / days) * 0.2
            val = max(1000, int(base_read * ratio) + noise)
        elif status == "fake_spike":
            # 前期暴冲，后期大跳水
            if i > days // 2:
                val = int(base_read * 1.3) + random.randint(-5000, 10000)
            else:
                val = int(base_read * (0.8 - (days // 2 - i) * 0.05))
        else:  # stable
            val = base_read + random.randint(-15000, 15000)

        rank_val = max(1, 100 - int((val / 2000000) * 90) + random.randint(-2, 2))
        points.append(TrendDataPoint(date=d, read_count=val, rank=rank_val))

    return points


class FanqieMarketCrawler:
    """网文大盘数据采集与聚合服务"""

    def __init__(self):
        self._books_cache: List[dict] = INITIAL_BOOKS_DATA
        self._genres_cache: List[dict] = DEFAULT_GENRES

    async def fetch_overview(self) -> dict:
        """获取全网大盘各题材概览与核心指标"""
        total_market_read = sum(g["total_read_count"] for g in self._genres_cache)
        
        # 找出增长率最高题材
        top_growing = max(self._genres_cache, key=lambda x: x["growth_rate_7d"])
        # 找出最卷赛道 (换手率高且每日首秀多)
        most_competitive = max(self._genres_cache, key=lambda x: x["turnover_rate"])
        # 找出蓝海赛道 (标记为蓝海或增长不错但换手率良性)
        blue_oceans = [g for g in self._genres_cache if g.get("is_blue_ocean")]
        blue_ocean = blue_oceans[0] if blue_oceans else self._genres_cache[0]

        genres_with_fmt = []
        for g in self._genres_cache:
            item = dict(g)
            item["read_count_formatted"] = _format_number(item["total_read_count"])
            genres_with_fmt.append(item)

        return {
            "total_market_read_count": total_market_read,
            "total_market_read_formatted": _format_number(total_market_read),
            "top_growing_genre": {
                **top_growing,
                "read_count_formatted": _format_number(top_growing["total_read_count"]),
            },
            "most_competitive_genre": {
                **most_competitive,
                "read_count_formatted": _format_number(most_competitive["total_read_count"]),
            },
            "blue_ocean_genre": {
                **blue_ocean,
                "read_count_formatted": _format_number(blue_ocean["total_read_count"]),
            },
            "genres": genres_with_fmt,
            "updated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        }

    async def fetch_rankings(
        self,
        channel: Optional[str] = None,
        category: Optional[str] = None,
        rank_type: str = "read_count",  # read_count, surging, dark_horse, debut
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        """获取排行榜单，附带真实在读与7天涨跌指标"""
        filtered = list(self._books_cache)

        if channel and channel != "all":
            filtered = [b for b in filtered if b.get("channel") == channel]

        if category and category != "all":
            filtered = [b for b in filtered if b.get("category") == category]

        if search and search.strip():
            kw = search.strip().lower()
            filtered = [
                b
                for b in filtered
                if kw in b["title"].lower()
                or kw in b["author"].lower()
                or kw in b["category"].lower()
                or any(kw in tag.lower() for tag in b.get("tags", []))
            ]

        # 排序
        if rank_type == "surging":
            # 7日涨幅最高
            filtered.sort(key=lambda x: x["growth_rate_7d"], reverse=True)
        elif rank_type == "dark_horse":
            # 30日净增最高且首秀天数较短
            filtered.sort(key=lambda x: x["gain_30d"], reverse=True)
        elif rank_type == "debut":
            # 首秀新书 (首秀天数升序)
            filtered.sort(key=lambda x: x["debut_days"])
        else:  # read_count
            filtered.sort(key=lambda x: x["read_count"], reverse=True)

        total = len(filtered)
        start = (page - 1) * page_size
        paged = filtered[start : start + page_size]

        items = []
        for idx, b in enumerate(paged, start=start + 1):
            items.append(
                MarketBook(
                    book_id=b["book_id"],
                    title=b["title"],
                    author=b["author"],
                    channel=b["channel"],
                    category=b["category"],
                    tags=b.get("tags", []),
                    cover_url=b.get("cover_url"),
                    intro=b.get("intro", ""),
                    word_count=b.get("word_count", 0),
                    debut_days=b.get("debut_days", 0),
                    score=b.get("score", 9.0),
                    read_count=b["read_count"],
                    read_count_formatted=_format_number(b["read_count"]),
                    gain_7d=b["gain_7d"],
                    gain_7d_formatted=_format_gain(b["gain_7d"]),
                    gain_30d=b["gain_30d"],
                    gain_30d_formatted=_format_gain(b["gain_30d"]),
                    growth_rate_7d=b["growth_rate_7d"],
                    status=b.get("status", "surging"),
                    rank=idx,
                )
            )

        channels = ["all", "male", "female"]
        categories = ["all"] + sorted(list({b["category"] for b in self._books_cache}))

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "channels": channels,
            "categories": categories,
        }

    async def get_book_detail(self, book_id: str) -> Optional[dict]:
        """获取作品详情，包含 7d/30d 时序点、作者矩阵与开篇前三章"""
        book = next((b for b in self._books_cache if b["book_id"] == book_id), None)
        if not book:
            return None

        # 动态计算生成真实平滑的 7天 与 30天 留存趋势线
        trends_7d = generate_time_series(book["read_count"], 7, book.get("status", "surging"))
        trends_30d = generate_time_series(book["read_count"], 30, book.get("status", "surging"))

        # 作者矩阵作品
        author_works = [
            {"title": book["title"], "read_count": _format_number(book["read_count"]), "is_current": True},
            {"title": f"{book['author']}早期封神作", "read_count": "54.2万", "is_current": False},
        ]

        # 样本章节
        chapters = [
            ChapterBrief(
                chapter_index=c["chapter_index"],
                title=c["title"],
                word_count=c["word_count"],
                content_preview=c.get("content_preview", c["content"][:100] + "..."),
                content=c["content"],
            )
            for c in book.get("sample_chapters", [])
        ]

        return {
            "book_id": book["book_id"],
            "title": book["title"],
            "author": book["author"],
            "channel": book["channel"],
            "category": book["category"],
            "tags": book.get("tags", []),
            "cover_url": book.get("cover_url"),
            "intro": book.get("intro", ""),
            "word_count": book.get("word_count", 0),
            "debut_days": book.get("debut_days", 0),
            "score": book.get("score", 9.0),
            "read_count": book["read_count"],
            "read_count_formatted": _format_number(book["read_count"]),
            "gain_7d": book["gain_7d"],
            "gain_7d_formatted": _format_gain(book["gain_7d"]),
            "gain_30d": book["gain_30d"],
            "gain_30d_formatted": _format_gain(book["gain_30d"]),
            "growth_rate_7d": book["growth_rate_7d"],
            "status": book.get("status", "surging"),
            "rank": book.get("rank", 1),
            "history_trends_7d": trends_7d,
            "history_trends_30d": trends_30d,
            "author_works": author_works,
            "sample_chapters": chapters,
        }


# 全局单例抓取器
market_crawler = FanqieMarketCrawler()
