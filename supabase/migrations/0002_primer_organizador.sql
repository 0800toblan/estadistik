insert into public.organizers (user_id, email)
select id, email from auth.users where email = 'toblanqui@outlook.com'
on conflict do nothing;
