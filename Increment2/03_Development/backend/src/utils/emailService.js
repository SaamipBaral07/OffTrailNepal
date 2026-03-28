import nodemailer from "nodemailer";

let cachedTransporter = null;

const hasSmtpConfig = () => {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
};

const getTransporter = () => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  if (!hasSmtpConfig()) {
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  return cachedTransporter;
};

const getFromAddress = () => {
  return process.env.MAIL_FROM || process.env.SMTP_USER || "no-reply@offtrailnepal.local";
};

export const sendVerificationEmail = async ({ to, otp }) => {
  const transporter = getTransporter();

  if (!transporter) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM.");
    }

    console.log(`Email verification OTP for ${to} (dev mode):`, otp);
    return;
  }

  await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject: "Verify your OffTrail Nepal account",
    text: [
      "Welcome to OffTrail Nepal.",
      "",
      "Use this OTP to verify your email:",
      otp,
      "",
      "This OTP expires in 24 hours."
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
        <h2 style="margin-bottom: 8px;">Welcome to OffTrail Nepal</h2>
        <p>Please verify your email address to complete your registration.</p>
        <p>Use the OTP code below in the app:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 12px 0; color: #0c2340;">${otp}</p>
        <p>This OTP expires in 24 hours.</p>
      </div>
    `
  });
};
