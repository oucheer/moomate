"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const AVATARS = ["🐮", "🐄", "🐂", "🐃"];

export default function JoinPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState("🐮");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedId = localStorage.getItem(`participant_${roomCode}`);
    if (savedId && localStorage.getItem(`moomate_auth_${savedId}`)) {
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
        body: JSON.stringify({ nickname, avatar }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "加入失败");
      localStorage.setItem(`participant_${roomCode}`, json.participant.id);
      localStorage.setItem(`moomate_auth_${json.participant.id}`, json.token);
      localStorage.setItem('moomate_me', json.participant.id);
      router.replace(`/room/${json.participant.room_id}`);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "加入失败"); }
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
          <p className="text-sm text-amber-300 mb-2">今晚想怎样匹配？</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-amber-500 text-black font-bold text-center rounded-xl py-3 text-sm">双人玩伴 ✓</div>
            <button type="button" disabled className="bg-[#12100e] border border-amber-900/40 text-amber-300/50 rounded-xl py-3 text-sm cursor-not-allowed">多人组队 · 即将开放</button>
          </div>
        </div>
        <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl p-3">
          <p className="text-xs text-amber-300 leading-relaxed">
            入场后可上传自己、物品或现场环境的照片，也可以不上传。完成轻量问答即可参与双人匹配。
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



