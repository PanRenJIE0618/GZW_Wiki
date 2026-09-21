-- 2D tactical maps + markers linked to wiki entries

create table if not exists public.maps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  image_url text not null,
  status public.article_status not null default 'draft',
  author_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists maps_status_idx on public.maps (status);
create index if not exists maps_updated_at_idx on public.maps (updated_at desc);

create trigger maps_set_updated_at
  before update on public.maps
  for each row execute function public.set_updated_at();

create table if not exists public.map_markers (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps (id) on delete cascade,
  title text not null,
  note text not null default '',
  -- percentage coords relative to map image (0-100)
  x numeric(6,3) not null check (x >= 0 and x <= 100),
  y numeric(6,3) not null check (y >= 0 and y <= 100),
  article_id uuid references public.articles (id) on delete set null,
  color text not null default '#9def4a',
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists map_markers_map_id_idx on public.map_markers (map_id);
create index if not exists map_markers_article_id_idx on public.map_markers (article_id);

create trigger map_markers_set_updated_at
  before update on public.map_markers
  for each row execute function public.set_updated_at();

alter table public.maps enable row level security;
alter table public.map_markers enable row level security;

-- Maps policies
drop policy if exists "Anyone can read published maps" on public.maps;
drop policy if exists "Editors can read all maps" on public.maps;
drop policy if exists "Editors can insert maps" on public.maps;
drop policy if exists "Editors can update maps" on public.maps;
drop policy if exists "Editors can delete maps" on public.maps;

create policy "Anyone can read published maps"
  on public.maps for select
  to anon, authenticated
  using (status = 'published');

create policy "Editors can read all maps"
  on public.maps for select
  to authenticated
  using (public.is_editor_or_admin());

create policy "Editors can insert maps"
  on public.maps for insert
  to authenticated
  with check (public.is_editor_or_admin() and author_id = auth.uid());

create policy "Editors can update maps"
  on public.maps for update
  to authenticated
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "Editors can delete maps"
  on public.maps for delete
  to authenticated
  using (public.is_editor_or_admin());

-- Markers: visible if parent map is readable
drop policy if exists "Anyone can read markers of visible maps" on public.map_markers;
drop policy if exists "Editors can insert markers" on public.map_markers;
drop policy if exists "Editors can update markers" on public.map_markers;
drop policy if exists "Editors can delete markers" on public.map_markers;

create policy "Anyone can read markers of visible maps"
  on public.map_markers for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.maps m
      where m.id = map_id
        and (
          m.status = 'published'
          or public.is_editor_or_admin()
        )
    )
  );

create policy "Editors can insert markers"
  on public.map_markers for insert
  to authenticated
  with check (public.is_editor_or_admin() and created_by = auth.uid());

create policy "Editors can update markers"
  on public.map_markers for update
  to authenticated
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "Editors can delete markers"
  on public.map_markers for delete
  to authenticated
  using (public.is_editor_or_admin());
