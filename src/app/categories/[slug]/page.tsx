import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { normalizeSlugInput } from "@/lib/slug";
import { canEdit, type Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  if (!hasSupabaseEnv()) {
    return (
      <div className="panel p-6 text-warn">尚未配置 Supabase</div>
    );
  }

  const { slug: rawSlug } = await params;
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const slug = normalizeSlugInput(rawSlug);
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  let { data: category, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  // Try original decoded slug if normalization changed it
  if (!category && slug !== decodeURIComponent(rawSlug).trim()) {
    const retry = await supabase
      .from("categories")
      .select("*")
      .eq("slug", decodeURIComponent(rawSlug).trim())
      .maybeSingle();
    category = retry.data;
    error = retry.error;
  }

  // Fuzzy suggestions
  let suggestions: { slug: string; name: string }[] = [];
  if (!category) {
    const prefix = slug.split("-")[0] || slug;
    const fuzzy = await supabase
      .from("categories")
      .select("slug, name")
      .or(`slug.ilike.%${prefix}%,name.ilike.%${prefix}%`)
      .limit(8);
    suggestions = fuzzy.data ?? [];

    if (suggestions.length === 1) {
      redirect(`/categories/${suggestions[0].slug}`);
    }

    // underscore/hyphen near-match among all categories
    const all = await supabase.from("categories").select("slug, name").limit(50);
    const normalizedTarget = slug.replace(/_/g, "-");
    const near = (all.data ?? []).filter(
      (c) => c.slug.replace(/_/g, "-") === normalizedTarget || c.slug === slug,
    );
    if (near.length === 1) {
      redirect(`/categories/${near[0].slug}`);
    }
    if (near.length > 1) {
      suggestions = near;
    }
  }

  if (error) {
    return (
      <div className="panel mx-auto max-w-lg space-y-3 p-6">
        <p className="hud-label">Query Fault</p>
        <h1 className="title-name title-name-md text-warn">分类加载失败</h1>
        <p className="font-mono text-xs text-muted">{error.message}</p>
        <Link href="/" className="btn btn-primary inline-flex">
          返回首页
        </Link>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="panel mx-auto max-w-lg space-y-4 p-6 text-center">
        <p className="hud-label">Signal Lost</p>
        <h1 className="title-name title-name-md">未找到分类</h1>
        <p className="text-sm text-muted">
          没有 slug 为 <code className="text-accent">{slug}</code> 的分类。
          <br />
          <span className="text-xs">
            注意：系统使用连字符 <code className="text-accent">-</code>，不是下划线{" "}
            <code className="text-accent">_</code>
          </span>
        </p>
        {suggestions.length > 0 && (
          <div className="space-y-2 text-left">
            <p className="hud-label">可能是这些？</p>
            <ul className="space-y-1">
              {suggestions.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/categories/${s.slug}`}
                    className="text-sm text-accent underline"
                  >
                    {s.name} — /categories/{s.slug}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Link href="/" className="btn btn-primary">
            返回首页
          </Link>
          <Link href="/admin/categories" className="btn btn-ghost">
            管理分类
          </Link>
        </div>
      </div>
    );
  }

  // Canonical redirect if user used underscores etc.
  if (category.slug !== decodeURIComponent(rawSlug).trim()) {
    redirect(`/categories/${category.slug}`);
  }

  const cat = category as Category;

  let request = supabase
    .from("articles")
    .select("id, title, slug, summary, cover_url, status, updated_at")
    .eq("category_id", cat.id)
    .order("title", { ascending: true });

  if (!canEdit(profile?.role)) {
    request = request.eq("status", "published");
  }

  if (query) {
    request = request.or(
      `title.ilike.%${query}%,summary.ilike.%${query}%`,
    );
  }

  const { data: entries } = await request;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="space-y-3">
        <p className="font-mono text-xs text-muted">
          <Link href="/" className="hover:text-accent">
            INDEX
          </Link>
          <span className="mx-2 text-border-strong">/</span>
          <span className="text-accent">{cat.name}</span>
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="section-rule">
              <p className="hud-label shrink-0">Category Archive</p>
            </div>
            <h1 className="title-name title-name-lg">{cat.name}</h1>
            {cat.description && (
              <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
                {cat.description}
              </p>
            )}
            <div className="meta-row mt-3">
              <span>/{cat.slug}</span>
              <span className="meta-sep" />
              <span>{(entries ?? []).length} 条档案</span>
              {query && (
                <>
                  <span className="meta-sep" />
                  <span className="text-accent">检索：{query}</span>
                </>
              )}
            </div>
          </div>
          {canEdit(profile?.role) && (
            <Link
              href={`/entries/new?category=${cat.slug}`}
              className="btn btn-primary self-start"
            >
              在此分类新建
            </Link>
          )}
        </div>
      </div>

      <form
        className="panel flex flex-col gap-2 p-3 sm:flex-row sm:items-center"
        action={`/categories/${cat.slug}`}
        method="get"
      >
        <input
          name="q"
          defaultValue={query}
          placeholder={`在「${cat.name}」中搜索词条…`}
          className="input flex-1"
        />
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary">
            搜索
          </button>
          {query && (
            <Link href={`/categories/${cat.slug}`} className="btn btn-ghost">
              清除
            </Link>
          )}
        </div>
      </form>

      <ul className="panel divide-y divide-border overflow-hidden">
        {(entries ?? []).map((entry) => (
          <li key={entry.id}>
            <Link
              href={`/entries/${entry.slug}`}
              className="flex items-center gap-3 px-3 py-3 transition hover:bg-accent/5 sm:gap-4 sm:px-4"
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden border border-border bg-panel-2">
                {entry.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.cover_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="title-name truncate text-base sm:text-lg">
                    {entry.title}
                  </h2>
                  {entry.status === "draft" && (
                    <span className="badge">Draft</span>
                  )}
                </div>
                <p className="truncate text-sm text-muted">
                  {entry.summary || "暂无简介"}
                </p>
              </div>
              <span className="hidden font-mono text-accent sm:inline">›</span>
            </Link>
          </li>
        ))}
      </ul>

      {(entries ?? []).length === 0 && (
        <p className="text-sm text-muted">
          {query
            ? `在「${cat.name}」中没有匹配「${query}」的词条。`
            : "该分类下还没有词条。"}
        </p>
      )}
    </div>
  );
}
