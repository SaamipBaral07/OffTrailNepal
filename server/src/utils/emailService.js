import nodemailer from "nodemailer";
import https from "https";

let cachedTransporter = null;

const hasSmtpConfig = () => {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const host = process.env.SMTP_HOST || (user && user.includes("@gmail.com") ? "smtp.gmail.com" : null);
  const port = process.env.SMTP_PORT || (user && user.includes("@gmail.com") ? "465" : null);
  return Boolean(host && port && user && pass);
};

const getTransporter = () => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  if (!hasSmtpConfig()) {
    return null;
  }

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE !== undefined ? (process.env.SMTP_SECURE === "true") : (port === 465);

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
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

const sendMailWrapper = async ({ to, subject, text, html }) => {
  // 1. Try Resend HTTP API if configured
  if (process.env.RESEND_API_KEY) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        from: process.env.MAIL_FROM || "onboarding@resend.dev",
        to,
        subject,
        text,
        html
      });

      const options = {
        hostname: "api.resend.com",
        port: 443,
        path: "/emails",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Length": Buffer.byteLength(data)
        }
      };

      const req = https.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => body += chunk);
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            console.error("Resend API failed:", res.statusCode, body);
            reject(new Error(`Resend API returned status ${res.statusCode}: ${body}`));
          }
        });
      });

      req.on("error", (error) => {
        console.error("Resend request error:", error);
        reject(error);
      });

      req.write(data);
      req.end();
    });
  }

  // 2. Try Brevo HTTP API if configured
  if (process.env.BREVO_API_KEY) {
    return new Promise((resolve, reject) => {
      const fromEmail = process.env.MAIL_FROM || process.env.SMTP_USER || "no-reply@offtrailnepal.com";
      const senderName = fromEmail.includes("<") ? fromEmail.split("<")[0].trim() : "OffTrail Nepal";
      const senderEmail = fromEmail.includes("<") ? fromEmail.split("<")[1].replace(">", "").trim() : fromEmail;

      const data = JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html
      });

      const options = {
        hostname: "api.brevo.com",
        port: 443,
        path: "/v3/smtp/email",
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": process.env.BREVO_API_KEY,
          "content-type": "application/json",
          "Content-Length": Buffer.byteLength(data)
        }
      };

      const req = https.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => body += chunk);
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            console.error("Brevo API failed:", res.statusCode, body);
            reject(new Error(`Brevo API returned status ${res.statusCode}: ${body}`));
          }
        });
      });

      req.on("error", (error) => {
        console.error("Brevo request error:", error);
        reject(error);
      });

      req.write(data);
      req.end();
    });
  }

  // 3. Fallback to standard SMTP
  const transporter = getTransporter();
  if (!transporter) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("No mail provider configured. Please configure SMTP or add RESEND_API_KEY / BREVO_API_KEY.");
    }
    console.log(`[Dev Mode] Email to ${to} not sent (no mail provider configured).`);
    console.log(`Subject: ${subject}`);
    console.log(`Content: ${text}`);
    return;
  }

  await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject,
    text,
    html
  });
};

export const sendVerificationEmail = async ({ to, otp }) => {
  await sendMailWrapper({
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
  const frontendUrl = getFrontendUrl();
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

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

  await sendMailWrapper({
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
