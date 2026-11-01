import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { corsHeaders, json } from "../_shared/cors.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const GMAIL_USER = Deno.env.get("GMAIL_USER")!; // acmcst@usms.ma
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD")!;

// Mêmes constantes que Code.gs, à tenir synchronisées si les dates/liens changent.
const CONFERENCE = "The 2nd International Conference on Advanced Communications with Modern Circuits and Systems Technologies (ACMCST 2027)";
const DATES = "held from November 10 to 12, 2027, in Béni Mellal, Morocco";
const REGISTRATION_LINK = "https://www.acmcst.com/registration";
const SPRINGER_LINK = "https://www.springer.com/gp/computer-science/lncs/conference-proceedings-guidelines";
const CHAIR_EMAIL = "acmcst@usms.ma";
const CHAIR_NAME = "Dr. SAIH Mohamed";
const SITE_URL = "https://www.acmcst.com";

function client() {
  return new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username: GMAIL_USER, password: GMAIL_APP_PASSWORD },
    },
  });
}

async function downloadAsAttachment(bucket: string, path: string, filename: string, contentType: string) {
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
  if (error || !data) return null;
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.length === 0) return null;
  // Encoder en base64 explicitement : passer un Uint8Array brut à denomailer sans préciser
  // l'encodage le fait parfois traiter comme du texte, ce qui corrompt les PDF (pièce jointe vide/illisible).
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);
  return { filename, content: base64, contentType, encoding: "base64" as const };
}

// ===== Attestations =====
const ATTESTATION_CONTENT: Record<string, { sujet: string; body: string; isProfessor: boolean }> = {
  Chair: {
    sujet: "Attestation as General Chair - ACMCST 2027",
    body: `We are pleased to present you with your official attestation as General Chair of ${CONFERENCE}, ${DATES}. Your leadership and dedication have been instrumental to the success of this event, and we are deeply grateful for your outstanding contribution.`,
    isProfessor: true,
  },
  "Co-Chair": {
    sujet: "Attestation as Co-Chair - ACMCST 2027",
    body: `We are pleased to present you with your official attestation as Co-Chair of ${CONFERENCE}, ${DATES}. Your leadership and dedication have been instrumental to the success of this event, and we are deeply grateful for your outstanding contribution.`,
    isProfessor: true,
  },
  Comite_Scientifique: {
    sujet: "Attestation as Member of the Scientific Committee - ACMCST 2027",
    body: `We are pleased to present you with your official attestation as Member of the Scientific Committee of ${CONFERENCE}, ${DATES}. Your expert reviews and scientific contributions have been invaluable to the quality of this conference. We sincerely appreciate your time and expertise.`,
    isProfessor: true,
  },
  Comite_Organisation: {
    sujet: "Attestation as Member of the Organizing Committee - ACMCST 2027",
    body: `We are pleased to present you with your official attestation as Member of the Organizing Committee of ${CONFERENCE}, ${DATES}. Your valuable efforts and commitment have greatly contributed to the organization and success of this conference. We sincerely thank you for your dedication.`,
    isProfessor: true,
  },
  Participant_Oral_Presentation: {
    sujet: "Attestation of Participation and Oral Presentation - ACMCST 2027",
    body: `We are pleased to present you with your official attestation of participation and oral presentation at ${CONFERENCE}, ${DATES}. We thank you for your valuable scientific contribution and we look forward to welcoming you at future editions.`,
    isProfessor: false,
  },
  Participant_Poster: {
    sujet: "Attestation of Participation and Poster Presentation - ACMCST 2027",
    body: `We are pleased to present you with your official attestation of participation and poster presentation at ${CONFERENCE}, ${DATES}. We thank you for your valuable scientific contribution and we look forward to welcoming you at future editions.`,
    isProfessor: false,
  },
};

