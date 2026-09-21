import type { ArticleContributor } from "@/lib/types";

export function ContributorsPanel({
  contributors,
  updatedAt,
  lastEditorName,
}: {
  contributors: ArticleContributor[];
  updatedAt: string;
  lastEditorName: string | null;
}) {
  const totalPoints = contributors.reduce((sum, c) => sum + c.points, 0);

  return (
    <section className="panel overflow-hidden">
      <div className="panel-title px-3 py-2">
        <p className="hud-label">Contributors</p>
        <h2 className="font-display text-base text-accent">贡献档案</h2>
      </div>

      <div className="space-y-2 border-b border-border px-3 py-3 font-mono text-xs text-muted">
        <div className="flex justify-between gap-3">
          <span>最后修改</span>
          <span className="text-foreground">
            {new Date(updatedAt).toLocaleString("zh-CN")}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span>最近编辑者</span>
          <span className="text-accent">{lastEditorName ?? "—"}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>词条总贡献值</span>
          <span className="text-warn">{totalPoints}</span>
        </div>
      </div>

      <ul className="divide-y divide-border">
        {contributors.length === 0 && (
          <li className="px-3 py-4 text-center font-mono text-xs text-muted">
            NO CONTRIBUTORS
          </li>
        )}
        {contributors.map((c, index) => (
          <li
            key={c.id}
            className="flex items-center justify-between gap-3 px-3 py-2.5"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[0.65rem] text-muted">
                  #{String(index + 1).padStart(2, "0")}
                </span>
                <span className="truncate font-display text-sm text-foreground">
                  {c.profiles?.display_name ?? c.user_id.slice(0, 8)}
                </span>
              </div>
              <p className="mt-0.5 font-mono text-[0.65rem] text-muted">
                编辑 {c.edit_count} 次 ·{" "}
                {new Date(c.last_contributed_at).toLocaleString("zh-CN")}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-mono text-sm text-accent">+{c.points}</div>
              <div className="font-mono text-[0.65rem] text-muted">
                总 {c.profiles?.contribution_points ?? 0}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
