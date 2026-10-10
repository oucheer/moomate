interface AIResult {
  tags: string[];
  reason: string;
  questions: string[];
  review: string;
}

const FALLBACK_TAGS = ["今晚玩家", "轻松社交", "牛牛好奇中"];

export async function aiTagsFromQuiz(answers: Record<string, string>): Promise<string[]> {
  try {
    const res = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: "你是一个轻松、无冒犯的中文社交助手。只输出 JSON 数组，元素为 3-5 个中文标签。" },
          { role: "user", content: `根据以下问答提取今晚社交标签：${JSON.stringify(answers)}` },
        ],
        temperature: 0.7,
        max_tokens: 120,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed.slice(0, 5).map(String);
    return FALLBACK_TAGS;
  } catch {
    return FALLBACK_TAGS;
  }
}

export async function aiMatchReason(a: Record<string, unknown>, b: Record<string, unknown>): Promise<string> {
  try {
    const res = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "你是一个轻松幽默的中文社交配对解说员。用 1-2 句话解释两人在今晚为什么适合一起玩。不预测现实关系，不涉及饮酒或敏感内容。",
          },
          { role: "user", content: `A：${JSON.stringify(a)}\nB：${JSON.stringify(b)}` },
        ],
        temperature: 0.8,
        max_tokens: 160,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json();
    return json.choices?.[0]?.message?.content?.trim() || fallbackReason();
  } catch {
    return fallbackReason();
  }
}

function fallbackReason(): string {
  const templates = [
    "你们的节奏很像今晚的节拍器：既有共同兴趣，也刚好能互相带一点新鲜感。",
    "一头会带气氛，一头会接住话题，这组合今晚很容易玩起来。",
    "你们的今晚目标很接近，对话大概不会冷场。",
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

const FALLBACK_QUESTIONS = [
  "如果今晚突然多出两小时，你最想用它们做什么？",
  "你觉得对方此刻心里在想什么？猜猜看！",
  "用一句话向全场推销你的搭档，你会怎么说？",
];

export async function aiGameQuestions(a: Record<string, unknown>, b: Record<string, unknown>): Promise<string[]> {
  try {
    const res = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "生成 3 个适合酒吧线下双人玩的轻松问题，每人独立回答后互相揭晓。不要涉及饮酒、隐私、身体接触或敏感话题。只输出 JSON 数组，每个元素为一句中文。",
          },
          { role: "user", content: `两人资料：${JSON.stringify([a, b])}` },
        ],
        temperature: 0.9,
        max_tokens: 260,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json();
    const parsed = JSON.parse(json.choices?.[0]?.message?.content);
    if (Array.isArray(parsed) && parsed.length >= 3) {
      return parsed.slice(0, 3).map(String);
    }
    return FALLBACK_QUESTIONS;
  } catch {
    return FALLBACK_QUESTIONS;
  }
}

export async function aiGameReview(a: Record<string, unknown>, b: Record<string, unknown>, answers: Record<string, string>): Promise<string> {
  try {
    const res = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "你是一个轻松幽默的中文默契点评员。用 2-3 句话点评两人的答案，指出共同点、有趣反差和今晚的合作表现。不预测关系发展。",
          },
          { role: "user", content: `A/B 资料与答案：${JSON.stringify({ a, b, answers })}` },
        ],
        temperature: 0.8,
        max_tokens: 240,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json();
    return json.choices?.[0]?.message?.content?.trim() || fallbackReview();
  } catch {
    return fallbackReview();
  }
}

function fallbackReview(): string {
  return "你们今晚的答案既有共同节奏，也有有趣的小反差。这种组合最适合继续一起玩几轮，看看默契还能不能更牛一点。";
}

export type { AIResult };
