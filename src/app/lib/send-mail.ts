import nodemailer from 'nodemailer';

/**
 * Validates and sanitizes email header values (to, subject, cc, bcc)
 * to strictly prevent SMTP CRLF header injection (SEC-008).
 * Throws an Error if CRLF or null-byte characters are detected.
 */
export function sanitizeEmailHeader(value: string, fieldName: string = 'header'): string {
  if (!value || typeof value !== 'string') {
    throw new Error(`Invalid ${fieldName}: value must be a non-empty string`);
  }

  // Reject CRLF (\r or \n) and null bytes (\0)
  if (/[\r\n\0]/.test(value)) {
    throw new Error(`CRLF injection detected in ${fieldName}: header values cannot contain newline characters`);
  }

  return value.trim();
}

/**
 * Escapes unsafe HTML characters to prevent HTML/XSS injection in rendered email bodies.
 */
export function escapeHtml(unsafe: string): string {
  if (!unsafe || typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const sendEmail = async (
  to: string,
  subject: string,
  text: string,
  html?: string
) => {
  // Enforce CRLF header sanitization
  const cleanTo = sanitizeEmailHeader(to, 'recipient address');
  const cleanSubject = sanitizeEmailHeader(subject, 'subject');

  const user = process.env.EMAIL_USER;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!user) {
    console.warn(`[sendEmail] EMAIL_USER not configured. Skipping email to ${cleanTo}: "${cleanSubject}"`);
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user,
      clientId,
      clientSecret,
      refreshToken,
    },
  });

  try {
    await transporter.sendMail({
      from: `"MCQ Test Platform" <${user}>`,
      to: cleanTo,
      subject: cleanSubject,
      text,
      html: html || undefined,
    });
    console.log(`[sendEmail] Email successfully sent to ${cleanTo}`);
  } catch (error) {
    console.error(`[sendEmail] Failed to send email to ${cleanTo}:`, error);
    throw new Error('Failed to send verification email');
  }
};

