import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getSessionUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import {
  canEdit,
  type MapLayer,
  type MapLayerPoint,
  type MapLayerWithPoints,
  type MapMarker,
  type WikiMap,
} from "@/lib/types";
import { MapViewerClient } from "@/components/MapViewerClient";
import { MapCreateForm } from "@/components/MapCreateForm";

type LayerRow = MapLayer & {
  map_layer_points?: MapLayerPoint[] | null;
  articles?: MapLayerWithPoints["articles"];
};

function normalizeMapLayers(
  rows: LayerRow[] | null | undefined,
): MapLayerWithPoints[] {
  if (!rows) return [];
  return rows.map((row) => {
    const { map_layer_points, ...rest } = row;
    const points = [...(map_layer_points ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    return { ...rest, points };
  });
}

export const dynamic = "force-dynamic";

async function getWorldMap() {
  const supabase = await createClient();

  const bySlug = await supabase
    .from("maps")
    .select("*")
    .eq("slug", "world")
    .maybeSingle();

  if (bySlug.data) return bySlug.data as WikiMap;

  const latest = await supabase
    .from("maps")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (latest.data as WikiMap | null) ?? null;
}

export default async function WorldMapPage({
  searchParams,
}: {
  searchParams: Promise<{ marker?: string; layer?: string; point?: string }>;
}) {
  if (!hasSupabaseEnv()) {
    return <div className="panel p-6 text-warn">尚未配置 Supabase</div>;
  }

  const {
    marker: markerId,
    layer: layerId,
    point: pointId,
  } = await searchParams;
  const profile = await getCurrentProfile();
  const user = await getSessionUser();
  const supabase = await createClient();
  const wikiMap = await getWorldMap();

  if (!wikiMap) {
    if (!canEdit(profile?.role) || !user) {
      return (
        <div className="panel space-y-3 p-6">
          <p className="hud-label">World Map</p>
          <h1 className="title-name title-name-md">总图尚未配置</h1>
          <p className="text-sm text-muted">
            请联系编辑上传一张世界/战区总图。
          </p>
          {!user && (
            <Link href="/login?next=/map" className="btn btn-primary inline-flex">
              登录
            </Link>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <div className="section-rule">
            <p className="hud-label shrink-0">World Map Setup</p>
          </div>
          <h1 className="title-name title-name-lg">配置总图</h1>
          <p className="mt-2 text-sm text-muted">
            只需一张总图。上传后可缩放浏览、标点，并与词条双向关联。
          </p>
        </div>
        <MapCreateForm authorId={user.id} forceWorldSlug />
      </div>
    );
  }

  if (wikiMap.status !== "published" && !canEdit(profile?.role)) {
    return (
      <div className="panel p-6 text-muted">总图尚未发布。</div>
    );
  }

  const [{ data: markers }, { data: entries }, layerQuery] = await Promise.all([
    supabase
      .from("map_markers")
      .select("*, articles(id, title, slug, cover_url, summary)")
      .eq("map_id", wikiMap.id)
      .order("created_at", { ascending: true }),
    canEdit(profile?.role)
      ? supabase
          .from("articles")
          .select("id, title, slug")
          .order("title", { ascending: true })
          .limit(500)
      : supabase
          .from("articles")
          .select("id, title, slug")
          .eq("status", "published")
          .order("title", { ascending: true })
          .limit(500),
    supabase
      .from("map_layers")
      .select("*, map_layer_points(*), articles(id, title, slug)")
      .eq("map_id", wikiMap.id)
      .order("sort_order", { ascending: true }),
  ]);

  const layers = layerQuery.error
    ? []
    : normalizeMapLayers(layerQuery.data as LayerRow[] | null);
  const layersLoadError = layerQuery.error ? "图层暂不可用" : null;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="section-rule">
          <p className="hud-label shrink-0">World Map</p>
        </div>
        <h1 className="title-name title-name-lg">{wikiMap.name}</h1>
        {wikiMap.description && (
          <p className="text-sm text-muted">{wikiMap.description}</p>
        )}
        <div className="meta-row">
          <span>总图</span>
          <span className="meta-sep" />
          <span>{(markers ?? []).length} 个点位</span>
          <span className="meta-sep" />
          <span>
            {wikiMap.status === "published" ? "PUBLISHED" : "DRAFT"}
          </span>
        </div>
      </div>

      <MapViewerClient
        map={wikiMap}
        initialMarkers={(markers ?? []) as MapMarker[]}
        entryOptions={entries ?? []}
        canEdit={canEdit(profile?.role)}
        currentUserId={user?.id ?? null}
        initialSelectedMarkerId={markerId ?? null}
        layers={layers}
        initialLayerId={layerId ?? null}
        initialLayerPointId={pointId ?? null}
        layersLoadError={layersLoadError}
      />
    </div>
  );
}
