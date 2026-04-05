# Vellum UI Redesign Design

**Goal:** Redesign the dashboard and navbar for clearer media type segregation, a more intuitive status-first layout, and inline search from any page.

**Approach:** Single scrollable dashboard page with a sticky global type filter bar, status-grouped card sections, and an improved Discover area. Navbar gains an inline search bar replacing the dedicated search nav link.

---

## Navbar

The "Search" nav link is replaced with an inline search bar visible on every page.

**Layout (left to right):**
1. Text input field (placeholder: "Search…")
2. Media type dropdown (`All Types · TV Shows · Movies · Books · Audiobooks · Games`)
3. Search/submit button

On submit, navigates to the existing `/search` page with URL params `?q=<query>&type=<type>`. The search results page reads these params and pre-fills the search form.

## Dashboard Header

- Title ("Your Library") on the left
- "+ Add" and "Suggestions" buttons on the right
- **Stats grid removed entirely** — it provided no actionable value

## Sticky Filter Bar

A horizontal pill strip that sticks below the navbar on scroll.

**Pills:** `All · TV Shows · Movies · Books · Audiobooks · Games`

- No counts on the pills themselves
- Active pill has indigo fill (matches existing color scheme)
- Selecting a pill filters the entire dashboard to that media type
- "All" shows all types

## Status Sections

Three collapsible sections stacked vertically: **Currently Consuming**, **Want to Consume**, **Completed**.

**Each section:**
- Header: bold status label + item count matching the active type filter (e.g. "Currently Consuming (2)")
- Expand/collapse chevron toggle; all sections expanded by default
- When the active filter returns zero items for a section: auto-collapses and shows "(0)" in the header — section is never hidden entirely
- Card grid: responsive, uses existing `MediaCard` component
  - 2 columns mobile, 3–4 tablet, 5–6 desktop

**Want to Consume** retains:
- Drag-and-drop reordering (existing `@dnd-kit` implementation)
- "Set Next Up" button per card

## Discover Section

Pinned at the bottom of the page, below the three status sections. Unaffected by the type filter.

- Grouped by media type (TV Shows, Movies, Books, Audiobooks, Games)
- Each type group has a collapsible/expandable header
- Full responsive card grid within each group — no "show more" button or item cap
- Uses existing `DiscoverSection` component as the base, extended with per-type grouping and collapse

## Search Results Page

The existing `/search` page is used as-is for displaying results. Two changes:
1. Pre-fill search input and type dropdown from URL params `q` and `type`
2. **Increase the result limit** — identify the current cap in the search API/component and raise it to surface more matches per query

## Files to Change

| File | Change |
|------|--------|
| `components/layout/Navbar.tsx` | Replace Search nav link with inline search bar |
| `app/(app)/dashboard/DashboardClient.tsx` | Remove stats grid, add sticky filter bar, update section logic |
| `components/media/CollapsibleCategory.tsx` | Support auto-collapse when count is zero |
| `components/media/DiscoverSection.tsx` | Add per-type grouping with collapsible groups, remove item cap |
| `app/(app)/search/page.tsx` or search client | Read `q` and `type` URL params to pre-fill form |
| Search API route | Increase result limit |
