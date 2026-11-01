-- ============================================================
-- Migration v2 pour le projet Supabase SÉPARÉ (djsgjbztdqowdhrelvkt),
-- nécessaire pour la page payments.html (ACMCST + AINETEC).
-- À coller dans LE NOUVEAU projet, APRÈS camera_ready_shared_project.sql.
-- Identique dans les deux repos (acmcst-website et AINTEC-website).
-- ============================================================

-- Chemin de stockage de chaque fichier uploadé (utilisés par payments.html
-- pour générer les liens de téléchargement) + statut de vérification du paiement.
alter table registrations
  add column if not exists payment_proof_path text,
  add column if not exists copyright_form_path text,
  add column if not exists camera_ready_path text,
  add column if not exists source_files_path text,
  add column if not exists payment_verified boolean not null default false;

-- Pas de nouvelle policy RLS nécessaire : payments.html ne lit/n'écrit jamais
-- ces colonnes via la clé anon. Tous les accès (liste complète, URLs signées,
-- bascule payment_verified) passent par la fonction payments-admin de chaque
-- site, authentifiée avec la clé service_role de CE projet séparé (stockée
-- uniquement comme secret d'Edge Function côté ACMCST/AINETEC, jamais exposée
-- côté client).
