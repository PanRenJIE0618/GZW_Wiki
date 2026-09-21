"use client";

import { Fragment } from "react";
import { Marker, Polyline } from "react-leaflet";
import L from "leaflet";
import { resolveLayerIcon } from "@/lib/layer-icons";
import type { MapLayerPoint, MapLayerWithPoints } from "@/lib/types";
import { PRESET_GLYPH } from "@/components/LayerIcon";

export type LayerCoordMode = {
  kind: "image" | "tiles";
  size: { w: number; h: number };
  maxZoom?: number;
};

type Props = {
  layers: MapLayerWithPoints[];
  visibleIds: Iterable<string>;
  selectedPointId: string | null;
  onSelectPoint: (layerId: string, pointId: string) => void;
  coordMode: LayerCoordMode;
};

function layerPctToLatLng(x: number, y: number, mode: LayerCoordMode) {
  if (mode.kind === "tiles") {
    return L.CRS.Simple.pointToLatLng(
      L.point((Number(x) / 100) * mode.size.w, (Number(y) / 100) * mode.size.h),
      mode.maxZoom ?? 0,
    );
  }
  return L.latLng((Number(y) / 100) * mode.size.h, (Number(x) / 100) * mode.size.w);
}

function escapeAttr(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function layerIconHtml(
  icon: string | null | undefined,
  fallback: string | null | undefined,
  size: number,
  extraStyle: string,
) {
  const resolved = resolveLayerIcon(icon, fallback);
  if (resolved.kind === "none") {
    return `<span class="layer-icon layer-icon--empty" style="width:${size}px;height:${size}px;${extraStyle}"></span>`;
  }
  if (resolved.kind === "url") {
    return `<img src="${escapeAttr(resolved.value)}" alt="" class="layer-icon layer-icon--img" style="width:${size}px;height:${size}px;${extraStyle}" />`;
  }
  const glyph = PRESET_GLYPH[resolved.value] ?? "•";
  return `<span class="layer-icon layer-icon--preset" title="${escapeAttr(resolved.value)}" style="width:${size}px;height:${size}px;font-size:${size * 0.7}px;${extraStyle}">${glyph}</span>`;
}

function pointMarkerHtml(
  layer: MapLayerWithPoints,
  point: MapLayerPoint,
  stepIndex: number,
  selected: boolean,
) {
  const size = selected ? 20 : 16;
  const extraStyle = selected ? "outline:2px solid rgba(255,255,255,.75);" : "";
  if (layer.kind === "path") {
    return `<span class="layer-icon layer-icon--preset" style="width:${size}px;height:${size}px;font-size:${size * 0.7}px;border-color:${escapeAttr(layer.color || "#9def4a")};${extraStyle}">${stepIndex + 1}</span>`;
  }
  return layerIconHtml(point.icon, layer.icon, size, extraStyle);
}

function pointDivIcon(
  layer: MapLayerWithPoints,
  point: MapLayerPoint,
  stepIndex: number,
  selected: boolean,
) {
  const size = selected ? 20 : 16;
  return L.divIcon({
    className: "gzw-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: pointMarkerHtml(layer, point, stepIndex, selected),
  });
}

export function MapLayersOverlay({
  layers,
  visibleIds,
  selectedPointId,
  onSelectPoint,
  coordMode,
}: Props) {
  const visible = visibleIds instanceof Set ? visibleIds : new Set(visibleIds);

  return (
    <>
      {layers.map((layer) => {
        if (!visible.has(layer.id)) return null;
        const points = [...layer.points].sort((a, b) => a.sort_order - b.sort_order);
        return (
          <Fragment key={layer.id}>
            {layer.kind === "path" && points.length >= 2 ? (
              <Polyline
                positions={points.map((point) =>
                  layerPctToLatLng(point.x, point.y, coordMode),
                )}
                color={layer.color || "#9def4a"}
                weight={3}
              />
            ) : null}
            {points.map((point, index) => (
              <Marker
                key={point.id}
                position={layerPctToLatLng(point.x, point.y, coordMode)}
                icon={pointDivIcon(layer, point, index, point.id === selectedPointId)}
                eventHandlers={{
                  click: () => onSelectPoint(layer.id, point.id),
                }}
              />
            ))}
          </Fragment>
        );
      })}
    </>
  );
}
