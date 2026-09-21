# Map Layers (路径 / 物资) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add map layers for task paths (ordered polylines) and loot points (icon markers), with entry read/edit surfaces that share the same Supabase rows.

**Architecture:** New `map_layers` + `map_layer_points` tables (separate from `map_markers`). Map page renders and places points; entry page shows path steps / loot grids and edits copy/images/order only. Deep links `/map?layer=&point=` focus a layer point.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase Postgres+RLS, Leaflet + react-leaflet, TypeScript, Tailwind 4.

## Global Constraints

- Do not scrape or reconstruct third-party tile originals; only use assets the project owns or is licensed to use.
- Keep existing `map_markers` intel behavior unchanged.
- Public read for `status = published`; write only via `is_editor_or_admin()`.
- Coordinates are percentage 0–100 (same as markers).
- Layer `kind` is exactly `path` | `loot`.
- No git repo in workspace today — **skip commit steps** unless `git status` works; still finish each task’s verify step.
- Prefer small components; avoid stuffing all layer UI into `ZoomMapViewer.tsx`.
- Read Next docs under `node_modules/next/dist/docs/` before using unfamiliar Next 16 APIs.

**Spec:** `docs/superpowers/specs/2026-09-21-map-layers-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `supabase/migrations/009_map_layers.sql` | Tables, indexes, RLS, triggers |
| `src/lib/types.ts` | `LayerKind`, `MapLayer`, `MapLayerPoint` |
| `src/lib/layer-icons.ts` | Preset icon keys + resolve URL/key helper |
| `src/components/LayerIcon.tsx` | Render preset key or image URL |
| `src/components/MapLayersOverlay.tsx` | Leaflet polyline + layer point markers |
| `src/components/MapLayerSidebar.tsx` | Browse list, toggles, point detail, edit form |
| `src/components/ZoomMapViewer.tsx` | Wire modes, deep link, pass layers into overlay/sidebar |
| `src/components/MapViewerClient.tsx` | Pass new props through |
| `src/app/map/page.tsx` | Load layers+points; parse `layer`/`point` searchParams |
| `src/components/EntryLayers.tsx` | Entry read: path steps / loot grid |
| `src/components/EntryLayerEditor.tsx` | Entry edit: link/create/reorder/copy/images |
| `src/components/ArticleEditor.tsx` | Mount `EntryLayerEditor` when editing |
| `src/app/entries/[slug]/page.tsx` | Fetch linked layers; render `EntryLayers` |
| `DEPLOY.md` | Document running `009_map_layers.sql` |
| `src/lib/layer-icons.test.mjs` | Node test for icon helper (no vitest in repo) |

---

### Task 1: Migration + types + icon helper

**Files:**
- Create: `supabase/migrations/009_map_layers.sql`
- Create: `src/lib/layer-icons.ts`
- Create: `src/lib/layer-icons.test.mjs`
- Modify: `src/lib/types.ts`
- Modify: `DEPLOY.md`

**Interfaces:**
- Consumes: existing `public.maps`, `public.articles`, `public.profiles`, `public.article_status`, `public.is_editor_or_admin()`, `public.set_updated_at()`
- Produces:
  - Tables `public.map_layers`, `public.map_layer_points`
  - Types `LayerKind`, `MapLayer`, `MapLayerPoint`
  - `LAYER_ICON_PRESETS: readonly { key: string; label: string }[]`
  - `resolveLayerIcon(icon: string | null | undefined, fallback?: string | null): { kind: 'preset' | 'url' | 'none'; value: string }`

- [ ] **Step 1: Write icon helper test (fail first)**

Create `src/lib/layer-icons.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { resolveLayerIcon, LAYER_ICON_PRESETS } from "./layer-icons.ts";

test("presets include crate and keycard", () => {
  const keys = LAYER_ICON_PRESETS.map((p) => p.key);
  assert.ok(keys.includes("crate"));
  assert.ok(keys.includes("keycard"));
});

test("http URL resolves as url", () => {
  const r = resolveLayerIcon("https://example.com/a.png");
  assert.equal(r.kind, "url");
  assert.equal(r.value, "https://example.com/a.png");
});

test("preset key resolves as preset", () => {
  const r = resolveLayerIcon("crate");
  assert.equal(r.kind, "preset");
  assert.equal(r.value, "crate");
});

