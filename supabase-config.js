// ACMCST 2027 — client Supabase partagé par toutes les pages admin/reviewer.
// La clé ci-dessous est la clé publique ("anon"/"publishable") : elle est faite pour être visible
// côté navigateur, la sécurité réelle est assurée par les policies RLS côté base de données.
const SUPABASE_URL = "https://wuaznbsequyrnjebnndc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_KLEvCuCWhOTAHqW7E3SVYQ_0SZaKnSn";
// Nommée "sb" (et pas "supabase") : ce nom entrerait en conflit avec la variable globale
// "supabase" déjà créée par le script CDN lui-même et empêcherait silencieusement l'init.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
