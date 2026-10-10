interface AIResult {
  tags: string[];
  reason: string;
  questions: string[];
  review: string;
}

const FALLBACK_TAGS = ["今晚玩家", "轻松社交", "牛牛好奇中"];

async function chat(messages: Array<{ role: string; content: string | any[] }>, maxTokens: number, temperature = 0.8): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const res = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", messages, temperature, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(15000),
    });
    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

export async function aiTagsFromQuiz(answers: Record<string, string>): Promise<string[]> {
  const content = await chat(
    [
      { role: "system", content: "你是一个轻松、无冒犯的中文社交助手。只输出 JSON 数组，元素为 3-5 个中文标签。" },
      { role: "user", content: `根据以下问答提取今晚社交标签：${JSON.stringify(answers)}` },
    ],
    120, 0.7
  );
  if (content) {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed.slice(0, 5).map(String);
    } catch { /* fallback */ }
  }
  return FALLBACK_TAGS;
}

export async function aiMatchReason(a: Record<string, unknown>, b: Record<string, unknown>): Promise<string> {
  const content = await chat(
    [
      { role: "system", content: "你是一个轻松幽默的中文社交配对解说员。用 1-2 句话解释两人在今晚为什么适合一起玩。不预测现实关系，不涉及饮酒或敏感内容。" },
      { role: "user", content: `A：${JSON.stringify(a)}\nB：${JSON.stringify(b)}` },
    ],
    160, 0.8
  );
  return content?.trim() || fallbackReason();
}

