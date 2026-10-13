import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { newOfflineProgress } from "@/lib/offline-game";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { participantId } = await req.json();
    const sb = getSupabase();
    const { data: match } = await sb.from("matches").select("*").eq("id", id).maybeSingle();
    if (!match || match.status !== "confirmed") return NextResponse.json({ error: "匹配尚未确认" }, { status: 400 });
    if (![match.participant_a, match.participant_b].includes(participantId)) return NextResponse.json({ error: "无权开始" }, { status: 403 });

    const { data: existing } = await sb.from("games").select("*").eq("match_id", id).maybeSingle();
    if (existing) {
      if (existing.answers?.offline) return NextResponse.json({ game: existing });
      const { data: upgraded, error } = await sb.from("games")
        .update({ type: "线下双人任务", answers: { ...existing.answers, offline: newOfflineProgress() } })
        .eq("id", existing.id).select().single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ game: upgraded });
    }

    const { data: game, error } = await sb.from("games")
      .insert({ match_id: id, type: "线下双人任务", questions: [], answers: { offline: newOfflineProgress() }, round_feedback: {} })
      .select().single();
    if (error) throw new Error(error.message);
    await sb.from("participants").update({ status: "playing" }).in("id", [match.participant_a, match.participant_b]);
    return NextResponse.json({ game });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "创建游戏失败" }, { status: 500 });
  }
}
