/**
 * Compliance & Typo Rules Dictionary
 *
 * 网文合规敏感词与常见错别字词典（纯本地离线扫描）。
 */

export type ComplianceCategory = "prohibited" | "warning" | "typo";

export interface ComplianceRule {
  pattern: RegExp;
  category: ComplianceCategory;
  message: string;
  replacement?: string;
}

export interface ComplianceMatch {
  from: number;
  to: number;
  word: string;
  category: ComplianceCategory;
  message: string;
  replacement?: string;
}

// 常见网文易错成语与错别字映射表
const TYPO_WORDS: Array<{ typo: string; correct: string; note?: string }> = [
  { typo: "按步就班", correct: "按部就班", note: "部：门类，秩序" },
  { typo: "迫不急待", correct: "迫不及待", note: "及：急切到顾不上" },
  { typo: "鬼鬼崇崇", correct: "鬼鬼祟祟", note: "祟：鬼怪" },
  { typo: "穿流不息", correct: "川流不息", note: "川：河流" },
  { typo: "走头无路", correct: "走投无路", note: "投：投奔" },
  { typo: "名列前矛", correct: "名列前茅", note: "茅：古代楚国军旗用茅草" },
  { typo: "变本加利", correct: "变本加厉", note: "厉：更加严重" },
  { typo: "金壁辉煌", correct: "金碧辉煌", note: "碧：碧玉翡翠色" },
  { typo: "甘败下风", correct: "甘拜下风", note: "拜：跪拜" },
  { typo: "针贬时弊", correct: "针砭时弊", note: "砭：古代石针" },
  { typo: "出奇不意", correct: "出其不意", note: "其：指代对方" },
  { typo: "再接再励", correct: "再接再厉", note: "厉：同砺，磨砺" },
  { typo: "黄梁一梦", correct: "黄粱一梦", note: "粱：黄米" },
  { typo: "一愁莫展", correct: "一筹莫展", note: "筹：计策算筹" },
  { typo: "不记其数", correct: "不计其数", note: "计：计算" },
  { typo: "通霄达旦", correct: "通宵达旦", note: "宵：夜间" },
  { typo: "默守成规", correct: "墨守成规", note: "墨：墨子善守" },
  { typo: "脉博", correct: "脉搏", note: "搏：跳动" },
  { typo: "精萃", correct: "精粹", note: "粹：纯粹精华" },
  { typo: "坐阵", correct: "坐镇", note: "镇：镇守" },
  { typo: "首冲其中", correct: "首当其冲", note: "当：承受" },
  { typo: "旁证博引", correct: "旁征博引", note: "征：引证搜集" },
  { typo: "滥芋充数", correct: "滥竽充数", note: "竽：古代乐器" },
  { typo: "草管人命", correct: "草菅人命", note: "菅：野草" },
  { typo: "世外桃园", correct: "世外桃源", note: "源：水源源头" },
  { typo: "仗义直言", correct: "仗义执言", note: "执：坚持" },
  { typo: "谈笑风声", correct: "谈笑风生", note: "生：产生" },
  { typo: "浮想联篇", correct: "浮想联翩", note: "翩：鸟飞轻疾" },
  { typo: "声名雀起", correct: "声名鹊起", note: "鹊：喜鹊飞起" },
  { typo: "宣宾夺主", correct: "喧宾夺主", note: "喧：喧哗" },
];

// 高危违禁词（涉暴恐、违禁枪支弹药等网文红线）
const PROHIBITED_WORDS = [
  "冰毒",
  "海洛因",
  "摇头丸",
  "麻古",
  "芬太尼",
  "自制炸弹",
  "雷管炸药",
  "黑火药配方",
  "剧毒氰化物",
  "买卖枪支",
  "自制枪械",
  "买卖假币",
  "暗网洗钱",
];

// 敏感审核警告词（极易在起点、番茄等平台被人工打回或机器封禁的过度描写词）
const WARNING_WORDS = [
  "开膛破肚",
  "剁成肉泥",
  "脑浆四溅",
  "凌迟处死",
  "活体解剖",
  "赤裸下身",
  "两腿之间",
  "敏感地带",
  "春药发作",
  "下药迷奸",
  "催情散",
  "合欢散",
  "采补之术",
  "炉鼎双修",
  "全裸出镜",
];

export function buildComplianceRules(): ComplianceRule[] {
  const rules: ComplianceRule[] = [];

  // 1. 错别字规则
  for (const item of TYPO_WORDS) {
    rules.push({
      pattern: new RegExp(item.typo, "g"),
      category: "typo",
      message: `疑似错别字：建议替换为「${item.correct}」${item.note ? `（${item.note}）` : ""}`,
      replacement: item.correct,
    });
  }

  // 2. 高危违禁词规则
  for (const word of PROHIBITED_WORDS) {
    rules.push({
      pattern: new RegExp(word, "g"),
      category: "prohibited",
      message: `网文高危违禁词「${word}」：可能导致章节直接被平台屏蔽或下架`,
    });
  }

  // 3. 敏感审核警告词规则
  for (const word of WARNING_WORDS) {
    rules.push({
      pattern: new RegExp(word, "g"),
      category: "warning",
      message: `网文敏感描写词「${word}」：易触发主流平台机审拦截或锁章审核`,
    });
  }

  return rules;
}

export const COMPLIANCE_RULES = buildComplianceRules();
