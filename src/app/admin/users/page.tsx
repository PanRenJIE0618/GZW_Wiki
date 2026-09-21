import { redirect } from "next/navigation";
import { UserRoleManager } from "@/components/UserRoleManager";
import { getCurrentProfile, getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, type Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin/users");

  const profile = await getCurrentProfile();
  if (!isAdmin(profile?.role)) redirect("/");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <p className="hud-label">Personnel</p>
        <h1 className="font-display text-3xl font-bold text-foreground">
          用户与角色
        </h1>
        <p className="mt-2 text-sm text-muted">
          admin 可改角色；editor 可写词条；viewer 只读。
        </p>
      </div>
      {error ? (
        <p className="text-danger">{error.message}</p>
      ) : (
        <UserRoleManager
          users={(data ?? []) as Profile[]}
          currentUserId={user.id}
        />
      )}
    </div>
  );
}
