# Tawilati brand kit

Staging folder for the approved brand. Move into the app once the repo is set up (see [Moving into the app](#moving-into-the-app)).

- `guidelines.html`: the full brand book (logo, colour, type, icons, components, applications, imagery, voice). It renders from the files below. Open it through a local server, or see the published copy at https://claude.ai/artifact/DS7CHCDioySP6nYcYzJVSV
- `Tawilati-Brand-Guidelines.pdf`: A4 PDF of `guidelines.html`, for sharing and printing. To regenerate after changes, serve this folder locally, open `guidelines.html` in Chrome and use Print → Save as PDF with Background graphics on. The print styles already handle the A4 layout.
- `brand-guidelines.md`: the official written guidelines. This is the source of truth.
- `reference/brand-board.png`: the approved brand board. The logo files recreate it.
- `tokens.css`: colour, status, type scale, spacing, radius and shadow tokens.
- `components.css`: reference styles for buttons, text fields, messages, menu item card, quantity stepper, sidebar, status badges and cards. Framework-agnostic; port them to the app's components.
- `logo/`: production SVGs. The wordmark and tagline are converted to outlines, so they need no fonts.
- `icons/`: the ten navigation icons, with interface icons in `icons/ui/`. 24 px grid, 2 px stroke, `currentColor`.
- `tools/`: `gen-logos.mjs` and `gen-icons.mjs` regenerate `logo/` and `icons/`.

## Icons

| Brand name | File | In code (lucide-react) |
|---|---|---|
| Home / Dashboard | `icons/home.svg` | `House` |
| Menu | `icons/menu.svg` | custom: build from the SVG |
| Tables | `icons/tables.svg` | custom: build from the SVG |
| Orders | `icons/orders.svg` | `ShoppingCart` |
| Kitchen | `icons/kitchen.svg` | custom: build from the SVG |
| Staff | `icons/staff.svg` | `Users` |
| Reports | `icons/reports.svg` | custom: build from the SVG |
| Settings | `icons/settings.svg` | `Settings` |
| QR | `icons/qr.svg` | `ScanQrCode` |
| Payment | `icons/payment.svg` | `CreditCard` |

Lucide has no matching menu card, dining table, cloche or outlined bar chart, so those four are drawn on Lucide's grid and stroke. Lucide is ISC licensed (`icons/LICENSE-lucide.txt`).

Pin `lucide-react` to the version that matches `lucide-static@0.460.0` (used to generate these files), or regenerate after upgrading.

## Logo files

| File | Use |
|---|---|
| `tawilati-horizontal.svg` | Desktop nav, landing header |
| `tawilati-horizontal-tagline.svg` | Landing hero, documents, slides |
| `tawilati-stacked.svg` / `-stacked-tagline.svg` | QR table cards, print, promo |
| `tawilati-icon.svg` | Compact nav, sidebar collapsed, loaders |
| `tawilati-wordmark.svg` | Where the icon already appears nearby |
| `*-reverse.svg` | On Forest Green (cream ink, amber signal) |
| `tawilati-icon-mono.svg` | One-colour use: stamps, embossing, single-ink print |
| `app-icon.svg` / `app-icon-light.svg` | PWA / home-screen icon (1024 × 1024, rounded tile) |
| `favicon.svg` | Browser tab. A small-size cut with two arcs and heavier strokes, readable at 16 px |

Colours in the files: Forest Green `#254D3B`, Amber `#E5A45B`, Cream `#F8F5EC`, tagline `#5B6660`.

### Rules (from the guidelines)

- Keep clear space of at least the height of the cup on every side.
- Minimum sizes: icon 16 px (use `favicon.svg` below 24 px). Horizontal lockup 120 px wide. Tagline lockups 200 px wide.
- Never stretch, rotate, recolour outside the palette, or add shadows, gradients or 3D.
- Never swap the mark for an icon-library cup or Wi-Fi glyph.

## Fonts

- **Playfair Display**: brand headings and marketing titles. The wordmark in the SVGs is Playfair Display Bold, outlined.
- **Inter**: all application UI.

In Next.js, load both with `next/font/google` and map them to `--font-brand` / `--font-ui`.

Neither font has Arabic glyphs. The Arabic interface (a stretch goal) needs an Arabic pairing, for example Noto Naskh Arabic beside Playfair and IBM Plex Sans Arabic beside Inter. The guidelines haven't decided this yet.

## Contrast notes

Checked with WCAG 2.x formulas. See the comments in `tokens.css`.

- Amber (`#E5A45B`, 1.97:1 on cream) and Sage (`#8BA88B`, 2.39:1 on cream; white on sage 2.60:1) fail as text colours. Use them for fills and decoration only. For text, use `--brand-accent-ink` and `--brand-secondary-ink`.
- Charcoal on Amber passes (6.8:1) if an amber badge or button is ever needed.
- Status badges have their own tokens (`--status-*`). They don't rely on brand colours, and every badge carries a text label.

## Regenerating the logos and icons

```bash
mkdir fontpkg && cd fontpkg && npm init -y
npm install opentype.js@1.3.4 @fontsource/playfair-display@5 @fontsource/inter@5 lucide-static@0.460.0 --ignore-scripts
node ../brand/tools/gen-logos.mjs "$PWD" ../brand/logo
node ../brand/tools/gen-icons.mjs "$PWD" ../brand/icons
```

## Moving into the app

When the Next.js app exists:

1. `logo/*.svg` → `public/brand/`. `favicon.svg` → `app/icon.svg`. `app-icon.svg` → the PWA manifest icons (export PNGs at 192 / 512).
2. `tokens.css` → imported from `app/globals.css`, or mapped into the Tailwind theme. `components.css` → rebuilt as React components (Button, TextField, Toast, MenuItemCard, QuantityStepper, Sidebar, StatusBadge, Card) using the same tokens.
3. `brand-guidelines.md` and `reference/` → `docs/brand/`.
4. Build `<Logo variant="horizontal | stacked | icon" tone="light | dark" />` from the SVGs rather than using `<img>` everywhere.
