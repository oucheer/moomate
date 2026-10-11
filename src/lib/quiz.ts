import type { QuizAnswers } from "@/types";

export type QuestionKey = "q1" | "q2" | "q3" | "q4" | "q5" | "q6" | "q7" | "q8" | "q9" | "q10";
export interface Question {
  key: QuestionKey;
  title: string;
  type: "single" | "multi";
  options: readonly string[];
  max?: number;
  required?: boolean;
}

// q1、q2、q5 提供标签和匹配所需的最低信息，其余问题可跳过。
export const QUESTIONS: readonly Question[] = [
  { key: "q1", title: "聚会时，你通常是哪一型？", type: "single", options: ["组织者", "气氛组", "自在参与", "先观察"], required: true },
  { key: "q2", title: "玩游戏，你更喜欢？", type: "single", options: ["合作通关", "轻松体验", "认真争胜"], required: true },
  { key: "q3", title: "怎样互动让你最自在？", type: "multi", max: 2, options: ["喜欢别人主动破冰", "慢慢熟悉", "一起做点事", "不被突然点名", "可以互开玩笑"] },
  { key: "q4", title: "什么样的人最合你玩？", type: "multi", max: 2, options: ["会聊天", "有行动力", "松弛随和", "兴趣相投"] },
  { key: "q5", title: "今晚最想做什么？", type: "multi", max: 2, options: ["交朋友", "放松", "玩游戏", "跳舞", "找活动搭子"], required: true },
  { key: "q6", title: "你更喜欢哪种聚会？", type: "single", options: ["热闹大场子", "几个人深入聊", "都可以"] },
  { key: "q7", title: "认识新朋友时，你通常会？", type: "single", options: ["主动开聊", "等别人搭话", "看气氛"] },
  { key: "q8", title: "最近什么让你特别上头？", type: "multi", options: ["音乐", "运动", "旅行", "游戏", "影视", "美食", "其他"] },
  { key: "q9", title: "遇到没试过的活动，你会？", type: "single", options: ["马上参加", "先了解一下", "更喜欢熟悉的活动"] },
  { key: "q10", title: "派对结束后，你想？", type: "single", options: ["吃宵夜", "散步聊天", "再玩一局", "回家休息", "看情况"] },
];

export function validateAnswers(value: unknown): { answers?: QuizAnswers; error?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "请填写问卷" };
  const input = value as Record<string, unknown>;
  const answers: QuizAnswers = {};
  for (const question of QUESTIONS) {
    const raw = input[question.key];
    const empty = raw === undefined || raw === null || raw === "" || (Array.isArray(raw) && raw.length === 0);
    if (empty) {
      if (question.required) return { error: `请回答第 ${Number(question.key.slice(1))} 题` };
      continue;
    }
    if (question.type === "single") {
      if (typeof raw !== "string" || !question.options.includes(raw)) return { error: `第 ${question.key.slice(1)} 题选项无效` };
      (answers as Record<string, unknown>)[question.key] = raw;
    } else {
      if (!Array.isArray(raw) || raw.some((v) => typeof v !== "string" || !question.options.includes(v)) || new Set(raw).size !== raw.length || (question.max && raw.length > question.max)) {
        return { error: `第 ${question.key.slice(1)} 题选择超出限制或选项无效` };
      }
      (answers as Record<string, unknown>)[question.key] = raw;
    }
  }
  if (answers.q8?.includes("其他")) {
    if (typeof input.q8Other === "string") answers.q8Other = input.q8Other.trim().slice(0, 30);
  }
  return { answers };
}

const SOCIAL: Record<string, string> = { 组织者: "组织者", 气氛组: "气氛担当", 自在参与: "自在参与", 先观察: "先观察", 主动开聊: "主动破冰", 等别人搭话: "慢热型", 看气氛: "看氛围" };
const INTERACTION: Record<string, string> = { 喜欢别人主动破冰: "喜欢主动交流", 慢慢熟悉: "喜欢边玩边熟", 一起做点事: "喜欢边玩边熟", 不被突然点名: "不爱被点名", 可以互开玩笑: "玩笑友好型" };
const GAME: Record<string, string> = { 合作通关: "合作派", 轻松体验: "轻松体验派", 认真争胜: "竞技派" };
const GOAL: Record<string, string> = { 交朋友: "交友优先", 放松: "放松为主", 玩游戏: "游戏优先", 跳舞: "舞池活跃", 找活动搭子: "活动搭子优先" };
const INTEREST: Record<string, string> = { 音乐: "音乐控", 运动: "运动爱好者", 旅行: "旅行爱好者", 游戏: "游戏爱好者", 影视: "影视爱好者", 美食: "美食爱好者" };
const EXPECTATION: Record<string, string> = { 会聊天: "想找会聊天的搭子", 有行动力: "想找行动派搭子", 松弛随和: "想找轻松随和的搭子", 兴趣相投: "想找同好" };
const AFTER: Record<string, string> = { 吃宵夜: "宵夜续摊派", 散步聊天: "散步聊天派", 再玩一局: "再玩一局派", 回家休息: "适时回家派" };

export function tagsFromAnswers(a: QuizAnswers): string[] {
  const tags: string[] = [];
  const add = (tag?: string) => { if (tag && !tags.includes(tag) && tags.length < 5) tags.push(tag); };
  add(a.q1 && SOCIAL[a.q1] || (a.q7 && SOCIAL[a.q7]));
  add(a.q3?.find((v) => v === "不被突然点名") ? INTERACTION["不被突然点名"] : a.q2 && GAME[a.q2]);
  add(a.q5?.[0] && GOAL[a.q5[0]] || (a.q6 === "几个人深入聊" ? "小圈聊天" : a.q6 === "热闹大场子" ? "热闹大场" : undefined));
  // 先补当晚兴趣；单个类别最多两个代表标签。
  for (const interest of (a.q8 || []).filter((v) => v !== "其他").slice(0, 2)) add(INTEREST[interest]);
  if (tags.length < 5) add(a.q4?.[0] && EXPECTATION[a.q4[0]]);
  if (tags.length < 5) add(a.q10 && AFTER[a.q10]);
  if (tags.length < 5 && a.q9 === "马上参加") add("爱尝鲜");
  if (tags.length < 5 && a.q9 === "先了解一下") add("先了解再参加");
  return tags;
}

export function hasNoSpotlightBoundary(a: QuizAnswers | null | undefined): boolean {
  return Boolean(a?.q3?.includes("不被突然点名"));
}
