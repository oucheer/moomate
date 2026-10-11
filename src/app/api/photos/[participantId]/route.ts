import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { createHash } from "node:crypto";

export async function GET(req: Request, ctx: { params: Promise<{ participantId: string }> }) {
  try {
    const { participantId: id } = await ctx.params;
    const viewerId = new URL(req.url).searchParams.get("viewerId");
    if (!viewerId) return NextResponse.json({ error: "缺少查看者" }, { status: 401 });
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "缺少入场凭证" }, { status: 401 });

    const sb = getSupabase();
    const { data: viewer } = await sb.from("participants").select("match_id,access_token_hash").eq("id", viewerId).maybeSingle();
    const { data: target } = await sb.from("participants").select("match_id,photo_path").eq("id", id).maybeSingle();
    if (!viewer || !target || !target.photo_path) return NextResponse.json({ error: "照片不存在" }, { status: 404 });
    if (viewer.access_token_hash !== createHash("sha256").update(token).digest("hex")) return NextResponse.json({ error: "入场凭证无效" }, { status: 403 });
    if (!viewer.match_id || viewer.match_id !== target.match_id) {
      return NextResponse.json({ error: "无权查看该照片" }, { status: 403 });
    }
    const { data: match } = await sb.from("matches").select("status").eq("id", viewer.match_id).maybeSingle();
    if (!match || match.status !== "confirmed") {
      return NextResponse.json({ error: "尚未双方确认，无法解锁照片" }, { status: 403 });
    }

    const { createClient } = await import("@supabase/supabase-js");
    const sbPrivate = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data, error } = await sbPrivate.storage.from("photos").createSignedUrl(target.photo_path, 600);
    if (error || !data) throw new Error("无法生成访问链接");
    return NextResponse.json({ url: data.signedUrl });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "获取失败" }, { status: 500 });
  }
}

