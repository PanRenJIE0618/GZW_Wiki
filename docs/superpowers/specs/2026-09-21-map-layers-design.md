# Map Layers (路径 / 物资) Design

Date: 2026-09-21  
Status: Implemented  
Stack: Next.js App Router + Supabase (existing GZWWiki)

## Goal

Support two map-centric content types that entries can reference:

1. **Path (任务路径)** — ordered waypoints that form a route on the world map.
2. **Loot (物资点)** — named icon points (crates, keycards, etc.).

Primary data lives on the **map layer** model. Entries optionally attach layers and show a reading experience. Existing `map_markers` (intel ↔ article) remain unchanged.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Cardinality | Multiple layers can attach to one article |
| Data home | Map layers (not TipTap JSON as source of truth) |
| Entry display | Paths: step list; Loot: icon grid + jump to map |
| Editing | Dual: map edits coordinates; entry editor edits copy/images/order |
| Architecture | New tables, separate from `map_markers` |

## Data model

### `map_layers`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | |
| `map_id` | uuid FK → `maps` | World map |
| `kind` | text check | `path` \| `loot` |
| `name` | text | Layer title |
| `description` | text default `''` | |
| `color` | text | Polyline / accent, default `#9def4a` |
| `icon` | text | Default icon key or URL for loot |
| `article_id` | uuid FK → `articles` nullable | Primary linked entry |
| `status` | `article_status` | `draft` \| `published` |
| `sort_order` | int default 0 | |
| `author_id` | uuid FK → `profiles` | |
| `created_at` / `updated_at` | timestamptz | |

### `map_layer_points`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | |
| `layer_id` | uuid FK → `map_layers` ON DELETE CASCADE | |
| `title` | text | Point / step name |
| `description` | text default `''` | |
| `icon` | text nullable | Overrides layer default when set |
| `image_urls` | text[] default `{}` | Step / point images |
| `x` / `y` | numeric(6,3) | 0–100% of map, same as markers |
| `sort_order` | int | Path sequence; loot display order |
| `created_at` / `updated_at` | timestamptz | |

### Out of scope for v1

- Many-to-many article ↔ layer (use single `article_id`; add junction later if needed).
- Branching paths / conditions.
- Real-time collaborative editing.

## RLS

Mirror maps / markers:

- `anon` + `authenticated`: `SELECT` where layer `status = published` **or** parent map is readable by editors.
- `authenticated` + `is_editor_or_admin()`: INSERT / UPDATE / DELETE on layers and points.
- Points visible only if parent layer is visible.

## Map UI

### Browse (everyone)

- Sidebar section **Layers** with toggles (path / loot filters optional).
- **Path:** polyline through points in `sort_order`; numbered markers; click → detail (title, description, images, link to article).
- **Loot:** icon markers; click → detail.
- Coexist with intel `map_markers`; legend distinguishes kinds.
- Deep link: `/map?layer=<id>&point=<id>` focuses layer + point.

### Edit (editor / admin)

- Mode switch: Intel marker | New path | New loot layer | Edit selected layer.
- **Path:** click map to append points → sidebar edit fields → reorder → save.
- **Loot:** click to place → pick icon (preset keys + custom URL) → name.
- Optionally set `article_id` when saving layer.

### Preset icons (v1)

String keys rendered as HUD icons in CSS/SVG, e.g. `crate`, `keycard`, `key`, `extract`, `objective`, `cache`, plus raw `https://…` URL.

## Entry UI

### Read (`/entries/[slug]`)

- Block **关联图层** only if layers with `article_id = entry.id` and published (editors also see drafts).
- **Path:** vertical steps — order, icon, title, description, images; each step CTA → map deep link.
- **Loot:** icon grid (icon + name); click → map deep link.
- Existing body / params / gallery / comments / `EntryMapLinks` unchanged.

### Edit (`ArticleEditor`)

- Panel **图层**: list layers linked to this article.
- Actions: create empty layer (kind + name) linked here; unlink (`article_id = null`); edit point title / description / icon / images; reorder path steps.
- **No coordinate editing** in entry UI — copy points user to `/map` for placement.
- Saves write the same Supabase rows the map uses.

## Components (indicative)

| Piece | Role |
|-------|------|
| Migration `009_map_layers.sql` | Tables + RLS |
| Types in `src/lib/types.ts` | `MapLayer`, `MapLayerPoint`, `LayerKind` |
| `LayerPanel` on map | List / toggle / select |
| `LayerEditor` on map | Create / place / edit points |
| Polyline + icon markers in `ZoomMapViewer` | Render layers |
| `EntryLayers` on entry page | Path steps + loot grid |
| `EntryLayerEditor` in `ArticleEditor` | Copy / images / order / link |

## Permissions & visibility

Same as rest of wiki: public read published; editor/admin write. Draft layers hidden from guests.

## Success criteria

1. Editor can create a path on the map, place ≥2 points, see polyline, attach to an entry.
2. Entry page shows ordered steps with images and “在地图查看”.
3. Editor can create a loot layer, place icon points; entry shows icon grid.
4. Guests see published layers only; intel markers still work.
5. Editing point text on the entry updates what the map sidebar shows after refresh.

## Non-goals (v1)

- Offline tile packing / third-party tile scraping.
- Mobile-only gesture editor.
- Import from external game APIs.
