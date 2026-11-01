-- Coordonnées bancaires affichées sur camera-ready.html selon l'origine du
-- participant (Moroccan → RIB marocain, International → coordonnées LLC US).
-- Stocké en HTML simple (paragraphes <p>), affiché tel quel dans la page.
-- À coller dans Supabase → SQL Editor → New query → Run, puis remplis les
-- deux colonnes avec tes vraies coordonnées.

alter table config add column if not exists bank_details_moroccan text;
alter table config add column if not exists bank_details_international text;

-- Exemple (à adapter avec les vraies coordonnées) :
-- update config set
--   bank_details_moroccan = '<p><strong>Titulaire:</strong> THE MOROCCAN ASSOCIATION MASTSD</p><p><strong>Banque:</strong> ATTIJARIWAFA BANK — Béni Mellal</p><p><strong>RIB:</strong> 007 090 0006267000305459 50</p><p><strong>IBAN:</strong> MA64 007 090 0006267000305459 50</p><p><strong>SWIFT/BIC:</strong> BCMAMAMC</p>',
--   bank_details_international = '<p><strong>Account Holder:</strong> ...</p><p><strong>Bank Name:</strong> ...</p><p><strong>Account Number:</strong> ...</p><p><strong>Routing Number (ABA):</strong> ...</p><p><strong>SWIFT/BIC:</strong> ...</p>'
-- where id = 1;
