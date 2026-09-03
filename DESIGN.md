# Design System

## Visual Theme

Daylight workbench. Warm stone chrome, paper canvas, iron type, oxide marks for selection only. Light is the primary scene (afternoon monitor, north window). Dark is the same system at night, not a gold darkroom.

Color strategy: Restrained. Images supply chroma. Accent is used for current nav, selection, and primary commit.

## Color

OKLCH. Neutrals tinted toward hue 75 (warm iron). Accent hue 32 (oxide).

### Light
- Canvas: `oklch(0.972 0.006 80)`
- Surface: `oklch(0.945 0.008 75)`
- Elevated: `oklch(0.99 0.004 80)`
- Text: `oklch(0.22 0.018 40)`
- Accent: `oklch(0.50 0.16 32)`
- Border: `oklch(0.875 0.008 75)`

### Dark
- Canvas: `oklch(0.155 0.010 55)`
- Surface: `oklch(0.19 0.012 55)`
- Elevated: `oklch(0.23 0.012 55)`
- Text: `oklch(0.93 0.008 75)`
- Accent: `oklch(0.70 0.13 38)`
- Border: `oklch(0.30 0.010 55)`

Never `#000` or `#fff`.

## Typography

IBM Plex Sans for all UI. IBM Plex Mono for keyboard hints and paths. No display serif.

Scale (1.2): 11 / 13 / 14 / 16 / 20 / 28. Fixed rem, not fluid headings. Page titles 20px / 600. Body 14px. Meta 11–13px, no uppercase tracking.

## Layout

Titlebar 32px. Sidebar 216px. Canvas is the remaining field; photo grids are edge-aware with a 4px gap. No max-width cages on image feeds. Toolbars are 40–48px strips, not stacked cards.

Radii: photos 2px, controls 6px, sheets 10px. No stadium pills.

## Elevation

Borders and spacing, not glass. One 8px shadow on floating sheets only. No backdrop-blur on chrome.

## Components

- Sidebar: text + icon rows, active = soft fill + weight, never a side stripe
- Search: full-width command field, 6px radius, filters as a panel not a modal
- Tiles: 2px radius, no hover lift, selection = oxide inset ring
- Buttons: 6px, primary = oxide fill, ghost = text + hover fill
- Mobile nav: full-width tab bar, top hairline, no floating capsule

## Motion

160ms color/opacity. 220ms panels (`cubic-bezier(0.16, 1, 0.3, 1)`). Tile entrance: 180ms fade. No layout-property animation, no bounce.
