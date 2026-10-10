// Homebar 线下奖励池（不含酒精压力，均可用无酒精饮品替换）
export const REWARD_POOL = [
  { name: "牛牛特调", desc: "吧台为你们定制一杯今晚专属无酒精特调（可自选口味）", emoji: "🍹" },
  { name: "小食拼盘", desc: "免费兑换一份吧台小食拼盘，两个人一起吃", emoji: "🍿" },
  { name: "优先入场券", desc: "下一场 Homebar 活动免排队优先入场（两人有效）", emoji: "🎫" },
  { name: "牛牛周边", desc: "主理人送出牛牛贴纸 / 徽章周边一对", emoji: "🐮" },
  { name: "拍立得留念", desc: "主理人为你们拍一张拍立得合照，现场带走", emoji: "📸" },
];

export function makeRewardCode(roomCode: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let rand = "";
  for (let i = 0; i < 4; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return `MOO-${roomCode}-${rand}`;
}
