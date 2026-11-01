-- ============================================================
-- Projet Supabase SÉPARÉ dédié au stockage camera-ready
-- (compte Gmail différent, quota de stockage additionnel).
-- Ce script est à coller dans LE NOUVEAU projet (djsgjbztdqowdhrelvkt),
-- PAS dans le projet ACMCST ni AINETEC.
-- Identique dans les deux repos (acmcst-website et AINTEC-website) pour référence.
-- ============================================================

create extension if not exists pgcrypto;

-- Une ligne par soumission camera-ready, tous conférences confondues.
create table registrations (
  id uuid primary key default gen_random_uuid(),
  conference text not null check (conference in ('ACMCST', 'AINETEC')),
  first_name text not null,
  last_name text not null,
  paper_id text not null,
  email text not null,
  phone text not null,
  university text not null,
  laboratory text not null,
  category text not null check (category in (
    'PhD Student (Moroccan)', 'PhD Student (International)',
    'Professor / Researcher', 'Industrial', 'Non Author Listener (Attendee)'
  )),
  presentation_mode text not null check (presentation_mode in ('In Person', 'Online')),
  type_presentation text not null check (type_presentation in ('Oral', 'Poster')),
  country_group text not null check (country_group in ('Moroccan', 'International')),
  created_at timestamptz not null default now()
);

-- Compteur séquentiel indépendant par (conférence, type, catégorie de fichier) —
-- donne le nom de fichier {n}.ext dans le bucket Storage.
create table storage_counters (
  conference text not null,
  type_presentation text not null,
  file_category text not null,
  next_seq int not null default 1,
  primary key (conference, type_presentation, file_category)
);

-- Incrémentation atomique (upsert + RETURNING) pour éviter toute collision de
-- numéro si deux soumissions arrivent en même temps.
create or replace function get_next_seq(p_conference text, p_type text, p_category text)
returns int
language plpgsql
security definer
as $$
declare
  v_seq int;
begin
  insert into storage_counters (conference, type_presentation, file_category, next_seq)
  values (p_conference, p_type, p_category, 2)
  on conflict (conference, type_presentation, file_category)
  do update set next_seq = storage_counters.next_seq + 1
  returning next_seq - 1 into v_seq;
  return v_seq;
end;
$$;
grant execute on function get_next_seq(text, text, text) to anon;

-- Utilisé par le badge "📎 Camera-Ready reçu" dans review.html (ACMCST/AINETEC) :
-- renvoie juste un booléen, jamais les données personnelles, donc appelable
-- publiquement sans exposer les emails/téléphones des autres inscrits.
create or replace function registration_exists(p_conference text, p_paper_id text)
returns boolean
language sql
security definer
as $$
  select exists(
    select 1 from registrations
    where conference = p_conference and paper_id = p_paper_id
  );
$$;
grant execute on function registration_exists(text, text) to anon;

-- Version "en masse" pour review.html : un seul appel renvoie tous les paper_id
-- ayant une soumission camera-ready pour une conférence, au lieu d'un appel par
-- papier. Ne renvoie que des paper_id (jamais nom/email/téléphone), donc sans
-- risque même si la clé anon est visible publiquement.
create or replace function registered_paper_ids(p_conference text)
returns setof text
language sql
security definer
as $$
  select paper_id from registrations where conference = p_conference;
$$;
grant execute on function registered_paper_ids(text) to anon;

-- RLS : le formulaire public (clé anon) peut uniquement AJOUTER une inscription,
-- jamais lire/modifier/supprimer les inscriptions des autres.
alter table registrations enable row level security;
create policy "public can insert registrations" on registrations for insert
  with check (true);

alter table storage_counters enable row level security;
-- Pas de policy directe sur storage_counters : uniquement accessible via la
-- fonction get_next_seq() (security definer), donc aucun accès direct nécessaire.

-- Storage : un seul bucket, chemins ACMCST/Oral/Payment_Proof/{n}.ext etc.
insert into storage.buckets (id, name, public) values ('camera-ready', 'camera-ready', false);

create policy "public can upload camera-ready files" on storage.objects for insert
  with check (bucket_id = 'camera-ready');
