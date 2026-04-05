# Vellum UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Vellum dashboard with a sticky type filter bar, section-level collapsing, inline navbar search, and improved Discover layout.

**Architecture:** All changes are to existing client components (`DashboardClient`, `Navbar`, `DiscoverSection`, `MediaSearch`) and the search server route/page. No new API routes or Prisma changes needed. The type filter state lives in `DashboardClient` and is passed down to `DashboardSection` components.

**Tech Stack:** Next.js 15 (App Router), React, TypeScript, Tailwind CSS, Vitest for tests.

---

### Task 1: Navbar inline search bar

Replace the "Search" nav link on desktop with an inline `[text input] [type dropdown] [search button]` form. On mobile, keep the Search link as-is (mobile users search on the search page).

**Files:**
- Modify: `components/layout/Navbar.tsx`

**Step 1: Read the current file**

```bash
cat -n components/layout/Navbar.tsx
```

Expected: You already know the content from the plan. Confirm line 15-18 has `navItems` array with a `{ href: "/search", label: "Search", icon: Search }` entry.

**Step 2: Implement the inline search bar**

Replace the entire file content with the following. Key changes:
- Import `useRouter`, `useState`, `useRef` from react/next
- Remove `Search` from `navItems` (desktop nav only — mobile nav keeps it)
- Add an inline search form between the logo and the desktop nav (or between nav and user menu — put it between nav and user menu for visual balance)

```tsx
"use client";

import { useState, useRef } from "react";
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
import { cn } from "@/lib/utils";
import { MEDIA_TYPE_LABELS } from "@/lib/utils";

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
  const inputRef = useRef<HTMLInputElement>(null);

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
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search movies, shows, books…"
              className="w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
```

**Step 3: Run the dev server to verify visually**

```bash
npm run dev
```

Open `http://localhost:3000/dashboard`. You should see the inline search bar between the nav links and user menu on desktop. Mobile should still show Dashboard / Search / Lists tabs at the bottom.

**Step 4: Commit**

```bash
git add components/layout/Navbar.tsx
git commit -m "feat: replace Search nav link with inline search bar on desktop"
```

---

### Task 2: Search page pre-fills from URL params

The search page currently renders `<MediaSearch />` with no props. We need it to read `?q=` and `?type=` from the URL and pre-fill the form, then immediately trigger a search.

**Files:**
- Modify: `app/(app)/search/page.tsx`
- Modify: `components/media/MediaSearch.tsx`

**Step 1: Add `initialQuery` and `initialType` props to MediaSearch**

Open `components/media/MediaSearch.tsx`. Change the component signature and add a `useEffect` to trigger an initial search.

Current signature (line 24):
```tsx
export function MediaSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
```

Replace with:
```tsx
interface MediaSearchProps {
  initialQuery?: string;
  initialType?: string;
}

export function MediaSearch({ initialQuery = "", initialType = "all" }: MediaSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState(initialType);
```

Then add a `useEffect` after the existing state declarations (after line 31, before `const search = useCallback`):

```tsx
  // Trigger search if pre-filled from URL params
  useEffect(() => {
    if (initialQuery.length >= 2) {
      search(initialQuery, initialType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only
```

You'll need to add `useEffect` to the imports at line 3:
```tsx
import { useState, useCallback, useRef, useEffect } from "react";
```

**Step 2: Update search/page.tsx to pass URL params**

Replace the entire file:

```tsx
import { Metadata } from "next";
import { MediaSearch } from "@/components/media/MediaSearch";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { q, type } = await searchParams;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-900">Search</h1>
      <MediaSearch initialQuery={q ?? ""} initialType={type ?? "all"} />
    </div>
  );
}
```

**Step 3: Verify manually**

In the navbar search bar, type "inception" and click Search. You should land on `/search?q=inception` with results already loaded.

**Step 4: Commit**

```bash
git add app/(app)/search/page.tsx components/media/MediaSearch.tsx
git commit -m "feat: pre-fill search page from navbar query URL params"
```

---

### Task 3: Increase search result limits

