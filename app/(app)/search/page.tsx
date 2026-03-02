import { Metadata } from "next";
import { MediaSearch } from "@/components/media/MediaSearch";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-900">Search</h1>
      <MediaSearch />
    </div>
  );
}
