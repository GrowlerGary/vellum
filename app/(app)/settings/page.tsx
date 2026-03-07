"use client";

import { useEffect, useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MEDIA_TYPE_ICONS, MEDIA_TYPE_LABELS } from "@/lib/utils";

// ── Scrobble config ──────────────────────────────────────────────────────────

interface ScrobbleSection {
  source: string;
  label: string;
  description: string;
}

const SCROBBLE_SOURCES: ScrobbleSection[] = [
  {
    source: "TRAKT",
    label: "Trakt",
    description:
      "Automatically scrobbles movies and TV shows when you watch via Trakt-enabled apps.",
  },
  {
    source: "AUDIOBOOKSHELF",
    label: "Audiobookshelf",
    description: "Scrobbles audiobooks from your self-hosted Audiobookshelf server.",
  },
  {
    source: "STREMIO",
    label: "Stremio",
    description: "Scrobbles movies/TV via a Stremio webhook addon.",
  },
];

// ── Sortable category row ────────────────────────────────────────────────────

function SortableCategoryRow({ id }: { id: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-600"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-lg">{MEDIA_TYPE_ICONS[id] ?? "📦"}</span>
      <span className="text-sm font-medium text-zinc-700">
        {MEDIA_TYPE_LABELS[id] ?? id}
      </span>
    </div>
  );
}

// ── Main settings page ───────────────────────────────────────────────────────

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  // Category order
  const [categoryOrder, setCategoryOrder] = useState<string[]>([
    "MOVIE",
    "TV_SHOW",
    "BOOK",
    "AUDIOBOOK",
    "VIDEO_GAME",
  ]);
  const [orderSaved, setOrderSaved] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s: { user?: { id: string } }) => {
        if (s?.user?.id) setUserId(s.user.id);
      })
      .catch(() => {});

    fetch("/api/users/category-order")
      .then((r) => r.json())
      .then((data: { categoryOrder?: string[] }) => {
        if (data.categoryOrder?.length) setCategoryOrder(data.categoryOrder);
      })
      .catch(() => {});
  }, []);

  function getWebhookUrl(source: string): string {
    if (typeof window === "undefined") return "";
    const base = window.location.origin;
    const path = source.toLowerCase();
    return `${base}/api/scrobble/${path}?userId=${userId}`;
  }

  async function copyUrl(source: string) {
    await navigator.clipboard.writeText(getWebhookUrl(source));
    setCopied(source);
    setTimeout(() => setCopied(null), 2000);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = categoryOrder.indexOf(String(active.id));
      const newIndex = categoryOrder.indexOf(String(over.id));
      const newOrder = arrayMove(categoryOrder, oldIndex, newIndex);
      setCategoryOrder(newOrder);

      await fetch("/api/users/category-order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryOrder: newOrder }),
      });

      setOrderSaved(true);
      setTimeout(() => setOrderSaved(false), 2000);
    },
    [categoryOrder]
  );

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-zinc-900">Settings</h1>

      {/* Profile settings */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-zinc-900">Profile</h2>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell people a little about yourself..."
            rows={3}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="isPublic"
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-indigo-600"
          />
          <Label htmlFor="isPublic">Make profile public</Label>
        </div>

        <Button
          onClick={() => {
            setSaving(true);
            setTimeout(() => {
              setSaving(false);
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            }, 500);
          }}
          disabled={saving}
          className="self-start"
        >
          {saving ? (
            "Saving..."
          ) : saved ? (
            <>
              <Check className="h-4 w-4" /> Saved
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </section>

      {/* Category Display Order */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Category Display Order</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Drag to change the order categories appear on your dashboard.
          </p>
          {orderSaved && (
            <p className="mt-1 text-sm text-green-600 flex items-center gap-1">
              <Check className="h-3 w-3" /> Order saved
            </p>
          )}
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={categoryOrder} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {categoryOrder.map((type) => (
                <SortableCategoryRow key={type} id={type} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </section>

      {/* Scrobble webhooks */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Scrobble Webhooks</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Configure your services to send scrobble events to Vellum automatically.
          </p>
        </div>

        {SCROBBLE_SOURCES.map((s) => (
          <div
            key={s.source}
            className="flex flex-col gap-2 pb-4 border-b border-zinc-100 last:border-0 last:pb-0"
          >
            <h3 className="font-medium text-zinc-800">{s.label}</h3>
            <p className="text-sm text-zinc-500">{s.description}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-zinc-50 border border-zinc-200 px-3 py-1.5 text-xs font-mono text-zinc-700 truncate">
                {userId ? getWebhookUrl(s.source) : "Log in to see your webhook URL"}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyUrl(s.source)}
                disabled={!userId}
              >
                {copied === s.source ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
