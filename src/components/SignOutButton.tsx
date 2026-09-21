"use client";

import { useRouter } from "next/navigation";
import { signalNavigationStart } from "@/components/NavigationProgress";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    signalNavigationStart();
    router.refresh();
    router.push("/");
  }

  return (
    <button type="button" onClick={handleSignOut} className="btn btn-ghost px-2.5 py-1 text-xs">
      退出
    </button>
  );
}
