"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LayerIcon } from "@/components/LayerIcon";
import { createClient } from "@/lib/supabase/client";
import { LAYER_ICON_PRESETS } from "@/lib/layer-icons";
import type {
  LayerKind,
  MapLayer,
  MapLayerPoint,
  MapLayerWithPoints,
} from "@/lib/types";

type EntryLayerEditorProps = {
  articleId: string;
  authorId: string;
  mapId?: string;
};

type LayerRow = MapLayer & {
  map_layer_points?: MapLayerPoint[] | null;
};

const KIND_LABEL: Record<LayerKind, string> = {
  path: "路径",
  loot: "物资",
};

const ICON_URL_VALUE = "__url__";

function isIconUrl(value: string) {
  return /^https?:\/\//i.test(value) || value.startsWith("/");
}

function normalizeLayers(
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

function patchPointInLayers(
  layers: MapLayerWithPoints[],
  layerId: string,
  pointId: string,
  patch: Partial<MapLayerPoint>,
): MapLayerWithPoints[] {
  return layers.map((layer) => {
    if (layer.id !== layerId) return layer;
    return {
      ...layer,
      points: layer.points
        .map((point) =>
          point.id === pointId ? { ...point, ...patch } : point,
        )
        .sort((a, b) => a.sort_order - b.sort_order),
    };
  });
}

export function EntryLayerEditor({
  articleId,
  authorId,
  mapId: mapIdProp,
}: EntryLayerEditorProps) {
  const [mapId, setMapId] = useState<string | null>(mapIdProp ?? null);
  const [mapReady, setMapReady] = useState(Boolean(mapIdProp));
  const [layers, setLayers] = useState<MapLayerWithPoints[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPointId, setUploadingPointId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      let resolvedMapId = mapIdProp ?? null;
      if (!resolvedMapId) {
        const { data: world, error: worldError } = await supabase
          .from("maps")
          .select("id")
          .eq("slug", "world")
          .maybeSingle();
        if (worldError) throw worldError;
        resolvedMapId = world?.id ?? null;
      }
      setMapId(resolvedMapId);
      setMapReady(true);
      if (!resolvedMapId) {
        setLayers([]);
        return;
      }

      const { data, error: layerError } = await supabase
        .from("map_layers")
        .select("*, map_layer_points(*)")
        .eq("article_id", articleId)
        .order("sort_order", { ascending: true });
      if (layerError) throw layerError;
      setLayers(normalizeLayers(data as LayerRow[] | null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载图层失败");
    } finally {
      setLoading(false);
    }
  }, [articleId, mapIdProp]);

  useEffect(() => {
    void load();
  }, [load]);

  function patchPoint(
    layerId: string,
    pointId: string,
    patch: Partial<MapLayerPoint>,
  ) {
    setLayers((prev) => patchPointInLayers(prev, layerId, pointId, patch));
  }

  async function createLayer(kind: LayerKind) {
    if (!mapId) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from("map_layers")
        .insert({
          map_id: mapId,
          kind,
          name: kind === "path" ? "新路径" : "新物资",
          description: "",
          color: "#9def4a",
          icon: kind === "loot" ? "crate" : "objective",
          article_id: articleId,
          status: "draft",
          sort_order: layers.length,
          author_id: authorId,
        })
        .select("*, map_layer_points(*)")
        .single();
      if (insertError) throw insertError;
      setLayers((prev) => [
        ...prev,
        ...normalizeLayers([data as LayerRow]),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建图层失败");
    } finally {
      setSaving(false);
    }
  }

  async function unlinkLayer(layerId: string) {
    if (!window.confirm("解除该图层与本词条的关联？图层本身会保留。")) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("map_layers")
        .update({ article_id: null })
        .eq("id", layerId);
      if (updateError) throw updateError;
      setLayers((prev) => prev.filter((layer) => layer.id !== layerId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "解除关联失败");
    } finally {
      setSaving(false);
    }
  }

  async function savePoint(layer: MapLayerWithPoints, point: MapLayerPoint) {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from("map_layer_points")
        .update({
          title: point.title.trim() || point.title,
          description: point.description.trim(),
          icon: point.icon?.trim() || null,
          image_urls: point.image_urls ?? [],
        })
        .eq("id", point.id)
        .select("*")
        .single();
      if (updateError) throw updateError;
      patchPoint(layer.id, point.id, data as MapLayerPoint);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存点位失败");
    } finally {
      setSaving(false);
    }
  }

  async function movePoint(
    layer: MapLayerWithPoints,
    pointId: string,
    dir: -1 | 1,
  ) {
    const ordered = [...layer.points].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    const index = ordered.findIndex((p) => p.id === pointId);
    const swapIndex = index + dir;
    if (index < 0 || swapIndex < 0 || swapIndex >= ordered.length) return;
    const a = ordered[index];
    const b = ordered[swapIndex];
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const [first, second] = await Promise.all([
        supabase
          .from("map_layer_points")
          .update({ sort_order: b.sort_order })
          .eq("id", a.id),
        supabase
          .from("map_layer_points")
          .update({ sort_order: a.sort_order })
          .eq("id", b.id),
      ]);
      if (first.error) throw first.error;
      if (second.error) throw second.error;
      setLayers((prev) =>
        prev.map((row) => {
          if (row.id !== layer.id) return row;
          return {
            ...row,
            points: row.points
              .map((point) => {
                if (point.id === a.id)
                  return { ...point, sort_order: b.sort_order };
                if (point.id === b.id)
                  return { ...point, sort_order: a.sort_order };
                return point;
              })
              .sort((x, y) => x.sort_order - y.sort_order),
          };
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "调整顺序失败");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPointImage(
    layer: MapLayerWithPoints,
    point: MapLayerPoint,
    file: File,
  ) {
    setUploadingPointId(point.id);
    setError(null);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "png";
      const path = `layers/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("uploads").getPublicUrl(path);
      const nextUrls = [...(point.image_urls ?? []), data.publicUrl];
      const { data: updated, error: updateError } = await supabase
        .from("map_layer_points")
        .update({ image_urls: nextUrls })
        .eq("id", point.id)
        .select("*")
        .single();
      if (updateError) throw updateError;
      patchPoint(layer.id, point.id, {
        image_urls: (updated as MapLayerPoint).image_urls ?? nextUrls,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploadingPointId(null);
    }
  }

  async function removePointImage(
    layer: MapLayerWithPoints,
    point: MapLayerPoint,
    url: string,
  ) {
    const nextUrls = (point.image_urls ?? []).filter((item) => item !== url);
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from("map_layer_points")
        .update({ image_urls: nextUrls })
        .eq("id", point.id)
        .select("*")
        .single();
      if (updateError) throw updateError;
      patchPoint(layer.id, point.id, {
        image_urls: (data as MapLayerPoint).image_urls ?? nextUrls,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "移除图片失败");
    } finally {
      setSaving(false);
    }
  }

  function renderIconField(
    value: string,
    onChange: (next: string) => void,
    allowEmpty: boolean,
  ) {
    const urlMode = isIconUrl(value);
    const selectValue = urlMode ? ICON_URL_VALUE : value;
    return (
      <div className="space-y-1">
        <select
          className="select"
          value={selectValue}
          onChange={(e) => {
            if (e.target.value === ICON_URL_VALUE) {
              onChange(urlMode ? value : "https://");
              return;
            }
            onChange(e.target.value);
          }}
        >
          {allowEmpty && <option value="">沿用图层图标</option>}
          {LAYER_ICON_PRESETS.map((preset) => (
            <option key={preset.key} value={preset.key}>
              {preset.label}
            </option>
          ))}
          <option value={ICON_URL_VALUE}>自定义 URL</option>
        </select>
        {urlMode && (
          <input
            className="input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://…"
          />
        )}
      </div>
    );
  }

  if (!mapReady || loading) {
    return (
      <section className="panel space-y-3 p-4">
        <h2 className="font-display text-base text-foreground">关联图层</h2>
        <p className="font-mono text-xs text-muted">LOADING LAYERS…</p>
      </section>
    );
  }

  if (!mapId) {
    return (
      <section className="panel space-y-3 p-4">
        <h2 className="font-display text-base text-foreground">关联图层</h2>
        <p className="text-sm text-muted">请先配置总图</p>
        <Link href="/map/setup" className="btn btn-primary inline-flex text-xs">
          去配置总图
        </Link>
      </section>
    );
  }

  return (
    <section
      className="panel space-y-3 p-4"
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
          e.preventDefault();
        }
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base text-foreground">关联图层</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            className="btn btn-ghost text-xs disabled:opacity-60"
            onClick={() => void createLayer("path")}
          >
            新建路径图层
          </button>
          <button
            type="button"
            disabled={saving}
            className="btn btn-ghost text-xs disabled:opacity-60"
            onClick={() => void createLayer("loot")}
          >
            新建物资图层
          </button>
        </div>
      </div>
      <p className="text-sm text-muted">
        在此编辑步骤文案与图片；坐标请到地图调整。
      </p>

      {error && (
        <p className="border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {layers.length === 0 && (
        <p className="font-mono text-xs text-muted">NO LINKED LAYERS</p>
      )}

      <div className="space-y-4">
        {layers.map((layer) => (
          <div key={layer.id} className="space-y-3 border border-border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2">
                <LayerIcon icon={layer.icon} className="mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{layer.name}</p>
                  <p className="font-mono text-[0.65rem] text-muted">
                    {KIND_LABEL[layer.kind]} · {layer.points.length}
                    {layer.status !== "published" ? " · DRAFT" : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/map?layer=${layer.id}`}
                  className="btn btn-ghost text-xs"
                >
                  在地图调整
                </Link>
                <button
                  type="button"
                  disabled={saving}
                  className="btn btn-ghost text-xs disabled:opacity-60"
                  onClick={() => void unlinkLayer(layer.id)}
                >
                  解除关联
                </button>
              </div>
            </div>

            {layer.points.length === 0 && (
              <p className="font-mono text-[0.65rem] text-muted">
                NO POINTS · 坐标请到地图调整
              </p>
            )}

            <ul className="space-y-3">
              {layer.points.map((point, index) => (
                <li
                  key={point.id}
                  className="space-y-2 border-t border-border pt-3"
                >
                  <div className="flex items-center gap-2">
                    {layer.kind === "path" ? (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-accent/40 font-mono text-xs text-accent">
                        {index + 1}
                      </span>
                    ) : (
                      <LayerIcon
                        icon={point.icon}
                        fallback={layer.icon}
                        size={16}
                      />
                    )}
                    <span className="hud-label">点位 {index + 1}</span>
                  </div>
                  <input
                    className="input"
                    placeholder="标题"
                    value={point.title}
                    onChange={(e) =>
                      patchPoint(layer.id, point.id, { title: e.target.value })
                    }
                  />
                  <textarea
                    className="textarea min-h-[56px]"
                    placeholder="描述（可选）"
                    value={point.description}
                    onChange={(e) =>
                      patchPoint(layer.id, point.id, {
                        description: e.target.value,
                      })
                    }
                  />
                  <label className="block space-y-1 text-sm">
                    <span className="hud-label">图标</span>
                    {renderIconField(
                      point.icon ?? "",
                      (icon) =>
                        patchPoint(layer.id, point.id, {
                          icon: icon || null,
                        }),
                      true,
                    )}
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="hud-label">图片</span>
                      <label className="btn btn-ghost cursor-pointer text-xs">
                        {uploadingPointId === point.id ? "上传中…" : "上传图片"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingPointId === point.id}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) void uploadPointImage(layer, point, file);
                          }}
                        />
                      </label>
                    </div>
                    {(point.image_urls ?? []).length > 0 && (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {(point.image_urls ?? []).map((url, imgIndex) => (
                          <div key={`${url}-${imgIndex}`} className="space-y-1">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`${point.title} 图 ${imgIndex + 1}`}
                              className="aspect-square w-full border border-border object-cover"
                            />
                            <button
                              type="button"
                              className="btn btn-ghost w-full text-[0.65rem]"
                              onClick={() =>
                                void removePointImage(layer, point, url)
                              }
                            >
                              移除
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted">
                    坐标请到地图调整{" "}
                    <Link
                      href={`/map?layer=${layer.id}`}
                      className="text-accent underline"
                    >
                      打开地图
                    </Link>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      className="btn btn-primary text-xs disabled:opacity-60"
                      onClick={() => void savePoint(layer, point)}
                    >
                      保存点位
                    </button>
                    <button
                      type="button"
                      disabled={saving || index === 0}
                      className="btn btn-ghost text-xs disabled:opacity-60"
                      onClick={() => void movePoint(layer, point.id, -1)}
                    >
                      上移
                    </button>
                    <button
                      type="button"
                      disabled={saving || index === layer.points.length - 1}
                      className="btn btn-ghost text-xs disabled:opacity-60"
                      onClick={() => void movePoint(layer, point.id, 1)}
                    >
                      下移
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
