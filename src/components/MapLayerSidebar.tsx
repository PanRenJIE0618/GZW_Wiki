"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { LayerIcon } from "@/components/LayerIcon";
import { createClient } from "@/lib/supabase/client";
import { LAYER_ICON_PRESETS } from "@/lib/layer-icons";
import type {
  ArticleStatus,
  MapLayerPoint,
  MapLayerWithPoints,
} from "@/lib/types";

export type LayerEntryOption = {
  id: string;
  title: string;
  slug: string;
};

export type MapLayerSidebarProps = {
  layers: MapLayerWithPoints[];
  visibleLayerIds: ReadonlySet<string>;
  selectedLayerId: string | null;
  selectedLayerPointId: string | null;
  onToggleVisible: (layerId: string) => void;
  onSelectLayer: (layerId: string) => void;
  onSelectPoint: (layerId: string, pointId: string) => void;
  loadError?: string | null;
  canEdit?: boolean;
  entryOptions?: LayerEntryOption[];
  drawingLayerId?: string | null;
  onStartDraw?: (layerId: string) => void;
  onLayersChange?: (
    updater: (prev: MapLayerWithPoints[]) => MapLayerWithPoints[],
  ) => void;
  onLayerDeleted?: (layerId: string) => void;
  onPointDeleted?: (pointId: string) => void;
};

const KIND_LABEL: Record<MapLayerWithPoints["kind"], string> = {
  path: "路径",
  loot: "物资",
};

const ICON_URL_VALUE = "__url__";

function isIconUrl(value: string) {
  return /^https?:\/\//i.test(value) || value.startsWith("/");
}

function articleFromOptions(
  articleId: string | null,
  options: LayerEntryOption[],
): MapLayerWithPoints["articles"] {
  if (!articleId) return null;
  const opt = options.find((row) => row.id === articleId);
  return opt ? { id: opt.id, title: opt.title, slug: opt.slug } : null;
}