test("empty falls back", () => {
  const r = resolveLayerIcon("", "key");
  assert.equal(r.kind, "preset");
  assert.equal(r.value, "key");
});
```

Note: if importing `.ts` from node test fails without a loader, implement `layer-icons.ts` as plain logic duplicated into `layer-icons.mjs` for the test **or** rename helper to `layer-icons.mjs` and re-export from a thin `.ts` — prefer single `src/lib/layer-icons.ts` and run test via:

```bash
node --experimental-strip-types --test src/lib/layer-icons.test.mjs
```

If strip-types cannot import `.ts`, change the test to import `./layer-icons.mjs` and keep implementation in `.mjs`, with `layer-icons.ts` doing `export * from "./layer-icons.mjs"`.

- [ ] **Step 2: Run test — expect FAIL (module missing)**

Run: `node --experimental-strip-types --test src/lib/layer-icons.test.mjs`  
Expected: FAIL cannot find module / resolveLayerIcon not defined.

- [ ] **Step 3: Implement `src/lib/layer-icons.ts`**

```ts
export const LAYER_ICON_PRESETS = [
  { key: "crate", label: "物资箱" },
  { key: "keycard", label: "房卡" },
  { key: "key", label: "钥匙" },
  { key: "extract", label: "撤离" },
  { key: "objective", label: "目标" },
  { key: "cache", label: "缓存点" },
] as const;

export type LayerIconPresetKey = (typeof LAYER_ICON_PRESETS)[number]["key"];

export function resolveLayerIcon(
  icon: string | null | undefined,
  fallback: string | null | undefined = null,
): { kind: "preset" | "url" | "none"; value: string } {
  const raw = (icon ?? "").trim() || (fallback ?? "").trim();
  if (!raw) return { kind: "none", value: "" };
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) {
    return { kind: "url", value: raw };
  }
  const preset = LAYER_ICON_PRESETS.find((p) => p.key === raw);
  if (preset) return { kind: "preset", value: preset.key };
  return { kind: "preset", value: raw };
}
```

- [ ] **Step 4: Re-run test — expect PASS**

Run: `node --experimental-strip-types --test src/lib/layer-icons.test.mjs`  
Expected: PASS (all tests).

- [ ] **Step 5: Add types to `src/lib/types.ts`**

Append:

```ts
export type LayerKind = "path" | "loot";

export type MapLayer = {
  id: string;
  map_id: string;
  kind: LayerKind;
  name: string;
  description: string;
  color: string;
  icon: string;
  article_id: string | null;
  status: ArticleStatus;
  sort_order: number;
  author_id: string;
  created_at: string;
  updated_at: string;
};

