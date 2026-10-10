"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

interface Participant {
  id: string; nickname: string; avatar: string; tags: string[];
  photo_uploaded: boolean; status: string; match_id: string | null;
  room_id: string; gender: string; gender_preference: string;
  answers: Record<string, string> | null; ai_profile: { tags?: string[] } | null;
}
interface Match { id: string; participant_a: string; participant_b: string; status: string; reason: string; score: number }
interface Room { id: string; code: string; theme: string; status: string }
interface ChatMsg {
  id: string; participant_id: string; content: string; created_at: string;
  participant: { nickname: string; avatar: string } | { nickname: string; avatar: string }[] | null;
}

const AVATAR_FALLBACK = "🐮";
const STATUS_LABEL: Record<string, string> = {
  waiting: "等待匹配", matched: "已匹配", confirmed: "已确认",
  playing: "游戏中", completed: "已完成", preparing: "准备中",
};

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [me, setMe] = useState<Participant | null>(null);
  const [quizStep, setQuizStep] = useState(0);
  const [answers, setAnswers] = useState({ goal: "", style: "", fun: "", ideal: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [viewBull, setViewBull] = useState<Participant | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const myMatch = matches.find((m) => m.id === me?.match_id);
  const myPartnerId = myMatch ? (myMatch.participant_a === me?.id ? myMatch.participant_b : myMatch.participant_a) : null;
  const partner = participants.find((p) => p.id === myPartnerId);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/state/${roomId}`);
      if (!res.ok) return;
      const json = await res.json();
      setRoom(json.room);
      setParticipants(json.participants || []);
      setMatches(json.matches || []);
      const savedId = localStorage.getItem(`participant_${json.room?.code}`);
      if (savedId) {
        setMe((json.participants || []).find((p: Participant) => p.id === savedId) || null);
      }
    } catch { /* silent */ }
  }, [roomId]);

  const loadMessages = useCallback(async () => {
    if (!room?.code) return;
    try {
      const res = await fetch(`/api/rooms/${room.code}/messages`);
      if (!res.ok) return;
      const json = await res.json();
      setMessages(json.messages || []);
    } catch { /* silent */ }
  }, [room?.code]);

  useEffect(() => { load(); const t = setInterval(load, 3500); return () => clearInterval(t); }, [load]);
  useEffect(() => { loadMessages(); const t = setInterval(loadMessages, 3000); return () => clearInterval(t); }, [loadMessages]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);
  useEffect(() => {
    localStorage.setItem("moomate_room", roomId);
  }, [roomId]);
  useEffect(() => {
    if (myMatch && (myMatch.status === "confirmed" || myMatch.status === "completed")) {
      router.push(`/match/${myMatch.id}`);
    }
  }, [myMatch, router]);

  async function saveQuiz() {
    if (!me) return;
    setSaving(true);
    try {
      await fetch(`/api/participants/${me.id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      await load();
    } finally { setSaving(false); }
  }

  async function uploadPhoto(file: File) {
    if (!me) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      const res = await fetch(`/api/participants/${me.id}/photo`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "上传失败");
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "上传失败");
    }
    finally { setUploading(false); }
  }

  async function sendChat() {
    if (!me || !chatInput.trim() || sending || !room?.code) return;
    setSending(true);
    const text = chatInput.trim();
    setChatInput("");
    try {
      const res = await fetch(`/api/rooms/${room.code}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: me.id, content: text }),
      });
      if (!res.ok) throw new Error("发送失败");
      await loadMessages();
    } catch {
      setChatInput(text); // 发送失败恢复输入
    } finally { setSending(false); }
  }

  const QUIZ = [
    { key: "goal", q: "今晚你想获得什么？", options: ["认识朋友", "深度聊天", "一起玩", "寻找心动搭子"] },
    { key: "style", q: "你更像哪一种牛牛？", options: ["气氛组", "观察者", "冒险家", "倾听者"] },
    { key: "fun", q: "什么互动最让你开心？", options: ["搞笑", "走心", "竞争", "合作"] },
    { key: "ideal", q: "用一句话描述理想中的今晚", options: null as string[] | null },
  ];

  if (!me) return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        <div className="text-4xl mb-3">🐮</div>
        <p className="text-amber-300/80 text-sm">正在识别你的牛牛身份...</p>
        <p className="text-amber-300/50 text-xs mt-2">如长时间未进入，请重新扫码</p>
      </div>
    </main>
  );

  const profileDone = me.answers && Object.keys(me.answers).length > 0;

  return (
    <main className="min-h-screen px-4 py-8 max-w-md mx-auto">
      <div className="text-center mb-5">
        <p className="text-xs text-amber-300/80">{room?.theme || "今晚牛搭子"}</p>
        <h1 className="text-xl font-bold mt-1 text-amber-100">牛牛广场</h1>
      </div>

      {/* 我的牛牛卡片 */}
      <section className="bg-gradient-to-b from-amber-900/30 to-[#1d1915] border border-amber-800/50 rounded-3xl p-5 mb-5">
        <div className="flex items-center gap-4">
          <span className="text-4xl">{me.avatar || AVATAR_FALLBACK}</span>
          <div className="flex-1">
            <p className="font-bold text-lg text-amber-100">{me.nickname}</p>
            <p className="text-xs text-amber-300/70 mt-0.5">{STATUS_LABEL[me.status] || "准备中"}</p>
          </div>
          {profileDone && (
            <span className="text-[10px] bg-emerald-500/15 text-emerald-300 px-2 py-1 rounded-full">资料完成</span>
          )}
        </div>
      </section>

      {/* 问答区（未回答时显示） */}
      {(!me.answers || Object.keys(me.answers).length === 0) && quizStep < QUIZ.length && (
        <section className="bg-[#1d1915] border border-amber-800/40 rounded-3xl p-6 mb-5">
          <p className="text-xs text-amber-300/70 mb-1">第 {quizStep + 1} / {QUIZ.length} 题</p>
          <h2 className="font-bold text-lg text-amber-100 mb-4">{QUIZ[quizStep].q}</h2>
          {QUIZ[quizStep].options ? (
            <div className="space-y-2 mb-4">
              {(QUIZ[quizStep].options || []).map((opt) => (
                <button key={opt}
                  onClick={() => { setAnswers((a) => ({ ...a, [QUIZ[quizStep].key]: opt })); setQuizStep((s) => s + 1); }}
                  className="w-full text-left px-4 py-3 rounded-xl bg-[#2a241f] text-amber-100 hover:bg-amber-800/40 transition">
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <div className="mb-4">
              <input value={answers.ideal}
                onChange={(e) => setAnswers((a) => ({ ...a, ideal: e.target.value }))}
                placeholder="例如：认识几个有趣的人，一起玩点游戏"
                className="w-full bg-[#2a241f] text-amber-100 placeholder-amber-300/40 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/50" />
              <button onClick={() => setQuizStep((s) => s + 1)} disabled={!answers.ideal.trim()}
                className="mt-3 w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold py-3 rounded-xl transition">
                下一题
              </button>
            </div>
          )}
        </section>
      )}

      {/* 已答完 → 保存并提示上传照片 */}
      {(!me.answers || Object.keys(me.answers).length === 0) && quizStep >= QUIZ.length && (
        <section className="bg-[#1d1915] border border-amber-800/40 rounded-3xl p-6 mb-5">
          <h2 className="font-bold text-lg text-amber-100 mb-2">回答完成 🎉</h2>
          <p className="text-sm text-amber-300/80 mb-4">上传一张照片，让配对成功后对方能看到真实的你。</p>
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} className="hidden" id="photo-input" />
          <label htmlFor="photo-input" className="block w-full text-center bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl cursor-pointer transition">
            {uploading ? "上传中..." : "上传照片"}
          </label>
          <button onClick={saveQuiz} disabled={saving}
            className="mt-3 w-full bg-[#2a241f] hover:bg-[#332b25] text-amber-100 font-bold py-3 rounded-xl transition">
            {saving ? "保存中..." : "先保存问答"}
          </button>
        </section>
      )}

      {/* 已回答 → 提示上传照片或等待匹配 */}
      {profileDone && !me.photo_uploaded && (
        <section className="bg-[#1d1915] border border-amber-800/40 rounded-3xl p-6 mb-5">
          <h2 className="font-bold text-lg text-amber-100 mb-2">还差一步</h2>
          <p className="text-sm text-amber-300/80 mb-4">上传一张照片，才能进入匹配池。</p>
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} className="hidden" id="photo-input" />
          <label htmlFor="photo-input" className="block w-full text-center bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl cursor-pointer transition">
            {uploading ? "上传中..." : "上传照片"}
          </label>
        </section>
      )}

      {profileDone && me.photo_uploaded && !myMatch && (
        <section className="bg-[#1d1915] border border-amber-800/40 rounded-3xl p-4 mb-5 text-center">
          <p className="text-sm text-amber-300/80">✅ 资料已完成，等待主理人开始匹配...</p>
          <p className="text-xs text-amber-300/50 mt-1">可以先在下方和大家聊聊天</p>
        </section>
      )}

      {/* 匹配结果 */}
      {myMatch && (myMatch.status === "pending" || myMatch.status === "waiting") && (
        <section className="bg-gradient-to-b from-amber-800/25 to-[#1d1915] border border-amber-700/50 rounded-3xl p-6 mb-5">
          <p className="text-xs text-amber-500 font-bold mb-2">🎉 AI 为你找到了搭子</p>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">{partner?.avatar || AVATAR_FALLBACK}</span>
            <div>
              <p className="font-bold text-amber-100">{partner?.nickname || "牛牛"}</p>
              <p className="text-xs text-amber-300/70">匹配分 {myMatch.score}</p>
            </div>
          </div>
          <p className="text-sm text-amber-100/80 leading-relaxed mb-4">{myMatch.reason}</p>
          <button onClick={() => router.push(`/match/${myMatch.id}`)}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl transition">
            查看并确认
          </button>
        </section>
      )}

      {/* 牛牛广场聊天 */}
      <section className="mb-5">
        <h2 className="text-sm font-bold text-amber-300 mb-2">🗣️ 牛牛闲聊</h2>
        <div className="bg-[#1d1915] border border-amber-800/40 rounded-3xl overflow-hidden">
          <div className="h-56 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-center text-xs text-amber-300/40 pt-16">还没有人发言，来打破沉默吧～</p>
            )}
            {messages.map((m) => {
              const sender = Array.isArray(m.participant) ? m.participant[0] : m.participant;
              const isMe = m.participant_id === me.id;
              return (
                <div key={m.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                  <span className="text-xl leading-none mt-0.5">{sender?.avatar || AVATAR_FALLBACK}</span>
                  <div className={`max-w-[75%] ${isMe ? "text-right" : ""}`}>
                    {!isMe && <p className="text-[10px] text-amber-300/50 mb-0.5">{sender?.nickname || "牛牛"}</p>}
                    <div className={`inline-block px-3 py-2 rounded-2xl text-sm leading-relaxed ${isMe ? "bg-amber-500 text-black rounded-br-sm" : "bg-[#2a241f] text-amber-100 rounded-bl-sm"}`}>
                      {m.content}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          <div className="border-t border-amber-800/30 flex gap-2 px-3 py-2.5">
            <input value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) sendChat(); }}
              placeholder="和大家聊聊..."
              maxLength={200}
              className="flex-1 bg-[#2a241f] text-amber-100 placeholder-amber-300/40 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/40" />
            <button onClick={sendChat} disabled={sending || !chatInput.trim()}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold text-sm px-4 rounded-xl transition">
              发送
            </button>
          </div>
        </div>
      </section>

      {/* 牛牛广场（点击查看资料，不能组队） */}
      <section className="mb-10">
        <h2 className="text-sm font-bold text-amber-300 mb-1">🌾 牛牛广场</h2>
        <p className="text-[11px] text-amber-300/50 mb-2">点击牛牛查看资料 · 组队只能由 AI 匹配决定</p>
        <div className="relative h-80 rounded-3xl overflow-hidden border border-amber-800/40 bg-gradient-to-b from-[#1c2a33] via-[#243d28] to-[#3a5227]">
          {/* 夜空与月牙 */}
          <div className="absolute top-3 right-5 text-2xl select-none">🌙</div>
          <div className="absolute top-6 left-6 text-[8px] text-amber-100/40 select-none">✦</div>
          <div className="absolute top-10 left-20 text-[7px] text-amber-100/30 select-none">✦</div>
          <div className="absolute top-4 left-32 text-[9px] text-amber-100/35 select-none">✦</div>

          {/* 萤火虫 */}
          <span className="firefly absolute text-[10px] select-none" style={{ left: "15%", top: "22%", animationDelay: "0s" }}>✨</span>
          <span className="firefly absolute text-[9px] select-none" style={{ left: "70%", top: "30%", animationDelay: "0.8s" }}>✨</span>
          <span className="firefly absolute text-[11px] select-none" style={{ left: "40%", top: "18%", animationDelay: "1.4s" }}>✨</span>
          <span className="firefly absolute text-[9px] select-none" style={{ left: "85%", top: "55%", animationDelay: "2s" }}>✨</span>
          <span className="firefly absolute text-[10px] select-none" style={{ left: "8%", top: "60%", animationDelay: "1.1s" }}>✨</span>

          {/* 草丛装饰 */}
          <span className="grass-sway absolute text-xl select-none" style={{ left: "6%", bottom: "6%", animationDelay: "0s" }}>🌾</span>
          <span className="grass-sway absolute text-lg select-none" style={{ left: "30%", bottom: "3%", animationDelay: "0.7s" }}>🌿</span>
          <span className="grass-sway absolute text-xl select-none" style={{ left: "55%", bottom: "5%", animationDelay: "1.2s" }}>🌾</span>
          <span className="grass-sway absolute text-base select-none" style={{ left: "78%", bottom: "4%", animationDelay: "0.3s" }}>🍀</span>
          <span className="grass-sway absolute text-lg select-none" style={{ left: "92%", bottom: "8%", animationDelay: "1.6s" }}>🌿</span>

          {/* 牛牛们 */}
          {participants.map((p, i) => {
            const hash = [...p.id].reduce((acc, c) => acc + c.charCodeAt(0), 0);
            const x = 12 + ((hash * 37) % 74);
            const y = 30 + ((hash * 53) % 42);
            const delay = ((hash % 30) / 10).toFixed(1);
            const dur = 4 + ((hash % 25) / 10);
            const wander = hash % 3 !== 0;
            const flipped = hash % 2 === 0;
            const isMe = p.id === me.id;
            return (
              <button key={p.id} onClick={() => setViewBull(p)}
                style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delay}s`, animationDuration: `${dur}s` }}
                className={`bull-anim absolute -translate-x-0 z-10 flex flex-col items-center cursor-pointer transition-transform active:scale-90 ${wander ? "bull-wander" : ""}`}>
                <span className={`bull-emoji text-4xl drop-shadow-lg ${flipped ? "flipped" : ""}`}>{p.avatar || AVATAR_FALLBACK}</span>
                <span className={`text-[10px] px-1.5 py-0.5 mt-1 rounded-full whitespace-nowrap border ${isMe ? "bg-amber-500/90 text-black border-amber-300 font-bold" : "bg-black/50 text-amber-100 border-amber-700/40"}`}>
                  {p.nickname}
                </span>
                <span className="text-[9px] text-amber-200/60 bg-black/40 px-1 rounded mt-0.5">{STATUS_LABEL[p.status] || "准备中"}</span>
              </button>
            );
          })}
          {participants.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-amber-200/50">广场还是空的，等牛牛们进来吧～</p>
          )}
        </div>
      </section>

      {/* 牛牛资料弹窗 */}
      {viewBull && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-8" onClick={() => setViewBull(null)}>
          <div className="w-full max-w-md bg-[#1d1915] border border-amber-700/40 rounded-3xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4">
              <span className="text-5xl">{viewBull.avatar || AVATAR_FALLBACK}</span>
              <div>
                <p className="text-xl font-bold text-amber-100">{viewBull.nickname}</p>
                <p className="text-xs text-amber-300/70 mt-0.5">{STATUS_LABEL[viewBull.status] || "准备中"}</p>
              </div>
            </div>
            <div className="border-t border-amber-800/30 pt-4 space-y-3 text-sm">
              {viewBull.answers ? (
                <>
                  <p className="text-amber-300/80"><span className="text-amber-500/70">今晚目标：</span>{viewBull.answers.goal || "—"}</p>
                  <p className="text-amber-300/80"><span className="text-amber-500/70">牛牛风格：</span>{viewBull.answers.style || "—"}</p>
                  <p className="text-amber-300/80"><span className="text-amber-500/70">喜欢互动：</span>{viewBull.answers.fun || "—"}</p>
                  {viewBull.answers.ideal && (
                    <p className="text-amber-300/80"><span className="text-amber-500/70">理想今晚：</span>{viewBull.answers.ideal}</p>
                  )}
                </>
              ) : (
                <p className="text-amber-300/60">这头牛牛还没完成问答</p>
              )}
            </div>
            <p className="text-[11px] text-amber-300/40 bg-amber-900/20 rounded-xl px-3 py-2 leading-relaxed">
              🤖 组队由 AI 根据问答与偏好统一匹配，暂时不能手动组队。等主理人开始匹配后，你可能会和 TA 成为搭子。
            </p>
            <button onClick={() => setViewBull(null)}
              className="w-full bg-[#2a241f] hover:bg-[#332b25] text-amber-100 py-2.5 rounded-xl text-sm font-bold transition">
              关闭
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
