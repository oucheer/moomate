import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { isExpired } from "@/lib/match";
import { hasSharedActivityAnchor, matchExplanation, scorePair } from "@/lib/compatibility";
import { validateAnswers } from "@/lib/quiz";
import type { Participant, QuizAnswers } from "@/types";

type Candidate = Pick<Participant, "id" | "nickname" | "answers" | "status" | "match_id">;

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const sb = getSupabase();
    const { data: room, error: roomError } = await sb.from("rooms").select("*").eq("code", code).maybeSingle();
    if (roomError || !room || room.status === "ended" || isExpired(room.expires_at)) return NextResponse.json({ error: "房间不存在或已结束" }, { status: 404 });
    if (body.hostToken !== room.host_token) return NextResponse.json({ error: "无主理人权限" }, { status: 403 });

    const { data: people, error: peopleError } = await sb.from("participants").select("id,nickname,answers,status,match_id").eq("room_id", room.id);
    if (peopleError) throw new Error(peopleError.message);
    const pool = (people || []).filter((p: Candidate) => p.status === "waiting" && !p.match_id && !validateAnswers(p.answers).error) as Candidate[];
    if (pool.length < 2) return NextResponse.json({ matches: [], waiting: pool.length, message: "等待更多完成问卷的参与者加入双人匹配" });

    const candidates: Array<{ a: Candidate; b: Candidate; score: number }> = [];
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const score = scorePair(pool[i].answers as QuizAnswers, pool[j].answers as QuizAnswers);
        if (score >= 60 && hasSharedActivityAnchor(pool[i].answers as QuizAnswers, pool[j].answers as QuizAnswers)) candidates.push({ a: pool[i], b: pool[j], score });
      }
    }
    candidates.sort((x, y) => y.score - x.score || [x.a.id, x.b.id].sort().join(":").localeCompare([y.a.id, y.b.id].sort().join(":")));
    const used = new Set<string>();
    const results: Array<{ id: string; participant_a: string; participant_b: string }> = [];
    for (const pair of candidates) {
      if (used.has(pair.a.id) || used.has(pair.b.id)) continue;
      const explanation = matchExplanation(pair.a.answers as QuizAnswers, pair.b.answers as QuizAnswers);
      const { data: matchId, error } = await sb.rpc("persist_party_pair", {
        p_room_id: room.id,
        p_a: pair.a.id,
        p_b: pair.b.id,
        p_score: pair.score,
        p_reason: explanation.reasons.join("；"),
        p_anchor: explanation.anchor,
        p_icebreaker: explanation.icebreaker,
      });
      if (error) {
        // Concurrent host actions can make a candidate stale. Continue with remaining pairs.
        if (error.message.includes("参与者已退出或已匹配")) continue;
        throw new Error(error.message);
      }
      used.add(pair.a.id);
      used.add(pair.b.id);
      results.push({ id: matchId as string, participant_a: pair.a.id, participant_b: pair.b.id });
    }
    const waiting = pool.length - used.size;
    return NextResponse.json({ matches: results, waiting, message: results.length ? (waiting ? `${waiting} 人继续等待合适搭子，可调整问卷偏好后再次匹配` : "双人匹配已完成") : "暂未找到相容度达到 60 的搭子，可继续等待或调整偏好" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "匹配失败" }, { status: 500 });
  }
}
