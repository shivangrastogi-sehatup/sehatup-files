# SehatUp Design System

> Brand & component foundations for the **SehatUp CRM** and adjacent SehatUp surfaces. SehatUp positions itself as **"India's First Integrated Digital Health Clinic"**, blending Allopathy, Ayurveda and Homeopathy through health questionnaires, doctor consults, lab tests and pharmacy.

This system was built to fix a specific brief: the existing CRM (`sehatup-analytics`) shipped with a dark, glassy, gradient-heavy aesthetic that read as a consumer fintech demo, not a healthcare CRM. The system below pulls the operator-facing surfaces into a **clean, light, role-aware CRM** while preserving SehatUp's pink/red brand DNA from the mobile app and marketing site.

---

## Sources

| Source | Path / link |
|---|---|
| Provided GitHub repo | `shivangrastogi-sehatup/sehatup-files` (default branch `main`) |
| Operator/marketing CRM (the one being redesigned) | `sehatup-analytics/` (Next.js 15 + Tailwind + Firebase auth) |
| Mobile app — patient-facing | `sehatup-mobile/` (React Native + Expo) — source of brand palette, typography intent and category styling |
| Public product catalog | `PRODUCT_LIST.md`, `PRODUCT_LIST.csv` |
| Logos | `assets/sehatup-favicon.png`, `assets/sehatup-logo-wordmark.png` |

Assume the reader does **not** have access to the repo; everything required to design with the brand is encoded in this folder.

---

## Index of this folder

| File / folder | What it is |
|---|---|
| `README.md` | This document — context, content & visual fundamentals, iconography |
| `colors_and_type.css` | All CSS variables: brand + neutral + semantic colors, type tokens, semantic typography classes (`.t-h1`, `.t-body`, …), spacing, radii, shadows, motion |
| `components.css` | Reusable component CSS: `.btn`, `.input`, `.chip`, `.kpi`, `.ds-table`, `.avatar`, `.ds-card` |
| `fonts/` | Webfont files. **Currently empty — see "Font substitution" caveat.** |
| `assets/` | Logos and brand marks (`logo-mark.svg`, wordmark PNG, favicon JPG) |
| `preview/` | Small HTML cards that populate the Design System tab — type scale, color scales, spacing, components, logo |
| `ui_kits/sehatup-crm/` | Pixel-level recreation of the redesigned CRM: login, dashboard, patients list, patient detail, role-based shell |
| `SKILL.md` | Agent Skill manifest so this folder can be lifted into Claude Code |

---

## Products in scope

1. **SehatUp Analytics / CRM** — internal operator console. Four roles: `admin`, `doctor`, `performance_marketing`, `user`. Today's pain: dark gradient theme, glassmorphism, no role-aware surfaces, doesn't read as a CRM. **This is the focus of the redesign.**
2. **SehatUp Mobile** — patient app for booking consults, taking the health questionnaire, ordering meds and lab tests. Used here only as a source of brand truth (colors, type, voice).
3. **Marketing / e-commerce site** — `sehatUP-product-direct-cart-main` (not redesigned in this system, but voice samples were lifted from product copy).

---

## CONTENT FUNDAMENTALS

The CRM speaks like a **calm, competent clinician** — never a marketer, never a chatbot. Operators are reading this all day; copy should disappear into the workflow.

### Voice & tone

- **Plain, declarative, lowercase-friendly.** "Patients", "Submissions", "Health Score" — no exclamation marks, no "✨ insights".
- **"You" is the operator, never the patient.** Patient-facing copy in the mobile app uses warmer phrasing ("Let's begin your health journey"); CRM copy stays in the third person: *"Aarav started the questionnaire 14 min ago."*
- **Numbers before adjectives.** "72 / 100 health score" beats "great health score". The CRM is a numbers tool.
- **Action verbs at the start of buttons.** *Assign doctor*, *Open chart*, *Export CSV*, *Resend WhatsApp*. Never *Click here*, never *Get started*.
- **Risk language follows the clinical chips:** *Low risk*, *Moderate risk*, *High risk*. Never "danger" in patient-facing text, never red emoji.
- **Empty states are instructive, not cute.** *"No submissions in this range. Try widening the date filter or clearing role filters."* — not *"Looks empty here! 🌱"*.

### Casing

- **Sentence case** for everything except acronyms (CRM, PCOS, ED, NABL, BMI, PDF) and the wordmark itself (`sehatUP`, with **`UP`** always in brand red).
- Section headers: `Recent activity`, not `RECENT ACTIVITY` or `Recent Activity`.
- Overline labels in the UI use ALL CAPS with `letter-spacing: 0.06em` — that is the *only* uppercase context.

