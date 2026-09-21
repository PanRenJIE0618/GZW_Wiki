import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TipTapRenderer } from "@/components/TipTapRenderer";
import { EntryInfobox } from "@/components/EntryInfobox";
import { ContributorsPanel } from "@/components/ContributorsPanel";
import { CommentSection } from "@/components/CommentSection";
import { EntryLayers } from "@/components/EntryLayers";
import { EntryMapLinks } from "@/components/EntryMapLinks";
import { getCurrentProfile, getSessionUser } from "@/lib/auth";
import { loadEntryBySlug } from "@/lib/entries";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  canEdit,
  isAdmin,
  normalizeGallery,
  normalizeParams,
  type ArticleComment,
  type ArticleContributor,
  type ArticleWithRelations,
  type MapLayer,
  type MapLayerPoint,
  type MapLayerWithPoints,
  type MapMarkerWithMap,
  type Profile,
} from "@/lib/types";

type LayerRow = MapLayer & {
  map_layer_points?: MapLayerPoint[] | null;
};

function normalizeLinkedLayers(
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

export const dynamic = "force-dynamic";

export default async function EntryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!hasSupabaseEnv()) notFound();

  const { slug } = await params;
  const profile = await getCurrentProfile();
  const user = await getSessionUser();
  const supabase = await createClient();

  const loaded = await loadEntryBySlug(slug);

  let decodedSlug = slug;
  try {
    decodedSlug = decodeURIComponent(slug);
  } catch {
    decodedSlug = slug;
  }

  if (loaded.redirectTo && loaded.redirectTo !== decodedSlug) {
    redirect(`/entries/${loaded.redirectTo}`);
  }

  if (loaded.error) {
    return (
      <div className="panel mx-auto max-w-lg space-y-3 p-6">
        <p className="hud-label">Query Fault</p>
        <h1 className="title-name title-name-md text-warn">词条加载失败</h1>
        <p className="font-mono text-xs text-muted">{loaded.error}</p>
        <p className="text-sm text-muted">
          若刚跑过贡献值 SQL 未成功，请先完成{" "}
          <code className="text-accent">005_contributors.sql</code>。
        </p>
        <Link href="/" className="btn btn-primary inline-flex">
          返回首页
        </Link>
      </div>
    );
  }

  if (!loaded.entry) {
    return (
      <div className="panel mx-auto max-w-lg space-y-4 p-6 text-center">
        <p className="hud-label">Signal Lost</p>
        <h1 className="title-name title-name-md">未找到词条</h1>
        <p className="text-sm text-muted">
          没有 slug 为{" "}
          <code className="text-accent">{decodedSlug}</code>{" "}
          的词条。
        </p>
        {loaded.suggestions.length > 0 && (
          <div className="space-y-2 text-left">
            <p className="hud-label">可能是这些？</p>
            <ul className="space-y-1">
              {loaded.suggestions.map((s) => (
                <li key={s}>
                  <Link href={`/entries/${s}`} className="text-sm text-accent underline">
                    /entries/{s}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Link href="/" className="btn btn-primary">
            返回首页
          </Link>
          <Link href="/entries/new" className="btn btn-ghost">
            新建词条
          </Link>
        </div>
      </div>
    );
  }

  const data = loaded.entry as ArticleWithRelations & {
    author_id: string;
    last_editor_id: string | null;
  };

  // Load author / last editor separately (works even if last_editor_id missing)
  const profileIds = [data.author_id, data.last_editor_id].filter(
    Boolean,
  ) as string[];

  let profileRows: Profile[] = [];
  if (profileIds.length) {
    const full = await supabase
      .from("profiles")
      .select("id, display_name, role, contribution_points")
      .in("id", profileIds);
    if (full.error) {
      const basic = await supabase
        .from("profiles")
        .select("id, display_name, role")
        .in("id", profileIds);
      profileRows = (basic.data ?? []).map((p) => ({
        ...p,
        contribution_points: 0,
        created_at: "",
        updated_at: "",
      })) as Profile[];
    } else {
      profileRows = (full.data ?? []) as Profile[];
    }
  }

  const profileMap = new Map(
    (profileRows ?? []).map((p) => [p.id, p as Profile]),
  );

  const entry = {
    ...data,
    params: normalizeParams(data.params),
    gallery: normalizeGallery(data.gallery),
    profiles: profileMap.get(data.author_id)
      ? {
          display_name: profileMap.get(data.author_id)!.display_name,
          role: profileMap.get(data.author_id)!.role,
          contribution_points:
            profileMap.get(data.author_id)!.contribution_points ?? 0,
        }
      : null,
    last_editor: data.last_editor_id
      ? profileMap.get(data.last_editor_id)
        ? {
            id: data.last_editor_id,
            display_name: profileMap.get(data.last_editor_id)!.display_name,
            contribution_points:
              profileMap.get(data.last_editor_id)!.contribution_points ?? 0,
          }
        : null
      : null,
  } as ArticleWithRelations;

  if (entry.status !== "published" && !canEdit(profile?.role)) {
    notFound();
  }

  const { data: contributorRows } = await supabase
    .from("article_contributors")
    .select("*, profiles(display_name, role, contribution_points)")
    .eq("article_id", entry.id)
    .order("points", { ascending: false });

  const contributors = (contributorRows ?? []) as ArticleContributor[];

  const { data: commentRows } = await supabase
    .from("article_comments")
    .select("*, profiles(display_name, role)")
    .eq("article_id", entry.id)
    .order("created_at", { ascending: true });

  const comments = (commentRows ?? []) as ArticleComment[];

  const { data: linkedMarkers } = await supabase
    .from("map_markers")
    .select(
      "*, maps(id, name, slug, image_url, status)",
    )
    .eq("article_id", entry.id)
    .order("updated_at", { ascending: false });

  const mapLinks = ((linkedMarkers ?? []) as MapMarkerWithMap[]).filter(
    (m) =>
      m.maps &&
      (m.maps.status === "published" || canEdit(profile?.role)),
  );

  const layerQuery = await supabase
    .from("map_layers")
    .select("*, map_layer_points(*)")
    .eq("article_id", entry.id)
    .order("sort_order", { ascending: true });

  const linkedLayersRaw = layerQuery.error
    ? []
    : normalizeLinkedLayers(layerQuery.data as LayerRow[] | null);

  const linkedLayers = canEdit(profile?.role)
    ? linkedLayersRaw
    : linkedLayersRaw.filter((layer) => layer.status === "published");

  const category = entry.categories;

  return (
    <article className="space-y-6">
      <p className="font-mono text-xs text-muted">
        <Link href="/" className="hover:text-accent">
          INDEX
        </Link>
        {category && (
          <>
            <span className="mx-2 text-border-strong">/</span>
            <Link
              href={`/categories/${category.slug}`}
              className="hover:text-accent"
            >
              {category.name}
            </Link>
          </>
        )}
        <span className="mx-2 text-border-strong">/</span>
        <span className="text-accent">{entry.title}</span>
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="section-rule">
            <p className="hud-label shrink-0">Entry Dossier</p>
          </div>
          <h1 className="title-name title-name-lg">{entry.title}</h1>
          {entry.summary && (
            <p className="max-w-2xl text-base text-muted sm:text-lg">
              {entry.summary}
            </p>
          )}
          <div className="meta-row">
            <span>
              创建者{" "}
              <span className="text-foreground">
                {entry.profiles?.display_name ?? "UNKNOWN"}
              </span>
            </span>
            <span className="meta-sep" />
            <span>
              最后修改{" "}
              <span className="text-foreground">
                {new Date(entry.updated_at).toLocaleString("zh-CN")}
              </span>
            </span>
            <span className="meta-sep" />
            <span>
              最近编辑{" "}
              <span className="text-accent">
                {entry.last_editor?.display_name ??
                  entry.profiles?.display_name ??
                  "—"}
              </span>
            </span>
            <span className="meta-sep" />
            <span>
              {entry.status === "published" ? "PUBLISHED" : "DRAFT"}
            </span>
          </div>
        </div>
        {canEdit(profile?.role) && (
          <Link
            href={`/entries/${entry.slug}/edit`}
            className="btn btn-ghost self-start"
          >
            编辑档案
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="order-2 space-y-6 lg:order-1">
          {entry.gallery.length > 0 && (
            <section className="space-y-3">
              <p className="hud-label">Visuals</p>
              <h2 className="font-display text-lg text-foreground">图集</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                {entry.gallery.map((url, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${url}-${index}`}
                    src={url}
                    alt={`${entry.title} 图 ${index + 1}`}
                    className="aspect-square w-full border border-border object-cover"
                  />
                ))}
              </div>
            </section>
          )}

          <section className="panel p-4 sm:p-6">
            <p className="hud-label mb-2">Briefing</p>
            <h2 className="mb-4 font-display text-lg text-foreground">
              详细说明
            </h2>
            <TipTapRenderer
              content={entry.content as Record<string, unknown>}
            />
          </section>

          <div className="lg:hidden">
            <ContributorsPanel
              contributors={contributors}
              updatedAt={entry.updated_at}
              lastEditorName={
                entry.last_editor?.display_name ??
                entry.profiles?.display_name ??
                null
              }
            />
          </div>
        </div>

        <div className="order-1 space-y-4 lg:order-2 lg:sticky lg:top-20 lg:self-start">
          <EntryInfobox
            title={entry.title}
            coverUrl={entry.cover_url}
            params={entry.params}
          />
          <EntryMapLinks markers={mapLinks} />
          <EntryLayers layers={linkedLayers} />
          <div className="hidden lg:block">
            <ContributorsPanel
              contributors={contributors}
              updatedAt={entry.updated_at}
              lastEditorName={
                entry.last_editor?.display_name ??
                entry.profiles?.display_name ??
                null
              }
            />
          </div>
        </div>
      </div>

      <CommentSection
        articleId={entry.id}
        articleSlug={entry.slug}
        initialComments={comments}
        currentUserId={user?.id ?? null}
        isAdmin={isAdmin(profile?.role)}
      />
    </article>
  );
}
