"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";

interface Match { id: string; participant_a: string; participant_b: string; status: string; reason: string; score: number; confirmed_a: boolean; confirmed_b: boolean }
interface Participant { id: string; nickname: string; avatar: string; tags: string[]; photo_uploaded: boolean; status: string }
interface StageDef { stage: number; type: "quiz" | "pose" | "hunt" | "act"; title: string; text: string; tips?: string[] }
interface Feedback { comment: string; sync: number; hitA?: boolean; hitB?: boolean; aName?: string; bName?: string }
interface Game {
  id: string; match_id: string; status: string; type: string;
  questions: StageDef[]; answers: Record<string, { a?: string; b?: string; guessA?: string; guessB?: string; photo?: string; aNote?: string; bNote?: string }>;
  round_feedback: Record<string, Feedback>; review: string | null; card: CardData | null;
}
interface CardData {
  title?: string; reason?: string; review?: string; story?: string;
  stats?: { totalSync: number; rounds: number };
  photos?: Array<{ stage: number; title: string; url: string }>;
  completedAt?: string;
  reward?: { name?: string; desc?: string; emoji?: string; code?: string; redeemed?: boolean };
}

const TYPE_ICON: Record<string, string> = { quiz: "🎯", pose: "📸", hunt: "🔍", act: "🎭" };
const TYPE_LABEL: Record<string, string> = { quiz: "默契快答", pose: "造型拍照", hunt: "酒吧寻宝", act: "即兴合演" };

