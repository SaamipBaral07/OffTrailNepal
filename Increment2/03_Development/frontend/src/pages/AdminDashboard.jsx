import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import {
  LogOut,
  Shield,
  Plus,
  Pencil,
  Trash2,
  Mountain,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
  Upload,
  Image,
  FileText,
  Loader2,
  Phone,
  DollarSign,
  Star,
  Compass,
  Briefcase,
  BarChart3,
  TrendingUp,
  Users,
  Activity,
  Home,
  CheckCircle,
  XCircle,
  Eye,
  Mail,
} from "lucide-react";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import LogoutModal from "../components/LogoutModal";
import { useAuth } from "../context/AuthContext";
import { getToken } from "../tokenStore";

const API = "http://localhost:5000/api";

/* ─────────────────────────────────────────
   STAT CARD (Light theme)
───────────────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, accent }) => {
  const accents = {
    blue: { bg: "bg-blue-50", icon: "bg-blue-500", text: "text-blue-600" },
    emerald: { bg: "bg-emerald-50", icon: "bg-emerald-500", text: "text-emerald-600" },
    violet: { bg: "bg-violet-50", icon: "bg-violet-500", text: "text-violet-600" },
    amber: { bg: "bg-amber-50", icon: "bg-amber-500", text: "text-amber-600" },
  };
  const a = accents[accent];
  return (
    <div className={`relative ${a.bg} rounded-2xl p-5 border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-shadow`}>
      <div className={`inline-flex p-2.5 rounded-xl ${a.icon} mb-3`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <p className={`text-2xl font-bold ${a.text} font-mono`}>{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  );
};

/* ─────────────────────────────────────────
   STATUS BADGE
───────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const config = {
    pending: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", dot: "bg-amber-400", label: "Pending" },
    approved: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-400", label: "Approved" },
    rejected: { bg: "bg-red-50 border-red-200", text: "text-red-700", dot: "bg-red-400", label: "Rejected" },
  };
  const c = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
};

/* ─────────────────────────────────────────
   ADMIN DASHBOARD
───────────────────────────────────────── */
const AdminDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { handleLogout, handleStayLoggedIn, showLogoutModal, setShowLogoutModal } =
    useLogoutHandler();
  const { user: authUser, loading } = useAuth();

  const [trails, setTrails] = useState([]);
  const [trailsLoading, setTrailsLoading] = useState(false);
  const [expandedTrail, setExpandedTrail] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTrail, setEditingTrail] = useState(null);
  const [activeTab, setActiveTab] = useState("trails");
  // Homestays for admin approval
  const [homestaysAdmin, setHomestaysAdmin] = useState([]);
  const [homestaysLoading, setHomestaysLoading] = useState(false);
  const [expandedHomestay, setExpandedHomestay] = useState(null);
  // Guides for admin view
  const [guidesAdmin, setGuidesAdmin] = useState([]);
  const [guidesLoading, setGuidesLoading] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!getToken() || !authUser) { navigate("/login", { replace: true }); return; }
    if (authUser.user_type !== "admin") { navigate("/login", { replace: true }); return; }
    setUser(authUser);
    setIsLoading(false);
  }, [loading, navigate, authUser]);

  const fetchTrails = useCallback(async () => {
    setTrailsLoading(true);
    try {
      const res = await api.get(`${API}/trails`);
      setTrails(res.data.trails);
    } catch (err) {
      console.error("Error fetching trails:", err);
    } finally {
      setTrailsLoading(false);
    }
  }, []);

  const fetchAdminHomestays = useCallback(async () => {
    setHomestaysLoading(true);
    try {
      const res = await api.get(`${API}/homestays/admin/all`);
      setHomestaysAdmin(res.data.homestays);
    } catch (err) {
      console.error("Error fetching homestays for admin:", err);
    } finally {
      setHomestaysLoading(false);
    }
  }, []);

  const fetchAdminGuides = useCallback(async () => {
    setGuidesLoading(true);
    try {
      const res = await api.get(`${API}/guides/admin/all`);
      setGuidesAdmin(res.data.guides);
    } catch (err) {
      console.error("Error fetching guides for admin:", err);
    } finally {
      setGuidesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && user) {
      fetchTrails();
      fetchAdminHomestays();
      fetchAdminGuides();
    }
  }, [isLoading, user, fetchTrails, fetchAdminHomestays, fetchAdminGuides]);

  const handleHomestayStatus = async (id, status) => {
    try {
      await api.patch(`${API}/homestays/admin/${id}/status`, { verified_status: status });
      fetchAdminHomestays();
    } catch (err) {
      console.error("Error updating homestay status:", err);
      alert("Failed to update status");
    }
  };

  const handleDeleteTrail = async (trailId) => {
    if (!window.confirm("Are you sure you want to delete this trail? This action cannot be undone."))
      return;
    try {
      await api.delete(`${API}/trails/${trailId}`);
      setTrails((prev) => prev.filter((t) => t.trail_id !== trailId));
    } catch (err) {
      console.error("Error deleting trail:", err);
      alert("Failed to delete trail");
    }
  };

  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
          <p className="text-gray-500 text-sm tracking-wide">Loading dashboard…</p>
        </div>
      </div>
    );

  const pendingHomestays = homestaysAdmin.filter((h) => h.verified_status === "pending").length;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 fixed inset-y-0 shadow-sm">
        {/* Brand */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-md">
              <Mountain className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-gray-900 font-bold text-sm leading-none">OffTrailNepal</p>
              <p className="text-gray-400 text-xs mt-0.5">Admin Console</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-1">
          <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Management
          </p>
          <button
            onClick={() => setActiveTab("trails")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === "trails"
                ? "bg-blue-50 text-blue-600 border border-blue-100"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Mountain className="h-4 w-4" />
            Trekking Trails
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === "trails" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500"
            }`}>
              {trails.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("homestays")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === "homestays"
                ? "bg-blue-50 text-blue-600 border border-blue-100"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Home className="h-4 w-4" />
            Homestay Approvals
            {pendingHomestays > 0 && (
              <span className="ml-auto bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                {pendingHomestays}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("guides")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === "guides"
                ? "bg-blue-50 text-blue-600 border border-blue-100"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Compass className="h-4 w-4" />
            Guides Management
          </button>
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {(user?.full_name || "A")[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-gray-900 text-sm font-semibold truncate">
                {user?.full_name || "Admin"}
              </p>
              <p className="text-gray-400 text-xs">Administrator</p>
            </div>
          </div>
          <button
            onClick={setShowLogoutModal}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 rounded-xl text-sm font-medium transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div>
            <h1 className="text-gray-900 font-bold text-xl tracking-tight">
              {activeTab === "trails" && "Trail Management"}
              {activeTab === "homestays" && "Homestay Approvals"}
              {activeTab === "guides" && "Guides Management"}
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-600 text-xs font-medium">System Online</span>
            </div>
            {/* Mobile nav buttons */}
            <div className="lg:hidden flex gap-2">
              <button
                onClick={() => setActiveTab("trails")}
                className={`p-2 rounded-xl transition ${activeTab === "trails" ? "bg-blue-50 text-blue-600" : "text-gray-400 hover:bg-gray-100"}`}
              >
                <Mountain className="h-5 w-5" />
              </button>
              <button
                onClick={() => setActiveTab("homestays")}
                className={`p-2 rounded-xl transition relative ${activeTab === "homestays" ? "bg-blue-50 text-blue-600" : "text-gray-400 hover:bg-gray-100"}`}
              >
                <Home className="h-5 w-5" />
                {pendingHomestays > 0 && (
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {pendingHomestays}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("guides")}
                className={`p-2 rounded-xl transition ${activeTab === "guides" ? "bg-blue-50 text-blue-600" : "text-gray-400 hover:bg-gray-100"}`}
              >
                <Compass className="h-5 w-5" />
              </button>
              <button
                onClick={setShowLogoutModal}
                className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 py-6 space-y-6">
          {/* Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Mountain} label="Total Trails" value={trails.length} accent="blue" />
            <StatCard icon={Home} label="Homestays" value={homestaysAdmin.length} accent="emerald" />
            <StatCard
              icon={TrendingUp}
              label="Pending Approvals"
              value={pendingHomestays}
              accent="amber"
            />
            <StatCard
              icon={BarChart3}
              label="Regions"
              value={new Set(trails.map((t) => t.region)).size}
              accent="violet"
            />
          </div>

          {/* ═══════════════════════════════════════════
              TRAILS TAB
          ═══════════════════════════════════════════ */}
          {activeTab === "trails" && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
              {/* Panel Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 border border-blue-100">
                    <Mountain className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-gray-900 font-semibold text-base">Trekking Trails</h2>
                    <p className="text-gray-400 text-xs">{trails.length} trails registered</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingTrail(null);
                    setShowCreateForm(!showCreateForm);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    showCreateForm
                      ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      : "bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white shadow-md shadow-blue-200"
                  }`}
                >
                  {showCreateForm ? (
                    <>
                      <X className="h-4 w-4" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      New Trail
                    </>
                  )}
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Forms */}
                {showCreateForm && (
                  <CreateTrailForm
                    onSuccess={() => {
                      setShowCreateForm(false);
                      fetchTrails();
                    }}
                    onCancel={() => setShowCreateForm(false)}
                  />
                )}

                {editingTrail && (
                  <EditTrailForm
                    trail={editingTrail}
                    onSuccess={() => {
                      setEditingTrail(null);
                      fetchTrails();
                    }}
                    onCancel={() => setEditingTrail(null)}
                  />
                )}

                {/* Trail Listing */}
                {trailsLoading ? (
                  <div className="flex flex-col items-center py-16 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    <p className="text-gray-400 text-sm">Loading trails…</p>
                  </div>
                ) : trails.length === 0 ? (
                  <div className="flex flex-col items-center py-20 gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                      <Mountain className="h-10 w-10 text-gray-300" />
                    </div>
                    <div className="text-center">
                      <p className="text-gray-700 font-semibold text-lg">No trails yet</p>
                      <p className="text-gray-400 text-sm mt-1">
                        Click "New Trail" to add your first trekking trail.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {trails.map((trail) => (
                      <TrailCard
                        key={trail.trail_id}
                        trail={trail}
                        isExpanded={expandedTrail === trail.trail_id}
                        onToggle={() =>
                          setExpandedTrail(
                            expandedTrail === trail.trail_id ? null : trail.trail_id
                          )
                        }
                        onEdit={() => {
                          setShowCreateForm(false);
                          setEditingTrail(trail);
                        }}
                        onDelete={() => handleDeleteTrail(trail.trail_id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════
              HOMESTAYS TAB
          ═══════════════════════════════════════════ */}
          {activeTab === "homestays" && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                    <Home className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div>
                    <h2 className="text-gray-900 font-semibold text-base">Homestay Listings</h2>
                    <p className="text-gray-400 text-xs">Review and manage homestays submitted by hosts</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {homestaysLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                ) : homestaysAdmin.length === 0 ? (
                  <div className="flex flex-col items-center py-20 gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                      <Home className="h-10 w-10 text-gray-300" />
                    </div>
                    <div className="text-center">
                      <p className="text-gray-700 font-semibold text-lg">No homestays to review</p>
                      <p className="text-gray-400 text-sm mt-1">
                        Homestays submitted by hosts will appear here for your approval.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {homestaysAdmin.map((h) => (
                      <HomestayCard
                        key={h.homestay_id}
                        homestay={h}
                        isExpanded={expandedHomestay === h.homestay_id}
                        onToggle={() =>
                          setExpandedHomestay(
                            expandedHomestay === h.homestay_id ? null : h.homestay_id
                          )
                        }
                        onApprove={() => handleHomestayStatus(h.homestay_id, "approved")}
                        onReject={() => handleHomestayStatus(h.homestay_id, "rejected")}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════
              GUIDES TAB
          ═══════════════════════════════════════════ */}
          {activeTab === "guides" && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 border border-blue-100">
                    <Compass className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-gray-900 font-semibold text-base">Registered Guides</h2>
                    <p className="text-gray-400 text-xs">Overview of all active trekking guides</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {guidesLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                ) : guidesAdmin.length === 0 ? (
                  <div className="flex flex-col items-center py-20 gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                      <Compass className="h-10 w-10 text-gray-300" />
                    </div>
                    <div className="text-center">
                      <p className="text-gray-700 font-semibold text-lg">No guides registered</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {guidesAdmin.map((g) => (
                      <div key={g.guide_id} className="bg-gray-50 border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                            {g.full_name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 leading-tight">{g.full_name}</h3>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                              <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                              {g.avg_rating > 0 ? `${g.avg_rating} (${g.total_reviews} reviews)` : "No reviews yet"}
                            </p>
                          </div>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center font-mono gap-2 text-sm text-gray-600">
                            <Briefcase className="h-4 w-4 text-gray-400" />
                            {g.experience_years} years experience
                          </div>
                          <div className="flex items-center font-mono gap-2 text-sm text-gray-600">
                            <Mail className="h-4 w-4 text-gray-400" />
                            {g.email}
                          </div>
                          <div className="flex items-center font-mono gap-2 text-sm text-gray-600">
                            <Phone className="h-4 w-4 text-gray-400" />
                            {g.phone}
                          </div>
                        </div>

                        <div className="flex pt-4 border-t border-gray-200 gap-4">
                          <div className="flex-1">
                            <p className="text-[10px] text-gray-400 uppercase font-semibold">Assigned Trails</p>
                            <p className="text-lg font-bold text-blue-600">{g.total_trails}</p>
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] text-gray-400 uppercase font-semibold">Services</p>
                            <p className="text-lg font-bold text-emerald-600">{g.total_services}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      <LogoutModal
        isOpen={showLogoutModal}
        onConfirm={handleLogout}
        onCancel={handleStayLoggedIn}
      />
    </div>
  );
};

/* ─────────────────────────────────────────
   HOMESTAY CARD (Admin view)
───────────────────────────────────────── */
const HomestayCard = ({ homestay: h, isExpanded, onToggle, onApprove, onReject }) => {
  const primaryImage = h.images?.find((img) => img.is_primary) || h.images?.[0];

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden hover:border-gray-300 transition-all">
      {/* Header row */}
      <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={onToggle}>
        {/* Thumbnail */}
        <div className="w-20 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-200">
          {primaryImage ? (
            <img src={`http://localhost:5000${primaryImage.image_path}`} alt={h.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Home className="h-6 w-6 text-gray-300" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-gray-900 font-semibold text-base truncate">{h.name}</h3>
            <StatusBadge status={h.verified_status} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {h.location}
            </span>
            <span className="flex items-center gap-1">
              <Mountain className="h-3.5 w-3.5" />
              {h.trail_name}
            </span>
            <span className="flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              NPR {Number(h.price_per_night).toLocaleString()}/night
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {h.verified_status === "pending" ? (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onApprove(); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
              >
                <CheckCircle className="h-4 w-4" />
                Approve
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onReject(); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </button>
            </>
          ) : (
            <StatusBadge status={h.verified_status} />
          )}
          <div className="ml-1 text-gray-400">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-gray-200 px-5 pb-5 pt-4 space-y-5 bg-white">
          {/* Host info */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-2">Host Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Users className="h-4 w-4 text-blue-400" />
                <span className="font-medium">{h.host_name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Mail className="h-4 w-4 text-blue-400" />
                {h.host_email}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Phone className="h-4 w-4 text-blue-400" />
                {h.host_phone}
              </div>
            </div>
          </div>

          {/* Homestay details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Price/Night</p>
              <p className="text-lg font-bold text-gray-900">NPR {Number(h.price_per_night).toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Max Guests</p>
              <p className="text-lg font-bold text-gray-900">{h.max_guests}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Trail</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{h.trail_name}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Region</p>
              <p className="text-sm font-semibold text-gray-900">{h.region}</p>
            </div>
          </div>

          {/* Description */}
          {h.description && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Description</p>
              <p className="text-gray-600 text-sm leading-relaxed">{h.description}</p>
            </div>
          )}

          {/* Amenities */}
          {h.amenities && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Amenities</p>
              <div className="flex flex-wrap gap-2">
                {(typeof h.amenities === "string" ? h.amenities.split(",") : Array.isArray(h.amenities) ? h.amenities : []).map((a, i) => (
                  <span key={i} className="px-3 py-1 bg-gray-50 border border-gray-200 rounded-full text-xs text-gray-600 font-medium">
                    {String(a).trim()}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Images */}
          {h.images?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Photos</p>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {h.images.map((img) => (
                  <div
                    key={img.image_id}
                    className={`w-36 h-24 rounded-xl overflow-hidden flex-shrink-0 ${
                      img.is_primary ? "ring-2 ring-blue-500" : "ring-1 ring-gray-200"
                    }`}
                  >
                    <img
                      src={`http://localhost:5000${img.image_path}`}
                      alt="Homestay"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer actions for pending */}
          {h.verified_status === "pending" && (
            <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={onApprove}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
              >
                <CheckCircle className="h-4 w-4" />
                Approve Homestay
              </button>
              <button
                onClick={onReject}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
              >
                <XCircle className="h-4 w-4" />
                Reject Homestay
              </button>
            </div>
          )}

          <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
            Submitted: {new Date(h.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
            {h.updated_at && ` · Updated: ${new Date(h.updated_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`}
          </p>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────
   TRAIL CARD (Light theme)
───────────────────────────────────────── */
const difficultyConfig = {
  Easy: { classes: "bg-emerald-50 text-emerald-600 border border-emerald-200", dot: "bg-emerald-400" },
  Moderate: { classes: "bg-amber-50 text-amber-600 border border-amber-200", dot: "bg-amber-400" },
  Difficult: { classes: "bg-orange-50 text-orange-600 border border-orange-200", dot: "bg-orange-400" },
  Extreme: { classes: "bg-red-50 text-red-600 border border-red-200", dot: "bg-red-400" },
};

const TrailCard = ({ trail, isExpanded, onToggle, onEdit, onDelete }) => {
  const primaryImage = trail.images?.find((img) => img.is_primary);
  const diff = difficultyConfig[trail.difficulty_level] || difficultyConfig["Moderate"];

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden hover:border-gray-300 transition-all group">
      {/* Header row */}
      <div
        className="flex items-center gap-4 p-4 cursor-pointer"
        onClick={onToggle}
      >
        {/* Thumbnail */}
        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-200">
          {primaryImage ? (
            <img
              src={`http://localhost:5000${primaryImage.image_path}`}
              alt={trail.trail_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Mountain className="h-7 w-7 text-gray-300" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-gray-900 font-semibold text-base truncate">{trail.trail_name}</h3>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${diff.classes}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${diff.dot}`} />
              {trail.difficulty_level}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {trail.region}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {trail.duration_days} days
            </span>
            {trail.max_altitude && (
              <span className="flex items-center gap-1">
                <Mountain className="h-3.5 w-3.5" />
                {trail.max_altitude.toLocaleString()}m
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition"
            title="Edit trail"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
            title="Delete trail"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <div className="ml-1 text-gray-400">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-200 px-5 pb-5 pt-4 space-y-5 bg-white">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
              Description
            </p>
            <p className="text-gray-600 text-sm leading-relaxed">{trail.description}</p>
          </div>

          {trail.images?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                Images
              </p>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {trail.images.map((img) => (
                  <div
                    key={img.image_id}
                    className={`w-32 h-24 rounded-xl overflow-hidden flex-shrink-0 ${
                      img.is_primary ? "ring-2 ring-blue-500" : "ring-1 ring-gray-200"
                    }`}
                  >
                    <img
                      src={`http://localhost:5000${img.image_path}`}
                      alt="Trail"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {trail.itineraries?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                Itinerary
              </p>
              <div className="space-y-2">
                {trail.itineraries.map((it) => (
                  <div
                    key={it.itinerary_id}
                    className="bg-gray-50 border border-gray-100 rounded-xl p-3"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                        Day {it.day_number}
                      </span>
                      {it.title && (
                        <span className="text-sm font-medium text-gray-700">{it.title}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{it.description}</p>
                    <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-400">
                      {it.altitude && <span>⛰ {it.altitude}m</span>}
                      {it.distance_km && <span>📍 {it.distance_km} km</span>}
                      {it.walking_hours && <span>🕐 {it.walking_hours} hrs</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {trail.gpx_file_path && (
            <a
              href={`http://localhost:5000${trail.gpx_file_path}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 transition"
            >
              <FileText className="h-4 w-4" />
              Download GPX File
            </a>
          )}

          <p className="text-xs text-gray-400 pt-1 border-t border-gray-100">
            Approved by: {trail.approved_by_name || "Admin"} · Created:{" "}
            {new Date(trail.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────
   SHARED FORM STYLES (Light theme)
───────────────────────────────────────── */
const inputCls =
  "w-full px-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition";
const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5";

const EMPTY_ITINERARY = {
  day_number: 1,
  title: "",
  description: "",
  altitude: "",
  distance_km: "",
  walking_hours: "",
};

const MAX_TRAIL_IMAGES = 5;

/* ─────────────────────────────────────────
   CREATE TRAIL FORM
───────────────────────────────────────── */
const CreateTrailForm = ({ onSuccess, onCancel }) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [trailName, setTrailName] = useState("");
  const [difficulty, setDifficulty] = useState("Moderate");
  const [durationDays, setDurationDays] = useState("");
  const [maxAltitude, setMaxAltitude] = useState("");
  const [description, setDescription] = useState("");
  const [region, setRegion] = useState("");
  const [gpxFile, setGpxFile] = useState(null);
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [itineraries, setItineraries] = useState([{ ...EMPTY_ITINERARY }]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (images.length >= MAX_TRAIL_IMAGES) {
      setError(`Max ${MAX_TRAIL_IMAGES} images.`);
      e.target.value = "";
      return;
    }
    setImages((p) => [...p, file]);
    setImagePreviews((p) => [...p, URL.createObjectURL(file)]);
    e.target.value = "";
  };

  const removeSelectedImage = (i) => {
    setImages((p) => p.filter((_, idx) => idx !== i));
    setImagePreviews((p) => p.filter((_, idx) => idx !== i));
  };

  const addItinerary = () =>
    setItineraries((p) => [...p, { ...EMPTY_ITINERARY, day_number: p.length + 1 }]);

  const removeItinerary = (i) =>
    setItineraries((p) => p.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, day_number: idx + 1 })));

  const updateItinerary = (i, field, val) =>
    setItineraries((p) => p.map((it, idx) => (idx === i ? { ...it, [field]: val } : it)));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!trailName || !difficulty || !durationDays || !description || !region) {
      setError("Please fill in all required fields.");
      return;
    }
    for (const it of itineraries) {
      if (!it.description.trim()) { setError(`Day ${it.day_number} needs a description.`); return; }
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("trail_name", trailName);
      fd.append("difficulty_level", difficulty);
      fd.append("duration_days", durationDays);
      fd.append("max_altitude", maxAltitude);
      fd.append("description", description);
      fd.append("region", region);
      fd.append("itineraries", JSON.stringify(itineraries));
      if (gpxFile) fd.append("gpx_file", gpxFile);
      images.forEach((img) => fd.append("images", img));
      await api.post(`${API}/trails`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create trail.");
    } finally {
      setSubmitting(false);
    }
  };

  return <TrailFormLayout title="Create New Trail" icon={<Plus className="h-4 w-4 text-blue-500" />} error={error} submitting={submitting} submitLabel="Create Trail" onCancel={onCancel} onSubmit={handleSubmit}>
    <BasicFields {...{ trailName, setTrailName, region, setRegion, difficulty, setDifficulty, durationDays, setDurationDays, maxAltitude, setMaxAltitude, description, setDescription }} />
    <FileFields gpxFile={gpxFile} setGpxFile={setGpxFile} images={images} imagePreviews={imagePreviews} onImageChange={handleImageChange} onRemoveImage={removeSelectedImage} />
    <ItinerarySection itineraries={itineraries} onAdd={addItinerary} onRemove={removeItinerary} onUpdate={updateItinerary} />
  </TrailFormLayout>;
};

/* ─────────────────────────────────────────
   EDIT TRAIL FORM
───────────────────────────────────────── */
const EditTrailForm = ({ trail, onSuccess, onCancel }) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [trailName, setTrailName] = useState(trail.trail_name || "");
  const [difficulty, setDifficulty] = useState(trail.difficulty_level || "Moderate");
  const [durationDays, setDurationDays] = useState(trail.duration_days || "");
  const [maxAltitude, setMaxAltitude] = useState(trail.max_altitude || "");
  const [description, setDescription] = useState(trail.description || "");
  const [region, setRegion] = useState(trail.region || "");
  const [gpxFile, setGpxFile] = useState(null);
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [existingImages] = useState(trail.images || []);
  const [removedImageIds, setRemovedImageIds] = useState([]);
  const [replacementFilesById, setReplacementFilesById] = useState({});
  const [replacementPreviewById, setReplacementPreviewById] = useState({});
  const [itineraries, setItineraries] = useState(
    trail.itineraries?.length > 0
      ? trail.itineraries.map((it, i) => ({ day_number: i + 1, title: it.title || "", description: it.description || "", altitude: it.altitude || "", distance_km: it.distance_km || "", walking_hours: it.walking_hours || "" }))
      : [{ ...EMPTY_ITINERARY }]
  );

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const activeExisting = existingImages.filter((img) => !removedImageIds.includes(img.image_id)).length;
    if (activeExisting + images.length >= MAX_TRAIL_IMAGES) {
      setError(`Maximum ${MAX_TRAIL_IMAGES} total images allowed. Remove existing images first to add new ones.`);
      e.target.value = "";
      return;
    }
    setImages((p) => [...p, file]);
    setImagePreviews((p) => [...p, URL.createObjectURL(file)]);
    e.target.value = "";
  };

  const removeSelectedImage = (i) => {
    setImages((p) => p.filter((_, idx) => idx !== i));
    setImagePreviews((p) => p.filter((_, idx) => idx !== i));
  };

  const toggleRemoveExistingImage = (id) =>
    setRemovedImageIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const setReplacementForImage = (id, file) => {
    if (!file) return;
    setReplacementFilesById((p) => ({ ...p, [id]: file }));
    setReplacementPreviewById((p) => ({ ...p, [id]: URL.createObjectURL(file) }));
  };

  const clearReplacementForImage = (id) => {
    setReplacementFilesById((p) => { const u = { ...p }; delete u[id]; return u; });
    setReplacementPreviewById((p) => { const u = { ...p }; delete u[id]; return u; });
  };

  const addItinerary = () =>
    setItineraries((p) => [...p, { ...EMPTY_ITINERARY, day_number: p.length + 1 }]);
  const removeItinerary = (i) =>
    setItineraries((p) => p.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, day_number: idx + 1 })));
  const updateItinerary = (i, field, val) =>
    setItineraries((p) => p.map((it, idx) => (idx === i ? { ...it, [field]: val } : it)));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!trailName || !difficulty || !durationDays || !description || !region) { setError("Fill in all required fields."); return; }
    for (const it of itineraries) { if (!it.description.trim()) { setError(`Day ${it.day_number} needs a description.`); return; } }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("trail_name", trailName);
      fd.append("difficulty_level", difficulty);
      fd.append("duration_days", durationDays);
      fd.append("max_altitude", maxAltitude);
      fd.append("description", description);
      fd.append("region", region);
      fd.append("itineraries", JSON.stringify(itineraries));
      fd.append("removed_image_ids", JSON.stringify(removedImageIds));
      const repIds = Object.keys(replacementFilesById).map(Number).filter((id) => !removedImageIds.includes(id));
      fd.append("replacement_image_ids", JSON.stringify(repIds));
      repIds.forEach((id) => fd.append("replacement_images", replacementFilesById[id]));
      if (gpxFile) fd.append("gpx_file", gpxFile);
      images.forEach((img) => fd.append("images", img));
      await api.put(`${API}/trails/${trail.trail_id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update trail.");
    } finally {
      setSubmitting(false);
    }
  };

  const activeExistingCount = existingImages.filter((img) => !removedImageIds.includes(img.image_id)).length;
  const totalImageCount = activeExistingCount + images.length;
  const remainingSlots = MAX_TRAIL_IMAGES - totalImageCount;

  return (
    <TrailFormLayout title="Edit Trail" icon={<Pencil className="h-4 w-4 text-blue-500" />} error={error} submitting={submitting} submitLabel="Update Trail" onCancel={onCancel} onSubmit={handleSubmit} isEdit>
      <BasicFields {...{ trailName, setTrailName, region, setRegion, difficulty, setDifficulty, durationDays, setDurationDays, maxAltitude, setMaxAltitude, description, setDescription }} />

      {/* GPX File */}
      <div>
        <label className={labelCls}>GPX File</label>
        <label className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition group">
          <Upload className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition flex-shrink-0" />
          <span className="text-sm text-gray-500 truncate">{gpxFile ? gpxFile.name : "Replace GPX file (optional)"}</span>
          <input type="file" accept=".gpx" className="hidden" onChange={(e) => setGpxFile(e.target.files[0] || null)} />
        </label>
      </div>

      {/* Images Management */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className={labelCls}>Trail Images</p>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${totalImageCount >= MAX_TRAIL_IMAGES ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
            {totalImageCount} / {MAX_TRAIL_IMAGES}
          </span>
        </div>

        {/* Existing Images */}
        {existingImages.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {existingImages.map((img) => {
              const markedForRemoval = removedImageIds.includes(img.image_id);
              const repPreview = replacementPreviewById[img.image_id];
              return (
                <div key={img.image_id} className={`border rounded-xl p-2 transition-all ${markedForRemoval ? "border-red-300 bg-red-50 opacity-60" : "border-gray-200 bg-white"}`}>
                  <div className="relative w-full h-24 rounded-lg overflow-hidden mb-2 bg-gray-100">
                    <img src={repPreview || `http://localhost:5000${img.image_path}`} alt="Trail" className="w-full h-full object-cover" />
                    {img.is_primary && !markedForRemoval && (
                      <span className="absolute top-1 right-1 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">PRIMARY</span>
                    )}
                    {repPreview && (
                      <span className="absolute top-1 left-1 bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">NEW</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button type="button" onClick={() => toggleRemoveExistingImage(img.image_id)}
                      className={`text-xs px-2 py-1 rounded-lg flex-1 transition ${markedForRemoval ? "bg-red-500 text-white" : "bg-red-50 text-red-500 border border-red-200 hover:bg-red-100"}`}>
                      {markedForRemoval ? "Undo" : "Remove"}
                    </button>
                    {!markedForRemoval && (
                      <label className="text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-500 border border-blue-200 cursor-pointer flex-1 text-center transition hover:bg-blue-100">
                        {repPreview ? "Change" : "Replace"}
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setReplacementForImage(img.image_id, e.target.files?.[0])} />
                      </label>
                    )}
                    {repPreview && (
                      <button type="button" onClick={() => clearReplacementForImage(img.image_id)}
                        className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition">✕</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* New Images Previews (to be added) */}
        {imagePreviews.length > 0 && (
          <div>
            <p className="text-xs text-blue-500 font-medium mb-2">New images to be added on save</p>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {imagePreviews.map((src, i) => (
                <div key={i} className="relative w-24 h-20 rounded-xl overflow-hidden flex-shrink-0 ring-2 ring-blue-400">
                  <img src={src} alt={`New ${i + 1}`} className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeSelectedImage(i)}
                    className="absolute top-1 left-1 bg-white/90 rounded-full p-1 text-red-500 hover:text-red-600 transition">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add More Button */}
        {remainingSlots > 0 ? (
          <label className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition group">
            <Image className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition flex-shrink-0" />
            <span className="text-sm text-gray-500">
              Add image <span className="text-gray-400">({remainingSlots} slot{remainingSlots !== 1 ? "s" : ""} remaining)</span>
            </span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChange} />
          </label>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
            <Image className="h-5 w-5 text-amber-500 flex-shrink-0" />
            <span className="text-sm text-amber-600 font-medium">Max {MAX_TRAIL_IMAGES} images reached — remove an existing image to add a new one.</span>
          </div>
        )}
      </div>

      <ItinerarySection itineraries={itineraries} onAdd={addItinerary} onRemove={removeItinerary} onUpdate={updateItinerary} />
    </TrailFormLayout>
  );
};

/* ─────────────────────────────────────────
   SHARED FORM COMPONENTS (Light theme)
───────────────────────────────────────── */
const TrailFormLayout = ({ title, icon, error, submitting, submitLabel, onCancel, onSubmit, isEdit, children }) => (
  <form onSubmit={onSubmit} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6 shadow-sm">
    <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
      <div className="p-2 rounded-lg bg-blue-50 border border-blue-100">{icon}</div>
      <h3 className="text-gray-900 font-bold text-base">{title}</h3>
    </div>

    {error && (
      <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
        <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
        {error}
      </div>
    )}

    {children}

    <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
      <button type="button" onClick={onCancel}
        className="px-5 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-medium transition">
        Cancel
      </button>
      <button type="submit" disabled={submitting}
        className="px-6 py-2.5 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-blue-200 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
        {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" />Processing…</>) : (<>{isEdit ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{submitLabel}</>)}
      </button>
    </div>
  </form>
);

const BasicFields = ({ trailName, setTrailName, region, setRegion, difficulty, setDifficulty, durationDays, setDurationDays, maxAltitude, setMaxAltitude, description, setDescription }) => (
  <>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className={labelCls}>Trail Name <span className="text-red-500 normal-case tracking-normal">*</span></label>
        <input type="text" value={trailName} onChange={(e) => setTrailName(e.target.value)} className={inputCls} placeholder="e.g. Kori Himal Trek" />
      </div>
      <div>
        <label className={labelCls}>Region <span className="text-red-500 normal-case tracking-normal">*</span></label>
        <input type="text" value={region} onChange={(e) => setRegion(e.target.value)} className={inputCls} placeholder="e.g. Solukhumbu" />
      </div>
      <div>
        <label className={labelCls}>Difficulty <span className="text-red-500 normal-case tracking-normal">*</span></label>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={inputCls}>
          <option value="Easy">Easy</option>
          <option value="Moderate">Moderate</option>
          <option value="Difficult">Difficult</option>
          <option value="Extreme">Extreme</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Duration (days) <span className="text-red-500 normal-case tracking-normal">*</span></label>
        <input type="number" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} className={inputCls} min="1" placeholder="e.g. 12" />
      </div>
      <div className="md:col-span-2">
        <label className={labelCls}>Max Altitude (m)</label>
        <input type="number" value={maxAltitude} onChange={(e) => setMaxAltitude(e.target.value)} className={inputCls} placeholder="e.g. 5364" />
      </div>
    </div>
    <div>
      <label className={labelCls}>Description <span className="text-red-500 normal-case tracking-normal">*</span></label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
        className={`${inputCls} resize-none`} placeholder="Describe the trail, highlights, best season…" />
    </div>
  </>
);

const FileFields = ({ gpxFile, setGpxFile, images, imagePreviews, onImageChange, onRemoveImage }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label className={labelCls}>GPX File</label>
      <label className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition group">
        <Upload className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition flex-shrink-0" />
        <span className="text-sm text-gray-500 truncate">{gpxFile ? gpxFile.name : "Choose .gpx file"}</span>
        <input type="file" accept=".gpx" className="hidden" onChange={(e) => setGpxFile(e.target.files[0] || null)} />
      </label>
    </div>
    <div>
      <label className={labelCls}>Images (max {MAX_TRAIL_IMAGES})</label>
      <label className={`flex items-center gap-3 px-4 py-3 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition group ${images.length >= MAX_TRAIL_IMAGES ? "opacity-50 cursor-not-allowed" : ""}`}>
        <Image className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition flex-shrink-0" />
        <span className="text-sm text-gray-500">{images.length > 0 ? `${images.length}/${MAX_TRAIL_IMAGES} selected` : "Add an image"}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={images.length >= MAX_TRAIL_IMAGES} onChange={onImageChange} />
      </label>
      <p className="text-xs text-gray-400 mt-1">First image becomes the primary thumbnail.</p>
    </div>

    {imagePreviews.length > 0 && (
      <div className="md:col-span-2 flex gap-3 overflow-x-auto pb-1">
        {imagePreviews.map((src, i) => (
          <div key={i} className={`relative w-24 h-20 rounded-xl overflow-hidden flex-shrink-0 ${i === 0 ? "ring-2 ring-blue-500" : "ring-1 ring-gray-200"}`}>
            <img src={src} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />
            <button type="button" onClick={() => onRemoveImage(i)}
              className="absolute top-1 left-1 bg-white/90 rounded-full p-1 text-red-500 hover:text-red-600 transition">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
);

const ItinerarySection = ({ itineraries, onAdd, onRemove, onUpdate }) => (
  <div>
    <div className="flex items-center justify-between mb-3">
      <p className={labelCls}>Day-by-Day Itinerary</p>
      <button type="button" onClick={onAdd}
        className="flex items-center gap-1.5 text-xs font-semibold text-blue-500 hover:text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg transition">
        <Plus className="h-3.5 w-3.5" />Add Day
      </button>
    </div>
    <div className="space-y-3">
      {itineraries.map((it, idx) => (
        <div key={idx} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-lg">
              Day {it.day_number}
            </span>
            {itineraries.length > 1 && (
              <button type="button" onClick={() => onRemove(idx)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <input type="text" value={it.title} onChange={(e) => onUpdate(idx, "title", e.target.value)}
              className={`col-span-1 md:col-span-3 ${inputCls}`} placeholder="Title (e.g. Pokhara to Tikhedhunga)" />
            <input type="number" value={it.altitude} onChange={(e) => onUpdate(idx, "altitude", e.target.value)}
              className={inputCls} placeholder="Altitude (m)" />
            <input type="number" step="0.01" value={it.distance_km} onChange={(e) => onUpdate(idx, "distance_km", e.target.value)}
              className={inputCls} placeholder="Distance (km)" />
            <input type="number" step="0.5" value={it.walking_hours} onChange={(e) => onUpdate(idx, "walking_hours", e.target.value)}
              className={inputCls} placeholder="Walking hours" />
          </div>
          <textarea value={it.description} onChange={(e) => onUpdate(idx, "description", e.target.value)} rows={2}
            className={`${inputCls} resize-none`} placeholder="Day description *" />
        </div>
      ))}
    </div>
  </div>
);

export default AdminDashboard;