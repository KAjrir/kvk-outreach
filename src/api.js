import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

import { getAllLeads, getLeadsByStatus, approveLead, approveAll, updateEmailDraft, markEmailed, markSkipped } from './db.js';
import { sendOutreachEmail } from './mailer.js';

const app = express();
app.use(cors());
app.use(express.json());

const SCREENSHOTS_DIR = process.env.SCREENSHOTS_DIR || './screenshots';

// Screenshots serveren
app.use('/screenshots', express.static(SCREENSHOTS_DIR));

// Dashboard serveren
const __dirname = path.dirname(new URL(import.meta.url).pathname);
app.use(express.static(path.join(__dirname, '../dashboard')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../dashboard/index.html'));
});

// Alle leads ophalen
app.get('/api/leads', async (req, res) => {
  try {
    const { status } = req.query;
    const leads = status ? await getLeadsByStatus(status) : await getAllLeads();
    res.json(leads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Email draft updaten — :ggId is de Goudengids identifier
app.put('/api/leads/:ggId/draft', async (req, res) => {
  try {
    const { emailSubject, emailBody } = req.body;
    await updateEmailDraft(req.params.ggId, { emailSubject, emailBody });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Één lead goedkeuren
app.post('/api/leads/:ggId/approve', async (req, res) => {
  try {
    await approveLead(req.params.ggId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alle review leads bulk goedkeuren
app.post('/api/leads/approve-all', async (req, res) => {
  try {
    await approveAll();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Één lead skippen
app.post('/api/leads/:ggId/skip', async (req, res) => {
  try {
    await markSkipped(req.params.ggId, 'handmatig geskipt');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alle goedgekeurde leads versturen
app.post('/api/send-approved', async (req, res) => {
  try {
    const leads = await getLeadsByStatus('approved');
    const results = [];

    for (const lead of leads) {
      try {
        await sendOutreachEmail({
          email: lead.email,
          emailSubject: lead.email_subject,
          emailBody: lead.email_body,
        });
        await markEmailed(lead.gg_id);
        results.push({ ggId: lead.gg_id, ok: true });
      } catch (err) {
        results.push({ ggId: lead.gg_id, ok: false, error: err.message });
      }
    }

    res.json({
      sent: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ API draait op poort ${PORT} → http://localhost:${PORT}`));