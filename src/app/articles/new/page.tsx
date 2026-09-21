import { redirect } from "next/navigation";

export default function LegacyNewArticlePage() {
  redirect("/entries/new");
}
