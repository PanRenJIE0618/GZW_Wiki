import type { EntryParam } from "@/lib/types";

export function EntryInfobox({
  title,
  coverUrl,
  params,
}: {
  title: string;
  coverUrl: string | null;
  params: EntryParam[];
}) {
  return (
    <aside className="panel overflow-hidden">
      <div className="panel-title px-3 py-2 text-center">
        <div className="hud-label mb-1">Intel Dossier</div>
        <div className="font-display text-base font-semibold tracking-[0.08em] text-accent">
          {title}
        </div>
      </div>
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt={title}
          className="aspect-[4/3] w-full border-b border-border object-cover"
        />
      )}
      {params.length > 0 ? (
        <table className="w-full text-sm">
          <tbody>
            {params.map((param, index) => (
              <tr key={`${param.label}-${index}`} className="border-t border-border">
                <th className="w-[40%] bg-panel-2 px-3 py-2 text-left font-mono text-[0.7rem] font-medium uppercase tracking-wider text-muted">
                  {param.label || "—"}
                </th>
                <td className="px-3 py-2 text-foreground">{param.value || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="px-3 py-4 text-center font-mono text-xs text-muted">
          NO PARAMS LOADED
        </p>
      )}
    </aside>
  );
}
