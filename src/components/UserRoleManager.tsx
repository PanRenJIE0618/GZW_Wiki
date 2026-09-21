"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/lib/types";
import { useRouter } from "next/navigation";

type UserRoleManagerProps = {
  users: Profile[];
  currentUserId: string;
};

export function UserRoleManager({
  users,
  currentUserId,
}: UserRoleManagerProps) {
  const router = useRouter();
  const [rows, setRows] = useState(users);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function updateRole(id: string, role: UserRole) {
    setSavingId(id);
    setError(null);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ role })
        .eq("id", id);
      if (updateError) throw updateError;
      setRows((prev) =>
        prev.map((u) => (u.id === id ? { ...u, role } : u)),
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失败");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="panel-title text-muted">
            <tr>
              <th className="px-3 py-2 font-mono text-xs uppercase tracking-wider">
                Operator
              </th>
              <th className="px-3 py-2 font-mono text-xs uppercase tracking-wider">
                Clearance
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((user) => (
              <tr key={user.id} className="border-t border-border">
                <td className="px-3 py-2">
                  {user.display_name || user.id.slice(0, 8)}
                  {user.id === currentUserId && (
                    <span className="ml-2 font-mono text-xs text-accent">(YOU)</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <select
                    className="select max-w-[10rem]"
                    value={user.role}
                    disabled={savingId === user.id}
                    onChange={(e) =>
                      updateRole(user.id, e.target.value as UserRole)
                    }
                  >
                    <option value="viewer">viewer</option>
                    <option value="editor">editor</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
