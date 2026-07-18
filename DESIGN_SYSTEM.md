# ScholarLens — Dark Design System
### "Ink & Teal" — the dark sibling of the existing Cream Editorial theme

Parameters: **motion 8/10** (expressive, confident) · **density 6/10** (efficient, not cramped)

---

## 1. Principles

ScholarLens is a hybrid-RAG research assistant — the interface's job is to make AI-generated answers feel **grounded, citable, and calm-confident**, not chatty or gimmicky. The dark theme keeps the same editorial DNA as the existing light mode (`app/globals.css`): warm-neutral ink instead of pure black, a single loud accent (teal), and serif display type for a scholarly register. Everything else exists to make long reading sessions and streaming AI output comfortable at low light.

- **Warm dark, not cold dark.** Backgrounds carry the same 85° warm hue as the cream theme, just inverted in lightness — avoids the "default shadcn slate" look.
- **One accent does the talking.** Teal (`primary`) is reserved for actions and focus. A second warm accent (amber, `--citation`) is reserved *only* for grounding/citation UI, so users learn to associate it with "this claim is sourced."
- **Motion explains provenance.** Since answers stream token-by-token and cite sources, motion at level 8 is spent on *legibility of process* (streaming reveal, citation pop-in, retrieval progress) — not decorative flourish.

---

## 2. Color

Dark surfaces use **lightness steps** (not box-shadow) for elevation — box-shadows barely register on dark backgrounds. Each step up in surface is ~4–5% lighter.

| Token | oklch | Approx hex | Use |
|---|---|---|---|
| `--background` | `oklch(0.16 0.014 85)` | `#1B1712` | page canvas |
| `--foreground` | `oklch(0.94 0.010 85)` | `#EBE6D9` | primary text |
| `--card` | `oklch(0.20 0.013 85)` | `#231F18` | cards, panels |
| `--card-foreground` | `oklch(0.94 0.010 85)` | `#EBE6D9` | text on card |
| `--popover` | `oklch(0.22 0.013 85)` | `#27221B` | menus, tooltips |
| `--popover-foreground` | `oklch(0.94 0.010 85)` | `#EBE6D9` | |
| `--surface` | `oklch(0.20 0.013 85)` | `#231F18` | base component surface |
| `--surface-hover` | `oklch(0.25 0.013 85)` | `#2C271E` | hover state |
| `--primary` | `oklch(0.72 0.13 175)` | `#3FBFA0` | teal — CTAs, links, focus |
| `--primary-foreground` | `oklch(0.16 0.03 175)` | `#0A1F1A` | text on primary |
| `--secondary` | `oklch(0.27 0.013 85)` | `#302A20` | secondary buttons, chips |
| `--secondary-foreground` | `oklch(0.90 0.010 85)` | `#E2DCCC` | |
| `--muted` | `oklch(0.25 0.013 85)` | `#2C271E` | subdued panels |
| `--muted-foreground` | `oklch(0.68 0.012 85)` | `#A8A090` | secondary text |
| `--accent` | `oklch(0.72 0.13 175)` | `#3FBFA0` | mirrors primary |
| `--accent-foreground` | `oklch(0.16 0.03 175)` | `#0A1F1A` | |
| `--citation` *(new)* | `oklch(0.78 0.14 85)` | `#D9A94A` | citation markers, grounded-claim highlight only |
| `--citation-foreground` *(new)* | `oklch(0.18 0.03 85)` | `#221A0C` | text on citation chip |
| `--destructive` | `oklch(0.62 0.19 25)` | `#D9553F` | errors, delete |
| `--destructive-foreground` | `oklch(0.97 0.01 25)` | `#FBEAE6` | |
| `--border` | `oklch(0.30 0.013 85)` | `#3A332680` | dividers, card edges |
| `--input` | `oklch(0.24 0.013 85)` | `#2A251C` | input backgrounds |
| `--ring` | `oklch(0.72 0.13 175)` | `#3FBFA0` | focus ring |
| `--gem-blue` | `oklch(0.72 0.13 175)` | teal family (legacy hook, unchanged from light) |
| `--gem-teal` | `oklch(0.78 0.10 175)` | lighter teal |
| `--gem-text` | `oklch(0.94 0.010 85)` | |
| `--gem-subtext` | `oklch(0.68 0.012 85)` | |
| `--sidebar` | `oklch(0.14 0.014 85)` | `#171310` | sidebar, one step darker than page |
| `--sidebar-foreground` | `oklch(0.90 0.010 85)` | |
| `--sidebar-primary` | `oklch(0.72 0.13 175)` | |
| `--sidebar-border` | `oklch(0.26 0.013 85)` | |

