import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { uploadPhoto } from "@/lib/photo";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const form = await req.formData();
    const file = form.get("photo") as File | null;
    if (!file) return NextResponse.json({ error: "缺少照片" }, { status: 400 });
    if (file.size > 6 * 1024 * 1024) return NextResponse.json({ error: "照片不能超过 6MB" }, { status: 413 });

    const sb = getSupabase();
    const { data: participant } = await sb.from("participants").select("room_id").eq("id", id).maybeSingle();
    if (!participant) return NextResponse.json({ error: "参与者不存在" }, { status: 404 });

    const path = await uploadPhoto(participant.room_id, id, await file.arrayBuffer(), file.type || "image/jpeg");
    const { data, error } = await sb
      .from("participants")
      .update({ photo_path: path, photo_uploaded: true })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ participant: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "上传失败" }, { status: 500 });
  }
}
