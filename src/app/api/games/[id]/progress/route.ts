import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { CHALLENGES, TASK_CARDS, newOfflineProgress, type OfflineProgress } from "@/lib/offline-game";

function nextTask(current: number, done: string[]) {
  for (let offset = 1; offset <= TASK_CARDS.length; offset++) {
    const index = (current + offset) % TASK_CARDS.length;
    if (!done.includes(TASK_CARDS[index].id)) return index;
  }
  return current;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { participantId, action } = await req.json();
    const sb = getSupabase();
    const { data: game } = await sb.from("games").select("*").eq("id", id).maybeSingle();
    if (!game || game.status !== "active") return NextResponse.json({ error: "任务不存在或已结束" }, { status: 404 });
    const { data: match } = await sb.from("matches").select("participant_a,participant_b,status").eq("id", game.match_id).maybeSingle();
    if (!match || match.status !== "confirmed" || ![match.participant_a, match.participant_b].includes(participantId)) {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }

    const progress: OfflineProgress = { ...(game.answers?.offline || newOfflineProgress()) };
    progress.completedTasks = [...progress.completedTasks];
    progress.completedChallenges = [...progress.completedChallenges];
    if (action === "swap" && progress.completedTasks.length < 2) {
      if (progress.swaps >= 20) return NextResponse.json({ error: "已用完 20 次换卡机会" }, { status: 409 });
      progress.taskIndex = nextTask(progress.taskIndex, progress.completedTasks);
      progress.swaps += 1;
    } else if (action === "complete-task" && progress.completedTasks.length < 2) {
      const task = TASK_CARDS[progress.taskIndex];
      if (!task || progress.completedTasks.includes(task.id)) return NextResponse.json({ error: "任务状态已变化，请刷新" }, { status: 409 });
      progress.completedTasks.push(task.id);
      progress.taskIndex = nextTask(progress.taskIndex, progress.completedTasks);
    } else if (action === "complete-challenge" && progress.completedTasks.length >= 2 && progress.completedChallenges.length < 2) {
      const challengeId = progress.challenges[progress.completedChallenges.length];
      if (!CHALLENGES.some((item) => item.id === challengeId)) return NextResponse.json({ error: "挑战不存在" }, { status: 400 });
      progress.completedChallenges.push(challengeId);
    } else {
      return NextResponse.json({ error: "当前不能执行这一步" }, { status: 409 });
    }

    const { data, error } = await sb.from("games")
      .update({ answers: { ...(game.answers || {}), offline: progress } })
      .eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ game: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "任务操作失败" }, { status: 500 });
  }
}
