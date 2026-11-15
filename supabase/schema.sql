-- =====================================================================
-- Recanto do Lar · Esquema do banco (Supabase / PostgreSQL)
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Todos os dados de teste são fictícios.
-- =====================================================================

-- ---------- 1. Pessoas ------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  role          text not null default 'familiar'
                check (role in ('familiar', 'cuidador', 'admin')),
  access_level  text not null default 'padrao'
                check (access_level in ('padrao', 'coordenacao')),
  full_name     text not null default '',
  email         text,
  phone         text,
  cpf           text,                         -- opcional
  address       text,
  status        text not null default 'ativo'
                check (status in ('ativo', 'inativo', 'arquivado')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.residents (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  birth_date  date,
  room        text,
  status      text not null default 'ativo'
              check (status in ('ativo', 'inativo', 'arquivado')),
  notes       text,                           -- observações gerais da equipe
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Um familiar pode acompanhar vários residentes e vice-versa.
create table public.family_residents (
  family_id     uuid not null references public.profiles (id) on delete cascade,
  resident_id   uuid not null references public.residents (id) on delete cascade,
  relationship  text,                         -- filha, neto, etc.
  primary key (family_id, resident_id)
);

-- Autorização de uso de imagem, com validade.
create table public.image_consents (
  resident_id   uuid primary key references public.residents (id) on delete cascade,
  authorized    boolean not null default false,
  authorized_by text,                         -- nome de quem autorizou
  signed_on     date,
  valid_until   date,                         -- null = sem prazo
  updated_by    uuid references public.profiles (id),
  updated_at    timestamptz not null default now()
);

create table public.invites (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  role        text not null check (role in ('familiar', 'cuidador', 'admin')),
  profile_id  uuid references public.profiles (id) on delete cascade,
  status      text not null default 'pendente'
              check (status in ('pendente', 'aceito', 'expirado')),
  expires_at  timestamptz not null default now() + interval '7 days',
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now()
);

-- Histórico de alterações dos cadastros (quem mudou o quê).
create table public.change_log (
  id           bigint generated always as identity primary key,
  actor_id     uuid references public.profiles (id) on delete set null,
  entity       text not null check (entity in ('profile', 'resident', 'consent', 'invite')),
  entity_id    uuid,
  entity_label text,                          -- nome exibido; anonimizado na exclusão
  action       text not null,
  summary      text,
  anonymized   boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------- 2. Medicação ----------------------------------------------

-- Prescrição: O QUE o residente toma (responde "todos os medicamentos").
create table public.prescriptions (
  id            uuid primary key default gen_random_uuid(),
  resident_id   uuid not null references public.residents (id) on delete cascade,
  medicine      text not null,
  dose          text not null,                -- ex.: "50 mg", "1 cápsula"
  times         time[] not null,              -- horários diários
  start_date    date not null default current_date,
  end_date      date,
  active        boolean not null default true,
  prescribed_by text,                         -- nome do médico, texto livre
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

-- Administração: O QUE JÁ FOI DADO (responde "hoje", "falta", "ontem").
create table public.medication_administrations (
  id               uuid primary key default gen_random_uuid(),
  prescription_id  uuid not null references public.prescriptions (id) on delete cascade,
  resident_id      uuid not null references public.residents (id) on delete cascade,
  scheduled_for    timestamptz not null,
  status           text not null default 'aguardando'
                   check (status in ('aguardando', 'administrado', 'nao_administrado')),
  administered_at  timestamptz,
  administered_by  uuid references public.profiles (id),
  note             text,
  unique (prescription_id, scheduled_for),
  -- "administrado" exige horário e responsável (rastro confiável).
  check (status <> 'administrado' or (administered_at is not null and administered_by is not null))
);
create index on public.medication_administrations (resident_id, scheduled_for);

-- ---------- 3. Rotina, fotos e vídeo ---------------------------------

create table public.daily_records (
  id           uuid primary key default gen_random_uuid(),
  resident_id  uuid not null references public.residents (id) on delete cascade,
  record_date  date not null default current_date,
  mood         text,
  food         text,
  notes        text,
  by_voice     boolean not null default false,  -- ditado confirmado pelo cuidador
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  unique (resident_id, record_date)
);

create table public.activities (
  id             uuid primary key default gen_random_uuid(),
  resident_id    uuid not null references public.residents (id) on delete cascade,
  activity_date  date not null default current_date,
  activity_time  time,
  name           text not null,
  status         text not null default 'Prevista',
  participation  text,
  observation    text,
  created_by     uuid references public.profiles (id)
);

create table public.photos (
  id            uuid primary key default gen_random_uuid(),
  resident_id   uuid not null references public.residents (id) on delete cascade,
  storage_path  text not null,                -- bucket privado "photos"
  caption       text,
  published_by  uuid references public.profiles (id),
  created_at    timestamptz not null default now()
);

create table public.house_info (
  id               boolean primary key default true check (id),  -- linha única
  phone            text,
  visiting_hours   text,
  visiting_rules   text,
  updated_at       timestamptz not null default now()
);

create table public.video_config (
  id            boolean primary key default true check (id),     -- linha única
  weekdays      int[] not null default '{1,3,5}',  -- 0=domingo ... 6=sábado
  start_time    time not null default '15:00',
  end_time      time not null default '17:00',
  slot_minutes  int not null default 20 check (slot_minutes between 5 and 120)
);

create table public.video_requests (
  id            uuid primary key default gen_random_uuid(),
  resident_id   uuid not null references public.residents (id) on delete cascade,
  requested_by  uuid not null references public.profiles (id),
  slot_start    timestamptz not null,
  status        text not null default 'solicitada'
                check (status in ('solicitada', 'confirmada', 'recusada', 'realizada', 'cancelada')),
  handled_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now(),
  unique (resident_id, slot_start)
);

-- Perguntas que a IA não pôde responder e foram para a equipe.
create table public.team_questions (
  id           uuid primary key default gen_random_uuid(),
  resident_id  uuid references public.residents (id) on delete cascade,
  asked_by     uuid not null references public.profiles (id),
  question     text not null,
  answer       text,
  answered_by  uuid references public.profiles (id),
  created_at   timestamptz not null default now()
);

-- ---------- 4. Funções auxiliares (usadas pelas regras de acesso) ------

create or replace function public.current_role_name()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and status = 'ativo'
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() = 'admin', false)
$$;

create or replace function public.is_caregiver()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() = 'cuidador', false)
$$;

create or replace function public.is_family_of(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.family_residents
    where family_id = auth.uid() and resident_id = rid
  ) and public.current_role_name() = 'familiar'
$$;

create or replace function public.consent_active(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select authorized and (valid_until is null or valid_until >= current_date)
    from public.image_consents where resident_id = rid
  ), false)
$$;

-- Cria o perfil quando uma conta nova é criada. O papel NUNCA vem do
-- cliente: toda conta nasce "familiar" e só o administrador muda isso.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_touch  before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger residents_touch before update on public.residents
  for each row execute function public.touch_updated_at();

-- Anonimiza o histórico de alguém excluído (mantém o rastro, some o nome).
create or replace function public.anonymize_change_log(eid uuid)
returns void language sql security definer set search_path = public as $$
  update public.change_log
     set entity_label = 'Cadastro removido', summary = null, anonymized = true
   where entity_id = eid and public.is_admin()
$$;

-- ---------- 5. Visão de privacidade da medicação para o admin --------
-- O administrador vê quantas doses aguardam e de qual medicamento, mas
-- NÃO vê o nome do residente enquanto a dose não foi administrada.

create or replace view public.pending_medications as
  select a.id, p.medicine, p.dose, a.scheduled_for
    from public.medication_administrations a
    join public.prescriptions p on p.id = a.prescription_id
   where a.status = 'aguardando'
     and (public.is_admin() or public.is_caregiver());
-- (view executa com os direitos do dono; o filtro por papel está na própria view)
revoke all on public.pending_medications from anon;
grant select on public.pending_medications to authenticated;

-- ---------- 6. Regras de acesso (Row Level Security) ------------------

alter table public.profiles                    enable row level security;
alter table public.residents                   enable row level security;
alter table public.family_residents            enable row level security;
alter table public.image_consents              enable row level security;
alter table public.invites                     enable row level security;
alter table public.change_log                  enable row level security;
alter table public.prescriptions               enable row level security;
alter table public.medication_administrations  enable row level security;
alter table public.daily_records               enable row level security;
alter table public.activities                  enable row level security;
alter table public.photos                      enable row level security;
alter table public.house_info                  enable row level security;
alter table public.video_config                enable row level security;
alter table public.video_requests              enable row level security;
alter table public.team_questions              enable row level security;

-- profiles: cada pessoa vê o próprio; equipe vê todos; admin gerencia.
create policy profiles_self_read   on public.profiles for select
  using (id = auth.uid() or public.is_admin() or public.is_caregiver());
create policy profiles_admin_all   on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
-- Autoedição limitada: nada de mudar papel, status ou nível de acesso.
revoke update on public.profiles from authenticated;
grant  update (phone, address, full_name) on public.profiles to authenticated;
-- (o admin altera todas as colunas pela função abaixo)
create or replace function public.admin_update_profile(
  pid uuid, p_role text, p_access text, p_status text,
  p_name text, p_phone text, p_cpf text, p_address text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'sem permissão'; end if;
  update public.profiles
     set role = p_role, access_level = p_access, status = p_status,
         full_name = p_name, phone = p_phone, cpf = p_cpf, address = p_address
   where id = pid;
end $$;

-- residents
create policy residents_staff_read  on public.residents for select
  using (public.is_admin() or public.is_caregiver() or public.is_family_of(id));
create policy residents_admin_write on public.residents for all
  using (public.is_admin()) with check (public.is_admin());

-- family_residents
create policy fr_read  on public.family_residents for select
  using (family_id = auth.uid() or public.is_admin() or public.is_caregiver());
create policy fr_admin on public.family_residents for all
  using (public.is_admin()) with check (public.is_admin());

-- image_consents
create policy consent_read  on public.image_consents for select
  using (public.is_admin() or public.is_caregiver() or public.is_family_of(resident_id));
create policy consent_admin on public.image_consents for all
  using (public.is_admin()) with check (public.is_admin());

-- invites e histórico: só admin
create policy invites_admin on public.invites for all
  using (public.is_admin()) with check (public.is_admin());
create policy log_admin_read on public.change_log for select using (public.is_admin());
create policy log_admin_ins  on public.change_log for insert with check (public.is_admin());

-- prescrições: família lê as do seu residente; equipe lê; admin gerencia.
create policy rx_read on public.prescriptions for select
  using (public.is_admin() or public.is_caregiver() or public.is_family_of(resident_id));
create policy rx_admin on public.prescriptions for all
  using (public.is_admin()) with check (public.is_admin());

-- administrações:
--   família: vê as do seu residente;
--   cuidador: vê tudo, registra e atualiza (sempre em seu nome);
--   admin: vê SOMENTE as já administradas (pendentes: use a view pending_medications).
create policy adm_family_read on public.medication_administrations for select
  using (public.is_family_of(resident_id));
create policy adm_caregiver_read on public.medication_administrations for select
  using (public.is_caregiver());
create policy adm_admin_read on public.medication_administrations for select
  using (public.is_admin() and status = 'administrado');
create policy adm_caregiver_ins on public.medication_administrations for insert
  with check (public.is_caregiver());
create policy adm_caregiver_upd on public.medication_administrations for update
  using (public.is_caregiver())
  with check (public.is_caregiver()
              and (status <> 'administrado' or administered_by = auth.uid()));

-- registros do dia e atividades
create policy dr_read  on public.daily_records for select
  using (public.is_admin() or public.is_caregiver() or public.is_family_of(resident_id));
create policy dr_write on public.daily_records for all
  using (public.is_caregiver()) with check (public.is_caregiver());
create policy act_read  on public.activities for select
  using (public.is_admin() or public.is_caregiver() or public.is_family_of(resident_id));
create policy act_write on public.activities for all
  using (public.is_caregiver()) with check (public.is_caregiver());

-- fotos: só publica se houver autorização de imagem vigente.
create policy photos_read on public.photos for select
  using (public.is_caregiver() or public.is_family_of(resident_id));
create policy photos_ins on public.photos for insert
  with check (public.is_caregiver() and public.consent_active(resident_id));
create policy photos_del on public.photos for delete
  using (public.is_caregiver());

-- informações da casa e agenda de vídeo
create policy house_read  on public.house_info  for select using (auth.uid() is not null);
create policy house_admin on public.house_info  for all
  using (public.is_admin()) with check (public.is_admin());
create policy vcfg_read   on public.video_config for select using (auth.uid() is not null);
create policy vcfg_admin  on public.video_config for all
  using (public.is_admin()) with check (public.is_admin());

create policy vreq_read on public.video_requests for select
  using (public.is_admin() or public.is_caregiver() or requested_by = auth.uid());
create policy vreq_family_ins on public.video_requests for insert
  with check (requested_by = auth.uid() and public.is_family_of(resident_id));
create policy vreq_caregiver_upd on public.video_requests for update
  using (public.is_caregiver()) with check (public.is_caregiver());

-- perguntas à equipe
create policy tq_read on public.team_questions for select
  using (asked_by = auth.uid() or public.is_caregiver());
create policy tq_family_ins on public.team_questions for insert
  with check (asked_by = auth.uid());
create policy tq_caregiver_upd on public.team_questions for update
  using (public.is_caregiver()) with check (public.is_caregiver());

-- ---------- 7. Armazenamento privado das fotos -----------------------
-- Caminho do arquivo: <resident_id>/<nome>.jpg

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

create policy photos_obj_read on storage.objects for select
  using (bucket_id = 'photos' and (
    public.is_caregiver()
    or public.is_family_of(((storage.foldername(name))[1])::uuid)));
create policy photos_obj_ins on storage.objects for insert
  with check (bucket_id = 'photos' and public.is_caregiver()
    and public.consent_active(((storage.foldername(name))[1])::uuid));
create policy photos_obj_del on storage.objects for delete
  using (bucket_id = 'photos' and public.is_caregiver());

-- ---------- 8. Dados iniciais ----------------------------------------
insert into public.house_info (phone, visiting_hours, visiting_rules)
values ('(00) 0000-0000', 'todos os dias, das 14h às 17h',
        'Avise a equipe ao chegar.')
on conflict do nothing;
insert into public.video_config default values on conflict do nothing;
