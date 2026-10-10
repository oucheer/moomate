"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Gender, GenderPreference } from "@/types";

const AVATARS = ["🐮", "🐄", "🐂", "🐃"];

export default function JoinPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState("🐮");
  const [gender, setGender] = useState<Gender>("secret");
  const [pref, setPref] = useState<GenderPreference>("any");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedId = localStorage.getItem(`participant_${roomCode}`);
    if (savedId) {
      fetch(`/api/participants/${savedId}`).then(async (r) => {
        if (r.ok) {
          const j = await r.json();
          router.replace(`/room/${j.participant.room_id}`);
        }
      });
    }
  }, [roomCode, router]);

  async function join() {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/rooms/${roomCode}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, avatar, gender, gender_preference: pref }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "加入失败");
      localStorage.setItem(`participant_${roomCode}`, json.participant.id);
      localStorage.setItem('moomate_me', json.participant.id);
      router.replace(`/room/${json.participant.room_id}`);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen px-6 py-14 max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="text-5xl mb-2">🐮</div>
        <h1 className="text-2xl font-bold">认领你的牛牛</h1>
        <p className="text-sm text-amber-300/80 mt-1">房间 {roomCode}</p>
      </div>

      <div className="bg-[#1d1915] border border-amber-900/40 rounded-3xl p-6 space-y-5">
        <div>
          <label className="text-sm text-amber-300 mb-1 block">牛牛昵称</label>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="例如：快乐小牛"
            className="w-full bg-[#1a1613] border border-amber-800/50 rounded-xl px-4 py-3 text-white placeholder:text-amber-300/40 outline-none focus:border-amber-400" />
        </div>
        <div>
          <label className="text-sm text-amber-300 mb-1 block">选一个牛牛形象</label>
          <div className="flex gap-3">
            {AVATARS.map((a) => (
              <button key={a} onClick={() => setAvatar(a)}
                className={`text-3xl w-14 h-14 rounded-xl flex items-center justify-center transition ${avatar === a ? "bg-amber-500/20 border-2 border-amber-500" : "bg-[#12100e] border border-amber-900/40"}`}>
                {a}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm text-amber-300 mb-1 block">你的性别</label>
          <div className="flex gap-2">
            {([["male", "男"], ["female", "女"], ["secret", "不愿透露"]] as const).map(([v, label]) => (
              <button key={v} onClick={() => setGender(v)}
                className={`flex-1 py-2.5 rounded-xl text-sm transition ${gender === v ? "bg-amber-500 text-black font-bold" : "bg-[#12100e] border border-amber-900/40 text-amber-100"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm text-amber-300 mb-1 block">希望匹配的性别</label>
          <div className="flex gap-2">
            {([["female", "女生"], ["male", "男生"], ["any", "不限"]] as const).map(([v, label]) => (
              <button key={v} onClick={() => setPref(v)}
                className={`flex-1 py-2.5 rounded-xl text-sm transition ${pref === v ? "bg-amber-500 text-black font-bold" : "bg-[#12100e] border border-amber-900/40 text-amber-100"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl p-3">
          <p className="text-xs text-amber-300 leading-relaxed">
            📸 参与匹配需要上传一张自己的照片。照片仅用于本次房间，双方互相确认后才能解锁查看。房间其他人无法看到你的照片。
          </p>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button onClick={join} disabled={loading || !nickname.trim()}
          className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3.5 rounded-xl transition disabled:opacity-50">
          {loading ? "进入中..." : "进入牛牛广场"}
        </button>
      </div>
    </main>
  );
}