function getAttestationEmailContent(categorie: string, prenom: string, nom: string) {
  const fullName = `${prenom} ${nom}`;
  const entry = ATTESTATION_CONTENT[categorie] ?? ATTESTATION_CONTENT.Participant_Oral_Presentation;
  const salutation = entry.isProfessor ? `Dear Prof. ${fullName},` : `Dear ${fullName},`;
  const signature = `<p style="margin:0;">With our highest regards,</p><p style="margin:0;">The Organizing Committee</p><p style="margin:0;">ACMCST 2027</p><p style="margin:0;"><a href="https://www.acmcst.com" style="color:#2e9fd4;">www.acmcst.com</a> | <a href="mailto:acmcst@usms.ma" style="color:#2e9fd4;">acmcst@usms.ma</a></p>`;
  const htmlTemplate = (body: string) =>
    `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#1c2b3a;max-width:650px;"><p style="margin:0 0 16px;">${salutation}</p><p style="margin:0 0 16px;">${body}</p><p style="margin:16px 0;">Please find your attestation attached to this email.</p><p style="margin:24px 0 0;">${signature}</p></div>`;

  return { sujet: entry.sujet, html: htmlTemplate(entry.body) };
}

async function envoyerAttestation(participantId: string) {
  const { data: p, error } = await supabaseAdmin
    .from("participants")
    .select("nom, prenom, email, categorie")
    .eq("id", participantId)
    .single();
  if (error || !p) return { succes: false, message: "Participant introuvable." };
  if (!p.email) return { succes: false, message: "Email manquant pour ce participant." };

  const path = `${p.categorie}/${p.nom}_${p.prenom}.pdf`;
  const attachment = await downloadAsAttachment("attestations", path, `${p.nom}_${p.prenom}.pdf`, "application/pdf");
  if (!attachment) return { succes: false, message: `PDF introuvable : ${path}` };

  const { sujet, html } = getAttestationEmailContent(p.categorie, p.prenom, p.nom);
  const smtp = client();
  await smtp.send({
    from: `ACMCST 2027 Organizing Committee <${GMAIL_USER}>`,
    to: p.email,
    subject: sujet,
    content: "auto",
    html,
    attachments: [attachment],
  });
  await smtp.close();
  return { succes: true, message: `Attestation envoyée à ${p.email}` };
}

// ===== Demande de review / relance : reproduit envoyerEmailReviewer() / relancerReviewer() de Code.gs =====
// Le papier n'est plus joint à l'email : le reviewer le télécharge depuis son tableau de bord.
async function loadAssignmentBundle(assignmentId: string) {
  const { data, error } = await supabaseAdmin
    .from("assignments")
    .select("id, num_reviewer, nb_relances, paper:papers(paper_id, titre), reviewer:reviewers(nom, prenom, email, token)")
    .eq("id", assignmentId)
    .single();
  if (error || !data) return null;
  return data as unknown as {
    id: string; num_reviewer: number; nb_relances: number;
    paper: { paper_id: string; titre: string };
    reviewer: { nom: string; prenom: string; email: string; token: string };
  };
}

