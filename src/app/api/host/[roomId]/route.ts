import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { isExpired, siteOrigin } from "@/lib/match";
import QRCode from "qrcode";

export async function GET(_req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await ctx.params;
    const sb = getSupabase();
    const { data: room } = await sb.from("rooms").select("*").eq("id", roomId).maybeSingle();
    if (!room || isExpired(room.expires_at)) return NextResponse.json({ error: "房间不存在" }, { status: 404 });
    const { data: participants } = await sb.from("participants").select("*").eq("room_id", room.id).order("created_at");
    const { data: matches } = await sb.from("matches").select("*").eq("room_id", room.id).order("created_at");
    const joinUrl = `${siteOrigin()}/join/${room.code}`;
    const qrDataUrl = await QRCode.toDataURL(joinUrl, { width: 320, margin: 1 });
    return NextResponse.json({ room, participants, matches, joinUrl, qrDataUrl });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "查询失败" }, { status: 500 });
  }
}