Four metadata sources each have hard-coded limits. Increase them all to 20.

**Files:**
- Modify: `lib/metadata/tmdb.ts` (line 173)
- Modify: `lib/metadata/igdb.ts` (line 105)
- Modify: `lib/metadata/hardcover.ts` (line 94)
- Modify: `lib/metadata/audnexus.ts` (line 100)

**Step 1: TMDB — increase from 10 to 20**

In `lib/metadata/tmdb.ts`, find line 173:
```ts
    .slice(0, 10);
```
Change to:
```ts
    .slice(0, 20);
```

**Step 2: IGDB — increase from 10 to 20**

In `lib/metadata/igdb.ts`, find line 105 (the search body string):
```ts
  const body = `search "${query}"; fields name,summary,first_release_date,cover.image_id,screenshots.image_id,genres.name,rating; limit 10;`;
```
Change to:
```ts
  const body = `search "${query}"; fields name,summary,first_release_date,cover.image_id,screenshots.image_id,genres.name,rating; limit 20;`;
```

**Step 3: Hardcover — increase from 10 to 20**

In `lib/metadata/hardcover.ts`, find line 94:
```ts
      search(query: $q, query_type: "Book", per_page: 10) {
```
Change to:
```ts
      search(query: $q, query_type: "Book", per_page: 20) {
```

**Step 4: Audnexus — increase from 10 to 20**

In `lib/metadata/audnexus.ts`, find line 100:
```ts
    const url = `https://api.audible.com/1.0/catalog/products?num_results=10&products_sort_by=Relevance&title=${encodeURIComponent(query)}`
```
Change to:
```ts
    const url = `https://api.audible.com/1.0/catalog/products?num_results=20&products_sort_by=Relevance&title=${encodeURIComponent(query)}`
```

**Step 5: Verify manually**

Search for a common term like "star" with "All types". Confirm more results appear than before.

**Step 6: Commit**

```bash
git add lib/metadata/tmdb.ts lib/metadata/igdb.ts lib/metadata/hardcover.ts lib/metadata/audnexus.ts
git commit -m "feat: increase search result limits from 10 to 20 across all sources"
```

---

### Task 4: Dashboard — remove stats grid

Remove the stats grid from the dashboard. This involves removing the `statsByType` computation in the server page and the grid JSX in the client component.

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`
- Modify: `app/(app)/dashboard/DashboardClient.tsx`

**Step 1: Remove statsByType from page.tsx**

In `app/(app)/dashboard/page.tsx`:

1. Remove the `statsByType` computation block (lines 42–53):
```ts
  const statsByType = DEFAULT_CATEGORY_ORDER.map((type) => {
    const typeEntries = entries.filter((e) => e.mediaItem.type === type);
    return {
      type,
      label: MEDIA_TYPE_LABELS[type] ?? type,
      icon: MEDIA_TYPE_ICONS[type] ?? "📦",
      total: typeEntries.length,
      completed: typeEntries.filter((e) => e.status === "COMPLETED").length,
      inProgress: typeEntries.filter((e) => e.status === "IN_PROGRESS").length,
      want: typeEntries.filter((e) => e.status === "WANT").length,
    };
  });
```

2. Remove `statsByType={statsByType}` from the `<DashboardClient>` JSX (line 83).

