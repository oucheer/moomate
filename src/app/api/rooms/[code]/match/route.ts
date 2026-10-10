import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { aiMatchReason } from "@/lib/ai";
import { genderCompatible, scorePair } from "@/lib/match";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const sb = getSupabase();
    const { data: room } = await sb.from("rooms").select("*").eq("code", code).maybeSingle();
    if (!room || room.status === "ended") return NextResponse.json({ error: "房间不存在" }, { status: 404 });
    if (body.hostToken !== room.host_token) return NextResponse.json({ error: "无主理人权限" }, { status: 403 });

    const { data: people } = await sb.from("participants").select("*").eq("room_id", room.id);
    const pool = (people || []).filter((p: any) => !p.match_id && p.photo_uploaded && p.answers);
    if (pool.length < 2) return NextResponse.json({ error: "可匹配人数不足" }, { status: 400 });

    const used = new Set<string>();
    const pairs: Array<{ a: any; b: any; score: number }> = [];

    for (let i = 0; i < pool.length; i++) {
      if (used.has(pool[i].id)) continue;
      let best: { a: any; b: any; score: number } | null = null;
      for (let j = i + 1; j < pool.length; j++) {
        if (used.has(pool[j].id)) continue;
        const a = pool[i], b = pool[j];
        if (!genderCompatible(a.gender, b.gender, a.gender_preference, b.gender_preference)) continue;
        const score = scorePair(a.answers, b.answers, a.tags || [], b.tags || []);
        if (!best || score > best.score) best = { a, b, score };
      }
      if (best) {
        used.add(best.a.id);
        used.add(best.b.id);
        pairs.push(best);
      }
    }

    if (pairs.length === 0) return NextResponse.json({ error: "没有满足偏好的可配对组合" }, { status: 400 });

    const results = [];
    for (const pair of pairs) {
      const reason = await aiMatchReason(pair.a, pair.b);
      const { data: match } = await sb
        .from("matches")
        .insert({
          room_id: room.id,
          participant_a: pair.a.id,
          participant_b: pair.b.id,
          score: pair.score,
          reason,
        })
        .select()
        .single();
      await sb.from("participants").update({ status: "matched", match_id: match.id }).in("id", [pair.a.id, pair.b.id]);
      results.push(match);
    }
    return NextResponse.json({ matches: results, unmatched: pool.length - used.size });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "匹配失败" }, { status: 500 });
  }
}
