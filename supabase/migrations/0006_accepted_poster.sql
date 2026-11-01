-- Ajoute la décision "Accepted (Poster)" : papier accepté pour une présentation poster,
-- non publié dans les actes Springer LNCS.
-- À coller dans Supabase → SQL Editor → New query → Run.

alter table papers drop constraint if exists papers_decision_check;
alter table papers add constraint papers_decision_check
  check (decision in ('Accepted','Rejected','Hors_Sujet','Accepted_Poster'));
