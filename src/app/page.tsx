"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [theme, setTheme] = useState("今晚牛搭子");
  const [capacity, setCapacity] = useState(20);
  const [hours, setHours] = useState(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createRoom() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, capacity, hours }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "创建失败");
      localStorage.setItem(`host_${json.room.id}`, json.hostToken);
      router.push(`/host/${json.room.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="text-6xl mb-3">🐮</div>
          <h1 className="text-4xl font-bold tracking-tight">今晚牛搭子</h1>
          <p className="text-amber-300 mt-2 text-sm font-medium">Homebar × MooMate · AI 社交配对游戏</p>
        </div>

        <div className="bg-[#1d1915] border border-amber-900/40 rounded-3xl p-6 space-y-5">
          <div>
            <label className="text-sm text-amber-300 mb-1 block font-medium">今晚主题</label>
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="w-full bg-[#1a1613] border border-amber-800/50 rounded-xl px-4 py-3 text-white placeholder:text-amber-200/40 outline-none focus:border-amber-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-amber-300 mb-1 block font-medium">人数上限</label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full bg-[#1a1613] border border-amber-800/50 rounded-xl px-4 py-3 text-white placeholder:text-amber-200/40 outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="text-sm text-amber-300 mb-1 block font-medium">持续小时</label>
              <input
                type="number"
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="w-full bg-[#1a1613] border border-amber-800/50 rounded-xl px-4 py-3 text-white placeholder:text-amber-200/40 outline-none focus:border-amber-400"
              />
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={createRoom}
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3.5 rounded-xl transition disabled:opacity-50"
          >
            {loading ? "创建中..." : "创建今晚的房间"}
          </button>
          <p className="text-xs text-amber-300/60 text-center">创建后会生成专属二维码，扫码即可加入牛牛广场。</p>
        </div>

        <div className="mt-8 text-center text-sm text-amber-300/80">
          <p>参与者？请用微信扫描主理人出示的二维码。</p>
        </div>
      </div>
    </main>
  );
}

