import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { generateToken, isExpired } from "@/lib/match";
import { createHash } from "node:crypto";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const body = await req.json();
    const sb = getSupabase();
    const { data: room, error: roomErr } = await sb.from("rooms").select("*").eq("code", code).maybeSingle();
    if (roomErr || !room) return NextResponse.json({ error: "房间不存在" }, { status: 404 });
    if (isExpired(room.expires_at) || room.status === "ended") {
      return NextResponse.json({ error: "房间已结束" }, { status: 410 });
    }

    if (body.participantId && typeof body.accessToken === "string") {
      const { data: existing } = await sb
        .from("participants")
        .select("*")
        .eq("id", body.participantId)
        .eq("room_id", room.id)
        .maybeSingle();
      const hash = createHash("sha256").update(body.accessToken).digest("hex");
      if (existing?.access_token_hash === hash) return NextResponse.json({ room: { id: room.id, code: room.code, theme: room.theme }, participant: { id: existing.id, room_id: existing.room_id }, token: body.accessToken });
    }

    const { count } = await sb.from("participants").select("id", { count: "exact", head: true }).eq("room_id", room.id);
    if ((count ?? 0) >= room.capacity) return NextResponse.json({ error: "房间已满" }, { status: 409 });

    const nickname = String(body.nickname || "").trim().slice(0, 20);
    if (!nickname) return NextResponse.json({ error: "请填写昵称" }, { status: 400 });

    const accessToken = generateToken();
    const { data: participant, error } = await sb
      .from("participants")
      .insert({
        room_id: room.id,
        nickname,
        avatar: String(body.avatar || "cow"),
        gender: body.gender || "secret",
        gender_preference: body.gender_preference || "any",
        tags: [],
        access_token_hash: createHash("sha256").update(accessToken).digest("hex"),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ room: { id: room.id, code: room.code, theme: room.theme }, participant: { id: participant.id, room_id: participant.room_id }, token: accessToken });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "加入失败" }, { status: 500 });
  }
}
