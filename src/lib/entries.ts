import { createClient } from "@/lib/supabase/server";
import { normalizeSlugInput } from "@/lib/slug";

export type LoadedEntry = {
  entry: Record<string, unknown> | null;
  error: string | null;
  suggestions: string[];
  redirectTo?: string;
};

/** Resolve article by slug with normalize + unique fuzzy fallback. */
export async function loadEntryBySlug(slug: string): Promise<LoadedEntry> {
  const supabase = await createClient();
  let decoded = slug;
  let raw = slug;
  try {
    decoded = normalizeSlugInput(slug);
    raw = decodeURIComponent(slug).trim();
  } catch {
    decoded = slug.trim().replace(/[_\s]+/g, "-");
    raw = slug.trim();
  }

  for (const candidate of Array.from(new Set([decoded, raw]))) {
    const exact = await supabase
      .from("articles")
      .select("*, categories(id, name, slug)")
      .eq("slug", candidate)
      .maybeSingle();

    if (exact.error) {
      return {
        entry: null,
        error: exact.error.message,
        suggestions: [],
      };
    }
    if (exact.data) {
      return { entry: exact.data, error: null, suggestions: [] };
    }
  }

  const prefix = decoded.split("-")[0] || decoded;
  const safeDecoded = decoded.replace(/[%(),]/g, "");
  const safePrefix = prefix.replace(/[%(),]/g, "");
  const fuzzy = await supabase
    .from("articles")
    .select("slug, title")
    .or(
      `slug.ilike.%${safeDecoded}%,slug.ilike.${safePrefix}-%,title.ilike.%${safePrefix}%`,
    )
    .limit(8);

  const suggestions = (fuzzy.data ?? []).map((row) => row.slug);

  if (suggestions.length === 1) {
    const only = await supabase
      .from("articles")
      .select("*, categories(id, name, slug)")
      .eq("slug", suggestions[0])
      .maybeSingle();
    if (only.data) {
      return {
        entry: only.data,
        error: null,
        suggestions,
        redirectTo: suggestions[0],
      };
    }
  }

  return { entry: null, error: null, suggestions };
}
