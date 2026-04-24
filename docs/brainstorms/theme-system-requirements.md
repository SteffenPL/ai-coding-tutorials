# Theme System

**Date**: 2026-04-24
**Status**: Ready for planning
**Scope**: Standard

## Problem

The site has a single hardcoded dark theme (aubergine + orange). Colors are scattered across 31 files with ~53 unique hex values — many bypass the 37 CSS variables defined in `global.css`. Adding alternative looks requires consolidating this into a single source of truth, then layering theme switching on top.

## Goals

1. **3 color themes** — Dark (current default), Warm, Light — applied via CSS custom properties
2. **~7 wallpapers** — independently selectable from color theme:
   - 3 gradient mesh (current + 2 new variations)
   - 2 dynamic/animated (for fun)
   - 2 solid/mono color
3. **Persistent preferences** via localStorage (no cookies, no consent banner needed)
4. **Graceful defaults** — current aubergine+orange theme + current gradient wallpaper when no preference is stored

## Non-goals

- Fully custom user-defined themes (color pickers, etc.)
- Per-tutorial theme overrides
- Server-side theme rendering or SSR theme detection
- Accessibility-driven high-contrast mode (could be a future theme but not in scope now)

## Scope

All pages — public-facing (home, tutorials) and dev tools (edit, curate, compose, preview).

## Requirements

### R1: CSS Variable Consolidation

Audit all 31 files with hardcoded colors. Replace every hardcoded hex/rgba with a semantic CSS variable. Key groups to extract:

| Current hardcoded value | Proposed variable |
|------------------------|-------------------|
| `#241a20` (terminal bg, 6+ places) | `--bg-terminal` |
| `#2a1a24` (dialog/modal bg) | `--bg-dialog` |
| `rgba(28, 16, 23, 0.88)` (nav) | `--nav-bg` (already exists, ensure consistent use) |
| `rgba(30, 16, 26, 0.98)` (search) | `--bg-overlay` or reuse `--bg-surface` |
| Various `rgba(233, 84, 32, 0.xx)` | Derive from `--accent` with opacity utilities or named stops |
| Gradient mesh layers | Separate wallpaper system (not CSS variables) |

The semantic variable set in `global.css` becomes the **single source of truth**. Each theme overrides these variables; no component should reference raw color values.

### R2: Theme Definitions

Three color themes, each defining the full set of semantic variables:

- **Dark** (default) — current aubergine palette, orange accent. No visual change from today.
- **Warm** — warmer, earthier tones. Could shift the purple base toward brown/charcoal, keep orange accent or shift toward amber.
- **Light** — light background, dark text. Inverted contrast. Accent colors adjusted for legibility on light surfaces.

Each theme is a CSS class or `data-theme` attribute on `<html>`, overriding `:root` variables.

### R3: Wallpaper System

Wallpapers are independent from color themes. Any wallpaper can pair with any color theme.

**Gradient wallpapers** (3):
- Current 8-layer mesh (default)
- 2 new gradient variations (different color/position combinations)

**Dynamic wallpapers** (2):
- Subtle animated backgrounds (CSS animation or canvas). Must not impact scroll performance or readability.

**Solid wallpapers** (2):
- Single flat color derived from `--bg-primary` (adapts to theme)

Wallpaper rendering is isolated to the `.desktop::before` pseudo-element in TutorialViewer and the equivalent on the home page. The wallpaper system should be a single component or utility that both pages consume.

### R4: Preference Storage

- **Storage**: localStorage under a single key (e.g., `ai-tutorials-theme`)
- **Stored values**: `{ colorTheme: string, wallpaper: string }`
- **No consent needed**: localStorage is client-only, not transmitted to server
- **Consistent with existing pattern**: language preference already uses localStorage (`ai-tutorials-lang`)
- **Fallback**: if no preference stored or localStorage unavailable, use Dark theme + default gradient wallpaper

### R5: Theme Picker UI

- Accessible from the existing settings gear/popover in the tutorial viewer
- Also accessible from the home page (location TBD — could be nav bar or footer)
- Shows color theme selector (3 options with visual preview swatches)
- Shows wallpaper selector (thumbnail grid of 7 options)
- Changes apply immediately (live preview as user browses options)
- Selected theme persists on selection (no separate "save" button)

### R6: Code Highlighting Theme

The Shiki code highlighter currently uses `vitesse-dark`. Each color theme should specify a compatible Shiki theme:
- Dark → `vitesse-dark` (current)
- Warm → TBD (e.g., `monokai` or similar warm theme)
- Light → `vitesse-light` or similar

## Dependencies

- No new packages required for CSS variable theming
- Dynamic wallpapers may need a lightweight canvas library or pure CSS animations — decide during planning
- Shiki already supports multiple themes; just needs theme switching logic

## Open Questions

1. **Warm theme palette** — what's the target aesthetic? Earthy browns, sepia, forest greens, or something else?
2. **Dynamic wallpaper ideas** — what kind of animation? Particle fields, slow-moving gradients, geometric patterns?
3. **Theme picker placement on home page** — nav bar icon, footer, or floating button?
4. **Shiki theme switching** — re-highlight on theme change (expensive) or use CSS-based dual-theme approach?
