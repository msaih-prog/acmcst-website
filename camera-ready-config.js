// Projet Supabase SÉPARÉ, dédié uniquement au stockage des soumissions
// camera-ready (compte différent, quota de stockage additionnel).
// Nommé "crSb" pour ne pas entrer en conflit avec "sb" (client du projet ACMCST
// principal, défini dans supabase-config.js, utilisé pour l'email de confirmation).
const CAMERA_READY_SUPABASE_URL = "https://djsgjbztdqowdhrelvkt.supabase.co";
const CAMERA_READY_SUPABASE_ANON_KEY = "sb_publishable_a80YsdXadZxOQrqVEePMhw_0-zQkeVj";
const crSb = window.supabase.createClient(CAMERA_READY_SUPABASE_URL, CAMERA_READY_SUPABASE_ANON_KEY);