export function MapLayerSidebar({
  layers,
  visibleLayerIds,
  selectedLayerId,
  selectedLayerPointId,
  onToggleVisible,
  onSelectLayer,
  onSelectPoint,
  loadError = null,
  canEdit = false,
  entryOptions = [],
  drawingLayerId = null,
  onStartDraw,
  onLayersChange,
  onLayerDeleted,
  onPointDeleted,
}: MapLayerSidebarProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => (selectedLayerId ? new Set([selectedLayerId]) : new Set()),
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedLayerId) return;
    setExpandedIds((prev) => {
      if (prev.has(selectedLayerId)) return prev;
      const next = new Set(prev);
      next.add(selectedLayerId);
      return next;
    });
  }, [selectedLayerId]);

  const selectedLayer = useMemo(
    () => layers.find((layer) => layer.id === selectedLayerId) ?? null,
    [layers, selectedLayerId],
  );
  const selectedPoint = useMemo(() => {
    if (!selectedLayer || !selectedLayerPointId) return null;
    return (
      selectedLayer.points.find((point) => point.id === selectedLayerPointId) ??
      null
    );
  }, [selectedLayer, selectedLayerPointId]);

  function toggleExpanded(layerId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
    onSelectLayer(layerId);
  }

  function patchLayer(
    layerId: string,
    patch: Partial<MapLayerWithPoints>,
  ) {
    onLayersChange?.((prev) =>
      prev.map((layer) =>
        layer.id === layerId ? { ...layer, ...patch } : layer,
      ),
    );
  }

  function patchPoint(
    layerId: string,
    pointId: string,
    patch: Partial<MapLayerPoint>,
  ) {
    onLayersChange?.((prev) =>
      prev.map((layer) => {
        if (layer.id !== layerId) return layer;
        return {
          ...layer,
          points: layer.points.map((point) =>
            point.id === pointId ? { ...point, ...patch } : point,
          ),
        };
      }),
    );
  }

  async function saveLayer(e: FormEvent) {
    e.preventDefault();
    if (!selectedLayer || !canEdit) return;
    setSaving(true);
    setFormError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("map_layers")
        .update({
          name: selectedLayer.name.trim() || selectedLayer.name,
          description: selectedLayer.description.trim(),
          color: selectedLayer.color,
          icon: selectedLayer.icon.trim() || "crate",
          status: selectedLayer.status,
          article_id: selectedLayer.article_id,
        })
        .eq("id", selectedLayer.id)
        .select("*, articles(id, title, slug)")
        .single();
      if (error) throw error;
      patchLayer(selectedLayer.id, {
        ...(data as MapLayerWithPoints),
        points: selectedLayer.points,
        articles:
          (data as MapLayerWithPoints).articles ??
          articleFromOptions(selectedLayer.article_id, entryOptions),
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "保存图层失败");
    } finally {
      setSaving(false);
    }
  }

  async function savePoint(e: FormEvent) {
    e.preventDefault();
    if (!selectedLayer || !selectedPoint || !canEdit) return;
    setSaving(true);
    setFormError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("map_layer_points")
        .update({
          title: selectedPoint.title.trim() || selectedPoint.title,
          description: selectedPoint.description.trim(),
          icon: selectedPoint.icon?.trim() || null,
          image_urls: selectedPoint.image_urls ?? [],
        })
        .eq("id", selectedPoint.id)
        .select("*")
        .single();
      if (error) throw error;
      patchPoint(selectedLayer.id, selectedPoint.id, data as MapLayerPoint);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "保存点位失败");
    } finally {
      setSaving(false);
    }
  }

  async function deleteLayer() {
    if (!selectedLayer || !canEdit) return;
    if (!window.confirm("确定删除该图层及其全部点位？")) return;
    setSaving(true);
    setFormError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("map_layers")
        .delete()
        .eq("id", selectedLayer.id);
      if (error) throw error;
      onLayerDeleted?.(selectedLayer.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "删除图层失败");
    } finally {
      setSaving(false);
    }
  }

  async function deletePoint() {
    if (!selectedLayer || !selectedPoint || !canEdit) return;
    if (!window.confirm("确定删除该点位？")) return;
    setSaving(true);
    setFormError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("map_layer_points")
        .delete()
        .eq("id", selectedPoint.id);
      if (error) throw error;
      onLayersChange?.((prev) =>
        prev.map((layer) =>
          layer.id === selectedLayer.id
            ? {
                ...layer,
                points: layer.points.filter((p) => p.id !== selectedPoint.id),
              }
            : layer,
        ),
      );
      onPointDeleted?.(selectedPoint.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "删除点位失败");
    } finally {
      setSaving(false);
    }
  }

  async function movePoint(dir: -1 | 1) {
    if (!selectedLayer || !selectedPoint || selectedLayer.kind !== "path") {
      return;
    }
    const ordered = [...selectedLayer.points].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    const index = ordered.findIndex((p) => p.id === selectedPoint.id);
    const swapIndex = index + dir;
    if (index < 0 || swapIndex < 0 || swapIndex >= ordered.length) return;
    const a = ordered[index];
    const b = ordered[swapIndex];
    setSaving(true);
    setFormError(null);
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
      onLayersChange?.((prev) =>
        prev.map((layer) => {
          if (layer.id !== selectedLayer.id) return layer;
          return {
            ...layer,
            points: layer.points
              .map((point) => {
                if (point.id === a.id) return { ...point, sort_order: b.sort_order };
                if (point.id === b.id) return { ...point, sort_order: a.sort_order };
                return point;
              })
              .sort((x, y) => x.sort_order - y.sort_order),
          };
        }),
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "调整顺序失败");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPointImage(file: File) {
    if (!selectedLayer || !selectedPoint || !canEdit) return;
    setUploading(true);
    setFormError(null);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "png";
      const path = `layers/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("uploads").getPublicUrl(path);
      const nextUrls = [...(selectedPoint.image_urls ?? []), data.publicUrl];
      const { data: updated, error: updateError } = await supabase
        .from("map_layer_points")
        .update({ image_urls: nextUrls })
        .eq("id", selectedPoint.id)
        .select("*")
        .single();
      if (updateError) throw updateError;
      patchPoint(selectedLayer.id, selectedPoint.id, updated as MapLayerPoint);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function removePointImage(url: string) {
    if (!selectedLayer || !selectedPoint || !canEdit) return;
    const nextUrls = (selectedPoint.image_urls ?? []).filter((item) => item !== url);
    setSaving(true);
    setFormError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("map_layer_points")
        .update({ image_urls: nextUrls })
        .eq("id", selectedPoint.id)
        .select("*")
        .single();
      if (error) throw error;
      patchPoint(selectedLayer.id, selectedPoint.id, data as MapLayerPoint);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "移除图片失败");
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

  return (
    <div className="space-y-3">
      <div className="panel overflow-hidden">
        <div className="panel-title px-3 py-2">
          <p className="hud-label">Map Layers</p>
        </div>
        {loadError && (
          <p className="border-b border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
            {loadError}
          </p>
        )}
        <ul className="max-h-72 divide-y divide-border overflow-y-auto">
          {layers.length === 0 && (
            <li className="px-3 py-4 text-center font-mono text-xs text-muted">
              NO LAYERS
            </li>
          )}
          {layers.map((layer) => {
            const expanded = expandedIds.has(layer.id);
            const selected = selectedLayerId === layer.id;
            const drawing = drawingLayerId === layer.id;
            return (
              <li key={layer.id}>
                <div
                  className={`flex w-full items-start gap-2 px-3 py-2 ${
                    selected ? "bg-accent/10" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-3.5 w-3.5 shrink-0 accent-[#9def4a]"
                    checked={visibleLayerIds.has(layer.id)}
                    onChange={() => onToggleVisible(layer.id)}
                    aria-label={`显示图层 ${layer.name}`}
                  />
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-start gap-2 text-left hover:text-accent"
                    aria-expanded={expanded}
                    onClick={() => toggleExpanded(layer.id)}
                  >
                    <LayerIcon
                      icon={layer.icon}
                      className="mt-0.5 shrink-0"
                      size={16}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-foreground">
                        {layer.name}
                      </span>
                      <span className="font-mono text-[0.65rem] text-muted">
                        {KIND_LABEL[layer.kind]} · {layer.points.length}
                        {layer.status !== "published" ? " · DRAFT" : ""}
                        {drawing ? " · DRAW" : ""}
                      </span>
                    </span>
                  </button>
                  {canEdit && onStartDraw && (
                    <button
                      type="button"
                      className={`btn shrink-0 px-2 text-[0.65rem] ${
                        drawing ? "btn-primary" : "btn-ghost"
                      }`}
                      onClick={() => onStartDraw(layer.id)}
                    >
                      {drawing ? "绘制中" : "绘制"}
                    </button>
                  )}
                </div>
                {expanded && (
                  <ul className="border-t border-border bg-[#0a100d]/60">
                    {layer.points.length === 0 && (
                      <li className="px-3 py-2 pl-10 font-mono text-[0.65rem] text-muted">
                        NO POINTS
                      </li>
                    )}
                    {layer.points.map((point, index) => (
                      <li key={point.id}>
                        <button
                          type="button"
                          className={`flex w-full items-start gap-2 px-3 py-1.5 pl-10 text-left hover:bg-accent/5 ${
                            selectedLayerPointId === point.id
                              ? "bg-accent/10"
                              : ""
                          }`}
                          onClick={() => onSelectPoint(layer.id, point.id)}
                        >
                          {layer.kind === "path" ? (
                            <span className="mt-0.5 w-4 shrink-0 text-center font-mono text-[0.65rem] text-accent">
                              {index + 1}
                            </span>
                          ) : (
                            <LayerIcon
                              icon={point.icon}
                              fallback={layer.icon}
                              className="mt-0.5 shrink-0"
                              size={14}
                            />
                          )}
                          <span className="truncate text-sm text-foreground">
                            {point.title || `点 ${index + 1}`}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {(selectedPoint || selectedLayer) && (
        <div className="panel space-y-3 p-3">
          <p className="hud-label">{canEdit ? "Layer Editor" : "Layer Intel"}</p>
          {formError && (
            <p className="border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          )}

          {canEdit && selectedLayer ? (
            <>
              <form onSubmit={saveLayer} className="space-y-2">
                <label className="block space-y-1 text-sm">
                  <span className="hud-label">图层名称</span>
                  <input
                    className="input"
                    value={selectedLayer.name}
                    onChange={(e) =>
                      patchLayer(selectedLayer.id, { name: e.target.value })
                    }
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="hud-label">说明</span>
                  <textarea
                    className="textarea min-h-[56px]"
                    value={selectedLayer.description}
                    onChange={(e) =>
                      patchLayer(selectedLayer.id, {
                        description: e.target.value,
                      })
                    }
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="hud-label">颜色</span>
                  <input
                    type="color"
                    className="h-10 w-full cursor-pointer border border-border bg-transparent"
                    value={selectedLayer.color || "#9def4a"}
                    onChange={(e) =>
                      patchLayer(selectedLayer.id, { color: e.target.value })
                    }
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="hud-label">图标</span>
                  {renderIconField(
                    selectedLayer.icon,
                    (icon) => patchLayer(selectedLayer.id, { icon }),
                    false,
                  )}
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="hud-label">状态</span>
                  <select
                    className="select"
                    value={selectedLayer.status}
                    onChange={(e) =>
                      patchLayer(selectedLayer.id, {
                        status: e.target.value as ArticleStatus,
                      })
                    }
                  >
                    <option value="draft">草稿</option>
                    <option value="published">发布</option>
                  </select>
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="hud-label">关联词条</span>
                  <select
                    className="select"
                    value={selectedLayer.article_id ?? ""}
                    onChange={(e) => {
                      const article_id = e.target.value || null;
                      patchLayer(selectedLayer.id, {
                        article_id,
                        articles: articleFromOptions(article_id, entryOptions),
                      });
                    }}
                  >
                    <option value="">不关联</option>
                    {entryOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.title}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-primary disabled:opacity-60"
                  >
                    保存图层
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    className="btn btn-danger disabled:opacity-60"
                    onClick={deleteLayer}
                  >
                    删除图层
                  </button>
                </div>
              </form>

              {selectedPoint && (
                <form
                  onSubmit={savePoint}
                  className="space-y-2 border-t border-border pt-3"
                >
                  <p className="hud-label">点位</p>
                  <input
                    className="input"
                    placeholder="点位名称"
                    value={selectedPoint.title}
                    onChange={(e) =>
                      patchPoint(selectedLayer.id, selectedPoint.id, {
                        title: e.target.value,
                      })
                    }
                  />
                  <textarea
                    className="textarea min-h-[56px]"
                    placeholder="描述（可选）"
                    value={selectedPoint.description}
                    onChange={(e) =>
                      patchPoint(selectedLayer.id, selectedPoint.id, {
                        description: e.target.value,
                      })
                    }
                  />
                  <label className="block space-y-1 text-sm">
                    <span className="hud-label">点位图标</span>
                    {renderIconField(
                      selectedPoint.icon ?? "",
                      (icon) =>
                        patchPoint(selectedLayer.id, selectedPoint.id, {
                          icon: icon || null,
                        }),
                      true,
                    )}
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="hud-label">图片</span>
                      <label className="btn btn-ghost cursor-pointer text-xs">
                        {uploading ? "上传中…" : "上传图片"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploading}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) await uploadPointImage(file);
                          }}
                        />
                      </label>
                    </div>
                    {(selectedPoint.image_urls ?? []).length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {(selectedPoint.image_urls ?? []).map((url, index) => (
                          <div key={`${url}-${index}`} className="space-y-1">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`${selectedPoint.title} 图 ${index + 1}`}
                              className="aspect-square w-full border border-border object-cover"
                            />
                            <button
                              type="button"
                              className="btn btn-ghost w-full text-[0.65rem]"
                              onClick={() => removePointImage(url)}
                            >
                              移除
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="font-mono text-xs text-muted">
                    X {Number(selectedPoint.x).toFixed(1)}% · Y{" "}
                    {Number(selectedPoint.y).toFixed(1)}%
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn btn-primary disabled:opacity-60"
                    >
                      保存点位
                    </button>
                    {selectedLayer.kind === "path" && (
                      <>
                        <button
                          type="button"
                          disabled={saving}
                          className="btn btn-ghost disabled:opacity-60"
                          onClick={() => movePoint(-1)}
                        >
                          上移
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          className="btn btn-ghost disabled:opacity-60"
                          onClick={() => movePoint(1)}
                        >
                          下移
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={saving}
                      className="btn btn-danger disabled:opacity-60"
                      onClick={deletePoint}
                    >
                      删除点位
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : selectedPoint ? (
            <>
              <h3 className="title-name text-base">{selectedPoint.title}</h3>
              {selectedPoint.description && (
                <p className="text-sm text-muted">{selectedPoint.description}</p>
              )}
              {(selectedPoint.image_urls ?? []).length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {(selectedPoint.image_urls ?? []).map((url, index) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={`${url}-${index}`}
                      src={url}
                      alt={`${selectedPoint.title} 图 ${index + 1}`}
                      className="aspect-square w-full border border-border object-cover"
                    />
                  ))}
                </div>
              )}
              <p className="font-mono text-xs text-muted">
                X {Number(selectedPoint.x).toFixed(1)}% · Y{" "}
                {Number(selectedPoint.y).toFixed(1)}%
              </p>
            </>
          ) : selectedLayer ? (
            <>
              <h3 className="title-name text-base">{selectedLayer.name}</h3>
              {selectedLayer.description && (
                <p className="text-sm text-muted">{selectedLayer.description}</p>
              )}
            </>
          ) : null}
          {selectedLayer?.articles && (
            <Link
              href={`/entries/${selectedLayer.articles.slug}`}
              className="btn btn-ghost w-full text-xs"
            >
              打开词条：{selectedLayer.articles.title}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
