---
name: sehatup-design
description: Use this skill to generate well-branded interfaces and assets for SehatUp — India's integrated digital health clinic — for production code or throwaway prototypes/mocks/decks. Contains essential design guidelines, color and type tokens, fonts, logos, and a CRM UI kit for prototyping operator-facing surfaces (admin, doctor, marketing, patient roles).
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc.), copy assets out of `assets/` and `preview/` and create static HTML files for the user to view. Reference `colors_and_type.css` and `components.css` directly — they're already structured as drop-in stylesheets. If working on production code (Next.js / React Native), copy the CSS variables into your tokens layer and read the rules in `README.md` to become an expert in designing with this brand.

For SehatUp specifically:

- The product is a **healthcare CRM**, not a consumer fintech app. Defaults are light, calm, restrained.
- **One brand accent only** — SehatUp Red (`#E11D48`). The legacy purple is reserved for the admin role.
- **Four operator roles** carry the role accent system: `admin` (violet), `doctor` (teal), `marketing` (amber), `user` (green).
- **No emoji, no gradients, no glassmorphism** in operator surfaces. These were the failure modes of the old design.
- Iconography is **Lucide**, stroke-based, 1.5–2 px.

If the user invokes this skill without any other guidance, ask them what they want to build or design (which role, which surface, single screen or flow), ask a few focused questions, and act as an expert designer who outputs HTML artifacts *or* production code, depending on the need. Start every design exploration by referencing `ui_kits/sehatup-crm/index.html` — it is the canonical example of the redesigned visual language.
