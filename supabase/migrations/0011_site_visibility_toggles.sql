-- Panneau "Contrôle du site" dans assignments.html : 5 interrupteurs qui
-- pilotent l'affichage d'éléments actuellement masqués sur les pages
-- publiques, sans jamais avoir à toucher au HTML. Toutes par défaut à false
-- pour ne rien changer au comportement actuel du site au moment du déploiement.
alter table config add column if not exists show_extended_deadline_banner boolean not null default false;
alter table config add column if not exists show_conference_rooms boolean not null default false;
alter table config add column if not exists show_programme boolean not null default false;
alter table config add column if not exists show_register_button boolean not null default false;
alter table config add column if not exists show_copyright_form_link boolean not null default false;