function fallbackReason(): string {
  const templates = [
    "你们的节奏很像今晚的节拍器：既有共同兴趣，也刚好能互相带一点新鲜感。",
    "一头会带气氛，一头会接住话题，这组合今晚很容易玩起来。",
    "你们的今晚目标很接近，对话大概不会冷场。",
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

// ================= 线下挑战赛：4 关生成 =================

export interface StageDef {
  stage: number;
  type: "quiz" | "pose" | "hunt" | "act";
  title: string;
  text: string;      // 题目 / 挑战说明
  tips?: string[];   // 小提示
}

const FALLBACK_PLAN: StageDef[] = [
  {
    stage: 1, type: "quiz", title: "第一关 · 读心快答",
    text: "如果 Homebar 的饮料墙突然活过来，你觉得它最想先跟谁搭话？为什么？",
    tips: ["面对面坐好，各自想好再一起揭晓"],
  },
  {
    stage: 2, type: "pose", title: "第二关 · 双牛造型挑战",
    text: "两人合作，用身体 + 桌上的任意道具，摆出一个『牛牛挤地铁早高峰』的造型，拍一张合照！",
    tips: ["可以借用椅子、杯子、菜单当道具", "越夸张得分越高，害羞就输了"],
  },
  {
    stage: 3, type: "hunt", title: "第三关 · Homebar 侦探",
    text: "在酒吧里找到三样东西并合影：① 一件红色的物品 ② 一个圆形的东西 ③ 你们俩都觉得最『牛』的角落",
    tips: ["限时 3 分钟，一起行动才算数", "找到后站在目标旁边合影"],
  },
  {
    stage: 4, type: "act", title: "终关 · 牛气合演",
    text: "用 10 秒钟，即兴演绎『两只牛牛第一次见面』的场景——必须有至少一声牛叫！",
    tips: ["拍成照片留证，或直接喊主理人来当观众"],
  },
];

/** 根据两人档案生成个性化 4 关任务（全部需要线下一起完成） */
export async function aiStagePlan(a: Record<string, unknown>, b: Record<string, unknown>): Promise<StageDef[]> {
  const content = await chat(
    [
      {
        role: "system",
        content:
          "你是酒吧线下双人社交游戏『牛牛大挑战』的 AI 导演。请根据两人资料生成 4 关任务，只输出 JSON：" +
          '{"quiz":{"text":"一道轻松搞笑的默契快答题"},"pose":{"title":"双牛造型挑战","text":"一个两人合作摆拍挑战，要用到身体和桌面道具，主题有趣具体"},"hunt":{"title":"Homebar侦探","text":"在酒吧里找 2-3 样具体物品并合影的任务，物品要常见且具体"},"act":{"title":"牛气合演","text":"一个 10 秒即兴表演任务，必须两人都参与"}}。' +
          "全部任务必须线下面对面完成，不要涉及饮酒压力、危险动作或让任何一方尴尬的内容。要根据两人的兴趣定制主题。",
      },
      { role: "user", content: `两人资料：A=${JSON.stringify(a)}，B=${JSON.stringify(b)}` },
    ],
    400, 0.9
  );
  if (content) {
    try {
      const p = JSON.parse(content.replace(/```json?|```/g, "").trim());
      const plan: StageDef[] = [];
      if (p.quiz?.text) plan.push({ stage: 1, type: "quiz", title: "第一关 · 读心快答", text: String(p.quiz.text) });
      if (p.pose?.text) plan.push({ stage: 2, type: "pose", title: p.pose.title || "第二关 · 双牛造型挑战", text: String(p.pose.text) });
      if (p.hunt?.text) plan.push({ stage: 3, type: "hunt", title: p.hunt.title || "第三关 · Homebar 侦探", text: String(p.hunt.text), tips: ["限时 3 分钟，一起行动才算数"] });
      if (p.act?.text) plan.push({ stage: 4, type: "act", title: p.act.title || "终关 · 牛气合演", text: String(p.act.text) });
      if (plan.length === 4) return plan;
    } catch { /* fallback */ }
  }
  return FALLBACK_PLAN;
}

// ================= AI 裁判 =================

export interface JudgeVerdict { comment: string; sync: number }

function judgeFallback(stageType: string, sync: number): JudgeVerdict {
  const pools: Record<string, string[]> = {
    quiz: [
      "答案对上了，你们今晚怕不是共享一个脑电波。",
      "一半合拍一半反差，这种组合最好玩。",
    ],
    pose: [
      "这个造型我已经截图存档了，主理人看了都想发朋友圈。",
      "肢体表现力满分，建议今晚直接出道。",
      "有内味了！地铁牛牛本牛，评委无话可说。",
    ],
    hunt: [
      "侦查能力一流，酒吧在你们面前没有秘密。",
      "找得又快又准，这默契去开侦探社都行。",
    ],
    act: [
      "那段牛叫我给满分，奥斯卡欠你们一座小金像。",
      "即兴发挥比剧本还精彩，掌声送给两位戏精。",
    ],
  };
  const pool = pools[stageType] || pools.quiz;
  return { comment: pool[Math.floor(Math.random() * pool.length)], sync };
}

/**
 * AI 裁判。photoPath 存在时用视觉模型看照片打分；无 Key 时按类型给有趣点评。
 */
export async function aiJudge(input: {
  stageType: "quiz" | "pose" | "hunt" | "act";
  challenge: string;
  aAns?: string; bAns?: string; guessA?: string; guessB?: string;
  photoPath?: string; nameA?: string; nameB?: string;
}): Promise<JudgeVerdict> {
  const { stageType, challenge, aAns, bAns, guessA, guessB, photoPath, nameA, nameB } = input;

  // 视觉判卷：下载照片 → base64 → vision
  if (photoPath && process.env.OPENAI_API_KEY) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { data: file } = await sb.storage.from("photos").download(photoPath);
      if (file) {
        const buf = Buffer.from(await file.arrayBuffer());
        const mime = photoPath.endsWith(".png") ? "image/png" : photoPath.endsWith(".webp") ? "image/webp" : "image/jpeg";
        const b64 = `data:${mime};base64,${buf.toString("base64")}`;
        const content = await chat(
          [
            {
              role: "system",
              content:
                "你是酒吧双人挑战赛的 AI 裁判『牛牛裁判』，幽默、温暖、偶尔毒舌。看照片评判两人是否真的合作完成了挑战，输出 JSON：{\"comment\":\"1-2句点评，夸具体细节\",\"sync\":0到100}" +
                "。照片糊或没拍好也要给鼓励分，不许打低于 40 分。",
            },
            {
              role: "user",
              content: [
                { type: "text", text: `挑战：${challenge}\n两位选手：${nameA} 和 ${nameB}。请裁判！` },
                { type: "image_url", image_url: { url: b64 } },
              ],
            },
          ],
          200, 0.85
        );
        if (content) {
          try {
            const p = JSON.parse(content.replace(/```json?|```/g, "").trim());
            if (p.comment) return { comment: String(p.comment).slice(0, 180), sync: Math.max(40, Math.min(100, Math.round(p.sync))) };
          } catch { /* fallback below */ }
        }
      }
    } catch { /* fallback below */ }
  }

  // 文本判卷（quiz 阶段或无照片时）
  if (stageType === "quiz" && aAns && bAns) {
    const content = await chat(
      [
        {
          role: "system",
          content:
            '你是酒吧默契游戏的 AI 裁判『牛牛裁判』，轻松幽默。两人刚各自回答同一道题' +
            (guessA || guessB ? "并互相预测了对方答案" : "") +
            '。判定预测是否语义命中，输出 JSON：{"comment":"2句内点评，引用答案细节","sync":0到100,"hitA":A是否猜中B,"hitB":B是否猜中A}',
        },
        { role: "user", content: JSON.stringify({ 题目: challenge, A: aAns, B: bAns, A猜B: guessA || null, B猜A: guessB || null }) },
      ],
      240, 0.85
    );
    if (content) {
      try {
        const p = JSON.parse(content.replace(/```json?|```/g, "").trim());
        if (p.comment) {
          return {
            comment: String(p.comment).slice(0, 180),
            sync: Math.max(0, Math.min(100, Math.round(p.sync))),
            ...(typeof p.hitA === "boolean" ? { hitA: p.hitA, hitB: p.hitB } : {}),
          } as JudgeVerdict & { hitA?: boolean; hitB?: boolean };
        }
      } catch { /* fallback below */ }
    }
    const sync = similarityScore(aAns, bAns);
    return { ...judgeFallback("quiz", sync), ...guessHits(aAns, bAns, guessA, guessB) };
  }

  // 线下动作关：没有 Key 时给固定区间随机分（鼓励向）
  const base = stageType === "act" ? 88 : 82;
  const sync = base + Math.floor(Math.random() * 13);
  return judgeFallback(stageType, Math.min(100, sync));
}