async function envoyerEmailReviewer(assignmentId: string) {
  const a = await loadAssignmentBundle(assignmentId);
  if (!a) return { succes: false, message: "Assignment introuvable." };
  const reviewerNom = `${a.reviewer.nom} ${a.reviewer.prenom}`.trim();
  const dashboardLink = `${SITE_URL}/reviewer-dashboard.html?token=${a.reviewer.token}`;

  const sujet = `[ACMCST 2027] Review Request - Paper ID ${a.paper.paper_id}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#1c2b3a;max-width:700px;">
    <p>Dear ${reviewerNom},</p>
    <p>Greetings from <strong>ACMCST 2027</strong>.</p>
    <p>We kindly invite you to review the following paper submitted to <strong>${CONFERENCE}</strong>, ${DATES}.</p>
    <table style="border-collapse:collapse;width:100%;margin:16px 0;">
      <tr><td style="padding:8px;background:#f0f4f8;font-weight:bold;border:1px solid #ddd;width:140px;">Paper ID</td><td style="padding:8px;border:1px solid #ddd;">${a.paper.paper_id}</td></tr>
      <tr><td style="padding:8px;background:#f0f4f8;font-weight:bold;border:1px solid #ddd;">Title</td><td style="padding:8px;border:1px solid #ddd;">${a.paper.titre}</td></tr>
      <tr><td style="padding:8px;background:#f0f4f8;font-weight:bold;border:1px solid #ddd;">Reviewer</td><td style="padding:8px;border:1px solid #ddd;">Reviewer ${a.num_reviewer}</td></tr>
    </table>
    <p>Please click the link below to access your personal review dashboard, read the paper, and submit your evaluation directly online — no form to download or send back by email:</p>
    <p style="margin:20px 0;"><a href="${dashboardLink}" style="display:inline-block;background:#2e9fd4;color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold;">Access My Review Dashboard</a></p>
    <p style="font-size:12px;color:#5a6b80;">If the button doesn't work, copy this link into your browser: ${dashboardLink}</p>
    <p>Please submit your evaluation before <strong>September 30, 2027</strong>.</p>
    <p>Your expert evaluation is very important to us. We sincerely thank you for your time and collaboration.</p>
    <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;">
    <p>Best regards,<br>${CHAIR_NAME}<br>General Chair — ACMCST 2027<br>
    <a href="https://www.acmcst.com" style="color:#2e9fd4;">www.acmcst.com</a> | <a href="mailto:${CHAIR_EMAIL}" style="color:#2e9fd4;">${CHAIR_EMAIL}</a></p>
  </div>`;

  const smtp = client();
  await smtp.send({
    from: `ACMCST 2027 Organizing Committee <${GMAIL_USER}>`,
    to: a.reviewer.email,
    subject: sujet,
    content: "auto",
    html,
  });
  await smtp.close();

  await supabaseAdmin
    .from("assignments")
    .update({ date_envoi: new Date().toISOString() })
    .eq("id", assignmentId);

  return { succes: true, message: `Email envoyé à ${a.reviewer.email}` };
}

async function relancerReviewer(assignmentId: string) {
  const a = await loadAssignmentBundle(assignmentId);
  if (!a) return { succes: false, message: "Assignment introuvable." };
  const reviewerNom = `${a.reviewer.nom} ${a.reviewer.prenom}`.trim();
  const dashboardLink = `${SITE_URL}/reviewer-dashboard.html?token=${a.reviewer.token}`;

  const sujet = `[ACMCST 2027] Reminder - Review Request - Paper ID ${a.paper.paper_id}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#1c2b3a;max-width:700px;">
    <p>Dear ${reviewerNom},</p>
    <p>This is a <strong>friendly reminder</strong> that you have been assigned to review the following paper for <strong>ACMCST 2027</strong>.</p>
    <table style="border-collapse:collapse;width:100%;margin:16px 0;">
      <tr><td style="padding:8px;background:#f0f4f8;font-weight:bold;border:1px solid #ddd;width:140px;">Paper ID</td><td style="padding:8px;border:1px solid #ddd;">${a.paper.paper_id}</td></tr>
      <tr><td style="padding:8px;background:#f0f4f8;font-weight:bold;border:1px solid #ddd;">Title</td><td style="padding:8px;border:1px solid #ddd;">${a.paper.titre}</td></tr>
    </table>
    <p>We have not yet received your review. Please use the link below to access your review dashboard and submit your evaluation online:</p>
    <p style="margin:20px 0;"><a href="${dashboardLink}" style="display:inline-block;background:#2e9fd4;color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold;">Access My Review Dashboard</a></p>
    <p style="font-size:12px;color:#5a6b80;">If the button doesn't work, copy this link into your browser: ${dashboardLink}</p>
    <p><strong>Deadline: September 30, 2027</strong></p>
    <p>We sincerely thank you for your collaboration.</p>
    <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;">
    <p>Best regards,<br>${CHAIR_NAME}<br>General Chair — ACMCST 2027<br>
    <a href="https://www.acmcst.com" style="color:#2e9fd4;">www.acmcst.com</a> | <a href="mailto:${CHAIR_EMAIL}" style="color:#2e9fd4;">${CHAIR_EMAIL}</a></p>
  </div>`;

  const smtp = client();
  await smtp.send({
    from: `ACMCST 2027 Organizing Committee <${GMAIL_USER}>`,
    to: a.reviewer.email,
    subject: sujet,
    content: "auto",
    html,
  });
  await smtp.close();

  await supabaseAdmin
    .from("assignments")
    .update({ nb_relances: (a.nb_relances || 0) + 1 })
    .eq("id", assignmentId);

  return { succes: true, message: `Relance envoyée à ${a.reviewer.email}` };
}

