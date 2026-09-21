-- Map layers: path routes + loot icon points (separate from map_markers)

create table if not exists public.map_layers (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps (id) on delete cascade,
  kind text not null check (kind in ('path', 'loot')),
  name text not null,
  description text not null default '',
  color text not null default '#9def4a',
  icon text not null default 'crate',
  article_id uuid references public.articles (id) on delete set null,
  status public.article_status not null default 'draft',
  sort_order integer not null default 0,
  author_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists map_layers_map_id_idx on public.map_layers (map_id);
create index if not exists map_layers_article_id_idx on public.map_layers (article_id);
create index if not exists map_layers_status_idx on public.map_layers (status);

create trigger map_layers_set_updated_at
  before update on public.map_layers
  for each row execute function public.set_updated_at();

create table if not exists public.map_layer_points (
  id uuid primary key default gen_random_uuid(),
  layer_id uuid not null references public.map_layers (id) on delete cascade,
  title text not null,
  description text not null default '',
  icon text,
  image_urls text[] not null default '{}',
  x numeric(6,3) not null check (x >= 0 and x <= 100),
  y numeric(6,3) not null check (y >= 0 and y <= 100),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists map_layer_points_layer_id_idx
  on public.map_layer_points (layer_id, sort_order);

create trigger map_layer_points_set_updated_at
  before update on public.map_layer_points
  for each row execute function public.set_updated_at();

alter table public.map_layers enable row level security;
alter table public.map_layer_points enable row level security;

drop policy if exists "Anyone can read published layers" on public.map_layers;
drop policy if exists "Editors can read all layers" on public.map_layers;
drop policy if exists "Editors can insert layers" on public.map_layers;
drop policy if exists "Editors can update layers" on public.map_layers;
drop policy if exists "Editors can delete layers" on public.map_layers;

create policy "Anyone can read published layers"
  on public.map_layers for select
  to anon, authenticated
  using (status = 'published');

create policy "Editors can read all layers"
  on public.map_layers for select
  to authenticated
  using (public.is_editor_or_admin());

create policy "Editors can insert layers"
  on public.map_layers for insert
  to authenticated
  with check (public.is_editor_or_admin() and author_id = auth.uid());

create policy "Editors can update layers"
  on public.map_layers for update
  to authenticated
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "Editors can delete layers"
  on public.map_layers for delete
  to authenticated
  using (public.is_editor_or_admin());

drop policy if exists "Anyone can read points of visible layers" on public.map_layer_points;
drop policy if exists "Editors can insert layer points" on public.map_layer_points;
drop policy if exists "Editors can update layer points" on public.map_layer_points;
drop policy if exists "Editors can delete layer points" on public.map_layer_points;

create policy "Anyone can read points of visible layers"
  on public.map_layer_points for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.map_layers l
      where l.id = layer_id
        and (
          l.status = 'published'
          or public.is_editor_or_admin()
        )
    )
  );

create policy "Editors can insert layer points"
  on public.map_layer_points for insert
  to authenticated
  with check (
    public.is_editor_or_admin()
    and exists (
      select 1 from public.map_layers l
      where l.id = layer_id
    )
  );

create policy "Editors can update layer points"
  on public.map_layer_points for update
  to authenticated
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "Editors can delete layer points"
  on public.map_layer_points for delete
  to authenticated
  using (public.is_editor_or_admin());
