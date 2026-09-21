import Link from "next/link";
import { PendingLinkLabel } from "@/components/PendingLinkLabel";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { canEdit, type Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  if (!hasSupabaseEnv()) {
    return (
      <div className="panel space-y-3 p-5 text-warn">
        <h1 className="title-name title-name-md text-accent">尚未配置 Supabase</h1>
        <p className="text-sm text-muted">
          复制 <code className="text-accent">.env.example</code> 为{" "}
          <code className="text-accent">.env.local</code>，并执行 migrations。见{" "}
          <code className="text-accent">DEPLOY.md</code>。
        </p>
      </div>
    );
  }

  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: categories, error: catError } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  let entryRequest = supabase
    .from("articles")
    .select(
      "id, title, slug, summary, cover_url, status, category_id, categories(name, slug)",
    )
    .order("updated_at", { ascending: false })
    .limit(24);

  if (!canEdit(profile?.role)) {
    entryRequest = entryRequest.eq("status", "published");
  }
  if (query) {
    entryRequest = entryRequest.ilike("title", `%${query}%`);
  }

  const { data: entries, error: entryError } = await entryRequest;
  const categoryList = (categories ?? []) as Category[];

  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="panel relative overflow-hidden p-5 sm:p-7">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_70%_30%,rgba(157,239,74,0.12),transparent_60%)]" />
        <p className="hud-label mb-2">Field Manual // Index</p>
        <h1 className="title-name title-name-lg">GZWWiki</h1>
        <div className="meta-row mt-3">
          <span>分类归档</span>
          <span className="meta-sep" />
          <span>词条档案</span>
          <span className="meta-sep" />
          <span>参数 / 图集 / 详述</span>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-muted sm:text-base">
          战术情报库：按分类浏览词条，查看属性参数与图集资料。
        </p>
        <form className="mt-5 flex flex-col gap-2 sm:flex-row" action="/" method="get">
          <input
            name="q"
            defaultValue={query}
            placeholder="搜索词条名称…"
            className="input sm:max-w-md"
          />
          <button type="submit" className="btn btn-primary">
            检索
          </button>
        </form>
      </section>

      {(catError || entryError) && (
        <div className="panel border-warn/40 p-4 text-sm text-warn">
          数据加载失败。请确认已执行{" "}
          <code className="text-accent">004_game_wiki_categories.sql</code>。
          <div className="mt-1 text-muted">
            {catError?.message || entryError?.message}
          </div>
        </div>
      )}

      {!query && (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="section-rule">
                <p className="hud-label shrink-0">Categories</p>
              </div>
              <h2 className="title-name title-name-md">情报分类</h2>
            </div>
            {canEdit(profile?.role) && (
              <Link href="/admin/categories" className="btn btn-ghost shrink-0 text-xs">
                管理分类
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {categoryList.map((category, index) => (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className="category-card"
              >
                <div className="category-card__media">
                  <span className="category-card__index">
                    SEC-{String(index + 1).padStart(2, "0")}
                  </span>
                  {category.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={category.cover_url}
                      alt=""
                      className="h-full w-full object-cover opacity-75 transition group-hover:opacity-100"
                    />
                  ) : (
                    <div className="flex h-full items-end justify-between p-4">
                      <span className="font-display text-4xl font-bold text-accent/70">
                        {category.name.slice(0, 1)}
                      </span>
                      <span className="font-mono text-[0.65rem] tracking-widest text-muted">
                        OPEN
                      </span>
                    </div>
                  )}
                </div>
                <div className="category-card__body">
                  <h3 className="category-card__name">
                    <PendingLinkLabel pendingLabel={category.name}>
                      {category.name}
                    </PendingLinkLabel>
                  </h3>
                  <div className="meta-row">
                    <span>/{category.slug}</span>
                    <span className="meta-sep" />
                    <span>档案区</span>
                  </div>
                  <p className="category-card__desc">
                    {category.description || "打开该分类下的词条列表"}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {!catError && categoryList.length === 0 && (
            <p className="text-sm text-muted">
              暂无分类。
              {canEdit(profile?.role) && (
                <>
                  {" "}
                  <Link href="/admin/categories" className="text-accent underline">
                    去创建
                  </Link>
                </>
              )}
            </p>
          )}
        </section>
      )}

      <section className="space-y-4">
        <div>
          <div className="section-rule">
            <p className="hud-label shrink-0">Recent Feed</p>
          </div>
          <h2 className="title-name title-name-md">
            {query ? `检索：${query}` : "最近更新"}
          </h2>
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(entries ?? []).map((entry) => {
            const category = Array.isArray(entry.categories)
              ? entry.categories[0]
              : entry.categories;
            return (
              <li key={entry.id}>
                <Link
                  href={`/entries/${entry.slug}`}
                  className="panel flex gap-3 p-3 transition hover:border-accent-dim"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden border border-border bg-panel-2">
                    {entry.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={entry.cover_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center font-mono text-xs text-muted">
                        N/A
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="title-name truncate text-base">
                        {entry.title}
                      </h3>
                      {entry.status === "draft" && (
                        <span className="badge">Draft</span>
                      )}
                    </div>
                    <div className="meta-row">
                      {category?.name && (
                        <>
                          <span className="text-accent/80">{category.name}</span>
                          <span className="meta-sep" />
                        </>
                      )}
                      <span className="line-clamp-1">
                        {entry.summary || "暂无简介"}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        {!entryError && (entries ?? []).length === 0 && (
          <p className="text-sm text-muted">暂无词条。</p>
        )}
      </section>
    </div>
  );
}
