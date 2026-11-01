-- Bucket de sauvegarde pour assignments.html (papers + assignments).
-- Une seule sauvegarde à la fois : le fichier "backup.json" est toujours écrasé (upsert)
-- par la page, jamais accumulé — pas de nettoyage périodique nécessaire.
-- À coller dans Supabase → SQL Editor → New query → Run.

insert into storage.buckets (id, name, public) values
  ('backups', 'backups', false);

create policy "admins access backups bucket" on storage.objects for all
  using (bucket_id = 'backups' and exists (select 1 from admins where user_id = auth.uid()))
  with check (bucket_id = 'backups' and exists (select 1 from admins where user_id = auth.uid()));
