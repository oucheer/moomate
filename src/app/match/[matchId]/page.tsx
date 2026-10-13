"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CHALLENGES, TASK_CARDS, type OfflineProgress } from "@/lib/offline-game";

interface Match {
  id: string; participant_a: string; participant_b: string; status: string;
  reason: string; anchor: string; icebreaker: string; confirmed_a: boolean; confirmed_b: boolean;
}
interface Participant { id: string; nickname: string; avatar: string; tags: string[]; photo_uploaded: boolean }
interface CardData { title: string; reason: string; summary?: string; tasks?: string[]; challenges?: string[]; completedAt?: string; story?: string; review?: string }
interface Game { id: string; status: string; type: string; answers: { offline?: OfflineProgress }; card: CardData | null }

export default function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [people, setPeople] = useState<Participant[]>([]);
  const [me, setMe] = useState<Participant | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [partnerPhoto, setPartnerPhoto] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/matches/${matchId}`);
      if (!response.ok) return;
      const data = await response.json();
      setMatch(data.match);
      setPeople(data.participants || []);
      const savedId = localStorage.getItem("moomate_me");
      setMe((data.participants || []).find((person: Participant) => person.id === savedId) || null);
      if (data.game) setGame(data.game);
      if (data.match?.status === "confirmed" && savedId && (!data.game || !data.game.answers?.offline)) {
        const started = await fetch(`/api/matches/${matchId}/game`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantId: savedId }),
        });
        if (started.ok) setGame((await started.json()).game);
      }
    } catch { /* The next poll can recover from a temporary network error. */ }
    finally { setLoading(false); }
  }, [matchId]);

  useEffect(() => { load(); const timer = setInterval(load, 3500); return () => clearInterval(timer); }, [load]);

  const partner = people.find((person) => person.id !== me?.id);
  const myConfirmed = match ? (match.participant_a === me?.id ? match.confirmed_a : match.confirmed_b) : false;
  const partnerConfirmed = match ? (match.participant_a === me?.id ? match.confirmed_b : match.confirmed_a) : false;
  const progress = game?.answers?.offline;
  const task = progress ? TASK_CARDS[progress.taskIndex] : null;
  const challenge = progress ? CHALLENGES.find((item) => item.id === progress.challenges[progress.completedChallenges.length]) : null;

  useEffect(() => {
    if (match?.status !== "confirmed" || !me?.id || !partner?.id) return;
    const token = localStorage.getItem(`moomate_auth_${me.id}`) || "";
    fetch(`/api/photos/${partner.id}?viewerId=${me.id}`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data?.url) setPartnerPhoto(data.url); })
      .catch(() => {});
  }, [match?.status, me?.id, partner?.id]);

  async function postAction(path: string, body: Record<string, unknown>) {
    if (!me || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(path, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: me.id, ...body }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "操作失败");
      if (data.game) setGame(data.game);
      await load();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败");
      return false;
    } finally { setBusy(false); }
  }

  function backToRoom() {
    const roomId = localStorage.getItem("moomate_room");
    if (roomId) window.location.href = `/room/${roomId}`;
  }

  async function reject() {
    if (await postAction(`/api/matches/${matchId}/reject`, {})) backToRoom();
  }

  if (loading) return <main className="min-h-screen flex items-center justify-center">加载中...</main>;
  if (!match || !me) return <main className="min-h-screen flex items-center justify-center text-red-400">请从房间入口重新进入配对</main>;

  if (game?.status === "completed" && game.card) {
    const card = game.card;
    return <main className="min-h-screen max-w-md mx-auto px-5 py-10 text-center">
      <p className="text-5xl mb-3">🐮</p>
      <h1 className="text-2xl font-bold mb-2">今晚的牛缘纪念卡</h1>
      <p className="text-sm text-amber-300/70 mb-6">{card.completedAt ? new Date(card.completedAt).toLocaleString("zh-CN") : ""}</p>
      <div className="rounded-3xl border border-amber-600/60 bg-gradient-to-b from-amber-800/40 to-[#1d1915] p-6 text-left space-y-5">
        <p className="text-xl font-bold text-amber-200 text-center">{card.title}</p>
        <div><p className="text-xs text-amber-400 mb-1">今晚的一句话</p><p className="text-lg text-amber-100">“{card.summary || card.story || card.review}”</p></div>
        {card.tasks?.length ? <div><p className="text-xs text-amber-400 mb-1">一起玩过</p><p className="text-sm">{card.tasks.join(" · ")}</p></div> : null}
        {card.challenges?.length ? <div><p className="text-xs text-amber-400 mb-1">完成的挑战</p><p className="text-sm">{card.challenges.join(" · ")}</p></div> : null}
        <div><p className="text-xs text-amber-400 mb-1">你们为什么合拍</p><p className="text-sm text-amber-100/85">{card.reason}</p></div>
      </div>
      <button onClick={backToRoom} className="mt-6 w-full rounded-xl border border-amber-600 bg-amber-500/20 py-3 text-amber-200">返回牛牛广场</button>
    </main>;
  }

  if (match.status === "rejected") return <main className="min-h-screen max-w-md mx-auto px-5 py-12 text-center">
    <h1 className="text-xl font-bold mb-4">已退出本次配对</h1>
    <p className="text-sm text-amber-200/70 mb-6">你可以回到房间，等待主理人再次匹配。</p>
    <button onClick={backToRoom} className="rounded-xl bg-amber-500 px-6 py-3 font-bold text-black">返回牛牛广场</button>
  </main>;

  if (match.status === "confirmed" && progress) {
    const taskPhase = progress.completedTasks.length < 2;
    const challengePhase = !taskPhase && progress.completedChallenges.length < 2;
    return <main className="min-h-screen max-w-md mx-auto px-5 py-8">
      <div className="text-center mb-6">
        <p className="text-4xl mb-2">🐮</p>
        <h1 className="text-2xl font-bold">和 {partner?.nickname || "玩伴"} 面对面玩</h1>
        <p className="text-xs text-amber-300/70 mt-2">手机只提供卡片，任务在线下完成</p>
      </div>
      {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}
      {taskPhase && task && <section className="rounded-3xl border border-amber-600/50 bg-[#241b16] p-6">
        <p className="text-xs text-amber-400 mb-2">任务 / 游戏卡 · 已完成 {progress.completedTasks.length}/2</p>
        <h2 className="text-xl font-bold text-amber-200 mb-2">{task.title}</h2>
        <p className="text-sm text-amber-100/80 mb-4">{task.description}</p>
        <ol className="space-y-3 text-sm leading-relaxed text-amber-100/90 list-decimal pl-5">{task.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        <button onClick={() => postAction(`/api/games/${game?.id}/progress`, { action: "complete-task" })} disabled={busy}
          className="mt-6 w-full rounded-xl bg-amber-500 py-3 font-bold text-black disabled:opacity-50">玩过了，继续</button>
        <button onClick={() => postAction(`/api/games/${game?.id}/progress`, { action: "swap" })} disabled={busy || progress.swaps >= 20}
          className="mt-3 w-full rounded-xl border border-amber-700 py-3 text-amber-200 disabled:opacity-40">换一个 · 剩余 {20 - progress.swaps} 次</button>
        <button onClick={reject} disabled={busy} className="mt-4 w-full text-xs text-amber-300/60 underline">不想继续这次配对，重新匹配</button>
      </section>}
      {challengePhase && challenge && <section className="rounded-3xl border border-amber-600/50 bg-[#241b16] p-6">
        <p className="text-xs text-amber-400 mb-2">牛缘挑战 · 第 {progress.completedChallenges.length + 1}/2 关</p>
        <h2 className="text-xl font-bold text-amber-200 mb-3">{challenge.title}</h2>
        <p className="text-sm text-amber-100/75 mb-6">{challenge.detail}</p>
        <button onClick={() => postAction(`/api/games/${game?.id}/progress`, { action: "complete-challenge" })} disabled={busy}
          className="w-full rounded-xl bg-amber-500 py-3 font-bold text-black disabled:opacity-50">线下完成了，继续</button>
      </section>}
      {!taskPhase && !challengePhase && <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/75 px-5">
        <section role="dialog" aria-modal="true" className="w-full max-w-md rounded-3xl border border-amber-600 bg-[#241b16] p-6">
          <h2 className="text-xl font-bold text-amber-200 mb-2">用一句话总结今晚</h2>
          <p className="text-sm text-amber-100/70 mb-4">写下你们想留住的一个瞬间。</p>
          <input value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={100} placeholder="今晚最难忘的是……"
            className="w-full rounded-xl border border-amber-700 bg-[#15110f] px-4 py-3 text-white outline-none" />
          {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
          <button onClick={() => postAction(`/api/games/${game?.id}/complete`, { summary })} disabled={busy || !summary.trim()}
            className="mt-4 w-full rounded-xl bg-amber-500 py-3 font-bold text-black disabled:opacity-50">生成牛缘纪念卡</button>
        </section>
      </div>}
    </main>;
  }

  return <main className="min-h-screen max-w-md mx-auto px-5 py-10 text-center">
    <p className="text-5xl mb-3">🎉</p>
    <h1 className="text-2xl font-bold mb-4">为你找到了今晚的搭子</h1>
    <p className="text-xl mb-2">{partner?.avatar} {partner?.nickname}</p>
    <p className="text-sm text-amber-200/80 mb-4">{partner?.tags?.join(" · ")}</p>
    <div className="rounded-2xl border border-amber-700/60 bg-amber-900/20 p-4 text-left space-y-3 mb-5">
      <p className="text-sm">共同活动：{match.anchor}</p>
      <p className="text-sm">{match.reason}</p>
      <p className="text-sm">破冰建议：{match.icebreaker}</p>
      <p className="text-xs text-amber-300/70">你的今晚标签：{me.tags.join(" · ")}</p>
    </div>
    {partnerPhoto ? <div className="mb-4">
      <p className="text-xs text-amber-300/70 mb-2">对方分享的今晚照片</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={partnerPhoto} alt="玩伴分享" className="w-full max-h-64 object-cover rounded-xl" />
    </div> : <p className="text-sm text-amber-300/70 mb-5">对方没有上传照片，可直接线下认识</p>}
    {!myConfirmed ? <div className="space-y-3">
      <button onClick={() => postAction(`/api/matches/${matchId}/confirm`, {})} disabled={busy} className="w-full rounded-xl bg-amber-500 py-3 font-bold text-black">愿意认识这头牛牛</button>
      <button onClick={reject} disabled={busy} className="w-full rounded-xl border border-amber-700 py-3 text-amber-200">不了，换一个</button>
    </div> : <p className="text-sm text-emerald-300">{partnerConfirmed ? "正在准备线下任务卡…" : "等待对方确认..."}</p>}
    {error && <p className="text-sm text-red-400 mt-4">{error}</p>}
  </main>;
}
