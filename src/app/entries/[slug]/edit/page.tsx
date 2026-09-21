import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArticleEditor } from "@/components/ArticleEditor";
import { getCurrentProfile, getSessionUser } from "@/lib/auth";
import { loadEntryBySlug } from "@/lib/entries";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  canEdit,
  normalizeGallery,
  normalizeParams,
  type Article,
  type Category,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditEntryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!hasSupabaseEnv()) notFound();

  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/entries/${encodeURIComponent(slug)}/edit`);
  }

  const profile = await getCurrentProfile();
  if (!canEdit(profile?.role)) {
    redirect(`/entries/${encodeURIComponent(slug)}`);
  }

  const loaded = await loadEntryBySlug(slug);
  let decodedSlug = slug;
  try {
    decodedSlug = decodeURIComponent(slug);
  } catch {
    decodedSlug = slug;
  }

  if (loaded.redirectTo && loaded.redirectTo !== decodedSlug) {
    redirect(`/entries/${loaded.redirectTo}/edit`);
  }

  if (loaded.error) {
    return (
      <div className="panel mx-auto max-w-lg space-y-3 p-6">
        <p className="hud-label">Query Fault</p>
        <h1 className="title-name title-name-md text-warn">词条加载失败</h1>
        <p className="font-mono text-xs text-muted">{loaded.error}</p>
        <Link href="/" className="btn btn-primary inline-flex">
          返回首页
        </Link>
      </div>
    );
  }

  if (!loaded.entry) {
    return (
      <div className="panel mx-auto max-w-lg space-y-4 p-6">
        <p className="hud-label">Signal Lost</p>
        <h1 className="title-name title-name-md">未找到词条</h1>
        <p className="text-sm text-muted">
          无法编辑 <code className="text-accent">{decodedSlug}</code>
        </p>
        {loaded.suggestions.length > 0 && (
          <ul className="space-y-1 text-left">
            <li className="hud-label">相近词条</li>
            {loaded.suggestions.map((s) => (
              <li key={s}>
                <Link
                  href={`/entries/${s}/edit`}
                  className="text-sm text-accent underline"
                >
                  {s}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          <Link href="/" className="btn btn-primary">
            返回首页
          </Link>
          <Link href="/entries/new" className="btn btn-ghost">
            新建词条
          </Link>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });

  const data = loaded.entry;
  const article = {
    ...data,
    params: normalizeParams(data.params),
    gallery: normalizeGallery(data.gallery),
    summary: (data.summary as string | null) ?? "",
  } as Article;

  return (
    <div className="space-y-6">
      <div>
        <p className="hud-label">Revise</p>
        <h1 className="font-display text-3xl font-bold text-foreground">
          编辑词条
        </h1>
      </div>
      <ArticleEditor
        article={article}
        authorId={user.id}
        categories={(categories ?? []) as Category[]}
      />
    </div>
  );
}
