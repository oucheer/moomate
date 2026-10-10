import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { aiGameReview } from "@/lib/ai";

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

    const { data: pa } = await sb.from("participants").select("*").eq("id", match.participant_a).maybeSingle();
    const { data: pb } = await sb.from("participants").select("*").eq("id", match.participant_b).maybeSingle();
    const review = await aiGameReview(pa, pb, game.answers);
    const card = {
      title: `${pa?.nickname || "牛A"} × ${pb?.nickname || "牛B"}`,
      reason: match.reason,
      review,
      completedAt: new Date().toISOString(),
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
