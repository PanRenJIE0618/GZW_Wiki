import { getCurrentProfile, getSessionUser } from "@/lib/auth";
import { canEdit, isAdmin } from "@/lib/types";
import { HeaderClient } from "@/components/HeaderClient";

export async function Header() {
  const user = await getSessionUser();
  const profile = user ? await getCurrentProfile() : null;

  return (
    <HeaderClient
      canEdit={canEdit(profile?.role)}
      isAdmin={isAdmin(profile?.role)}
      userLabel={
        user ? (profile?.display_name ?? user.email ?? "OPERATOR") : null
      }
      contributionPoints={
        user ? (profile?.contribution_points ?? 0) : null
      }
    />
  );
}
