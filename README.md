# 🐮 MooMate 今晚牛搭子

Homebar 线下 AI 社交配对游戏 MVP。

## 技术栈

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres + Storage + Realtime)
- OpenAI 兼容 API（匹配理由 / 游戏题目 / 默契点评）
- Netlify 托管

## 本地开发

1. 复制 `.env.example` 为 `.env.local`，填写 Supabase URL 和 Service Role Key。
2. 在 Supabase SQL Editor 执行 `supabase/schema.sql`。
3. `npm run dev` 启动。

## 部署到 Netlify

1. 将代码推到 GitHub 仓库。
2. Netlify 新建站点，连接仓库。
3. 配置环境变量：
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`（可选）
   - `NEXT_PUBLIC_SITE_URL`（Netlify 生产域名，如 `https://moomate.netlify.app`）
4. 部署完成后，主理人打开 `/` 创建房间即可生成二维码。

## 数据库

`supabase/schema.sql` 包含 rooms / participants / matches / games 表及只读 RLS。

需要在 Supabase Storage 创建名为 `photos` 的私有 bucket（MVP 阶段 API 会自动处理上传和签名 URL）。

## 微信扫码流程

二维码指向 `https://<你的域名>/join/<房间码>`，微信扫一扫打开 H5 加入。
