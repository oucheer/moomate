import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { isExpired } from "@/lib/match";

// 一键演示：向当前房间注入 5 个虚拟牛牛（已含答案/标签/照片标记），
// 主理人随后可直接触发 AI 匹配，无需真人扫码。
const DEMO_BULLS = [
  {
    nickname: "星星牛", avatar: "🐄",
    answers: { goal: "一起玩", style: "气氛组", fun: "搞笑", free: "想找个能一起闹、一起笑的搭子，把今晚气氛拉满" },
    tags: ["气氛担当", "果饮品鉴家", "冷笑话十级"],
  },
  {
    nickname: "云朵牛", avatar: "🐮",
    answers: { goal: "深度聊天", style: "倾听者", fun: "走心", free: "找一个能安静聊几句真心话的人，聊聊最近的热爱" },
    tags: ["倾听者", "深夜电台", "走心派"],
  },
  {
    nickname: "闪电牛", avatar: "🐂",
    answers: { goal: "一起玩", style: "冒险家", fun: "竞争", free: "来一场说走就走的桌面对决，输的人表演牛叫" },
    tags: ["冒险家", "桌游狂魔", "好胜心强"],
  },
  {
    nickname: "月月牛", avatar: "🐃",
    answers: { goal: "认识朋友", style: "观察者", fun: "合作", free: "先安静观察全场，再锁定最有趣的角落加入" },
    tags: ["观察者", "细节控", "合作型选手"],
  },
  {
    nickname: "糖糖牛", avatar: "🐄",
    answers: { goal: "寻找心动搭子", style: "气氛组", fun: "走心", free: "热闹是我的保护色，其实想遇见一个让我想认真聊天的人" },
    tags: ["反差萌", "心动预备", "果茶续命"],
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
      return NextResponse.json({ added: 0, virtualIds: existing.map((p: any) => p.id) });
    }

    const rows = DEMO_BULLS.map((b) => ({
      room_id: room.id,
      nickname: b.nickname,
      avatar: b.avatar,
      gender: "secret",
      gender_preference: "any",
      tags: b.tags,
      photo_uploaded: true, // 演示牛牛默认已上传照片，可直接进入匹配
      answers: b.answers,
      ai_profile: { demo: true },
      is_virtual: true,
      status: "waiting",
    }));
    const { data, error } = await sb.from("participants").insert(rows).select("id, nickname");
    if (error) throw new Error(error.message);
    return NextResponse.json({ added: data.length, virtualIds: data.map((p: any) => p.id) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "注入失败" }, { status: 500 });
  }
}
