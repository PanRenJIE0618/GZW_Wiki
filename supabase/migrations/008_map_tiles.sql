-- Optional XYZ tile pyramid for world map (progressive loading)

alter table public.maps
  add column if not exists image_width integer,
  add column if not exists image_height integer,
  add column if not exists tile_url_template text,
  add column if not exists tile_min_zoom integer not null default 0,
  add column if not exists tile_max_zoom integer;

comment on column public.maps.tile_url_template is
  'XYZ template e.g. /map-tiles/{z}/{x}/{y}.webp — when set, viewer uses TileLayer';
comment on column public.maps.image_width is 'Source image pixel width (required for tiles)';
comment on column public.maps.image_height is 'Source image pixel height (required for tiles)';
