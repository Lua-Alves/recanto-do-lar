-- =====================================================================
-- Atualização: mensagens família/equipe/administração e respostas da casa.
-- Pode rodar mais de uma vez sem erro. Rode no SQL Editor do Supabase.
-- (Quem criar o banco do zero com schema.sql já recebe este bloco.)
-- =====================================================================

-- Tempo (em minutos) para uma mensagem sem resposta virar alerta da administração.
alter table public.house_info
  add column if not exists alert_minutes int not null default 15
  check (alert_minutes in (10, 15, 30));

-- Conversa de cada residente entre família, equipe e administração.
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  resident_id  uuid not null references public.residents (id) on delete cascade,
  sender_id    uuid not null references public.profiles (id),
  sender_role  text not null check (sender_role in ('familiar', 'cuidador', 'admin')),
  body         text not null check (char_length(body) between 1 and 2000),
  created_at   timestamptz not null default now()
);
create index if not exists messages_resident_idx on public.messages (resident_id, created_at);

-- Respostas que a administração cadastra para perguntas que a assistente não soube responder.
create table if not exists public.house_answers (
  id           uuid primary key default gen_random_uuid(),
  question     text not null,
  answer       text not null,
  answered_by  uuid references public.profiles (id),
  created_at   timestamptz not null default now()
);

-- A última mensagem é da família e já passou do tempo configurado?
create or replace function public.thread_overdue(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select m.sender_role = 'familiar'
       and m.created_at < now() - make_interval(mins => (select alert_minutes from public.house_info limit 1))
      from public.messages m
     where m.resident_id = rid
     order by m.created_at desc
     limit 1
  ), false)
$$;

alter table public.messages      enable row level security;
alter table public.house_answers enable row level security;

drop policy if exists msg_family_read   on public.messages;
drop policy if exists msg_family_ins    on public.messages;
drop policy if exists msg_staff_read    on public.messages;
drop policy if exists msg_staff_ins     on public.messages;
drop policy if exists msg_admin_read    on public.messages;
drop policy if exists msg_admin_ins     on public.messages;
drop policy if exists answers_read      on public.house_answers;
drop policy if exists answers_admin     on public.house_answers;

-- Família: lê e escreve só na conversa do seu residente.
create policy msg_family_read on public.messages for select
  using (public.is_family_of(resident_id));
create policy msg_family_ins on public.messages for insert
  with check (public.is_family_of(resident_id) and sender_id = auth.uid() and sender_role = 'familiar');

-- Equipe: lê tudo e responde em seu nome.
create policy msg_staff_read on public.messages for select
  using (public.is_caregiver());
create policy msg_staff_ins on public.messages for insert
  with check (public.is_caregiver() and sender_id = auth.uid() and sender_role = 'cuidador');

-- Administração: só acessa a conversa quando a família ficou sem resposta
-- acima do tempo configurado (e sempre vê o que ela mesma enviou).
create policy msg_admin_read on public.messages for select
  using (public.is_admin() and (sender_id = auth.uid() or public.thread_overdue(resident_id)));
create policy msg_admin_ins on public.messages for insert
  with check (public.is_admin() and sender_id = auth.uid() and sender_role = 'admin'
              and public.thread_overdue(resident_id));

-- Respostas da casa: todos os acessos leem (a assistente usa); só admin escreve.
create policy answers_read  on public.house_answers for select using (auth.uid() is not null);
create policy answers_admin on public.house_answers for all
  using (public.is_admin()) with check (public.is_admin());
