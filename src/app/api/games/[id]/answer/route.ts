import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { aiJudge, type StageDef } from "@/lib/ai";
import { uploadPhoto } from "@/lib/photo";

// 提交一关。multipart/form-data:
//   participantId, stage (1-4)
//   text  (仅 stage=1：各自答案；stage=2/3/4 可选感想)
//   guess (仅 stage=1：对对方答案的预测，可空)
//   photo (stage=2/3/4：合作挑战照片，必填)
// 双方都提交该关后 → AI 裁判 → round_feedback[stage] = {comment, sync, ...}
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const form = await req.formData();
    const participantId = String(form.get("participantId") || "");
    const stage = String(form.get("stage") || "");
    const text = String(form.get("text") || "").slice(0, 300);
    const guess = String(form.get("guess") || "").slice(0, 300);
    const photo = form.get("photo") as File | null;
    const sb = getSupabase();

    const { data: game } = await sb.from("games").select("*").eq("id", id).maybeSingle();
    if (!game) return NextResponse.json({ error: "游戏不存在" }, { status: 404 });
    const { data: match } = await sb.from("matches").select("*").eq("id", game.match_id).maybeSingle();
    if (!match || ![match.participant_a, match.participant_b].includes(participantId)) {
      return NextResponse.json({ error: "无权提交" }, { status: 403 });
    }

    const plan: StageDef[] = game.questions || [];
    const stageDef = plan.find((q) => String(q.stage) === stage);
    if (!stageDef) return NextResponse.json({ error: "关卡不存在" }, { status: 400 });

    const isA = participantId === match.participant_a;
    const otherId = isA ? match.participant_b : match.participant_a;

    // 动作关必须上传照片
    if (stageDef.type !== "quiz" && !photo) {
      return NextResponse.json({ error: "这一关需要上传挑战照片" }, { status: 400 });
    }
    if (photo && photo.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "照片不能超过 8MB" }, { status: 413 });
    }

    // 上传挑战照片（stage 关卡共享一张合照路径，后交的覆盖先交的）
    let photoPath: string | undefined;
    if (photo) {
      photoPath = await uploadPhoto(
        match.room_id, `${game.id}-s${stage}`,
        await photo.arrayBuffer(), photo.type || "image/jpeg"
      );
    }

    const answers: Record<string, { a?: string; b?: string; guessA?: string | null; guessB?: string | null; aNote?: string; bNote?: string; photo?: string }> = { ...(game.answers || {}) };
    const key = String(stage);
    answers[key] = answers[key] || { a: null, b: null, guessA: null, guessB: null, photo: null };
    if (isA) {
      if (stageDef.type === "quiz") { answers[key].a = text || "(没写)"; answers[key].guessA = guess || null; }
      if (text) answers[key].aNote = text;
    } else {
      if (stageDef.type === "quiz") { answers[key].b = text || "(没写)"; answers[key].guessB = guess || null; }
      if (text) answers[key].bNote = text;
    }
    if (photoPath) answers[key].photo = photoPath;

    // 虚拟牛牛自动补齐
    const { data: other } = await sb.from("participants").select("is_virtual").eq("id", otherId).maybeSingle();
    if (other?.is_virtual) {
      const { VIRTUAL_SUBMISSIONS } = await import("@/lib/virtual");
      const v = VIRTUAL_SUBMISSIONS[stageDef.type] || {};
      if (stageDef.type === "quiz") {
        if (!answers[key].b) answers[key].b = v.answer || "我就猜你会这么问，答案我已经准备好了：跟今晚的灯光一样神秘。";
        if (stage === "1" && !answers[key].guessA) answers[key].guessA = v.guess || "我猜你会说跟灯光有关，你全程都在偷看那串星星灯。";
      }
      // 动作关虚拟牛牛自动视为已完成（照片由真人一侧提供即可）
    }

    const fb: Record<string, { comment?: string; sync?: number; aName?: string; bName?: string; judgedAt?: string }> = { ...(game.round_feedback || {}) };
    const cur = answers[key];
    const bothDone = stageDef.type === "quiz" ? Boolean(cur.a && cur.b) : Boolean((cur.aNote || cur.bNote) && cur.photo);

    if (bothDone && !fb[key]) {
      const { data: pa } = await sb.from("participants").select("nickname").eq("id", match.participant_a).maybeSingle();
      const { data: pb } = await sb.from("participants").select("nickname").eq("id", match.participant_b).maybeSingle();
      const verdict = await aiJudge({
        stageType: stageDef.type,
        challenge: stageDef.text,
        aAns: cur.a, bAns: cur.b, guessA: cur.guessA || undefined, guessB: cur.guessB || undefined,
        photoPath: cur.photo, nameA: pa?.nickname, nameB: pb?.nickname,
      });
      fb[key] = { ...verdict, aName: pa?.nickname || "牛A", bName: pb?.nickname || "牛B", judgedAt: new Date().toISOString() };
    }

    const { data, error } = await sb.from("games").update({ answers, round_feedback: fb }).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ game: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "提交失败" }, { status: 500 });
  }
}
