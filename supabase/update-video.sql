-- =====================================================================
-- Atualização: videochamada (datas bloqueadas, motivo de recusa, horários ocupados).
-- Rode UMA vez no SQL Editor. Pode repetir sem erro.
-- =====================================================================
alter table public.video_config
  add column if not exists blocked_dates date[] not null default '{}';

alter table public.video_requests
  add column if not exists note text,
  add column if not exists reason text,
  add column if not exists suggestion text,
  add column if not exists requester_name text;

-- Guarda o nome de quem pediu (a equipe e a administração leem sem acessar perfis).
create or replace function public.stamp_video_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.requester_name := (select full_name from public.profiles where id = auth.uid());
    new.status := 'solicitada';
  end if;
  return new;
end $$;
drop trigger if exists stamp_video_request_trg on public.video_requests;
create trigger stamp_video_request_trg
  before insert on public.video_requests
  for each row execute function public.stamp_video_request();

-- Família pode cancelar o próprio pedido que ainda não foi respondido.
drop policy if exists vreq_family_cancel on public.video_requests;
create policy vreq_family_cancel on public.video_requests for update
  using (requested_by = auth.uid() and status = 'solicitada')
  with check (requested_by = auth.uid() and status = 'cancelada');

-- Horários já ocupados (sem revelar quem pediu): evita dois pedidos no mesmo horário.
create or replace function public.video_taken_slots()
returns setof timestamptz language sql stable security definer set search_path = public as $$
  select slot_start from public.video_requests
   where status in ('solicitada', 'confirmada') and slot_start > now()
$$;
revoke all on function public.video_taken_slots() from public, anon;
grant execute on function public.video_taken_slots() to authenticated;

-- Um horário só pode ter um pedido ativo; pedidos cancelados/recusados liberam o horário.
alter table public.video_requests drop constraint if exists video_requests_resident_id_slot_start_key;
create unique index if not exists video_requests_active_slot
  on public.video_requests (slot_start) where status in ('solicitada', 'confirmada');
