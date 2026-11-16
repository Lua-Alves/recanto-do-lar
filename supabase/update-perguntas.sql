-- =====================================================================
-- Atualização: perguntas que a assistente não soube responder.
-- Rode UMA vez no SQL Editor. Pode repetir sem erro.
-- =====================================================================
create table if not exists public.house_questions (
  id          uuid primary key default gen_random_uuid(),
  question    text not null check (char_length(question) between 1 and 500),
  asked_by    uuid not null references public.profiles (id),
  created_at  timestamptz not null default now(),
  unique (question)
);
alter table public.house_questions enable row level security;

drop policy if exists hq_ins   on public.house_questions;
drop policy if exists hq_admin on public.house_questions;
-- Qualquer pessoa logada registra a pergunta (sem poder lê-la depois);
-- só a administração lê e apaga.
create policy hq_ins on public.house_questions for insert
  with check (asked_by = auth.uid());
create policy hq_admin on public.house_questions for all
  using (public.is_admin()) with check (public.is_admin());
