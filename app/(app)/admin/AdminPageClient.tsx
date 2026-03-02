"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Shield, User, Film } from "lucide-react";

interface UserRow {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  role: string;
  createdAt: string;
  _count: { entries: number };
}

interface Props { initialUsers: UserRow[] }

export default function AdminPageClient({ initialUsers }: Props) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ username: "", email: "", password: "", displayName: "", role: "USER" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function createUser() {
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json() as UserRow & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to create user");
      setUsers((prev) => [...prev, data]);
      setForm({ username: "", email: "", password: "", displayName: "", role: "USER" });
      setDialogOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-indigo-500" />
          <h1 className="text-2xl font-bold text-zinc-900">Admin</h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> Create user</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create new user</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Username</Label>
                  <Input value={form.username} onChange={(e) => setField("username", e.target.value)} placeholder="jsmith" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Display name</Label>
                  <Input value={form.displayName} onChange={(e) => setField("displayName", e.target.value)} placeholder="John Smith" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} placeholder="john@example.com" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Password</Label>
                <Input type="password" value={form.password} onChange={(e) => setField("password", e.target.value)} placeholder="Min. 8 characters" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setField("role", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">User</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={createUser} disabled={creating || !form.username || !form.email || !form.password}>
                  {creating ? "Creating..." : "Create user"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-zinc-600">User</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600">Email</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600">Role</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600">Entries</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-medium text-indigo-700">
                      {u.username[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-zinc-900">{u.displayName ?? u.username}</div>
                      <div className="text-xs text-zinc-400">@{u.username}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${u.role === "ADMIN" ? "bg-indigo-50 text-indigo-700" : "bg-zinc-100 text-zinc-600"}`}>
                    {u.role === "ADMIN" ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 text-zinc-600">
                    <Film className="h-3.5 w-3.5 text-zinc-400" />
                    {u._count.entries}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
