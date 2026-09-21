export const LAYER_ICON_PRESETS = [
  { key: "crate", label: "物资箱" },
  { key: "keycard", label: "房卡" },
  { key: "key", label: "钥匙" },
  { key: "extract", label: "撤离" },
  { key: "objective", label: "目标" },
  { key: "cache", label: "缓存点" },
] as const;

export type LayerIconPresetKey = (typeof LAYER_ICON_PRESETS)[number]["key"];

export function resolveLayerIcon(
  icon: string | null | undefined,
  fallback: string | null | undefined = null,
): { kind: "preset" | "url" | "none"; value: string } {
  const raw = (icon ?? "").trim() || (fallback ?? "").trim();
  if (!raw) return { kind: "none", value: "" };
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) {
    return { kind: "url", value: raw };
  }
  const preset = LAYER_ICON_PRESETS.find((p) => p.key === raw);
  if (preset) return { kind: "preset", value: preset.key };
  return { kind: "preset", value: raw };
}
