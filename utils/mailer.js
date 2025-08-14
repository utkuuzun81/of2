import nodemailer from 'nodemailer';

// Simple mailer utility. If SMTP env vars are missing, sendMail will no-op.
const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter = null;
if (hasSmtp) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

export async function sendMail({ to, subject, html }) {
  if (!hasSmtp || !transporter) {
    // Silent no-op in dev; log for visibility if DEBUG_AUTH enabled
    if (String(process.env.DEBUG_AUTH) === 'true') {
      console.warn('[MAILER] SMTP not configured, skipping email to', to, 'subject:', subject);
    }
    return { skipped: true };
  }
  const from = process.env.EMAIL_FROM || 'no-reply@odyostore.com';
  return transporter.sendMail({ from, to, subject, html });
}

export default { sendMail };