### Brand naming

| Write | Don't |
|---|---|
| `sehatUP` (in body copy & logo) | `Sehatup`, `SehatUp`, `SEHAT-UP` |
| `sehatUP Care` (working name for the CRM) | `Sehatup Dashboard`, `Admin Panel` |
| Health Score (capitalised noun) | health-score, healthscore |

### Emoji & exclamation

- **No emoji in operator surfaces.** None. The mobile app uses a few category emoji 🧘 💪 — those stay on mobile.
- Exclamation marks only in error toasts that the operator caused (*"Couldn't save — check your connection!"*) — never in regular UI labels.

### Sample copy (lifted/inspired by the actual product)

> *India's First Integrated Digital Health Clinic*  — homepage tagline, kept verbatim in marketing surfaces
> *Take the Health Assessment*  — primary patient CTA on mobile
> *Allopathy · Ayurveda · Homeopathy — under one care plan.*  — value-prop subhead
> *Aarav S. — score 72, last assessment 09 May, owner Dr. Mehra*  — typical CRM row narration

---

## VISUAL FOUNDATIONS

The system's job is to make a **medical operator console feel medical**. That means light surfaces, generous breathing room, hairline borders, restrained colour, and one disciplined brand accent.

### Surfaces & background

- **Light by default.** App background `--bg-app: #F8FAFC` (slate-50). Cards sit on `--bg-surface: #FFFFFF`. Dark mode is out-of-scope for v1.
- **No full-bleed photography in the operator product.** Imagery is reserved for the mobile app and marketing site (warm, clinical-soft photographs of people, never moody/cool).
- **No mesh gradients, no glassmorphism, no animated blobs** — explicitly removing what the old CRM had.
- **Backgrounds are flat or, at most, a one-stop linear gradient on the brand red** (used only on the marketing hero and the optional "knockout" logo variant — never inside CRM chrome).
- **No repeating patterns or textures.** Health-line motif in the logo mark is the *only* decorative line.

### Colour

- **One brand accent: SehatUp Red (`#E11D48` / rose-600).** It marks brand, primary CTAs, the active nav state, and the "UP" in the wordmark. The original purple (`#6D28D9`) survives as the **admin** role accent only — it is no longer a primary surface colour.
- **Slate is the workhorse.** 90% of the CRM is `slate-50` / `slate-100` / `white` with `slate-700` / `slate-900` text.
- **Role colours are functional, not decorative**: admin = violet, doctor = teal, marketing = amber, patient = green. They appear in chips, avatars, and the sidebar count badge of the active role's section — never as a background wash.
- **Risk colours map to status semantics**, not severity for its own sake: success/green = low risk, amber = moderate, red = high. The brand red and the danger red are *different shades* (`#E11D48` vs `#EF4444`) so a "delete" action never looks like the SehatUp logo.

### Type

- **Display: Outfit** (700/600) — used for H1–H3, KPI numerals, the wordmark.
- **Body: Inter** (400/500/600) — body, labels, table cells.
- **Mono: JetBrains Mono** (500) — IDs, timestamps, hex codes, anything tabular-numeric.
- **Tabular numbers everywhere money/scores live**: `font-feature-settings: 'tnum' 1, 'lnum' 1` is baked into `.kpi__value` and `.t-mono`.
- **Letter-spacing**: display sizes get `-0.01em` (snug); overlines get `+0.06em`.

### Spacing & layout

- **4-px base scale.** Tokens `--space-1` … `--space-16`. Card padding is `--space-5/6`, page gutter is `--space-8`.
- **Sidebar fixed at 260 px**; topbar fixed at 60 px. Main content uses a max content width of `1280 px` centered, with `var(--space-8)` gutters.
- **Tables breathe**: 12–16 px vertical padding per row, hairline `--border-default` between rows. No zebra striping.
- **Grid first, flex second.** Layouts use CSS grid with `gap`; never bare margins for inter-element spacing.

### Corners & elevation

- **Radii: `sm 6 / md 10 / lg 14 / xl 20 / pill 9999`.** Buttons are `sm`, cards are `md`, modals are `lg`. Nothing is fully rectangular and nothing is hyper-rounded.
- **Four-step elevation:**
  - `xs` (hairline) — rest state of every interactive surface
  - `sm` — cards, KPI tiles, dropdown rest
  - `md` — popovers, menus, hover lift on cards
  - `lg` — modals, sheets
- **No inner shadows.** No coloured shadows. Shadows are always neutral, slight, and supportive — never decorative.