**Chart palette** (eval dashboards, retrieval-score charts) — 5 hues spaced for colorblind distinction on dark bg:

```
--chart-1: oklch(0.72 0.13 175)   /* teal   — primary metric */
--chart-2: oklch(0.75 0.15 250)   /* blue   */
--chart-3: oklch(0.78 0.14 85)    /* amber  — matches --citation */
--chart-4: oklch(0.72 0.16 320)   /* violet */
--chart-5: oklch(0.68 0.18 25)    /* coral  */
```

**Contrast targets:** body text ≥ 7:1 on background (AAA, since long-form reading dominates this product), UI labels ≥ 4.5:1, disabled/placeholder text ≥ 3:1 only.

### Drop-in CSS block

```css
.dark {
  --background: oklch(0.16 0.014 85);
  --foreground: oklch(0.94 0.010 85);
  --card: oklch(0.20 0.013 85);
  --card-foreground: oklch(0.94 0.010 85);
  --popover: oklch(0.22 0.013 85);
  --popover-foreground: oklch(0.94 0.010 85);

  --primary: oklch(0.72 0.13 175);
  --primary-foreground: oklch(0.16 0.03 175);
  --secondary: oklch(0.27 0.013 85);
  --secondary-foreground: oklch(0.90 0.010 85);
  --muted: oklch(0.25 0.013 85);
  --muted-foreground: oklch(0.68 0.012 85);
  --accent: oklch(0.72 0.13 175);
  --accent-foreground: oklch(0.16 0.03 175);
  --destructive: oklch(0.62 0.19 25);
  --destructive-foreground: oklch(0.97 0.01 25);

  --border: oklch(0.30 0.013 85);
  --input: oklch(0.24 0.013 85);
  --ring: oklch(0.72 0.13 175);

  --surface: oklch(0.20 0.013 85);
  --surface-hover: oklch(0.25 0.013 85);

  --gem-blue: oklch(0.72 0.13 175);
  --gem-teal: oklch(0.78 0.10 175);
  --gem-text: oklch(0.94 0.010 85);
  --gem-subtext: oklch(0.68 0.012 85);

  --citation: oklch(0.78 0.14 85);
  --citation-foreground: oklch(0.18 0.03 85);

  --chart-1: oklch(0.72 0.13 175);
  --chart-2: oklch(0.75 0.15 250);
  --chart-3: oklch(0.78 0.14 85);
  --chart-4: oklch(0.72 0.16 320);
  --chart-5: oklch(0.68 0.18 25);

  --radius: 0.875rem; /* unchanged — radius is brand identity, not theme-dependent */

  --sidebar: oklch(0.14 0.014 85);
  --sidebar-foreground: oklch(0.90 0.010 85);
  --sidebar-primary: oklch(0.72 0.13 175);
  --sidebar-primary-foreground: oklch(0.16 0.03 175);
  --sidebar-accent: oklch(0.25 0.013 85);
  --sidebar-accent-foreground: oklch(0.90 0.010 85);
  --sidebar-border: oklch(0.26 0.013 85);
  --sidebar-ring: oklch(0.72 0.13 175);
}
```

