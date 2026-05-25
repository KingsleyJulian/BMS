-- ============================================================================
-- BMS · Supabase schema (per-building licensing)
--
-- Mental model:
--   one license  = one building (e.g. "Barangay San Isidro")
--   one device   = one installation row, FK -> license
--
-- The activation_code IS the building's external identifier — every PC in the
-- same office activates with the same code, registers its own hardware_id,
-- and joins the building's tenant scope. Optional max_seats caps how many
-- devices a single building license may run.
--
-- Supabase pieces:
--   licenses            — one row per building
--   installations       — many rows per license, one per device
--   building_snapshots  — one row per license; the shared JSONB snapshot
--                         that every device in the building sees
--
-- Authorization:
--   The Electron client never speaks to these tables directly with the
--   publishable key — it goes through Edge Functions running with the
--   service role. RLS is enabled and denies anon by default; policies that
--   allow authenticated reads check a `license_id` JWT claim that the
--   activate_license function bakes into the issued token.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Licenses (one per building)
-- ----------------------------------------------------------------------------
create table if not exists public.licenses (
  id              uuid primary key default gen_random_uuid(),
  activation_code text unique not null,        -- shared across the building's devices
  customer_name   text,                        -- e.g. "Barangay San Isidro"
  plan            text not null default 'pilot',
  max_seats       integer,                     -- null = unlimited devices
  expires_at      timestamptz not null,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. Installations (one per device)
-- ----------------------------------------------------------------------------
create table if not exists public.installations (
  hardware_id    text primary key,
  license_id     uuid not null references public.licenses(id) on delete cascade,
  device_label   text,                          -- optional human label, e.g. "Front desk"
  version_tag    text not null default 'v0.1',
  last_check_in  timestamptz,
  sync_trigger   boolean not null default false,  -- realtime "go now" flag (per device)
  created_at     timestamptz not null default now()
);

create index if not exists installations_license_idx on public.installations (license_id);

-- ----------------------------------------------------------------------------
-- 3. Building snapshots (one per license — shared by every device in building)
-- ----------------------------------------------------------------------------
create table if not exists public.building_snapshots (
  license_id              uuid primary key references public.licenses(id) on delete cascade,
  version_tag             text not null default 'v0.1',
  snapshot                jsonb not null default '{}'::jsonb,
  updated_at              timestamptz not null default now(),
  updated_by_hardware_id  text
);

-- Realtime: devices listen on per-license channels for both their own
-- installation row (sync_trigger flag) and the shared snapshot.
alter publication supabase_realtime add table public.installations;
alter publication supabase_realtime add table public.building_snapshots;

-- ----------------------------------------------------------------------------
-- 4. RLS
-- ----------------------------------------------------------------------------
alter table public.licenses           enable row level security;
alter table public.installations      enable row level security;
alter table public.building_snapshots enable row level security;

-- licenses: anon sees nothing; Edge Functions (service_role) bypass RLS.
create policy "no anon access on licenses"
  on public.licenses for all
  using (false) with check (false);

-- installations: a device can read/update its own row IF its JWT claims its
-- hardware_id, AND can read sibling rows belonging to the same building.
create policy "device reads own row"
  on public.installations for select
  using (auth.jwt() ->> 'hardware_id' = hardware_id);

create policy "device reads building peers"
  on public.installations for select
  using (auth.jwt() ->> 'license_id' = license_id::text);

create policy "device updates own row"
  on public.installations for update
  using (auth.jwt() ->> 'hardware_id' = hardware_id)
  with check (auth.jwt() ->> 'hardware_id' = hardware_id);

-- building_snapshots: every device in the building can read; only Edge
-- Functions write (so we can validate version + apply patches atomically).
create policy "building members read snapshot"
  on public.building_snapshots for select
  using (auth.jwt() ->> 'license_id' = license_id::text);

-- ----------------------------------------------------------------------------
-- 5. JSONB patching helper
--
-- Used by the apply_snapshot_patch Edge Function. Shallow-merges the patch
-- into the building's existing snapshot keyed by license_id. We never
-- overwrite the whole `snapshot` cell — only top-level keys present in the
-- patch are replaced.
-- ----------------------------------------------------------------------------
create or replace function public.merge_building_snapshot(
  p_license_id  uuid,
  p_patch       jsonb,
  p_version     text,
  p_hardware_id text
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_new jsonb;
begin
  insert into public.building_snapshots (license_id, snapshot, version_tag, updated_at, updated_by_hardware_id)
       values (p_license_id, p_patch, p_version, now(), p_hardware_id)
  on conflict (license_id) do update
       set snapshot               = coalesce(public.building_snapshots.snapshot, '{}'::jsonb) || excluded.snapshot,
           version_tag            = excluded.version_tag,
           updated_at             = now(),
           updated_by_hardware_id = excluded.updated_by_hardware_id
  returning snapshot into v_new;

  return v_new;
end;
$$;
