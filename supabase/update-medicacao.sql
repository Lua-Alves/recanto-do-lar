-- =====================================================================
-- Atualização: medicação (doses do dia, regras da equipe e da administração).
-- Rode UMA vez no SQL Editor do Supabase. Pode repetir sem erro.
-- ATENÇÃO: apaga as doses de teste antigas (seed) para recriá-las no fuso certo.
-- =====================================================================

-- Nome de quem administrou, guardado na própria dose (a família lê sem acessar perfis).
alter table public.medication_administrations
  add column if not exists administered_by_name text;

delete from public.medication_administrations;

-- Ao marcar "administrado", o banco preenche horário, responsável e nome.
-- O app não consegue informar outra pessoa nem outro horário.
create or replace function public.stamp_administration()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'administrado' and (tg_op = 'INSERT' or old.status is distinct from 'administrado') then
    new.administered_at := now();
    new.administered_by := auth.uid();
    new.administered_by_name := (select full_name from public.profiles where id = auth.uid());
  elsif new.status <> 'administrado' then
    new.administered_at := null;
    new.administered_by := null;
    new.administered_by_name := null;
  end if;
  return new;
end $$;

drop trigger if exists stamp_administration_trg on public.medication_administrations;
create trigger stamp_administration_trg
  before insert or update on public.medication_administrations
  for each row execute function public.stamp_administration();

-- Gera as doses de hoje (fuso de São Paulo) a partir das prescrições ativas.
create or replace function public.ensure_doses_today()
returns void language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  insert into public.medication_administrations (prescription_id, resident_id, scheduled_for)
  select p.id, p.resident_id, ((d + t) at time zone 'America/Sao_Paulo')
    from public.prescriptions p, unnest(p.times) as t
   where p.active and p.start_date <= d and (p.end_date is null or p.end_date >= d)
  on conflict (prescription_id, scheduled_for) do nothing;
end $$;
revoke all on function public.ensure_doses_today() from public, anon;
grant execute on function public.ensure_doses_today() to authenticated;

-- Prescrição: a EQUIPE cadastra e altera; família lê as do seu residente.
-- A administração não acessa prescrições (só enxerga a visão sem nome do residente).
drop policy if exists rx_read  on public.prescriptions;
drop policy if exists rx_admin on public.prescriptions;
drop policy if exists rx_staff_read  on public.prescriptions;
drop policy if exists rx_staff_write on public.prescriptions;
create policy rx_read on public.prescriptions for select
  using (public.is_caregiver() or public.is_family_of(resident_id));
create policy rx_staff_write on public.prescriptions for all
  using (public.is_caregiver()) with check (public.is_caregiver());

-- Visão para a administração: doses de hoje que aguardam, SEM nome do residente.
create or replace view public.pending_medications as
  select a.id, p.medicine, p.dose, a.scheduled_for
    from public.medication_administrations a
    join public.prescriptions p on p.id = a.prescription_id
   where a.status = 'aguardando'
     and (a.scheduled_for at time zone 'America/Sao_Paulo')::date
         = (now() at time zone 'America/Sao_Paulo')::date
     and (public.is_admin() or public.is_caregiver());
revoke all on public.pending_medications from anon;
grant select on public.pending_medications to authenticated;
