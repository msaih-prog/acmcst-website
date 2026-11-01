-- camera-ready.html est une page publique (aucune session admin) : elle doit
-- pouvoir lire la table config (tokens camera-ready + coordonnées bancaires)
-- pour savoir quel formulaire afficher. Rien de secret n'y est stocké — les
-- 4 tokens sont conçus pour être partagés (un par catégorie, pas par personne)
-- et les coordonnées bancaires sont destinées à être affichées publiquement.
-- Les écritures (insert/update/delete) restent réservées aux admins via la
-- policy existante "admins full access config".
-- À coller dans Supabase → SQL Editor → New query → Run.

create policy "public can read config" on config for select
  using (true);