function similarityScore(a: string, b: string): number {
  const clean = (s: string) => s.replace(/[，。！？、\s.!,?]/g, "");
  const bi = (s: string) => { const set = new Set<string>(); for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2)); return set; };
  const A = bi(clean(a)), B = bi(clean(b));
  if (!A.size || !B.size) return 50;
  let inter = 0; for (const g of A) if (B.has(g)) inter++;
  return Math.min(100, Math.round((inter / Math.min(A.size, B.size)) * 60 + 35));
}

function guessHits(aAns: string, bAns: string, guessA?: string, guessB?: string): { hitA?: boolean; hitB?: boolean } {
  const hit = (g?: string, t?: string) => (g && t ? similarityScore(g, t) >= 60 : undefined);
  const out: { hitA?: boolean; hitB?: boolean } = {};
  const ha = hit(guessA, bAns); if (ha !== undefined) out.hitA = ha;
  const hb = hit(guessB, aAns); if (hb !== undefined) out.hitB = hb;
  return out;
}

// ================= 结尾：故事 + 总评 =================

export async function aiStory(input: { nameA: string; nameB: string; challengeSummary: string }): Promise<string> {
  const content = await chat(
    [
      {
        role: "system",
        content:
          "你是中文故事织造师。写一个 4-6 句的完整小故事：主角是两头牛牛（用玩家昵称），场景在 Homebar 酒吧，把他们的挑战经历写成一场温暖有趣的冒险，结尾落在『两个陌生人把今晚变成了自己的主场』。不要饮酒描写。",
      },
      { role: "user", content: `${input.nameA} 和 ${input.nameB} 的挑战记录：${input.challengeSummary}` },
    ],
    300, 0.9
  );
  if (content?.trim()) return content.trim();
  return [
    `今晚，${input.nameA}和${input.nameB}在 Homebar 从两个陌生人变成了同一条战线的牛牛。`,
    "他们猜中过彼此的心思，摆出过全场最夸张的造型，还在酒吧里找到了只属于他们的秘密角落。",
    "挑战有输有赢，但每一关的笑声都比上一次更大。",
    "故事的下一段没人知道——但牛生第一次，他们把陌生人之夜，玩成了自己的主场。",
  ].join("");
}

export async function aiGameReview(a: Record<string, unknown>, b: Record<string, unknown>, answers: Record<string, string>): Promise<string> {
  const content = await chat(
    [
      { role: "system", content: "你是一个轻松幽默的中文裁判长。用 2-3 句话总结两位选手整场线下挑战赛的表现：最亮眼的瞬间、默契程度、给一个有趣的称号。不预测关系发展。" },
      { role: "user", content: `选手资料与挑战记录：${JSON.stringify({ a, b, answers })}` },
    ],
    240, 0.8
  );
  return content?.trim() || fallbackReview();
}

function fallbackReview(): string {
  return "整场挑战赛，两位选手配合默契、笑点密集、表现力满分。经牛牛裁判委员会一致决定，授予今晚『最强牛搭子』称号！";
}

export type { AIResult };
