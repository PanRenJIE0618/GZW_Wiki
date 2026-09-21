"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ImageOverlay,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { createClient } from "@/lib/supabase/client";
import { HudLoader } from "@/components/HudLoader";
import { MapLayerSidebar } from "@/components/MapLayerSidebar";
import { MapLayersOverlay } from "@/components/MapLayersOverlay";
import type {
  LayerKind,
  MapLayer,
  MapLayerPoint,
  MapLayerWithPoints,
  MapMarker,
  WikiMap,
} from "@/lib/types";
import "leaflet/dist/leaflet.css";

type EntryOption = {
  id: string;
  title: string;
  slug: string;
};

type MapEditMode = "intel" | "layer-draw" | null;

type ZoomMapViewerProps = {
  map: WikiMap;
  initialMarkers: MapMarker[];
  entryOptions: EntryOption[];
  canEdit: boolean;
  currentUserId: string | null;
  initialSelectedMarkerId?: string | null;
  layers?: MapLayerWithPoints[];
  initialLayerId?: string | null;
  initialLayerPointId?: string | null;
  layersLoadError?: string | null;
};

type Size = { w: number; h: number };

type CoordMode =
  | { kind: "image"; size: Size }
  | { kind: "tiles"; size: Size; maxZoom: number };

function pctToLatLng(x: number, y: number, mode: CoordMode) {
  if (mode.kind === "tiles") {
    return L.CRS.Simple.pointToLatLng(
      L.point((Number(x) / 100) * mode.size.w, (Number(y) / 100) * mode.size.h),
      mode.maxZoom,
    );
  }
  return L.latLng((Number(y) / 100) * mode.size.h, (Number(x) / 100) * mode.size.w);
}

function latLngToPct(latlng: L.LatLng, mode: CoordMode) {
  if (mode.kind === "tiles") {
    const p = L.CRS.Simple.latLngToPoint(latlng, mode.maxZoom);
    return {
      x: Number(((p.x / mode.size.w) * 100).toFixed(3)),
      y: Number(((p.y / mode.size.h) * 100).toFixed(3)),
    };
  }
  return {
    x: Number(((latlng.lng / mode.size.w) * 100).toFixed(3)),
    y: Number(((latlng.lat / mode.size.h) * 100).toFixed(3)),
  };
}

function markerIcon(color: string, active: boolean) {
  const size = active ? 18 : 14;
  return L.divIcon({
    className: "gzw-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="
      display:block;width:${size}px;height:${size}px;border-radius:999px;
      background:${color || "#9def4a"};
      border:2px solid #070a08;
      box-shadow:0 0 12px rgba(157,239,74,.55);
      ${active ? "outline:2px solid rgba(255,255,255,.75);" : ""}
    "></span>`,
  });
}

function MapClickHandler({
  enabled,
  mode,
  onPlace,
}: {
  enabled: boolean;
  mode: CoordMode;
  onPlace: (x: number, y: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      const pct = latLngToPct(e.latlng, mode);
      if (pct.x < 0 || pct.x > 100 || pct.y < 0 || pct.y > 100) return;
      onPlace(pct.x, pct.y);
    },
  });
  return null;
}

function resolveInitialLayerSelection(
  layers: MapLayerWithPoints[],
  layerId: string | null,
  pointId: string | null,
): { layerId: string | null; pointId: string | null } {
  if (pointId) {
    const owner = layers.find((layer) =>
      layer.points.some((point) => point.id === pointId),
    );
    if (owner && (!layerId || owner.id === layerId)) {
      return { layerId: owner.id, pointId };
    }
  }
  if (layerId && layers.some((layer) => layer.id === layerId)) {
    return { layerId, pointId: null };
  }
  return { layerId: null, pointId: null };
}

function initialVisibleLayerIds(
  layers: MapLayerWithPoints[],
  selectedLayerId: string | null,
): Set<string> {
  const ids = new Set(
    layers.filter((layer) => layer.status === "published").map((layer) => layer.id),
  );
  if (selectedLayerId) ids.add(selectedLayerId);
  return ids;
}

