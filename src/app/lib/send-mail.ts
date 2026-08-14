import nodemailer from 'nodemailer';

export const sendEmail = async (to: string, subject: string, text: string) => {
  const user = process.env.EMAIL_USER;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!user) {
    console.warn(`[sendEmail] EMAIL_USER not configured. Skipping email to ${to}: "${subject}"`);
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
      to,
      subject,
      text,
    });
    console.log(`[sendEmail] Email successfully sent to ${to}`);
  } catch (error) {
    console.error(`[sendEmail] Failed to send email to ${to}:`, error);
    throw new Error('Failed to send verification email');
  }
};
