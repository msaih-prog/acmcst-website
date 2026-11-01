-- Élargit les catégories de participants et ajoute une colonne University.
-- À coller dans Supabase → SQL Editor → New query → Run.

alter table participants add column if not exists university text;

-- Migre les anciennes valeurs vers les nouvelles avant de resserrer la contrainte,
-- sinon l'ALTER TABLE plus bas échoue sur les lignes existantes qui ne correspondent plus.
update participants set categorie = 'Chair' where categorie = 'Chairs';
update participants set categorie = 'Participant_Oral_Presentation' where categorie = 'Participants';

alter table participants drop constraint if exists participants_categorie_check;
alter table participants add constraint participants_categorie_check
  check (categorie in ('Chair','Co-Chair','Comite_Scientifique','Comite_Organisation','Participant_Oral_Presentation','Participant_Poster'));
