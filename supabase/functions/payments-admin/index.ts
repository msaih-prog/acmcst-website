// Fonction ADMIN (JWT requis, comme send-email) : utilisée par payments.html.
// Sert de passerelle sécurisée vers le projet Supabase SÉPARÉ
// (djsgjbztdqowdhrelvkt) qui stocke les soumissions camera-ready : ce projet
// n'a pas de notion d'admin ACMCST, donc toute lecture de PII (registrations),
// génération d'URL signée, ou bascule "paiement vérifié" passe forcément par
// ici, où l'appelant est d'abord vérifié comme admin ACMCST authentifié.
import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const CONFERENCE_CODE = "ACMCST";
const SITE_URL = "https://www.acmcst.com";
const CHAIR_EMAIL = "acmcst@usms.ma";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Projet séparé dédié au stockage camera-ready — secrets à définir dans les
// Function Secrets de CE projet (jamais dans un fichier client) :
//   CAMERA_READY_SUPABASE_URL = https://djsgjbztdqowdhrelvkt.supabase.co
//   CAMERA_READY_SERVICE_ROLE_KEY = (clé secrète du projet séparé)
const crAdmin = createClient(
  Deno.env.get("CAMERA_READY_SUPABASE_URL")!,
  Deno.env.get("CAMERA_READY_SERVICE_ROLE_KEY")!,
);

const GMAIL_USER = Deno.env.get("GMAIL_USER")!;
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD")!;

function smtpClient() {
  return new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username: GMAIL_USER, password: GMAIL_APP_PASSWORD },
    },
  });
}

async function dashboard() {
  const { data: acceptedPapers, error: pError } = await supabaseAdmin
    .from("papers")
    .select("id, paper_id, titre, nom_auteur, prenom_auteur, email_auteur, decision, participant_origin, date_envoi_decision, camera_ready_reminders_sent")
    .in("decision", ["Accepted", "Accepted_Poster"])
    .eq("statut", "Envoyé")
    .order("date_envoi_decision");
  if (pError) throw pError;

  const { data: registrations, error: rError } = await crAdmin
    .from("registrations")
    .select("*")
    .eq("conference", CONFERENCE_CODE)
    .order("created_at", { ascending: false });
  if (rError) throw rError;

  return { succes: true, acceptedPapers: acceptedPapers || [], registrations: registrations || [] };
}

async function signedUrl(path: string) {
  if (!path || !path.startsWith(`${CONFERENCE_CODE}/`)) {
    return { succes: false, message: "Chemin invalide." };
  }
  const { data, error } = await crAdmin.storage.from("camera-ready").createSignedUrl(path, 300);
  if (error || !data) return { succes: false, message: error?.message || "URL introuvable." };
  return { succes: true, url: data.signedUrl };
}

async function verifyPayment(registrationId: string, verified: boolean) {
  const { error } = await crAdmin
    .from("registrations")
    .update({ payment_verified: verified })
    .eq("id", registrationId)
    .eq("conference", CONFERENCE_CODE);
  if (error) return { succes: false, message: error.message };
  return { succes: true };
}

// Efface, pour CETTE conférence uniquement, toutes les lignes "registrations"
// et tous les fichiers Storage (Oral + Poster). Action irréversible : le
// double-confirm et la sauvegarde JSON se font côté payments.html avant l'appel.
const FILE_FOLDERS = [
  ["Oral", "Payment_Proof"], ["Oral", "Copyright_Form"], ["Oral", "Camera_Ready"], ["Oral", "Source_Files"],
  ["Poster", "Payment_Proof"],
];

async function deleteAll() {
  const allPaths: string[] = [];
  for (const [type, category] of FILE_FOLDERS) {
    const folder = `${CONFERENCE_CODE}/${type}/${category}`;
    const { data: files, error: listError } = await crAdmin.storage.from("camera-ready").list(folder, { limit: 1000 });
    if (listError) return { succes: false, message: `Erreur de listage (${folder}) : ${listError.message}` };
    for (const f of files || []) allPaths.push(`${folder}/${f.name}`);
  }

  if (allPaths.length > 0) {
    const { error: removeError } = await crAdmin.storage.from("camera-ready").remove(allPaths);
    if (removeError) return { succes: false, message: `Erreur de suppression des fichiers : ${removeError.message}` };
  }

  const { error: delError } = await crAdmin.from("registrations").delete().eq("conference", CONFERENCE_CODE);
  if (delError) return { succes: false, message: `Erreur de suppression des registrations : ${delError.message}` };

  return { succes: true, message: `${allPaths.length} fichier(s) et toutes les registrations ${CONFERENCE_CODE} supprimés.` };
}

