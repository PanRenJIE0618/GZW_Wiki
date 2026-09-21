"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signalNavigationStart } from "@/components/NavigationProgress";
import type { ArticleStatus, WikiMap } from "@/lib/types";

type MapCreateFormProps = {
  authorId: string;
  forceWorldSlug?: boolean;
  existingMap?: WikiMap | null;
};

export function MapCreateForm({
  authorId,
  forceWorldSlug = false,
  existingMap = null,
}: MapCreateFormProps) {
  const router = useRouter();
  const [name, setName] = useState(existingMap?.name ?? "世界总图");
  const [description, setDescription] = useState(existingMap?.description ?? "");
  const [status, setStatus] = useState<ArticleStatus>(
    existingMap?.status ?? "published",
  );
  const [imageUrl, setImageUrl] = useState(existingMap?.image_url ?? "");
  const [tileUrlTemplate, setTileUrlTemplate] = useState(
    existingMap?.tile_url_template ?? "",
  );
  const [imageWidth, setImageWidth] = useState(
    existingMap?.image_width?.toString() ?? "",
  );
  const [imageHeight, setImageHeight] = useState(
    existingMap?.image_height?.toString() ?? "",
  );
  const [tileMinZoom, setTileMinZoom] = useState(
    existingMap?.tile_min_zoom?.toString() ?? "0",
  );
  const [tileMaxZoom, setTileMaxZoom] = useState(
    existingMap?.tile_max_zoom?.toString() ?? "",
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadImage(file: File) {
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "png";
    const path = `maps/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("uploads")
      .upload(path, file, { upsert: false });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from("uploads").getPublicUrl(path);
    return data.publicUrl;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("请填写地图名称");
      return;
    }

    const tilesOn = Boolean(tileUrlTemplate.trim());
    if (tilesOn) {
      if (!imageWidth || !imageHeight || tileMaxZoom === "") {
        setError("启用瓦片时需填写 image 宽高与 tile_max_zoom");
        return;
      }
    } else if (!imageUrl.trim()) {
      setError("请上传或填写地图底图，或改用瓦片模板");
      return;
    }

    // DB 仍要求 image_url：无原图时用 z=0 瓦片作占位预览
    const resolvedImageUrl =
      imageUrl.trim() ||
      (tilesOn
        ? tileUrlTemplate
            .trim()
            .replace("{z}", "0")
            .replace("{x}", "0")
            .replace("{y}", "0")
        : "");

    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const payload = {
        name: name.trim(),
        description: description.trim(),
        image_url: resolvedImageUrl,
        status,
        tile_url_template: tileUrlTemplate.trim() || null,
        image_width: imageWidth ? Number(imageWidth) : null,
        image_height: imageHeight ? Number(imageHeight) : null,
        tile_min_zoom: Number(tileMinZoom || 0),
        tile_max_zoom: tileMaxZoom === "" ? null : Number(tileMaxZoom),
      };

      if (existingMap) {
        const { error: updateError } = await supabase
          .from("maps")
          .update(payload)
          .eq("id", existingMap.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("maps").insert({
          ...payload,
          slug: forceWorldSlug ? "world" : `world-${Date.now().toString(36)}`,
          author_id: authorId,
        });
        if (insertError) throw insertError;
      }

      signalNavigationStart();
      router.push("/map");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel mx-auto max-w-xl space-y-3 p-4">
      <label className="block space-y-1 text-sm">
        <span className="hud-label">Map Name</span>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：世界总图"
          required
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="hud-label">Description</span>
        <input
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="简介（可选）"
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="hud-label">Status</span>
        <select
          className="select"
          value={status}
          onChange={(e) => setStatus(e.target.value as ArticleStatus)}
        >
          <option value="draft">草稿</option>
          <option value="published">发布</option>
        </select>
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="hud-label">Base Image（整图 / 回退）</span>
          <label className="btn btn-ghost cursor-pointer text-xs">
            {uploading ? "上传中…" : "上传底图"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setUploading(true);
                setError(null);
                try {
                  const url = await uploadImage(file);
                  setImageUrl(url);
                  const bmp = await createImageBitmap(file);
                  setImageWidth(String(bmp.width));
                  setImageHeight(String(bmp.height));
                  bmp.close();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "上传失败");
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
        </div>
        <input
          className="input"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder={
            tileUrlTemplate.trim()
              ? "可选；留空则用 z=0 瓦片占位"
              : "底图 URL"
          }
        />
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="地图预览"
            className="max-h-56 w-full border border-border object-contain"
          />
        )}
      </div>

      <div className="space-y-2 border border-border bg-panel-2/40 p-3">
        <p className="hud-label">Tile Streaming（可选）</p>
        <p className="text-xs text-muted">
          可接外部 XYZ 服务，或本地生成：
          <code className="mt-1 block text-accent">
            npm run map:tiles -- ./world.png ./public/map-tiles
          </code>
        </p>
        <input
          className="input"
          value={tileUrlTemplate}
          onChange={(e) => setTileUrlTemplate(e.target.value)}
          placeholder="https://example.com/MAP/urban/{z}/{x}/{y}.png"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className="input"
            value={imageWidth}
            onChange={(e) => setImageWidth(e.target.value)}
            placeholder="image_width"
            inputMode="numeric"
          />
          <input
            className="input"
            value={imageHeight}
            onChange={(e) => setImageHeight(e.target.value)}
            placeholder="image_height"
            inputMode="numeric"
          />
          <input
            className="input"
            value={tileMinZoom}
            onChange={(e) => setTileMinZoom(e.target.value)}
            placeholder="tile_min_zoom"
            inputMode="numeric"
          />
          <input
            className="input"
            value={tileMaxZoom}
            onChange={(e) => setTileMaxZoom(e.target.value)}
            placeholder="tile_max_zoom"
            inputMode="numeric"
          />
        </div>
        <button
          type="button"
          className="btn btn-ghost text-xs"
          onClick={() => {
            setTileUrlTemplate(
              "http://huiqu.bi4lnn.cn/MAP/urban/{z}/{x}/{y}.png",
            );
            setImageWidth("16384");
            setImageHeight("8192");
            setTileMinZoom("0");
            setTileMaxZoom("5");
            if (!imageUrl.trim()) {
              setImageUrl("http://huiqu.bi4lnn.cn/MAP/urban/0/0/0.png");
            }
          }}
        >
          填入探测到的 urban 瓦片参数
        </button>
        <button
          type="button"
          className="btn btn-ghost text-xs"
          onClick={() => {
            setTileUrlTemplate("");
            setTileMaxZoom("");
          }}
        >
          清除瓦片配置（改回整图）
        </button>
      </div>

      {error && (
        <p className="border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-60">
        {saving ? (
          <span className="inline-flex items-center gap-2">
            <span className="hud-spinner hud-spinner--sm" aria-hidden />
            保存中…
          </span>
        ) : existingMap ? (
          "更新总图"
        ) : (
          "创建总图"
        )}
      </button>
    </form>
  );
}