### Borders

- `--border-default: #E2E8F0` (slate-200) is the only border for divider work.
- `--border-strong: #CBD5E1` (slate-300) appears on hover of inputs and as the top of a sticky table header.
- Inputs use a 1-px border; focus replaces the border colour with `--brand-red` and adds a 3-px `--shadow-focus` ring (rose-100 at 60%).

### Motion

- **Token durations:** `--dur-fast 140ms`, `--dur-base 220ms`, `--dur-slow 320ms`.
- **Easing:** `--ease-out` is the default (cubic-bezier(0.16, 1, 0.3, 1) — "out-expo"). Reserved `--ease-bounce` for confirmation toasts on the mobile app only.
- **Hover states**: filter:brightness(1.06) on filled buttons, background shift on ghost/secondary. Never a scale on hover in the CRM.
- **Press states**: `translateY(1px)` and shadow removal — never a colour change.
- **No looping animations** in the operator product. No skeleton-shimmer pulse — use the `--bg-subtle` block instead.

### Cards & containers

- White background, `--border-default` hairline, `--radius-md`, `--shadow-sm`. That's the card.
- Card headers are 600-weight Outfit, left-aligned, with an optional trailing utility (filter pill, "View all →" ghost button).
- **No coloured left borders** on cards. (We are explicitly avoiding the "rounded card with a colored left stripe" trope.)

### Transparency & blur

- Transparency is used in **two places only**: the focus ring (`rgba(244,63,94,.15)`) and modal backdrops (`rgba(15,23,42,.45)`).
- **No `backdrop-filter: blur()` anywhere.** Solid surfaces always win.

### Layout rules / fixed elements

- The sidebar and topbar are `position: sticky`, not floating overlays.
- Toasts dock bottom-right, max 3 stacked, auto-dismiss at 5 s for info / never for danger.
- The role-switcher lives in the topbar avatar menu, **not** in the sidebar.

---

## ICONOGRAPHY

- **Library: [Lucide](https://lucide.dev)** — the same set the existing `sehatup-analytics` codebase already uses (`lucide-react`). Stroke-based, 1.5 – 2 px stroke, 24 × 24 canvas, line-cap `round`, line-join `round`. **Always stroke `currentColor`** so chips/buttons can recolour them.
- **No icon font.** Icons are imported as React components or inlined as `<svg>` in static HTML cards. CDN fallback for prototypes:
  ```html
  <script src="https://unpkg.com/lucide@latest"></script>
  <script>lucide.createIcons();</script>
  ```
- **No emoji as icons** in the CRM. The mobile app uses a small set of category emoji (🧘 💪 🤰) — those do **not** cross into operator surfaces.
- **No Unicode glyphs** as decoration (no ✓, ★, ➜). Use the equivalent Lucide icon or a CSS shape.
- **Icon sizing scale:** `14px` inline in labels, `16px` in chips & buttons, `20px` in nav items, `24px` standalone, `32px` in KPI glyphs.
- **Icon colour:** inherits `currentColor`. For tinted glyphs (KPI icons, role tiles) the colour comes from a `--*-soft` background and the matching solid foreground token (e.g. `background: var(--success-soft); color: var(--success);`).
- **Illustrations:** none ship with this system. Empty states use the matching Lucide icon at 48 px with `--text-muted` colour. If marketing illustrations are added later they should follow the photograph aesthetic (warm, soft-clinical), not flat vector cartoons.
- **Logos shipped:**
  - `assets/sehatup-logo-wordmark.png` — full wordmark, 7103×1772, transparent
  - `assets/sehatup-favicon.png` — square mark, 640×640
  - `assets/logo-mark.svg` — clean SVG re-draw of the mark (rounded square + stylised `S` + heartbeat line) for inline use in chrome, sized down to 22–56 px

---

## Caveats & known substitutions

- **Fonts (Outfit, Inter, JetBrains Mono) are loaded from Google Fonts via `@import` in `colors_and_type.css`.** No `.woff2` files ship in `fonts/`. If you have brand-licensed copies, drop them in `fonts/` and switch the `@import` for a `@font-face` block.
- **The `assets/logo-mark.svg`** is a hand-drawn approximation of the favicon; the original is a flat raster. Replace with the brand team's master SVG when available.
- **No bespoke illustration set** — the mobile app's `assets/illustrations/` was not part of this build. Empty states fall back to Lucide.
- **Dark mode tokens are not defined.** All semantic vars assume the light theme. Adding `[data-theme="dark"]` overrides is a v2 task.
