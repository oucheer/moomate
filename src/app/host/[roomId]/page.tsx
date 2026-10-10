"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

interface Participant { id: string; nickname: string; avatar: string; tags: string[]; photo_uploaded: boolean; status: string; match_id: string | null }
interface Room { id: string; code: string; theme: string; status: string; capacity: number }
interface Match { id: string; participant_a: string; participant_b: string; status: string; reason: string; score: number }
interface Game { id: string; match_id: string; status: string; card: { reward?: { name?: string; emoji?: string; code?: string; redeemed?: boolean } | null } | null }

export default function HostPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [qr, setQr] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/host/${roomId}`);
      if (!res.ok) throw new Error("加载失败");
      const json = await res.json();
      setRoom(json.room);
      setParticipants(json.participants || []);
      setMatches(json.matches || []);
      setGames(json.games || []);
      setQr(json.qrDataUrl || "");
      setJoinUrl(json.joinUrl || "");
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [roomId]);

  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [load]);

  async function startMatch() {
    setMatching(true); setError("");
    try {
      const res = await fetch(`/api/rooms/${room?.code}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostToken: localStorage.getItem(`host_${roomId}`) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "匹配失败");
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setMatching(false); }
  }

  async function redeem(gameId: string) {
    setError("");
    try {
      const res = await fetch(`/api/games/${gameId}/redeem`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostToken: localStorage.getItem(`host_${roomId}`) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "核销失败");
      await load();
    } catch (e: any) { setError(e.message); }
  }

  const nameOf = (id: string) => participants.find((p) => p.id === id)?.nickname || "牛牛";

  if (loading) return <main className="min-h-screen flex items-center justify-center">加载中...</main>;
  if (!room) return <main className="min-h-screen flex items-center justify-center text-red-400">房间不存在</main>;

  return (
    <main className="min-h-screen px-6 py-10 max-w-lg mx-auto">
      <div className="text-center mb-8">
        <p className="text-xs text-amber-300/80 mb-1">主理人控制台</p>
        <h1 className="text-2xl font-bold">{room.theme}</h1>
        <p className="text-amber-500/80 font-mono mt-2">房间码 {room.code}</p>
      </div>

      {qr && (
        <div className="bg-[#1d1915] border border-amber-900/40 rounded-3xl p-6 text-center mb-6">
          <p className="text-sm text-amber-300 mb-3">微信扫码加入</p>
          {qr && <img src={qr} alt="qr" className="mx-auto rounded-xl bg-white p-2 w-48 h-48" />}
          {joinUrl && <p className="text-[10px] text-amber-300/60 mt-2 break-all">{joinUrl}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6 text-center">
        <div className="bg-[#1d1915] border border-amber-900/40 rounded-2xl p-4">
          <p className="text-3xl font-bold text-amber-400">{participants.length}</p>
          <p className="text-xs text-amber-300/80 mt-1">参与牛牛</p>
        </div>
        <div className="bg-[#1d1915] border border-amber-900/40 rounded-2xl p-4">
          <p className="text-3xl font-bold text-amber-400">{matches.length}</p>
          <p className="text-xs text-amber-300/80 mt-1">已生成匹配</p>
        </div>
      </div>

      <button
        onClick={startMatch}
        disabled={matching}
        className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3.5 rounded-xl mb-6 transition disabled:opacity-50"
      >
        {matching ? "AI 匹配中..." : "开始 AI 匹配"}
      </button>
      {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}

      <section className="mb-6">
        <h2 className="text-sm font-bold text-amber-300 mb-3">牛牛广场</h2>
        <div className="space-y-2">
          {participants.map((p) => (
            <div key={p.id} className="bg-[#1d1915] border border-amber-900/40 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-2xl">🐮</span>
              <div className="flex-1">
                <p className="font-medium">{p.nickname}</p>
                <p className="text-xs text-amber-300/70">
                  {p.photo_uploaded ? "已上传照片" : "未上传"} · {p.status === "waiting" ? "等待匹配" : p.status === "matched" ? "已找到搭子" : p.status === "confirmed" ? "已确认" : p.status === "playing" ? "游戏中" : p.status === "completed" ? "已完成" : "匹配中"}
                </p>
              </div>
            </div>
          ))}
          {participants.length === 0 && <p className="text-amber-300/60 text-sm">还没有牛牛加入</p>}
        </div>
      </section>

      {matches.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-amber-300 mb-3">当前配对</h2>
          <div className="space-y-2">
            {matches.map((m) => (
              <div key={m.id} className="bg-[#1d1915] border border-amber-900/40 rounded-xl px-4 py-3">
                <p className="font-medium text-amber-300">
                  {nameOf(m.participant_a)} × {nameOf(m.participant_b)}
                </p>
                <p className="text-xs text-amber-300/70 mt-1">{m.reason}</p>
                <p className="text-[10px] text-amber-300/50 mt-1">
                  状态：{m.status === "pending" ? "待确认" : m.status === "confirmed" ? "已确认" : m.status === "completed" ? "已完成" : "已拒绝"} · 匹配分 {m.score}
                </p>
                {(() => {
                  const g = games.find((x) => x.match_id === m.id);
                  const rw = g?.card?.reward;
                  if (!rw) return null;
                  return (
                    <div className="mt-2 bg-emerald-900/25 border border-emerald-700/40 rounded-lg px-3 py-2">
                      <p className="text-xs text-emerald-300">{rw.emoji} {rw.name} · <span className="font-mono">{rw.code}</span></p>
                      {m.status === "completed" && (
                        rw.redeemed ? (
                          <p className="text-xs text-emerald-400 font-bold mt-1">✅ 已核销</p>
                        ) : (
                          <button onClick={() => redeem(g.id)} className="mt-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg">核销奖励</button>
                        )
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

