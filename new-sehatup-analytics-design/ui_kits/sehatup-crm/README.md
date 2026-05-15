# sehatUP CRM — UI Kit

Pixel-level recreation of the **redesigned** operator console. Replaces the dark gradient theme of the original `sehatup-analytics` codebase with a calm, light, role-aware CRM.

Open `index.html` for an interactive click-through. The flow:

1. **Login** — role-aware sign-in (admin / doctor / marketing / user). Each role logs into a slightly different shell.
2. **Dashboard** — KPI strip, recent submissions feed, risk distribution.
3. **Patients** — searchable list with risk/role filters.
4. **Patient detail** — health-score header, assessment timeline, action rail.

## Components

| File | Exports |
|---|---|
| `components.jsx` | `Sidebar`, `Topbar`, `Button`, `Chip`, `Avatar`, `KPI`, `Card`, `Input`, `Select`, `Icon` (Lucide-style inline SVGs) |
| `screens.jsx` | `LoginScreen`, `DashboardScreen`, `PatientsScreen`, `PatientDetailScreen`, `App` (router) |

All components consume CSS variables from `../../colors_and_type.css` and `../../components.css` — there is no styling logic inside the JSX, only structure & light layout.

## What it is and isn't

- ✅ High-fidelity visuals, real navigation, mocked data.
- ✅ Reusable JSX you can lift directly into a Next.js app.
- ❌ Not connected to Firebase. No real auth, no real Firestore queries.
- ❌ Not all settings/admin screens are recreated — focus is the operator surface most users see.
