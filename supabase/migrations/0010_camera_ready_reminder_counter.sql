-- Compteur de relances "camera-ready" par papier : affiché dans payments.html
-- à côté du bouton "Relancer", incrémenté par payments-admin à chaque envoi.
alter table papers add column if not exists camera_ready_reminders_sent int not null default 0;
