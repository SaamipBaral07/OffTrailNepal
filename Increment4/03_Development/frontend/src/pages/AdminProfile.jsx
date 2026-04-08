import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Loader2,
  ArrowLeft,
  Mail,
  CalendarDays,
  Shield,
  Camera,
  UserRound,
  LogOut,
} from "lucide-react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { getCsrfToken, getToken } from "../tokenStore";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import LogoutModal from "../components/LogoutModal";

const AdminProfile = () => {
  const navigate = useNavigate();
  const { user: authUser, loading, setAuth } = useAuth();
  const {
    handleLogout,
    handleStayLoggedIn,
    showLogoutModal,
    setShowLogoutModal,
  } = useLogoutHandler();

  const [profileLoading, setProfileLoading] = useState(true);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [profile, setProfile] = useState({
    id: "",
    full_name: "",
    email: "",
    profile_image_path: "",
    created_at: "",
  });

  const showNotice = useCallback((message, type = "success") => {
    setNotice({ message, type });
    setTimeout(() => setNotice(null), 3200);
  }, []);

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const res = await api.get("/api/auth/admin/profile");
      const nextProfile = res.data?.profile || {};
      setProfile({
        id: nextProfile.id || "",
        full_name: nextProfile.full_name || "",
        email: nextProfile.email || "",
        profile_image_path: nextProfile.profile_image_path || "",
        created_at: nextProfile.created_at || "",
      });
    } catch (error) {
      showNotice(error.response?.data?.message || "Could not load admin profile", "error");
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

    if (authUser.user_type !== "admin") {
      navigate("/", { replace: true });
      return;
    }

    fetchProfile();
  }, [loading, authUser, navigate, fetchProfile]);

  const memberSince = useMemo(() => {
    if (!profile.created_at) return "-";
    return new Date(profile.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [profile.created_at]);

  const profileImageUrl = useMemo(() => {
    if (!profile.profile_image_path) return "";
    if (String(profile.profile_image_path).startsWith("http")) {
      return profile.profile_image_path;
    }
    return `http://localhost:5000${profile.profile_image_path}`;
  }, [profile.profile_image_path]);

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
      const nextPath = res.data?.profile_image_path || "";

      setProfile((prev) => ({ ...prev, profile_image_path: nextPath }));
      setAuth(
        getToken(),
        {
          ...authUser,
          profile_image_path: nextPath,
        },
        getCsrfToken()
      );

      showNotice("Profile photo updated");
    } catch (error) {
      showNotice(error.response?.data?.message || "Failed to upload profile photo", "error");
    } finally {
      setPhotoUploading(false);
      event.target.value = "";
    }
  };

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="inline-flex items-center gap-3 text-gray-600 text-sm font-medium">
          <Loader2 className="h-5 w-5 animate-spin text-navy" />
          Loading admin profile...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-body">
      {notice && (
        <div
          className={`fixed top-6 right-5 z-[120] rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${
            notice.type === "error" ? "bg-red-600 text-white" : "bg-emerald-600 text-white"
          }`}
        >
          {notice.message}
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <Link
            to="/admin-dashboard"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:border-gold/50 hover:text-navy transition-colors font-semibold text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Admin Dashboard
          </Link>
          <button
            type="button"
            onClick={setShowLogoutModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-semibold text-sm"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>

        <section className="rounded-3xl border border-navy/10 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.08)] overflow-hidden">
          <div className="px-6 sm:px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-navy to-navy-light">
            <p className="uppercase text-[11px] tracking-[0.24em] text-gold/90 font-semibold mb-2">Admin Space</p>
            <h1 className="text-3xl font-heading font-bold text-white">Admin Profile</h1>
            <p className="text-white/70 mt-1 text-sm">View your administrator account details.</p>
          </div>

          <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <aside className="lg:col-span-4 rounded-2xl border border-gold/15 bg-gradient-to-b from-white via-[#fbfaf8] to-gold-pale/35 p-5 h-fit">
              <div className="relative h-20 w-20">
                {profileImageUrl ? (
                  <img
                    src={profileImageUrl}
                    alt={profile.full_name || "Admin"}
                    className="h-20 w-20 rounded-2xl object-cover shadow-md ring-2 ring-gold/30"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-gold to-[#D4A43A] text-navy font-bold text-3xl flex items-center justify-center shadow-md">
                    {(profile.full_name || "A").charAt(0).toUpperCase()}
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

              <h2 className="mt-4 text-2xl font-heading text-charcoal leading-tight">
                {profile.full_name || "Administrator"}
              </h2>
              <p className="text-sm text-gray-500 mt-1">{profile.email || "-"}</p>
              <p className="text-xs text-gray-400 mt-2">
                {photoUploading ? "Uploading photo..." : "Tap camera icon to update photo"}
              </p>
            </aside>

            <section className="lg:col-span-8 rounded-2xl border border-navy/10 bg-white p-5 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Full Name</p>
                  <p className="mt-1 text-sm font-semibold text-charcoal inline-flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-gold" />
                    {profile.full_name || "-"}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Email</p>
                  <p className="mt-1 text-sm font-semibold text-charcoal inline-flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gold" />
                    {profile.email || "-"}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Role</p>
                  <p className="mt-1 text-sm font-semibold text-charcoal inline-flex items-center gap-2">
                    <Shield className="h-4 w-4 text-gold" />
                    Administrator
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Admin ID</p>
                  <p className="mt-1 text-sm font-semibold text-charcoal">{profile.id || "-"}</p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:col-span-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Member Since</p>
                  <p className="mt-1 text-sm font-semibold text-charcoal inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-gold" />
                    {memberSince}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </section>
      </main>

      <LogoutModal
        isOpen={showLogoutModal}
        onConfirm={handleLogout}
        onCancel={handleStayLoggedIn}
      />
    </div>
  );
};

export default AdminProfile;
