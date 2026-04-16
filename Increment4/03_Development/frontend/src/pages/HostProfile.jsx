import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import LogoutModal from "../components/LogoutModal";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import { useAuth } from "../context/AuthContext";
import { getToken, getCsrfToken } from "../tokenStore";
import api from "../api";
import ChangePasswordCard from "../components/ChangePasswordCard";
import { Loader2, Save, UserRound, Mail, Phone, MapPin, CalendarDays, ArrowRight, Camera, BadgeCheck, Building2, CreditCard, X } from "lucide-react";

const HostProfile = () => {
  const navigate = useNavigate();
  const { user: authUser, loading, setAuth } = useAuth();
  const {
    handleLogout,
    handleStayLoggedIn,
    showLogoutModal,
    setShowLogoutModal,
  } = useLogoutHandler();

  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [bankForm, setBankForm] = useState({
    bank_name: "",
    bank_account_name: "",
    bank_account_number: "",
  });
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    address: "",
    pan_number: "",
    bank_name: "",
    bank_account_name: "",
    bank_account_number: "",
    profile_image_path: "",
    created_at: "",
  });

  const showNotice = useCallback((message, type = "success") => {
    setNotice({ message, type });
    setTimeout(() => setNotice(null), 3500);
  }, []);

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const res = await api.get("/api/auth/host/profile");
      setForm({
        full_name: res.data.profile.full_name || "",
        email: res.data.profile.email || "",
        phone: res.data.profile.phone || "",
        address: res.data.profile.address || "",
        pan_number: res.data.profile.pan_number || "",
        bank_name: res.data.profile.bank_name || "",
        bank_account_name: res.data.profile.bank_account_name || "",
        bank_account_number: res.data.profile.bank_account_number || "",
        profile_image_path: res.data.profile.profile_image_path || "",
        created_at: res.data.profile.created_at || "",
      });
      setBankForm({
        bank_name: res.data.profile.bank_name || "",
        bank_account_name: res.data.profile.bank_account_name || "",
        bank_account_number: res.data.profile.bank_account_number || "",
      });
    } catch (err) {
      showNotice(err.response?.data?.message || "Could not load host profile", "error");
    } finally {
      setProfileLoading(false);
    }
  }, [showNotice]);

  useEffect(() => {
    if (loading) return;
    if (!getToken() || !authUser) {
      navigate("/login", { replace: true });
      return;
    }
    if (authUser.user_type !== "host") {
      navigate("/", { replace: true });
      return;
    }
    fetchProfile();
  }, [loading, authUser, navigate, fetchProfile]);

  const memberSince = useMemo(() => {
    if (!form.created_at) return "-";
    return new Date(form.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [form.created_at]);

  const profileImageUrl = useMemo(() => {
    if (!form.profile_image_path) return "";
    if (String(form.profile_image_path).startsWith("http")) return form.profile_image_path;
    return `http://localhost:5000${form.profile_image_path}`;
  }, [form.profile_image_path]);

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleProfilePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!/^image\/(jpeg|jpg|png|webp)$/.test(file.type)) {
      showNotice("Please upload JPG, PNG, or WEBP image", "error");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showNotice("Image must be under 5MB", "error");
      event.target.value = "";
      return;
    }

    setPhotoUploading(true);
    try {
      const payload = new FormData();
      payload.append("profile_photo", file);

      const res = await api.patch("/api/auth/profile-photo", payload);
      const nextPath = res.data.profile_image_path || "";

      setForm((prev) => ({ ...prev, profile_image_path: nextPath }));
      setAuth(
        getToken(),
        {
          ...authUser,
          profile_image_path: nextPath,
        },
        getCsrfToken()
      );
      showNotice("Profile photo updated");
    } catch (err) {
      showNotice(err.response?.data?.message || "Failed to upload photo", "error");
    } finally {
      setPhotoUploading(false);
      event.target.value = "";
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        full_name: form.full_name,
        phone: form.phone,
        address: form.address,
        pan_number: form.pan_number,
      };
      const res = await api.patch("/api/auth/host/profile", payload);

      setAuth(
        getToken(),
        {
          ...authUser,
          full_name: res.data.profile.full_name,
          email: res.data.profile.email,
          profile_image_path: res.data.profile.profile_image_path || authUser?.profile_image_path || "",
        },
        getCsrfToken()
      );

      showNotice("Host profile updated successfully");
    } catch (err) {
      showNotice(err.response?.data?.message || "Failed to update host profile", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBankDetails = async (event) => {
    event.preventDefault();
    setBankSaving(true);
    try {
      const payload = {
        bank_name: bankForm.bank_name,
        bank_account_name: bankForm.bank_account_name,
        bank_account_number: bankForm.bank_account_number,
      };

      const res = await api.patch("/api/auth/host/bank-details", payload);

      setForm((prev) => ({
        ...prev,
        bank_name: res.data.profile.bank_name || "",
        bank_account_name: res.data.profile.bank_account_name || "",
        bank_account_number: res.data.profile.bank_account_number || "",
      }));

      setBankForm({
        bank_name: res.data.profile.bank_name || "",
        bank_account_name: res.data.profile.bank_account_name || "",
        bank_account_number: res.data.profile.bank_account_number || "",
      });

      setBankModalOpen(false);
      showNotice("Bank details updated successfully");
    } catch (err) {
      showNotice(err.response?.data?.message || "Failed to update bank details", "error");
    } finally {
      setBankSaving(false);
    }
  };

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f4f2ee] via-[#faf8f4] to-[#f2efe8]">
        <Header user={authUser} onLogoutClick={() => setShowLogoutModal(true)} />
        <div className="max-w-6xl mx-auto pt-32 px-6 pb-20 flex justify-center">
          <div className="inline-flex items-center gap-3 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading your profile...
          </div>
        </div>
      </div>
    );
  }

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
          <p className="uppercase text-[11px] tracking-[0.24em] text-gold-dark font-semibold mb-2">Host Space</p>
          <h1 className="text-3xl sm:text-4xl font-heading text-charcoal">My Profile</h1>
          <p className="text-gray-500 mt-2">Manage your host account details that are visible to guests.</p>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <aside className="lg:col-span-4 rounded-3xl border border-navy/10 bg-gradient-to-b from-white via-[#fbfaf8] to-gold-pale/30 p-6 shadow-[0_10px_24px_rgba(12,35,64,0.06)] h-fit">
            <div className="relative h-20 w-20">
              {profileImageUrl ? (
                <img
                  src={profileImageUrl}
                  alt={form.full_name || "Host"}
                  className="h-20 w-20 rounded-2xl object-cover shadow-md ring-2 ring-gold/30"
                />
              ) : (
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-gold to-[#D4A43A] text-navy font-bold text-3xl flex items-center justify-center shadow-md">
                  {(form.full_name || "H").charAt(0).toUpperCase()}
                </div>
              )}
              <label className="absolute -right-2 -bottom-2 h-8 w-8 rounded-full bg-navy text-white flex items-center justify-center cursor-pointer shadow-md hover:bg-navy-light transition-colors">
                <Camera className="h-4 w-4" />
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  onChange={handleProfilePhotoUpload}
                  className="hidden"
                  disabled={photoUploading}
                />
              </label>
            </div>
            
            <div className="mt-5">
              <h2 className="text-2xl font-heading text-charcoal leading-tight">{form.full_name || "Host"}</h2>
              <p className="text-sm text-gray-500 mt-1">{form.email}</p>
              <p className="text-xs text-gray-400 mt-2">{photoUploading ? "Uploading photo..." : "Tap camera icon to update photo"}</p>
            </div>

            <div className="mt-8 space-y-3.5 text-sm rounded-2xl border border-gold/15 bg-gradient-to-br from-white/80 to-gold-pale/40 p-4.5">
              <div className="flex items-center gap-3 text-gray-700">
                <CalendarDays className="h-4 w-4 text-gold flex-shrink-0" />
                <span>Member since <span className="font-semibold">{memberSince}</span></span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <MapPin className="h-4 w-4 text-navy flex-shrink-0" />
                <span>{form.address || <span className="text-gray-400">Address not set</span>}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <Phone className="h-4 w-4 text-navy flex-shrink-0" />
                <span>{form.phone || <span className="text-gray-400">Phone not set</span>}</span>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-navy/10 bg-white/85 p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-navy/70">Bank Details</p>
              {form.bank_name && form.bank_account_name && form.bank_account_number ? (
                <>
                  <p className="mt-2 text-sm font-semibold text-gray-800">{form.bank_name}</p>
                  <p className="text-xs text-gray-600">{form.bank_account_name}</p>
                  <p className="text-xs text-gray-500">A/C: {form.bank_account_number}</p>
                </>
              ) : (
                <p className="mt-2 text-xs text-gray-500">No bank details provided yet.</p>
              )}
              <button
                type="button"
                onClick={() => setBankModalOpen(true)}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-navy/20 bg-navy/5 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy/10"
              >
                <Building2 className="h-3.5 w-3.5" />
                Manage Bank Details
              </button>
            </div>

            <Link
              to="/host-dashboard"
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-navy hover:text-navy-light transition-colors"
            >
              Back to Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          </aside>

          <div className="lg:col-span-8 space-y-6">
            <section className="rounded-3xl border border-navy/10 bg-white p-6 sm:p-8 shadow-[0_10px_24px_rgba(12,35,64,0.06)]">
              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block text-sm font-semibold text-gray-700">
                  Full Name
                  <div className="mt-1 relative">
                    <UserRound className="absolute left-3 top-3.5 h-4 w-4 text-gray-300" />
                    <input
                      type="text"
                      value={form.full_name}
                      onChange={(e) => onChange("full_name", e.target.value)}
                      required
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gold/40"
                    />
                  </div>
                </label>

                <label className="block text-sm font-semibold text-gray-700">
                  Email (Read-only)
                  <div className="mt-1 relative">
                    <Mail className="absolute left-3 top-3.5 h-4 w-4 text-gray-300" />
                    <input
                      type="email"
                      value={form.email}
                      readOnly
                      className="w-full rounded-xl border border-gray-200 bg-gray-100 pl-10 pr-3 py-2.5 text-sm text-gray-500"
                    />
                  </div>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block text-sm font-semibold text-gray-700">
                    Phone Number
                    <div className="mt-1 relative">
                      <Phone className="absolute left-3 top-3.5 h-4 w-4 text-gray-300" />
                      <input
                        type="text"
                        value={form.phone}
                        onChange={(e) => onChange("phone", e.target.value)}
                        required
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gold/40"
                      />
                    </div>
                  </label>

                  <label className="block text-sm font-semibold text-gray-700">
                    PAN Number
                    <div className="mt-1 relative">
                      <BadgeCheck className="absolute left-3 top-3.5 h-4 w-4 text-gray-300" />
                      <input
                        type="text"
                        value={form.pan_number}
                        onChange={(e) => onChange("pan_number", e.target.value)}
                        required
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gold/40"
                      />
                    </div>
                  </label>
                </div>

                <label className="block text-sm font-semibold text-gray-700">
                  Address
                  <div className="mt-1 relative">
                    <MapPin className="absolute left-3 top-3.5 h-4 w-4 text-gray-300" />
                    <textarea
                      value={form.address}
                      onChange={(e) => onChange("address", e.target.value)}
                      rows={3}
                      required
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gold/40 resize-none"
                    />
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-[#D4A43A] px-5 py-2.5 text-sm font-bold text-navy shadow-md hover:shadow-lg disabled:opacity-70"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Save className="h-4 w-4" /> Save Changes
                </button>
              </form>
            </section>

            <ChangePasswordCard
              onNotice={showNotice}
              fallbackEndpoint="/api/auth/host/password"
              description="Change your host account password after confirming your current one."
            />
          </div>
        </div>
      </main>

      {bankModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/45" onClick={() => setBankModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Host Bank Details</h3>
                <p className="text-xs text-gray-500 mt-0.5">Provide account details for payouts and settlement.</p>
              </div>
              <button
                type="button"
                onClick={() => setBankModalOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBankDetails} className="px-6 py-5 space-y-4">
              <label className="block text-sm font-semibold text-gray-700">
                Nepali Bank Name
                <div className="mt-1 relative">
                  <Building2 className="absolute left-3 top-3.5 h-4 w-4 text-gray-300" />
                  <input
                    type="text"
                    value={bankForm.bank_name}
                    onChange={(e) => setBankForm((prev) => ({ ...prev, bank_name: e.target.value }))}
                    placeholder="e.g. Nabil Bank"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gold/40"
                  />
                </div>
              </label>

              <label className="block text-sm font-semibold text-gray-700">
                Account Name
                <div className="mt-1 relative">
                  <UserRound className="absolute left-3 top-3.5 h-4 w-4 text-gray-300" />
                  <input
                    type="text"
                    value={bankForm.bank_account_name}
                    onChange={(e) => setBankForm((prev) => ({ ...prev, bank_account_name: e.target.value }))}
                    placeholder="Account holder full name"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gold/40"
                  />
                </div>
              </label>

              <label className="block text-sm font-semibold text-gray-700">
                Account Number
                <div className="mt-1 relative">
                  <CreditCard className="absolute left-3 top-3.5 h-4 w-4 text-gray-300" />
                  <input
                    type="text"
                    value={bankForm.bank_account_number}
                    onChange={(e) => setBankForm((prev) => ({ ...prev, bank_account_number: e.target.value }))}
                    placeholder="Bank account number"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gold/40"
                  />
                </div>
              </label>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setBankModalOpen(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bankSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-[#D4A43A] px-4 py-2 text-sm font-bold text-navy disabled:opacity-70"
                >
                  {bankSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Bank Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
      <LogoutModal isOpen={showLogoutModal} onConfirm={handleLogout} onCancel={handleStayLoggedIn} />
    </div>
  );
};

export default HostProfile;
