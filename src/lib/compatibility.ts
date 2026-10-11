import type { QuizAnswers } from "@/types";
import { hasNoSpotlightBoundary } from "@/lib/quiz";

type Map = Record<string, Record<string, number>>;
const symmetric = (map: Map, a?: string, b?: string): number => {
  if (!a || !b) return 50;
  return map[a]?.[b] ?? map[b]?.[a] ?? (a === b ? 100 : 50);
};

// 所有相容度集中在这里，便于现场根据反馈调整。
export const COMPATIBILITY = {
  game: {
    合作通关: { 合作通关: 100, 轻松体验: 80, 认真争胜: 45 },
    轻松体验: { 轻松体验: 100, 认真争胜: 25 },
    认真争胜: { 认真争胜: 100 },
  } as Map,
  novelty: {
    马上参加: { 马上参加: 100, 先了解一下: 70, 更喜欢熟悉的活动: 30 },
    先了解一下: { 先了解一下: 100, 更喜欢熟悉的活动: 75 },
    更喜欢熟悉的活动: { 更喜欢熟悉的活动: 100 },
  } as Map,
  social: {
    主动开聊: { 主动开聊: 90, 等别人搭话: 95, 看气氛: 65 },
    等别人搭话: { 等别人搭话: 65, 看气氛: 60 },
    看气氛: { 看气氛: 65 },
  } as Map,
  role: {
    组织者: { 组织者: 80, 气氛组: 85, 自在参与: 90, 先观察: 90 },
    气氛组: { 气氛组: 85, 自在参与: 90, 先观察: 85 },
    自在参与: { 自在参与: 85, 先观察: 80 },
    先观察: { 先观察: 70 },
  } as Map,
  afterparty: {
    吃宵夜: { 吃宵夜: 100, 散步聊天: 55, 再玩一局: 45, 回家休息: 20, 看情况: 50 },
    散步聊天: { 散步聊天: 100, 再玩一局: 55, 回家休息: 45, 看情况: 50 },
    再玩一局: { 再玩一局: 100, 回家休息: 20, 看情况: 50 },
    回家休息: { 回家休息: 100, 看情况: 50 },
    看情况: { 看情况: 50 },
  } as Map,
};

function jaccard(a?: string[], b?: string[]): number {
  if (!a?.length || !b?.length) return 50;
  const left = new Set(a), right = new Set(b);
  const shared = [...left].filter((v) => right.has(v)).length;
  return 100 * shared / new Set([...left, ...right]).size;
}

function interestSet(a?: QuizAnswers): string[] {
  if (!a?.q8?.length) return [];
  return a.q8.map((v) => v === "其他" ? (a.q8Other ? `其他:${a.q8Other.toLowerCase()}` : "其他") : v);
}

function activity(a: QuizAnswers, b: QuizAnswers): number {
  const values = [symmetric(COMPATIBILITY.game, a.q2, b.q2), symmetric(COMPATIBILITY.novelty, a.q9, b.q9)];
  return (values[0] + values[1]) / 2;
}

function interaction(a: QuizAnswers, b: QuizAnswers): number {
  if (!a.q1 || !b.q1 || !a.q3?.length || !b.q3?.length || !a.q7 || !b.q7) return 50;
  let score = (symmetric(COMPATIBILITY.role, a.q1, b.q1) + symmetric(COMPATIBILITY.social, a.q7, b.q7)) / 2;
  const active = (v: QuizAnswers) => v.q7 === "主动开聊" || v.q1 === "组织者" || v.q1 === "气氛组";
  if (a.q3.includes("喜欢别人主动破冰") && active(b)) score += 10;
  if (b.q3.includes("喜欢别人主动破冰") && active(a)) score += 10;
  if (a.q3.includes("慢慢熟悉") && b.q3.includes("可以互开玩笑") || b.q3.includes("慢慢熟悉") && a.q3.includes("可以互开玩笑")) score -= 15;
  if (a.q3.includes("一起做点事") && b.q3.includes("一起做点事")) score += 10;
  return Math.max(0, Math.min(100, score));
}

function scalePreference(answer?: string, size = 2): number {
  if (!answer || answer === "都可以") return 50;
  const smallFit = size <= 5 ? 100 : size >= 8 ? 0 : (8 - size) * 100 / 3;
  return answer === "几个人深入聊" ? smallFit : 100 - smallFit;
}

