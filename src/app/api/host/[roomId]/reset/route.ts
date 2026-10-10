import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { isExpired } from "@/lib/match";

// 主理人重置房间：清除所有配对 / 游戏 / 奖励记录，
// 所有参与者回到"等待匹配"状态（可立即触发下一轮匹配）。
export async function POST(req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const sb = getSupabase();
    const { data: room } = await sb.from("rooms").select("*").eq("id", roomId).maybeSingle();
    if (!room || room.status === "ended" || isExpired(room.expires_at)) {
      return NextResponse.json({ error: "房间不存在或已结束" }, { status: 404 });
    }
    if (body.hostToken !== room.host_token) {
      return NextResponse.json({ error: "无主理人权限" }, { status: 403 });
    }

    // 删除顺序：games -> matches（外键依赖，participants.match_id 只是普通列）
    const { data: matchIds } = await sb.from("matches").select("id").eq("room_id", room.id);
    const ids = (matchIds || []).map((m: any) => m.id);
    if (ids.length > 0) {
      await sb.from("games").delete().in("match_id", ids);
      await sb.from("matches").delete().in("id", ids);
    }

    // 所有真人 + 虚拟牛牛全部回到等待匹配
    await sb.from("participants").update({ status: "waiting", match_id: null }).eq("room_id", room.id);

    return NextResponse.json({ ok: true, cleared: ids.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "重置失败" }, { status: 500 });
  }
}
