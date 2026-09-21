# GZWWiki

多人协作在线百科：Next.js + Supabase + TipTap。无需自建后端 API。

## Features

- 邮箱注册 / 登录
- 文章增删改查、草稿 / 发布
- TipTap 富文本（标题、列表、引用、代码、图片、附件链接）
- 角色：`admin` / `editor` / `viewer`
- 公网部署：Vercel（前端）+ Supabase（数据库 / 认证 / 文件）

## Quick start

详见 [DEPLOY.md](./DEPLOY.md)。

```bash
cp .env.example .env.local
npm install
npm run dev
```

在 Supabase SQL Editor 执行 `supabase/migrations/` 下的脚本后再访问应用。

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js App Router |
| Backend-as-a-Service | Supabase Auth, Postgres, Storage, RLS |
| Editor | TipTap |
| Hosting | Vercel + Supabase Cloud |
