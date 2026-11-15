-- =====================================================================
-- Dados de TESTE (fictícios). Rode DEPOIS de schema.sql.
-- Antes: em Authentication > Users, crie 3 usuários com estes e-mails
-- (marque "Auto Confirm User"):
--   familiar@teste.com   cuidador@teste.com   admin@teste.com
-- =====================================================================

update public.profiles set role = 'admin',    full_name = 'Admin Teste',    access_level = 'coordenacao'
 where email = 'admin@teste.com';
update public.profiles set role = 'cuidador', full_name = 'Elisa Pereira'
 where email = 'cuidador@teste.com';
update public.profiles set role = 'familiar', full_name = 'Carla Souza'
 where email = 'familiar@teste.com';

insert into public.residents (id, full_name, birth_date, room) values
  ('11111111-1111-1111-1111-111111111111', 'Maria Silva',   '1941-03-12', 'Quarto 3'),
  ('22222222-2222-2222-2222-222222222222', 'João Pereira',  '1938-07-02', 'Quarto 5')
on conflict do nothing;

insert into public.family_residents (family_id, resident_id, relationship)
select id, '11111111-1111-1111-1111-111111111111', 'filha'
  from public.profiles where email = 'familiar@teste.com'
on conflict do nothing;

insert into public.image_consents (resident_id, authorized, authorized_by, signed_on, valid_until)
values ('11111111-1111-1111-1111-111111111111', true, 'Carla Souza', '2026-02-05', '2027-02-05')
on conflict do nothing;

insert into public.prescriptions (resident_id, medicine, dose, times) values
  ('11111111-1111-1111-1111-111111111111', 'Losartana',  '50 mg',     '{08:00,20:00}'),
  ('11111111-1111-1111-1111-111111111111', 'Vitamina D', '1 cápsula', '{09:00}'),
  ('11111111-1111-1111-1111-111111111111', 'Metformina', '500 mg',    '{12:00}');

-- Doses de hoje: manhã já administradas, 20:00 aguardando.
insert into public.medication_administrations
  (prescription_id, resident_id, scheduled_for, status, administered_at, administered_by)
select p.id, p.resident_id, (current_date + t)::timestamptz,
       case when t < time '20:00' then 'administrado' else 'aguardando' end,
       case when t < time '20:00' then (current_date + t)::timestamptz + interval '5 minutes' end,
       case when t < time '20:00' then (select id from public.profiles where email = 'cuidador@teste.com') end
  from public.prescriptions p, unnest(p.times) as t
 where p.resident_id = '11111111-1111-1111-1111-111111111111'
on conflict do nothing;