async function remind(paperId: string) {
  const { data: p, error } = await supabaseAdmin
    .from("papers")
    .select("paper_id, titre, email_auteur, nom_auteur, prenom_auteur, decision, participant_origin, statut, camera_ready_reminders_sent")
    .eq("id", paperId)
    .single();
  if (error || !p) return { succes: false, message: "Papier introuvable." };
  if (p.decision !== "Accepted" && p.decision !== "Accepted_Poster") {
    return { succes: false, message: "Ce papier n'est pas accepté." };
  }
  if (!p.participant_origin) {
    return { succes: false, message: "Participant Origin manquant pour ce papier." };
  }

  const { data: existing } = await crAdmin
    .from("registrations")
    .select("id")
    .eq("conference", CONFERENCE_CODE)
    .eq("paper_id", p.paper_id)
    .maybeSingle();
  if (existing) return { succes: false, message: "Ce papier a déjà soumis son camera-ready." };

  const { data: cfg } = await supabaseAdmin
    .from("config")
    .select("camera_ready_token_oral_moroccan, camera_ready_token_oral_international, camera_ready_token_poster_moroccan, camera_ready_token_poster_international")
    .eq("id", 1)
    .single();
  if (!cfg) return { succes: false, message: "Configuration introuvable." };

  const isOral = p.decision === "Accepted";
  const isMoroccan = p.participant_origin === "Moroccan";
  const token = isOral
    ? (isMoroccan ? cfg.camera_ready_token_oral_moroccan : cfg.camera_ready_token_oral_international)
    : (isMoroccan ? cfg.camera_ready_token_poster_moroccan : cfg.camera_ready_token_poster_international);
  if (!token) return { succes: false, message: "Token camera-ready manquant dans la config." };

  const cameraReadyLink = `${SITE_URL}/camera-ready.html?token=${token}`;
  const smtp = smtpClient();
  await smtp.send({
    from: `ACMCST 2027 Organizing Committee <${GMAIL_USER}>`,
    to: p.email_auteur,
    subject: `[ACMCST 2027] Reminder - Camera-Ready Submission Required - Paper ID ${p.paper_id}`,
    content: "auto",
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#1c2b3a;max-width:700px;">
      <p>Dear Corresponding Author,</p>
      <p>This is a <strong>friendly reminder</strong> that we have not yet received your camera-ready submission for paper <strong>ID ${p.paper_id}: "${p.titre}"</strong>, accepted at ACMCST 2027.</p>
      <p>Please complete your camera-ready submission as soon as possible using the link below:</p>
      <p style="margin:20px 0;"><a href="${cameraReadyLink}" style="display:inline-block;background:#2e9fd4;color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold;">Submit Camera-Ready</a></p>
      <p style="font-size:12px;color:#5a6b80;">If the button doesn't work, copy this link into your browser: ${cameraReadyLink}</p>
      <p>We sincerely thank you for your collaboration.</p>
      <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;">
      <p>With our highest regards,<br>The Organizing Committee<br>ACMCST 2027<br>
      <a href="${SITE_URL}" style="color:#2e9fd4;">www.acmcst.com</a> | <a href="mailto:${CHAIR_EMAIL}" style="color:#2e9fd4;">${CHAIR_EMAIL}</a></p>
    </div>`,
  });
  await smtp.close();

  const newCount = (p.camera_ready_reminders_sent || 0) + 1;
  await supabaseAdmin.from("papers").update({ camera_ready_reminders_sent: newCount }).eq("id", paperId);

  return { succes: true, message: `Rappel envoyé à ${p.email_auteur}`, remindersSent: newCount };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ succes: false, message: "Méthode non autorisée." }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ succes: false, message: "Non authentifié." }, 401);

    const { data: admin } = await supabaseAdmin.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!admin) return json({ succes: false, message: "Accès refusé." }, 403);

    const body = await req.json();
    let result;
    switch (body.action) {
      case "dashboard":
        result = await dashboard();
        break;
      case "signed_url":
        result = await signedUrl(body.path);
        break;
      case "verify_payment":
        result = await verifyPayment(body.registrationId, !!body.verified);
        break;
      case "remind":
        result = await remind(body.paperId);
        break;
      case "delete_all":
        result = await deleteAll();
        break;
      default:
        result = { succes: false, message: "Action inconnue." };
    }
    return json(result);
  } catch (e) {
    return json({ succes: false, message: e instanceof Error ? e.message : String(e) }, 500);
  }
});
