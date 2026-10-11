import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(_req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await ctx.params;
    const sb = getSupabase();
    const { data: room } = await sb.from("rooms").select("id,code,theme,status,capacity,created_at,expires_at").eq("id", roomId).maybeSingle();
    if (!room) return NextResponse.json({ error: "房间不存在" }, { status: 404 });
    const { data: participants } = await sb.from("participants").select("id,room_id,nickname,avatar,tags,photo_uploaded,status,match_id,answers").eq("room_id", roomId).order("created_at");
    const { data: matches } = await sb.from("matches").select("id,participant_a,participant_b,status,reason,anchor,icebreaker").eq("room_id", roomId).order("created_at");
    return NextResponse.json({ room, participants, matches });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "查询失败" }, { status: 500 });
  }
}
