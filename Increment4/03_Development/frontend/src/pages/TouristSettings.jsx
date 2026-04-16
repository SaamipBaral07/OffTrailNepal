import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import LogoutModal from "../components/LogoutModal";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import { useAuth } from "../context/AuthContext";
import { getToken } from "../tokenStore";
import api from "../api";
import { Bell, Eye, EyeOff, KeyRound, Loader2, Lock, Save, ShieldCheck, UserRound, Home } from "lucide-react";

const SETTINGS_KEY = "offtrail-tourist-settings";

const TouristSettings = () => {
  const navigate = useNavigate();
  const { user: authUser, loading } = useAuth();
  const {
    handleLogout,
    handleStayLoggedIn,
    showLogoutModal,
    setShowLogoutModal,
  } = useLogoutHandler();

  const [savingPassword, setSavingPassword] = useState(false);
  const [notice, setNotice] = useState(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [security, setSecurity] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [prefs, setPrefs] = useState({
    bookingUpdates: true,
    promotionalEmails: false,
    hostMessages: true,
  });

  const showNotice = useCallback((message, type = "success") => {
    setNotice({ message, type });
    setTimeout(() => setNotice(null), 3500);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!getToken() || !authUser) {
      navigate("/login", { replace: true });
      return;
    }
    if (authUser.user_type !== "tourist") {
      navigate("/", { replace: true });
      return;
    }

    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        setPrefs(JSON.parse(saved));
      } catch {
        // ignore malformed local settings
      }
    }
  }, [loading, authUser, navigate]);

  const passwordStrength = useMemo(() => {
    const value = security.new_password;
    let score = 0;
    if (value.length >= 8) score += 1;
    if (/[A-Z]/.test(value)) score += 1;
    if (/[0-9]/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;
    return score;
  }, [security.new_password]);

  const setPref = (key, value) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const savePreferences = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(prefs));
    showNotice("Preferences saved locally");
  };

  const updatePassword = async (event) => {
    event.preventDefault();
    if (security.new_password !== security.confirm_password) {
      showNotice("New password and confirmation do not match", "error");
      return;
    }

    setSavingPassword(true);
    try {
      const payload = {
        current_password: security.current_password,
        new_password: security.new_password,
      };

      try {
        await api.patch("/api/auth/password", payload);
      } catch (error) {
        if (error?.response?.status === 404) {
          await api.patch("/api/auth/tourist/password", payload);
        } else {
          throw error;
        }
      }

      showNotice("Password updated successfully");
      setSecurity({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      showNotice(err.response?.data?.message || "Failed to update password", "error");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f4f2ee] via-[#faf8f4] to-[#f2efe8] font-body">
      <Header user={authUser} onLogoutClick={() => setShowLogoutModal(true)} />

      {notice && (
        <div className={`fixed top-20 right-4 z-[100] rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${notice.type === "error" ? "bg-red-600 text-white" : "bg-emerald-600 text-white"}`}>
          {notice.message}
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-20">
        <section className="rounded-3xl border border-gold/20 bg-white/95 shadow-[0_10px_30px_rgba(12,35,64,0.08)] p-6 sm:p-8 mb-6">
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 rounded-lg border border-gold/30 bg-white px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/5 transition-all mb-3"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </button>
          <p className="uppercase text-[11px] tracking-[0.24em] text-gold-dark font-semibold mb-2">Tourist Space</p>
          <h1 className="text-3xl sm:text-4xl font-heading text-charcoal">Settings</h1>
          <p className="text-gray-500 mt-2">Manage your security and personal preference controls.</p>
          <Link to="/my-profile" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-navy hover:text-navy-light">
            <UserRound className="h-4 w-4" /> Back to My Profile
          </Link>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-7 rounded-3xl border border-navy/10 bg-white p-6 sm:p-8 shadow-[0_10px_24px_rgba(12,35,64,0.06)]">
            <div className="flex items-center gap-2 mb-4">
              <KeyRound className="h-5 w-5 text-gold" />
              <h2 className="text-2xl font-heading text-charcoal">Password & Security</h2>
            </div>

            <form onSubmit={updatePassword} className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700">
                Current Password
                <div className="mt-1 relative">
                  <Lock className="absolute left-3 top-3.5 h-4 w-4 text-gray-300" />
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={security.current_password}
                    onChange={(e) => setSecurity((prev) => ({ ...prev, current_password: e.target.value }))}
                    required
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-10 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gold/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    className="absolute right-2 top-2.5 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <label className="block text-sm font-semibold text-gray-700">
                New Password
                <div className="mt-1 relative">
                  <ShieldCheck className="absolute left-3 top-3.5 h-4 w-4 text-gray-300" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={security.new_password}
                    onChange={(e) => setSecurity((prev) => ({ ...prev, new_password: e.target.value }))}
                    required
                    minLength={8}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-10 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gold/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-2 top-2.5 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <label className="block text-sm font-semibold text-gray-700">
                Confirm New Password
                <div className="mt-1 relative">
                  <ShieldCheck className="absolute left-3 top-3.5 h-4 w-4 text-gray-300" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={security.confirm_password}
                    onChange={(e) => setSecurity((prev) => ({ ...prev, confirm_password: e.target.value }))}
                    required
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-10 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gold/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-2 top-2.5 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-semibold text-gray-600 mb-2">Password strength</p>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={`h-2 rounded-full ${passwordStrength >= step ? "bg-emerald-500" : "bg-gray-200"}`}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={savingPassword}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-[#D4A43A] px-5 py-2.5 text-sm font-bold text-navy shadow-md hover:shadow-lg disabled:opacity-70"
              >
                {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Update Password
              </button>
            </form>
          </section>

          <section className="lg:col-span-5 rounded-3xl border border-navy/10 bg-white p-6 sm:p-8 shadow-[0_10px_24px_rgba(12,35,64,0.06)] h-fit">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="h-5 w-5 text-gold" />
              <h2 className="text-2xl font-heading text-charcoal">Preferences</h2>
            </div>

            <div className="space-y-4 text-sm text-gray-700">
              <label className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 p-3">
                <span>
                  <strong>Booking updates</strong>
                  <p className="text-xs text-gray-500 mt-1">Receive booking confirmations and schedule reminders.</p>
                </span>
                <input type="checkbox" checked={prefs.bookingUpdates} onChange={(e) => setPref("bookingUpdates", e.target.checked)} className="mt-1" />
              </label>

              <label className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 p-3">
                <span>
                  <strong>Host message alerts</strong>
                  <p className="text-xs text-gray-500 mt-1">Get notified when hosts contact you about your stay.</p>
                </span>
                <input type="checkbox" checked={prefs.hostMessages} onChange={(e) => setPref("hostMessages", e.target.checked)} className="mt-1" />
              </label>

              <label className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 p-3">
                <span>
                  <strong>Promotional emails</strong>
                  <p className="text-xs text-gray-500 mt-1">Occasional offers and curated destination inspiration.</p>
                </span>
                <input type="checkbox" checked={prefs.promotionalEmails} onChange={(e) => setPref("promotionalEmails", e.target.checked)} className="mt-1" />
              </label>
            </div>

            <button
              type="button"
              onClick={savePreferences}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-navy/20 bg-navy/5 px-4 py-2 text-sm font-semibold text-navy hover:bg-navy/10"
            >
              <Save className="h-4 w-4" /> Save Preferences
            </button>
          </section>
        </div>
      </main>

      <Footer />
      <LogoutModal isOpen={showLogoutModal} onConfirm={handleLogout} onCancel={handleStayLoggedIn} />
    </div>
  );
};

export default TouristSettings;
