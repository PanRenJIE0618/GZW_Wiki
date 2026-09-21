import Link from "next/link";
import { LayerIcon } from "@/components/LayerIcon";
import type { MapLayerWithPoints } from "@/lib/types";

type Props = { layers: MapLayerWithPoints[] };

const KIND_LABEL: Record<MapLayerWithPoints["kind"], string> = {
  path: "路径",
  loot: "物资",
};

function mapDeepLink(layerId: string, pointId: string) {
  return `/map?layer=${layerId}&point=${pointId}`;
}

export function EntryLayers({ layers }: Props) {
  if (layers.length === 0) return null;

  return (
    <>
      {layers.map((layer) => (
        <section key={layer.id} className="panel overflow-hidden">
          <div className="panel-title px-3 py-2">
            <p className="hud-label">Linked Layer</p>
            <div className="flex items-center gap-2">
              <LayerIcon icon={layer.icon} size={18} />
              <h2 className="title-name min-w-0 flex-1 truncate text-base">
                {layer.name}
              </h2>
            </div>
            <p className="meta-row mt-1">
              <span>{KIND_LABEL[layer.kind]}</span>
              <span className="meta-sep" />
              <span>{layer.points.length} 点</span>
              {layer.status !== "published" && (
                <>
                  <span className="meta-sep" />
                  <span className="text-warn">DRAFT</span>
                </>
              )}
            </p>
            {layer.description && (
              <p className="mt-1 text-sm text-muted">{layer.description}</p>
            )}
          </div>

          {layer.kind === "path" ? (
            <ol className="divide-y divide-border">
              {layer.points.map((point, index) => (
                <li key={point.id}>
                  <Link
                    href={mapDeepLink(layer.id, point.id)}
                    className="flex gap-3 px-3 py-3 transition hover:bg-accent/5"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-accent/40 font-mono text-xs text-accent">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="text-sm text-foreground">
                        {point.title || `步骤 ${index + 1}`}
                      </div>
                      {point.description && (
                        <p className="text-xs text-muted">{point.description}</p>
                      )}
                      {(point.image_urls ?? []).length > 0 && (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {(point.image_urls ?? []).map((url, imgIndex) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={`${url}-${imgIndex}`}
                              src={url}
                              alt={`${point.title} 图 ${imgIndex + 1}`}
                              className="aspect-square w-full border border-border object-cover"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 self-center font-mono text-accent">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <ul className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
              {layer.points.map((point, index) => (
                <li key={point.id}>
                  <Link
                    href={mapDeepLink(layer.id, point.id)}
                    className="flex h-full flex-col items-center gap-2 border border-border p-3 text-center transition hover:border-accent/40 hover:bg-accent/5"
                  >
                    <LayerIcon
                      icon={point.icon}
                      fallback={layer.icon}
                      size={24}
                    />
                    <span className="line-clamp-2 text-xs text-foreground">
                      {point.title || `物资 ${index + 1}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {layer.points.length === 0 && (
            <p className="px-3 py-4 font-mono text-xs text-muted">NO POINTS</p>
          )}
        </section>
      ))}
    </>
  );
}
