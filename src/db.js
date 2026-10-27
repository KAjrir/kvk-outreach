import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

/*
  Naamgeving:
  gg_id       → Goudengids identifier (L119693074), unieke sleutel
  kvk_number  → Echt KVK nummer (57183503), optioneel

  Status flow:
  review   → jij bekijkt en keurt goed of skipt
  approved → goedgekeurd, wacht op verzending
  emailed  → verstuurd
  queued   → eligible maar daglimiet bereikt, morgen automatisch naar review
  skipped  → geen email / site onbereikbaar / score te hoog / handmatig geskipt
*/

export async function setupDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      gg_id TEXT UNIQUE NOT NULL,
      kvk_number TEXT,
      company_name TEXT,
      email TEXT,
      phone TEXT,
      website TEXT,
      source_url TEXT,
      screenshot_path TEXT,
      score INTEGER,
      score_reason TEXT,
      issues JSONB,
      email_subject TEXT,
      email_body TEXT,
      status TEXT NOT NULL DEFAULT 'review',
      emailed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('✅ DB ready');
}

export async function leadExists(ggId) {
  const rows = await sql`SELECT id FROM leads WHERE gg_id = ${ggId}`;
  return rows.length > 0;
}

export async function insertLead(lead) {
  const {
    ggId, kvkNumber, companyName, email, phone, website, sourceUrl,
    screenshotPath, score, scoreReason, issues,
    emailSubject, emailBody, status,
  } = lead;

  await sql`
    INSERT INTO leads (
      gg_id, kvk_number, company_name, email, phone, website, source_url,
      screenshot_path, score, score_reason, issues,
      email_subject, email_body, status
    )
    VALUES (
      ${ggId}, ${kvkNumber}, ${companyName}, ${email}, ${phone}, ${website}, ${sourceUrl},
      ${screenshotPath}, ${score}, ${scoreReason}, ${JSON.stringify(issues ?? [])},
      ${emailSubject}, ${emailBody}, ${status}
    )
    ON CONFLICT (gg_id) DO NOTHING
  `;
}

export async function updateEmailDraft(ggId, { emailSubject, emailBody }) {
  await sql`
    UPDATE leads SET email_subject = ${emailSubject}, email_body = ${emailBody}
    WHERE gg_id = ${ggId}
  `;
}

export async function approveLead(ggId) {
  await sql`UPDATE leads SET status = 'approved' WHERE gg_id = ${ggId}`;
}

export async function approveAll() {
  await sql`UPDATE leads SET status = 'approved' WHERE status = 'review'`;
}

export async function promoteQueued(limit) {
  // Zet queued leads naar review aan het begin van een nieuwe dag
  await sql`
    UPDATE leads SET status = 'review'
    WHERE status = 'queued'
    AND id IN (
      SELECT id FROM leads WHERE status = 'queued'
      ORDER BY created_at ASC
      LIMIT ${limit}
    )
  `;
}

export async function markEmailed(ggId) {
  await sql`UPDATE leads SET status = 'emailed', emailed_at = NOW() WHERE gg_id = ${ggId}`;
}

export async function markSkipped(ggId, reason) {
  await sql`UPDATE leads SET status = 'skipped', score_reason = ${reason} WHERE gg_id = ${ggId}`;
}

export async function getLeadsByStatus(status) {
  return await sql`SELECT * FROM leads WHERE status = ${status} ORDER BY score ASC NULLS LAST`;
}

export async function countLeadsByStatusToday(status) {
  const rows = await sql`
    SELECT COUNT(*) as count FROM leads
    WHERE status = ${status}
    AND created_at >= NOW()::date
  `;
  return parseInt(rows[0].count);
}

export async function getAllLeads() {
  return await sql`SELECT * FROM leads ORDER BY created_at DESC`;
}