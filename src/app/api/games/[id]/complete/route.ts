import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { CHALLENGES, TASK_CARDS, type OfflineProgress } from "@/lib/offline-game";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { participantId, summary: rawSummary } = await req.json();
    const sb = getSupabase();
    const { data: game } = await sb.from("games").select("*").eq("id", id).maybeSingle();
    if (!game) return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    const { data: match } = await sb.from("matches").select("*").eq("id", game.match_id).maybeSingle();
    if (!match || ![match.participant_a, match.participant_b].includes(participantId)) {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }
    if (game.status === "completed" && game.card) return NextResponse.json({ game });
    if (match.status !== "confirmed") return NextResponse.json({ error: "配对尚未确认" }, { status: 409 });

    const progress = game.answers?.offline as OfflineProgress | undefined;
    if (!progress || progress.completedTasks.length < 2 || progress.completedChallenges.length < 2) {
      return NextResponse.json({ error: "请先完成两张任务卡和两关挑战" }, { status: 400 });
    }
    const summary = String(rawSummary || "").trim().slice(0, 100);
    if (!summary) return NextResponse.json({ error: "请用一句话总结今晚" }, { status: 400 });

    const { data: people } = await sb.from("participants").select("id,nickname").in("id", [match.participant_a, match.participant_b]);
    const nameA = people?.find((p) => p.id === match.participant_a)?.nickname || "牛A";
    const nameB = people?.find((p) => p.id === match.participant_b)?.nickname || "牛B";
    const card = {
      title: `${nameA} × ${nameB}`,
      reason: match.reason,
      summary,
      tasks: progress.completedTasks.map((taskId) => TASK_CARDS.find((task) => task.id === taskId)?.title).filter(Boolean),
      challenges: progress.completedChallenges.map((challengeId) => CHALLENGES.find((challenge) => challenge.id === challengeId)?.title).filter(Boolean),
      completedAt: new Date().toISOString(),
    };
    const { data, error } = await sb.from("games").update({ status: "completed", review: summary, card }).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    await sb.from("matches").update({ status: "completed" }).eq("id", match.id);
    await sb.from("participants").update({ status: "completed" }).in("id", [match.participant_a, match.participant_b]);
    return NextResponse.json({ game: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "生成纪念卡失败" }, { status: 500 });
  }
}
