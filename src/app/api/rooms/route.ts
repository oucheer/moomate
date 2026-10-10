import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { generateRoomCode, generateToken, siteOrigin } from "@/lib/match";
import QRCode from "qrcode";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const theme = String(body.theme || "今晚牛搭子").slice(0, 60);
    const capacity = Math.min(Math.max(Number(body.capacity) || 20, 2), 60);
    const hours = Math.min(Math.max(Number(body.hours) || 6, 1), 24);
    const sb = getSupabase();

    let code = generateRoomCode();
    for (let i = 0; i < 5; i++) {
      const { data } = await sb.from("rooms").select("id").eq("code", code).maybeSingle();
      if (!data) break;
      code = generateRoomCode();
    }

    const hostToken = generateToken();
    const expiresAt = new Date(Date.now() + hours * 3600_000).toISOString();
    const { data, error } = await sb
      .from("rooms")
      .insert({ code, theme, capacity, host_token: hostToken, expires_at: expiresAt })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const joinUrl = `${siteOrigin()}/join/${code}`;
    const qrDataUrl = await QRCode.toDataURL(joinUrl, { width: 320, margin: 1 });
    return NextResponse.json({ room: data, joinUrl, qrDataUrl, hostToken });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "创建失败" }, { status: 500 });
  }
}
