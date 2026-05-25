# Opal — Design System (v6 · Iridescent)

## Register

**Product** — UI disappears; images and flow carry the experience.

## Reference lane (not copies)

- **Cosmos** — luminous light surfaces, soft discovery, search as portal
- **Pell Mell** — editorial rhythm, scroll-driven calm, type as identity
- **Arc** — intentional pacing, images keep dignity

## Physical scene

Browsing saved mood images on a bright desk by a window, or at night with screen glow like opal: violet, mint, blush shifting subtly. Never a brown salon. Never SaaS purple sludge.

## Typography

| Role | Font | Notes |
|------|------|-------|
| Display / brand wordmark | **Gloock** | Opal logo only — wide, stone-cut serif |
| Headings / search / quotes | **Young Serif** | Section titles, search field, pull quotes |
| UI | **Sora** | Navigation, controls |
| Meta | **JetBrains Mono** | Counts, labels |

Scale ratio 1.333. Body 1rem fixed. Display uses fluid clamp on marketing moments only.

## Color · Opal iridescent

Dual theme. Accent is **violet opal**; secondary flash **mint** for active indicators only.

### Light — pearlescent day
- Canvas: oklch(0.99 0.006 290)
- Surface: oklch(0.97 0.01 285)
- Text: oklch(0.24 0.03 285)
- Accent: oklch(0.55 0.16 305)
- Mint: oklch(0.62 0.11 175)

### Dark — opal night (not cave)
- Canvas: oklch(0.17 0.035 285)
- Surface: oklch(0.14 0.038 280)
- Text: oklch(0.93 0.012 290)
- Accent: oklch(0.72 0.14 305)
- Mint: oklch(0.78 0.1 175)

Ambient: fixed radial washes at 4–6% opacity (violet + mint). No gradient text.

## Layout (structural break from v4)

- **No left sidebar.** Top rail + full-width canvas (Cosmos-like).
- Collections: horizontal discovery strip under rail.
- Grid: light = 6px gap, 6px radius, soft hover lift; dark = 3px flush squares.
- Mobile: bottom dock, floating minimal header.

## Motion

Product register: 200–320ms, ease-out-expo.

- Nav pill slides between Library / Search
- View crossfade + 8px rise
- Tiles: opacity + translateY cascade (30ms stagger)
- Hover: translateY -2px + shadow (light only)
- Viewer: scrim fade + image float-in
- Theme: 400ms semantic color transition

## Bans

Maison brown palette, Baskervville/Manrope stack, left sidebar chrome, terracotta gold, OCR on grid, bounce easing.
