import { useMemo, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, Lock, Save, ShieldCheck } from "lucide-react";
import api from "../api";

const INITIAL_STATE = {
  current_password: "",
  new_password: "",
  confirm_password: "",
};

const ChangePasswordCard = ({
  onNotice,
  endpoint = "/api/auth/password",
  fallbackEndpoint = null,
  title = "Change Password",
  description = "Update your password by confirming your current one.",
}) => {
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [security, setSecurity] = useState(INITIAL_STATE);

  const passwordStrength = useMemo(() => {
    const value = security.new_password;
    let score = 0;
    if (value.length >= 8) score += 1;
    if (/[A-Z]/.test(value)) score += 1;
    if (/[0-9]/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;
    return score;
  }, [security.new_password]);

  const showNotice = (message, type = "success") => {
    if (typeof onNotice === "function") {
      onNotice(message, type);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (security.new_password !== security.confirm_password) {
      showNotice("New password and confirmation do not match", "error");
      return;
    }

    if (security.current_password === security.new_password) {
      showNotice("New password must be different from current password", "error");
      return;
    }

    setSavingPassword(true);
    try {
      const payload = {
        current_password: security.current_password,
        new_password: security.new_password,
      };

      let res;
      try {
        res = await api.patch(endpoint, payload);
      } catch (error) {
        if (error?.response?.status === 404 && fallbackEndpoint) {
          res = await api.patch(fallbackEndpoint, payload);
        } else {
          throw error;
        }
      }

      showNotice(res.data?.message || "Password updated successfully");
      setSecurity(INITIAL_STATE);
    } catch (error) {
      showNotice(error.response?.data?.message || "Failed to update password", "error");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <section className="rounded-3xl border border-navy/10 bg-white p-6 sm:p-8 shadow-[0_10px_24px_rgba(12,35,64,0.06)]">
      <div className="flex items-center gap-2 mb-2">
        <KeyRound className="h-5 w-5 text-gold" />
        <h2 className="text-2xl font-heading text-charcoal">{title}</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">{description}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
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
  );
};

export default ChangePasswordCard;
