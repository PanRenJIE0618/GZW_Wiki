import { notFound, redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Supports nested URLs like /categories/{categorySlug}/{entrySlug}
 * and redirects to the canonical /entries/{entrySlug}.
 * Also accepts entry UUID in the last segment.
 */
export default async function NestedCategoryEntryPage({
  params,
}: {
  params: Promise<{ slug: string; entry: string }>;
}) {
  if (!hasSupabaseEnv()) notFound();

  const { slug: categorySlug, entry: entryKey } = await params;
  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("id, slug")
    .eq("slug", categorySlug)
    .maybeSingle();

  if (!category) notFound();

  // Prefer slug match within this category
  let { data: article } = await supabase
    .from("articles")
    .select("slug, category_id")
    .eq("slug", entryKey)
    .maybeSingle();

  // Fallback: treat segment as article id
  if (!article) {
    const byId = await supabase
      .from("articles")
      .select("slug, category_id")
      .eq("id", entryKey)
      .maybeSingle();
    article = byId.data;
  }

  // Fallback: slug contains key (e.g. partial / short id)
  if (!article) {
    const { data: candidates } = await supabase
      .from("articles")
      .select("slug, category_id")
      .eq("category_id", category.id)
      .ilike("slug", `%${entryKey}%`)
      .limit(5);

    if (candidates?.length === 1) {
      article = candidates[0];
    } else if (candidates && candidates.length > 1) {
      const exactSuffix = candidates.find((c) =>
        c.slug.endsWith(`-${entryKey}`),
      );
      article = exactSuffix ?? candidates[0];
    }
  }

  if (!article) notFound();

  redirect(`/entries/${article.slug}`);
}
