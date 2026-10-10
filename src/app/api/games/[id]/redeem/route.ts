import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// POST /api/games/[id]/redeem - 主理人核销线下奖励
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const sb = getSupabase();
    const { data: game } = await sb.from("games").select("*").eq("id", id).maybeSingle();
    if (!game) return NextResponse.json({ error: "游戏不存在" }, { status: 404 });
    const { data: match } = await sb.from("matches").select("room_id").eq("id", game.match_id).maybeSingle();
    if (!match) return NextResponse.json({ error: "匹配不存在" }, { status: 404 });
    const { data: room } = await sb.from("rooms").select("host_token").eq("id", match.room_id).maybeSingle();
    if (!room || body.hostToken !== room.host_token) {
      return NextResponse.json({ error: "无主理人权限" }, { status: 403 });
    }
    const card = { ...(game.card || {}) } as Record<string, unknown>;
    if (!card.reward) return NextResponse.json({ error: "该局没有奖励" }, { status: 400 });
    const reward = { ...(card.reward as Record<string, unknown>), redeemed: true };
    card.reward = reward;
    const { data, error } = await sb.from("games").update({ card }).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ game: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "核销失败" }, { status: 500 });
  }
}
