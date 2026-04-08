import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { Mail, ArrowLeft, CheckCircle, AlertCircle, Loader } from "lucide-react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // "success" or "error"
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    try {
            setIsLoading(true);
            setMessage("");
            setMessageType("");

            if (!email.trim()) {
              setMessage("Please enter your email address");
              setMessageType("error");
              setIsLoading(false);
              return;
            }

      await axios.post(
        "http://localhost:5000/api/auth/forgot-password",
        { email }
      );
      setMessage("✅ Check your email for password reset instructions!");
      setMessageType("success");
      setEmail("");
      setTimeout(() => {
        navigate("/login");
      }, 5000);
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Something went wrong. Please try again.";
      setMessage(errorMsg);
      setMessageType("error");
    }
      finally {
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
            Lost access? No worry! Reset your password and get back to exploring the authentic beauty of the Himalayas.
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
            
            <h1 className="text-4xl font-bold text-navy mb-2">Reset Password</h1>
            <p className="text-gray-600 text-sm">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input */}
            <div>
              <label className="block text-sm font-semibold text-navy mb-3">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                  disabled={isLoading}
                  autoFocus
                />
              </div>
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
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-gold to-yellow-400 hover:from-gold-dark hover:to-yellow-500 disabled:from-gray-300 disabled:to-gray-300 text-navy font-bold py-3 rounded-lg transition-all transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader size={20} className="animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  Send Reset Link
                  <Mail size={20} />
                </>
              )}
            </button>
          </form>

          {/* Help Text */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-4">
              <strong>💡 Tip:</strong> Check your email (including spam folder) for the reset link. The link expires in 15 minutes.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Remember:</strong> We'll never ask for your password via email. Always verify you're on our official site.
              </p>
            </div>
          </div>

          {/* Login Link */}
          <p className="text-center text-sm text-gray-600 mt-8">
            Remember your password?{" "}
            <Link to="/login" className="text-gold font-semibold hover:text-gold-dark transition-colors">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
