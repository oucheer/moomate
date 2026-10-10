import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const sb = getSupabase();
    const { data } = await sb.from("participants").select("*").eq("id", id).maybeSingle();
    if (!data) return NextResponse.json({ error: "不存在" }, { status: 404 });
    return NextResponse.json({ participant: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "失败" }, { status: 500 });
  }
}
