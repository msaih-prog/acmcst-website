// Fonction PUBLIQUE (vérification JWT désactivée dans le dashboard Supabase,
// comme reviewer-dashboard/reviewer-get/reviewer-submit) : appelée depuis
// camera-ready.html, une page sans session admin, juste après l'enregistrement
// réussi d'une soumission camera-ready (stockée dans le projet Supabase SÉPARÉ).
// Envoie l'email de confirmation depuis l'adresse acmcst@usms.ma habituelle,
// en réutilisant les mêmes identifiants Gmail que send-email.
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

// Inlined from _shared/cors.ts: the dashboard's "paste content → Deploy" flow
// only bundles this one file, so a relative import to _shared/cors.ts 404s.
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

const GMAIL_USER = Deno.env.get("GMAIL_USER")!; // acmcst@usms.ma
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ succes: false, message: "Méthode non autorisée." }, 405);

  try {
    const { firstName, lastName, email, paperId } = await req.json();
    if (!email || !paperId) {
      return json({ succes: false, message: "Paramètres manquants." }, 400);
    }

    const smtp = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: GMAIL_USER, password: GMAIL_APP_PASSWORD },
      },
    });

    await smtp.send({
      from: `ACMCST 2027 Organizing Committee <${GMAIL_USER}>`,
      to: email,
      subject: `[ACMCST 2027] Camera-Ready Submission Received - Paper ID ${paperId}`,
      content: "auto",
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#1c2b3a;max-width:700px;">
        <p>Dear ${firstName || ""} ${lastName || ""},</p>
        <p>We confirm that we have successfully received your camera-ready submission for paper <strong>ID ${paperId}</strong>, submitted to ACMCST 2027.</p>
        <p>Our team will review your submission and get back to you if any additional information or corrections are needed.</p>
        <p>With our highest regards,<br>The Organizing Committee<br>ACMCST 2027<br>
        <a href="https://www.acmcst.com" style="color:#2e9fd4;">www.acmcst.com</a> | <a href="mailto:acmcst@usms.ma" style="color:#2e9fd4;">acmcst@usms.ma</a></p>
      </div>`,
    });
    await smtp.close();

    return json({ succes: true, message: "Confirmation envoyée." });
  } catch (e) {
    return json({ succes: false, message: e instanceof Error ? e.message : String(e) }, 500);
  }
});
