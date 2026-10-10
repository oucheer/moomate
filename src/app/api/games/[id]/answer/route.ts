import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const sb = getSupabase();
    const { data: game } = await sb.from("games").select("*").eq("id", id).maybeSingle();
    if (!game) return NextResponse.json({ error: "游戏不存在" }, { status: 404 });
    const { data: match } = await sb.from("matches").select("*").eq("id", game.match_id).maybeSingle();
    if (!match || ![match.participant_a, match.participant_b].includes(body.participantId)) {
      return NextResponse.json({ error: "无权提交" }, { status: 403 });
    }
    const round = String(body.round ?? 0);
    const answers = { ...(game.answers || {}), [`${body.participantId}:${round}`]: String(body.answer).slice(0, 300) };
    const { data, error } = await sb.from("games").update({ answers }).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ game: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "提交失败" }, { status: 500 });
  }
}
