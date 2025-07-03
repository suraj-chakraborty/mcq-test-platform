import nodemailer from 'nodemailer';

export const sendEmail = async (to: string, subject: string, text: string) => {

  const testAccount = await nodemailer.createTestAccount()

  const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: "surajchakraborty121@gmail.com",
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  },
  });

  try {
    await transporter.sendMail({
    from:  `"MCQ Test Platform" <${testAccount.user}>`,
    to,
    subject,
    text,
  });
  console.log(`mail send to ${to}`)
  } catch (error) {
    console.log("Failed to send mail")
    console.log(error)
  }
};
