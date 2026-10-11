import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { isExpired } from "@/lib/match";
import { tagsFromAnswers } from "@/lib/quiz";

// 一键演示：注入已完成新版问卷的虚拟牛牛，无需真人扫码。
const DEMO_BULLS = [
  {
    nickname: "星星牛", avatar: "🐄",
    answers: { q1: "气氛组", q2: "合作通关", q3: ["一起做点事", "可以互开玩笑"], q4: ["兴趣相投"], q5: ["交朋友", "玩游戏"], q6: "都可以", q7: "主动开聊", q8: ["音乐", "游戏"], q9: "马上参加", q10: "再玩一局" },
  },
  {
    nickname: "云朵牛", avatar: "🐮",
    answers: { q1: "先观察", q2: "轻松体验", q3: ["喜欢别人主动破冰", "不被突然点名"], q4: ["会聊天"], q5: ["交朋友", "放松"], q6: "几个人深入聊", q7: "等别人搭话", q8: ["音乐", "影视"], q9: "先了解一下", q10: "散步聊天" },
  },
  {
    nickname: "闪电牛", avatar: "🐂",
    answers: { q1: "组织者", q2: "认真争胜", q3: ["一起做点事"], q4: ["有行动力"], q5: ["玩游戏", "找活动搭子"], q6: "热闹大场子", q7: "主动开聊", q8: ["游戏", "运动"], q9: "马上参加", q10: "再玩一局" },
  },
  {
    nickname: "月月牛", avatar: "🐃",
    answers: { q1: "自在参与", q2: "合作通关", q3: ["一起做点事", "慢慢熟悉"], q4: ["松弛随和"], q5: ["交朋友", "玩游戏"], q6: "几个人深入聊", q7: "看气氛", q8: ["游戏", "美食"], q9: "先了解一下", q10: "吃宵夜" },
  },
  {
    nickname: "糖糖牛", avatar: "🐄",
    answers: { q1: "气氛组", q2: "轻松体验", q3: ["可以互开玩笑", "喜欢别人主动破冰"], q4: ["会聊天"], q5: ["放松", "跳舞"], q6: "都可以", q7: "主动开聊", q8: ["音乐", "美食"], q9: "马上参加", q10: "吃宵夜" },
  },
];

export async function POST(req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const sb = getSupabase();
    const { data: room } = await sb.from("rooms").select("*").eq("id", roomId).maybeSingle();
    if (!room || room.status === "ended" || isExpired(room.expires_at)) {
      return NextResponse.json({ error: "房间不存在或已结束" }, { status: 404 });
    }
    if (body.hostToken !== room.host_token) {
      return NextResponse.json({ error: "无主理人权限" }, { status: 403 });
    }

    // 已有演示牛牛则不再注入（幂等），返回现有列表
    const { data: existing } = await sb
      .from("participants").select("id, nickname")
      .eq("room_id", room.id).eq("is_virtual", true);
    if (existing && existing.length > 0) {
      return NextResponse.json({ added: 0, virtualIds: existing.map((p: { id: string }) => p.id) });
    }

    const rows = DEMO_BULLS.map((b) => ({
      room_id: room.id,
      nickname: b.nickname,
      avatar: b.avatar,
      gender: "secret",
      gender_preference: "any",
      tags: tagsFromAnswers(b.answers),
      photo_uploaded: false,
      answers: b.answers,
      ai_profile: { demo: true },
      is_virtual: true,
      status: "waiting",
    }));
    const { data, error } = await sb.from("participants").insert(rows).select("id, nickname");
    if (error) throw new Error(error.message);
    return NextResponse.json({ added: data.length, virtualIds: data.map((p: { id: string }) => p.id) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "注入失败" }, { status: 500 });
  }
}
