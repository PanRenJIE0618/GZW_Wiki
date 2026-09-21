"use client";

import { resolveLayerIcon } from "@/lib/layer-icons";

export const PRESET_GLYPH: Record<string, string> = {
  crate: "▣",
  keycard: "▭",
  key: "K",
  extract: "⤴",
  objective: "◎",
  cache: "◇",
};

type Props = {
  icon?: string | null;
  fallback?: string | null;
  className?: string;
  size?: number;
};

export function LayerIcon({ icon, fallback, className = "", size = 16 }: Props) {
  const resolved = resolveLayerIcon(icon, fallback);
  if (resolved.kind === "none") {
    return (
      <span
        className={`layer-icon layer-icon--empty ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  if (resolved.kind === "url") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolved.value}
        alt=""
        className={`layer-icon layer-icon--img ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  const glyph = PRESET_GLYPH[resolved.value] ?? "•";
  return (
    <span
      className={`layer-icon layer-icon--preset ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.7 }}
      title={resolved.value}
    >
      {glyph}
    </span>
  );
}
