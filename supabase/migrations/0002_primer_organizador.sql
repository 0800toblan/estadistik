-- Corré esto DESPUÉS de crear el usuario en Supabase → Authentication → Users → Add user.
-- Cambiá el email por el del organizador. Repetilo por cada organizador nuevo.
insert into public.organizers (user_id, email)
select id, email from auth.users where email = 'toblanqui@outlook.com'
on conflict do nothing;
