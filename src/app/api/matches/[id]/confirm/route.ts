import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const sb = getSupabase();
    const { data: match } = await sb.from("matches").select("*").eq("id", id).maybeSingle();
    if (!match) return NextResponse.json({ error: "匹配不存在" }, { status: 404 });
    const isA = body.participantId === match.participant_a;
    const isB = body.participantId === match.participant_b;
    if (!isA && !isB) return NextResponse.json({ error: "你不是该匹配的参与者" }, { status: 403 });

    const updates: Record<string, unknown> = isA ? { confirmed_a: true } : { confirmed_b: true };
    const nowConfirmedA = isA || match.confirmed_a;
    const nowConfirmedB = isB || match.confirmed_b;
    if (nowConfirmedA && nowConfirmedB) {
      updates.status = "confirmed";
      await sb.from("participants").update({ status: "confirmed" }).in("id", [match.participant_a, match.participant_b]);
    }
    const { data, error } = await sb.from("matches").update(updates).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ match: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "确认失败" }, { status: 500 });
  }
}