// ===== Décision finale : reproduit sendDecision() de Code.gs =====
async function sendDecision(paperId: string) {
  const { data: p, error } = await supabaseAdmin
    .from("papers")
    .select("paper_id, titre, email_auteur, ithenticate, decision, decision_remark, participant_origin")
    .eq("id", paperId)
    .single();
  if (error || !p) return { succes: false, message: "Papier introuvable." };
  if (!p.decision) return { succes: false, message: "Aucune décision définie pour ce papier." };
  if ((p.decision === "Accepted" || p.decision === "Accepted_Poster") && !p.participant_origin) {
    return { succes: false, message: "Participant Origin (Moroccan/International) doit être renseigné avant l'envoi." };
  }

  const { data: assignments, error: aError } = await supabaseAdmin
    .from("assignments")
    .select("num_reviewer, score, commentaire")
    .eq("paper_id", paperId)
    .order("num_reviewer");
  if (aError) throw aError;

  const reviewsHtml = (assignments || []).map((a) => `
    <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;">
    <p><strong>----------------------- REVIEW ${a.num_reviewer} ---------------------</strong><br><strong>SCORE:</strong> ${a.score || ""}<br><strong>TEXT:</strong><br>${(a.commentaire || "").replace(/\n/g, "<br>")}</p>
  `).join("");

  const ithenticate = Number(p.ithenticate) || 0;
  const plagiarismText = ithenticate < 20
    ? `After verification with iThenticate, the similarity index of the paper is ${ithenticate}%, which is well below the 20% threshold required by Springer.`
    : `After verification with iThenticate, the similarity index of the paper is ${ithenticate}%, which exceeds the 20% threshold required by Springer. The paper must be revised to reduce the similarity index before publication.`;

  // Lien camera-ready : le token dépend de la décision (Oral/Poster) et de l'origine
  // du participant (Moroccan/International), les 4 tokens étant configurables dans
  // la table config (dashboard Supabase → table config, ligne id=1).
  let cameraReadyLink = "";
  if (p.decision === "Accepted" || p.decision === "Accepted_Poster") {
    const { data: cfg } = await supabaseAdmin
      .from("config")
      .select("camera_ready_token_oral_moroccan, camera_ready_token_oral_international, camera_ready_token_poster_moroccan, camera_ready_token_poster_international")
      .eq("id", 1)
      .single();
    if (cfg) {
      const isOral = p.decision === "Accepted";
      const isMoroccan = p.participant_origin === "Moroccan";
      const token = isOral
        ? (isMoroccan ? cfg.camera_ready_token_oral_moroccan : cfg.camera_ready_token_oral_international)
        : (isMoroccan ? cfg.camera_ready_token_poster_moroccan : cfg.camera_ready_token_poster_international);
      if (token) cameraReadyLink = `${SITE_URL}/camera-ready.html?token=${token}`;
    }
  }
  const cameraReadyHtml = cameraReadyLink
    ? `<p>Please complete your camera-ready submission at: <a href="${cameraReadyLink}" style="color:#2e9fd4;">Camera-Ready Submission</a></p>`
    : "";

  let sujet: string, html: string;
  if (p.decision === "Accepted") {
    sujet = `[ACMCST 2027] Acceptance Notification - Paper ID ${p.paper_id}`;
    html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#1c2b3a;max-width:700px;">
      <p>Dear Corresponding Author,</p>
      <p>Greetings from ACMCST 2027.</p>
      <p>We are delighted to let you know that your paper: <strong>ID ${p.paper_id}: "${p.titre}"</strong>, has been accepted, as an oral presentation, in <strong>${CONFERENCE}</strong>, ${DATES}.</p>
      <p>Please modify your paper according to the reviewers' suggestions. The final version of your paper will be checked by the conference chairs to make sure that all reviewers' comments have been addressed.<br>
      <strong>(WARNING: Springer does not accept the publication of papers with an overall similarity rate exceeding 20%.)</strong></p>
      <p>You are kindly requested to take into account the reviewers' comments listed below and upload the final version of your paper on the conference submission platform before <strong>September 30, 2027</strong>.</p>
      <p>Please format the final version of your paper using the Springer template: <a href="${SPRINGER_LINK}" style="color:#2e9fd4;">Springer Guidelines</a></p>
      <p>Please download the Copyright Transfer Form at: <a href="${REGISTRATION_LINK}" style="color:#2e9fd4;">Registration Link</a></p>
      ${cameraReadyHtml}
      <p>Once you complete your registration by clicking the link above, you will automatically receive a confirmation email containing a link to upload your source files.</p>
      <p>Please upload only ONE file, depending on the format used to prepare your paper:</p>
      <ul>
        <li><strong>LaTeX</strong> → A ZIP file containing all source files (.tex files, figures, bibliography, etc.)</li>
        <li><strong>Word</strong> → Your Word document (.docx)</li>
      </ul>
      <p><strong>SUBMISSION:</strong> ${p.paper_id}<br><strong>TITLE:</strong> ${p.titre}</p>
      <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;">
      <p><strong>----------------------- PLAGIARISM CHECK ---------------------</strong><br>${plagiarismText}</p>
      ${reviewsHtml}
      <p>With our highest regards,<br>The Organizing Committee<br>ACMCST 2027<br>
      <a href="https://www.acmcst.com" style="color:#2e9fd4;">www.acmcst.com</a> | <a href="mailto:acmcst@usms.ma" style="color:#2e9fd4;">acmcst@usms.ma</a></p>
    </div>`;
  } else if (p.decision === "Accepted_Poster") {
    sujet = `[ACMCST 2027] Acceptance Notification - Paper ID ${p.paper_id}`;
    html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#1c2b3a;max-width:700px;">
      <p>Dear Corresponding Author,</p>
      <p>Greetings from ACMCST 2027.</p>
      <p>We are pleased to inform you that your paper: <strong>ID ${p.paper_id}: "${p.titre}"</strong> has been accepted for a poster presentation at <strong>${CONFERENCE}</strong>, ${DATES}.</p>
      <p>Please note that, as a poster presentation, your paper will <strong>not be published in the Springer LNCS proceedings</strong>.</p>
      <p>You are required to present your poster during the dedicated poster session of the conference. Poster presentations may be delivered either in person at the conference venue or remotely via video conference. In both cases, authors must be available throughout the session to answer questions from participants.</p>
      <p>A certificate of poster presentation will be delivered to you on site or sent digitally after the conference.</p>
      ${cameraReadyHtml}
      <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;">
      <p><strong>----------------------- PLAGIARISM CHECK ---------------------</strong><br>${plagiarismText}</p>
      ${reviewsHtml}
      <p>With our highest regards,<br>The Organizing Committee<br>ACMCST 2027<br>
      <a href="https://www.acmcst.com" style="color:#2e9fd4;">www.acmcst.com</a> | <a href="mailto:acmcst@usms.ma" style="color:#2e9fd4;">acmcst@usms.ma</a></p>
    </div>`;
  } else if (p.decision === "Hors_Sujet") {
    sujet = `[ACMCST 2027] Decision Notification - Paper ID ${p.paper_id}`;
    const remarkHtml = p.decision_remark
      ? `<p><strong>Remark from the Chair:</strong><br>${p.decision_remark.replace(/\n/g, "<br>")}</p>`
      : "";
    html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#1c2b3a;max-width:700px;">
      <p>Dear Corresponding Author,</p>
      <p>Greetings from ACMCST 2027.</p>
      <p>After careful review, we regret to inform you that your paper: <strong>ID ${p.paper_id}: "${p.titre}"</strong> does not fall within the scope of <strong>${CONFERENCE}</strong>. We encourage you to submit your work to a more suitable venue.</p>
      ${remarkHtml}
      <p>We sincerely thank you for your submission and for considering ACMCST 2027 as a venue for your research.</p>
      <p><strong>SUBMISSION:</strong> ${p.paper_id}<br><strong>TITLE:</strong> ${p.titre}</p>
      <p>Best regards,<br>The Organizing Committee<br>ACMCST 2027<br>
      <a href="https://www.acmcst.com" style="color:#2e9fd4;">www.acmcst.com</a> | <a href="mailto:acmcst@usms.ma" style="color:#2e9fd4;">acmcst@usms.ma</a></p>
    </div>`;
  } else {
    sujet = `[ACMCST 2027] Decision Notification - Paper ID ${p.paper_id}`;
    html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#1c2b3a;max-width:700px;">
      <p>Dear Corresponding Author,</p>
      <p>Greetings from ACMCST 2027.</p>
      <p>We regret to inform you that your paper: <strong>ID ${p.paper_id}: "${p.titre}"</strong> has not been accepted for presentation at <strong>${CONFERENCE}</strong>, ${DATES}.</p>
      <p>We sincerely thank you for your submission and for considering ACMCST 2027 as a venue for your research. We encourage you to improve the work further and to consider submitting to future editions of our conference.</p>
      <p><strong>SUBMISSION:</strong> ${p.paper_id}<br><strong>TITLE:</strong> ${p.titre}</p>
      ${reviewsHtml}
      <p>Best regards,<br>The Organizing Committee<br>ACMCST 2027<br>
      <a href="https://www.acmcst.com" style="color:#2e9fd4;">www.acmcst.com</a> | <a href="mailto:acmcst@usms.ma" style="color:#2e9fd4;">acmcst@usms.ma</a></p>
    </div>`;
  }

  const smtp = client();
  await smtp.send({
    from: `ACMCST 2027 Organizing Committee <${GMAIL_USER}>`,
    to: p.email_auteur,
    subject: sujet,
    content: "auto",
    html,
  });
  await smtp.close();

  await supabaseAdmin
    .from("papers")
    .update({ statut: "Envoyé", date_envoi_decision: new Date().toISOString() })
    .eq("id", paperId);

  return { succes: true, message: `Email envoyé à ${p.email_auteur}` };
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
      case "envoyerEmailReviewer":
        result = await envoyerEmailReviewer(body.assignmentId);
        break;
      case "relancerReviewer":
        result = await relancerReviewer(body.assignmentId);
        break;
      case "sendDecision":
        result = await sendDecision(body.paperId);
        break;
      case "envoyerAttestation":
        result = await envoyerAttestation(body.participantId);
        break;
      default:
        result = { succes: false, message: "Action inconnue." };
    }
    return json(result);
  } catch (e) {
    return json({ succes: false, message: e instanceof Error ? e.message : String(e) }, 500);
  }
});
