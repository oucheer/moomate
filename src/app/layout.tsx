import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "今晚牛搭子 MooMate",
  description: "Homebar 线下 AI 社交配对游戏",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-[#12100e] text-amber-50 antialiased">{children}</body>
    </html>
  );
}
