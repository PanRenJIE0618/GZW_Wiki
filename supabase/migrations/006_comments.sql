-- Article comments with replies

create table if not exists public.article_comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.article_comments (id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists article_comments_article_id_idx
  on public.article_comments (article_id, created_at asc);

create index if not exists article_comments_parent_id_idx
  on public.article_comments (parent_id);

create trigger article_comments_set_updated_at
  before update on public.article_comments
  for each row execute function public.set_updated_at();

alter table public.article_comments enable row level security;

drop policy if exists "Anyone can read comments" on public.article_comments;
drop policy if exists "Authenticated can insert comments" on public.article_comments;
drop policy if exists "Authors can update own comments" on public.article_comments;
drop policy if exists "Authors or admins can delete comments" on public.article_comments;

create policy "Anyone can read comments"
  on public.article_comments for select
  to anon, authenticated
  using (true);

create policy "Authenticated can insert comments"
  on public.article_comments for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and (
      parent_id is null
      or exists (
        select 1 from public.article_comments p
        where p.id = parent_id
          and p.article_id = article_id
          and p.parent_id is null
      )
    )
  );

create policy "Authors can update own comments"
  on public.article_comments for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "Authors or admins can delete comments"
  on public.article_comments for delete
  to authenticated
  using (
    author_id = auth.uid()
    or public.current_user_role() = 'admin'
  );
