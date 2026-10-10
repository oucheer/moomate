import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

const VIRTUAL_ANSWERS = [
  "我会拉着一整墙果饮挨个试味，评出今晚的『牛牛特调』，最后再编一段它的广告词。",
  "微醺果茶色——比橙子多一点夜色，比晚风多一点甜。",
  "能接得住我冷笑话的人，比热闹本身更让我上头。",
];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const sb = getSupabase();
    const { data: game } = await sb.from("games").select("*").eq("id", id).maybeSingle();
    if (!game) return NextResponse.json({ error: "游戏不存在" }, { status: 404 });
    const { data: match } = await sb.from("matches").select("*").eq("id", game.match_id).maybeSingle();
    if (!match || ![match.participant_a, match.participant_b].includes(body.participantId)) {
      return NextResponse.json({ error: "无权提交" }, { status: 403 });
    }
    const round = String(body.round ?? 0);
    const answers = { ...(game.answers || {}), [`${body.participantId}:${round}`]: String(body.answer).slice(0, 300) };

    // 对方是虚拟牛牛时，同一轮自动补上答案
    const otherId = body.participantId === match.participant_a ? match.participant_b : match.participant_a;
    const { data: other } = await sb.from("participants").select("is_virtual").eq("id", otherId).maybeSingle();
    if (other?.is_virtual) {
      const r = Math.min(Number(round) || 0, VIRTUAL_ANSWERS.length - 1);
      answers[`${otherId}:${round}`] = VIRTUAL_ANSWERS[r];
    }

    const { data, error } = await sb.from("games").update({ answers }).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ game: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "提交失败" }, { status: 500 });
  }
}