export default function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [people, setPeople] = useState<Participant[]>([]);
  const [me, setMe] = useState<Participant | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [partnerPhoto, setPartnerPhoto] = useState("");

  // 当前关卡输入
  const [answer, setAnswer] = useState("");
  const [guess, setGuess] = useState("");
  const [note, setNote] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => { load(); const t = setInterval(load, 3500); return () => clearInterval(t); }, [load]);

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
      const roomId = localStorage.getItem("moomate_room");
      if (roomId) window.location.href = `/room/${roomId}`;
    } finally { setBusy(false); }
  }

  // ========== 游戏相关 ==========
  const plan: StageDef[] = game?.questions || [];
  const answers = game?.answers || {};
  const fb = game?.round_feedback || {};
  const currentStage = plan.find((s) => {
    const a = answers[String(s.stage)];
    const done = s.type === "quiz" ? Boolean(a?.a && a?.b) : Boolean(a?.photo);
    return !done;
  }) || null;
  const stagesDone = plan.filter((s) => {
    const a = answers[String(s.stage)];
    return s.type === "quiz" ? Boolean(a?.a && a?.b) : Boolean(a?.photo);
  }).length;
  const allDone = stagesDone === plan.length && plan.length > 0;
  const curKey = currentStage ? String(currentStage.stage) : "";
  const curAns = currentStage ? answers[curKey] : undefined;
  const isQuiz = currentStage?.type === "quiz";
  const myQuizDone = isQuiz && curAns && (match?.participant_a === me?.id ? curAns.a : curAns.b);
  const myActionDone = !isQuiz && curAns && (curAns.photo);
  const canSubmit = isQuiz ? Boolean(myQuizDone || (answer.trim() && (currentStage.stage !== 1 || guess.trim()))) : Boolean(photoFile || myActionDone);

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  }

  async function submitStage() {
    if (!game || !currentStage || busy) return;
    setBusy(true); setError("");
    try {
      const fd = new FormData();
      fd.append("participantId", me?.id || "");
      fd.append("stage", String(currentStage.stage));
      if (isQuiz) { fd.append("text", answer); if (guess) fd.append("guess", guess); }
      else if (note) fd.append("text", note);
      if (photoFile) fd.append("photo", photoFile);
      const res = await fetch(`/api/games/${game.id}/answer`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "提交失败");
      setGame(json.game);
      setAnswer(""); setGuess(""); setNote(""); setPhotoFile(null); setPhotoPreview("");
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function completeGame() {
    if (!game) return;
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/games/${game.id}/complete`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: me?.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "生成失败");
      setGame(json.game);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
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

  // ================= 纪念卡 =================
  if (game?.status === "completed" && game.card) {
    const card = game.card as CardData;
    return (
      <main className="min-h-screen px-5 py-10 max-w-md mx-auto text-center">
        <p className="text-5xl mb-3">🏆</p>
        <h1 className="text-2xl font-bold mb-1">牛牛挑战赛 · 纪念卡</h1>
        <p className="text-amber-500/70 text-sm mb-6">{card.completedAt ? new Date(card.completedAt).toLocaleString("zh-CN") : ""}</p>

        <div className="bg-gradient-to-b from-amber-800/40 to-[#1d1915] border-2 border-amber-600/60 rounded-3xl p-6 text-left mb-5">
          <p className="text-lg font-bold text-amber-300 text-center mb-4">{card.title}</p>

          {typeof card.stats?.totalSync === "number" && (
            <div className="bg-amber-500/10 border border-amber-600/40 rounded-xl p-4 mb-4 text-center">
              <p className="text-xs text-amber-300/70 mb-1">今晚默契值</p>
              <p className="text-3xl font-bold text-amber-400">{card.stats.totalSync}</p>
            </div>
          )}

          {card.photos && card.photos.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-amber-500/70 mb-2">📷 挑战瞬间</p>
              <div className="grid grid-cols-2 gap-2">
                {card.photos.map((p) => (
                  <div key={p.stage} className="rounded-xl overflow-hidden border border-amber-800/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.title} className="w-full h-24 object-cover" />
                    <p className="text-[9px] text-amber-300/60 px-1 py-0.5 truncate">{p.title}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {card.story && (
            <div className="mb-4">
              <p className="text-xs text-amber-500/70 mb-1">📖 今晚牛缘故事</p>
              <p className="text-sm text-amber-100/85 leading-relaxed whitespace-pre-wrap">{card.story}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-amber-500/70 mb-1">🧡 为什么合适</p>
            <p className="text-sm text-amber-100/80">{card.reason}</p>
          </div>
          <div className="mt-3">
            <p className="text-xs text-amber-500/70 mb-1">📝 裁判长总评</p>
            <p className="text-sm text-amber-100/80">{card.review}</p>
          </div>
        </div>

        {card.reward && (
          <div className="bg-gradient-to-b from-emerald-700/25 to-[#12241c] border border-emerald-500/50 rounded-2xl p-5 mb-5">
            <p className="text-xs text-emerald-300 mb-2 text-center">🎁 线下奖励 · 凭码到吧台兑换</p>
            <p className="text-center text-5xl mb-2">{card.reward.emoji || "🎁"}</p>
            <p className="text-center font-bold text-lg text-emerald-200 mb-1">{card.reward.name}</p>
            <p className="text-center text-xs text-emerald-300/70 mb-4">{card.reward.desc}</p>
            <div className="bg-black/40 border border-emerald-600/50 rounded-xl py-3 text-center">
              <p className="font-mono font-bold text-xl tracking-widest text-emerald-300">{card.reward.code}</p>
            </div>
            <p className="text-center text-[11px] text-emerald-300/60 mt-2">出示此码给主理人 / 吧台工作人员核销</p>
            {card.reward.redeemed && <p className="text-center text-sm mt-3 text-emerald-400 font-bold">✅ 已核销</p>}
          </div>
        )}

        <button onClick={() => { const roomId = localStorage.getItem("moomate_room"); if (roomId) window.location.href = `/room/${roomId}`; }}
          className="w-full bg-amber-500/20 border border-amber-600 text-amber-300 py-3 rounded-xl text-sm font-bold">
          返回牛牛广场
        </button>
      </main>
    );
  }

  // ================= 游戏中 =================
  if (game && match.status === "confirmed" && plan.length > 0) {
    return (
      <main className="min-h-screen px-5 py-8 max-w-md mx-auto">
        <div className="text-center mb-5">
          <p className="text-xs text-amber-300/70 mb-1">🤖 AI 导演已排好 4 关</p>
          <h1 className="text-xl font-bold">牛牛线下大挑战</h1>
          <p className="text-xs text-amber-300/60 mt-1">和搭子面对面 · 真实互动 · 手机只做任务卡</p>
        </div>

        {/* 关卡进度条 */}
        <div className="flex items-center gap-1.5 mb-5">
          {plan.map((s, i) => {
            const a = answers[String(s.stage)];
            const done = s.type === "quiz" ? Boolean(a?.a && a?.b) : Boolean(a?.photo);
            const active = currentStage?.stage === s.stage;
            return (
              <div key={s.stage} className="flex-1 text-center">
                <div className={`h-1.5 rounded-full ${done ? "bg-emerald-400" : active ? "bg-amber-400 animate-pulse" : "bg-amber-900/40"}`} />
                <p className={`text-[9px] mt-1 ${done ? "text-emerald-400" : active ? "text-amber-300" : "text-amber-300/40"}`}>{TYPE_ICON[s.type]}{i + 1}</p>
              </div>
            );
          })}
        </div>

        {error && <p className="text-red-400 text-sm text-center mb-3">{error}</p>}

        {/* 当前关卡 */}
        {currentStage && (
          <div className="bg-gradient-to-b from-amber-800/25 to-[#1d1915] border border-amber-600/50 rounded-3xl p-6 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{TYPE_ICON[currentStage.type]}</span>
              <div>
                <p className="text-xs text-amber-400/80">{TYPE_LABEL[currentStage.type]}</p>
                <p className="font-bold text-amber-200">{currentStage.title}</p>
              </div>
            </div>

            <p className="text-[15px] font-medium leading-relaxed mb-2">{currentStage.text}</p>

            {currentStage.tips && (
              <div className="mb-4 space-y-1">
                {currentStage.tips.map((t, i) => (
                  <p key={i} className="text-xs text-amber-300/60">💡 {t}</p>
                ))}
              </div>
            )}

            {/* 快答关：各自写 + 预测 */}
            {isQuiz && (
              <div className="space-y-3">
                {!myQuizDone ? (
                  <>
                    <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={2}
                      placeholder="写下你的答案..."
                      className="w-full bg-[#1a1613] border border-amber-800/50 rounded-xl px-4 py-3 text-sm text-white placeholder:text-amber-300/40 outline-none focus:border-amber-400 resize-none" />
                    {currentStage.stage === 1 && (
                      <textarea value={guess} onChange={(e) => setGuess(e.target.value)} rows={2}
                        placeholder="🕵️ 预测一下对方会怎么答（可加看好戏筹码）"
                        className="w-full bg-[#1a1613] border border-amber-800/50 rounded-xl px-4 py-3 text-sm text-white placeholder:text-amber-300/40 outline-none focus:border-amber-400 resize-none" />
                    )}
                    <button onClick={submitStage} disabled={busy || !answer.trim() || (currentStage.stage === 1 && !guess.trim())}
                      className="w-full bg-amber-500 text-black font-bold py-3 rounded-xl disabled:opacity-50">
                      {busy ? "提交中..." : "锁定答案"}
                    </button>
                  </>
                ) : (
                  <p className="text-center text-sm text-emerald-400 animate-pulse">已提交！等对方写完就揭晓…</p>
                )}
              </div>
            )}

            {/* 动作关：拍照上传 */}
            {!isQuiz && (
              <div className="space-y-3">
                {photoPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-amber-600/50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreview} alt="挑战照片" className="w-full h-44 object-cover" />
                    <button onClick={() => { setPhotoFile(null); setPhotoPreview(""); }}
                      className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">重拍</button>
                  </div>
                ) : myActionDone ? (
                  <p className="text-center text-sm text-emerald-400 animate-pulse">照片已提交！等裁判看照片打分…</p>
                ) : (
                  <button onClick={() => fileRef.current?.click()}
                    className="w-full bg-amber-500/15 border-2 border-dashed border-amber-600/50 text-amber-300 py-8 rounded-xl text-sm font-bold">
                    📷 完成挑战后，拍一张合照上传
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={pickPhoto} />
                {!myActionDone && (
                  <>
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选：留一句挑战感想…"
                      className="w-full bg-[#1a1613] border border-amber-800/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-amber-300/40 outline-none focus:border-amber-400" />
                    <button onClick={submitStage} disabled={busy || !photoFile}
                      className="w-full bg-amber-500 text-black font-bold py-3 rounded-xl disabled:opacity-50">
                      {busy ? "上传中..." : "提交挑战 🎉"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* AI 裁判结果（已揭晓的关） */}
        {plan.map((s) => {
          const f = fb[String(s.stage)];
          if (!f) return null;
          const a = answers[String(s.stage)];
          return (
            <div key={s.stage} className="bg-[#1d1915] border border-emerald-700/40 rounded-2xl p-4 mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-emerald-300">{TYPE_ICON[s.type]} {s.title} · 裁判点评</p>
                <span className="text-xs font-bold text-emerald-400">默契 {f.sync}</span>
              </div>
              <p className="text-sm text-amber-100/85 leading-relaxed">{f.comment}</p>
              {f.hitA !== undefined && (f.hitA || f.hitB) && (
                <p className="text-xs text-amber-300 mt-1">🔮 读心命中：{[f.hitA && f.aName, f.hitB && f.bName].filter(Boolean).join("、")}</p>
              )}
              {a?.photo && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={`/api/game-photo/${game.id}/${s.stage}`} alt={s.title} className="mt-2 rounded-xl w-full h-36 object-cover border border-amber-800/40" />
              )}
            </div>
          );
        })}

        {allDone && !game.review && (
          <button onClick={completeGame} disabled={busy}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-xl disabled:opacity-50 mb-4">
            {busy ? "AI 正在写牛缘故事..." : "🏁 挑战完成 · 生成纪念卡 & 领奖励"}
          </button>
        )}
      </main>
    );
  }

  // ================= 待确认 =================
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

      <div className="bg-[#1d1915] border border-amber-900/40 rounded-2xl p-4 mb-6 text-center">
        <p className="text-sm text-amber-300/80">
          📸 {partnerConfirmed ? "对方已确认，照片解锁！" : "双方确认后解锁彼此照片"}
        </p>
        {partnerPhoto && (
          /* eslint-disable-next-line @next/next/no-img-element */
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
            {partnerConfirmed ? "双方确认！即将开始线下挑战..." : "等待对方确认..."}
          </p>
        </div>
      )}
    </main>
  );
}
