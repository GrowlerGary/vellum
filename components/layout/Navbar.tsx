"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { BookOpen, Search, LayoutDashboard, List, User, Settings, LogOut, Shield } from "lucide-react";
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
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">

        {/* Logotype */}
        <Link href="/dashboard" className="group flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded border border-[var(--gold-dim)] bg-[var(--bg-raised)] transition-colors group-hover:border-[var(--gold)]">
            <BookOpen className="h-3.5 w-3.5 text-[var(--gold)]" />
          </div>
          <span className="font-display text-xl italic font-semibold tracking-wide text-[var(--text)] transition-colors group-hover:text-[var(--gold)]">
            Vellum
          </span>
        </Link>

        {/* Primary nav */}
        <nav className="hidden md:flex items-center gap-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "text-[var(--gold)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {active && (
                  <span className="absolute bottom-0 left-3 right-3 h-px rounded-full bg-[var(--gold)] opacity-60" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User controls */}
        <div className="flex items-center gap-0.5">
          {role === "ADMIN" && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--text)]"
            >
              <Shield className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
          <Link
            href={`/profile/${username}`}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--text)]"
          >
            <User className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{username}</span>
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--text)]"
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--text)]"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="flex md:hidden border-t border-[var(--border)] bg-[var(--bg-surface)] overflow-x-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center py-2 text-xs font-medium transition-colors min-w-[64px]",
                active ? "text-[var(--gold)]" : "text-[var(--text-muted)]"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
        <Link
          href="/settings"
          className="flex flex-1 flex-col items-center py-2 text-xs font-medium text-[var(--text-muted)] min-w-[64px]"
        >
          <Settings className="h-5 w-5" />
          Settings
        </Link>
        <Link
          href={`/profile/${username}`}
          className="flex flex-1 flex-col items-center py-2 text-xs font-medium text-[var(--text-muted)] min-w-[64px]"
        >
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
