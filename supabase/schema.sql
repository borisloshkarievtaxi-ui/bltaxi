-- Reference schema aligned with the live BLTaxi Supabase project.
-- Run in SQL editor if bootstrapping a fresh project; skip if tables already exist.

create extension if not exists pgcrypto;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  business_name text not null,
  logo_url text,
  primary_color text not null default '#16a34a',
  phone_number text,
  default_commission numeric(5,2) not null default 15,
  created_at timestamptz not null default now()
);

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  phone text,
  status text not null default 'available' check (status in ('available', 'busy', 'offline')),
  balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_name text,
  client_phone text,
  origin text not null,
  destination text not null,
  price numeric(12,2),
  driver_id uuid references public.drivers(id) on delete set null,
  driver_name text,
  commission_value numeric(12,2),
  status text not null default 'pending' check (status in ('pending', 'assigned', 'completed')),
  payment_status text not null default 'unpaid',
  created_at timestamptz not null default now()
);

create index if not exists drivers_tenant_idx on public.drivers (tenant_id);
create index if not exists rides_tenant_status_idx on public.rides (tenant_id, status, created_at desc);

alter table public.tenants replica identity full;
alter table public.drivers replica identity full;
alter table public.rides replica identity full;

alter table public.tenants enable row level security;
alter table public.drivers enable row level security;
alter table public.rides enable row level security;

drop policy if exists tenants_select on public.tenants;
drop policy if exists tenants_update on public.tenants;
drop policy if exists drivers_all on public.drivers;
drop policy if exists rides_all on public.rides;

create policy tenants_select on public.tenants for select using (true);
create policy tenants_update on public.tenants for update using (true) with check (true);
create policy drivers_all on public.drivers for all using (true) with check (true);
create policy rides_all on public.rides for all using (true) with check (true);

do $$
begin
  begin
    alter publication supabase_realtime add table public.tenants;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.drivers;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.rides;
  exception when duplicate_object then null;
  end;
end $$;

insert into public.tenants (slug, business_name, logo_url, primary_color, phone_number, default_commission)
values ('bltaxi-demo', 'BLTaxi דמו', null, '#16a34a', '03-0000000', 15)
on conflict (slug) do nothing;
