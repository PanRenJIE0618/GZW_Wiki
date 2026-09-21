/** Normalize user-typed slugs: decode, trim, unify separators. */
export function normalizeSlugInput(raw: string): string {
  return decodeURIComponent(raw)
    .trim()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-");
}

export function slugify(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return base || `article-${Date.now().toString(36)}`;
}

export function uniqueSlug(title: string): string {
  const base = slugify(title);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}
