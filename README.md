# BMS — Barangay Management System

A local-first desktop application for Philippine barangays. Built with **Electron + Vue 3**, with a **PocketBase** sidecar for local data and **Supabase** for licensing and cross-device sync.

Data lives on the machine first; the cloud is only used for license activation, periodic check-ins, and syncing shared building data between devices in the same barangay office.

---

## Prerequisites

- **Node.js** 18+ and npm
- A **Supabase** project (free tier is fine) — only needed for licensing/sync
- **Supabase CLI** (optional) — only if you want to deploy the Edge Functions
- Internet access on first run to download the PocketBase binary

---

## Install

```bash
git clone https://github.com/KingsleyJulian/BMS.git
cd BMS
npm install
```

### Download the PocketBase binary

PocketBase runs as a bundled sidecar. Fetch the binary for your platform (Windows/macOS/Linux are auto-detected):

```bash
npm run fetch:pocketbase
```

This downloads PocketBase v0.22.21 into `resources/pocketbase/`. The binary is gitignored, so this step is required on every fresh clone.

---

## Configure

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | yes | Your Supabase project URL, e.g. `https://xxxx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | yes | The publishable (anon) key — safe to bundle; constrained by Row-Level Security |
| `LICENSE_ENCRYPTION_SECRET` | yes | Build-time secret used to derive the local AES key for the license token. Rotate per release |
| `POCKETBASE_ADMIN_EMAIL` | yes | Local PocketBase admin, created on first run |
| `POCKETBASE_ADMIN_PASSWORD` | yes | Change this from the default before real use |
| `SUPABASE_SERVICE_ROLE_KEY` | setup only | Needed **only** by the Supabase setup script. Do not bundle it into the app |

> The activation/lock gate is currently **disabled** in `src/renderer/src/App.vue` so the app opens without a license. To re-enable licensing, uncomment the `LicensePortal` and `LockScreen` branches there.

---

## Supabase setup (licensing & sync)

Only needed if you want activation and cross-device sync to work end-to-end.

### 1. Apply the database schema

Postgres DDL must be run from the SQL editor:

1. Open `https://supabase.com/dashboard/project/<your-ref>/sql/new`
2. Paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.

### 2. Seed a starter license

Add `SUPABASE_SERVICE_ROLE_KEY` to your `.env`, then run:

```bash
npm run setup:supabase
```

This verifies the schema and seeds a pilot building license (prints the activation code on success).

### 3. Deploy the Edge Functions

The three licensing functions must be deployed **with JWT verification turned off**:

```bash
supabase login
supabase link --project-ref <your-ref>
supabase functions deploy activate_license --no-verify-jwt
supabase functions deploy check_in --no-verify-jwt
supabase functions deploy apply_snapshot_patch --no-verify-jwt
```

---

## Run

```bash
npm run dev
```

The app launches with PocketBase starting automatically as a sidecar.

---

## Build a distributable

```bash
npm run build      # type-check + compile
npm run dist       # package an installer (NSIS on Windows, DMG on macOS, AppImage on Linux)
```

Or `npm run package` for an unpacked directory build (no installer).

---

## Project layout

```
src/main/        Electron main process (PocketBase sidecar, licensing, Supabase, sync)
src/preload/     Preload bridge exposing window.bms to the renderer
src/renderer/    Vue 3 app (views, stores, components)
resources/pocketbase/  PocketBase binary (fetched) + migrations
supabase/        schema.sql + Edge Functions (activate_license, check_in, apply_snapshot_patch)
scripts/         fetch-pocketbase, setup-supabase helpers
```

## Licensing model

One activation code = one barangay (building). Multiple devices in the same office activate with the same code; each registers its own `hardware_id` row in `installations`, all linked to a single `licenses` row. `licenses.max_seats` caps how many devices a building license may run. Shared building data syncs via `building_snapshots`, keyed by `license_id`.
