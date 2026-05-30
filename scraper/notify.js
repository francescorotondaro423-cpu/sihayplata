'use strict';

const nodemailer = require('nodemailer');

async function sendFailureEmail(failedApps, successCount, total) {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const to   = process.env.EMAIL_NOTIFY || user;

  if (!user || !pass) {
    console.warn('[notify] EMAIL_USER / EMAIL_PASS no configurados — email omitido');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  const failList = failedApps.map(f => `  • ${f.app}: ${f.reason}`).join('\n');
  const subject  = `[FinRank AR] Scraper: ${failedApps.length} app(s) con error`;
  const text     = [
    `Reporte del scraper automático (${new Date().toLocaleString('es-AR')}):`,
    ``,
    `✅ Actualizadas: ${successCount}/${total}`,
    `❌ Fallos: ${failedApps.length}/${total}`,
    ``,
    `Detalle de fallos:`,
    failList,
    ``,
    `Para corregir manualmente enviá un POST a /api/ars con la API key.`,
    `Ejemplo:`,
    `  curl -X POST http://localhost:8080/api/ars \\`,
    `    -H "x-api-key: ${process.env.ADMIN_KEY || 'finrank-admin-2026'}" \\`,
    `    -H "Content-Type: application/json" \\`,
    `    -d '{"items": [{"app": "Ualá", "tna": 26.0}]}'`,
  ].join('\n');

  try {
    await transporter.sendMail({ from: user, to, subject, text });
    console.log(`[notify] Email enviado a ${to}`);
  } catch (err) {
    console.error('[notify] Error enviando email:', err.message);
  }
}

module.exports = { sendFailureEmail };
