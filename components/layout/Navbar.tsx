"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Film, Search, LayoutDashboard, List, User, Settings, LogOut, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavbarProps {
  username: string;
  role: string;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/search", label: "Search", icon: Search },
  { href: "/lists", label: "Lists", icon: List },
];

export function Navbar({ username, role }: NavbarProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-indigo-600 text-lg">
          <Film className="h-5 w-5" />
          Vellum
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1">
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

        {/* User menu */}
        <div className="flex items-center gap-2">
          {role === "ADMIN" && (
            <Link href="/admin" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
          <Link href={`/profile/${username}`} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{username}</span>
          </Link>
          <Link href="/settings" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100">
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
        {navItems.map(({ href, label, icon: Icon }) => (
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
        <Link href="/settings" className="flex flex-1 flex-col items-center py-2 text-xs font-medium text-zinc-500 min-w-[64px]">
          <Settings className="h-5 w-5" />
          Settings
        </Link>
        <Link href={`/profile/${username}`} className="flex flex-1 flex-col items-center py-2 text-xs font-medium text-zinc-500 min-w-[64px]">
          <User className="h-5 w-5" />
          Profile
        </Link>
      </nav>
    </header>
  );
}

// Server component wrapper to avoid client-side session fetch in layout
export function NavbarWrapper({ username, role }: NavbarProps) {
  return <Navbar username={username} role={role} />;
}
