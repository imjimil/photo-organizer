# Opal — Design System (v7 · Darkroom)

## Register

**Product** — UI serves images. Familiarity is a feature; chrome disappears into the task.

## Reference lane

A photographer's darkroom at midnight, not a gallery. **Cool-slate print sleeves on a steel work table** in the day; **warm-charcoal walls under a single safelight** at night. The photo is the only saturated thing in the room.

Not Pinterest cream, not Cosmos violet glow, not editorial-magazine ruled metadata. Those are saturated lanes; v7 deliberately leaves them.

## Physical scene

A user at midnight, sorting 25,000 saved prints. Cool-slate print binders by day, a single warm safelight at night. Lifting one print, the amber light gilds its edge. Quiet, slow, considered.

## Typography

One UI family. Wordmark only as the second face.

| Role | Font | Use |
|------|------|-----|
| Brand wordmark | **Gloock** | The `Opal` mark in the titlebar — one place, one weight |
| UI / body / headings / quotes / labels / buttons | **Mona Sans Variable** | Everything else; weight axis 200–900, width axis 75–125 |
| Tabular numerals | **Mona Sans** (`font-variant-numeric: tabular-nums`) | Counts, indexes, stats (no separate mono face) |

Drop list (replaced from v6): Young Serif, Sora, PP Editorial. None has a job once Mona carries body and quote weight up.

Mona Sans rationale: free OFL, off the impeccable reflex-reject list, an "industrial-era grotesque" matching the darkroom register. The width axis lets us tracked-narrow the rail's 3-letter section labels (LIB / COL / DSC / SRC) without shipping a second display face.

### Scale

Fixed rem, 1.25 ratio, six steps. Fluid `clamp()` is permitted only on the bento today-hero headline.

| Token | Size | Weight | Use |
|-------|------|--------|-----|
| `--text-xs` | 0.75rem | 500 | Eyebrow, mono counts |
| `--text-sm` | 0.875rem | 500 | Secondary labels, meta |
| `--text-base` | 1rem | 400 | Body |
| `--text-md` | 1.125rem | 500 | Subheading, quote inline |
| `--text-lg` | 1.5rem | 500 | Section heading |
| `--text-xl` | clamp(1.875rem, 3vw, 2.5rem) | 500 | Hero headline (bento today only) |

Letter-spacing `-0.01em` on body, `+0.08em` on tracked uppercase labels, `0` everywhere else. `font-optical-sizing: auto`. `font-variant-numeric: tabular-nums` on counts.

## Color · Restrained, single accent

Per the impeccable product reference, Restrained is the floor. v7 ships exactly one accent — **safelight amber** — used like a spot of light, not a surface coat.

Banned for this project on top of shared bans: **violet, magenta, mint, any iridescent gradient, any gradient text, glassmorphism beyond a single ≤8% scrim.** v6's iridescent direction is explicitly retired.

### Light · cool slate

| Token | OKLCH | Notes |
|-------|-------|-------|
| canvas | `oklch(0.97 0.005 250)` | Cool, very faint blue cast |
| surface | `oklch(0.95 0.006 250)` | Sticky bars, rail at rest |
| elevated | `oklch(0.99 0.003 250)` | Sheets, modals, viewer toolbar |
| hover | `oklch(0.93 0.008 248)` | Tile and button hovers |
| text-primary | `oklch(0.20 0.012 250)` | Body |
| text-muted | `oklch(0.46 0.010 250)` | Secondary |
| text-faint | `oklch(0.62 0.008 250)` | Tertiary, captions |
| hairline | `oklch(0.86 0.005 250)` | Borders, dividers, rail edges |
| accent | `oklch(0.62 0.16 65)` | Safelight amber on light |
| accent-soft | `oklch(0.62 0.16 65 / 0.12)` | Tile selection wash, focus ring fill |
| danger | `oklch(0.55 0.18 25)` | Error only |

### Dark · warm charcoal