function scale(a: QuizAnswers, b: QuizAnswers, size: number): number {
  if (!a.q6 || !b.q6) return 50;
  return (scalePreference(a.q6, size) + scalePreference(b.q6, size)) / 2;
}

function expectationFit(wants: QuizAnswers, other: QuizAnswers): number {
  if (!wants.q4?.length) return 50;
  const signals: Record<string, number> = {
    会聊天: other.q7 === "主动开聊" || other.q5?.includes("交朋友") ? 100 : other.q7 ? 50 : 50,
    有行动力: other.q1 === "组织者" || other.q1 === "气氛组" || other.q7 === "主动开聊" ? 100 : other.q1 || other.q7 ? 50 : 50,
    "松弛随和": other.q2 === "轻松体验" || other.q5?.includes("放松") ? 100 : other.q2 || other.q5 ? 50 : 50,
    兴趣相投: !wants.q8?.length || !other.q8?.length ? 50 : jaccard(interestSet(wants), interestSet(other)),
  };
  return wants.q4.reduce((sum, item) => sum + (signals[item] ?? 50), 0) / wants.q4.length;
}

function expectations(a: QuizAnswers, b: QuizAnswers): number {
  if (!a.q4?.length || !b.q4?.length) return 50;
  return (expectationFit(a, b) + expectationFit(b, a)) / 2;
}

export function scorePair(a: QuizAnswers, b: QuizAnswers, size = 2): number {
  const parts = [
    [jaccard(a.q5, b.q5), 25],
    [jaccard(interestSet(a), interestSet(b)), 20],
    [activity(a, b), 15],
    [interaction(a, b), 15],
    [scale(a, b, size), 10],
    [expectations(a, b), 10],
    [symmetric(COMPATIBILITY.afterparty, a.q10, b.q10), 5],
  ];
  return Math.round(parts.reduce((sum, [value, weight]) => sum + value * weight / 100, 0));
}

export function hasSharedActivityAnchor(a: QuizAnswers, b: QuizAnswers): boolean {
  return Boolean(a.q5?.some((goal) => b.q5?.includes(goal)) || a.q8?.some((interest) => interest !== "其他" && b.q8?.includes(interest)) || (a.q2 && a.q2 === b.q2));
}

export function matchExplanation(a: QuizAnswers, b: QuizAnswers): { anchor: string; reasons: string[]; icebreaker: string } {
  const sharedGoals = (a.q5 || []).filter((v) => b.q5?.includes(v));
  const sharedInterests = (a.q8 || []).filter((v) => b.q8?.includes(v) && v !== "其他");
  const anchor = sharedGoals.includes("玩游戏") ? "一起玩游戏" : sharedGoals.includes("跳舞") ? "一起听音乐或跳舞" : sharedGoals.includes("交朋友") ? "轻松认识新朋友" : sharedGoals.includes("放松") ? "放松聊天" : sharedGoals.includes("找活动搭子") ? "一起探索现场活动" : sharedInterests[0] ? `聊聊${sharedInterests[0]}` : "一起做个轻松的破冰任务";
  const reasons: string[] = [];
  if (sharedGoals.length) reasons.push(`你们今晚都想${sharedGoals.slice(0, 2).join("、")}`);
  if (sharedInterests.length) reasons.push(`你们都对${sharedInterests.slice(0, 2).join("、")}感兴趣`);
  if (a.q2 && a.q2 === b.q2) reasons.push(`你们都偏好${a.q2}的游戏方式`);
  if (a.q10 && a.q10 === b.q10 && a.q10 !== "看情况") reasons.push(`你们都选择了派对后${a.q10}`);
  if (!reasons.length && ((a.q7 === "主动开聊" && b.q7 === "等别人搭话") || (b.q7 === "主动开聊" && a.q7 === "等别人搭话"))) reasons.push("一位愿意主动开聊，另一位更自在于有人先破冰");
  if (!reasons.length && a.q6 && a.q6 === b.q6 && a.q6 !== "都可以") reasons.push(`你们都更喜欢${a.q6}`);
  if (!reasons.length) reasons.push(`你们分别偏好${a.q2}和${b.q2}，可以先尝试轻量互动`);
  const quiet = hasNoSpotlightBoundary(a) || hasNoSpotlightBoundary(b);
  const icebreaker = quiet ? "先两人一起挑一张合作任务卡，彼此自愿分享，不安排点名展示。" : "先各说一个今晚想做的小事，再一起挑一张线下任务卡。";
  return { anchor, reasons: reasons.slice(0, 3), icebreaker };
}
