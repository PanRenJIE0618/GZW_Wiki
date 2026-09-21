import { redirect } from "next/navigation";
import { ArticleEditor } from "@/components/ArticleEditor";
import { getCurrentProfile, getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canEdit, type Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/entries/new");

  const profile = await getCurrentProfile();
  if (!canEdit(profile?.role)) redirect("/");

  const { category: categorySlug } = await searchParams;
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });

  const list = (categories ?? []) as Category[];
  const defaultCategoryId =
    list.find((c) => c.slug === categorySlug)?.id ?? list[0]?.id ?? null;

  if (list.length === 0) {
    return (
      <div className="panel space-y-3 border-warn/40 p-5 text-warn">
        <h1 className="font-display text-xl text-accent">请先创建分类</h1>
        <p className="text-sm text-muted">
          词条必须归属某个分类。请先到「管理分类」创建。
        </p>
        <a href="/admin/categories" className="text-accent underline">
          去管理分类
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="hud-label">Compose</p>
        <h1 className="font-display text-3xl font-bold text-foreground">
          新建词条
        </h1>
      </div>
      <ArticleEditor
        authorId={user.id}
        categories={list}
        defaultCategoryId={defaultCategoryId}
      />
    </div>
  );
}
