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
  CreditCard,
} from "lucide-react";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import LogoutModal from "../components/LogoutModal";
import { useAuth } from "../context/AuthContext";
import { getToken } from "../tokenStore";
import { motion, AnimatePresence } from "framer-motion";

const API = "http://localhost:5000/api";

/* ─────────────────────────────────────────
   STAT CARD (Premium Theme)
───────────────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, accent, delay = 0 }) => {
  const accents = {
    navy: { bg: "bg-white", iconBg: "bg-navy/10", icon: "text-navy", text: "text-navy" },
    gold: { bg: "bg-white", iconBg: "bg-gold/10", icon: "text-gold-dark", text: "text-gray-900" },
    alpine: { bg: "bg-white", iconBg: "bg-alpine/10", icon: "text-alpine", text: "text-gray-900" },
    charcoal: { bg: "bg-white", iconBg: "bg-charcoal/10", icon: "text-charcoal", text: "text-gray-900" },
  };
  const a = accents[accent] || accents.navy;
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ delay, duration: 0.4 }}
      className={`relative ${a.bg} rounded-3xl p-6 border border-gray-100/80 shadow-sm overflow-hidden group hover:shadow-lg transition-all duration-300`}
    >
      <div className={`inline-flex p-3 rounded-2xl ${a.iconBg} mb-4 transition-transform duration-300 group-hover:scale-110`}>
        <Icon className={`h-6 w-6 ${a.icon}`} />
      </div>
      <p className={`text-4xl font-bold ${a.text} font-heading tracking-tight`}>{value}</p>
      <p className="text-sm text-gray-500 mt-1 font-medium">{label}</p>
      
      {/* Decorative background element */}
      <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full ${a.iconBg} opacity-50 group-hover:scale-150 transition-transform duration-500 pointer-events-none`} />
    </motion.div>
  );
};

/* ─────────────────────────────────────────
   STATUS BADGE
───────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const config = {
    not_submitted: { bg: "bg-gray-50 border-gray-200", text: "text-gray-600", dot: "bg-gray-400", label: "Not Submitted" },
    pending: { bg: "bg-gold/10 border-gold/20", text: "text-gold-dark", dot: "bg-gold", label: "Pending" },
    approved: { bg: "bg-alpine/10 border-alpine/20", text: "text-alpine-dark", dot: "bg-alpine", label: "Approved" },
    rejected: { bg: "bg-red-50 border-red-200", text: "text-red-700", dot: "bg-red-500", label: "Rejected" },
  };
  const c = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] uppercase tracking-wider font-bold border ${c.bg} ${c.text}`}>
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
  const [paymentRecords, setPaymentRecords] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [guidePaymentRecords, setGuidePaymentRecords] = useState([]);
  const [guidePaymentsLoading, setGuidePaymentsLoading] = useState(false);
  const [reviewingRefundBookingId, setReviewingRefundBookingId] = useState(null);
  const [refundActionNotice, setRefundActionNotice] = useState(null);
  const [refundReviewModal, setRefundReviewModal] = useState({
    open: false,
    record: null,
    note: "",
    gatewayRefundReference: "",
    error: "",
  });
  const [paymentDetailsModal, setPaymentDetailsModal] = useState({
    open: false,
    record: null,
    bookingType: "homestay",
  });

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

  const fetchAdminPayments = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const res = await api.get(`${API}/bookings/admin/payments`);
      setPaymentRecords(res.data.records || []);
    } catch (err) {
      console.error("Error fetching admin payment records:", err);
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  const fetchAdminGuidePayments = useCallback(async () => {
    setGuidePaymentsLoading(true);
    try {
      const res = await api.get(`${API}/guide-bookings/admin/payments`);
      setGuidePaymentRecords(res.data.records || []);
    } catch (err) {
      console.error("Error fetching admin guide payment records:", err);
    } finally {
      setGuidePaymentsLoading(false);
    }
  }, []);

  const pushRefundNotice = useCallback((type, message) => {
    const noticeId = Date.now();
    setRefundActionNotice({ id: noticeId, type, message });

    window.setTimeout(() => {
      setRefundActionNotice((prev) => (prev?.id === noticeId ? null : prev));
    }, 7000);
  }, []);

  const openRefundReviewModal = (record, bookingType = "homestay") => {
    setRefundReviewModal({
      open: true,
      record: { ...record, booking_type: bookingType },
      note: "",
      gatewayRefundReference: "",
      error: "",
    });
  };

  const openPaymentDetailsModal = (record, bookingType = "homestay") => {
    setPaymentDetailsModal({
      open: true,
      record,
      bookingType,
    });
  };

  const closePaymentDetailsModal = () => {
    setPaymentDetailsModal({
      open: false,
      record: null,
      bookingType: "homestay",
    });
  };

  const closeRefundReviewModal = (force = false) => {
    if (!force && reviewingRefundBookingId) return;
    setRefundReviewModal({
      open: false,
      record: null,
      note: "",
      gatewayRefundReference: "",
      error: "",
    });
  };

  const handleRefundReview = async (action) => {
    const record = refundReviewModal.record;

    if (!record?.booking_id) {
      setRefundReviewModal((prev) => ({
        ...prev,
        error: "Booking id is missing for this payment record.",
      }));
      return;
    }

    const provider = String(record.payment_provider || "").trim().toLowerCase();
    const paymentReference = String(record.payment_ref_id || "").trim();
    const canAutoRefundWithStripe = provider === "stripe" && paymentReference.startsWith("pi_");

    if (action === "process" && !canAutoRefundWithStripe && !refundReviewModal.gatewayRefundReference.trim()) {
      setRefundReviewModal((prev) => ({
        ...prev,
        error: "Gateway refund reference is required to process this refund.",
      }));
      return;
    }

    setReviewingRefundBookingId(record.booking_id);
    setRefundReviewModal((prev) => ({ ...prev, error: "" }));

    try {
      const basePath = record.booking_type === "guide_package" ? "guide-bookings" : "bookings";
      const res = await api.patch(`${API}/${basePath}/${record.booking_id}/refund/review`, {
        action,
        note: refundReviewModal.note.trim() || null,
        gateway_refund_reference:
          action === "process" && !canAutoRefundWithStripe
            ? refundReviewModal.gatewayRefundReference.trim()
            : null,
      });

      pushRefundNotice("success", res.data?.message || "Refund review updated successfully.");
      closeRefundReviewModal(true);
      await fetchAdminPayments();
      await fetchAdminGuidePayments();
    } catch (err) {
      console.error("Error reviewing refund request:", err);
      pushRefundNotice("error", err.response?.data?.message || "Failed to review refund request");
      setRefundReviewModal((prev) => ({
        ...prev,
        error: err.response?.data?.message || "Failed to review refund request",
      }));
    } finally {
      setReviewingRefundBookingId(null);
    }
  };

  useEffect(() => {
    if (!isLoading && user) {
      fetchTrails();
      fetchAdminHomestays();
      fetchAdminGuides();
      fetchAdminPayments();
      fetchAdminGuidePayments();
    }
  }, [isLoading, user, fetchTrails, fetchAdminHomestays, fetchAdminGuides, fetchAdminPayments, fetchAdminGuidePayments]);

  const handleHomestayStatus = async (id, status) => {
    try {
      await api.patch(`${API}/homestays/admin/${id}/status`, { verified_status: status });
      fetchAdminHomestays();
    } catch (err) {
      console.error("Error updating homestay status:", err);
      alert("Failed to update status");
    }
  };

  const handleGuideVerificationStatus = async (guideId, status) => {
    try {
      let rejection_reason = "";
      if (status === "rejected") {
        rejection_reason = window.prompt("Add rejection reason for this guide:") || "";
        if (!rejection_reason.trim()) {
          alert("Rejection reason is required.");
          return;
        }
      }

      await api.patch(`${API}/guides/admin/${guideId}/verification-status`, {
        verification_status: status,
        rejection_reason,
      });
      fetchAdminGuides();
    } catch (err) {
      console.error("Error updating guide verification status:", err);
      alert(err.response?.data?.message || "Failed to update guide verification status");
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
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-navy border-t-gold animate-spin" />
          <p className="text-navy font-heading font-semibold tracking-wide">Loading dashboard…</p>
        </div>
      </div>
    );

  const normalizeRefundStatus = (record) => {
    const paymentStatus = String(record?.payment_status || "").trim().toLowerCase();
    return String(
      record?.refund_status ||
        (paymentStatus === "refund_requested"
          ? "requested"
          : paymentStatus === "refunded"
            ? "processed"
            : "")
    )
      .trim()
      .toLowerCase();
  };

  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
  };

  const compactReference = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "-";
    if (raw.length <= 26) return raw;
    return `${raw.slice(0, 12)}...${raw.slice(-10)}`;
  };

  // Homestay Metrics
  const pendingHomestays = homestaysAdmin.filter((h) => h.verified_status === "pending").length;
  const approvedHomestays = homestaysAdmin.filter((h) => h.verified_status === "approved").length;
  const rejectedHomestays = homestaysAdmin.filter((h) => h.verified_status === "rejected").length;

  // Guide Metrics
  const pendingGuides = guidesAdmin.filter((g) => g.verification_status === "pending").length;
  const approvedGuides = guidesAdmin.filter((g) => g.verification_status === "approved").length;
  const rejectedGuides = guidesAdmin.filter((g) => g.verification_status === "rejected").length;

  // Homestay Payment Metrics
  const homestaySuccessfulPayments = paymentRecords.filter(
    (record) => String(record.payment_status || "").trim().toLowerCase() === "success"
  ).length;
  const homestayPendingRefunds = paymentRecords.filter((record) =>
    ["requested", "processing"].includes(normalizeRefundStatus(record))
  ).length;
  const homestayRevenue = paymentRecords
    .filter((record) => String(record.payment_status || "").trim().toLowerCase() === "success")
    .reduce((sum, record) => sum + Number(record.total_amount || 0), 0);

  // Guide Payment Metrics
  const guideSuccessfulPayments = guidePaymentRecords.filter(
    (record) => String(record.payment_status || "").trim().toLowerCase() === "success"
  ).length;
  const guidePendingRefunds = guidePaymentRecords.filter((record) =>
    ["requested", "processing"].includes(normalizeRefundStatus(record))
  ).length;
  const guideRevenue = guidePaymentRecords
    .filter((record) => String(record.payment_status || "").trim().toLowerCase() === "success")
    .reduce((sum, record) => sum + Number(record.total_amount || 0), 0);

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex font-body">
      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-72 bg-navy border-r border-navy-light/30 fixed inset-y-0 shadow-2xl z-50">
        {/* Brand */}
        <div className="px-8 py-8 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12 rounded-full overflow-hidden shadow-lg shadow-black/40 ring-2 ring-gold/80">
              <img
                src="/offtrail-latest.png"
                alt="OffTrail Nepal"
                className="h-full w-full object-cover bg-white"
              />
            </div>
            <div>
              <p className="text-white font-heading font-bold text-2xl tracking-wide leading-none">OffTrail</p>
              <p className="text-gold mt-1.5 text-[10px] uppercase tracking-[0.2em] font-bold">Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-8 space-y-2">
          <p className="px-4 mb-4 text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">
            Overview
          </p>
          {[
            { id: "trails", icon: Mountain, label: "Trekking Trails", count: trails.length },
            { id: "homestays", icon: Home, label: "Homestay Approvals", count: pendingHomestays > 0 ? pendingHomestays : null, countType: "alert" },
            { id: "guides", icon: Compass, label: "Guides Management" },
            { id: "homestay-payments", icon: CreditCard, label: "Homestay Payments", count: homestayPendingRefunds > 0 ? homestayPendingRefunds : null, countType: "alert" },
            { id: "guide-payments", icon: Briefcase, label: "Guide Payments", count: guidePendingRefunds > 0 ? guidePendingRefunds : null, countType: "alert" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-300 ${
                activeTab === item.id
                  ? "bg-gold text-navy shadow-lg shadow-gold/20"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
              {item.count !== undefined && item.count !== null && (
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  item.countType === "alert" && activeTab !== item.id
                    ? "bg-red-500 text-white" 
                    : activeTab === item.id 
                    ? "bg-navy/20 text-navy" 
                    : "bg-white/10 text-white"
                }`}>
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User */}
        <div className="px-6 py-6 border-t border-white/5 bg-black/20">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center text-navy font-bold text-base shadow-lg ring-2 ring-white/10">
              {(user?.full_name || "A")[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-bold truncate leading-tight">
                {user?.full_name || "Administrator"}
              </p>
              <p className="text-white/50 text-[11px] font-medium mt-0.5 uppercase tracking-wider">Control Center</p>
            </div>
          </div>
          <button
            onClick={setShowLogoutModal}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm font-bold transition-colors border border-red-500/20 hover:border-red-500/40"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 lg:ml-72 flex flex-col min-h-screen relative overflow-hidden">
        {/* Background Decorative Element */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-br from-gold/5 via-alpine/5 to-transparent rounded-full blur-3xl -z-10 transform translate-x-1/3 -translate-y-1/3 pointer-events-none" />
        
        {/* Top bar */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-8 py-5 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div>
            <h1 className="text-navy font-heading font-bold text-2xl tracking-tight">
              {activeTab === "trails" && "Trail Management"}
              {activeTab === "homestays" && "Homestay Approvals"}
              {activeTab === "guides" && "Guides Management"}
              {activeTab === "homestay-payments" && "Homestay Booking Payments"}
              {activeTab === "guide-payments" && "Guide Booking Payments"}
            </h1>
            <p className="text-gray-500 text-sm mt-1 font-medium">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-alpine/10 border border-alpine/20 px-4 py-2 rounded-full shadow-sm">
              <span className="w-2 h-2 rounded-full bg-alpine animate-pulse" />
              <span className="text-alpine-dark text-[11px] font-bold tracking-wide uppercase">System Online</span>
            </div>
            {/* Mobile nav buttons */}
            <div className="lg:hidden flex gap-2">
              {[
                { id: "trails", icon: Mountain },
                { id: "homestays", icon: Home, count: pendingHomestays },
                { id: "guides", icon: Compass },
                { id: "homestay-payments", icon: CreditCard, count: homestayPendingRefunds },
                { id: "guide-payments", icon: Briefcase, count: guidePendingRefunds },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`p-2.5 rounded-xl transition-all relative ${
                    activeTab === item.id ? "bg-navy text-gold shadow-md" : "text-gray-400 hover:bg-gray-100"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.count > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold shadow-sm">
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
              <button
                onClick={setShowLogoutModal}
                className="p-2.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all border border-transparent hover:border-red-100"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-8 py-8 space-y-8 z-10 w-full max-w-[1600px] mx-auto">
          {/* Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {activeTab === "trails" && (
              <>
                <StatCard icon={Mountain} label="Active Trails" value={trails.length} accent="navy" delay={0.1} />
                <StatCard icon={MapPin} label="Moderate Trails" value={trails.filter(t => String(t.difficulty_level || "").toLowerCase() === "moderate").length} accent="alpine" delay={0.2} />
                <StatCard icon={TrendingUp} label="Difficult Trails" value={trails.filter(t => String(t.difficulty_level || "").toLowerCase() === "hard" || String(t.difficulty_level || "").toLowerCase() === "difficult").length} accent="gold" delay={0.3} />
                <StatCard icon={CheckCircle} label="System Status" value={"Operational"} accent="charcoal" delay={0.4} />
              </>
            )}
            
            {activeTab === "homestays" && (
              <>
                <StatCard icon={Home} label="Total Homestays" value={homestaysAdmin.length} accent="navy" delay={0.1} />
                <StatCard icon={CheckCircle} label="Approved" value={approvedHomestays} accent="alpine" delay={0.2} />
                <StatCard icon={Activity} label="Pending Approvals" value={pendingHomestays} accent="gold" delay={0.3} />
                <StatCard icon={XCircle} label="Rejected" value={rejectedHomestays} accent="charcoal" delay={0.4} />
              </>
            )}

            {activeTab === "guides" && (
              <>
                <StatCard icon={Compass} label="Registered Guides" value={guidesAdmin.length} accent="navy" delay={0.1} />
                <StatCard icon={CheckCircle} label="Verified" value={approvedGuides} accent="alpine" delay={0.2} />
                <StatCard icon={Activity} label="Pending Verification" value={pendingGuides} accent="gold" delay={0.3} />
                <StatCard icon={XCircle} label="Rejected" value={rejectedGuides} accent="charcoal" delay={0.4} />
              </>
            )}

            {activeTab === "homestay-payments" && (
              <>
                <StatCard icon={CreditCard} label="Payment Sessions" value={paymentRecords.length} accent="navy" delay={0.1} />
                <StatCard icon={CheckCircle} label="Successful" value={homestaySuccessfulPayments} accent="alpine" delay={0.2} />
                <StatCard icon={TrendingUp} label="Refund Queue" value={homestayPendingRefunds} accent="charcoal" delay={0.3} />
                <StatCard icon={DollarSign} label="Settled Volume" value={`NPR ${homestayRevenue.toLocaleString()}`} accent="gold" delay={0.4} />
              </>
            )}

            {activeTab === "guide-payments" && (
              <>
                <StatCard icon={Briefcase} label="Guide Sessions" value={guidePaymentRecords.length} accent="navy" delay={0.1} />
                <StatCard icon={CheckCircle} label="Successful" value={guideSuccessfulPayments} accent="alpine" delay={0.2} />
                <StatCard icon={TrendingUp} label="Refund Queue" value={guidePendingRefunds} accent="charcoal" delay={0.3} />
                <StatCard icon={DollarSign} label="Settled Volume" value={`NPR ${guideRevenue.toLocaleString()}`} accent="gold" delay={0.4} />
              </>
            )}
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

                        <div className="mb-4 flex items-center justify-between gap-3">
                          <StatusBadge status={g.verification_status} />
                          {g.verification_status === "pending" && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleGuideVerificationStatus(g.guide_id, "approved")}
                                className="px-3 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleGuideVerificationStatus(g.guide_id, "rejected")}
                                className="px-3 py-1.5 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white rounded-lg"
                              >
                                Reject
                              </button>
                            </div>
                          )}
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

                        {g.citizenship_doc_path && g.guide_license_doc_path && (
                          <div className="mb-4 pt-3 border-t border-gray-200 grid grid-cols-2 gap-2">
                            <a
                              href={`http://localhost:5000${g.citizenship_doc_path}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              View Citizenship
                            </a>
                            <a
                              href={`http://localhost:5000${g.guide_license_doc_path}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              View Guide License
                            </a>
                          </div>
                        )}

                        {g.verification_status === "rejected" && g.rejection_reason && (
                          <p className="text-xs text-red-600 mb-4">Reason: {g.rejection_reason}</p>
                        )}

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

          {activeTab === "homestay-payments" && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-violet-50 border border-violet-100">
                    <CreditCard className="h-4 w-4 text-violet-500" />
                  </div>
                  <div>
                    <h2 className="text-gray-900 font-semibold text-base">Homestay Booking Payments</h2>
                    <p className="text-gray-400 text-xs">Track payment lifecycle, booking linkage, and refund review queue for homestays</p>
                  </div>
                </div>
                <button
                  onClick={fetchAdminPayments}
                  disabled={paymentsLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                >
                  {paymentsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
                  Refresh
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Total Sessions</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">{paymentRecords.length}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs text-emerald-600 uppercase tracking-wide">Successful</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-700">{homestaySuccessfulPayments}</p>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs text-amber-700 uppercase tracking-wide">Refund Queue</p>
                    <p className="mt-1 text-2xl font-bold text-amber-700">{homestayPendingRefunds}</p>
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <p className="text-xs text-blue-600 uppercase tracking-wide">Settled Volume</p>
                    <p className="mt-1 text-2xl font-bold text-blue-700">NPR {homestayRevenue.toLocaleString()}</p>
                  </div>
                </div>

                {paymentsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                ) : paymentRecords.length === 0 ? (
                  <div className="flex flex-col items-center py-16 gap-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50">
                    <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center">
                      <CreditCard className="h-8 w-8 text-gray-300" />
                    </div>
                    <div className="text-center">
                      <p className="text-gray-700 font-semibold">No homestay payment records yet</p>
                      <p className="text-gray-400 text-sm mt-1">Records appear here after tourists initiate checkout.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paymentRecords.map((record) => {
                      const paymentStatus = String(record.payment_status || "").trim().toLowerCase();
                      const computedRefundStatus = normalizeRefundStatus(record);
                      const isRefundPending = ["requested", "processing"].includes(computedRefundStatus);
                      const isBusy = reviewingRefundBookingId === record.booking_id;

                      return (
                        <div
                          key={record.session_id}
                          className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-bold text-gray-900">{record.tourist_name}</p>
                                {record.booking_code && (
                                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-blue-700">
                                    {record.booking_code}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">{record.tourist_email}</p>
                              <div className="flex flex-wrap gap-2 text-xs">
                                <span className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-gray-600">
                                  Homestay: <span className="font-semibold text-gray-800">{record.homestay_name || "-"}</span>
                                </span>
                                <span className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-gray-600">
                                  Host: <span className="font-semibold text-gray-800">{record.host_name || "-"}</span>
                                </span>
                              </div>
                              <p className="font-mono text-[11px] text-gray-500">
                                Ref: {compactReference(record.payment_ref_id || record.transaction_uuid)}
                              </p>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:min-w-[390px] lg:justify-end">
                              <div className="text-sm sm:text-right">
                                <p className="font-bold text-gray-900">NPR {Number(record.total_amount || 0).toLocaleString()}</p>
                                <p className="mt-1 text-xs capitalize text-gray-500">{record.payment_provider || "unknown"}</p>
                                <p className="mt-1 text-xs text-gray-500">{formatDateTime(record.payment_initiated_at)}</p>
                              </div>

                              <div className="flex flex-wrap gap-1.5 sm:max-w-[220px] sm:justify-end">
                                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                  paymentStatus === "success"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : paymentStatus === "failed"
                                      ? "border-red-200 bg-red-50 text-red-700"
                                      : paymentStatus === "refunded"
                                        ? "border-blue-200 bg-blue-50 text-blue-700"
                                        : "border-amber-200 bg-amber-50 text-amber-700"
                                }`}>
                                  {paymentStatus || "unknown"}
                                </span>
                                {computedRefundStatus && (
                                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                    computedRefundStatus === "processed"
                                      ? "border-blue-200 bg-blue-50 text-blue-700"
                                      : computedRefundStatus === "rejected"
                                        ? "border-red-200 bg-red-50 text-red-700"
                                        : "border-amber-200 bg-amber-50 text-amber-700"
                                  }`}>
                                    Refund {computedRefundStatus}
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                <button
                                  onClick={() => openPaymentDetailsModal(record, "homestay")}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  View More
                                </button>

                                {isRefundPending ? (
                                  <button
                                    disabled={isBusy}
                                    onClick={() => openRefundReviewModal(record, "homestay")}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-gold to-gold-dark px-3 py-1.5 text-xs font-bold text-navy hover:shadow-md disabled:opacity-60"
                                  >
                                    {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
                                    {computedRefundStatus === "processing" ? "Finalize" : "Review Refund"}
                                  </button>
                                ) : (
                                  <span className="text-xs text-gray-400">No action</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "guide-payments" && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 border border-blue-100">
                    <Briefcase className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-gray-900 font-semibold text-base">Guide Package Booking Payments</h2>
                    <p className="text-gray-400 text-xs">Operational view of guide package transactions, booking state, and refund decisions</p>
                  </div>
                </div>
                <button
                  onClick={fetchAdminGuidePayments}
                  disabled={guidePaymentsLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                >
                  {guidePaymentsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
                  Refresh
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Total Sessions</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">{guidePaymentRecords.length}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs text-emerald-600 uppercase tracking-wide">Successful</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-700">{guideSuccessfulPayments}</p>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs text-amber-700 uppercase tracking-wide">Refund Queue</p>
                    <p className="mt-1 text-2xl font-bold text-amber-700">{guidePendingRefunds}</p>
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <p className="text-xs text-blue-600 uppercase tracking-wide">Settled Volume</p>
                    <p className="mt-1 text-2xl font-bold text-blue-700">NPR {guideRevenue.toLocaleString()}</p>
                  </div>
                </div>

                {guidePaymentsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                ) : guidePaymentRecords.length === 0 ? (
                  <div className="flex flex-col items-center py-16 gap-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50">
                    <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center">
                      <Briefcase className="h-8 w-8 text-gray-300" />
                    </div>
                    <div className="text-center">
                      <p className="text-gray-700 font-semibold">No guide payment records yet</p>
                      <p className="text-gray-400 text-sm mt-1">Guide package payment sessions will appear here.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {guidePaymentRecords.map((record) => {
                      const paymentStatus = String(record.payment_status || "").trim().toLowerCase();
                      const computedRefundStatus = normalizeRefundStatus(record);
                      const isRefundPending = ["requested", "processing"].includes(computedRefundStatus);
                      const isBusy = reviewingRefundBookingId === record.booking_id;

                      return (
                        <div
                          key={`guide-${record.session_id}`}
                          className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-bold text-gray-900">{record.tourist_name}</p>
                                {record.booking_code && (
                                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-blue-700">
                                    {record.booking_code}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">{record.tourist_email}</p>
                              <div className="flex flex-wrap gap-2 text-xs">
                                <span className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-gray-600">
                                  Service: <span className="font-semibold text-gray-800">{record.service_title || "-"}</span>
                                </span>
                                <span className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-gray-600">
                                  Guide: <span className="font-semibold text-gray-800">{record.guide_name || "-"}</span>
                                </span>
                              </div>
                              <p className="font-mono text-[11px] text-gray-500">
                                Ref: {compactReference(record.payment_ref_id || record.transaction_uuid)}
                              </p>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:min-w-[390px] lg:justify-end">
                              <div className="text-sm sm:text-right">
                                <p className="font-bold text-gray-900">NPR {Number(record.total_amount || 0).toLocaleString()}</p>
                                <p className="mt-1 text-xs capitalize text-gray-500">{record.payment_provider || "unknown"}</p>
                                <p className="mt-1 text-xs text-gray-500">{formatDateTime(record.payment_initiated_at)}</p>
                              </div>

                              <div className="flex flex-wrap gap-1.5 sm:max-w-[220px] sm:justify-end">
                                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                  paymentStatus === "success"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : paymentStatus === "failed"
                                      ? "border-red-200 bg-red-50 text-red-700"
                                      : paymentStatus === "refunded"
                                        ? "border-blue-200 bg-blue-50 text-blue-700"
                                        : "border-amber-200 bg-amber-50 text-amber-700"
                                }`}>
                                  {paymentStatus || "unknown"}
                                </span>
                                {computedRefundStatus && (
                                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                    computedRefundStatus === "processed"
                                      ? "border-blue-200 bg-blue-50 text-blue-700"
                                      : computedRefundStatus === "rejected"
                                        ? "border-red-200 bg-red-50 text-red-700"
                                        : "border-amber-200 bg-amber-50 text-amber-700"
                                  }`}>
                                    Refund {computedRefundStatus}
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                <button
                                  onClick={() => openPaymentDetailsModal(record, "guide_package")}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  View More
                                </button>

                                {isRefundPending ? (
                                  <button
                                    disabled={isBusy}
                                    onClick={() => openRefundReviewModal(record, "guide_package")}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-gold to-gold-dark px-3 py-1.5 text-xs font-bold text-navy hover:shadow-md disabled:opacity-60"
                                  >
                                    {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
                                    {computedRefundStatus === "processing" ? "Finalize" : "Review Refund"}
                                  </button>
                                ) : (
                                  <span className="text-xs text-gray-400">No action</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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

      {refundActionNotice && (
        <div className="fixed right-4 top-4 z-[70] w-full max-w-md">
          <div
            className={`rounded-xl border px-4 py-3 shadow-lg ${
              refundActionNotice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            <div className="flex items-start gap-3">
              <p className="flex-1 text-sm font-medium">{refundActionNotice.message}</p>
              <button
                onClick={() => setRefundActionNotice(null)}
                className="rounded p-1 text-current/70 hover:bg-black/5 hover:text-current"
                aria-label="Dismiss notice"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {refundReviewModal.open && refundReviewModal.record && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeRefundReviewModal} />
          <div className="relative w-full max-w-xl rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Review Refund Request</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Booking {refundReviewModal.record.booking_code || `#${refundReviewModal.record.booking_id}`}
                </p>
              </div>
              <button
                onClick={closeRefundReviewModal}
                disabled={Boolean(reviewingRefundBookingId)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Tourist</p>
                  <p className="font-semibold text-gray-800 mt-1">{refundReviewModal.record.tourist_name}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Homestay</p>
                  <p className="font-semibold text-gray-800 mt-1">{refundReviewModal.record.homestay_name || refundReviewModal.record.service_title}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Provider</p>
                  <p className="font-semibold text-gray-800 mt-1 capitalize">{refundReviewModal.record.payment_provider || "unknown"}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Requested Amount</p>
                  <p className="font-semibold text-gray-800 mt-1">
                    NPR {Number(refundReviewModal.record.refund_requested_amount || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Review Note (Optional)
                </label>
                <textarea
                  rows={3}
                  value={refundReviewModal.note}
                  onChange={(e) =>
                    setRefundReviewModal((prev) => ({ ...prev, note: e.target.value, error: "" }))
                  }
                  placeholder="Add a short review note for this refund decision"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-300 focus:outline-none"
                />
              </div>

              {(() => {
                const provider = String(refundReviewModal.record.payment_provider || "").trim().toLowerCase();
                const paymentReference = String(refundReviewModal.record.payment_ref_id || "").trim();
                const canAutoRefundWithStripe = provider === "stripe" && paymentReference.startsWith("pi_");

                if (canAutoRefundWithStripe) {
                  return (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                      Stripe auto-refund is available for this payment reference. Manual gateway refund reference is not required.
                    </div>
                  );
                }

                return (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                      Gateway Refund Reference (Required for Process)
                    </label>
                    <input
                      type="text"
                      value={refundReviewModal.gatewayRefundReference}
                      onChange={(e) =>
                        setRefundReviewModal((prev) => ({
                          ...prev,
                          gatewayRefundReference: e.target.value,
                          error: "",
                        }))
                      }
                      placeholder="Enter eSewa/manual refund reference"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-300 focus:outline-none"
                    />
                  </div>
                );
              })()}

              {refundReviewModal.error && (
                <p className="text-sm text-red-600">{refundReviewModal.error}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button
                onClick={closeRefundReviewModal}
                disabled={Boolean(reviewingRefundBookingId)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRefundReview("reject")}
                disabled={Boolean(reviewingRefundBookingId)}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                {Boolean(reviewingRefundBookingId) && <Loader2 className="h-4 w-4 animate-spin" />}
                Reject
              </button>
              <button
                onClick={() => handleRefundReview("process")}
                disabled={Boolean(reviewingRefundBookingId)}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              >
                {Boolean(reviewingRefundBookingId) && <Loader2 className="h-4 w-4 animate-spin" />}
                Process
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentDetailsModal.open && paymentDetailsModal.record && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={closePaymentDetailsModal} />
          <div className="relative w-full max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Payment Details</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Booking {paymentDetailsModal.record.booking_code || `#${paymentDetailsModal.record.booking_id}`}
                </p>
              </div>
              <button
                onClick={closePaymentDetailsModal}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Tourist</p>
                  <p className="mt-1 text-sm font-semibold text-gray-800">{paymentDetailsModal.record.tourist_name || "-"}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Tourist Email</p>
                  <p className="mt-1 break-all text-sm font-semibold text-gray-800">{paymentDetailsModal.record.tourist_email || "-"}</p>
                </div>

                {paymentDetailsModal.bookingType === "guide_package" ? (
                  <>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">Service</p>
                      <p className="mt-1 text-sm font-semibold text-gray-800">{paymentDetailsModal.record.service_title || "-"}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">Guide</p>
                      <p className="mt-1 text-sm font-semibold text-gray-800">{paymentDetailsModal.record.guide_name || "-"}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">Homestay</p>
                      <p className="mt-1 text-sm font-semibold text-gray-800">{paymentDetailsModal.record.homestay_name || "-"}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">Host</p>
                      <p className="mt-1 text-sm font-semibold text-gray-800">{paymentDetailsModal.record.host_name || "-"}</p>
                    </div>
                  </>
                )}

                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Booking Status</p>
                  <p className="mt-1 text-sm font-semibold capitalize text-gray-800">{paymentDetailsModal.record.booking_status || "-"}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Amount</p>
                  <p className="mt-1 text-sm font-semibold text-gray-800">
                    NPR {Number(paymentDetailsModal.record.total_amount || 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Payment Status</p>
                  <p className="mt-1 text-sm font-semibold capitalize text-gray-800">{paymentDetailsModal.record.payment_status || "-"}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Refund Status</p>
                  <p className="mt-1 text-sm font-semibold capitalize text-gray-800">{normalizeRefundStatus(paymentDetailsModal.record) || "none"}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Provider</p>
                  <p className="mt-1 text-sm font-semibold capitalize text-gray-800">{paymentDetailsModal.record.payment_provider || "-"}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Initiated At</p>
                  <p className="mt-1 text-sm font-semibold text-gray-800">{formatDateTime(paymentDetailsModal.record.payment_initiated_at)}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 sm:col-span-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Payment Reference</p>
                  <p className="mt-1 break-all font-mono text-xs font-semibold text-gray-800">
                    {paymentDetailsModal.record.payment_ref_id || "-"}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 sm:col-span-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Transaction UUID</p>
                  <p className="mt-1 break-all font-mono text-xs font-semibold text-gray-800">
                    {paymentDetailsModal.record.transaction_uuid || "-"}
                  </p>
                </div>
                {paymentDetailsModal.record.refund_reference && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 sm:col-span-2">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Refund Reference</p>
                    <p className="mt-1 break-all font-mono text-xs font-semibold text-gray-800">
                      {paymentDetailsModal.record.refund_reference}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
              {(() => {
                const computedRefundStatus = normalizeRefundStatus(paymentDetailsModal.record);
                const isRefundPending = ["requested", "processing"].includes(computedRefundStatus);
                if (!isRefundPending) return null;

                return (
                  <button
                    onClick={() => {
                      openRefundReviewModal(paymentDetailsModal.record, paymentDetailsModal.bookingType);
                      closePaymentDetailsModal();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-gold to-gold-dark px-3 py-2 text-xs font-bold text-navy hover:shadow-md"
                  >
                    <Shield className="h-3.5 w-3.5" />
                    {computedRefundStatus === "processing" ? "Finalize Refund" : "Review Refund"}
                  </button>
                );
              })()}

              <button
                onClick={closePaymentDetailsModal}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
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