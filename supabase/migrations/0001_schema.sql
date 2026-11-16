-- Liga de Korfball: esquema, seguridad y datos iniciales
-- Pegalo completo en Supabase → SQL Editor → Run.

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) > 0),
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  liga_id uuid not null references public.leagues(id) on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  equipo_id uuid not null references public.teams(id) on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  numero integer not null,
  created_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  liga_id uuid not null references public.leagues(id) on delete cascade,
  equipo_a_id uuid not null references public.teams(id) on delete cascade,
  equipo_b_id uuid not null references public.teams(id) on delete cascade,
  fecha date not null,
  hora text,
  lugar text,
  estado text not null default 'en_curso' check (estado in ('en_curso', 'finalizado')),
  resultado_equipo_a integer,
  resultado_equipo_b integer,
  created_at timestamptz not null default now(),
  check (equipo_a_id <> equipo_b_id)
);

create table public.stats (
  id uuid primary key default gen_random_uuid(),
  partido_id uuid not null references public.matches(id) on delete cascade,
  jugador_id uuid not null references public.players(id) on delete cascade,
  puntos integer not null default 0,
  asistencias integer not null default 0,
  rebotes integer not null default 0,
  tiros integer not null default 0,
  robos integer not null default 0,
  perdidas integer not null default 0,
  created_at timestamptz not null default now(),
  unique (partido_id, jugador_id)
);

create index on public.teams (liga_id);
create index on public.players (equipo_id);
create index on public.matches (liga_id);
create index on public.stats (partido_id);
create index on public.stats (jugador_id);

-- Organizadores: solo los usuarios listados acá pueden escribir.
create table public.organizers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text
);

create or replace function public.is_organizer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.organizers where user_id = auth.uid());
$$;

-- Seguridad: lectura pública, escritura solo organizadores.
alter table public.organizers enable row level security;
create policy "ver mi fila" on public.organizers
  for select to authenticated using (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['leagues', 'teams', 'players', 'matches', 'stats'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "lectura publica" on public.%I for select using (true)', t);
    execute format(
      'create policy "organizadores escriben" on public.%I for all to authenticated using (public.is_organizer()) with check (public.is_organizer())', t);
  end loop;
end $$;

-- Datos iniciales
with l as (
  insert into public.leagues (nombre) values ('Liga Bonaerense de Korfball') returning id
)
insert into public.teams (liga_id, nombre)
select l.id, n from l, unnest(array[
  'La Patriada A', 'La Patriada B', 'Escorpiones', 'Fosforitos', 'Uruguay Korf', 'CEF 102'
]) as n;
