import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { aiStagePlan, type StageDef } from "@/lib/ai";
import { hasNoSpotlightBoundary } from "@/lib/quiz";

// 创建 4 关线下挑战赛（快答 → 造型拍照 → 酒吧寻宝 → 即兴合演）
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const sb = getSupabase();
    const { data: match } = await sb.from("matches").select("*").eq("id", id).maybeSingle();
    if (!match || match.status !== "confirmed") return NextResponse.json({ error: "匹配尚未确认" }, { status: 400 });
    if (![match.participant_a, match.participant_b].includes(body.participantId)) {
      return NextResponse.json({ error: "无权开始" }, { status: 403 });
    }

    const { data: existing } = await sb.from("games").select("*").eq("match_id", id).maybeSingle();
    if (existing) return NextResponse.json({ game: existing });

    const { data: pa } = await sb.from("participants").select("*").eq("id", match.participant_a).maybeSingle();
    const { data: pb } = await sb.from("participants").select("*").eq("id", match.participant_b).maybeSingle();
    const plan: StageDef[] = await aiStagePlan(pa, pb);
    // “不被突然点名”是硬边界：任务卡不能强制个人展示或公开表演。
    if (hasNoSpotlightBoundary(pa?.answers) || hasNoSpotlightBoundary(pb?.answers)) {
      const pose = plan.find((stage) => stage.stage === 2);
      if (pose) Object.assign(pose, { title: "第二关 · 合作找物", text: "两人一起挑两件现场小物品，摆成一个有趣画面并拍照；画面里不必出现人。", tips: ["私下合作即可，不需要给全场展示"] });
      const act = plan.find((stage) => stage.stage === 4);
      if (act) Object.assign(act, { title: "终关 · 共创一句话", text: "两人一起给今晚起一个有趣的小标题，写在纸上或手机备忘录，再拍下这句话。", tips: ["双方自愿分享，无需公开表演或被点名"] });
    }
    const { data: game, error } = await sb
      .from("games")
      .insert({ match_id: id, type: "牛牛大挑战", questions: plan, answers: {}, round_feedback: {} })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await sb.from("participants").update({ status: "playing" }).in("id", [match.participant_a, match.participant_b]);
    return NextResponse.json({ game });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "创建游戏失败" }, { status: 500 });
  }
}
