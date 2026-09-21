"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uniqueSlug } from "@/lib/slug";
import type { Category } from "@/lib/types";

type CategoryManagerProps = {
  categories: Category[];
};

export function CategoryManager({ categories }: CategoryManagerProps) {
  const router = useRouter();
  const [rows, setRows] = useState(categories);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("请填写分类名称");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const slug = uniqueSlug(name);
      const { data, error: insertError } = await supabase
        .from("categories")
        .insert({
          name: name.trim(),
          slug,
          description: description.trim(),
          sort_order: (rows.at(-1)?.sort_order ?? 0) + 10,
        })
        .select("*")
        .single();
      if (insertError) throw insertError;
      setRows((prev) => [...prev, data as Category]);
      setName("");
      setDescription("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("删除分类后，其下词条会变成未分类。确定？")) return;
    setError(null);
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("categories")
        .delete()
        .eq("id", id);
      if (deleteError) throw deleteError;
      setRows((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onCreate} className="panel space-y-3 p-4">
        <h2 className="font-display text-base text-foreground">新建分类</h2>
        <input
          className="input"
          placeholder="分类名称，如：技能"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input"
          placeholder="简介（可选）"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-60">
          {saving ? "创建中…" : "创建分类"}
        </button>
      </form>

      {error && (
        <p className="border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <ul className="panel divide-y divide-border overflow-hidden">
        {rows.map((category) => (
          <li
            key={category.id}
            className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="font-display text-foreground">{category.name}</div>
              <div className="font-mono text-xs text-muted">
                /categories/{category.slug}
                {category.description ? ` · ${category.description}` : ""}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onDelete(category.id)}
              className="btn btn-danger self-start"
            >
              删除
            </button>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="px-4 py-6 text-sm text-muted">暂无分类</li>
        )}
      </ul>
    </div>
  );
}
