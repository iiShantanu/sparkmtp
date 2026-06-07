# Apply Spark logo & brand theme app-wide

## Brand tokens (from logo)
- **Deep navy** `#1B2A52` — primary brand color (text "park", S-curve top)
- **Royal blue** `#3A5BB8` — primary accent / interactive (S-curve mid)
- **Warm amber/gold** `#E89B3C` — secondary accent / highlight (sparkle, S-curve bottom)
- **Cream** `#F5F0E6` — background / surface tint
- **Ink** `#0F1A33` — foreground text

These map to oklch in `src/styles.css`:
- `--primary` → navy `#1B2A52`
- `--ring` / link → royal blue `#3A5BB8`
- `--accent` → amber `#E89B3C`
- `--background` → cream `#F5F0E6` (lightened for surfaces)
- `--foreground` → ink

Dark mode: invert — navy background, cream foreground, amber accent kept vivid.

## Logo asset
- Upload `spark logo.png` via `lovable-assets` → `src/assets/spark-logo.png.asset.json`
- Create a small `<SparkLogo />` component in `src/components/spark-logo.tsx` that renders the image with proper alt text + sizing props (h-8, h-10, h-16 variants).

## Where the logo replaces current branding
1. `src/routes/__root.tsx` — favicon + page title meta (use logo URL as favicon).
2. `src/components/app-shell.tsx` — header/sidebar brand mark.
3. `src/routes/login.tsx`, `signup.tsx`, `forgot-password.tsx`, `reset-password.tsx`, `device-pair.tsx` — top-of-page brand.
4. `src/routes/index.tsx` — landing brand.
5. `src/routes/student.tsx` — header brand (next to clock).
6. Auth email templates if any reference a logo URL (skip if not present).

## Where the theme applies
- `src/styles.css` — rewrite `:root` and `.dark` token values to the palette above. Keep `--radius`, `--success`, `--warning`, `--destructive` semantics; only retune hues to harmonize (success stays green, warning uses the brand amber).
- Keep `.hc-mode` overrides intact (student high-contrast mode).
- `SparkAvatar` color map (`src/components/spark-avatar.tsx`): retune `idle/friendly/listening/speaking` toward navy + amber so the avatar feels on-brand; keep semantic colors (angry red, love pink) recognizable.

## Out of scope
- No layout/UX changes — purely visual rebrand.
- No business-logic edits.
- Student page structure stays as previously designed; only colors + logo update.

## Technical notes
- All color edits go through CSS variables in `src/styles.css`; no hardcoded hex in components.
- Logo via `lovable-assets` CDN pointer, imported as JSON in the `SparkLogo` component.
- Favicon: add `<link rel="icon">` in `__root.tsx` head pointing to the asset URL.
