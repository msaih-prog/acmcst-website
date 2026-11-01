-- Ajoute la décision "Hors Sujet" (papier hors thématique, refusé sans passer par les
-- reviewers) + une remarque optionnelle du chair jointe à l'email de décision.
-- À coller dans Supabase → SQL Editor → New query → Run.

alter table papers add column if not exists decision_remark text;

alter table papers drop constraint if exists papers_decision_check;
alter table papers add constraint papers_decision_check
  check (decision in ('Accepted','Rejected','Hors_Sujet'));
