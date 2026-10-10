import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { aiTagsFromQuiz } from "@/lib/ai";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const sb = getSupabase();
    const { data: existing } = await sb.from("participants").select("*").eq("id", id).maybeSingle();
    if (!existing) return NextResponse.json({ error: "参与者不存在" }, { status: 404 });

    const updates: Record<string, unknown> = {};
    if (body.nickname) updates.nickname = String(body.nickname).slice(0, 20);
    if (body.avatar) updates.avatar = String(body.avatar);
    if (body.gender) updates.gender = body.gender;
    if (body.gender_preference) updates.gender_preference = body.gender_preference;
    if (body.answers) {
      updates.answers = body.answers;
      updates.tags = await aiTagsFromQuiz(body.answers);
      updates.ai_profile = { extracted: true };
    }

    const { data, error } = await sb.from("participants").update(updates).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ participant: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "保存失败" }, { status: 500 });
  }
}
