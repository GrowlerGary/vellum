"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, Copy } from "lucide-react";

interface ScrobbleSection {
  source: string;
  label: string;
  description: string;
  docUrl: string;
}

const SCROBBLE_SOURCES: ScrobbleSection[] = [
  {
    source: "TRAKT",
    label: "Trakt",
    description: "Automatically scrobbles movies and TV shows when you watch via Trakt-enabled apps.",
    docUrl: "https://trakt.tv/settings/apps",
  },
  {
    source: "AUDIOBOOKSHELF",
    label: "Audiobookshelf",
    description: "Scrobbles audiobooks from your self-hosted Audiobookshelf server.",
    docUrl: "https://www.audiobookshelf.org",
  },
  {
    source: "STREMIO",
    label: "Stremio",
    description: "Scrobbles movies/TV via a Stremio webhook addon.",
    docUrl: "https://stremio.com",
  },
];

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    // Get session user id for webhook URLs
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s: { user?: { id: string } }) => {
        if (s?.user?.id) setUserId(s.user.id);
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

        <Button onClick={() => { setSaving(true); setTimeout(() => { setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }, 500); }} disabled={saving} className="self-start">
          {saving ? "Saving..." : saved ? <><Check className="h-4 w-4" /> Saved</> : "Save changes"}
        </Button>
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
          <div key={s.source} className="flex flex-col gap-2 pb-4 border-b border-zinc-100 last:border-0 last:pb-0">
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
                {copied === s.source ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
