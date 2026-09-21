-- GZWWiki initial schema: profiles, articles, storage, RLS

-- Roles enum
create type public.user_role as enum ('admin', 'editor', 'viewer');

-- Article status
create type public.article_status as enum ('draft', 'published');

-- Profiles (1:1 with auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role public.user_role not null default 'editor',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Articles
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  content jsonb not null default '{}'::jsonb,
  cover_url text,
  status public.article_status not null default 'draft',
  author_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index articles_status_idx on public.articles (status);
create index articles_author_id_idx on public.articles (author_id);
create index articles_updated_at_idx on public.articles (updated_at desc);

-- Helper: current user's role
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Helper: is editor or admin
create or replace function public.is_editor_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'editor')
  );
$$;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'editor'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger articles_set_updated_at
  before update on public.articles
  for each row execute function public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.articles enable row level security;

-- Profiles policies
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile display_name"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Admins can update any profile"
  on public.profiles for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Articles policies
create policy "Anyone can read published articles"
  on public.articles for select
  to anon, authenticated
  using (status = 'published');

create policy "Editors can read all articles"
  on public.articles for select
  to authenticated
  using (public.is_editor_or_admin());

create policy "Editors can insert articles"
  on public.articles for insert
  to authenticated
  with check (
    public.is_editor_or_admin()
    and author_id = auth.uid()
  );

create policy "Editors can update any article"
  on public.articles for update
  to authenticated
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "Editors can delete any article"
  on public.articles for delete
  to authenticated
  using (public.is_editor_or_admin());

-- Storage bucket for uploads
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do nothing;

-- Storage policies
create policy "Public read uploads"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'uploads');

create policy "Editors can upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'uploads'
    and public.is_editor_or_admin()
  );

create policy "Editors can update uploads"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'uploads'
    and public.is_editor_or_admin()
  );

create policy "Editors can delete uploads"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'uploads'
    and public.is_editor_or_admin()
  );
