# 🐮 MooMate 今晚牛搭子

线下派对破冰与双人玩伴匹配。多人匹配仅保留入口，本版暂未开放。

## 技术栈

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres + Storage + Realtime)
- 规则匹配（问卷原始答案评分）；OpenAI 兼容 API 仅用于后续游戏内容
- Netlify 托管

## 本地开发

1. 复制 `.env.example` 为 `.env.local`，填写 Supabase URL 和 Service Role Key。
2. 在 Supabase SQL Editor 执行 `supabase/schema.sql`，再执行 `supabase/migrations/20261011_party_matching.sql`。已有数据库只执行迁移文件。
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

`supabase/schema.sql` 包含 rooms / participants / matches / games 表及只读 RLS。迁移添加双人活动主题、破冰建议和原子匹配函数；服务端只匹配完成新版问卷且仍在等待的参与者，最低匹配分为 60。

需要在 Supabase Storage 创建名为 `photos` 的私有 bucket（MVP 阶段 API 会自动处理上传和签名 URL）。

## 微信扫码流程

二维码指向 `https://<你的域名>/join/<房间码>`，微信扫一扫打开 H5 加入。
