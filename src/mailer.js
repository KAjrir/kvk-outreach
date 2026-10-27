import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';
dotenv.config();

const PHONE = process.env.FROM_PHONE;
const WEBSITE = process.env.FROM_WEBSITE || 'uwsitebeter.nl';

function getSendGrid() {
  if (!process.env.SENDGRID_API_KEY) throw new Error('SENDGRID_API_KEY ontbreekt in .env');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  return sgMail;
}

function baseStyles() {
  return `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        font-size: 15px;
        color: #1a1a1a;
        line-height: 1.7;
        background: #f5f5f5;
        padding: 24px 16px;
      }
      .wrap {
        max-width: 560px;
        margin: 0 auto;
        background: #ffffff;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid #e5e5e5;
      }
      .body { padding: 32px 32px 24px; }
      p { margin-bottom: 16px; }
      p:last-of-type { margin-bottom: 0; }
      .issues {
        margin: 4px 0 20px;
        padding: 16px 20px;
        background: #fafafa;
        border-left: 3px solid #1A56DB;
        border-radius: 0 6px 6px 0;
      }
      .issues p {
        margin: 0 0 8px;
        font-size: 14px;
        color: #444;
      }
      .issues p:last-child { margin-bottom: 0; }
      .sig {
        margin-top: 28px;
        padding-top: 20px;
        border-top: 1px solid #efefef;
        font-size: 14px;
        color: #333;
        line-height: 1.8;
      }
      .sig strong { display: block; font-size: 15px; font-weight: 700; }
      .sig a { color: #1A56DB; text-decoration: none; }
      .footer {
        padding: 14px 32px;
        background: #fafafa;
        border-top: 1px solid #efefef;
        font-size: 12px;
        color: #999;
      }
    </style>
  `;
}

function signature() {
  return `
    <div class="sig">
      <strong>Karim Ajrir</strong>
      Webbeter<br>
      ${PHONE}<br>
      <a href="https://${WEBSITE}">${WEBSITE}</a>
    </div>
  `;
}

function footer() {
  return `
    <div class="footer">
      Geen interesse? Laat het me weten en u hoort nooit meer van me.
    </div>
  `;
}

function buildWebsiteHtml(companyName, issues, websiteUrl) {
  const domain = websiteUrl
    ? websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
    : null;

  const issuesBlock = issues && issues.length
    ? `<div class="issues">${issues.map(i => `<p>— ${i}</p>`).join('')}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseStyles()}
</head>
<body>
  <div class="wrap">
    <div class="body">
      <p>Geachte,</p>
      <p>Mijn naam is Karim Ajrir, ik ben webdeveloper en help kleine bedrijven in Nederland aan een betere online aanwezigheid.</p>
      <p>Ik bekeek kort de website van ${companyName}${domain ? ` (${domain})` : ''} en viel over een paar dingen:</p>
      ${issuesBlock}
      <p>Dit soort dingen zorgen er in de praktijk voor dat bezoekers afhaken of u helemaal niet gevonden wordt. Ik help u dit op te lossen — van een nieuw design tot betere vindbaarheid in Google.</p>
      <p>Tarieven beginnen vanaf €300. Geen abonnementen of verborgen kosten.</p>
      <p>Heeft u even tijd voor een korte kennismaking? Reageer gerust op deze mail of bel me op ${PHONE}.</p>
      ${signature()}
    </div>
    ${footer()}
  </div>
</body>
</html>`;
}

function buildNoWebsiteHtml(companyName) {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseStyles()}
</head>
<body>
  <div class="wrap">
    <div class="body">
      <p>Geachte,</p>
      <p>Mijn naam is Karim Ajrir, ik ben webdeveloper en help kleine bedrijven in Nederland aan een professionele online aanwezigheid.</p>
      <p>Ik zag ${companyName} voorbijkomen en merkte dat u nog geen website heeft. In de praktijk zie ik dat veel potentiële klanten eerst even googelen voordat ze bellen — zonder website loopt u die mis.</p>
      <p>Ik bouw overzichtelijke, mobielvriendelijke websites inclusief goede vindbaarheid in Google. Tarieven beginnen vanaf €300.</p>
      <p>Heeft u even tijd voor een korte kennismaking? Reageer gerust op deze mail of bel me op ${PHONE}.</p>
      ${signature()}
    </div>
    ${footer()}
  </div>
</body>
</html>`;
}

export function buildEmailDraft({ companyName, issues, websiteUrl, hasNoWebsite = false }) {
  const subject = hasNoWebsite
    ? `Korte vraag — ${companyName}`
    : `Iets opgevallen aan de website van ${companyName}`;

  const html = hasNoWebsite
    ? buildNoWebsiteHtml(companyName)
    : buildWebsiteHtml(companyName, issues, websiteUrl);

  return { subject, html };
}

export async function sendOutreachEmail({ email, emailSubject, emailBody, fromEmail }) {
  const sg = getSendGrid();
  await sg.send({
    to: email,
    from: fromEmail || process.env.FROM_EMAIL,
    subject: emailSubject,
    html: emailBody,
  });
}