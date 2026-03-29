import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import {
  LogOut,
  Compass,
  Plus,
  Pencil,
  Trash2,
  Users,
  Mountain,
  DollarSign,
  X,
  Loader2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Award,
  MapPin,
  Clock,
  TrendingUp,
  Activity,
  Calendar,
  Star,
  Package,
  CheckCircle2,
  AlertTriangle,
  Upload,
} from "lucide-react";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import LogoutModal from "../components/LogoutModal";
import { useAuth } from "../context/AuthContext";
import { getToken } from "../tokenStore";

const API = "http://localhost:5000/api";

const ExperienceBadge = ({ level }) => {
  const config = {
    beginner: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", label: "Beginner" },
    intermediate: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", label: "Intermediate" },
    expert: { bg: "bg-violet-50 border-violet-200", text: "text-violet-700", label: "Expert" },
  };
  const c = config[level] || config.beginner;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.text}`}>
      <Award className="h-3.5 w-3.5" />
      {c.label}
    </span>
  );
};

const StatCard = ({ icon: Icon, label, value, accent }) => {
  const accents = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    purple: "bg-violet-50 text-violet-600 border-violet-100",
  };
  return (
    <div className="relative bg-white rounded-2xl p-5 border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
      <div className={`inline-flex p-2.5 rounded-xl border ${accents[accent]} mb-3`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-bold text-gray-900 font-mono">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  );
};

const GuideDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { handleLogout, handleStayLoggedIn, showLogoutModal, setShowLogoutModal } = useLogoutHandler();
  const { user: authUser, loading } = useAuth();

  const [activeTab, setActiveTab] = useState("trails");

  // State
  const [trailsList, setTrailsList] = useState([]);
  const [myTrails, setMyTrails] = useState([]);
  const [services, setServices] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewsStats, setReviewsStats] = useState({ avg: 0, total: 0 });
  const [fetchingData, setFetchingData] = useState(false);
  const [verification, setVerification] = useState(null);
  const [verificationSubmitting, setVerificationSubmitting] = useState(false);

  // Forms State
  const [showTrailForm, setShowTrailForm] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingTrail, setEditingTrail] = useState(null);
  const [editingService, setEditingService] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const isGuideApproved = verification?.verification_status === "approved";
  const isGuidePending = verification?.verification_status === "pending";
  const isGuideRejected = verification?.verification_status === "rejected";

  useEffect(() => {
    if (loading) return;
    if (!getToken() || !authUser) { navigate("/login", { replace: true }); return; }
    if (authUser.user_type !== "guide") { navigate("/login", { replace: true }); return; }
    setUser(authUser);
    setIsLoading(false);
  }, [loading, navigate, authUser]);

  const fetchDashboardData = useCallback(async () => {
    setFetchingData(true);
    try {
      const [trailsAllRes, myTrailsRes, myServicesRes, myAvailRes, myReviewsRes, verificationRes] = await Promise.all([
        api.get(`${API}/guides/trails-list`),
        api.get(`${API}/guides/my-trails`),
        api.get(`${API}/guides/services`),
        api.get(`${API}/guides/availability`),
        api.get(`${API}/guides/reviews`),
        api.get(`${API}/guides/verification-status`)
      ]);
      setTrailsList(trailsAllRes.data.trails || []);
      setMyTrails(myTrailsRes.data.guide_trails || []);
      setServices(myServicesRes.data.services || []);
      setAvailability(myAvailRes.data.availability || []);
      setReviews(myReviewsRes.data.reviews || []);
      setVerification(verificationRes.data.verification || null);
      setReviewsStats({
        avg: myReviewsRes.data.stats?.avg_rating || 0,
        total: myReviewsRes.data.stats?.total_reviews || 0,
      });
    } catch (err) {
      console.error("Dashboard Data Fetch Error:", err);
    } finally {
      setFetchingData(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && user) fetchDashboardData();
  }, [isLoading, user, fetchDashboardData]);

  // --- TRAIL CRUD ---
  const handleTrailSubmit = async (formData) => {
    setFormSubmitting(true);
    try {
      if (editingTrail) {
        await api.put(`${API}/guides/trails/${editingTrail.id}`, formData);
      } else {
        await api.post(`${API}/guides/trails`, formData);
      }
      await fetchDashboardData();
      setShowTrailForm(false);
      setEditingTrail(null);
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to save trail assignment";
      alert(msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleTrailActive = async (id, currentStatus) => {
    try {
      await api.patch(`${API}/guides/trails/${id}/toggle-active`, { is_active: !currentStatus });
      setMyTrails((prev) => prev.map((t) => (t.id === id ? { ...t, is_active: !currentStatus } : t)));
    } catch (err) {
      console.error(err);
      alert("Failed to toggle status");
    }
  };

  const handleDeleteTrail = async (id) => {
    if (!window.confirm("Delete this trail assignment? Services attached to this trail will also be deleted.")) return;
    try {
      await api.delete(`${API}/guides/trails/${id}`);
      setMyTrails((prev) => prev.filter((t) => t.id !== id));
      setServices((prev) => prev.filter((s) => s.guide_trail_id !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to delete trail.");
    }
  };

  // --- SERVICE CRUD ---
  const handleServiceSubmit = async (formData) => {
    setFormSubmitting(true);
    try {
      if (editingService) {
        await api.put(`${API}/guides/services/${editingService.service_id}`, formData);
      } else {
        await api.post(`${API}/guides/services`, formData);
      }
      await fetchDashboardData();
      setShowServiceForm(false);
      setEditingService(null);
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to save service package";
      alert(msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleServiceActive = async (id, currentStatus) => {
    try {
      await api.patch(`${API}/guides/services/${id}/toggle-active`, { is_active: !currentStatus });
      setServices((prev) => prev.map((s) => (s.service_id === id ? { ...s, is_active: !currentStatus } : s)));
    } catch (err) {
      console.error(err);
      alert("Failed to toggle service status");
    }
  };

  const handleDeleteService = async (id) => {
    if (!window.confirm("Delete this service package?")) return;
    try {
      await api.delete(`${API}/guides/services/${id}`);
      setServices((prev) => prev.filter((s) => s.service_id !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to delete service.");
    }
  };

  const handleVerificationSubmit = async (e) => {
    e.preventDefault();
    const citizenshipFile = e.target.citizenship_image.files[0];
    const licenseFile = e.target.guide_license_image.files[0];

    if (!verification && (!citizenshipFile || !licenseFile)) {
      alert("Please upload both citizenship and guide license images.");
      return;
    }

    setVerificationSubmitting(true);
    try {
      const formData = new FormData();
      if (citizenshipFile) formData.append("citizenship_image", citizenshipFile);
      if (licenseFile) formData.append("guide_license_image", licenseFile);

      await api.post(`${API}/guides/verification-docs`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      await fetchDashboardData();
      e.target.reset();
      alert("Verification documents submitted successfully.");
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to submit verification documents";
      alert(msg);
    } finally {
      setVerificationSubmitting(false);
    }
  };

  // --- AVAILABILITY ---
  const handleToggleAvailability = async (e) => {
    e.preventDefault();
    const dateInput = e.target.date.value;
    const isBusyInput = e.target.is_busy.checked;
    try {
      await api.post(`${API}/guides/availability`, { date: dateInput, is_available: !isBusyInput });
      await fetchDashboardData();
      e.target.reset();
    } catch (err) {
      alert("Failed to mark availability");
    }
  };

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 fixed inset-y-0 shadow-sm">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-md">
            <Compass className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-gray-900 font-bold text-sm leading-none">OffTrailNepal</p>
            <p className="text-gray-400 text-xs mt-0.5">Guide Console</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-widest">Management</p>
          {[
            { id: "trails", label: "My Trails", icon: Mountain },
            { id: "services", label: "My Services", icon: Package },
            { id: "availability", label: "Availability", icon: Calendar },
            { id: "reviews", label: "Reviews", icon: Star }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id
                  ? "bg-indigo-50 text-indigo-600 border border-indigo-100"
                  : "text-gray-600 hover:bg-gray-50"
                }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
              {user?.full_name?.charAt(0) || "G"}
            </div>
            <div className="min-w-0">
              <p className="text-gray-900 text-sm font-semibold truncate">{user?.full_name}</p>
              <p className="text-gray-400 text-xs">Trekking Guide</p>
            </div>
          </div>
          <button
            onClick={setShowLogoutModal}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 rounded-xl text-sm font-medium transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div>
            <h1 className="text-gray-900 font-bold text-xl tracking-tight capitalize">
              {activeTab === 'trails' ? 'My Trail Assignments' : activeTab}
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Manage your marketplace visibility</p>
          </div>

          <div className="lg:hidden flex gap-2">
            {[
              { id: "trails", icon: Mountain },
              { id: "services", icon: Package },
              { id: "availability", icon: Calendar },
              { id: "reviews", icon: Star }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`p-2 rounded-xl transition ${activeTab === tab.id ? "bg-indigo-50 text-indigo-600" : "text-gray-400 hover:bg-gray-100"}`}
              >
                <tab.icon className="h-5 w-5" />
              </button>
            ))}
            <button
              onClick={setShowLogoutModal}
              className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition ml-2 border-l border-gray-200"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 space-y-6">
          {!isGuideApproved && (
            <div className={`rounded-2xl border p-5 ${isGuideRejected ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
              <div className="flex items-start gap-3 mb-4">
                {isGuideRejected ? (
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                ) : (
                  <Upload className="h-5 w-5 text-amber-600 mt-0.5" />
                )}
                <div>
                  <h2 className={`font-semibold ${isGuideRejected ? "text-red-800" : "text-amber-800"}`}>
                    {isGuidePending
                      ? "Guide verification is under review"
                      : isGuideRejected
                        ? "Verification was rejected"
                        : "Submit identity documents to get verified"}
                  </h2>
                  <p className={`text-sm mt-1 ${isGuideRejected ? "text-red-700" : "text-amber-700"}`}>
                    You can only create trail listings and service packages after admin approval.
                  </p>
                  {isGuideRejected && verification?.rejection_reason && (
                    <p className="text-sm mt-2 text-red-700">
                      Rejection reason: {verification.rejection_reason}
                    </p>
                  )}
                </div>
              </div>

              <form onSubmit={handleVerificationSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Citizenship Photo</label>
                  <input
                    type="file"
                    name="citizenship_image"
                    accept="image/png,image/jpeg,image/webp"
                    className="block w-full text-sm text-gray-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-white file:text-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Guide License Photo</label>
                  <input
                    type="file"
                    name="guide_license_image"
                    accept="image/png,image/jpeg,image/webp"
                    className="block w-full text-sm text-gray-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-white file:text-gray-700"
                  />
                </div>
                <button
                  type="submit"
                  disabled={verificationSubmitting}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold"
                >
                  {verificationSubmitting ? "Submitting..." : verification ? "Resubmit Documents" : "Submit Documents"}
                </button>
              </form>
            </div>
          )}

          {isGuideApproved && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-800">
                Your guide verification is approved. You can create and manage listings.
              </p>
            </div>
          )}

          {activeTab === "trails" && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Mountain} label="Assigned Trails" value={myTrails.length} accent="blue" />
                <StatCard icon={Activity} label="Active Trails" value={myTrails.filter(t => t.is_active).length} accent="emerald" />
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h2 className="text-gray-900 font-semibold text-base">Your Base Trails</h2>
                  <button
                    onClick={() => { setEditingTrail(null); setShowTrailForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition"
                    disabled={!isGuideApproved}
                  >
                    <Plus className="h-4 w-4" /> Add Trail
                  </button>
                </div>

                <div className="p-6">
                  {fetchingData ? (
                    <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
                  ) : myTrails.length === 0 ? (
                    <div className="text-center py-12">
                      <Mountain className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No trails assigned yet.</p>
                      <p className="text-sm text-gray-400">Click Add Trail to list yourself.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {myTrails.map(t => (
                        <div key={t.id} className={`border rounded-2xl p-5 relative transition ${t.is_active ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-75'}`}>
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-bold text-gray-900 text-lg">{t.trail_name}</h3>
                              <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><MapPin className="h-3.5 w-3.5" /> {t.region}</p>
                            </div>
                            <ExperienceBadge level={t.experience_level} />
                          </div>

                          <div className="flex items-center gap-1 mb-4">
                            <DollarSign className="h-4 w-4 text-emerald-500" />
                            <span className="text-2xl font-bold font-mono text-gray-900">{Number(t.price_per_day).toLocaleString()}</span>
                            <span className="text-xs text-gray-500 font-medium ml-1">NPR / day</span>
                          </div>

                          <div className="flex gap-2 pt-4 border-t border-gray-100">
                            <button
                              onClick={() => handleToggleTrailActive(t.id, t.is_active)}
                              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold ${t.is_active ? 'border-gray-200 text-gray-600 hover:bg-gray-50' : 'bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-100'}`}
                            >
                              {t.is_active ? <><EyeOff className="h-3.5 w-3.5" /> Deactivate</> : <><Eye className="h-3.5 w-3.5" /> Activate</>}
                            </button>
                            <button
                              onClick={() => { setEditingTrail(t); setShowTrailForm(true); }}
                              className="px-3 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTrail(t.id)}
                              className="px-3 py-2 border border-red-100 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === "services" && (
            <>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h2 className="text-gray-900 font-semibold text-base">Service Packages</h2>
                  <button
                    onClick={() => { setEditingService(null); setShowServiceForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition"
                    disabled={myTrails.length === 0 || !isGuideApproved}
                  >
                    <Plus className="h-4 w-4" /> Add Package
                  </button>
                </div>

                <div className="p-6">
                  {!isGuideApproved ? (
                    <div className="text-center py-10 bg-amber-50 rounded-xl border border-amber-100">
                      <p className="text-amber-700 font-medium">Guide verification approval is required first.</p>
                      <p className="text-xs text-amber-600 mt-1">Submit your citizenship and guide license documents above and wait for admin approval.</p>
                    </div>
                  ) : myTrails.length === 0 ? (
                    <div className="text-center py-10 bg-amber-50 rounded-xl border border-amber-100">
                      <p className="text-amber-700 font-medium">Assign yourself to a trail first.</p>
                      <p className="text-xs text-amber-600 mt-1">You must be linked to a Trail within "My Trails" before offering packages.</p>
                    </div>
                  ) : services.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No service packages created.</p>
                      <p className="text-sm text-gray-400">Stand out to tourists by creating specific service packages (e.g. "Photography Trek", "Budget Porter").</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {services.map(s => (
                        <div key={s.service_id} className={`border rounded-2xl p-5 flex flex-col transition ${s.is_active ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-75'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-gray-900 text-lg">{s.title}</h3>
                            <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-600 rounded-lg">{s.trail_name}</span>
                          </div>
                          <p className="text-sm text-gray-500 mb-4 line-clamp-2 flex-1">{s.description}</p>

                          <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4 text-emerald-500" />
                              <span className="font-bold font-mono text-gray-900">{Number(s.price_per_day).toLocaleString()}</span>
                              <span className="text-xs text-gray-500 font-medium ml-1">/ day</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">
                              <Users className="h-3.5 w-3.5" /> Up to {s.max_group_size}
                            </div>
                          </div>

                          <div className="flex gap-2 pt-4 border-t border-gray-100">
                            <button
                              onClick={() => handleToggleServiceActive(s.service_id, s.is_active)}
                              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold ${s.is_active ? 'border-gray-200 text-gray-600 hover:bg-gray-50' : 'bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-100'}`}
                            >
                              {s.is_active ? <><EyeOff className="h-3.5 w-3.5" /> Deactivate</> : <><Eye className="h-3.5 w-3.5" /> Activate</>}
                            </button>
                            <button
                              onClick={() => { setEditingService(s); setShowServiceForm(true); }}
                              className="px-3 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteService(s.service_id)}
                              className="px-3 py-2 border border-red-100 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === "availability" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-xl bg-orange-50 border border-orange-100">
                    <Calendar className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <h2 className="text-gray-900 font-semibold text-base">Manage Availability</h2>
                    <p className="text-gray-400 text-xs">Mark days when you are booked or on leave</p>
                  </div>
                </div>

                <form onSubmit={handleToggleAvailability} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Select Date</label>
                    <input
                      type="date"
                      name="date"
                      required
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" name="is_busy" className="w-5 h-5 accent-indigo-600" defaultChecked />
                    <span className="text-sm font-medium text-gray-700">Mark as Busy / Booked</span>
                  </label>
                  <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl">Save Status</button>
                </form>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-gray-900 font-semibold text-base mb-4">Upcoming Marked Dates</h2>

                {availability.length === 0 ? (
                  <p className="text-sm text-gray-500 py-10 text-center bg-gray-50 rounded-xl border border-gray-100">No dates marked. You are available everyday!</p>
                ) : (
                  <div className="space-y-2">
                    {availability.map((a, i) => (
                      <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${!a.is_available ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                        <div className="flex items-center gap-3 text-sm font-bold text-gray-800">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          {new Date(a.available_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${!a.is_available ? 'text-red-700 bg-red-100' : 'text-emerald-700 bg-emerald-100'}`}>
                          {!a.is_available ? "Busy" : "Available"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "reviews" && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-6 mb-8 border-b border-gray-100 pb-6">
                <div className="flex items-center justify-center bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-4 shadow-lg shadow-amber-200">
                  <div className="text-center text-white">
                    <p className="text-4xl font-bold font-mono">{reviewsStats.avg}</p>
                    <div className="flex gap-0.5 mt-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star key={star} className={`h-3 w-3 ${star <= Math.round(reviewsStats.avg) ? "fill-white text-white" : "text-white/30"}`} />
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Your Rating</h2>
                  <p className="text-gray-500">Based on {reviewsStats.total} total reviews from tourists.</p>
                </div>
              </div>

              {reviews.length === 0 ? (
                <div className="text-center py-12">
                  <Star className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No reviews yet.</p>
                  <p className="text-sm text-gray-400">Complete treks to earn reviews!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map(r => (
                    <div key={r.review_id} className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                            {r.reviewer_name?.charAt(0) || "T"}
                          </div>
                          <p className="font-semibold text-gray-900 text-sm">{r.reviewer_name || "Tourist"}</p>
                        </div>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(star => (
                            <Star key={star} className={`h-3 w-3 ${star <= r.rating ? "fill-amber-400 text-amber-400" : "text-gray-300 fill-gray-100"}`} />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">{r.comment}</p>
                      <p className="text-xs text-gray-400 mt-3 text-right">
                        {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {(!isLoading && showTrailForm) && (
        <TrailForm
          trails={trailsList}
          onSubmit={handleTrailSubmit}
          onCancel={() => setShowTrailForm(false)}
          initialData={editingTrail}
          isSubmitting={formSubmitting}
        />
      )}

      {(!isLoading && showServiceForm) && (
        <ServiceForm
          myTrails={myTrails}
          onSubmit={handleServiceSubmit}
          onCancel={() => setShowServiceForm(false)}
          initialData={editingService}
          isSubmitting={formSubmitting}
        />
      )}

      <LogoutModal isOpen={showLogoutModal} onConfirm={handleLogout} onCancel={handleStayLoggedIn} />
    </div>
  );
};

// ================= TRAIL FORM COMPONENT =================
const TrailForm = ({ trails, onSubmit, onCancel, initialData, isSubmitting }) => {
  const [form, setForm] = useState({
    trail_id: initialData?.trail_id || "",
    price_per_day: initialData?.price_per_day || "",
    experience_level: initialData?.experience_level || "",
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleSubmit = (e) => { e.preventDefault(); onSubmit(form); };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-white rounded-t-2xl">
          <h2 className="text-xl font-bold text-gray-900">{initialData ? "Edit Trail Assignment" : "Add Trail"}</h2>
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-xl transition"><X className="h-5 w-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {!initialData && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Trail</label>
              <select name="trail_id" value={form.trail_id} onChange={handleChange} required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500">
                <option value="">Select a trail...</option>
                {trails.map(t => <option key={t.trail_id} value={t.trail_id}>{t.trail_name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Price Per Day (NPR)</label>
            <input type="number" name="price_per_day" value={form.price_per_day} onChange={handleChange} required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Experience Level</label>
            <select name="experience_level" value={form.experience_level} onChange={handleChange} required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500">
              <option value="">Select level...</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="expert">Expert</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onCancel} className="flex-1 px-4 py-2.5 border rounded-xl font-semibold">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold">
              {isSubmitting ? "Saving..." : "Save Trail"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ================= SERVICE FORM COMPONENT =================
const ServiceForm = ({ myTrails, onSubmit, onCancel, initialData, isSubmitting }) => {
  const [form, setForm] = useState({
    trail_id: initialData?.trail_id || "",
    title: initialData?.title || "",
    description: initialData?.description || "",
    price_per_day: initialData?.price_per_day || "",
    max_group_size: initialData?.max_group_size || 1,
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleSubmit = (e) => { e.preventDefault(); onSubmit(form); };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-white rounded-t-2xl">
          <h2 className="text-xl font-bold text-gray-900">{initialData ? "Edit Package" : "Create Package"}</h2>
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-xl transition"><X className="h-5 w-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {!initialData && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">For Assigned Trail</label>
              <select name="trail_id" value={form.trail_id} onChange={handleChange} required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500">
                <option value="">Select assigned trail...</option>
                {myTrails.map(t => <option key={t.trail_id} value={t.trail_id}>{t.trail_name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Package Title</label>
            <input type="text" name="title" value={form.title} onChange={handleChange} required placeholder="e.g. Photography Trek" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Daily Price (NPR)</label>
              <input type="number" name="price_per_day" value={form.price_per_day} onChange={handleChange} required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Max Group Size</label>
              <input type="number" name="max_group_size" value={form.max_group_size} onChange={handleChange} required min="1" max="15" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} required rows={3} placeholder="Describe what is included..." className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none"></textarea>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onCancel} className="flex-1 px-4 py-2.5 border rounded-xl font-semibold">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold">
              {isSubmitting ? "Saving..." : "Save Package"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GuideDashboard;
