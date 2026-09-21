import { redirect } from "next/navigation";
import { CategoryManager } from "@/components/CategoryManager";
import { getCurrentProfile, getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canEdit, type Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin/categories");

  const profile = await getCurrentProfile();
  if (!canEdit(profile?.role)) redirect("/");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <p className="hud-label">Taxonomy</p>
        <h1 className="font-display text-3xl font-bold text-foreground">
          管理分类
        </h1>
        <p className="mt-2 text-sm text-muted">
          分类类似游戏百科的「角色 / 装备 / 道具」。词条挂在分类下浏览。
        </p>
      </div>
      {error ? (
        <p className="text-danger">{error.message}</p>
      ) : (
        <CategoryManager categories={(data ?? []) as Category[]} />
      )}
    </div>
  );
}
