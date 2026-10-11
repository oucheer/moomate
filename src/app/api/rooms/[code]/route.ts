import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { isExpired } from "@/lib/match";

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const sb = getSupabase();
    const { data: room } = await sb.from("rooms").select("id,code,theme,status,capacity,created_at,expires_at").eq("code", code).maybeSingle();
    if (!room || isExpired(room.expires_at) || room.status === "ended") {
      return NextResponse.json({ error: "房间不存在或已结束" }, { status: 404 });
    }
    const { data: participants } = await sb.from("participants").select("id,nickname,avatar,tags,status,photo_uploaded").eq("room_id", room.id).order("created_at");
    return NextResponse.json({ room, participants });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "查询失败" }, { status: 500 });
  }
}