Also add to `@theme inline`: `--color-citation: var(--citation); --color-citation-foreground: var(--citation-foreground);`

---

## 3. Typography

Fonts already loaded in `app/layout.tsx` — no new font requests needed.

| Role | Font | Size / Line-height | Weight | Use |
|---|---|---|---|---|
| Display | Spectral (serif) | 2.5rem / 1.15, italic accents | 500 | Landing hero, empty-state headline |
| H1 | Spectral | 1.875rem / 1.25 | 500 | Page title (e.g. document title) |
| H2 | Spectral | 1.5rem / 1.3 | 500 | Section header |
| H3 | Inter | 1.125rem / 1.4 | 600 | Card title, panel header |
| Body L | Inter | 1rem / 1.6 | 400 | Answer text, reading content |
| Body M | Inter | 0.875rem / 1.55 | 400 | UI labels, chat input |
| Body S | Inter | 0.8125rem / 1.5 | 400 | Metadata, timestamps |
| Caption | Inter | 0.75rem / 1.4 | 500, uppercase, +0.02em tracking | Section eyebrows, badges |
| Mono | Geist Mono | 0.8125rem / 1.5 | 400 | doc_id, citation refs, code |

Rule: **serif only for content the user reads as prose or as a title**; every interactive/UI element stays Inter. Citation markers use Mono at Body S size in a `--citation` chip, so a source reference always looks visually distinct from generated prose (small caps mono in an amber pill, e.g. `[Vaswani17]`).

---

## 4. Spacing & Density (density = 6/10)

Base unit **4px**. Density 6 reads as "efficient SaaS" — tighter than a marketing site, looser than a data grid.

| Token | Value | Use |
|---|---|---|
| `space-1` | 4px | icon-to-label gap |
| `space-2` | 8px | tight stack (chip internal padding) |
| `space-3` | 12px | input/button internal padding |
| `space-4` | 16px | card internal padding (default) |
| `space-5` | 20px | card padding (comfortable variant) |
| `space-6` | 24px | section gaps |
| `space-8` | 32px | page-section gaps |
| `space-12` | 48px | hero / major section breaks |

| Component | Size |
|---|---|
| Button height (default) | 36px |
| Button height (sm) | 32px |
| Input / textarea row height | 40px |
| Sidebar width | 264px (collapsed: 64px) |
| Card padding | 20px |
| Page content max-width | 840px (reading column), 1200px (dashboard) |
| Grid gutter | 16px |

---

## 5. Radius & Borders

Unchanged from light theme — `--radius: 0.875rem` (14px), slightly tighter than shadcn default 1rem, reads more editorial/precise. Full scale: `sm = radius - 4px`, `md = radius - 2px`, `lg = radius`, `xl = radius + 4px`. Borders are 1px, `--border` token, never rely on shadow alone to define an edge on dark surfaces.

---

## 6. Elevation

No drop shadows for base elevation (invisible on dark bg) — elevation = lightness step (`background` → `card` → `popover`, each +2-4% L). Reserve actual box-shadow for **focus/emphasis only**, as a soft colored glow tied to the accent:

```css
--glow-primary: 0 0 0 1px oklch(0.72 0.13 175 / 0.4), 0 0 24px oklch(0.72 0.13 175 / 0.18);
--glow-citation: 0 0 0 1px oklch(0.78 0.14 85 / 0.35), 0 0 16px oklch(0.78 0.14 85 / 0.14);
```

Use `--glow-primary` on: focused input, active streaming answer bubble, primary button hover. Use `--glow-citation` on: hovered citation chip.

---

## 7. Motion (motion = 8/10)

Level 8 means motion is **expressive and noticeable** — used to narrate what the system is doing (retrieving, generating, grounding) — but never purely decorative, and always has a reduced-motion fallback.

**Durations**