export type MapLayerPoint = {
  id: string;
  layer_id: string;
  title: string;
  description: string;
  icon: string | null;
  image_urls: string[];
  x: number;
  y: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type MapLayerWithPoints = MapLayer & {
  points: MapLayerPoint[];
  articles?: Pick<Article, "id" | "title" | "slug"> | null;
};
```

- [ ] **Step 6: Write `supabase/migrations/009_map_layers.sql`**

Full SQL (run in Supabase SQL Editor after 007/008):

```sql
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
```

- [ ] **Step 7: Update `DEPLOY.md`**

Add under the migration list:

```markdown
   - `supabase/migrations/009_map_layers.sql`（地图图层：任务路径 / 物资点）
```

- [ ] **Step 8: Verify TypeScript still builds types**

Run: `npx tsc --noEmit` (or `npm run build` if tsc not scripted)  
Expected: success (or only pre-existing unrelated errors).

- [ ] **Step 9: Commit (skip if no git)**

```bash
git add supabase/migrations/009_map_layers.sql src/lib/types.ts src/lib/layer-icons.ts src/lib/layer-icons.test.mjs DEPLOY.md
git commit -m "feat: add map_layers schema and icon helpers"
```

---

### Task 2: LayerIcon + MapLayersOverlay (render)

**Files:**
- Create: `src/components/LayerIcon.tsx`
- Create: `src/components/MapLayersOverlay.tsx`
- Modify: `src/app/globals.css` (small `.layer-icon` styles)

**Interfaces:**
- Consumes: `resolveLayerIcon`, `MapLayerWithPoints`, `pctToLatLng` pattern from `ZoomMapViewer` (duplicate a small `layerPctToLatLng` inside overlay using same CoordMode rules — accept `mode: { kind: 'image' | 'tiles'; size: {w,h}; maxZoom?: number }`)
- Produces:
  - `LayerIcon({ icon, fallback, className, size? })`
  - `MapLayersOverlay({ layers, visibleIds, selectedPointId, onSelectPoint, coordMode })`

- [ ] **Step 1: Implement `LayerIcon.tsx`**

```tsx
"use client";

import { resolveLayerIcon } from "@/lib/layer-icons";

const PRESET_GLYPH: Record<string, string> = {
  crate: "▣",
  keycard: "▭",
  key: "열쇠",
  extract: "⤴",
  objective: "◎",
  cache: "◇",
};

// Use ASCII-safe glyphs if Chinese font issues: key → "钥匙" is fine in this UI.
// Prefer: key: "K", extract: "E", etc. if glyphs look wrong.

type Props = {
  icon?: string | null;
  fallback?: string | null;
  className?: string;
  size?: number;
};

export function LayerIcon({ icon, fallback, className = "", size = 16 }: Props) {
  const resolved = resolveLayerIcon(icon, fallback);
  if (resolved.kind === "none") {
    return (
      <span
        className={`layer-icon layer-icon--empty ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  if (resolved.kind === "url") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolved.value}
        alt=""
        className={`layer-icon layer-icon--img ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  const glyph = PRESET_GLYPH[resolved.value] ?? "•";
  return (
    <span
      className={`layer-icon layer-icon--preset ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.7 }}
      title={resolved.value}
    >
      {glyph}
    </span>
  );
}
```

Fix `key` glyph to `"⚿"` or `"K"` — do **not** leave Korean placeholder; use `"K"`.

- [ ] **Step 2: Add CSS**

In `globals.css`:

```css
.layer-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid var(--border-strong);
  background: #0a100d;
  color: var(--accent);
  line-height: 1;
}
.layer-icon--img {
  object-fit: cover;
}
.layer-icon--empty {
  background: var(--panel-2);
}
```

- [ ] **Step 3: Implement `MapLayersOverlay.tsx`**

Use `Polyline`, `Marker`, `divIcon` from react-leaflet/leaflet. For each visible layer:

- Sort points by `sort_order`.
- If `kind === 'path'` and ≥2 points, draw `Polyline` with `layer.color`.
- Each point: `Marker` with `LayerIcon` / step number in `divIcon`.
- `eventHandlers.click` → `onSelectPoint(layer.id, point.id)`.

Coord conversion must match `ZoomMapViewer` tiles vs image mode (copy the same math as `pctToLatLng` in that file).

- [ ] **Step 4: Smoke-check compile**

Run: `npm run build`  
Expected: compile succeeds (overlay may be unused until Task 3 — that is OK if exported).

- [ ] **Step 5: Commit (skip if no git)**

```bash
git add src/components/LayerIcon.tsx src/components/MapLayersOverlay.tsx src/app/globals.css
git commit -m "feat: add layer icon and map overlay renderers"
```

---

### Task 3: Map page load + ZoomMapViewer wiring (browse + deep link)

**Files:**
- Modify: `src/app/map/page.tsx`
- Modify: `src/components/MapViewerClient.tsx`
- Modify: `src/components/ZoomMapViewer.tsx`
- Create: `src/components/MapLayerSidebar.tsx` (browse-only first: list, toggle, detail)

**Interfaces:**
- Consumes: `MapLayerWithPoints`, `MapLayersOverlay`, `LayerIcon`
- Produces: map page loads `layers` with nested `points`; query `layer` + `point` selects them

- [ ] **Step 1: Extend `map/page.tsx` searchParams and fetch**

```ts
searchParams: Promise<{ marker?: string; layer?: string; point?: string }>;
```

After loading `wikiMap`, fetch:

```ts
const { data: layerRows } = await supabase
  .from("map_layers")
  .select("*, map_layer_points(*), articles(id, title, slug)")
  .eq("map_id", wikiMap.id)
  .order("sort_order", { ascending: true });
```

Normalize each row: sort `map_layer_points` by `sort_order`, rename to `points`, cast to `MapLayerWithPoints[]`. For non-editors, RLS already hides drafts.

Pass into `MapViewerClient`:

```tsx
layers={layers}
initialLayerId={layerId ?? null}
initialLayerPointId={pointId ?? null}
```

- [ ] **Step 2: Thread props through `MapViewerClient` → `ZoomMapViewer`**

- [ ] **Step 3: In `ZoomMapViewer`, add state**

- `layers` state from props  
- `visibleLayerIds: Set<string>` default all published layer ids  
- `selectedLayerId` / `selectedLayerPointId` from initial deep link  
- Render `<MapLayersOverlay … />` inside `MapContainer`  
- Render `<MapLayerSidebar … />` in aside (above or below marker list)

Browse sidebar minimum:

- Toggle checkboxes per layer  
- Click layer → expand points  
- Click point → set selection + flyTo (reuse `FlyToMarker` pattern with layer point coords)  
- Show title, description, images, link to article if present  
- Link: `/entries/${slug}` when `articles` joined

- [ ] **Step 4: Manual verify**

1. Run `009_map_layers.sql` in Supabase.  
2. Insert a draft/published layer via SQL for smoke (optional) or wait for Task 4.  
3. Open `/map` — no crash; intel markers still work.  
4. `npm run build` PASS.

- [ ] **Step 5: Commit (skip if no git)**

```bash
git add src/app/map/page.tsx src/components/MapViewerClient.tsx src/components/ZoomMapViewer.tsx src/components/MapLayerSidebar.tsx
git commit -m "feat: load and display map layers on world map"
```

---

### Task 4: Map layer editing (create path / loot, place points)

**Files:**
- Modify: `src/components/MapLayerSidebar.tsx`
- Modify: `src/components/ZoomMapViewer.tsx`

**Interfaces:**
- Consumes: `createClient`, `canEdit`, `currentUserId`, `LAYER_ICON_PRESETS`
- Produces: editors can create layer, append points by map click, update/delete points, set `article_id` / `status` / `color` / `icon`

- [ ] **Step 1: Add edit mode state on map**

```ts
type MapEditMode = "intel" | "layer-draw" | null;
// when layer-draw, also activeLayerId being edited
```

Toolbar (editors only):

- 「情报点」→ existing placing  
- 「新建路径」→ insert `map_layers` row `kind:'path'`, enter draw mode  
- 「新建物资」→ insert `kind:'loot'`  
- 「编辑图层」→ select existing layer into draw mode  

- [ ] **Step 2: Map click while `layer-draw`**

Compute pct via existing `latLngToPct`. Insert `map_layer_points`:

```ts
{
  layer_id,
  title: kind === 'path' ? `步骤 ${n}` : '物资点',
  description: '',
  icon: null,
  image_urls: [],
  x, y,
  sort_order: n,
}
```

Refresh local `layers` state (or optimistic append).

- [ ] **Step 3: Sidebar edit form for selected point / layer**

Fields: layer name, color, icon (select presets + URL input), status, article select (reuse `entryOptions`), point title/description, image upload to `uploads` bucket (same pattern as `MapCreateForm.uploadImage`), delete point, delete layer.

Reorder path: buttons「上移/下移」swapping `sort_order` and `update` both rows.

- [ ] **Step 4: Manual verify**

1. Login as editor.  
2. Create path, click 3 points, see polyline.  
3. Create loot, place 2 points with `crate` / `keycard`.  
4. Publish layer; logout — guest still sees it.  
5. Intel marker add still works in intel mode.

- [ ] **Step 5: Commit (skip if no git)**

```bash
git add src/components/MapLayerSidebar.tsx src/components/ZoomMapViewer.tsx
git commit -m "feat: edit path and loot layers on the map"
```

---

### Task 5: Entry read — `EntryLayers`

**Files:**
- Create: `src/components/EntryLayers.tsx`
- Modify: `src/app/entries/[slug]/page.tsx`

**Interfaces:**
- Consumes: `MapLayerWithPoints`, `LayerIcon`
- Produces: entry page section for linked published layers (editors: include drafts)

- [ ] **Step 1: Implement `EntryLayers.tsx`**

```tsx
type Props = { layers: MapLayerWithPoints[] };

// path → ordered steps with images + Link to `/map?layer=${id}&point=${pid}`
// loot → grid of icon+title links to same deep link
// return null if layers.length === 0
```

Use existing `panel` / `hud-label` / `title-name` classes.

- [ ] **Step 2: Fetch on entry page**

```ts
const { data: linkedLayers } = await supabase
  .from("map_layers")
  .select("*, map_layer_points(*)")
  .eq("article_id", data.id)
  .order("sort_order", { ascending: true });
```

Filter client-side: if `!canEdit(profile?.role)` keep only `status === 'published'`. Sort points. Render `<EntryLayers layers={...} />` near `EntryMapLinks`.

- [ ] **Step 3: Manual verify**

Attach a layer’s `article_id` to the entry (map sidebar or SQL). Open entry — path steps or loot grid appear; CTA opens map focused.

- [ ] **Step 4: Commit (skip if no git)**

```bash
git add src/components/EntryLayers.tsx src/app/entries/[slug]/page.tsx
git commit -m "feat: show linked map layers on entry pages"
```

---

### Task 6: Entry editor — `EntryLayerEditor`

**Files:**
- Create: `src/components/EntryLayerEditor.tsx`
- Modify: `src/components/ArticleEditor.tsx`
- Modify: `src/app/entries/[slug]/edit/page.tsx` (pass `mapId` if needed)

**Interfaces:**
- Consumes: `article.id`, `authorId`, world `map_id` (load slug `world` map)
- Produces: create empty linked layer; unlink; edit point copy/images/order; **no x/y editors**

- [ ] **Step 1: Resolve world map id inside `EntryLayerEditor`**

```ts
const { data: world } = await supabase.from('maps').select('id').eq('slug','world').maybeSingle();
```

If no map, show「请先配置总图」+ link `/map/setup`.

- [ ] **Step 2: UI actions**

- List layers where `article_id = article.id`  
- 「新建路径图层」/「新建物资图层」→ insert layer with `map_id`, `article_id`, `author_id`, `status: 'draft'`  
- 「解除关联」→ `update article_id = null`  
- For each point: inputs title, description, icon select, upload images (append to `image_urls`), reorder, note text:「坐标请到地图调整」+ link `/map?layer=`  
- Persist with supabase `update` / `upsert`

- [ ] **Step 3: Mount in `ArticleEditor`**

Only when `article` prop exists (edit mode). Place a `panel` section after gallery / before submit.

- [ ] **Step 4: Manual verify**

1. Edit entry → create path layer → open map → place points → return to entry → edit step text/images → refresh map sidebar shows new text.  
2. Loot grid updates after icon change.  
3. `npm run build` PASS.

- [ ] **Step 5: Commit (skip if no git)**

```bash
git add src/components/EntryLayerEditor.tsx src/components/ArticleEditor.tsx
git commit -m "feat: edit layer copy and links from entry editor"
```

---

### Task 7: Polish + acceptance pass

**Files:**
- Modify as needed: deep-link flyTo on load, empty states, legend labels in map HUD footer
- Modify: `docs/superpowers/specs/2026-09-21-map-layers-design.md` status → Implemented (optional)

- [ ] **Step 1: Deep link on first paint**

When `initialLayerPointId` set, after map ready `flyTo` that point and open sidebar detail (use `useEffect` once).

- [ ] **Step 2: Acceptance checklist (manual)**

1. Editor creates path ≥2 points, polyline visible, attaches article.  
2. Entry shows ordered steps +「在地图查看」.  
3. Editor creates loot with icons; entry shows icon grid.  
4. Guest sees published only; intel markers unchanged.  
5. Entry text edit reflects on map after refresh.

- [ ] **Step 3: Final build**

Run: `npm run build`  
Expected: success.

- [ ] **Step 4: Commit (skip if no git)**

```bash
git add -A
git commit -m "feat: polish map layer deep links and acceptance fixes"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| `map_layers` / `map_layer_points` + RLS | 1 |
| Preset icons + URL | 1–2 |
| Path polyline + loot icons on map | 2–4 |
| Browse toggles + detail | 3 |
| Edit on map (place / reorder / publish / article link) | 4 |
| Deep link `layer`+`point` | 3, 7 |
| Entry path steps / loot grid | 5 |
| Entry editor dual-edit copy/images/order | 6 |
| Keep `map_markers` | 3–4 (intel mode untouched) |
| DEPLOY migration note | 1 |

No TBD placeholders. Types `MapLayer` / `MapLayerPoint` / `MapLayerWithPoints` consistent across tasks.
