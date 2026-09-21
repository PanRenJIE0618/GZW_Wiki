export type UserRole = "admin" | "editor" | "viewer";
export type ArticleStatus = "draft" | "published";

export type Profile = {
  id: string;
  display_name: string | null;
  role: UserRole;
  contribution_points: number;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  cover_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type EntryParam = {
  label: string;
  value: string;
};

export type Article = {
  id: string;
  title: string;
  slug: string;
  content: Record<string, unknown>;
  cover_url: string | null;
  status: ArticleStatus;
  author_id: string;
  last_editor_id: string | null;
  category_id: string | null;
  summary: string;
  params: EntryParam[];
  gallery: string[];
  created_at: string;
  updated_at: string;
};

export type ArticleContributor = {
  id: string;
  article_id: string;
  user_id: string;
  points: number;
  edit_count: number;
  last_contributed_at: string;
  created_at: string;
  profiles: Pick<Profile, "display_name" | "role" | "contribution_points"> | null;
};

export type ArticleComment = {
  id: string;
  article_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  profiles: Pick<Profile, "display_name" | "role"> | null;
};

export type WikiMap = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  status: ArticleStatus;
  author_id: string;
  created_at: string;
  updated_at: string;
  image_width?: number | null;
  image_height?: number | null;
  tile_url_template?: string | null;
  tile_min_zoom?: number | null;
  tile_max_zoom?: number | null;
};

export type MapMarker = {
  id: string;
  map_id: string;
  title: string;
  note: string;
  x: number;
  y: number;
  article_id: string | null;
  color: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  articles?: Pick<Article, "id" | "title" | "slug" | "cover_url" | "summary"> | null;
};

export type MapMarkerWithMap = MapMarker & {
  maps: Pick<WikiMap, "id" | "name" | "slug" | "image_url" | "status"> | null;
};

export type ArticleWithRelations = Article & {
  profiles: Pick<Profile, "display_name" | "role" | "contribution_points"> | null;
  last_editor: Pick<Profile, "id" | "display_name" | "contribution_points"> | null;
  categories: Pick<Category, "id" | "name" | "slug"> | null;
};

export type ArticleWithAuthor = ArticleWithRelations;

export const CONTRIB_POINTS_CREATE = 20;
export const CONTRIB_POINTS_EDIT = 10;

export function canEdit(role: UserRole | null | undefined): boolean {
  return role === "admin" || role === "editor";
}

export function isAdmin(role: UserRole | null | undefined): boolean {
  return role === "admin";
}

export function normalizeParams(raw: unknown): EntryParam[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const label = String(row.label ?? "").trim();
      const value = String(row.value ?? "").trim();
      if (!label && !value) return null;
      return { label, value };
    })
    .filter((item): item is EntryParam => item !== null);
}

export function normalizeGallery(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

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
