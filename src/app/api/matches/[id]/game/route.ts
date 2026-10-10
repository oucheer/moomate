import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { aiGameQuestions } from "@/lib/ai";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const sb = getSupabase();
    const { data: match } = await sb.from("matches").select("*").eq("id", id).maybeSingle();
    if (!match || match.status !== "confirmed") return NextResponse.json({ error: "匹配尚未确认" }, { status: 400 });
    if (![match.participant_a, match.participant_b].includes(body.participantId)) {
      return NextResponse.json({ error: "无权开始" }, { status: 403 });
    }

    const { data: pa } = await sb.from("participants").select("*").eq("id", match.participant_a).maybeSingle();
    const { data: pb } = await sb.from("participants").select("*").eq("id", match.participant_b).maybeSingle();
    const { data: existing } = await sb.from("games").select("*").eq("match_id", id).maybeSingle();
    if (existing) return NextResponse.json({ game: existing });

    const questions = await aiGameQuestions(pa, pb);
    const { data: game, error } = await sb
      .from("games")
      .insert({ match_id: id, questions, answers: {} })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await sb.from("participants").update({ status: "playing" }).in("id", [match.participant_a, match.participant_b]);
    return NextResponse.json({ game });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "创建游戏失败" }, { status: 500 });
  }
}
