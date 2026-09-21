import { redirect } from "next/navigation";

export default async function LegacyEditArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/entries/${slug}/edit`);
}