function FlyToMarker({
  marker,
  mode,
}: {
  marker: { id?: string; x: number; y: number } | null;
  mode: CoordMode;
}) {
  const map = useMap();
  const markerId = marker?.id;
  const markerX = marker?.x;
  const markerY = marker?.y;
  useEffect(() => {
    if (markerX == null || markerY == null) return;
    const targetZoom =
      mode.kind === "tiles"
        ? Math.min(Math.max(map.getZoom(), mode.maxZoom - 1), mode.maxZoom)
        : Math.max(map.getZoom(), 0);
    map.flyTo(pctToLatLng(markerX, markerY, mode), targetZoom, {
      duration: 0.45,
    });
  }, [markerId, markerX, markerY, map, mode]);
  return null;
}

function FitBoundsOnce({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { animate: false, padding: [12, 12] });
  }, [map, bounds]);
  return null;
}

function InitialLayerPointFlyTo({
  pointId,
  layers,
  mode,
  bounds,
}: {
  pointId: string | null;
  layers: MapLayerWithPoints[];
  mode: CoordMode;
  bounds: L.LatLngBoundsExpression;
}) {
  const map = useMap();
  const settledRef = useRef(false);
  useEffect(() => {
    if (!pointId || settledRef.current) return;
    let target: MapLayerPoint | null = null;
    for (const layer of layers) {
      const found = layer.points.find((p) => p.id === pointId);
      if (found) {
        target = found;
        break;
      }
    }
    if (!target) {
      settledRef.current = true;
      map.fitBounds(bounds, { animate: false, padding: [12, 12] });
      return;
    }
    settledRef.current = true;
    const targetZoom =
      mode.kind === "tiles"
        ? Math.min(Math.max(map.getZoom(), mode.maxZoom - 1), mode.maxZoom)
        : Math.max(map.getZoom(), 0);
    const timer = window.setTimeout(() => {
      map.flyTo(pctToLatLng(target!.x, target!.y, mode), targetZoom, {
        duration: 0.45,
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pointId, layers, map, mode, bounds]);
  return null;
}

export function ZoomMapViewer({
  map,
  initialMarkers,
  entryOptions,
  canEdit,
  currentUserId,
  initialSelectedMarkerId = null,
  layers: initialLayers = [],
  initialLayerId = null,
  initialLayerPointId = null,
  layersLoadError = null,
}: ZoomMapViewerProps) {
  const router = useRouter();
  const tilesEnabled = Boolean(
    map.tile_url_template &&
      map.image_width &&
      map.image_height &&
      map.tile_max_zoom != null,
  );
  const initialDeepLink = resolveInitialLayerSelection(
    initialLayers,
    initialLayerId,
    initialLayerPointId,
  );
  const initialDeepLinkPointIdRef = useRef(initialDeepLink.pointId);

  const [imageSize, setImageSize] = useState<Size | null>(
    map.image_width && map.image_height
      ? { w: map.image_width, h: map.image_height }
      : null,
  );
  const [markers, setMarkers] = useState(initialMarkers);
  const [layers, setLayers] = useState(initialLayers);
  const [visibleLayerIds, setVisibleLayerIds] = useState(() =>
    initialVisibleLayerIds(initialLayers, initialDeepLink.layerId),
  );
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(
    initialDeepLink.layerId,
  );
  const [selectedLayerPointId, setSelectedLayerPointId] = useState<string | null>(
    initialDeepLink.pointId,
  );
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (
      initialSelectedMarkerId &&
      initialMarkers.some((m) => m.id === initialSelectedMarkerId)
    ) {
      return initialSelectedMarkerId;
    }
    if (initialDeepLink.layerId || initialDeepLink.pointId) {
      return null;
    }
    return initialMarkers[0]?.id ?? null;
  });
  const [editMode, setEditMode] = useState<MapEditMode>(null);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [draftArticleId, setDraftArticleId] = useState("");
  const [draftColor, setDraftColor] = useState("#9def4a");
  const [pendingPoint, setPendingPoint] = useState<{ x: number; y: number } | null>(
    null,
  );

  useEffect(() => {
    if (tilesEnabled) {
      setImageSize({ w: map.image_width!, h: map.image_height! });
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      setImageSize({
        w: img.naturalWidth || 2000,
        h: img.naturalHeight || 2000,
      });
    };
    img.onerror = () => setImageSize({ w: 2000, h: 2000 });
    img.src = map.image_url;
  }, [map.image_url, map.image_width, map.image_height, tilesEnabled]);

  const mode: CoordMode | null = useMemo(() => {
    if (!imageSize) return null;
    if (tilesEnabled) {
      return {
        kind: "tiles",
        size: imageSize,
        maxZoom: map.tile_max_zoom ?? 0,
      };
    }
    return { kind: "image", size: imageSize };
  }, [imageSize, tilesEnabled, map.tile_max_zoom]);

  const bounds = useMemo(() => {
    if (!mode) return null;
    if (mode.kind === "tiles") {
      const sw = L.CRS.Simple.pointToLatLng(
        L.point(0, mode.size.h),
        mode.maxZoom,
      );
      const ne = L.CRS.Simple.pointToLatLng(
        L.point(mode.size.w, 0),
        mode.maxZoom,
      );
      return L.latLngBounds(sw, ne);
    }
    return L.latLngBounds([
      [0, 0],
      [mode.size.h, mode.size.w],
    ]);
  }, [mode]);

  const selected = useMemo(
    () => markers.find((m) => m.id === selectedId) ?? null,
    [markers, selectedId],
  );

  const selectedLayerPoint = useMemo(() => {
    if (!selectedLayerPointId) return null;
    for (const layer of layers) {
      const point = layer.points.find((p) => p.id === selectedLayerPointId);
      if (point) return point;
    }
    return null;
  }, [layers, selectedLayerPointId]);

  const ensureLayerVisible = useCallback((layerId: string) => {
    setVisibleLayerIds((prev) => {
      if (prev.has(layerId)) return prev;
      const next = new Set(prev);
      next.add(layerId);
      return next;
    });
  }, []);

  const selectIntelMarker = useCallback((markerId: string) => {
    setSelectedId(markerId);
    setSelectedLayerId(null);
    setSelectedLayerPointId(null);
    setPendingPoint(null);
    setEditMode(null);
    setActiveLayerId(null);
  }, []);

  const selectLayerPoint = useCallback(
    (layerId: string, pointId: string) => {
      setSelectedLayerId(layerId);
      setSelectedLayerPointId(pointId);
      setSelectedId(null);
      setPendingPoint(null);
      ensureLayerVisible(layerId);
    },
    [ensureLayerVisible],
  );

  const selectLayer = useCallback(
    (layerId: string) => {
      setSelectedId(null);
      setSelectedLayerId(layerId);
      setSelectedLayerPointId((prev) => {
        if (!prev) return prev;
        const layer = layers.find((row) => row.id === layerId);
        return layer?.points.some((point) => point.id === prev) ? prev : null;
      });
      if (editMode === "layer-draw") {
        setActiveLayerId(layerId);
        ensureLayerVisible(layerId);
      }
    },
    [editMode, ensureLayerVisible, layers],
  );

  const toggleLayerVisible = useCallback((layerId: string) => {
    setVisibleLayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  }, []);

  const startDraw = useCallback(
    (layerId: string) => {
      setEditMode("layer-draw");
      setActiveLayerId(layerId);
      setSelectedLayerId(layerId);
      setSelectedId(null);
      setPendingPoint(null);
      ensureLayerVisible(layerId);
    },
    [ensureLayerVisible],
  );

  const startIntel = useCallback(() => {
    setEditMode((prev) => (prev === "intel" ? null : "intel"));
    setActiveLayerId(null);
    setPendingPoint(null);
  }, []);

  const stopDraw = useCallback(() => {
    setEditMode(null);
    setActiveLayerId(null);
  }, []);

  const appendLayerPoint = useCallback(
    async (layerId: string, x: number, y: number) => {
      if (saving) return;
      const layer = layers.find((row) => row.id === layerId);
      if (!layer) return;
      const n = layer.points.length;
      setSaving(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data, error: insertError } = await supabase
          .from("map_layer_points")
          .insert({
            layer_id: layerId,
            title: layer.kind === "path" ? `步骤 ${n + 1}` : "物资点",
            description: "",
            icon: null,
            image_urls: [],
            x,
            y,
            sort_order: n,
          })
          .select("*")
          .single();
        if (insertError) throw insertError;
        const point = data as MapLayerPoint;
        setLayers((prev) =>
          prev.map((row) =>
            row.id === layerId
              ? {
                  ...row,
                  points: [...row.points, point].sort(
                    (a, b) => a.sort_order - b.sort_order,
                  ),
                }
              : row,
          ),
        );
        setSelectedLayerId(layerId);
        setSelectedLayerPointId(point.id);
        setSelectedId(null);
        ensureLayerVisible(layerId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "添加图层点失败");
      } finally {
        setSaving(false);
      }
    },
    [ensureLayerVisible, layers, router, saving],
  );

  const createLayer = useCallback(
    async (kind: LayerKind) => {
      if (!currentUserId) return;
      setSaving(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data, error: insertError } = await supabase
          .from("map_layers")
          .insert({
            map_id: map.id,
            kind,
            name: kind === "path" ? "新路径" : "新物资",
            description: "",
            color: "#9def4a",
            icon: kind === "loot" ? "crate" : "objective",
            article_id: null,
            status: "draft",
            sort_order: layers.length,
            author_id: currentUserId,
          })
          .select("*, articles(id, title, slug)")
          .single();
        if (insertError) throw insertError;
        const row = data as MapLayer & {
          articles?: MapLayerWithPoints["articles"];
        };
        const layer: MapLayerWithPoints = {
          ...row,
          points: [],
          articles: row.articles ?? null,
        };
        setLayers((prev) => [...prev, layer]);
        startDraw(layer.id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "创建图层失败");
      } finally {
        setSaving(false);
      }
    },
    [currentUserId, layers.length, map.id, router, startDraw],
  );

  const onPlace = useCallback(
    (x: number, y: number) => {
      if (editMode === "layer-draw" && activeLayerId) {
        void appendLayerPoint(activeLayerId, x, y);
        return;
      }
      setPendingPoint({ x, y });
      setDraftTitle("");
      setDraftNote("");
      setDraftArticleId("");
      setDraftColor("#9def4a");
      setSelectedId(null);
      setSelectedLayerPointId(null);
    },
    [activeLayerId, appendLayerPoint, editMode],
  );

  async function createMarker(e: FormEvent) {
    e.preventDefault();
    if (!pendingPoint || !currentUserId) return;
    if (!draftTitle.trim()) {
      setError("请填写点位名称");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from("map_markers")
        .insert({
          map_id: map.id,
          title: draftTitle.trim(),
          note: draftNote.trim(),
          x: pendingPoint.x,
          y: pendingPoint.y,
          article_id: draftArticleId || null,
          color: draftColor,
          created_by: currentUserId,
        })
        .select("*, articles(id, title, slug, cover_url, summary)")
        .single();
      if (insertError) throw insertError;
      const marker = data as MapMarker;
      setMarkers((prev) => [...prev, marker]);
      setSelectedId(marker.id);
      setPendingPoint(null);
      setEditMode(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建点位失败");
    } finally {
      setSaving(false);
    }
  }

  async function updateSelected(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from("map_markers")
        .update({
          title: selected.title.trim(),
          note: selected.note.trim(),
          article_id: selected.article_id,
          color: selected.color,
        })
        .eq("id", selected.id)
        .select("*, articles(id, title, slug, cover_url, summary)")
        .single();
      if (updateError) throw updateError;
      setMarkers((prev) =>
        prev.map((m) => (m.id === selected.id ? (data as MapMarker) : m)),
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelected() {
    if (!selected) return;
    if (!window.confirm("确定删除该点位？")) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("map_markers")
        .delete()
        .eq("id", selected.id);
      if (deleteError) throw deleteError;
      setMarkers((prev) => prev.filter((m) => m.id !== selected.id));
      setSelectedId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setSaving(false);
    }
  }

  const minZoom = tilesEnabled ? (map.tile_min_zoom ?? 0) : -3;
  const maxZoom = tilesEnabled ? (map.tile_max_zoom ?? 2) : 4;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="panel overflow-hidden">
        <div className="panel-title flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <div>
            <p className="hud-label">
              World Map // {tilesEnabled ? "Tiled" : "Image"} Zoom
            </p>
            <h2 className="title-name text-base">{map.name}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <>
                <button
                  type="button"
                  className={`btn text-xs ${editMode === "intel" ? "btn-primary" : "btn-ghost"}`}
                  onClick={startIntel}
                >
                  {editMode === "intel" ? "取消标点" : "情报点"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  className="btn btn-ghost text-xs disabled:opacity-60"
                  onClick={() => void createLayer("path")}
                >
                  新建路径
                </button>
                <button
                  type="button"
                  disabled={saving}
                  className="btn btn-ghost text-xs disabled:opacity-60"
                  onClick={() => void createLayer("loot")}
                >
                  新建物资
                </button>
                <button
                  type="button"
                  className={`btn text-xs ${editMode === "layer-draw" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => {
                    if (editMode === "layer-draw") {
                      stopDraw();
                      return;
                    }
                    if (!selectedLayerId) {
                      setError("请先在侧栏选择要编辑的图层");
                      return;
                    }
                    startDraw(selectedLayerId);
                  }}
                >
                  {editMode === "layer-draw" ? "完成绘制" : "编辑图层"}
                </button>
              </>
            )}
            {canEdit && (
              <Link href="/map/setup" className="btn btn-ghost text-xs">
                地图设置
              </Link>
            )}
          </div>
        </div>

        <div className="relative h-[min(70vh,720px)] w-full bg-[#050806]">
          {!mode || !bounds ? (
            <div className="flex h-full items-center justify-center">
              <HudLoader label="LOADING MAP" className="py-8" />
            </div>
          ) : (
            <MapContainer
              crs={L.CRS.Simple}
              center={pctToLatLng(50, 50, mode)}
              zoom={tilesEnabled ? Math.max(0, maxZoom - 2) : -1}
              minZoom={minZoom}
              maxZoom={maxZoom}
              zoomSnap={0.25}
              zoomDelta={0.5}
              style={{ height: "100%", width: "100%", background: "#050806" }}
              maxBounds={bounds}
              maxBoundsViscosity={0.85}
            >
              {!initialDeepLinkPointIdRef.current ? (
                <FitBoundsOnce bounds={bounds} />
              ) : (
                <InitialLayerPointFlyTo
                  pointId={initialDeepLinkPointIdRef.current}
                  layers={layers}
                  mode={mode}
                  bounds={bounds}
                />
              )}
              {tilesEnabled ? (
                <TileLayer
                  url={map.tile_url_template!}
                  tileSize={256}
                  minZoom={minZoom}
                  maxZoom={maxZoom}
                  maxNativeZoom={maxZoom}
                  noWrap
                  bounds={bounds}
                  attribution=""
                />
              ) : (
                <ImageOverlay url={map.image_url} bounds={bounds} />
              )}
              <MapClickHandler
                enabled={
                  canEdit &&
                  (editMode === "intel" ||
                    (editMode === "layer-draw" && Boolean(activeLayerId)))
                }
                mode={mode}
                onPlace={onPlace}
              />
              <FlyToMarker marker={selected ?? selectedLayerPoint} mode={mode} />
              <MapLayersOverlay
                layers={layers}
                visibleIds={visibleLayerIds}
                selectedPointId={selectedLayerPointId}
                onSelectPoint={selectLayerPoint}
                coordMode={mode}
              />

              {markers.map((marker) => (
                <Marker
                  key={marker.id}
                  position={pctToLatLng(marker.x, marker.y, mode)}
                  icon={markerIcon(
                    marker.color || "#9def4a",
                    selectedId === marker.id,
                  )}
                  eventHandlers={{
                    click: () => selectIntelMarker(marker.id),
                  }}
                />
              ))}

              {pendingPoint && (
                <Marker
                  position={pctToLatLng(pendingPoint.x, pendingPoint.y, mode)}
                  icon={markerIcon("#e8b84a", true)}
                  interactive={false}
                />
              )}
            </MapContainer>
          )}
        </div>

        <p className="border-t border-border px-3 py-2 font-mono text-xs text-muted">
          滚轮缩放 · 拖拽平移
          {tilesEnabled ? " · TILE STREAMING" : " · SINGLE IMAGE"}
          {" · LEGEND: INTEL · PATH · LOOT"}
          {editMode === "intel" ? " · PLACE MARKER" : ""}
          {editMode === "layer-draw" ? " · DRAW LAYER" : ""}
        </p>
      </section>

      <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
        {error && (
          <p className="border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {pendingPoint && canEdit ? (
          <form onSubmit={createMarker} className="panel space-y-3 p-3">
            <p className="hud-label">New Marker</p>
            <p className="font-mono text-xs text-muted">
              X {pendingPoint.x}% · Y {pendingPoint.y}%
            </p>
            <input
              className="input"
              placeholder="点位名称"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              required
            />
            <textarea
              className="textarea min-h-[72px]"
              placeholder="备注（可选）"
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
            />
            <label className="block space-y-1 text-sm">
              <span className="hud-label">关联词条</span>
              <select
                className="select"
                value={draftArticleId}
                onChange={(e) => setDraftArticleId(e.target.value)}
              >
                <option value="">不关联</option>
                {entryOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="hud-label">颜色</span>
              <input
                type="color"
                className="h-10 w-full cursor-pointer border border-border bg-transparent"
                value={draftColor}
                onChange={(e) => setDraftColor(e.target.value)}
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary disabled:opacity-60"
              >
                保存点位
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setPendingPoint(null)}
              >
                取消
              </button>
            </div>
          </form>
        ) : selected ? (
          <form onSubmit={updateSelected} className="panel space-y-3 p-3">
            <p className="hud-label">Marker Intel</p>
            {canEdit ? (
              <>
                <input
                  className="input"
                  value={selected.title}
                  onChange={(e) =>
                    setMarkers((prev) =>
                      prev.map((m) =>
                        m.id === selected.id
                          ? { ...m, title: e.target.value }
                          : m,
                      ),
                    )
                  }
                />
                <textarea
                  className="textarea min-h-[72px]"
                  value={selected.note}
                  onChange={(e) =>
                    setMarkers((prev) =>
                      prev.map((m) =>
                        m.id === selected.id
                          ? { ...m, note: e.target.value }
                          : m,
                      ),
                    )
                  }
                />
                <select
                  className="select"
                  value={selected.article_id ?? ""}
                  onChange={(e) =>
                    setMarkers((prev) =>
                      prev.map((m) =>
                        m.id === selected.id
                          ? { ...m, article_id: e.target.value || null }
                          : m,
                      ),
                    )
                  }
                >
                  <option value="">不关联词条</option>
                  {entryOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.title}
                    </option>
                  ))}
                </select>
                <input
                  type="color"
                  className="h-10 w-full cursor-pointer border border-border bg-transparent"
                  value={selected.color || "#9def4a"}
                  onChange={(e) =>
                    setMarkers((prev) =>
                      prev.map((m) =>
                        m.id === selected.id
                          ? { ...m, color: e.target.value }
                          : m,
                      ),
                    )
                  }
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-primary disabled:opacity-60"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    className="btn btn-danger disabled:opacity-60"
                    onClick={deleteSelected}
                  >
                    删除
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="title-name text-base">{selected.title}</h3>
                {selected.note && (
                  <p className="text-sm text-muted">{selected.note}</p>
                )}
              </>
            )}

            {selected.articles && (
              <Link
                href={`/entries/${selected.articles.slug}`}
                className="btn btn-ghost w-full text-xs"
              >
                打开词条：{selected.articles.title}
              </Link>
            )}
            <p className="font-mono text-xs text-muted">
              X {Number(selected.x).toFixed(1)}% · Y {Number(selected.y).toFixed(1)}%
            </p>
          </form>
        ) : (
          <div className="panel space-y-2 p-4 text-sm text-muted">
            <p>
              滚轮缩放、拖拽浏览总图。
              {tilesEnabled
                ? "当前为瓦片流式加载，大图更流畅。"
                : "当前为整图模式；大图建议生成瓦片。"}
            </p>
            {canEdit && editMode === "layer-draw" && (
              <p className="font-mono text-xs text-accent">
                点击地图添加
                {layers.find((layer) => layer.id === activeLayerId)?.kind ===
                "path"
                  ? "路径步骤"
                  : "物资点"}
                。
              </p>
            )}
            {!canEdit && (
              <p className="font-mono text-xs">
                {currentUserId
                  ? "浏览模式：编辑点位需 editor / admin 权限。"
                  : (
                    <>
                      浏览模式：
                      <Link
                        href="/login?next=/map"
                        className="ml-1 text-accent underline-offset-2 hover:underline"
                      >
                        登录
                      </Link>
                      后由编辑配置点位。
                    </>
                  )}
              </p>
            )}
          </div>
        )}

        <MapLayerSidebar
          layers={layers}
          visibleLayerIds={visibleLayerIds}
          selectedLayerId={selectedLayerId}
          selectedLayerPointId={selectedLayerPointId}
          onToggleVisible={toggleLayerVisible}
          onSelectLayer={selectLayer}
          onSelectPoint={selectLayerPoint}
          loadError={layersLoadError}
          canEdit={canEdit}
          entryOptions={entryOptions}
          drawingLayerId={editMode === "layer-draw" ? activeLayerId : null}
          onStartDraw={startDraw}
          onLayersChange={setLayers}
          onLayerDeleted={(layerId) => {
            setLayers((prev) => prev.filter((layer) => layer.id !== layerId));
            if (selectedLayerId === layerId) {
              setSelectedLayerId(null);
              setSelectedLayerPointId(null);
            }
            if (activeLayerId === layerId) {
              setActiveLayerId(null);
              setEditMode(null);
            }
            setVisibleLayerIds((prev) => {
              if (!prev.has(layerId)) return prev;
              const next = new Set(prev);
              next.delete(layerId);
              return next;
            });
            router.refresh();
          }}
          onPointDeleted={(pointId) => {
            if (selectedLayerPointId === pointId) {
              setSelectedLayerPointId(null);
            }
            router.refresh();
          }}
        />

        <div className="panel overflow-hidden">
          <div className="panel-title px-3 py-2">
            <p className="hud-label">Marker List</p>
          </div>
          <ul className="max-h-64 divide-y divide-border overflow-y-auto">
            {markers.length === 0 && (
              <li className="px-3 py-4 text-center font-mono text-xs text-muted">
                NO MARKERS
              </li>
            )}
            {markers.map((marker) => (
              <li key={marker.id}>
                <button
                  type="button"
                  className={`flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-accent/5 ${
                    selectedId === marker.id ? "bg-accent/10" : ""
                  }`}
                  onClick={() => selectIntelMarker(marker.id)}
                >
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: marker.color || "#9def4a" }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-foreground">
                      {marker.title}
                    </span>
                    {marker.articles && (
                      <span className="block truncate font-mono text-[0.65rem] text-accent">
                        → {marker.articles.title}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
