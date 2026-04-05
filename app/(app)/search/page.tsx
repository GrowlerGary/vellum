import { Metadata } from "next";
import { MediaSearch } from "@/components/media/MediaSearch";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { q, type } = await searchParams;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-900">Search</h1>
      <MediaSearch initialQuery={q ?? ""} initialType={type ?? "all"} />
    </div>
  );
}
