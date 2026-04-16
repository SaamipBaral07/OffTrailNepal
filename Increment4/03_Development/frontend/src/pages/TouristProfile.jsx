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
import { Loader2, Save, UserRound, Mail, Phone, Flag, CalendarDays, ArrowRight, Camera, Home } from "lucide-react";

const TouristProfile = () => {
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
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    nationality: "",
    profile_image_path: "",
    created_at: "",
  });
  const [photoUploading, setPhotoUploading] = useState(false);

  const showNotice = useCallback((message, type = "success") => {
    setNotice({ message, type });
    setTimeout(() => setNotice(null), 3500);
  }, []);

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const res = await api.get("/api/auth/tourist/profile");
      setForm({
        full_name: res.data.profile.full_name || "",
        email: res.data.profile.email || "",
        phone: res.data.profile.phone || "",
        nationality: res.data.profile.nationality || "",
        profile_image_path: res.data.profile.profile_image_path || "",
        created_at: res.data.profile.created_at || "",
      });
    } catch (err) {
      showNotice(err.response?.data?.message || "Could not load profile", "error");
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
    if (authUser.user_type !== "tourist") {
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

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const profileImageUrl = useMemo(() => {
    if (!form.profile_image_path) return "";
    if (String(form.profile_image_path).startsWith("http")) return form.profile_image_path;
    return `http://localhost:5000${form.profile_image_path}`;
  }, [form.profile_image_path]);

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
        nationality: form.nationality,
      };
      const res = await api.patch("/api/auth/tourist/profile", payload);

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

      showNotice("Profile updated successfully");
    } catch (err) {
      showNotice(err.response?.data?.message || "Failed to update profile", "error");
    } finally {
      setSaving(false);
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
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 rounded-lg border border-gold/30 bg-white px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/5 transition-all mb-3"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </button>
          <p className="uppercase text-[11px] tracking-[0.24em] text-gold-dark font-semibold mb-2">Tourist Space</p>
          <h1 className="text-3xl sm:text-4xl font-heading text-charcoal">My Profile</h1>
          <p className="text-gray-500 mt-2">Keep your traveler details updated for smoother bookings and host communication.</p>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <aside className="lg:col-span-4 rounded-3xl border border-navy/10 bg-gradient-to-b from-white via-[#fbfaf8] to-gold-pale/30 p-6 shadow-[0_10px_24px_rgba(12,35,64,0.06)] h-fit">
            <div className="relative h-20 w-20">
              {profileImageUrl ? (
                <img
                  src={profileImageUrl}
                  alt={form.full_name || "Tourist"}
                  className="h-20 w-20 rounded-2xl object-cover shadow-md ring-2 ring-gold/30"
                />
              ) : (
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-gold to-[#D4A43A] text-navy font-bold text-3xl flex items-center justify-center shadow-md">
                  {(form.full_name || "U").charAt(0).toUpperCase()}
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
              <h2 className="text-2xl font-heading text-charcoal leading-tight">{form.full_name || "Tourist"}</h2>
              <p className="text-sm text-gray-500 mt-1">{form.email}</p>
              <p className="text-xs text-gray-400 mt-2">{photoUploading ? "Uploading photo..." : "Tap camera icon to update photo"}</p>
            </div>

            <div className="mt-8 space-y-3.5 text-sm rounded-2xl border border-gold/15 bg-gradient-to-br from-white/80 to-gold-pale/40 p-4.5">
              <div className="flex items-center gap-3 text-gray-700">
                <CalendarDays className="h-4 w-4 text-gold flex-shrink-0" />
                <span>Member since <span className="font-semibold">{memberSince}</span></span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <Flag className="h-4 w-4 text-navy flex-shrink-0" />
                <span>{form.nationality || <span className="text-gray-400">Nationality not set</span>}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <Phone className="h-4 w-4 text-navy flex-shrink-0" />
                <span>{ form.phone || <span className="text-gray-400">Phone not set</span>}</span>
              </div>
            </div>

            <Link
              to="/my-settings"
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-navy hover:text-navy-light transition-colors"
            >
              Go to Settings <ArrowRight className="h-4 w-4" />
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
                    Nationality
                    <div className="mt-1 relative">
                      <Flag className="absolute left-3 top-3.5 h-4 w-4 text-gray-300" />
                      <input
                        type="text"
                        value={form.nationality}
                        onChange={(e) => onChange("nationality", e.target.value)}
                        required
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gold/40"
                      />
                    </div>
                  </label>
                </div>

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
              fallbackEndpoint="/api/auth/tourist/password"
              description="Update your account password for safer sign-ins across OffTrail Nepal."
            />
          </div>
        </div>
      </main>

      <Footer />
      <LogoutModal isOpen={showLogoutModal} onConfirm={handleLogout} onCancel={handleStayLoggedIn} />
    </div>
  );
};

export default TouristProfile;
