-- Ajoute la possibilité de renseigner le nom/prénom de l'auteur correspondant
-- d'un papier accepté (nécessaire pour nommer/adresser son attestation), et de
-- suivre si son attestation a déjà été envoyée.
alter table papers add column if not exists nom_auteur text;
alter table papers add column if not exists prenom_auteur text;
alter table papers add column if not exists attestation_envoyee boolean not null default false;
