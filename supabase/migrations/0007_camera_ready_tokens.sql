-- Participant origin (pour choisir le bon lien camera-ready) + les 4 tokens
-- camera-ready configurables, stockés dans la table config (ligne unique id=1).
-- À coller dans Supabase → SQL Editor → New query → Run.

alter table papers add column if not exists participant_origin text
  check (participant_origin in ('Moroccan', 'International'));

alter table config add column if not exists camera_ready_token_oral_moroccan text;
alter table config add column if not exists camera_ready_token_oral_international text;
alter table config add column if not exists camera_ready_token_poster_moroccan text;
alter table config add column if not exists camera_ready_token_poster_international text;

-- Renseigne ensuite les 4 tokens (chaînes aléatoires de ton choix, utilisées dans
-- camera-ready.html?token=...) :
-- update config set
--   camera_ready_token_oral_moroccan = 'TOKEN1',
--   camera_ready_token_oral_international = 'TOKEN2',
--   camera_ready_token_poster_moroccan = 'TOKEN3',
--   camera_ready_token_poster_international = 'TOKEN4'
-- where id = 1;
