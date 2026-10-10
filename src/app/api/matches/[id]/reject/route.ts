import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const sb = getSupabase();
    const { data: match } = await sb.from("matches").select("*").eq("id", id).maybeSingle();
    if (!match) return NextResponse.json({ error: "匹配不存在" }, { status: 404 });
    if (![match.participant_a, match.participant_b].includes(body.participantId)) {
      return NextResponse.json({ error: "你不是该匹配的参与者" }, { status: 403 });
    }
    await sb.from("matches").update({ status: "rejected" }).eq("id", id);
    await sb.from("participants").update({ status: "waiting", match_id: null }).in("id", [match.participant_a, match.participant_b]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "操作失败" }, { status: 500 });
  }
}
