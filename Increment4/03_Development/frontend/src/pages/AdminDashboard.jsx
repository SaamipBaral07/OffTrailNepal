import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import {
  LogOut,
  Shield,
  Menu,
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
  TrendingUp,
  Users,
  Activity,
  Home,
  CheckCircle,
  XCircle,
  Eye,
  Mail,
  CreditCard,
  Building2,
  MessageSquare,
  Send,
  BarChart3,
} from "lucide-react";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import LogoutModal from "../components/LogoutModal";
import { useAuth } from "../context/AuthContext";
import { getToken } from "../tokenStore";
import { motion, AnimatePresence } from "framer-motion";

const API = "http://localhost:5000/api";
const PAYMENTS_PAGE_SIZE = 8;

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
  const valueText = String(value ?? "-");
  const hasLongValue = valueText.length > 10;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ delay, duration: 0.4 }}
      className={`relative ${a.bg} rounded-3xl p-4 sm:p-6 border border-gray-100/80 shadow-sm overflow-hidden group hover:shadow-lg transition-all duration-300`}
    >
      <div className={`inline-flex p-2.5 sm:p-3 rounded-2xl ${a.iconBg} mb-3 sm:mb-4 transition-transform duration-300 group-hover:scale-110`}>
        <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${a.icon}`} />
      </div>
      <p
        className={`${hasLongValue ? "text-2xl sm:text-3xl leading-tight" : "text-3xl sm:text-4xl"} font-bold ${a.text} font-heading tracking-tight break-words`}
      >
        {value}
      </p>
      <p className="text-xs sm:text-sm text-gray-500 mt-1 font-medium">{label}</p>
      
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

const ServiceApprovalBadge = ({ status }) => {
  const normalizedStatus = String(status || "pending").trim().toLowerCase();
  const config = {
    pending: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", dot: "bg-amber-500", label: "Pending" },
    approved: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500", label: "Approved" },
    rejected: { bg: "bg-red-50 border-red-200", text: "text-red-700", dot: "bg-red-500", label: "Rejected" },
  };
  const c = config[normalizedStatus] || config.pending;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
};

const TrailPhotoStatusBadge = ({ status }) => {
  const normalizedStatus = String(status || "pending").trim().toLowerCase();
  const config = {
    pending: "border-amber-200 bg-amber-50 text-amber-700",
    approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rejected: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${config[normalizedStatus] || config.pending}`}>
      {normalizedStatus}
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
  const [guideServicesAdmin, setGuideServicesAdmin] = useState([]);
  const [guideServicesLoading, setGuideServicesLoading] = useState(false);
  const [hostVerificationsAdmin, setHostVerificationsAdmin] = useState([]);
  const [hostVerificationsLoading, setHostVerificationsLoading] = useState(false);
  const [paymentRecords, setPaymentRecords] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [homestayPaymentsSummary, setHomestayPaymentsSummary] = useState({
    total_sessions: 0,
    successful_count: 0,
    pending_refunds: 0,
    settled_volume: 0,
  });
  const [homestayPaymentsPagination, setHomestayPaymentsPagination] = useState({
    page: 1,
    limit: PAYMENTS_PAGE_SIZE,
    total_records: 0,
    total_pages: 1,
    has_prev: false,
    has_next: false,
  });
  const [guidePaymentRecords, setGuidePaymentRecords] = useState([]);
  const [guidePaymentsLoading, setGuidePaymentsLoading] = useState(false);
  const [guidePaymentsSummary, setGuidePaymentsSummary] = useState({
    total_sessions: 0,
    successful_count: 0,
    pending_refunds: 0,
    settled_volume: 0,
  });
  const [guidePaymentsPagination, setGuidePaymentsPagination] = useState({
    page: 1,
    limit: PAYMENTS_PAGE_SIZE,
    total_records: 0,
    total_pages: 1,
    has_prev: false,
    has_next: false,
  });
  const [contactEnquiries, setContactEnquiries] = useState([]);
  const [contactEnquiriesLoading, setContactEnquiriesLoading] = useState(false);
  const [contactEnquiriesPagination, setContactEnquiriesPagination] = useState({
    page: 1,
    limit: 20,
    total_records: 0,
    total_pages: 1,
    has_prev: false,
    has_next: false,
  });
  const [contactEnquiriesSummary, setContactEnquiriesSummary] = useState({
    total_records: 0,
    last_24h: 0,
    booking_related: 0,
    replied_count: 0,
    pending_reply_count: 0,
  });
  const [platformReviewsAdmin, setPlatformReviewsAdmin] = useState([]);
  const [platformReviewsAdminLoading, setPlatformReviewsAdminLoading] = useState(false);
  const [platformReviewsAdminSummary, setPlatformReviewsAdminSummary] = useState({
    total_reviews: 0,
    featured_count: 0,
    average_rating: 0,
  });
  const [updatingFeaturedReviewId, setUpdatingFeaturedReviewId] = useState(null);
  const [platformReviewNotice, setPlatformReviewNotice] = useState(null);
  const [trailPhotoSubmissions, setTrailPhotoSubmissions] = useState([]);
  const [trailPhotoSubmissionsLoading, setTrailPhotoSubmissionsLoading] = useState(false);
  const [trailPhotoSubmissionFilter, setTrailPhotoSubmissionFilter] = useState("all");
  const [trailPhotoSubmissionSummary, setTrailPhotoSubmissionSummary] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [contactReplyDrafts, setContactReplyDrafts] = useState({});
  const [submittingContactReplyId, setSubmittingContactReplyId] = useState(null);
  const [contactReplyNotice, setContactReplyNotice] = useState(null);
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
  const [hostVerificationQueueModalOpen, setHostVerificationQueueModalOpen] = useState(false);
  const [bankDetailsModalOpen, setBankDetailsModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const derivePaymentSummaryFromRecords = useCallback((records) => {
    const safeRecords = Array.isArray(records) ? records : [];

    const totalSessions = safeRecords.length;
    const successfulCount = safeRecords.filter(
      (record) => String(record.payment_status || "").trim().toLowerCase() === "success"
    ).length;

    const pendingRefunds = safeRecords.filter((record) => {
      const paymentStatus = String(record.payment_status || "").trim().toLowerCase();
      const directRefundStatus = String(record.refund_status || "").trim().toLowerCase();
      const normalizedRefundStatus =
        directRefundStatus ||
        (paymentStatus === "refund_requested"
          ? "requested"
          : paymentStatus === "refunded"
            ? "processed"
            : "");
      return ["requested", "processing"].includes(normalizedRefundStatus);
    }).length;

    const settledVolume = safeRecords
      .filter((record) => String(record.payment_status || "").trim().toLowerCase() === "success")
      .reduce((sum, record) => sum + Number(record.total_amount || 0), 0);

    return {
      total_sessions: totalSessions,
      successful_count: successfulCount,
      pending_refunds: pendingRefunds,
      settled_volume: settledVolume,
    };
  }, []);

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

  const fetchAdminGuideServices = useCallback(async () => {
    setGuideServicesLoading(true);
    try {
      const res = await api.get(`${API}/guides/admin/services`);
      setGuideServicesAdmin(Array.isArray(res.data?.services) ? res.data.services : []);
    } catch (err) {
      console.error("Error fetching guide services for admin:", err);
      setGuideServicesAdmin([]);
    } finally {
      setGuideServicesLoading(false);
    }
  }, []);

  const fetchAdminHostVerifications = useCallback(async () => {
    setHostVerificationsLoading(true);
    try {
      const res = await api.get(`${API}/homestays/admin/hosts/all`);
      setHostVerificationsAdmin(res.data.hosts || []);
    } catch (err) {
      console.error("Error fetching host verifications for admin:", err);
      setHostVerificationsAdmin([]);
    } finally {
      setHostVerificationsLoading(false);
    }
  }, []);

  const fetchAdminPayments = useCallback(async (requestedPage = 1) => {
    setPaymentsLoading(true);
    try {
      const res = await api.get(`${API}/bookings/admin/payments`, {
        params: {
          page: requestedPage,
          limit: PAYMENTS_PAGE_SIZE,
        },
      });

      const records = Array.isArray(res.data?.records) ? res.data.records : [];
      const summary = res.data?.summary || null;
      const pagination = res.data?.pagination || null;

      const derivedSummary = derivePaymentSummaryFromRecords(records);
      const summaryTotalFromServer = Number(
        summary?.total_sessions ?? summary?.totalSessions ?? 0
      );
      const shouldFallbackSummary = !summary || (summaryTotalFromServer === 0 && records.length > 0);

      const normalizedSummary = shouldFallbackSummary
        ? derivedSummary
        : {
            total_sessions: Number(summary?.total_sessions ?? summary?.totalSessions ?? derivedSummary.total_sessions),
            successful_count: Number(summary?.successful_count ?? summary?.successfulCount ?? derivedSummary.successful_count),
            pending_refunds: Number(summary?.pending_refunds ?? summary?.pendingRefunds ?? derivedSummary.pending_refunds),
            settled_volume: Number(summary?.settled_volume ?? summary?.settledVolume ?? derivedSummary.settled_volume),
          };

      const paginationTotalPages = Number(pagination?.total_pages ?? pagination?.totalPages ?? 0);
      const hasServerPagination = pagination && Number.isInteger(paginationTotalPages) && paginationTotalPages > 0;

      let normalizedRecords = records;
      let page = 1;
      let totalPages = 1;
      let totalRecords = records.length;

      if (hasServerPagination) {
        page = Number(pagination?.page ?? requestedPage ?? 1);
        totalPages = paginationTotalPages;
        totalRecords = Number(pagination?.total_records ?? pagination?.totalRecords ?? records.length);
      } else {
        totalRecords = records.length;
        totalPages = Math.max(1, Math.ceil(totalRecords / PAYMENTS_PAGE_SIZE));
        page = Math.min(Math.max(1, Number(requestedPage || 1)), totalPages);
        const start = (page - 1) * PAYMENTS_PAGE_SIZE;
        normalizedRecords = records.slice(start, start + PAYMENTS_PAGE_SIZE);
      }

      setPaymentRecords(normalizedRecords);
      setHomestayPaymentsSummary(normalizedSummary);
      setHomestayPaymentsPagination({
        page,
        limit: Number(pagination?.limit ?? pagination?.pageSize ?? PAYMENTS_PAGE_SIZE),
        total_records: totalRecords,
        total_pages: totalPages,
        has_prev: page > 1,
        has_next: page < totalPages,
      });
    } catch (err) {
      console.error("Error fetching admin payment records:", err);
      setPaymentRecords([]);
      setHomestayPaymentsSummary({
        total_sessions: 0,
        successful_count: 0,
        pending_refunds: 0,
        settled_volume: 0,
      });
      setHomestayPaymentsPagination((prev) => ({
        ...prev,
        total_records: 0,
        total_pages: 1,
        has_prev: false,
        has_next: false,
      }));
    } finally {
      setPaymentsLoading(false);
    }
  }, [derivePaymentSummaryFromRecords]);

  const fetchAdminGuidePayments = useCallback(async (requestedPage = 1) => {
    setGuidePaymentsLoading(true);
    try {
      const res = await api.get(`${API}/guide-bookings/admin/payments`, {
        params: {
          page: requestedPage,
          limit: PAYMENTS_PAGE_SIZE,
        },
      });

      const records = Array.isArray(res.data?.records) ? res.data.records : [];
      const summary = res.data?.summary || null;
      const pagination = res.data?.pagination || null;

      const derivedSummary = derivePaymentSummaryFromRecords(records);
      const summaryTotalFromServer = Number(
        summary?.total_sessions ?? summary?.totalSessions ?? 0
      );
      const shouldFallbackSummary = !summary || (summaryTotalFromServer === 0 && records.length > 0);

      const normalizedSummary = shouldFallbackSummary
        ? derivedSummary
        : {
            total_sessions: Number(summary?.total_sessions ?? summary?.totalSessions ?? derivedSummary.total_sessions),
            successful_count: Number(summary?.successful_count ?? summary?.successfulCount ?? derivedSummary.successful_count),
            pending_refunds: Number(summary?.pending_refunds ?? summary?.pendingRefunds ?? derivedSummary.pending_refunds),
            settled_volume: Number(summary?.settled_volume ?? summary?.settledVolume ?? derivedSummary.settled_volume),
          };

      const paginationTotalPages = Number(pagination?.total_pages ?? pagination?.totalPages ?? 0);
      const hasServerPagination = pagination && Number.isInteger(paginationTotalPages) && paginationTotalPages > 0;

      let normalizedRecords = records;
      let page = 1;
      let totalPages = 1;
      let totalRecords = records.length;

      if (hasServerPagination) {
        page = Number(pagination?.page ?? requestedPage ?? 1);
        totalPages = paginationTotalPages;
        totalRecords = Number(pagination?.total_records ?? pagination?.totalRecords ?? records.length);
      } else {
        totalRecords = records.length;
        totalPages = Math.max(1, Math.ceil(totalRecords / PAYMENTS_PAGE_SIZE));
        page = Math.min(Math.max(1, Number(requestedPage || 1)), totalPages);
        const start = (page - 1) * PAYMENTS_PAGE_SIZE;
        normalizedRecords = records.slice(start, start + PAYMENTS_PAGE_SIZE);
      }

      setGuidePaymentRecords(normalizedRecords);
      setGuidePaymentsSummary(normalizedSummary);
      setGuidePaymentsPagination({
        page,
        limit: Number(pagination?.limit ?? pagination?.pageSize ?? PAYMENTS_PAGE_SIZE),
        total_records: totalRecords,
        total_pages: totalPages,
        has_prev: page > 1,
        has_next: page < totalPages,
      });
    } catch (err) {
      console.error("Error fetching admin guide payment records:", err);
      setGuidePaymentRecords([]);
      setGuidePaymentsSummary({
        total_sessions: 0,
        successful_count: 0,
        pending_refunds: 0,
        settled_volume: 0,
      });
      setGuidePaymentsPagination((prev) => ({
        ...prev,
        total_records: 0,
        total_pages: 1,
        has_prev: false,
        has_next: false,
      }));
    } finally {
      setGuidePaymentsLoading(false);
    }
  }, [derivePaymentSummaryFromRecords]);

  const fetchAdminContactEnquiries = useCallback(async (requestedPage = 1) => {
    setContactEnquiriesLoading(true);
    try {
      const res = await api.get(`${API}/contact/enquiries/admin`, {
        params: {
          page: requestedPage,
          limit: 20,
        },
      });

      setContactEnquiries(Array.isArray(res.data?.enquiries) ? res.data.enquiries : []);
      setContactEnquiriesSummary({
        total_records: Number(res.data?.summary?.total_records || 0),
        last_24h: Number(res.data?.summary?.last_24h || 0),
        booking_related: Number(res.data?.summary?.booking_related || 0),
        replied_count: Number(res.data?.summary?.replied_count || 0),
        pending_reply_count: Number(res.data?.summary?.pending_reply_count || 0),
      });
      setContactEnquiriesPagination({
        page: Number(res.data?.pagination?.page || requestedPage || 1),
        limit: Number(res.data?.pagination?.limit || 20),
        total_records: Number(res.data?.pagination?.total_records || 0),
        total_pages: Number(res.data?.pagination?.total_pages || 1),
        has_prev: Boolean(res.data?.pagination?.has_prev),
        has_next: Boolean(res.data?.pagination?.has_next),
      });
    } catch (err) {
      console.error("Error fetching admin contact enquiries:", err);
      setContactEnquiries([]);
      setContactEnquiriesSummary({
        total_records: 0,
        last_24h: 0,
        booking_related: 0,
        replied_count: 0,
        pending_reply_count: 0,
      });
      setContactEnquiriesPagination((prev) => ({
        ...prev,
        page: 1,
        total_records: 0,
        total_pages: 1,
        has_prev: false,
        has_next: false,
      }));
    } finally {
      setContactEnquiriesLoading(false);
    }
  }, []);

  const fetchAdminPlatformReviews = useCallback(async () => {
    setPlatformReviewsAdminLoading(true);
    try {
      const res = await api.get(`${API}/contact/testimonials/admin`, {
        params: {
          page: 1,
          limit: 20,
        },
      });

      setPlatformReviewsAdmin(Array.isArray(res.data?.reviews) ? res.data.reviews : []);
      setPlatformReviewsAdminSummary({
        total_reviews: Number(res.data?.summary?.total_reviews || 0),
        featured_count: Number(res.data?.summary?.featured_count || 0),
        average_rating: Number(res.data?.summary?.average_rating || 0),
      });
    } catch (err) {
      console.error("Error fetching platform reviews for admin:", err);
      setPlatformReviewsAdmin([]);
      setPlatformReviewsAdminSummary({
        total_reviews: 0,
        featured_count: 0,
        average_rating: 0,
      });
    } finally {
      setPlatformReviewsAdminLoading(false);
    }
  }, []);

  const fetchAdminTrailPhotoSubmissions = useCallback(async (statusFilter = "all") => {
    setTrailPhotoSubmissionsLoading(true);

    try {
      const res = await api.get(`${API}/trails/admin/community-photos`, {
        params: { status: statusFilter || "all" },
      });

      setTrailPhotoSubmissions(Array.isArray(res.data?.submissions) ? res.data.submissions : []);
      setTrailPhotoSubmissionSummary({
        pending: Number(res.data?.summary?.pending || 0),
        approved: Number(res.data?.summary?.approved || 0),
        rejected: Number(res.data?.summary?.rejected || 0),
      });
    } catch (err) {
      console.error("Error fetching trail photo submissions:", err);
      setTrailPhotoSubmissions([]);
      setTrailPhotoSubmissionSummary({
        pending: 0,
        approved: 0,
        rejected: 0,
      });
    } finally {
      setTrailPhotoSubmissionsLoading(false);
    }
  }, []);

  const goToHomestayPaymentsPage = (nextPage) => {
    if (paymentsLoading) return;
    if (nextPage < 1 || nextPage > Number(homestayPaymentsPagination.total_pages || 1)) return;
    fetchAdminPayments(nextPage);
  };

  const goToGuidePaymentsPage = (nextPage) => {
    if (guidePaymentsLoading) return;
    if (nextPage < 1 || nextPage > Number(guidePaymentsPagination.total_pages || 1)) return;
    fetchAdminGuidePayments(nextPage);
  };

  const goToContactEnquiriesPage = (nextPage) => {
    if (contactEnquiriesLoading) return;
    if (nextPage < 1 || nextPage > Number(contactEnquiriesPagination.total_pages || 1)) return;
    fetchAdminContactEnquiries(nextPage);
  };

  const pushContactReplyNotice = useCallback((type, message) => {
    const noticeId = Date.now();
    setContactReplyNotice({ id: noticeId, type, message });

    window.setTimeout(() => {
      setContactReplyNotice((prev) => (prev?.id === noticeId ? null : prev));
    }, 7000);
  }, []);

  const pushPlatformReviewNotice = useCallback((type, message) => {
    const noticeId = Date.now();
    setPlatformReviewNotice({ id: noticeId, type, message });

    window.setTimeout(() => {
      setPlatformReviewNotice((prev) => (prev?.id === noticeId ? null : prev));
    }, 7000);
  }, []);

  const handleAdminContactReply = async (entry) => {
    const enquiryId = Number(entry?.enquiry_id);
    if (!Number.isInteger(enquiryId) || enquiryId <= 0) return;

    const existingReply = String(entry?.admin_reply_message || "").trim();
    const draftValue = Object.prototype.hasOwnProperty.call(contactReplyDrafts, enquiryId)
      ? contactReplyDrafts[enquiryId]
      : existingReply;
    const replyMessage = String(draftValue || "").trim();

    if (replyMessage.length < 8) {
      pushContactReplyNotice("error", "Reply message must be at least 8 characters.");
      return;
    }

    setSubmittingContactReplyId(enquiryId);

    try {
      const res = await api.post(`${API}/contact/enquiries/${enquiryId}/reply`, {
        replyMessage,
      });

      setContactReplyDrafts((prev) => ({
        ...prev,
        [enquiryId]: String(res.data?.enquiry?.admin_reply_message || replyMessage),
      }));
      pushContactReplyNotice("success", "Reply sent to this enquiry.");
      await fetchAdminContactEnquiries(contactEnquiriesPagination.page || 1);
    } catch (err) {
      console.error("Error replying to contact enquiry:", err);
      pushContactReplyNotice("error", err.response?.data?.message || "Failed to send reply.");
    } finally {
      setSubmittingContactReplyId(null);
    }
  };

  const handleTogglePlatformReviewFeatured = async (reviewId, shouldFeature) => {
    const parsedReviewId = Number(reviewId);
    if (!Number.isInteger(parsedReviewId) || parsedReviewId <= 0) return;

    setUpdatingFeaturedReviewId(parsedReviewId);
    try {
      const res = await api.patch(`${API}/contact/testimonials/${parsedReviewId}/featured`, {
        featured: Boolean(shouldFeature),
      });

      pushPlatformReviewNotice("success", res.data?.message || "Review selection updated.");
      await fetchAdminPlatformReviews();
    } catch (err) {
      console.error("Error updating featured platform review:", err);
      pushPlatformReviewNotice(
        "error",
        err.response?.data?.message || "Failed to update testimonial selection."
      );
    } finally {
      setUpdatingFeaturedReviewId(null);
    }
  };

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
      fetchAdminHostVerifications();
      fetchAdminGuides();
      fetchAdminGuideServices();
      fetchAdminPayments();
      fetchAdminGuidePayments();
      fetchAdminContactEnquiries();
      fetchAdminPlatformReviews();
      fetchAdminTrailPhotoSubmissions("all");
    }
  }, [isLoading, user, fetchTrails, fetchAdminHomestays, fetchAdminHostVerifications, fetchAdminGuides, fetchAdminGuideServices, fetchAdminPayments, fetchAdminGuidePayments, fetchAdminContactEnquiries, fetchAdminPlatformReviews, fetchAdminTrailPhotoSubmissions]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("resize", handleResize);
    };
  }, [mobileMenuOpen]);

  const handleHomestayStatus = async (id, status) => {
    try {
      let rejection_reason = "";
      if (status === "rejected") {
        rejection_reason = window.prompt("Add rejection reason for this homestay:") || "";
        if (!rejection_reason.trim()) {
          alert("Rejection reason is required.");
          return;
        }
      }

      await api.patch(`${API}/homestays/admin/${id}/status`, {
        verified_status: status,
        rejection_reason,
      });
      fetchAdminHomestays();
    } catch (err) {
      console.error("Error updating homestay status:", err);
      alert(err.response?.data?.message || "Failed to update status");
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
      fetchAdminGuideServices();
    } catch (err) {
      console.error("Error updating guide verification status:", err);
      alert(err.response?.data?.message || "Failed to update guide verification status");
    }
  };

  const handleGuideServiceApprovalStatus = async (serviceId, status) => {
    try {
      let rejection_reason = "";
      if (status === "rejected") {
        rejection_reason = window.prompt("Add rejection reason for this guide service:") || "";
        if (!rejection_reason.trim()) {
          alert("Rejection reason is required.");
          return;
        }
      }

      await api.patch(`${API}/guides/admin/services/${serviceId}/approval-status`, {
        approval_status: status,
        rejection_reason,
      });

      fetchAdminGuideServices();
      fetchAdminGuides();
    } catch (err) {
      console.error("Error updating guide service approval status:", err);
      alert(err.response?.data?.message || "Failed to update guide service approval status");
    }
  };

  const handleHostVerificationStatus = async (hostId, status) => {
    try {
      let rejection_reason = "";
      if (status === "rejected") {
        rejection_reason = window.prompt("Add rejection reason for this host:") || "";
        if (!rejection_reason.trim()) {
          alert("Rejection reason is required.");
          return;
        }
      }

      await api.patch(`${API}/homestays/admin/hosts/${hostId}/verification-status`, {
        verification_status: status,
        rejection_reason,
      });

      fetchAdminHostVerifications();
      fetchAdminHomestays();
    } catch (err) {
      console.error("Error updating host verification status:", err);
      alert(err.response?.data?.message || "Failed to update host verification status");
    }
  };

  const handleTrailPhotoSubmissionReview = async (submissionId, status) => {
    try {
      let reviewNote = "";
      if (status === "rejected") {
        reviewNote = window.prompt("Add rejection reason for this photo submission:") || "";
        if (!reviewNote.trim() || reviewNote.trim().length < 8) {
          alert("A clear rejection reason (minimum 8 characters) is required.");
          return;
        }
      }

      await api.patch(`${API}/trails/admin/community-photos/${submissionId}/review`, {
        status,
        review_note: reviewNote.trim() || null,
      });

      fetchAdminTrailPhotoSubmissions(trailPhotoSubmissionFilter);
    } catch (err) {
      console.error("Error reviewing trail photo submission:", err);
      alert(err.response?.data?.message || "Failed to review trail photo submission");
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
  const submittedHostVerifications = hostVerificationsAdmin.filter((h) => h.verification_status !== "not_submitted");
  const pendingHostVerifications = submittedHostVerifications.filter((h) => h.verification_status === "pending").length;
  const hostBankProfiles = hostVerificationsAdmin.filter(
    (h) => Boolean(h.bank_name || h.bank_account_name || h.bank_account_number)
  );
  const guideBankProfiles = guidesAdmin.filter(
    (g) => Boolean(g.bank_name || g.bank_account_name || g.bank_account_number)
  );
  const totalBankProfiles = hostBankProfiles.length + guideBankProfiles.length;

  // Homestay Payment Metrics
  const homestaySuccessfulPayments = Number(homestayPaymentsSummary.successful_count || 0);
  const homestayPendingRefunds = Number(homestayPaymentsSummary.pending_refunds || 0);
  const homestayRevenue = Number(homestayPaymentsSummary.settled_volume || 0);

  // Guide Payment Metrics
  const guideSuccessfulPayments = Number(guidePaymentsSummary.successful_count || 0);
  const guidePendingRefunds = Number(guidePaymentsSummary.pending_refunds || 0);
  const guideRevenue = Number(guidePaymentsSummary.settled_volume || 0);
  const totalContactEnquiries = Number(contactEnquiriesSummary.total_records || 0);
  const recentContactEnquiries = Number(contactEnquiriesSummary.last_24h || 0);
  const bookingContactEnquiries = Number(contactEnquiriesSummary.booking_related || 0);
  const pendingReplyContactEnquiries = Number(contactEnquiriesSummary.pending_reply_count || 0);
  const pendingTrailPhotoSubmissions = Number(trailPhotoSubmissionSummary.pending || 0);
  const approvedTrailPhotoSubmissions = Number(trailPhotoSubmissionSummary.approved || 0);
  const rejectedTrailPhotoSubmissions = Number(trailPhotoSubmissionSummary.rejected || 0);

  const adminNavItems = [
    { id: "trails", icon: Mountain, label: "Trekking Trails", title: "Trail Management", count: trails.length },
    {
      id: "homestays",
      icon: Home,
      label: "Homestay Approvals",
      title: "Homestay Approvals",
      count: pendingHomestays + pendingHostVerifications > 0 ? pendingHomestays + pendingHostVerifications : null,
      countType: "alert",
    },
    { id: "guides", icon: Compass, label: "Guides Management", title: "Guides Management" },
    {
      id: "contact-enquiries",
      icon: MessageSquare,
      label: "Contact Enquiries",
      title: "Contact Enquiries",
      count: recentContactEnquiries > 0 ? recentContactEnquiries : null,
      countType: "alert",
    },
    {
      id: "trail-photos",
      icon: Image,
      label: "Trail Photo Reviews",
      title: "Trail Community Photos",
      count: pendingTrailPhotoSubmissions > 0 ? pendingTrailPhotoSubmissions : null,
      countType: "alert",
    },
    {
      id: "homestay-payments",
      icon: CreditCard,
      label: "Homestay Payments",
      title: "Homestay Booking Payments",
      count: homestayPendingRefunds > 0 ? homestayPendingRefunds : null,
      countType: "alert",
    },
    {
      id: "guide-payments",
      icon: Briefcase,
      label: "Guide Payments",
      title: "Guide Booking Payments",
      count: guidePendingRefunds > 0 ? guidePendingRefunds : null,
      countType: "alert",
    },
  ];

  const activeTabTitle =
    adminNavItems.find((item) => item.id === activeTab)?.title || "Admin Control Center";

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex font-body">
      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-72 bg-navy border-r border-navy-light/30 fixed inset-y-0 shadow-2xl z-50 overflow-hidden">
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
        <nav className="flex-1 min-h-0 overflow-y-auto px-4 py-8 pr-2 space-y-2">
          <p className="px-4 mb-4 text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">
            Overview
          </p>
          {adminNavItems.map((item) => (
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
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/admin-profile"
              title="My Profile"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10"
            >
              <Shield className="h-4 w-4" />
              <span className="sr-only">My Profile</span>
            </Link>
            <button
              type="button"
              onClick={setShowLogoutModal}
              title="Sign Out"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors border border-red-500/20 hover:border-red-500/40"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 lg:ml-72 flex flex-col min-h-screen relative overflow-hidden">
        {/* Background Decorative Element */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-br from-gold/5 via-alpine/5 to-transparent rounded-full blur-3xl -z-10 transform translate-x-1/3 -translate-y-1/3 pointer-events-none" />

        <header className="lg:hidden bg-white/95 backdrop-blur border-b border-gray-200/70 px-4 py-4 sticky top-0 z-30 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-navy font-heading font-bold text-2xl leading-tight">{activeTabTitle}</h1>
              <p className="text-gray-500 text-xs mt-1 font-medium">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-navy/15 bg-white text-navy shadow-sm"
              aria-label="Open admin navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {adminNavItems.map((item) => (
              <button
                key={`mobile-tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  activeTab === item.id
                    ? "bg-navy text-white border-navy"
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
                {item.count ? (
                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeTab === item.id ? "bg-white/15 text-white" : "bg-gray-100 text-gray-700"}`}>
                    {item.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setBankDetailsModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-semibold text-blue-700"
            >
              <Building2 className="h-4 w-4" />
              <span>Bank Details</span>
            </button>
            <Link
              to="/admin-analytics"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gold/50 bg-gold/15 px-3 py-2 text-[11px] font-semibold text-navy"
            >
              <BarChart3 className="h-4 w-4" />
              <span>Reports</span>
            </Link>
          </div>
        </header>

        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <motion.button
                type="button"
                className="lg:hidden fixed inset-0 z-40 bg-black/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu overlay"
              />

              <motion.aside
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                className="lg:hidden fixed inset-y-0 right-0 z-50 w-[86%] max-w-sm bg-white border-l border-gray-200 shadow-2xl flex flex-col"
              >
                <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-navy to-navy-light">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-gold font-bold">Admin Navigation</p>
                      <h2 className="text-white font-heading font-bold text-lg mt-1">Control Center</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMobileMenuOpen(false)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
                      aria-label="Close admin menu"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
                  {adminNavItems.map((item) => (
                    <button
                      key={`drawer-${item.id}`}
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm font-semibold transition-colors ${
                        activeTab === item.id
                          ? "border-navy bg-navy/5 text-navy"
                          : "border-gray-200 bg-white text-gray-700"
                      }`}
                    >
                      <item.icon className="h-4.5 w-4.5" />
                      <span>{item.label}</span>
                      {item.count ? (
                        <span className="ml-auto inline-flex min-w-5 justify-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-700">
                          {item.count}
                        </span>
                      ) : null}
                    </button>
                  ))}

                  <Link
                    to="/admin-profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm font-semibold text-gray-700"
                  >
                    <Shield className="h-4.5 w-4.5" />
                    Admin Profile
                  </Link>

                  <Link
                    to="/admin-analytics"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm font-semibold text-gray-700"
                  >
                    <BarChart3 className="h-4.5 w-4.5" />
                    Reporting Dashboard
                  </Link>
                </nav>

                <div className="px-4 py-4 border-t border-gray-100 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setShowLogoutModal(true);
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
        
        {/* Top bar */}
        <header className="hidden lg:flex bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-8 py-5 items-center justify-between sticky top-0 z-20 shadow-sm">
          <div>
            <h1 className="text-navy font-heading font-bold text-2xl tracking-tight">{activeTabTitle}</h1>
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

            <button
              type="button"
              onClick={() => setBankDetailsModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors shadow-sm"
            >
              <Building2 className="h-4 w-4" />
              <span>Bank Details</span>
              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                {totalBankProfiles}
              </span>
            </button>

            <Link
              to="/admin-analytics"
              className="inline-flex items-center gap-2 rounded-full border border-gold/50 bg-gold/15 px-4 py-2 text-xs font-semibold text-navy hover:bg-gold/25 transition-colors shadow-sm"
            >
              <BarChart3 className="h-4 w-4" />
              <span>Reports</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 z-10 w-full max-w-[1600px] mx-auto">
          {/* Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
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

            {activeTab === "contact-enquiries" && (
              <>
                <StatCard icon={MessageSquare} label="Total Enquiries" value={totalContactEnquiries} accent="navy" delay={0.1} />
                <StatCard icon={Activity} label="Received In 24h" value={recentContactEnquiries} accent="gold" delay={0.2} />
                <StatCard icon={Briefcase} label="Booking Related" value={bookingContactEnquiries} accent="charcoal" delay={0.3} />
                <StatCard icon={Mail} label="Awaiting Reply" value={pendingReplyContactEnquiries} accent="alpine" delay={0.4} />
              </>
            )}

            {activeTab === "trail-photos" && (
              <>
                <StatCard icon={Image} label="Pending Reviews" value={pendingTrailPhotoSubmissions} accent="gold" delay={0.1} />
                <StatCard icon={CheckCircle} label="Approved" value={approvedTrailPhotoSubmissions} accent="alpine" delay={0.2} />
                <StatCard icon={XCircle} label="Rejected" value={rejectedTrailPhotoSubmissions} accent="charcoal" delay={0.3} />
                <StatCard icon={Users} label="Displayed" value={trailPhotoSubmissions.length} accent="navy" delay={0.4} />
              </>
            )}

            {activeTab === "homestay-payments" && (
              <>
                <StatCard icon={CreditCard} label="Payment Sessions" value={homestayPaymentsSummary.total_sessions} accent="navy" delay={0.1} />
                <StatCard icon={CheckCircle} label="Successful" value={homestaySuccessfulPayments} accent="alpine" delay={0.2} />
                <StatCard icon={TrendingUp} label="Refund Queue" value={homestayPendingRefunds} accent="charcoal" delay={0.3} />
                <StatCard icon={DollarSign} label="Settled Volume" value={`NPR ${homestayRevenue.toLocaleString()}`} accent="gold" delay={0.4} />
              </>
            )}

            {activeTab === "guide-payments" && (
              <>
                <StatCard icon={Briefcase} label="Guide Sessions" value={guidePaymentsSummary.total_sessions} accent="navy" delay={0.1} />
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
                <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Host Verification Queue</p>
                      <p className="text-sm text-amber-800">Review submitted citizenship documents in a dedicated queue modal.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-bold text-amber-700">
                        Pending: {pendingHostVerifications}
                      </span>
                      <button
                        type="button"
                        onClick={() => setHostVerificationQueueModalOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                      >
                        <Eye className="h-3.5 w-3.5" /> Open Queue
                      </button>
                    </div>
                  </div>
                </div>

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
                        {(() => {
                          const guideServices = guideServicesAdmin.filter(
                            (service) => Number(service.guide_id) === Number(g.guide_id)
                          );
                          const pendingServices = guideServices.filter(
                            (service) => String(service.approval_status || "").toLowerCase() === "pending"
                          );
                          const approvedServices = guideServices.filter(
                            (service) => String(service.approval_status || "").toLowerCase() === "approved"
                          );

                          return (
                            <>
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

                        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Guide Services</p>
                            <span className="text-[11px] font-semibold text-amber-700">
                              {pendingServices.length} pending
                            </span>
                          </div>

                          {guideServicesLoading ? (
                            <p className="text-xs text-gray-400">Loading guide service approvals...</p>
                          ) : guideServices.length === 0 ? (
                            <p className="text-xs text-gray-500">No guide services created yet.</p>
                          ) : (
                            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                              {guideServices.map((service) => (
                                <div key={service.service_id} className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-gray-800 truncate">{service.title}</p>
                                      <p className="text-[11px] text-gray-500 truncate">
                                        {service.trail_name} · NPR {Number(service.price_per_day || 0).toLocaleString()}/day
                                      </p>
                                    </div>
                                    <ServiceApprovalBadge status={service.approval_status} />
                                  </div>

                                  {String(service.approval_status || "").toLowerCase() === "pending" && (
                                    <div className="mt-2 flex gap-2">
                                      <button
                                        onClick={() => handleGuideServiceApprovalStatus(service.service_id, "approved")}
                                        className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-md"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => handleGuideServiceApprovalStatus(service.service_id, "rejected")}
                                        className="px-2.5 py-1 text-[11px] font-semibold bg-red-500 hover:bg-red-600 text-white rounded-md"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  )}

                                  {String(service.approval_status || "").toLowerCase() === "rejected" && service.approval_rejection_reason && (
                                    <p className="mt-1 text-[11px] text-red-600">Reason: {service.approval_rejection_reason}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {!guideServicesLoading && guideServices.length > 0 && (
                            <p className="mt-2 text-[10px] text-gray-500">
                              Approved: {approvedServices.length} / Total: {guideServices.length}
                            </p>
                          )}
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
                            </>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "contact-enquiries" && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-100">
                    <MessageSquare className="h-4 w-4 text-amber-500" />
                  </div>
                  <div>
                    <h2 className="text-gray-900 font-semibold text-base">Submitted Contact Enquiries</h2>
                    <p className="text-gray-400 text-xs">Direct messages from users and visitors via the Contact page</p>
                  </div>
                </div>
                <button
                  onClick={() => Promise.all([
                    fetchAdminContactEnquiries(contactEnquiriesPagination.page || 1),
                    fetchAdminPlatformReviews(),
                  ])}
                  disabled={contactEnquiriesLoading || platformReviewsAdminLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                >
                  {contactEnquiriesLoading || platformReviewsAdminLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
                  Refresh
                </button>
              </div>

              <div className="p-6 space-y-5">
                {contactReplyNotice && (
                  <div
                    className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                      contactReplyNotice.type === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-red-200 bg-red-50 text-red-700"
                    }`}
                  >
                    {contactReplyNotice.message}
                  </div>
                )}

                <div className="rounded-2xl border border-gold/25 bg-gold/5 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-gold-dark">Testimonials Selection</p>
                      <p className="text-sm text-gray-700 mt-1">Select up to 3 tourist reviews for landing page testimonial cards.</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="inline-flex rounded-full border border-gold/40 bg-white px-2.5 py-1 font-bold text-gold-dark">
                        Featured: {Number(platformReviewsAdminSummary.featured_count || 0)}/3
                      </span>
                      <span className="inline-flex rounded-full border border-gray-200 bg-white px-2.5 py-1 font-semibold text-gray-600">
                        Avg Rating: {Number(platformReviewsAdminSummary.average_rating || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {platformReviewNotice && (
                    <div
                      className={`mt-3 rounded-xl border px-4 py-2.5 text-sm font-medium ${
                        platformReviewNotice.type === "success"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-red-200 bg-red-50 text-red-700"
                      }`}
                    >
                      {platformReviewNotice.message}
                    </div>
                  )}

                  {platformReviewsAdminLoading ? (
                    <div className="mt-4 flex items-center justify-center rounded-xl border border-gray-200 bg-white py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-gold-dark" />
                    </div>
                  ) : platformReviewsAdmin.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">
                      No tourist platform reviews submitted yet.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {platformReviewsAdmin.map((review) => {
                        const normalizedRating = Math.min(5, Math.max(1, Number(review.rating || 1)));
                        const isFeatured = Boolean(review.is_featured);
                        const isUpdating = updatingFeaturedReviewId === Number(review.review_id);
                        const featuredLimitReached =
                          Number(platformReviewsAdminSummary.featured_count || 0) >= 3;
                        const reviewerLocation =
                          String(review.reviewer_location || "").trim() || "Verified Trekker";

                        return (
                          <div
                            key={review.review_id}
                            className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex items-center gap-3">
                                  <div className="h-11 w-11 rounded-full overflow-hidden bg-gradient-to-br from-navy to-navy-light text-white font-bold text-sm flex items-center justify-center">
                                    {review.profile_image_path ? (
                                      <img
                                        src={`http://localhost:5000${review.profile_image_path}`}
                                        alt={review.tourist_name || "Trekker"}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      String(review.tourist_name || "T").charAt(0).toUpperCase()
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold text-gray-900 truncate">{review.tourist_name}</p>
                                    <p className="text-xs text-gray-500 truncate">{review.tourist_email}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{reviewerLocation}</p>
                                  </div>
                                </div>

                                <div className="mt-2 flex items-center gap-1">
                                  {Array.from({ length: 5 }).map((_, idx) => (
                                    <Star
                                      key={`${review.review_id}-star-${idx}`}
                                      className={`h-3.5 w-3.5 ${idx < normalizedRating ? "text-gold fill-gold" : "text-gray-200"}`}
                                    />
                                  ))}
                                </div>

                                <p className="mt-2 text-sm leading-relaxed text-gray-700 whitespace-pre-line">
                                  &ldquo;{review.review_text}&rdquo;
                                </p>
                              </div>

                              <div className="flex flex-col items-start sm:items-end gap-2">
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                                  isFeatured
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-gray-200 bg-gray-50 text-gray-600"
                                }`}>
                                  {isFeatured ? "Featured" : "Not Featured"}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => handleTogglePlatformReviewFeatured(review.review_id, !isFeatured)}
                                  disabled={
                                    isUpdating ||
                                    (!isFeatured && featuredLimitReached)
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />}
                                  {isFeatured ? "Remove from Landing" : "Feature on Landing"}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {contactEnquiriesLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                ) : contactEnquiries.length === 0 ? (
                  <div className="flex flex-col items-center py-16 gap-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50">
                    <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center">
                      <MessageSquare className="h-8 w-8 text-gray-300" />
                    </div>
                    <div className="text-center">
                      <p className="text-gray-700 font-semibold">No contact enquiries yet</p>
                      <p className="text-gray-400 text-sm mt-1">Submitted messages from the contact page will appear here.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {contactEnquiries.map((entry) => {
                      const rawMessage = String(entry.message || "").trim();
                      const previewMessage = rawMessage.length > 360
                        ? `${rawMessage.slice(0, 360)}...`
                        : rawMessage;
                      const existingReply = String(entry.admin_reply_message || "").trim();
                      const replyDraft = Object.prototype.hasOwnProperty.call(contactReplyDrafts, entry.enquiry_id)
                        ? String(contactReplyDrafts[entry.enquiry_id] || "")
                        : existingReply;
                      const isReplySending = submittingContactReplyId === Number(entry.enquiry_id);
                      const accountReference = entry.submitter_user_type && entry.submitter_user_id
                        ? `${entry.submitter_user_type} #${entry.submitter_user_id}`
                        : "Guest visitor";

                      return (
                        <div
                          key={entry.enquiry_id}
                          className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-bold text-gray-900">{entry.subject}</p>
                                <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                                  {entry.category || "general"}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                                <span className="font-semibold text-gray-700">{entry.full_name}</span>
                                <span>{entry.email}</span>
                              </div>

                              <p className="text-sm leading-relaxed text-gray-600 whitespace-pre-line">{previewMessage}</p>

                              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                                    Admin Reply
                                  </p>
                                  {entry.admin_reply_at && (
                                    <span className="text-[11px] text-emerald-700 font-semibold">
                                      Replied {formatDateTime(entry.admin_reply_at)}
                                    </span>
                                  )}
                                </div>

                                {existingReply && (
                                  <div className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                                    <p className="text-sm text-emerald-900 whitespace-pre-line leading-relaxed">
                                      {existingReply}
                                    </p>
                                  </div>
                                )}

                                <textarea
                                  rows={3}
                                  value={replyDraft}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setContactReplyDrafts((prev) => ({
                                      ...prev,
                                      [entry.enquiry_id]: value,
                                    }));
                                  }}
                                  placeholder="Write a response for this enquiry..."
                                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                />

                                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-[11px] text-gray-500">
                                    Reply is visible in tourist contact notifications for linked user accounts.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => handleAdminContactReply(entry)}
                                    disabled={isReplySending || String(replyDraft || "").trim().length < 8}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {isReplySending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                    {existingReply ? "Update Reply" : "Send Reply"}
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="text-xs text-gray-500 lg:text-right lg:min-w-[220px] space-y-1">
                              <p>
                                Received: <span className="font-semibold text-gray-700">{formatDateTime(entry.created_at)}</span>
                              </p>
                              <p>
                                Account: <span className="font-semibold text-gray-700 capitalize">{accountReference}</span>
                              </p>
                              {entry.source_ip && (
                                <p>
                                  IP: <span className="font-mono text-gray-700">{entry.source_ip}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                      <p className="text-xs font-medium text-gray-600">
                        Page <span className="font-bold text-gray-900">{contactEnquiriesPagination.page}</span> of <span className="font-bold text-gray-900">{contactEnquiriesPagination.total_pages}</span>
                        <span className="mx-2 text-gray-300">|</span>
                        {contactEnquiriesPagination.total_records} total enquiries
                      </p>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => goToContactEnquiriesPage(contactEnquiriesPagination.page - 1)}
                          disabled={contactEnquiriesLoading || !contactEnquiriesPagination.has_prev}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          onClick={() => goToContactEnquiriesPage(contactEnquiriesPagination.page + 1)}
                          disabled={contactEnquiriesLoading || !contactEnquiriesPagination.has_next}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "trail-photos" && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-teal-50 border border-teal-100">
                    <Image className="h-4 w-4 text-teal-600" />
                  </div>
                  <div>
                    <h2 className="text-gray-900 font-semibold text-base">Trail Community Photo Submissions</h2>
                    <p className="text-gray-400 text-xs">Tourist uploads require admin verification before public display.</p>
                  </div>
                </div>
                <button
                  onClick={() => fetchAdminTrailPhotoSubmissions(trailPhotoSubmissionFilter)}
                  disabled={trailPhotoSubmissionsLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                >
                  {trailPhotoSubmissionsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
                  Refresh
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "pending", label: "Pending" },
                    { key: "approved", label: "Approved" },
                    { key: "rejected", label: "Rejected" },
                    { key: "all", label: "All" },
                  ].map((filterItem) => (
                    <button
                      key={filterItem.key}
                      type="button"
                      onClick={() => {
                        setTrailPhotoSubmissionFilter(filterItem.key);
                        fetchAdminTrailPhotoSubmissions(filterItem.key);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        trailPhotoSubmissionFilter === filterItem.key
                          ? "border-navy bg-navy text-white"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {filterItem.label}
                    </button>
                  ))}
                </div>

                {trailPhotoSubmissionsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                ) : trailPhotoSubmissions.length === 0 ? (
                  <div className="flex flex-col items-center py-16 gap-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50">
                    <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center">
                      <Image className="h-8 w-8 text-gray-300" />
                    </div>
                    <div className="text-center">
                      <p className="text-gray-700 font-semibold">No submissions in this filter</p>
                      <p className="text-gray-400 text-sm mt-1">Try switching filters or refresh to load latest submissions.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {trailPhotoSubmissions.map((submission) => (
                      <div
                        key={submission.submission_id}
                        className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-bold text-gray-900">{submission.trail_name}</p>
                              <TrailPhotoStatusBadge status={submission.status} />
                            </div>
                            <p className="text-xs text-gray-500">
                              By <span className="font-semibold text-gray-700">{submission.tourist_name}</span>
                              {submission.tourist_email ? ` (${submission.tourist_email})` : ""}
                            </p>

                            {submission.caption && (
                              <p className="text-sm leading-relaxed text-gray-600 whitespace-pre-line">
                                {submission.caption}
                              </p>
                            )}

                            {Array.isArray(submission.images) && submission.images.length > 0 && (
                              <div className="flex gap-2 overflow-x-auto pb-1">
                                {submission.images.map((img) => (
                                  <a
                                    key={img.image_id}
                                    href={`http://localhost:5000${img.image_path}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block w-24 h-20 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0"
                                  >
                                    <img
                                      src={`http://localhost:5000${img.image_path}`}
                                      alt="Submitted trail"
                                      className="w-full h-full object-cover"
                                    />
                                  </a>
                                ))}
                              </div>
                            )}

                            {submission.status === "rejected" && submission.admin_review_note && (
                              <p className="text-xs text-red-700 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2">
                                Rejection note: {submission.admin_review_note}
                              </p>
                            )}
                          </div>

                          <div className="text-xs text-gray-500 lg:text-right lg:min-w-[250px] space-y-2">
                            <p>
                              Submitted: <span className="font-semibold text-gray-700">{formatDateTime(submission.created_at)}</span>
                            </p>
                            <p>
                              Trek Date: <span className="font-semibold text-gray-700">{submission.trek_date ? formatDateTime(submission.trek_date) : "-"}</span>
                            </p>
                            {submission.admin_reviewed_at && (
                              <p>
                                Reviewed: <span className="font-semibold text-gray-700">{formatDateTime(submission.admin_reviewed_at)}</span>
                              </p>
                            )}

                            {submission.status === "pending" && (
                              <div className="flex justify-start lg:justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleTrailPhotoSubmissionReview(submission.submission_id, "approved")}
                                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleTrailPhotoSubmissionReview(submission.submission_id, "rejected")}
                                  className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
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
                  onClick={() => fetchAdminPayments(homestayPaymentsPagination.page || 1)}
                  disabled={paymentsLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                >
                  {paymentsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
                  Refresh
                </button>
              </div>

              <div className="p-6 space-y-5">
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

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                      <p className="text-xs font-medium text-gray-600">
                        Page <span className="font-bold text-gray-900">{homestayPaymentsPagination.page}</span> of <span className="font-bold text-gray-900">{homestayPaymentsPagination.total_pages}</span>
                        <span className="mx-2 text-gray-300">|</span>
                        {homestayPaymentsPagination.total_records} total sessions
                      </p>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => goToHomestayPaymentsPage(homestayPaymentsPagination.page - 1)}
                          disabled={paymentsLoading || !homestayPaymentsPagination.has_prev}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          onClick={() => goToHomestayPaymentsPage(homestayPaymentsPagination.page + 1)}
                          disabled={paymentsLoading || !homestayPaymentsPagination.has_next}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
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
                  onClick={() => fetchAdminGuidePayments(guidePaymentsPagination.page || 1)}
                  disabled={guidePaymentsLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                >
                  {guidePaymentsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
                  Refresh
                </button>
              </div>

              <div className="p-6 space-y-5">
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

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                      <p className="text-xs font-medium text-gray-600">
                        Page <span className="font-bold text-gray-900">{guidePaymentsPagination.page}</span> of <span className="font-bold text-gray-900">{guidePaymentsPagination.total_pages}</span>
                        <span className="mx-2 text-gray-300">|</span>
                        {guidePaymentsPagination.total_records} total sessions
                      </p>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => goToGuidePaymentsPage(guidePaymentsPagination.page - 1)}
                          disabled={guidePaymentsLoading || !guidePaymentsPagination.has_prev}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          onClick={() => goToGuidePaymentsPage(guidePaymentsPagination.page + 1)}
                          disabled={guidePaymentsLoading || !guidePaymentsPagination.has_next}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {hostVerificationQueueModalOpen && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/45" onClick={() => setHostVerificationQueueModalOpen(false)} />
          <div className="relative w-full max-w-4xl rounded-2xl border border-amber-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-amber-100 px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Host Verification Queue</h3>
                <p className="text-xs text-gray-500 mt-0.5">Citizenship documents pending admin review.</p>
              </div>
              <button
                type="button"
                onClick={() => setHostVerificationQueueModalOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-3">
              {hostVerificationsLoading ? (
                <div className="flex items-center gap-2 text-sm text-amber-700">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading host verification submissions...
                </div>
              ) : submittedHostVerifications.length === 0 ? (
                <p className="text-sm text-amber-700">No host verification submissions yet.</p>
              ) : (
                submittedHostVerifications.map((hostItem) => (
                  <div key={hostItem.host_id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{hostItem.full_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{hostItem.email} · {hostItem.phone || "No phone"}</p>
                        <p className="text-xs text-gray-600 mt-1">PAN: {hostItem.pan_number || "Not provided"}</p>
                        {hostItem.citizenship_doc_path && (
                          <a
                            href={`http://localhost:5000${hostItem.citizenship_doc_path}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 mt-2 text-xs text-blue-700 hover:underline"
                          >
                            <FileText className="h-3.5 w-3.5" /> View citizenship document
                          </a>
                        )}
                        {hostItem.verification_status === "rejected" && hostItem.rejection_reason && (
                          <p className="mt-2 text-xs text-red-700">Rejection reason: {hostItem.rejection_reason}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <StatusBadge status={hostItem.verification_status} />
                        {hostItem.verification_status === "pending" && (
                          <>
                            <button
                              onClick={() => handleHostVerificationStatus(hostItem.host_id, "approved")}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                            >
                              <CheckCircle className="h-3.5 w-3.5" /> Approve
                            </button>
                            <button
                              onClick={() => handleHostVerificationStatus(hostItem.host_id, "rejected")}
                              className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {bankDetailsModalOpen && (
        <div className="fixed inset-0 z-[66] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/45" onClick={() => setBankDetailsModalOpen(false)} />
          <div className="relative w-full max-w-5xl rounded-2xl border border-blue-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-blue-100 px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Host & Guide Bank Details</h3>
                <p className="text-xs text-gray-500 mt-0.5">Accounts provided for payout and transfer verification.</p>
              </div>
              <button
                type="button"
                onClick={() => setBankDetailsModalOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[72vh] overflow-y-auto px-6 py-5 space-y-6">
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900">Hosts</h4>
                  <span className="text-xs font-semibold text-gray-500">{hostBankProfiles.length} with details</span>
                </div>
                {hostBankProfiles.length === 0 ? (
                  <p className="text-sm text-gray-500 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">No hosts have provided bank details yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {hostBankProfiles.map((hostItem) => (
                      <div key={`host-bank-${hostItem.host_id}`} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <p className="text-sm font-semibold text-gray-900">{hostItem.full_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{hostItem.email}</p>
                        <p className="text-xs text-gray-700 mt-2">Bank: <span className="font-semibold">{hostItem.bank_name || "-"}</span></p>
                        <p className="text-xs text-gray-700">Account Name: <span className="font-semibold">{hostItem.bank_account_name || "-"}</span></p>
                        <p className="text-xs text-gray-700">Account Number: <span className="font-semibold">{hostItem.bank_account_number || "-"}</span></p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900">Guides</h4>
                  <span className="text-xs font-semibold text-gray-500">{guideBankProfiles.length} with details</span>
                </div>
                {guideBankProfiles.length === 0 ? (
                  <p className="text-sm text-gray-500 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">No guides have provided bank details yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {guideBankProfiles.map((guideItem) => (
                      <div key={`guide-bank-${guideItem.guide_id}`} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <p className="text-sm font-semibold text-gray-900">{guideItem.full_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{guideItem.email}</p>
                        <p className="text-xs text-gray-700 mt-2">Bank: <span className="font-semibold">{guideItem.bank_name || "-"}</span></p>
                        <p className="text-xs text-gray-700">Account Name: <span className="font-semibold">{guideItem.bank_account_name || "-"}</span></p>
                        <p className="text-xs text-gray-700">Account Number: <span className="font-semibold">{guideItem.bank_account_number || "-"}</span></p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}

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
  const hostVerified = h.host_verification_status === "approved";
  const hasListingDocs = Boolean(
    h.homestay_registration_certificate_doc_path
    && h.property_ownership_doc_path
    && ["owner", "rental"].includes(String(h.property_ownership_type || "").toLowerCase())
  );
  const canApproveHomestay = hostVerified && hasListingDocs;

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
                disabled={!canApproveHomestay}
                title={canApproveHomestay ? "Approve homestay" : "Host verification and listing documents are required before approval"}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
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
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">Host verification:</span>
              <StatusBadge status={h.host_verification_status || "not_submitted"} />
              {h.host_citizenship_doc_path && (
                <a
                  href={`http://localhost:5000${h.host_citizenship_doc_path}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
                >
                  <FileText className="h-3.5 w-3.5" /> Citizenship Doc
                </a>
              )}
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
              <p className="text-lg font-bold text-gray-900">{h.capacity}</p>
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

          {h.verified_status === "rejected" && h.rejection_reason && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
              <p className="text-xs font-semibold text-red-500 uppercase tracking-widest mb-1">Rejection Reason</p>
              <p className="text-sm text-red-700">{h.rejection_reason}</p>
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

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Listing Documents</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Homestay Registration Certificate</p>
                {h.homestay_registration_certificate_doc_path ? (
                  <a
                    href={`http://localhost:5000${h.homestay_registration_certificate_doc_path}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5" /> View Document
                  </a>
                ) : (
                  <p className="mt-1 text-xs font-semibold text-red-600">Missing</p>
                )}
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Ownership / Rental Proof</p>
                <p className="mt-1 text-xs text-gray-600">
                  Type: <span className="font-semibold uppercase">{h.property_ownership_type || "missing"}</span>
                </p>
                {h.property_ownership_doc_path ? (
                  <a
                    href={`http://localhost:5000${h.property_ownership_doc_path}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5" /> View Document
                  </a>
                ) : (
                  <p className="mt-1 text-xs font-semibold text-red-600">Missing</p>
                )}
              </div>
            </div>
            {!canApproveHomestay && h.verified_status === "pending" && (
              <p className="mt-2 text-xs text-amber-700">
                Approval is locked until host verification is approved and both listing documents are present.
              </p>
            )}
          </div>

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
                disabled={!canApproveHomestay}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
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