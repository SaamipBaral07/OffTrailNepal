import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await axios.post(
        "http://localhost:5000/api/auth/login",
        { email, password },
        { withCredentials: true }
      );

      setAuth(res.data.token, res.data.user, res.data.csrfToken);

      setTimeout(() => {
        const userType = res.data.user.user_type;

        if (userType === "tourist") navigate("/");
        else if (userType === "host") navigate("/host-dashboard");
        else if (userType === "guide") navigate("/guide-dashboard");
        else if (userType === "admin") navigate("/admin-dashboard");
        else navigate("/login");
      }, 500);


    } catch (err) {
      setError(err.response?.data?.message || "Invalid credentials. Please try again.");
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
          <div className="relative w-32 h-32 mb-10">
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
          <h2 className="text-3xl font-extrabold text-white leading-tight mb-4 font-heading">
            Nepal's Premier<br />
            <span className="text-gold">Off-Trail</span> Platform
          </h2>
          <p className="text-white/55 text-sm leading-relaxed max-w-xs">
            Connect with expert local guides, discover uncharted paths, and
            experience the authentic beauty of the Himalayas.
          </p>
        </div>

        {/* Feature bullets */}
        <div className="relative z-10 space-y-3">
          {[
            "Verified local guides",
            "200+ curated trails",
            "24/7 emergency support",
            "5,000+ happy trekkers",
          ].map((text) => (
            <div key={text} className="flex items-center gap-3">
              <span
                className="flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "rgba(200,147,42,0.2)", color: "#C8932A" }}
              >
                ✓
              </span>
              <span className="text-white/65 text-sm">{text}</span>
            </div>
          ))}
        </div>

        {/* Quote */}
        <p className="relative z-10 text-white/25 text-xs italic leading-relaxed">
          "The mountains are calling, and I must go." — John Muir
        </p>
      </div>

      {/* ── Right Panel: Form ── */}
      <div className="flex-1 flex items-center justify-center bg-white p-6 sm:p-10">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gold/40 via-gold/20 to-gold/40 p-[2px]">
                <div className="h-full w-full rounded-full bg-white p-0.5">
                  <img
                    src="/offtrail-latest.png"
                    alt="OffTrail Nepal"
                    className="h-full w-full rounded-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>

          <h1 className="text-3xl font-extrabold text-navy mb-1.5 font-heading">
            Welcome back
          </h1>
          <p className="text-gray-500 text-sm mb-8">
            Sign in to continue your Himalayan journey
          </p>

          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5">
              <svg
                className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-all text-gray-900 placeholder-gray-400"
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-gold hover:text-gold-dark transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-all text-gray-900 placeholder-gray-400"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 font-bold text-navy rounded-xl hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              style={{
                background: "linear-gradient(135deg, #C8932A 0%, #E0B04A 100%)",
                boxShadow: "0 4px 15px rgba(200,147,42,0.35)",
              }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Sign In <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </button>
          </form>

          {/* Register link */}
          <p className="mt-8 text-center text-sm text-gray-500">
            New to OffTrail Nepal?{" "}
            <Link
              to="/register"
              className="font-semibold text-navy hover:text-gold transition-colors"
            >
              Create an account →
            </Link>
          </p>

          {/* Quote */}
          <p className="mt-10 text-center text-xs text-gray-400 italic border-t border-gray-100 pt-6">
            "The mountains are calling, and I must go." — John Muir
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;