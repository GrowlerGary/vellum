"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SetNextUpButtonProps {
  entryId: string;
  isNextUp: boolean;
}

export function SetNextUpButton({ entryId, isNextUp }: SetNextUpButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (isNextUp) {
    return (
      <div className="flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-amber-900">
        <Star className="h-3 w-3 fill-amber-900" />
        Next Up
      </div>
    );
  }

  async function handlePromote() {
    setLoading(true);
    await fetch(`/api/entries/${entryId}/promote`, { method: "POST" });
    router.refresh();
    setLoading(false);
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-6 px-2 text-xs text-zinc-400 hover:text-amber-600"
      disabled={loading}
      onClick={handlePromote}
    >
      <Star className="h-3 w-3" />
      Set Next
    </Button>
  );
}
