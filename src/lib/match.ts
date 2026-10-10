import type { Gender, GenderPreference } from "@/types";

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function siteOrigin(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (process.env.URL) return process.env.URL.replace(/\/$/, "");
  if (process.env.DEPLOY_PRIME_URL) return process.env.DEPLOY_PRIME_URL.replace(/\/$/, "");
  return "http://localhost:3000";
}

const GOAL_SCORES: Record<string, Record<string, number>> = {
  认识朋友: { 认识朋友: 4, 一起玩: 3, 深度聊天: 2, 寻找心动搭子: 1 },
  深度聊天: { 深度聊天: 4, 认识朋友: 2, 寻找心动搭子: 3, 一起玩: 1 },
  一起玩: { 一起玩: 4, 认识朋友: 3, 寻找心动搭子: 2, 深度聊天: 1 },
  寻找心动搭子: { 寻找心动搭子: 4, 深度聊天: 3, 一起玩: 2, 认识朋友: 1 },
};

const STYLE_COMPLEMENT: Record<string, string[]> = {
  气氛组: ["观察者", "倾听者"],
  观察者: ["气氛组", "冒险家"],
  冒险家: ["倾听者", "气氛组"],
  倾听者: ["冒险家", "气氛组"],
};

export function scorePair(
  aAnswers: Record<string, string>,
  bAnswers: Record<string, string>,
  aTags: string[],
  bTags: string[]
): number {
  let score = 0;
  score += GOAL_SCORES[aAnswers.goal]?.[bAnswers.goal] ?? 2;
  if (aAnswers.style === bAnswers.style) score += 2;
  else if (STYLE_COMPLEMENT[aAnswers.style]?.includes(bAnswers.style)) score += 3;
  score += STYLE_COMPLEMENT[bAnswers.style]?.includes(aAnswers.style) ? 1 : 0;
  if (aAnswers.fun === bAnswers.fun) score += 2;
  else score += 1;
  const shared = aTags.filter(t => bTags.includes(t)).length;
  score += Math.min(shared, 3);
  return score;
}

export function genderCompatible(a: Gender, b: Gender, prefA: GenderPreference, prefB: GenderPreference): boolean {
  if (a === "secret" || b === "secret") return true;
  const check = (gender: Gender, pref: GenderPreference) => pref === "any" || pref === gender;
  return check(b, prefA) && check(a, prefB);
}

export function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}
