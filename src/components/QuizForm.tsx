"use client";

import { useState } from "react";
import { QUESTIONS, validateAnswers } from "@/lib/quiz";
import type { QuizAnswers } from "@/types";

export default function QuizForm({ participantId, initial, onSaved }: { participantId: string; initial: QuizAnswers | null; onSaved: () => Promise<void> }) {
  const [answers, setAnswers] = useState<QuizAnswers>(initial || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggle(key: keyof QuizAnswers, option: string, max?: number) {
    const current = (answers[key] as string[] | undefined) || [];
    const next = current.includes(option) ? current.filter((v) => v !== option) : max && current.length >= max ? current : [...current, option];
    setAnswers((previous) => ({ ...previous, [key]: next }));
  }

  async function save() {
    const result = validateAnswers(answers);
    if (result.error) { setError(result.error); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/participants/${participantId}/profile`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: result.answers }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "保存失败");
      await onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); }
    finally { setSaving(false); }
  }

  return (
    <section className="bg-[#1d1915] border border-amber-800/40 rounded-3xl p-5 mb-5">
      <h2 className="font-bold text-lg text-amber-100">今晚的破冰问答</h2>
      <p className="text-xs text-amber-300/70 mt-1 mb-5">只描述你今晚的偏好。第 1、2、5 题必答，其余可跳过；未回答不会被推断。</p>
      <div className="space-y-6">
        {QUESTIONS.map((q, index) => {
          const selected = answers[q.key];
          return (
            <fieldset key={q.key} className="border-t border-amber-900/40 pt-4">
              <legend className="sr-only">{q.title}</legend>
              <p className="font-medium text-sm text-amber-100">{index + 1}. {q.title}</p>
              <p className="text-[11px] text-amber-300/60 mt-1 mb-2">{q.type === "single" ? "单选" : `多选${q.max ? ` · 最多 ${q.max} 项` : ""}`} · {q.required ? "必答" : "可跳过"}</p>
              <div className="flex flex-wrap gap-2">
                {q.options.map((option) => {
                  const active = q.type === "multi" ? Array.isArray(selected) && selected.includes(option) : selected === option;
                  const limited = q.type === "multi" && !active && Boolean(q.max && Array.isArray(selected) && selected.length >= q.max);
                  return <button type="button" key={option} disabled={limited} aria-pressed={active}
                    onClick={() => q.type === "single" ? setAnswers((prev) => ({ ...prev, [q.key]: option })) : toggle(q.key, option, q.max)}
                    className={`rounded-xl px-3 py-2 text-xs border ${active ? "bg-amber-500 text-black border-amber-500 font-bold" : "bg-[#2a241f] text-amber-100 border-amber-900/40"} disabled:opacity-40`}>
                    {option}
                  </button>;
                })}
              </div>
              {q.key === "q8" && answers.q8?.includes("其他") && <input value={answers.q8Other || ""} maxLength={30}
                onChange={(e) => setAnswers((prev) => ({ ...prev, q8Other: e.target.value }))} placeholder="其他兴趣（可选，最多 30 字）"
                className="w-full mt-3 bg-[#2a241f] border border-amber-900/40 rounded-xl px-3 py-2 text-sm text-white" />}
              {!q.required && selected && (Array.isArray(selected) ? selected.length > 0 : true) && <button type="button"
                className="block text-[11px] text-amber-300/60 mt-2 underline" onClick={() => setAnswers((prev) => ({ ...prev, [q.key]: undefined }))}>清空本题</button>}
            </fieldset>
          );
        })}
      </div>
      {error && <p role="alert" className="text-red-400 text-sm mt-4">{error}</p>}
      <button onClick={save} disabled={saving} className="w-full bg-amber-500 text-black font-bold py-3 rounded-xl mt-6 disabled:opacity-50">
        {saving ? "保存中..." : "保存问答并生成今晚标签"}
      </button>
    </section>
  );
}
