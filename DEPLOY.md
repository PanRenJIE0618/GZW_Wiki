# Deploy GZWWiki to Vercel + Supabase

## 1. Create a Supabase project

1. Go to https://supabase.com and create a project.
2. Open **SQL Editor**, paste and run in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_prevent_role_escalation.sql`
   - `supabase/migrations/003_fix_role_escalation_for_sql_editor.sql`（若 002 已是新版可跳过）
   - `supabase/migrations/004_game_wiki_categories.sql`（游戏百科：分类 / 参数 / 图集）
   - `supabase/migrations/005_contributors.sql`（多贡献者 / 贡献值 / 最后编辑者）
   - `supabase/migrations/006_comments.sql`（词条评论与回复）
   - `supabase/migrations/007_maps.sql`（二维地图与点位双向关联）
   - `supabase/migrations/008_map_tiles.sql`（可选：瓦片流式加载字段）
   - `supabase/migrations/009_map_layers.sql`（地图图层：任务路径 / 物资点）
3. In **Authentication → Providers**, enable Email.
4. Optional for local/dev: disable **Confirm email** under Authentication → Providers → Email so signup works immediately.
5. In **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` (later your Vercel URL)
   - Redirect URLs: `http://localhost:3000/auth/callback` and `https://YOUR_DOMAIN/auth/callback`
6. Copy **Project URL** and **anon public** key from **Project Settings → API**.

## 2. Local run

```bash
cp .env.example .env.local
# fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```

Open http://localhost:3000

First registered user is `editor` by default. Promote yourself to `admin` in SQL:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'YOUR_EMAIL');
```

Then use **用户** page to manage roles.

## 3. Game wiki usage

1. **管理分类**：创建/删除「角色、装备、道具」等分类  
2. **新建词条**：选分类、填参数（信息框）、上传封面/图集、写详细说明、发布  
3. 访客路径：首页分类 → 分类列表 → 词条详情（右侧信息框 + 图集 + 正文）  
4. 正文里可用链接指向其他词条，例如 `/entries/某个词条slug`  
5. **贡献值**：新建词条 +20，每次编辑 +10；详情页展示多名贡献者、本词条贡献值与最后修改时间  
6. **评论**：词条详情可评论与回复（需登录）  
7. **地图**：单张可缩放总图；大图可用 XYZ 瓦片流式加载（`npm run map:tiles`）

## Map tiles (optional)

```bash
npm run map:tiles -- ./your-huge-map.png ./public/map-tiles
```

Then open `/map/setup` and fill the printed `tile_url_template` / width / height / maxZoom.

## 4. Deploy to Vercel

1. Push this repo to GitHub/GitLab.
2. Import the project in https://vercel.com
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy.
5. Update Supabase Auth Site URL / Redirect URLs to the Vercel domain.

## 5. Smoke checklist

- [ ] 首页显示分类卡片
- [ ] 分类页显示词条列表
- [ ] 词条详情有参数信息框与图集
- [ ] 编辑者可新建/编辑/删除词条
- [ ] 访客只能看到已发布词条
- [ ] Admin 可改用户角色
