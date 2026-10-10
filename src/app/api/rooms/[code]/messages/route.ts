import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// GET /api/rooms/[code]/messages - 房间聊天记录（含发送者昵称头像）
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const sb = getSupabase();
    const { data: room } = await sb.from("rooms").select("id").eq("code", code).maybeSingle();
    if (!room) return NextResponse.json({ error: "房间不存在" }, { status: 404 });
    const { data: messages, error } = await sb
      .from("room_messages")
      .select("id, participant_id, content, created_at, participant:participants(nickname, avatar)")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return NextResponse.json({ messages: messages || [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "查询失败" }, { status: 500 });
  }
}

// POST /api/rooms/[code]/messages - 发送聊天
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const body = await req.json();
    const content = String(body.content || "").trim().slice(0, 200);
    if (!content) return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
    const sb = getSupabase();
    const { data: room } = await sb.from("rooms").select("id, status").eq("code", code).maybeSingle();
    if (!room || room.status === "ended") return NextResponse.json({ error: "房间不存在" }, { status: 404 });
    const { data: me } = await sb
      .from("participants")
      .select("id")
      .eq("id", body.participantId)
      .eq("room_id", room.id)
      .maybeSingle();
    if (!me) return NextResponse.json({ error: "你不是房间成员" }, { status: 403 });
    const { data: msg, error } = await sb
      .from("room_messages")
      .insert({ room_id: room.id, participant_id: me.id, content })
      .select("id, participant_id, content, created_at, participant:participants(nickname, avatar)")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ message: msg });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "发送失败" }, { status: 500 });
  }
}
