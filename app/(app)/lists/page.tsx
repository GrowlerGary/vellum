"use client";

import { useEffect, useState } from "react";
import { Plus, List as ListIcon, Trash2, Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface MediaItem {
  id: string;
  title: string;
  type: string;
  year: number | null;
}

interface ListItemEntry {
  id: string;
  mediaItem: MediaItem;
}

interface MediaList {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  items: ListItemEntry[];
  createdAt: string;
}

export default function ListsPage() {
  const [lists, setLists] = useState<MediaList[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function fetchLists() {
    setLoading(true);
    const res = await fetch("/api/lists");
    const data = await res.json() as MediaList[];
    setLists(data);
    setLoading(false);
  }

  useEffect(() => { fetchLists(); }, []);

  async function createList() {
    if (!newName.trim()) return;
    setCreating(true);
    await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, description: newDesc || null }),
    });
    setNewName(""); setNewDesc("");
    setDialogOpen(false);
    setCreating(false);
    fetchLists();
  }

  async function deleteList(id: string) {
    if (!confirm("Delete this list?")) return;
    await fetch(`/api/lists/${id}`, { method: "DELETE" });
    setLists((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">My Lists</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> New list</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create a new list</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-4 mt-2">
              <div className="flex flex-col gap-1.5">
                <Label>Name</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My favourite films" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Description (optional)</Label>
                <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="..." />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={createList} disabled={creating || !newName.trim()}>
                  {creating ? "Creating..." : "Create"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading && <p className="text-zinc-500">Loading...</p>}

      {!loading && lists.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <ListIcon className="h-12 w-12 text-zinc-200" />
          <p className="text-zinc-500">No lists yet. Create your first one!</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lists.map((list) => (
          <div key={list.id} className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  {list.isPublic ? (
                    <Globe className="h-3.5 w-3.5 text-zinc-400" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-zinc-400" />
                  )}
                  <h3 className="font-semibold text-zinc-900">{list.name}</h3>
                </div>
                {list.description && (
                  <p className="text-sm text-zinc-500 mt-0.5">{list.description}</p>
                )}
              </div>
              <button
                onClick={() => deleteList(list.id)}
                className="text-zinc-300 hover:text-red-500 shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-400">{list.items.length} item{list.items.length !== 1 ? "s" : ""}</p>
            {list.items.slice(0, 3).map((item) => (
              <div key={item.id} className="text-sm text-zinc-700 truncate">
                {item.mediaItem.title}
                {item.mediaItem.year ? ` (${item.mediaItem.year})` : ""}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
