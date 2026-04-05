"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Film,
  Search,
  LayoutDashboard,
  List,
  User,
  Settings,
  LogOut,
  Shield,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn, MEDIA_TYPE_LABELS } from "@/lib/utils";

interface NavbarProps {
  username: string;
  role: string;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lists", label: "Lists", icon: List },
];

// Mobile nav still shows Search link so mobile users can reach the search page
const mobileNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/search", label: "Search", icon: Search },
  { href: "/lists", label: "Lists", icon: List },
];

export function Navbar({ username, role }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("all");
  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    const params = new URLSearchParams({ q });
    if (searchType !== "all") params.set("type", searchType);
    router.push(`/search?${params}`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-bold text-indigo-600 text-lg shrink-0"
        >
          <Film className="h-5 w-5" />
          <span className="hidden sm:inline">Vellum</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 shrink-0">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                pathname.startsWith(href)
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Inline search — desktop only */}
        <form
          onSubmit={handleSearch}
          className="hidden md:flex items-center gap-2 flex-1 max-w-lg"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search movies, shows, books…"
              className="pl-9 py-1.5 h-8"
            />
          </div>
          <Select value={searchType} onValueChange={setSearchType}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Object.entries(MEDIA_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shrink-0"
          >
            Search
          </button>
        </form>

        {/* User menu */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {role === "ADMIN" && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
            >
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
          <Link
            href={`/profile/${username}`}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{username}</span>
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="flex md:hidden border-t border-zinc-100 overflow-x-auto">
        {mobileNavItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center py-2 text-xs font-medium transition-colors min-w-[64px]",
              pathname.startsWith(href) ? "text-indigo-600" : "text-zinc-500"
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
        <Link
          href="/settings"
          className="flex flex-1 flex-col items-center py-2 text-xs font-medium text-zinc-500 min-w-[64px]"
        >
          <Settings className="h-5 w-5" />
          Settings
        </Link>
        <Link
          href={`/profile/${username}`}
          className="flex flex-1 flex-col items-center py-2 text-xs font-medium text-zinc-500 min-w-[64px]"
        >
          <User className="h-5 w-5" />
          Profile
        </Link>
      </nav>
    </header>
  );
}

export function NavbarWrapper({ username, role }: NavbarProps) {
  return <Navbar username={username} role={role} />;
}
