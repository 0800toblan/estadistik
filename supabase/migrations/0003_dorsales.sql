-- Dorsales flexibles
-- 1) El número habitual del jugador pasa a ser opcional.
alter table public.players alter column numero drop not null;
-- 2) Dorsal que el jugador usó en un partido puntual (si es distinto del habitual).
alter table public.stats add column if not exists dorsal integer;
