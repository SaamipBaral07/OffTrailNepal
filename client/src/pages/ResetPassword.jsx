
// ╠══════════════════════════════════════════════════════════════════════════════════╣
// ║ POST /api/auth/reset-password → authRoutes.js → authController.resetPassword  ║
// ╚══════════════════════════════════════════════════════════════════════════════════╝

import { useState } from "react";
import axios from "axios";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const ResetPassword = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // "success" or "error"
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const calculatePasswordStrength = (pwd) => {
    let strength = 0;
    if (pwd.length >= 8) strength += 25;
    if (/[A-Z]/.test(pwd)) strength += 25;
    if (/[0-9]/.test(pwd)) strength += 25;
    if (/[^A-Za-z0-9]/.test(pwd)) strength += 25;
    return strength;
  };

  const handlePasswordChange = (e) => {
    const pwd = e.target.value;
    setPassword(pwd);
    setPasswordStrength(calculatePasswordStrength(pwd));
  };

  const handleReset = async (e) => {
    e?.preventDefault?.();
    try {
      setIsLoading(true);
      setMessage("");
      setMessageType("");

      if (!token) {
        setMessage("Invalid reset link. Please request a new password reset email.");
        setMessageType("error");
        return;
      }

      if (!password.trim() || !confirmPassword.trim()) {
        setMessage("Both password fields are required");
        setMessageType("error");
        return;
      }

      if (password.length < 8) {
        setMessage("Password must be at least 8 characters long");
        setMessageType("error");
        return;
      }

      if (password !== confirmPassword) {
        setMessage("Passwords do not match");
        setMessageType("error");
        return;
      }

      if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
        setMessage("Password must contain uppercase letters and numbers");
        setMessageType("error");
        return;
      }

      await axios.post(
        (process.env.REACT_APP_API_URL || "http://localhost:5000") + "/api/auth/reset-password",
        {
          token,
          newPassword: password
        }
      );
      setMessage("✅ Password reset successfully! Redirecting to login...");
      setMessageType("success");
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Something went wrong. Please try again.";
      setMessage(errorMsg);
      setMessageType("error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-cream">
      {/* ── Left Panel: Brand ── */}
      <div
        className="hidden lg:flex lg:w-5/12 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0C2340 0%, #163A5F 55%, #081A2F 100%)" }}
      >
        {/* Decorative rings */}
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full border border-white/5 pointer-events-none" />
        <div className="absolute bottom-16 -left-28 w-72 h-72 rounded-full border border-gold/10 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full border border-white/[0.03] pointer-events-none" />

        {/* Logo + tagline */}
        <div className="relative z-10">
          <Link to="/" className="inline-block">
            <div className="relative w-32 h-32 mb-10 hover:scale-105 transition-transform">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gold/40 via-gold/20 to-gold/40 p-[2px]">
                <div className="h-full w-full rounded-full bg-navy/80 p-0.5">
                  <img
                    src="/offtrail-latest.png"
                    alt="OffTrail Nepal"
                    className="h-full w-full rounded-full object-cover"
                  />
                </div>
              </div>
            </div>
          </Link>
          <h2 className="text-3xl font-extrabold text-white leading-tight mb-4 font-heading">
            Nepal's Premier<br />
            <span className="text-gold">Off-Trail</span> Platform
          </h2>
          <p className="text-white/55 text-sm leading-relaxed max-w-xs">
            Secure your account with a strong password and continue your adventure with OffTrail Nepal.
          </p>
        </div>

        {/* Footer text */}
        <div className="relative z-10">
          <p className="text-white/40 text-sm">© 2026 OffTrail Nepal. All rights reserved.</p>
        </div>
      </div>

      {/* ── Right Panel: Form ── */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8">
            <Link 
              to="/login"
              className="inline-flex items-center gap-2 text-navy hover:text-gold transition-colors mb-6 text-sm font-medium"
            >
              <ArrowLeft size={16} />
              Back to Login
            </Link>
            
            <h1 className="text-4xl font-bold text-navy mb-2">Create New Password</h1>
            <p className="text-gray-600 text-sm">
              Enter a strong password to secure your account.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleReset} className="space-y-6">
            {/* Password Input */}
            <div>
              <label className="block text-sm font-semibold text-navy mb-3">New Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="Enter new password"
                  className="w-full pl-12 pr-12 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                  disabled={isLoading}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              
              {/* Password Strength Meter */}
              {password && (
                <div className="mt-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-gray-600">Password Strength</span>
                    <span className={`text-xs font-semibold ${
                      passwordStrength < 50 ? 'text-red-600' : 
                      passwordStrength < 75 ? 'text-yellow-600' : 
                      'text-green-600'
                    }`}>
                      {passwordStrength < 50 ? 'Weak' : 
                       passwordStrength < 75 ? 'Good' : 
                       'Strong'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        passwordStrength < 50 ? 'bg-red-500 w-1/3' :
                        passwordStrength < 75 ? 'bg-yellow-500 w-2/3' :
                        'bg-green-500 w-full'
                      }`}
                    />
                  </div>
                  <ul className="mt-2 text-xs text-gray-600 space-y-1">
                    <li className={password.length >= 8 ? "text-green-600" : ""}>
                      ✓ At least 8 characters
                    </li>
                    <li className={/[A-Z]/.test(password) ? "text-green-600" : ""}>
                      ✓ Uppercase letter
                    </li>
                    <li className={/[0-9]/.test(password) ? "text-green-600" : ""}>
                      ✓ Number
                    </li>
                    <li className={/[^A-Za-z0-9]/.test(password) ? "text-green-600" : ""}>
                      ✓ Special character (optional)
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Confirm Password Input */}
            <div>
              <label className="block text-sm font-semibold text-navy mb-3">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="w-full pl-12 pr-12 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              
              {/* Password Match Indicator */}
              {confirmPassword && (
                <div className="mt-2">
                  {password === confirmPassword ? (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle size={14} /> Passwords match
                    </p>
                  ) : (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle size={14} /> Passwords do not match
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Message Alert */}
            {message && (
              <div className={`flex items-start gap-3 p-4 rounded-lg transition-all ${
                messageType === 'success' 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                {messageType === 'success' ? (
                  <CheckCircle className="text-green-600 mt-0.5 flex-shrink-0" size={20} />
                ) : (
                  <AlertCircle className="text-red-600 mt-0.5 flex-shrink-0" size={20} />
                )}
                <p className={`text-sm ${messageType === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                  {message}
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !password || !confirmPassword}
              className="w-full bg-gradient-to-r from-gold to-yellow-400 hover:from-gold-dark hover:to-yellow-500 disabled:from-gray-300 disabled:to-gray-300 text-navy font-bold py-3 rounded-lg transition-all transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader size={20} className="animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  Reset Password
                  <Lock size={20} />
                </>
              )}
            </button>
          </form>

          {/* Security Info */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>🔒 Security Tips:</strong><br/>
                • Use a unique password you haven't used before<br/>
                • Avoid using personal information<br/>
                • Keep your password private at all times
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
