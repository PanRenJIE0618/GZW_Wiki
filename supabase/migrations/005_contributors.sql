-- 005 contributors (split-safe). Run EACH block separately if needed.
-- Before running: stop `npm run dev`, close other SQL tabs, wait 5s.

-- ===== BLOCK 1: columns =====
alter table public.profiles
  add column if not exists contribution_points integer not null default 0;

alter table public.articles
  add column if not exists last_editor_id uuid references public.profiles (id) on delete set null;

-- ===== BLOCK 2: table =====
create table if not exists public.article_contributors (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  points integer not null default 0 check (points >= 0),
  edit_count integer not null default 0 check (edit_count >= 0),
  last_contributed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (article_id, user_id)
);

create index if not exists article_contributors_article_id_idx
  on public.article_contributors (article_id);

create index if not exists article_contributors_user_id_idx
  on public.article_contributors (user_id);

create index if not exists article_contributors_points_idx
  on public.article_contributors (article_id, points desc);

-- ===== BLOCK 3: RLS =====
alter table public.article_contributors enable row level security;

drop policy if exists "Anyone can read article contributors" on public.article_contributors;
drop policy if exists "No direct insert contributors" on public.article_contributors;
drop policy if exists "No direct update contributors" on public.article_contributors;
drop policy if exists "No direct delete contributors" on public.article_contributors;

create policy "Anyone can read article contributors"
  on public.article_contributors for select
  to anon, authenticated
  using (true);

create policy "No direct insert contributors"
  on public.article_contributors for insert
  to authenticated
  with check (false);

create policy "No direct update contributors"
  on public.article_contributors for update
  to authenticated
  using (false);

create policy "No direct delete contributors"
  on public.article_contributors for delete
  to authenticated
  using (false);

-- ===== BLOCK 4: function =====
create or replace function public.record_article_contribution(
  p_article_id uuid,
  p_points integer default 10
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pts integer := greatest(coalesce(p_points, 0), 0);
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_editor_or_admin() then
    raise exception 'Only editors can record contributions';
  end if;

  if not exists (select 1 from public.articles where id = p_article_id) then
    raise exception 'Article not found';
  end if;

  insert into public.article_contributors (
    article_id, user_id, points, edit_count, last_contributed_at
  )
  values (p_article_id, uid, pts, 1, now())
  on conflict (article_id, user_id) do update
  set
    points = public.article_contributors.points + excluded.points,
    edit_count = public.article_contributors.edit_count + 1,
    last_contributed_at = now();

  update public.profiles
  set contribution_points = contribution_points + pts
  where id = uid;

  update public.articles
  set last_editor_id = uid
  where id = p_article_id;
end;
$$;

grant execute on function public.record_article_contribution(uuid, integer) to authenticated;

-- ===== BLOCK 5: backfill =====
insert into public.article_contributors (article_id, user_id, points, edit_count, last_contributed_at)
select a.id, a.author_id, 20, 1, a.created_at
from public.articles a
on conflict (article_id, user_id) do nothing;

update public.articles a
set last_editor_id = coalesce(a.last_editor_id, a.author_id)
where a.last_editor_id is null;
