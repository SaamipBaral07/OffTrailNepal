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

const getFrontendUrl = () => {
  return process.env.FRONTEND_URL || "http://localhost:3000";
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

export const sendPasswordResetEmail = async ({ to, resetToken, userName = "Adventurer" }) => {
  const transporter = getTransporter();
  const frontendUrl = getFrontendUrl();
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

  if (!transporter) {
    throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM.");
  }

  const emailTemplate = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 640px; margin: 0 auto;">
      <h2 style="margin: 0 0 12px; color: #0c2340;">Reset your OffTrail Nepal password</h2>
      <p>Hello ${userName},</p>
      <p>We received a request to reset your password. Click the button below to continue.</p>
      <p style="margin: 24px 0;">
        <a href="${resetLink}" style="background:#d4af37;color:#0c2340;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:700;display:inline-block;">
          Reset Password
        </a>
      </p>
      <p>If the button does not work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all; background:#f3f4f6; border:1px solid #e5e7eb; padding:10px; border-radius:6px;">${resetLink}</p>
      <p style="margin-top: 20px;"><strong>This link expires in 15 minutes.</strong></p>
      <p>If you did not request this, you can safely ignore this email.</p>
    </div>
  `;

  await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject: "Reset your OffTrail Nepal password",
    text: [
      `Hello ${userName},`,
      "",
      "We received a request to reset your password.",
      `Reset link: ${resetLink}`,
      "",
      "This link expires in 15 minutes.",
      "If you did not request this, you can safely ignore this email."
    ].join("\n"),
    html: emailTemplate
  });
};
