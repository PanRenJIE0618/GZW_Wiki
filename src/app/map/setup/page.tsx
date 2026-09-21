import { redirect } from "next/navigation";
import { MapCreateForm } from "@/components/MapCreateForm";
import { getCurrentProfile, getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canEdit, type WikiMap } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MapSetupPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/map/setup");

  const profile = await getCurrentProfile();
  if (!canEdit(profile?.role)) redirect("/map");

  const supabase = await createClient();
  const bySlug = await supabase
    .from("maps")
    .select("*")
    .eq("slug", "world")
    .maybeSingle();

  let existing = (bySlug.data as WikiMap | null) ?? null;
  if (!existing) {
    const latest = await supabase
      .from("maps")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    existing = (latest.data as WikiMap | null) ?? null;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="section-rule">
          <p className="hud-label shrink-0">Map Setup</p>
        </div>
        <h1 className="title-name title-name-lg">
          {existing ? "更换总图底图" : "配置世界总图"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          站点只维护一张总图。可缩放浏览、标点，并与词条双向关联。更换底图不会删除已有点位（建议比例相近）。
        </p>
      </div>
      <MapCreateForm
        authorId={user.id}
        forceWorldSlug
        existingMap={existing}
      />
    </div>
  );
}
