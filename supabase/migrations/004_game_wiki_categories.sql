-- Game-wiki structure: categories + entry params/gallery

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  cover_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categories_sort_order_idx on public.categories (sort_order, name);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

alter table public.articles
  add column if not exists category_id uuid references public.categories (id) on delete set null,
  add column if not exists summary text not null default '',
  add column if not exists params jsonb not null default '[]'::jsonb,
  add column if not exists gallery jsonb not null default '[]'::jsonb;

create index if not exists articles_category_id_idx on public.articles (category_id);

alter table public.categories enable row level security;

create policy "Anyone can read categories"
  on public.categories for select
  to anon, authenticated
  using (true);

create policy "Editors can insert categories"
  on public.categories for insert
  to authenticated
  with check (public.is_editor_or_admin());

create policy "Editors can update categories"
  on public.categories for update
  to authenticated
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "Editors can delete categories"
  on public.categories for delete
  to authenticated
  using (public.is_editor_or_admin());

-- Seed a few starter categories (safe to re-run)
insert into public.categories (name, slug, description, sort_order)
values
  ('角色', 'characters', '可玩角色、NPC 与敌人', 10),
  ('装备', 'equipment', '武器、防具与饰品', 20),
  ('道具', 'items', '消耗品、材料与任务物品', 30),
  ('关卡', 'stages', '地图、副本与区域', 40)
on conflict (slug) do nothing;
