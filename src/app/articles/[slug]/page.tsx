import { redirect } from "next/navigation";

export default async function LegacyArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/entries/${slug}`);
}
