# Opal — Design System

## Principles

1. **Content is the UI** — images and quote text dominate; chrome stays minimal.
2. **Tinted neutrals** — no pure `#000` / `#fff` / `#888`.
3. **One accent** — warm opal amber for focus and active states only.
4. **Typography carries mood** — serif for quotes, humanist sans for UI.
5. **Motion with purpose** — fade/scale on lightbox; no bounce easing.

## Typography

Distinctive pairing — literary serif built for long reading + refined geometric sans. Not Inter, not Roboto.

| Role | Font | Why |
|------|------|-----|
| Quotes / display | **Literata** | Google Books typeface; designed for sustained reading |
| UI / chrome | **Albert Sans** | Geometric humanist; crisp without feeling like a template |
| Meta / scores | **IBM Plex Mono** | Similarity %, dates, keyboard hints |

Load via Google Fonts with `font-display: swap`.

```css
--font-quote: "Literata", "Georgia", serif;
--font-ui: "Albert Sans", system-ui, sans-serif;
--font-mono: "IBM Plex Mono", ui-monospace, monospace;
```

Scale (fluid where noted):

- Wordmark **Opal**: Albert Sans 600, 1.125rem, letter-spacing 0.04em
- Quote lightbox: Literata 1.375rem (mobile) → 1.625rem (desktop), line-height 1.6, font-optical-sizing: auto
- Quote card preview: Literata 0.875rem, line-height 1.45, 2-line clamp
- UI body: 0.9375rem (15px)
- Captions / meta: 0.8125rem, `--text-muted`

## Color (OKLCH)

```css
--bg-base: oklch(0.14 0.012 285);
--bg-elevated: oklch(0.18 0.014 285);
--bg-hover: oklch(0.22 0.016 285);
--text-primary: oklch(0.93 0.012 285);
--text-muted: oklch(0.68 0.02 285);
--text-faint: oklch(0.52 0.02 285);
--accent: oklch(0.78 0.1 55);
--accent-muted: oklch(0.65 0.06 55);
--border: oklch(0.28 0.015 285);
--focus-ring: oklch(0.78 0.1 55 / 0.45);
```

## Spacing

Base unit 4px. Grid gap 12px. Feed padding 16px (mobile) / 24px (desktop). Lightbox padding 32px.

## Layout

- **Feed:** CSS multi-column masonry, 2 cols mobile / 3 tablet / 4–5 desktop
- **Header:** sticky, blur backdrop, search centered
- **Lightbox:** full viewport overlay, image left / quote panel right on wide screens

## Components

- **ImageCard:** no heavy border card — image with subtle radius (6px), hover lift 2px, quote preview 2 lines max
- **SearchBar:** single field, no pill overload; `/` to focus
- **Similarity badge:** only on search results, small mono pill

## Motion

```css
--ease-out: cubic-bezier(0.22, 1, 0.36, 1);
--duration-fast: 150ms;
--duration-normal: 250ms;
```

Reduced motion: disable transforms, keep opacity fades only.

## Impeccable alignment

Reference: [Impeccable](https://github.com/pbakaus/impeccable) anti-patterns — avoid AI slop checklist before ship.
