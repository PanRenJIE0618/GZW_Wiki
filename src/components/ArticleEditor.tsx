"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { EntryLayerEditor } from "@/components/EntryLayerEditor";
import { TipTapEditor } from "@/components/TipTapEditor";
import { signalNavigationStart } from "@/components/NavigationProgress";
import { createClient } from "@/lib/supabase/client";
import { uniqueSlug } from "@/lib/slug";
import type {
  Article,
  ArticleStatus,
  Category,
  EntryParam,
} from "@/lib/types";
import {
  CONTRIB_POINTS_CREATE,
  CONTRIB_POINTS_EDIT,
  normalizeGallery,
  normalizeParams,
} from "@/lib/types";

type ArticleEditorProps = {
  article?: Article;
  authorId: string;
  categories: Category[];
  defaultCategoryId?: string | null;
};

const emptyDoc = {
  type: "doc",
  content: [{ type: "paragraph" }],
} as Record<string, unknown>;

export function ArticleEditor({
  article,
  authorId,
  categories,
  defaultCategoryId,
}: ArticleEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(article?.title ?? "");
  const [summary, setSummary] = useState(article?.summary ?? "");
  const [status, setStatus] = useState<ArticleStatus>(
    article?.status ?? "draft",
  );
  const [categoryId, setCategoryId] = useState(
    article?.category_id ?? defaultCategoryId ?? categories[0]?.id ?? "",
  );
  const [coverUrl, setCoverUrl] = useState(article?.cover_url ?? "");
  const [params, setParams] = useState<EntryParam[]>(
    normalizeParams(article?.params),
  );
  const [gallery, setGallery] = useState<string[]>(
    normalizeGallery(article?.gallery),
  );
  const [content, setContent] = useState<Record<string, unknown>>(
    (article?.content as Record<string, unknown>) ?? emptyDoc,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function uploadImage(file: File): Promise<string> {
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "bin";
    const path = `entries/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("uploads")
      .upload(path, file, { upsert: false });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from("uploads").getPublicUrl(path);
    return data.publicUrl;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("请填写词条名称");
      return;
    }
    if (!categoryId) {
      setError("请选择分类");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      title: title.trim(),
      summary: summary.trim(),
      content,
      status,
      category_id: categoryId,
      cover_url: coverUrl.trim() || null,
      params: params.filter((p) => p.label.trim() || p.value.trim()),
      gallery: gallery.filter(Boolean),
    };

    try {
      const supabase = createClient();

      if (article) {
        const { error: updateError } = await supabase
          .from("articles")
          .update(payload)
          .eq("id", article.id);
        if (updateError) throw updateError;

        const { error: contribError } = await supabase.rpc(
          "record_article_contribution",
          {
            p_article_id: article.id,
            p_points: CONTRIB_POINTS_EDIT,
          },
        );
        if (contribError) throw contribError;

        signalNavigationStart();
        router.push(`/entries/${article.slug}`);
      } else {
        const slug = uniqueSlug(title);
        const { data, error: insertError } = await supabase
          .from("articles")
          .insert({
            ...payload,
            slug,
            author_id: authorId,
            last_editor_id: authorId,
          })
          .select("id, slug")
          .single();
        if (insertError) throw insertError;

        const { error: contribError } = await supabase.rpc(
          "record_article_contribution",
          {
            p_article_id: data.id,
            p_points: CONTRIB_POINTS_CREATE,
          },
        );
        if (contribError) throw contribError;

        signalNavigationStart();
        router.push(`/entries/${data.slug}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!article) return;
    if (!window.confirm("确定删除这个词条？此操作不可恢复。")) return;

    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("articles")
        .delete()
        .eq("id", article.id);
      if (deleteError) throw deleteError;
      signalNavigationStart();
      router.push(categoryId ? `/categories/${categories.find((c) => c.id === categoryId)?.slug ?? ""}` : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="panel grid gap-3 p-4 sm:grid-cols-2">
        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="hud-label">Codename</span>
          <input
            className="input text-lg font-medium"
            placeholder="例如：火焰剑"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="hud-label">Category</span>
          <select
            className="select"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            <option value="" disabled>
              选择分类
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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

        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="hud-label">Summary</span>
          <input
            className="input"
            placeholder="出现在列表与详情页顶部"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </label>
      </section>

      <section className="panel space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base text-foreground">封面与图集</h2>
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
                if (!file) return;
                setUploading(true);
                setError(null);
                try {
                  const url = await uploadImage(file);
                  if (!coverUrl) setCoverUrl(url);
                  setGallery((prev) => [...prev, url]);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "上传失败");
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
        </div>

        <label className="block space-y-1 text-sm">
          <span className="text-muted">封面图 URL</span>
          <input
            className="input"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            placeholder="可粘贴链接，或用上方上传"
          />
        </label>

        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt="封面预览"
            className="h-40 w-auto border border-border object-cover"
          />
        )}

        {gallery.length > 0 && (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {gallery.map((url, index) => (
              <li key={`${url}-${index}`} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`图集 ${index + 1}`}
                  className="h-28 w-full border border-border object-cover"
                />
                <button
                  type="button"
                  className="absolute right-1 top-1 bg-black/80 px-1.5 font-mono text-xs text-danger"
                  onClick={() =>
                    setGallery((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  删
                </button>
                <button
                  type="button"
                  className="absolute bottom-1 left-1 bg-black/80 px-1.5 font-mono text-xs text-accent"
                  onClick={() => setCoverUrl(url)}
                >
                  设为封面
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {article && (
        <EntryLayerEditor articleId={article.id} authorId={authorId} />
      )}

      <section className="panel space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base text-foreground">
            属性参数（信息框）
          </h2>
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={() =>
              setParams((prev) => [...prev, { label: "", value: "" }])
            }
          >
            添加参数
          </button>
        </div>
        <p className="text-sm text-muted">
          例如：攻击力 / 120、稀有度 / 传说、职业 / 战士
        </p>
        <div className="space-y-2">
          {params.length === 0 && (
            <p className="text-sm text-muted">暂无参数，点击「添加参数」。</p>
          )}
          {params.map((param, index) => (
            <div key={index} className="flex flex-col gap-2 sm:flex-row">
              <input
                className="input sm:w-1/3"
                placeholder="参数名"
                value={param.label}
                onChange={(e) =>
                  setParams((prev) =>
                    prev.map((row, i) =>
                      i === index ? { ...row, label: e.target.value } : row,
                    ),
                  )
                }
              />
              <input
                className="input flex-1"
                placeholder="参数值"
                value={param.value}
                onChange={(e) =>
                  setParams((prev) =>
                    prev.map((row, i) =>
                      i === index ? { ...row, value: e.target.value } : row,
                    ),
                  )
                }
              />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  setParams((prev) => prev.filter((_, i) => i !== index))
                }
              >
                删
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-base text-foreground">详细说明</h2>
        <p className="text-sm text-muted">
          站内链接可指向{" "}
          <code className="text-accent">/entries/词条slug</code>
        </p>
        <TipTapEditor content={content} onChange={setContent} />
      </section>

      {error && (
        <p className="border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-60">
          {saving ? (
            <span className="inline-flex items-center gap-2">
              <span className="hud-spinner hud-spinner--sm" aria-hidden />
              保存中…
            </span>
          ) : (
            "保存词条"
          )}
        </button>
        {article && (
          <button
            type="button"
            disabled={saving}
            onClick={onDelete}
            className="btn btn-danger disabled:opacity-60"
          >
            删除
          </button>
        )}
      </div>
    </form>
  );
}