| Token | ms | Use |
|---|---|---|
| `motion-instant` | 100 | icon toggle, checkbox |
| `motion-fast` | 160 | hover, button press |
| `motion-base` | 240 | panel/menu open, tab switch |
| `motion-expressive` | 420 | drawer/modal enter, citation pop-in |
| `motion-slow` | 640 | page transition, empty-state illustration |

**Easing**

```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);      /* default — snappy settle */
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);  /* symmetric moves */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* citation chip pop, success states */
```

**Choreography patterns**

- **Streaming answer text**: tokens fade+rise in (`opacity 0→1`, `translateY 4px→0`, 120ms `ease-out`, no stagger — driven by the token stream itself, not artificial delay).
- **Citation chip reveal**: appears 80ms *after* its sentence finishes streaming, `ease-spring`, 200ms — teaches the user "the claim landed, here's its source."
- **Search/result list**: stagger children 40ms apart, `motion-base`, `ease-out` — cap total choreography at ~5 items (200ms) so long lists don't feel sluggish.
- **Retrieval progress** (query → reranking → generating): a 3-stage indicator that morphs between states with a shared-layout crossfade (`motion-expressive`, `ease-in-out`), not a generic spinner — motion communicates *pipeline stage*.
- **Panel/drawer/modal**: enter with `motion-expressive` + `ease-out` (scale 0.98→1 + opacity), exit at `motion-fast` (exits should always feel quicker than entries).
- **Hover lift** (cards, buttons): `translateY(-1px)` + `--glow-primary`, `motion-fast`.
- **Reduced motion**: wrap all non-essential transforms in `@media (prefers-reduced-motion: reduce)` → collapse to opacity-only crossfades at `motion-instant`. Streaming text reveal is exempt (it's functional, not decorative) but drops its translateY component.

---

## 8. Iconography

Lucide (already the configured icon library in `components.json`). Stroke width **1.75** (slightly heavier than default 2, reads better at small sizes on dark bg without looking bold). Sizes: 16px inline-with-text, 20px default UI, 24px section headers/empty states.

---

## 9. Key Component Specs

**Chat / answer bubble** — `card` surface, `space-5` padding, Body L text, streaming cursor is a 2px `primary`-colored blinking bar (`motion-instant` blink cycle 700ms). Citation chips inline: mono, `--citation` background at 16% opacity, `--citation-foreground` text, full-pill radius.

**Document card** — `card` surface, `space-4` padding, title in Inter H3 (not serif — this is UI chrome, not reading content), doc_id in mono Body S with copy-icon affordance, hover → `surface-hover` + `-1px` lift.

**Sidebar** — `sidebar` token (one step darker than page, not lighter — recedes rather than competes), active nav item gets a 2px `primary` left-border + `sidebar-accent` background, not a filled pill.

**Search / query bar** — `input` surface, `space-3` padding, focus → `--glow-primary`, placeholder in `muted-foreground` using an actual example query (not "Search...") to model capability.

**Upload dropzone** — dashed `border` at rest, on drag-over transitions border to solid `primary` + `--glow-primary` + background tint to `primary` at 6% opacity, `motion-base ease-out`.

**Empty / loading states** — serif Display headline + Body M subtext, muted illustration in single-color `muted-foreground` line art (no stock illustration style — keep it editorial/line-drawn to match brand).

---

## 10. Voice (brief)

Precise, evidence-first, calm. Never says "I think" — says "According to [source]." Error and empty states are specific ("No documents indexed yet" not "Nothing here!"). No exclamation points in system copy.

---

## 11. Implementation Notes

This file is a **spec**, not wired into the app. To activate: paste the CSS block from §2 into `frontend/app/globals.css` as a `.dark { ... }` block (there is currently no `.dark` block defined — only the light "Cream Editorial" `:root`), and mount the existing `frontend/components/theme-provider.tsx` (already installed via `next-themes` but not yet used in `app/layout.tsx`). Ask if you'd like that wired up next.
