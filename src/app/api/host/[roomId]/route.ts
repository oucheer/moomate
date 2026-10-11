import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { isExpired, siteOrigin } from "@/lib/match";
import QRCode from "qrcode";

export async function GET(req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await ctx.params;
    const sb = getSupabase();
    const { data: room } = await sb.from("rooms").select("*").eq("id", roomId).maybeSingle();
    if (!room || isExpired(room.expires_at)) return NextResponse.json({ error: "房间不存在" }, { status: 404 });
    if (req.headers.get("x-host-token") !== room.host_token) return NextResponse.json({ error: "无主理人权限" }, { status: 403 });
    const { data: participants } = await sb.from("participants").select("*").eq("room_id", room.id).order("created_at");
    const { data: matches } = await sb.from("matches").select("*").eq("room_id", room.id).order("created_at");
    const matchIds = (matches || []).map((m: { id: string }) => m.id);
    let games: Array<{ id: string; match_id: string; status: string; card: Record<string, unknown> | null }> = [];
    if (matchIds.length > 0) {
      const { data: g } = await sb.from("games").select("id, match_id, status, card").in("match_id", matchIds);
      games = g || [];
    }
    const joinUrl = `${siteOrigin()}/join/${room.code}`;
    const qrDataUrl = await QRCode.toDataURL(joinUrl, { width: 320, margin: 1 });
    return NextResponse.json({ room: { id: room.id, code: room.code, theme: room.theme, status: room.status, capacity: room.capacity }, participants, matches, games, joinUrl, qrDataUrl });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "查询失败" }, { status: 500 });
  }
}
