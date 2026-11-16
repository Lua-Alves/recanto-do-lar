-- =====================================================================
-- Atualização: atividades do dia (registro por quem fez, visível à família).
-- Rode UMA vez no SQL Editor. Pode repetir sem erro.
-- =====================================================================
alter table public.activities
  add column if not exists registered_by_name text,
  add column if not exists registered_at timestamptz;

alter table public.activities alter column status set default 'Programada';
update public.activities set status = 'Programada' where status = 'Prevista';

-- Quem salvou e quando ficam gravados pelo banco (o app não escolhe).
create or replace function public.stamp_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.created_by := coalesce(new.created_by, auth.uid());
    new.registered_by_name := (select full_name from public.profiles where id = auth.uid());
    new.registered_at := now();
  else
    new.registered_by_name := coalesce(new.registered_by_name, (select full_name from public.profiles where id = new.created_by));
    new.registered_at := coalesce(new.registered_at, now());
  end if;
  return new;
end $$;
drop trigger if exists stamp_activity_trg on public.activities;
create trigger stamp_activity_trg
  before insert or update on public.activities
  for each row execute function public.stamp_activity();

-- Exemplos de hoje para a Maria (só se ainda não houver atividades hoje).
insert into public.activities (resident_id, activity_date, activity_time, name, status, participation, observation, created_by, registered_at)
select r.id, (now() at time zone 'America/Sao_Paulo')::date, v.t::time, v.n, v.s, v.p, v.o,
       (select id from public.profiles where role = 'cuidador' order by created_at limit 1),
       now()
  from public.residents r,
       (values ('10:00', 'Oficina de pintura', 'Realizada', 'Participou', 'Maria participou e se divertiu'),
               ('15:30', 'Lanche da tarde', 'Programada', null, null)) as v(t, n, s, p, o)
 where r.full_name = 'Maria Silva'
   and not exists (
     select 1 from public.activities a
      where a.resident_id = r.id and a.activity_date = (now() at time zone 'America/Sao_Paulo')::date);