| Token | OKLCH | Notes |
|-------|-------|-------|
| canvas | `oklch(0.16 0.012 60)` | Warm-toned dark, not violet |
| surface | `oklch(0.19 0.014 62)` | Sticky bars, rail at rest |
| elevated | `oklch(0.22 0.014 62)` | Sheets, modals |
| hover | `oklch(0.26 0.014 62)` | Tile and button hovers |
| text-primary | `oklch(0.94 0.005 80)` | Slightly warm white |
| text-muted | `oklch(0.72 0.008 80)` | Secondary |
| text-faint | `oklch(0.55 0.008 80)` | Tertiary |
| hairline | `oklch(0.30 0.012 60)` | Borders |
| accent | `oklch(0.78 0.14 68)` | Safelight amber lifted for dark |
| accent-soft | `oklch(0.78 0.14 68 / 0.18)` | Selection wash |
| danger | `oklch(0.68 0.18 25)` | Error only |

Light text on dark backgrounds: line-height +0.05, weight bumped one step (400 → 500) per impeccable typography guidance.

## Layout

### Shell

```
┌────────────────────────── titlebar (32px) ────────────────────┐
│              drag region                           – ▢ ✕      │
├──────────┬──────────────────────────────────────────────────────┤
│  Opal    │                                                      │
│  (brand) │   canvas (full bleed)                                │
│          │                                                      │
│  Home    │                                                      │
│  Library │                                                      │
│  …       │                                                      │
│  184px   │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

Mobile: titlebar/rail hidden; bottom pill nav (5 tabs: Home, Library, Albums, Discover, Search); mobile header with page title + count.

### Edge rail

- Fixed width `11.5rem` (184px). No collapse or hover expand.
- Brand wordmark (Gloock) at top; nav items show icon + full label always.
- Items: Home, Library, Collections, Discover, Sources (footer: theme).
- Active item: safelight wash + accent color.

### Bento home

12-column grid on desktop, 6 on tablet, 1 stacked on mobile. Six cells, varied sizes — explicitly not an identical-card grid:

1. Today hero — 8 × 2 — large image, headline, count
2. Saved count — 4 × 1 — mono numeral, text-md label
3. Shuffle — 4 × 1 — accent CTA, rotating cover
4. Collections strip — 12 × 1 — horizontal scroll, no cards
5. Last week mini-mosaic — 6 × 2 — 6 thumbnails, varied aspect
6. Discover prompt — 6 × 2 — single image, vertical caption

### Justified mosaic

- Library, Search, Album detail, Folder detail.
- Algorithm: Flickr's justified-layout (or own implementation) over `(w, h)` from API.
- Target row height: 240px desktop, 200px tablet, 160px mobile.
- Box spacing: 8px. No full-width breakouts.
- Native aspect ratios. No `aspect-ratio: 1`.

### Collections (stacked prints)

Each collection is a 3-image overlapping stack on a tape-labeled surface. Sizes vary; not a card grid. The stack itself is the affordance.

## Motion

120–220ms, `ease-out-quart` only. State-only. No bounce, no elastic, no gradient sweeps.

| Surface | Behavior |
|---------|----------|
| Rail item hover | 160ms color + 2px translate |
| Tile enter | opacity + 6px rise, 40ms stagger, max 12 stagger |
| Selection | ink-bloom — 80ms scale-in of an accent inner border (0 → 2px), single color |
| Theme switch | 320ms semantic color crossfade |
| Viewer | scrim fade + image float-in (kept) |
| Page change | 200ms fade + 6px rise |
| Hover lift (light only) | -1px translate + soft shadow |

`prefers-reduced-motion` kills all transitions; rail expand becomes instant.

## Bans (this project, on top of shared bans)

- Violet, magenta, mint, blush, iridescent gradient, gradient text.
- Display fonts in UI labels, buttons, body.
- Decorative motion that doesn't convey state.
- Identical-card grids (collections, bento, anywhere).
- `border-radius: 999px` on more than primary-pill controls; secondary buttons demote to 6–10px.
- Glassmorphism beyond a single ≤8% scrim.
- Em dashes in copy. Use commas, colons, semicolons, parentheses.

## Accessibility

WCAG 2.1 AA. Reduced motion respected. Keyboard: `/` opens search, `Esc` closes viewer. All interactive surfaces have visible focus rings (2px solid accent, 2px offset). Text/background ≥ 4.5:1; UI components ≥ 3:1 against surface.
