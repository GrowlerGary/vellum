"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingWidgetProps {
  value: number | null;
  onChange?: (rating: number | null) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
}

export function RatingWidget({ value, onChange, readonly = false, size = "md" }: RatingWidgetProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const display = hovered ?? value ?? 0;
  const starSizes = { sm: "h-3.5 w-3.5", md: "h-5 w-5", lg: "h-7 w-7" };
  const starSize = starSizes[size];

  function getStarFill(star: number): "full" | "half" | "empty" {
    if (display >= star) return "full";
    if (display >= star - 0.5) return "half";
    return "empty";
  }

  function handleClick(star: number, half: boolean) {
    if (readonly || !onChange) return;
    const newRating = half ? star - 0.5 : star;
    onChange(newRating === value ? null : newRating);
  }

  return (
    <div className={cn("flex items-center gap-0.5", readonly ? "cursor-default" : "cursor-pointer")}>
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = getStarFill(star);
        return (
          <div
            key={star}
            className="relative"
            onMouseLeave={() => !readonly && setHovered(null)}
          >
            {/* Left half hover zone */}
            {!readonly && (
              <>
                <div
                  className="absolute left-0 top-0 h-full w-1/2 z-10"
                  onMouseEnter={() => setHovered(star - 0.5)}
                  onClick={() => handleClick(star, true)}
                />
                <div
                  className="absolute right-0 top-0 h-full w-1/2 z-10"
                  onMouseEnter={() => setHovered(star)}
                  onClick={() => handleClick(star, false)}
                />
              </>
            )}
            <div className="relative">
              {/* Background (empty) star */}
              <Star className={cn(starSize, "text-zinc-200")} fill="currentColor" />
              {/* Filled overlay */}
              {fill !== "empty" && (
                <div
                  className={cn(
                    "absolute inset-0 overflow-hidden",
                    fill === "half" ? "w-1/2" : "w-full"
                  )}
                >
                  <Star className={cn(starSize, "text-amber-400")} fill="currentColor" />
                </div>
              )}
            </div>
          </div>
        );
      })}
      {value && !readonly && (
        <span className="ml-1 text-xs text-zinc-500">{value.toFixed(1)}</span>
      )}
    </div>
  );
}

// Display-only compact rating
export function RatingDisplay({ value, size = "sm" }: { value: number | null; size?: "sm" | "md" | "lg" }) {
  return <RatingWidget value={value} readonly size={size} />;
}
