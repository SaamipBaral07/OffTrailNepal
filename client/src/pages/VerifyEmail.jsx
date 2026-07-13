
// ╠════════════════════════════════════════════════════════════════════════════╣
// ║ POST /api/auth/verify-email → authRoutes.js → authController.verifyEmail║
// ╚════════════════════════════════════════════════════════════════════════════╝

import { useMemo, useState } from "react";
import axios from "axios";
import { Link, useSearchParams } from "react-router-dom";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const initialEmail = useMemo(() => searchParams.get("email") || "", [searchParams]);
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("Enter the 6-digit OTP sent to your email.");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleVerify = async () => {
    if (!email.trim() || !otp.trim()) {
      setStatus("error");
      setMessage("Email and OTP are required.");
      return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      setStatus("error");
      setMessage("OTP must be a 6-digit code.");
      return;
    }

    setIsSubmitting(true);
    setStatus("loading");
    setMessage("Verifying your email with OTP...");

    try {
      const response = await axios.post(
        "http://localhost:5000/api/auth/verify-email",
        { email: email.trim().toLowerCase(), otp: otp.trim() },
        { withCredentials: true }
      );

      setStatus("success");
      setMessage(response.data?.message || "Email verified successfully. You can now log in.");
    } catch (error) {
      setStatus("error");
      setMessage(error.response?.data?.message || "Verification failed. The link may be expired.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <h1 className="text-3xl font-extrabold text-navy mb-3 font-heading">Email Verification</h1>
        <p className="text-gray-600 mb-8">OffTrail Nepal OTP confirmation</p>

        <div className="grid gap-3 mb-5 text-left">
          <label className="text-sm font-semibold text-gray-700" htmlFor="verify-email-input">
            Email Address
          </label>
          <input
            id="verify-email-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-navy/30"
            placeholder="your.email@example.com"
            autoComplete="email"
          />

          <label className="text-sm font-semibold text-gray-700" htmlFor="verify-otp-input">
            6-digit OTP
          </label>
          <input
            id="verify-otp-input"
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-navy/30 tracking-[0.35em] text-center font-semibold"
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
        </div>

        <div
          className={`rounded-xl border px-4 py-4 mb-8 ${
            status === "success"
              ? "bg-green-50 border-green-200 text-green-700"
              : status === "error"
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-blue-50 border-blue-200 text-blue-700"
          }`}
        >
          {message}
        </div>

        {status !== "success" && (
          <button
            type="button"
            onClick={handleVerify}
            disabled={isSubmitting}
            className="w-full mb-4 px-5 py-3 rounded-xl font-semibold text-white bg-navy hover:bg-navy/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Verifying..." : "Verify with OTP"}
          </button>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/login"
            className="px-5 py-3 rounded-xl font-semibold text-white bg-navy hover:bg-navy/90 transition-colors"
          >
            Go to Login
          </Link>
          <Link
            to="/register"
            className="px-5 py-3 rounded-xl font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Register Again
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
