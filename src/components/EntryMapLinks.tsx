import Link from "next/link";
import { PendingLinkLabel } from "@/components/PendingLinkLabel";
import type { MapMarkerWithMap } from "@/lib/types";

export function EntryMapLinks({ markers }: { markers: MapMarkerWithMap[] }) {
  if (markers.length === 0) return null;

  return (
    <section className="panel overflow-hidden">
      <div className="panel-title px-3 py-2">
        <p className="hud-label">Linked Coordinates</p>
        <h2 className="title-name text-base">地图点位</h2>
      </div>
      <ul className="divide-y divide-border">
        {markers.map((marker) => (
          <li key={marker.id}>
            <Link
              href={
                marker.maps
                  ? `/map?marker=${marker.id}`
                  : "/map"
              }
              className="flex items-center gap-3 px-3 py-3 transition hover:bg-accent/5"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: marker.color || "#9def4a" }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-foreground">
                  <PendingLinkLabel pendingLabel={marker.title}>
                    {marker.title}
                  </PendingLinkLabel>
                </div>
                <div className="meta-row mt-0.5">
                  <span>{marker.maps?.name ?? "未知地图"}</span>
                  <span className="meta-sep" />
                  <span>
                    {Number(marker.x).toFixed(1)}%, {Number(marker.y).toFixed(1)}%
                  </span>
                </div>
              </div>
              <span className="font-mono text-accent">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
