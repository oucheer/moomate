import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { createSignedUrl } from "@/lib/photo";

// 参与双方查看某关挑战照片（签名 URL 重定向）
export async function GET(_req: Request, ctx: { params: Promise<{ gameId: string; stage: string }> }) {
  try {
    const { gameId, stage } = await ctx.params;
    const sb = getSupabase();
    const { data: game } = await sb.from("games").select("match_id, answers").eq("id", gameId).maybeSingle();
    if (!game) return NextResponse.json({ error: "游戏不存在" }, { status: 404 });
    const { data: match } = await sb.from("matches").select("participant_a, participant_b, status").eq("id", game.match_id).maybeSingle();
    if (!match || match.status !== "confirmed") return NextResponse.json({ error: "无权查看" }, { status: 403 });

    const answers = (game.answers || {}) as Record<string, { photo?: string }>;
    const photoPath = answers[stage]?.photo;
    if (!photoPath) return NextResponse.json({ error: "照片不存在" }, { status: 404 });

    const url = await createSignedUrl(photoPath);
    return NextResponse.redirect(url, { status: 302 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "获取失败" }, { status: 500 });
  }
}
