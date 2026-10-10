import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { aiGameReview } from "@/lib/ai";

// Homebar 线下奖励池（不含酒精压力，均可用无酒精饮品替换）
const REWARD_POOL = [
  { name: "牛牛特调", desc: "吧台为你们定制一杯今晚专属无酒精特调（可自选口味）", emoji: "🍹" },
  { name: "小食拼盘", desc: "免费兑换一份吧台小食拼盘，两个人一起吃", emoji: "🍿" },
  { name: "优先入场券", desc: "下一场 Homebar 活动免排队优先入场（两人有效）", emoji: "🎫" },
  { name: "牛牛周边", desc: "主理人送出牛牛贴纸 / 徽章周边一对", emoji: "🐮" },
  { name: "拍立得留念", desc: "主理人为你们拍一张拍立得合照，现场带走", emoji: "📸" },
];

function makeRewardCode(roomCode: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let rand = "";
  for (let i = 0; i < 4; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return `MOO-${roomCode}-${rand}`;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const sb = getSupabase();
    const { data: game } = await sb.from("games").select("*").eq("id", id).maybeSingle();
    if (!game) return NextResponse.json({ error: "游戏不存在" }, { status: 404 });
    const { data: match } = await sb.from("matches").select("*").eq("id", game.match_id).maybeSingle();
    if (!match || ![match.participant_a, match.participant_b].includes(body.participantId)) {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }
    const expected = 6;
    if (Object.keys(game.answers || {}).length < expected) {
      return NextResponse.json({ error: "双方尚未完成全部 3 轮作答" }, { status: 400 });
    }
    if (game.review) return NextResponse.json({ game });

    const { data: room } = await sb.from("rooms").select("code").eq("id", match.room_id).maybeSingle();
    const { data: pa } = await sb.from("participants").select("*").eq("id", match.participant_a).maybeSingle();
    const { data: pb } = await sb.from("participants").select("*").eq("id", match.participant_b).maybeSingle();
    const review = await aiGameReview(pa, pb, game.answers);
    const reward = REWARD_POOL[Math.floor(Math.random() * REWARD_POOL.length)];
    const card = {
      title: `${pa?.nickname || "牛A"} × ${pb?.nickname || "牛B"}`,
      reason: match.reason,
      review,
      completedAt: new Date().toISOString(),
      reward: {
        name: reward.name,
        desc: reward.desc,
        emoji: reward.emoji,
        code: makeRewardCode(room?.code || "HOME"),
        redeemed: false,
      },
    };
    const { data, error } = await sb.from("games").update({ status: "completed", review, card }).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    await sb.from("matches").update({ status: "completed" }).eq("id", match.id);
    await sb.from("participants").update({ status: "completed" }).in("id", [match.participant_a, match.participant_b]);
    return NextResponse.json({ game: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "生成失败" }, { status: 500 });
  }
}
