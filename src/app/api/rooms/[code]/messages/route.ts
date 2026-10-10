import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

const VIRTUAL_REPLIES = [
  "嘿，你也觉得今晚气氛不错吧？",
  "刚在广场吃草顺便观察全场，你这头牛看着挺有故事😄",
  "我猜你是气氛组那挂的，没猜错吧？",
  "来，报上你的理想今晚，我看看咱俩是不是一个频道～",
  "哈哈这个回答有点东西，继续说",
];

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

    // 房间里有虚拟牛牛时自动回复一句，让广场有生气
    const { data: virtualBull } = await sb
      .from("participants")
      .select("id")
      .eq("room_id", room.id)
      .eq("is_virtual", true)
      .neq("id", me.id)
      .maybeSingle();
    if (virtualBull) {
      const reply = VIRTUAL_REPLIES[Math.floor(Math.random() * VIRTUAL_REPLIES.length)];
      await sb.from("room_messages").insert({ room_id: room.id, participant_id: virtualBull.id, content: reply });
    }
    return NextResponse.json({ message: msg });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "发送失败" }, { status: 500 });
  }
}
