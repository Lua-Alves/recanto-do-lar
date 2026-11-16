-- =====================================================================
-- Atualização: fotos (uma linha por residente marcado, agrupadas por publicação).
-- Rode UMA vez no SQL Editor. Pode repetir sem erro.
-- =====================================================================
alter table public.photos
  add column if not exists group_id uuid,
  add column if not exists author_name text;

-- Nome de quem publicou, gravado pelo banco (a família lê sem acessar perfis).
create or replace function public.stamp_photo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.published_by := coalesce(auth.uid(), new.published_by);
  new.author_name := (select full_name from public.profiles where id = new.published_by);
  new.group_id := coalesce(new.group_id, gen_random_uuid());
  return new;
end $$;
drop trigger if exists stamp_photo_trg on public.photos;
create trigger stamp_photo_trg
  before insert on public.photos
  for each row execute function public.stamp_photo();

-- A equipe também apaga o arquivo ao remover a foto (política já existente: photos_obj_del).
