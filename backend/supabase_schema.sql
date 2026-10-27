create table if not exists public.simulations (
  id uuid primary key,
  created_at timestamptz not null default now(),
  inputs jsonb not null,
  outputs jsonb not null
);
create index if not exists simulations_created_idx on public.simulations (created_at desc);
alter table public.simulations enable row level security;
create policy "anon read"   on public.simulations for select using (true);
create policy "anon insert" on public.simulations for insert with check (true);
