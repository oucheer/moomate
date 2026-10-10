"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

interface Match { id: string; participant_a: string; participant_b: string; status: string; reason: string; score: number; confirmed_a: boolean; confirmed_b: boolean }
interface Participant { id: string; nickname: string; avatar: string; tags: string[]; photo_uploaded: boolean; status: string }
interface Game { id: string; match_id: string; status: string; questions: string[]; answers: Record<string, string>; review: string | null; card: Record<string, unknown> | null }

export default function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [people, setPeople] = useState<Participant[]>([]);
  const [me, setMe] = useState<Participant | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [round, setRound] = useState(0);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [partnerPhoto, setPartnerPhoto] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/matches/${matchId}`);
      if (!res.ok) return;
      const json = await res.json();
      setMatch(json.match);
      setPeople(json.participants || []);
      if (json.game) setGame(json.game);
      const savedId = localStorage.getItem("moomate_me");
      if (savedId) setMe((json.participants || []).find((p: Participant) => p.id === savedId) || null);
      if (json.match?.status === "confirmed" && !json.game) {
        const gRes = await fetch(`/api/matches/${matchId}/game`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantId: savedId }),
        });
        if (gRes.ok) { const gj = await gRes.json(); setGame(gj.game); }
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [matchId]);

  useEffect(() => { load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, [load]);

  const partner = people.find((p) => p.id !== me?.id);
  const myConfirmed = match ? (match.participant_a === me?.id ? match.confirmed_a : match.confirmed_b) : false;
  const partnerConfirmed = match ? (match.participant_a === me?.id ? match.confirmed_b : match.confirmed_a) : false;

  async function confirm() {
    setBusy(true);
    try {
      await fetch(`/api/matches/${matchId}/confirm`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: me?.id }),
      });
      await load();
    } finally { setBusy(false); }
  }

  async function reject() {
    setBusy(true);
    try {
      await fetch(`/api/matches/${matchId}/reject`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: me?.id }),
      });
      const roomId = localStorage.getItem('moomate_room');
      if (roomId) window.location.href = `/room/${roomId}`;
    } finally { setBusy(false); }
  }

  async function submitAnswer() {
    if (!game || !answer.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/games/${game.id}/answer`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: me?.id, round, answer }),
      });
      const json = await res.json();
      if (res.ok) { setGame(json.game); setAnswer(""); if (round < 2) setRound(round + 1); }
    } finally { setBusy(false); }
  }

  async function completeGame() {
    if (!game) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/games/${game.id}/complete`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: me?.id }),
      });
      const json = await res.json();
      if (res.ok) setGame(json.game);
    } finally { setBusy(false); }
  }

  useEffect(() => {
    if (match?.status === "confirmed" && me && partner) {
      fetch(`/api/photos/${partner.id}?viewerId=${me.id}`)
        .then((r) => r.ok ? r.json() : null)
        .then((j) => { if (j?.url) setPartnerPhoto(j.url); })
        .catch(() => {});
    }
  }, [match?.status, me, partner]);

  if (loading) return <main className="min-h-screen flex items-center justify-center">加载中...</main>;
  if (!match) return <main className="min-h-screen flex items-center justify-center text-red-400">匹配不存在</main>;

  // 纪念卡
  if (game?.status === "completed" && game.card) {
    const card = game.card as { title?: string; reason?: string; review?: string; completedAt?: string };
    return (
      <main className="min-h-screen px-6 py-12 max-w-md mx-auto text-center">
        <p className="text-5xl mb-4">🏆</p>
        <h1 className="text-2xl font-bold mb-1">今晚牛缘纪念卡</h1>
        <p className="text-amber-500/70 text-sm mb-6">{card.completedAt ? new Date(card.completedAt).toLocaleString("zh-CN") : ""}</p>
        <div className="bg-gradient-to-b from-amber-800/40 to-[#1d1915] border-2 border-amber-600/60 rounded-3xl p-8 text-left">
          <p className="text-lg font-bold text-amber-300 text-center mb-4">{card.title}</p>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-amber-500/70 mb-1">🧡 为什么合适</p>
              <p className="text-sm text-amber-100/80">{card.reason}</p>
            </div>
            <div>
              <p className="text-xs text-amber-500/70 mb-1">📝 默契点评</p>
              <p className="text-sm text-amber-100/80">{card.review}</p>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-amber-800/40 text-center">
            <p className="text-xs text-amber-300/60">Homebar × MooMate · 今晚牛搭子</p>
          </div>
        </div>
      </main>
    );
  }

  // 游戏中
  if (game && match.status === "confirmed") {
    const q = game.questions[round] || "";
    const myKey = `${me?.id}:${round}`;
    const partnerKey = `${partner?.id}:${round}`;
    const myAnswer = game.answers?.[myKey];
    const partnerAnswer = game.answers?.[partnerKey];
    const bothDone = Boolean(myAnswer && partnerAnswer);
    const allDone = round >= 2 && bothDone;

    return (
      <main className="min-h-screen px-6 py-10 max-w-md mx-auto">
        <div className="text-center mb-6">
          <p className="text-xs text-amber-500 font-bold">🐮 牛头不对马嘴 · 默契挑战</p>
          <h1 className="text-lg font-bold mt-1">第 {round + 1} / 3 轮</h1>
        </div>

        <div className="bg-[#1d1915] border border-amber-900/40 rounded-3xl p-6 mb-6">
          <p className="text-sm text-amber-300/80 mb-3">你们可以在酒吧里面对面讨论，但提交时各自独立作答：</p>
          <p className="font-bold text-lg mb-5 leading-relaxed">{q}</p>
          {!myAnswer ? (
            <div className="space-y-3">
              <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3}
                placeholder="写下你的答案..."
                className="w-full bg-[#1a1613] border border-amber-800/50 rounded-xl px-4 py-3 text-sm text-white placeholder:text-amber-300/40 outline-none focus:border-amber-400 resize-none" />
              <button onClick={submitAnswer} disabled={busy || !answer.trim()}
                className="w-full bg-amber-500 text-black font-bold py-3 rounded-xl disabled:opacity-50">
                {busy ? "提交中..." : "提交答案"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-600/40 rounded-xl p-4">
                <p className="text-xs text-amber-500/70 mb-1">你的答案</p>
                <p className="text-sm">{myAnswer}</p>
              </div>
              {!partnerAnswer ? (
                <p className="text-center text-sm text-amber-300/70 animate-pulse">等待对方提交...</p>
              ) : (
                <div className="bg-emerald-500/10 border border-emerald-600/40 rounded-xl p-4">
                  <p className="text-xs text-emerald-400/70 mb-1">对方的答案</p>
                  <p className="text-sm">{partnerAnswer}</p>
                </div>
              )}
              {bothDone && round < 2 && (
                <button onClick={() => setRound(round + 1)} className="w-full bg-amber-500/20 border border-amber-600 text-amber-300 py-2.5 rounded-xl text-sm font-bold">
                  下一轮 →
                </button>
              )}
            </div>
          )}
        </div>

        {allDone && !game.review && (
          <button onClick={completeGame} disabled={busy}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-xl disabled:opacity-50">
            {busy ? "AI 分析中..." : "生成默契点评 & 纪念卡"}
          </button>
        )}
      </main>
    );
  }

  // 待确认
  return (
    <main className="min-h-screen px-6 py-12 max-w-md mx-auto">
      <div className="text-center mb-8">
        <p className="text-4xl mb-3">🎉</p>
        <h1 className="text-2xl font-bold">AI 为你找到了搭子</h1>
      </div>

      <div className="bg-gradient-to-b from-amber-800/30 to-[#1d1915] border border-amber-700/50 rounded-3xl p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <span className="text-4xl">{partner?.avatar || "🐮"}</span>
          <div>
            <p className="text-lg font-bold">{partner?.nickname || "牛牛"}</p>
            {partner?.tags && partner.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {partner.tags.map((t) => (
                  <span key={t} className="text-[10px] bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <p className="text-sm text-amber-100/80 leading-relaxed mb-4">{match.reason}</p>
        <p className="text-xs text-amber-300/60">匹配分 {match.score} · 匹配机制基于问答 + 兴趣标签</p>
      </div>

      {/* 照片解锁状态 */}
      <div className="bg-[#1d1915] border border-amber-900/40 rounded-2xl p-4 mb-6 text-center">
        <p className="text-sm text-amber-300/80">
          📸 {partnerConfirmed ? "对方已确认，照片解锁！" : "双方确认后解锁彼此照片"}
        </p>
        {partnerPhoto && (
          <img src={partnerPhoto} alt="对方照片" className="mx-auto mt-3 rounded-xl max-w-48" />
        )}
      </div>

      {!myConfirmed ? (
        <div className="space-y-3">
          <button onClick={confirm} disabled={busy}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3.5 rounded-xl disabled:opacity-50">
            {busy ? "..." : "愿意认识这头牛牛"}
          </button>
          <button onClick={reject} disabled={busy}
            className="w-full bg-transparent border border-amber-900/50 text-amber-300/70 py-3 rounded-xl text-sm">
            不了，换一个
          </button>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm text-amber-300/80 animate-pulse">
            {partnerConfirmed ? "双方确认！正在进入游戏..." : "等待对方确认..."}
          </p>
        </div>
      )}
    </main>
  );
}





