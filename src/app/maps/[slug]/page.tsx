import { redirect } from "next/navigation";

export default async function MapsSlugRedirect({
  searchParams,
}: {
  searchParams: Promise<{ marker?: string }>;
}) {
  const { marker } = await searchParams;
  redirect(marker ? `/map?marker=${marker}` : "/map");
}
