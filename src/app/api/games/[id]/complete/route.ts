import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { aiStory, aiGameReview } from "@/lib/ai";
import { REWARD_POOL, makeRewardCode } from "@/lib/rewards";
import { createSignedUrl } from "@/lib/photo";

// 完成 4 关后：生成 AI 故事 + 总评 + 线下奖励 + 挑战照片纪念集
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
    if (game.status === "completed" && game.card) return NextResponse.json({ game });

    const answers = game.answers || {};
    const fb = game.round_feedback || {};
    const plan: Array<{ stage: number; type: string; title: string; text: string }> = game.questions || [];

    // 校验 4 关全部完成
    for (const s of plan) {
      const a = answers[String(s.stage)];
      const done = s.type === "quiz" ? Boolean(a?.a && a?.b) : Boolean(a?.photo);
      if (!done) return NextResponse.json({ error: `第 ${s.stage} 关还未完成` }, { status: 400 });
    }

    const { data: room } = await sb.from("rooms").select("code").eq("id", match.room_id).maybeSingle();
    const { data: pa } = await sb.from("participants").select("*").eq("id", match.participant_a).maybeSingle();
    const { data: pb } = await sb.from("participants").select("*").eq("id", match.participant_b).maybeSingle();
    const nameA = pa?.nickname || "牛A";
    const nameB = pb?.nickname || "牛B";

    // 挑战照片签名 URL 纪念集
    const photoCards: Array<{ stage: number; title: string; url: string }> = [];
    for (const s of plan) {
      const a = answers[String(s.stage)];
      if (a?.photo) {
        try {
          const url = await createSignedUrl(a.photo);
          photoCards.push({ stage: s.stage, title: s.title, url });
        } catch { /* skip missing photo */ }
      }
    }

    // AI 故事 + 总评
    const summary = plan.map((s) => {
      const f = fb[String(s.stage)];
      return `[${s.title}] ${s.text} → ${f ? `${f.aName}&${f.bName}：${f.comment}（默契${f.sync}）` : "已完成"}`;
    }).join("；");
    const story = await aiStory({ nameA, nameB, challengeSummary: summary });
    const review = await aiGameReview(pa, pb, { ...answers, feedback: fb });

    // 总默契分
    const scores = Object.values(fb as Record<string, { sync?: number }>).map((f) => f.sync || 0);
    const totalSync = scores.length ? Math.round(scores.reduce((x: number, y: number) => x + y, 0) / scores.length) : 60;

    const reward = REWARD_POOL[Math.floor(Math.random() * REWARD_POOL.length)];
    const card = {
      title: `${nameA} × ${nameB}`,
      reason: match.reason,
      review,
      story,
      stats: { totalSync, rounds: plan.length },
      photos: photoCards,
      completedAt: new Date().toISOString(),
      reward: {
        name: reward.name, desc: reward.desc, emoji: reward.emoji,
        code: makeRewardCode(room?.code || "HOME"), redeemed: false,
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