3. Remove the `MEDIA_TYPE_LABELS, MEDIA_TYPE_ICONS` import at line 3 if they are no longer used after removing statsByType. (Check: they're only used in statsByType, so remove the import.)

Final `page.tsx` should look like:

```tsx
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DashboardClient } from "./DashboardClient";
import { redirect } from "next/navigation";

export const metadata = { title: "Dashboard" };

const DEFAULT_CATEGORY_ORDER = ["MOVIE", "TV_SHOW", "BOOK", "AUDIOBOOK", "VIDEO_GAME"];

async function fetchEntries(userId: string) {
  return db.mediaEntry.findMany({
    where: { userId },
    include: { mediaItem: true, listeningProgress: true },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
  });
}

async function fetchCategoryOrder(userId: string): Promise<string[]> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { categoryOrder: true },
  });
  return user?.categoryOrder?.length ? user.categoryOrder : DEFAULT_CATEGORY_ORDER;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [entries, categoryOrder] = await Promise.all([
    fetchEntries(session.user.id),
    fetchCategoryOrder(session.user.id),
  ]);

  const inProgress = entries.filter((e) => e.status === "IN_PROGRESS");
  const wantEntries = entries.filter((e) => e.status === "WANT");
  const recentCompleted = entries
    .filter((e) => e.status === "COMPLETED")
    .slice(0, 12);

  const serialize = (arr: typeof entries) =>
    JSON.parse(JSON.stringify(arr)) as {
      id: string;
      status: string;
      rating: number | null;
      sortOrder: number;
      mediaItem: {
        id: string;
        type: string;
        title: string;
        year: number | null;
        posterUrl: string | null;
        metadata?: Record<string, unknown> | null;
      };
      listeningProgress: {
        progress: number;
        currentChapter: string | null;
      } | null;
    }[];

  return (
    <DashboardClient
      userName={session.user.name}
      inProgress={serialize(inProgress)}
      wantEntries={serialize(wantEntries)}
      recentCompleted={serialize(recentCompleted)}
      categoryOrder={categoryOrder}
      isEmpty={entries.length === 0}
    />
  );
}
```

**Step 2: Remove statsByType from DashboardClient.tsx**

In `app/(app)/dashboard/DashboardClient.tsx`:

1. Remove the `StatData` interface (lines 54–62).
2. Remove `statsByType: StatData[]` from `DashboardClientProps` (line 69).
3. Remove `statsByType` from the destructured props in `DashboardClient` (line 315).
4. Remove the stats grid JSX block (lines 341–353):
```tsx
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {statsByType.map((s) => (
          <div key={s.type} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-sm font-medium text-zinc-700">{s.label}</div>
            <div className="text-2xl font-bold text-zinc-900">{s.total}</div>
            <div className="text-xs text-zinc-400 mt-1">
              {s.completed} done · {s.inProgress} in progress
            </div>
          </div>
        ))}
      </div>
```

**Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors related to `statsByType`.

**Step 4: Commit**

```bash
git add app/(app)/dashboard/page.tsx app/(app)/dashboard/DashboardClient.tsx
git commit -m "feat: remove stats grid from dashboard"
```

---

### Task 5: Dashboard — sticky type filter bar

Add a sticky pill filter bar below the header that filters all three status sections by media type.

**Files:**
- Modify: `app/(app)/dashboard/DashboardClient.tsx`

**Step 1: Add filter state and filter bar JSX**

In `DashboardClient.tsx`, make the following changes:

1. Add `activeFilter` state to `DashboardClient`:

After the existing imports at the top of the file (around line 3), no new imports needed — `cn` and `MEDIA_TYPE_LABELS`/`MEDIA_TYPE_ICONS` are already imported.

In the `DashboardClient` function body (around line 308), add state:
```tsx
  const [activeFilter, setActiveFilter] = useState<string>('all')
```

2. Add a `FILTER_OPTIONS` constant near the top of the file (after the `groupByType` helper, around line 85):

```tsx
const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'MOVIE', label: MEDIA_TYPE_LABELS['MOVIE'] },
  { value: 'TV_SHOW', label: MEDIA_TYPE_LABELS['TV_SHOW'] },
  { value: 'BOOK', label: MEDIA_TYPE_LABELS['BOOK'] },
  { value: 'AUDIOBOOK', label: MEDIA_TYPE_LABELS['AUDIOBOOK'] },
  { value: 'VIDEO_GAME', label: MEDIA_TYPE_LABELS['VIDEO_GAME'] },
]
```

3. Add the filter bar JSX between the header div and the first `<DashboardSection>`, replacing the old gap between header and sections. Insert after the closing `</div>` of the header block (after line 339):

```tsx
      {/* Sticky type filter bar */}
      <div className="sticky top-14 z-30 -mx-4 px-4 py-2 bg-white/90 backdrop-blur-sm border-b border-zinc-100">
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setActiveFilter(value)}
              className={cn(
                'flex-shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors',
                activeFilter === value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
```

4. Pass `activeFilter` to all three `<DashboardSection>` calls (lines 355–376). Add `activeFilter={activeFilter}` prop to each:

```tsx
      <DashboardSection
        sectionKey="in-progress"
        title="Currently Consuming"
        entries={inProgress}
        categoryOrder={categoryOrder}
        activeFilter={activeFilter}
      />

      <DashboardSection
        sectionKey="want"
        title="Want to Consume"
        entries={wantEntries}
        categoryOrder={categoryOrder}
        showNextUp
        sortable
        activeFilter={activeFilter}
      />

      <DashboardSection
        sectionKey="completed"
        title="Recently Consumed"
        entries={recentCompleted}
        categoryOrder={categoryOrder}
        activeFilter={activeFilter}
      />
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: errors about `activeFilter` prop not existing on `SectionProps` — that's expected and will be fixed in Task 6.

**Step 3: Commit**

```bash
git add app/(app)/dashboard/DashboardClient.tsx
git commit -m "feat: add sticky type filter bar to dashboard"
```

---

### Task 6: DashboardSection — type filtering + section-level collapse

Update `DashboardSection` to:
- Accept and apply the `activeFilter` prop
- Have a section-level collapse/expand toggle
- Show the section header with count even when empty (auto-collapsed to 0)

**Files:**
- Modify: `app/(app)/dashboard/DashboardClient.tsx` (the `DashboardSection` and `SectionProps` types within it)

**Step 1: Update SectionProps interface**

Find the `SectionProps` interface (lines 211–218):
```tsx
interface SectionProps {
  sectionKey: string
  title: string
  entries: EntryData[]
  categoryOrder: string[]
  showNextUp?: boolean
  sortable?: boolean
}
```

Replace with:
```tsx
interface SectionProps {
  sectionKey: string
  title: string
  entries: EntryData[]
  categoryOrder: string[]
  showNextUp?: boolean
  sortable?: boolean
  activeFilter: string
}
```

**Step 2: Rewrite the DashboardSection component**

Find the `DashboardSection` function (lines 220–304) and replace entirely with:

```tsx
function DashboardSection({
  sectionKey,
  title,
  entries,
  categoryOrder,
  showNextUp,
  sortable,
  activeFilter,
}: SectionProps) {
  // Filter entries by active type filter
  const filteredEntries =
    activeFilter === 'all'
      ? entries
      : entries.filter((e) => e.mediaItem.type === activeFilter)

  // Section-level collapse: auto-collapse when no matching entries
  const [manualCollapsed, setManualCollapsed] = useState(false)
  const isCollapsed = filteredEntries.length === 0 ? true : manualCollapsed

  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({})

  const groups = groupByType(filteredEntries)
  const activeTypes = categoryOrder.filter((t) => (groups[t]?.length ?? 0) > 0)

  const toggleType = (type: string) => {
    setExpandedTypes((prev) => ({ ...prev, [type]: !prev[type] }))
  }

  return (
    <section>
      {/* Section header — always visible */}
      <button
        onClick={() => {
          if (filteredEntries.length > 0) setManualCollapsed((v) => !v)
        }}
        className="flex items-center gap-2 w-full text-left mb-4 group"
        aria-expanded={!isCollapsed}
      >
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        <span className="text-sm text-zinc-400">({filteredEntries.length})</span>
        <span className="ml-auto text-zinc-400">
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </span>
      </button>

      {!isCollapsed && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeTypes.map((type) => {
            const typeEntries = groups[type]

            if (sortable) {
              const isExpanded = expandedTypes[type] ?? false
              return (
                <div key={`${sectionKey}-${type}`} className={isExpanded ? 'md:col-span-2' : ''}>
                  <SortableWantCategory
                    type={type}
                    initialEntries={typeEntries}
                    isExpanded={isExpanded}
                    onToggle={() => toggleType(type)}
                  />
                </div>
              )
            }

            const isExpanded = expandedTypes[type] ?? false
            const cards = typeEntries.map((entry, idx) => (
              <div key={entry.id} className="flex flex-col gap-1">
                <MediaCard
                  id={entry.mediaItem.id}
                  title={entry.mediaItem.title}
                  year={entry.mediaItem.year}
                  posterUrl={entry.mediaItem.posterUrl}
                  mediaType={entry.mediaItem.type}
                  status={entry.status}
                  rating={entry.rating}
                  href={`/item/${entry.id}`}
                  listeningProgress={entry.listeningProgress}
                  metadata={entry.mediaItem.metadata}
                />
                {showNextUp && (
                  <div className="flex justify-center">
                    <SetNextUpButton entryId={entry.id} isNextUp={idx === 0} />
                  </div>
                )}
              </div>
            ))

            return (
              <div
                key={`${sectionKey}-${type}`}
                className={isExpanded ? 'md:col-span-2' : ''}
              >
                <CollapsibleCategory
                  mediaType={type}
                  isExpanded={isExpanded}
                  onToggle={() => toggleType(type)}
                >
                  {cards}
                </CollapsibleCategory>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
```

**Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 4: Run tests**

```bash
npm test
```

Expected: all tests pass (no tests touch DashboardSection directly).

**Step 5: Verify manually**

- Open dashboard. All 3 sections show with counts.
- Click "TV Shows" filter pill. Sections with no TV shows auto-collapse with (0). Sections with TV shows show only TV show cards.
- Click section header to manually collapse/expand a non-empty section.

**Step 6: Commit**

```bash
git add app/(app)/dashboard/DashboardClient.tsx
git commit -m "feat: add section-level collapse and type filtering to dashboard sections"
```

---

### Task 7: DiscoverSection — header-only collapsed state

When a Discover type section is collapsed, show only the header (no stacked preview cards). When expanded, show the full grid.

**Files:**
- Modify: `components/media/DiscoverSection.tsx`

**Step 1: Read the file**

Open `components/media/DiscoverSection.tsx`. Find `DiscoverTypeSection` (lines 26–108). The collapsed branch is at lines 103:
```tsx
        ) : (
          <StackedCards maxVisible={2}>{cards}</StackedCards>
        )}
```

**Step 2: Remove StackedCards from collapsed state**

Replace the content of the `<div className="mt-2">` block (lines 97–104):

Current:
```tsx
      <div className="mt-2">
        {isExpanded ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {cards}
          </div>
        ) : (
          <StackedCards maxVisible={2}>{cards}</StackedCards>
        )}
      </div>
```

Replace with:
```tsx
      {isExpanded && (
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {cards}
        </div>
      )}
```

**Step 3: Remove unused StackedCards import**

At line 7, remove the `StackedCards` import:
```tsx
import { StackedCards } from '@/components/media/StackedCards'
```

**Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 5: Verify manually**

On the dashboard, scroll to Discover. Click a type header to expand — full card grid appears. Click again — collapses to just the header, no preview cards.

**Step 6: Commit**

```bash
git add components/media/DiscoverSection.tsx
git commit -m "feat: discover type sections show header-only when collapsed"
```

---

## Done

All 7 tasks complete. Manual verification checklist:

- [ ] Navbar desktop: inline search bar with `[text input] [type dropdown] [Search button]`
- [ ] Navbar mobile: still shows Dashboard / Search / Lists bottom tabs
- [ ] Submitting navbar search navigates to `/search?q=...` with results pre-loaded
- [ ] Search results page shows more results than before
- [ ] Dashboard has no stats grid
- [ ] Sticky filter bar with `All · TV Shows · Movies · Books · Audiobooks · Games` pills
- [ ] Selecting a type filter updates all 3 section counts
- [ ] Empty sections auto-collapse with (0) count in header
- [ ] Non-empty sections can be manually collapsed/expanded
- [ ] Discover type groups: collapsed shows header only, expanded shows full grid
