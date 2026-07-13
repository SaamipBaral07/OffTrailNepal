// ╠═══════════════════════════════════════════════════════════════════════════════════════════════════════════╣
// ║ GET    /api/guides/verification-status        → guideRoutes.js        → guideVerificationController.getMyGuideVerificationStatus║
// ║ POST   /api/guides/verification-docs          → guideRoutes.js        → guideVerificationController.submitGuideVerificationDocs║
// ║ GET    /api/guides/trails-list                → guideRoutes.js        → guideController.getTrailsForGuide      ║
// ║ GET    /api/guides/my-trails                  → guideRoutes.js        → guideController.getMyTrails            ║
// ║ POST   /api/guides/trails                     → guideRoutes.js        → guideController.addGuideToTrail        ║
// ║ PUT    /api/guides/trails/:id                 → guideRoutes.js        → guideController.updateGuideTrail       ║
// ║ DELETE /api/guides/trails/:id                 → guideRoutes.js        → guideController.removeGuideFromTrail   ║
// ║ PATCH  /api/guides/trails/:id/toggle-active   → guideRoutes.js        → guideController.toggleGuideTrailActive ║
// ║ GET    /api/guides/services                   → guideRoutes.js        → guideServiceController.getMyServices   ║
// ║ POST   /api/guides/services                   → guideRoutes.js        → guideServiceController.createService   ║
// ║ PUT    /api/guides/services/:id               → guideRoutes.js        → guideServiceController.updateService   ║
// ║ DELETE /api/guides/services/:id               → guideRoutes.js        → guideServiceController.deleteService   ║
// ║ PATCH  /api/guides/services/:id/toggle-active → guideRoutes.js        → guideServiceController.toggleServiceActive║
// ║ GET    /api/guides/availability               → guideRoutes.js        → guideAvailabilityController.getMyAvailability║
// ║ POST   /api/guides/availability               → guideRoutes.js        → guideAvailabilityController.toggleAvailability║
// ║ GET    /api/guides/reviews                    → guideRoutes.js        → guideReviewController.getMyReviews     ║
// ║ GET    /api/guide-bookings/guide              → guideBookingRoutes.js → guideBookingController.getGuideProviderBookings║
// ║ PATCH  /api/guide-bookings/:bookingId/status   → guideBookingRoutes.js → guideBookingController.updateGuideBookingStatus║
// ╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════╝

import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import api from "../api";
import {
  LogOut,
  Compass,
  Home,
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
  Activity,
  Calendar,
  Star,
  Package,
  CheckCircle2,
  AlertTriangle,
  Upload,
  XCircle,
  MessageCircle,
  Menu,
} from "lucide-react";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import LogoutModal from "../components/LogoutModal";
import GuideBookingChatModal from "../components/GuideBookingChatModal";
import { useAuth } from "../context/AuthContext";
import { getToken } from "../tokenStore";

const API = (process.env.REACT_APP_API_URL || "http://localhost:5000") + "/api";
const PLATFORM_COMMISSION_RATE = 0.1;
const GUIDE_PAYOUT_RATE = 1 - PLATFORM_COMMISSION_RATE;

const fadeInUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const staggerFast = {
  transition: {
    staggerChildren: 0.06,
  },
};

const BOOKED_STATUSES = new Set(["pending", "confirmed"]);

const formatNprAmount = (amount) => {
  const normalized = Number.isFinite(amount) ? amount : 0;
  return `NPR ${normalized.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
};

const isGuideEarningBooking = (booking) => {
  const bookingStatus = String(booking?.status || "").trim().toLowerCase();
  const paymentStatus = String(booking?.payment_status || "").trim().toLowerCase();
  const refundStatus = String(booking?.refund_status || "").trim().toLowerCase();

  return (
    bookingStatus === "confirmed" &&
    paymentStatus === "success" &&
    !["requested", "processing", "approved", "processed", "refunded"].includes(refundStatus)
  );
};

const toDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const toNormalizedDateKey = (value) => {
  if (value === undefined || value === null) return null;

  if (value instanceof Date) {
    return toDateKey(value);
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const datePrefixMatch = raw.match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/);
  if (datePrefixMatch) {
    return datePrefixMatch[1];
  }

  // Keep literal date-only values stable across all timezones.
  if (DATE_ONLY_RE.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return toDateKey(parsed);
};

const dateKeyToDate = (key) => {
  const parts = String(key || "").split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [yyyy, mm, dd] = parts;
  // Noon avoids timezone boundary shifts that can render a date one day early.
  return new Date(yyyy, mm - 1, dd, 12, 0, 0, 0);
};

const startOfLocalDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const getTodayDateKey = () => toDateKey(startOfLocalDay(new Date()));

const buildBookedDateKeysFromBookings = (bookings = []) => {
  const keys = new Set();

  bookings.forEach((booking) => {
    const status = String(booking.status || "").toLowerCase();
    if (!BOOKED_STATUSES.has(status)) return;

    const start = dateKeyToDate(toNormalizedDateKey(booking.start_date));
    const end = dateKeyToDate(toNormalizedDateKey(booking.end_date));
    if (!start || !end) return;

    const cursor = new Date(start);
    while (cursor <= end) {
      const key = toDateKey(cursor);
      if (key) keys.add(key);
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  return Array.from(keys).sort();
};

const ExperienceBadge = ({ level }) => {
  const config = {
    beginner: { bg: "bg-alpine/10 border-alpine/20", text: "text-alpine", label: "Beginner" },
    intermediate: { bg: "bg-gold/10 border-gold/20", text: "text-gold-dark", label: "Intermediate" },
    expert: { bg: "bg-navy/10 border-navy/20", text: "text-navy", label: "Expert" },
  };
  const c = config[level] || config.beginner;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] uppercase tracking-wide font-semibold border ${c.bg} ${c.text}`}>
      <Award className="h-3.5 w-3.5" />
      {c.label}
    </span>
  );
};

const StatCard = ({ icon: Icon, label, value, accent }) => {
  const accents = {
    blue: "bg-navy/10 text-navy border-navy/20",
    emerald: "bg-alpine/10 text-alpine border-alpine/20",
    amber: "bg-gold/10 text-gold-dark border-gold/20",
    purple: "bg-charcoal/10 text-charcoal border-charcoal/20",
  };
  return (
    <motion.div
      variants={fadeInUp}
      className="relative overflow-hidden rounded-3xl border border-navy/10 bg-white/95 p-5 shadow-[0_12px_28px_rgba(12,35,64,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(12,35,64,0.12)]"
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className={`inline-flex p-2.5 rounded-xl border ${accents[accent]} mb-3`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-bold text-charcoal font-heading">{value}</p>
      <p className="text-xs uppercase tracking-wide text-gray-500 mt-1">{label}</p>
      <div className="pointer-events-none absolute -right-8 -bottom-8 h-24 w-24 rounded-full bg-gold/10" />
    </motion.div>
  );
};

const GuideDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { handleLogout, handleStayLoggedIn, showLogoutModal, setShowLogoutModal } = useLogoutHandler();
  const { user: authUser, loading } = useAuth();

  const [activeTab, setActiveTab] = useState("trails");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // State
  const [trailsList, setTrailsList] = useState([]);
  const [myTrails, setMyTrails] = useState([]);
  const [services, setServices] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewsStats, setReviewsStats] = useState({ avg: 0, total: 0 });
  const [guideBookings, setGuideBookings] = useState([]);
  const [bookedDateKeys, setBookedDateKeys] = useState([]);
  const [updatingBookingId, setUpdatingBookingId] = useState(null);
  const [fetchingData, setFetchingData] = useState(false);
  const [verification, setVerification] = useState(undefined);
  const [verificationSubmitting, setVerificationSubmitting] = useState(false);
  const [showGuideApprovalNotice, setShowGuideApprovalNotice] = useState(false);
  const [availabilityNotice, setAvailabilityNotice] = useState(null);
  const [updatingAvailabilityDate, setUpdatingAvailabilityDate] = useState(null);
  const [selectedAvailabilityDateKey, setSelectedAvailabilityDateKey] = useState(null);
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [activeChatBooking, setActiveChatBooking] = useState(null);
  const [expandedBookingDetails, setExpandedBookingDetails] = useState({});

  const profileImageUrl = user?.profile_image_path
    ? (String(user.profile_image_path).startsWith("http")
      ? user.profile_image_path
      : `${process.env.REACT_APP_API_URL || "http://localhost:5000"}${user.profile_image_path}`)
    : "";

  // Forms State
  const [showTrailForm, setShowTrailForm] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingTrail, setEditingTrail] = useState(null);
  const [editingService, setEditingService] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const isVerificationResolved = verification !== undefined;
  const isGuideApproved = verification?.verification_status === "approved";
  const isGuidePending = verification?.verification_status === "pending";
  const isGuideRejected = verification?.verification_status === "rejected";

  const bookedDateSet = new Set(bookedDateKeys);
  const todayDateKey = getTodayDateKey();
  const isPastDateKey = (dateKey) => Boolean(dateKey) && dateKey < todayDateKey;

  const hasBookingStarted = (booking) => {
    const startDateKey = toNormalizedDateKey(booking?.start_date);
    return Boolean(startDateKey) && startDateKey <= todayDateKey;
  };

  const hasBookingEnded = (booking) => {
    const endDateKey = toNormalizedDateKey(booking?.end_date);
    return Boolean(endDateKey) && endDateKey < todayDateKey;
  };

  const currentGuideBookings = guideBookings.filter((booking) => !hasBookingEnded(booking));
  const historyGuideBookings = guideBookings.filter((booking) => hasBookingEnded(booking));

  const upcomingBookedDateKeys = bookedDateKeys.filter((dateKey) => dateKey >= todayDateKey);
  const upcomingBookedDateSet = new Set(upcomingBookedDateKeys);

  const manualBusyDateKeys = availability
    .filter((entry) => !entry.is_available)
    .map((entry) => toNormalizedDateKey(entry.available_date))
    .filter(Boolean)
    .filter((dateKey) => !isPastDateKey(dateKey))
    .filter((dateKey) => !upcomingBookedDateSet.has(dateKey));
  const manualBusyDateSet = new Set(manualBusyDateKeys);

  const selectedAvailabilityDate = selectedAvailabilityDateKey
    ? dateKeyToDate(selectedAvailabilityDateKey)
    : null;
  const selectedDateIsBooked = selectedAvailabilityDateKey
    ? upcomingBookedDateSet.has(selectedAvailabilityDateKey)
    : false;
  const selectedDateIsBusy = selectedAvailabilityDateKey
    ? manualBusyDateSet.has(selectedAvailabilityDateKey)
    : false;
  const selectedDateIsPast = selectedAvailabilityDateKey
    ? isPastDateKey(selectedAvailabilityDateKey)
    : false;

  const upcomingStatusRows = [
    ...upcomingBookedDateKeys.map((dateKey) => ({ dateKey, status: "booked" })),
    ...manualBusyDateKeys
      .filter((dateKey) => !upcomingBookedDateSet.has(dateKey))
      .map((dateKey) => ({ dateKey, status: "busy" })),
  ]
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .slice(0, 45);

  const pendingGuideBookings = guideBookings.filter(
    (booking) => String(booking.status || "").toLowerCase() === "pending"
  ).length;
  const guideNetEarnings = guideBookings.reduce((sum, booking) => {
    if (!isGuideEarningBooking(booking)) return sum;
    const grossAmount = Number(booking.total_price || 0);
    if (!Number.isFinite(grossAmount) || grossAmount <= 0) return sum;
    return sum + (grossAmount * GUIDE_PAYOUT_RATE);
  }, 0);
  const sidebarTabs = [
    { id: "trails", label: "My Trails", icon: Mountain, count: myTrails.length },
    { id: "services", label: "My Services", icon: Package, count: services.length },
    { id: "bookings", label: "Bookings", icon: Users, count: pendingGuideBookings || currentGuideBookings.length || null },
    { id: "availability", label: "Availability", icon: Calendar, count: upcomingStatusRows.length || null },
    { id: "reviews", label: "Reviews", icon: Star, count: reviews.length || null },
  ];

  const getApprovalTimeFormatted = () => {
    if (!verification?.reviewed_at && !verification?.updated_at) return null;
    const dateStr = verification.reviewed_at || verification.updated_at;
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString("en-US", { 
      month: "short", 
      day: "numeric", 
      year: "numeric", 
      hour: "2-digit", 
      minute: "2-digit",
      hour12: true
    });
  };

  useEffect(() => {
    if (!availabilityNotice) return;
    const timer = window.setTimeout(() => setAvailabilityNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [availabilityNotice]);

  useEffect(() => {
    if (loading) return;
    if (!getToken() || !authUser) { navigate("/login", { replace: true }); return; }
    if (authUser.user_type !== "guide") { navigate("/login", { replace: true }); return; }
    setUser(authUser);
    setIsLoading(false);
  }, [loading, navigate, authUser]);

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

  useEffect(() => {
    const checks = {
      isVerificationResolved,
      verification_exists: !!verification,
      verification_status: verification?.verification_status,
      authUser_exists: !!authUser,
      authUser_full: authUser,
      authUser_keys: authUser ? Object.keys(authUser) : "null",
      authUser_id_property: authUser?.user_id,
      authUser_id_alt1: authUser?.id,
      authUser_id_alt2: authUser?.userId,
    };

    console.log("🔍 Full Approval Check (with user props):", checks);

    // More detailed early return logging
    if (!isVerificationResolved) {
      console.log("❌ Early Return: isVerificationResolved is FALSE");
      setShowGuideApprovalNotice(false);
      return;
    }
    
    if (!verification) {
      console.log("❌ Early Return: verification is NULL/UNDEFINED");
      setShowGuideApprovalNotice(false);
      return;
    }
    
    if (verification.verification_status !== "approved") {
      console.log(`❌ Early Return: verification_status is "${verification.verification_status}" (NOT "approved")`);
      setShowGuideApprovalNotice(false);
      return;
    }
    
    if (!authUser) {
      console.log("❌ Early Return: authUser is NULL/UNDEFINED");
      setShowGuideApprovalNotice(false);
      return;
    }

    // Try to find the actual user ID property
    const userId = authUser?.user_id || authUser?.id || authUser?.userId;
    if (!userId) {
      console.log("❌ Early Return: No user_id found in authUser. Properties:", Object.keys(authUser));
      setShowGuideApprovalNotice(false);
      return;
    }

    // Check 24-hour window: approval timestamp should be within last 24 hours
    const approvalTimestamp = verification.reviewed_at || verification.updated_at;
    if (!approvalTimestamp) {
      console.log("⚠️ No approval timestamp found, cannot verify 24-hour window");
      setShowGuideApprovalNotice(false);
      return;
    }

    const approvalTime = new Date(approvalTimestamp).getTime();
    const currentTime = new Date().getTime();
    const timeDifferenceMs = currentTime - approvalTime;
    const timeDifferenceHours = timeDifferenceMs / (1000 * 60 * 60);

    console.log("⏱️ Time check:", {
      approvalTimestamp,
      timeDifferenceHours: Math.round(timeDifferenceHours * 100) / 100,
      withinWindow: timeDifferenceHours <= 24,
    });

    // Only show message if within 24-hour window
    if (timeDifferenceHours > 24) {
      console.log(`❌ Early Return: Approval was ${Math.round(timeDifferenceHours)} hours ago (outside 24-hour window)`);
      setShowGuideApprovalNotice(false);
      return;
    }

    console.log("✅ All checks passed! Checking dismiss status with userId:", userId);

    // Clear old timestamp keys that might interfere
    try {
      const keys = Object.keys(window.localStorage);
      keys.forEach(key => {
        if (key.includes('guideApprovalTimestamp')) {
          window.localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.error("Error clearing old keys:", e);
    }

    // Simple approach: show approval message if approved status and not previously dismissed
    const dismissKey = `guideApprovalDismissed:${userId}`;
    const isDismissed = window.localStorage.getItem(dismissKey) === "true";
    
    console.log("Dismiss status:", { dismissKey, isDismissed });
    
    if (!isDismissed) {
      console.log("✅ SHOWING APPROVAL MESSAGE");
      setShowGuideApprovalNotice(true);
    } else {
      console.log("Message already dismissed by user");
    }
  }, [isVerificationResolved, verification, authUser]);

  const fetchDashboardData = useCallback(async () => {
    setFetchingData(true);
    try {
      const [trailsAllRes, myTrailsRes, myServicesRes, myAvailRes, myReviewsRes, verificationRes, bookingsRes] = await Promise.all([
        api.get(`${API}/guides/trails-list`),
        api.get(`${API}/guides/my-trails`),
        api.get(`${API}/guides/services`),
        api.get(`${API}/guides/availability`),
        api.get(`${API}/guides/reviews`),
        api.get(`${API}/guides/verification-status`),
        api.get(`/api/guide-bookings/guide`),
      ]);
      setTrailsList(trailsAllRes.data.trails || []);
      setMyTrails(myTrailsRes.data.guide_trails || []);
      setServices(myServicesRes.data.services || []);
      setAvailability(myAvailRes.data.availability || []);
      setReviews(myReviewsRes.data.reviews || []);
      
      const verificationData = verificationRes.data.verification || null;
      console.log("📥 VERIFICATION API RESPONSE:", {
        endpoint: `${API}/guides/verification-status`,
        response_status: verificationRes.status,
        full_response: verificationRes.data,
        verification_extracted: verificationData,
        verification_status_value: verificationData?.verification_status,
        all_verification_keys: verificationData ? Object.keys(verificationData) : "null/undefined",
      });
      
      setVerification(verificationData);
      const nextGuideBookings = bookingsRes.data.bookings || [];
      setGuideBookings(nextGuideBookings);

      const fromApiBookedDates = Array.isArray(myAvailRes.data.booked_dates)
        ? myAvailRes.data.booked_dates
            .map((d) => toNormalizedDateKey(d))
            .filter(Boolean)
        : [];
      setBookedDateKeys(
        fromApiBookedDates.length > 0
          ? fromApiBookedDates
          : buildBookedDateKeysFromBookings(nextGuideBookings)
      );

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

  const handleGuideBookingStatus = async (bookingId, status) => {
    const promptMessage = status === "cancelled"
      ? "Optional cancellation note for the tourist/admin refund team:"
      : status === "rejected"
      ? "Optional rejection note for the tourist/admin refund team:"
      : "Optional confirmation note:";
    const note = window.prompt(promptMessage, "");
    if (note === null) return;

    setUpdatingBookingId(bookingId);
    try {
      const res = await api.patch(`/api/guide-bookings/${bookingId}/status`, {
        status,
        note: String(note || "").trim() || null,
      });
      window.alert(res.data?.message || "Booking updated");
      await fetchDashboardData();
    } catch (err) {
      window.alert(err.response?.data?.message || "Failed to update booking status");
    } finally {
      setUpdatingBookingId(null);
    }
  };

  const openGuideBookingChat = (booking) => {
    setActiveChatBooking(booking);
    setChatModalOpen(true);
  };

  const toggleBookingDetails = (bookingId) => {
    setExpandedBookingDetails((prev) => ({
      ...prev,
      [bookingId]: !prev[bookingId],
    }));
  };

  const closeGuideBookingChat = () => {
    setChatModalOpen(false);
    setActiveChatBooking(null);
  };

  // --- AVAILABILITY ---
  const handleAvailabilityDaySelect = (date) => {
    if (!date) return;
    const dateKey = toDateKey(date);
    if (!dateKey) return;

    setSelectedAvailabilityDateKey(dateKey);

    if (isPastDateKey(dateKey)) {
      setAvailabilityNotice({ type: "error", message: "Past dates cannot be changed." });
      return;
    }

    if (bookedDateSet.has(dateKey)) {
      setAvailabilityNotice({
        type: "error",
        message: "This date is booked by a tourist and cannot be changed manually.",
      });
      return;
    }
  };

  const applySelectedAvailabilityChange = async () => {
    const dateKey = selectedAvailabilityDateKey;
    if (!dateKey) {
      setAvailabilityNotice({ type: "error", message: "Please select a date first." });
      return;
    }

    if (isPastDateKey(dateKey)) {
      setAvailabilityNotice({ type: "error", message: "Past dates cannot be changed." });
      return;
    }

    if (bookedDateSet.has(dateKey)) {
      setAvailabilityNotice({
        type: "error",
        message: "This date is booked by a tourist and cannot be changed manually.",
      });
      return;
    }

    const currentlyBusy = manualBusyDateSet.has(dateKey);

    setUpdatingAvailabilityDate(dateKey);
    try {
      await api.post(`${API}/guides/availability`, {
        date: dateKey,
        is_available: currentlyBusy,
      });

      setAvailabilityNotice({
        type: "success",
        message: currentlyBusy ? "Date marked as available." : "Date marked as busy.",
      });

      await fetchDashboardData();
    } catch (err) {
      setAvailabilityNotice({
        type: "error",
        message: err.response?.data?.message || "Failed to update calendar availability.",
      });
    } finally {
      setUpdatingAvailabilityDate(null);
    }
  };

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#f4f2ee] via-[#faf8f4] to-[#f2efe8]">
      <div className="inline-flex items-center gap-3 text-navy font-semibold">
        <Loader2 className="h-7 w-7 animate-spin text-gold" />
        Loading guide dashboard...
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f4f2ee] via-[#faf8f4] to-[#f2efe8] flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 w-72 flex-col overflow-hidden border-r border-white/10 bg-[radial-gradient(circle_at_top,_rgba(212,163,74,0.12),transparent_44%),linear-gradient(180deg,#0f335d_0%,#092747_42%,#061a33_100%)] text-white shadow-[0_20px_40px_rgba(2,10,23,0.45)]">
        <div className="pointer-events-none absolute -left-10 top-16 h-44 w-44 rounded-full bg-gold/20 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-1/3 h-36 w-36 rounded-full bg-blue-300/10 blur-3xl" />

        <div className="relative z-10 px-6 py-6 border-b border-white/10 flex items-center gap-3">
          <div className="relative h-11 w-11 rounded-full overflow-hidden">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gold/70 via-gold/35 to-gold/70 p-[2px]">
              <div className="h-full w-full rounded-full bg-white p-0.5">
                <img
                  src="/offtrail-latest.png"
                  alt="OffTrail Nepal"
                  className="h-full w-full rounded-full object-cover"
                />
              </div>
            </div>
          </div>
          <div>
            <p className="text-white font-bold text-[18px] leading-none tracking-tight">OffTrailNepal</p>
            <p className="text-gold/85 text-[11px] mt-1 uppercase tracking-[0.18em] font-semibold">Guide Console</p>
          </div>
        </div>

        <nav className="relative z-10 flex-1 px-4 py-6">
          <p className="px-3 mb-3 text-[11px] font-bold text-gold/75 uppercase tracking-[0.16em]">Management</p>
          <div className="space-y-1.5">
            {sidebarTabs.map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative w-full overflow-hidden rounded-2xl px-3 py-2.5 text-sm transition-all duration-300 ${
                    isActive
                      ? "bg-gradient-to-r from-gold via-[#d4a34a] to-[#b8842c] text-navy shadow-[0_10px_22px_rgba(212,163,74,0.42)]"
                      : "text-white/85 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border ${
                      isActive
                        ? "border-navy/20 bg-white/30 text-navy"
                        : "border-white/20 bg-white/5 text-white/85 group-hover:border-white/35"
                    }`}>
                      <tab.icon className="h-4 w-4" />
                    </span>
                    <span className="font-semibold">{tab.label}</span>
                    {tab.count ? (
                      <span className={`ml-auto inline-flex min-w-[1.45rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        isActive ? "bg-navy/20 text-navy" : "bg-white/15 text-white"
                      }`}>
                        {tab.count}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="relative z-10 border-t border-white/10 bg-black/20 px-4 py-4 backdrop-blur-sm">
          <div className="mb-3 rounded-2xl border border-white/15 bg-white/5 p-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full overflow-hidden bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center text-navy font-bold text-sm ring-2 ring-gold/25">
                {profileImageUrl ? (
                  <img src={profileImageUrl} alt={user?.full_name || "Guide"} className="h-full w-full object-cover" />
                ) : (
                  <span>{user?.full_name?.charAt(0) || "G"}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{user?.full_name}</p>
                <p className="text-[11px] text-white/65 uppercase tracking-wide">Trekking Guide</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-2">
            <Link
              to="/guide-profile"
              className="group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-white/90 transition hover:bg-white/8"
            >
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-gold/85" />
                My Profile
              </span>
              <span className="text-[10px] uppercase tracking-wide text-white/45 transition group-hover:text-gold/85">Open</span>
            </Link>

            <Link
              to="/chats"
              className="group mt-1 flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-white/90 transition hover:bg-white/8"
            >
              <span className="inline-flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-blue-200" />
                Chats
              </span>
              <span className="text-[10px] uppercase tracking-wide text-white/45 transition group-hover:text-blue-200">Open</span>
            </Link>

            <button
              onClick={() => setShowLogoutModal(true)}
              className="group mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-red-100 transition hover:bg-red-500/12"
            >
              <span className="inline-flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                Sign Out
              </span>
              <span className="text-[10px] uppercase tracking-wide text-red-100/60 transition group-hover:text-red-100">Exit</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 lg:ml-72 flex flex-col min-h-screen">
        <header className="bg-white/90 backdrop-blur border-b border-navy/10 px-4 sm:px-6 py-4 sticky top-0 z-20 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/")}
                className="inline-flex items-center gap-2 rounded-lg border border-gold/30 bg-white px-3 py-1.5 text-xs font-semibold text-gold-dark hover:bg-gold/10 transition-colors"
              >
                <Home className="h-3.5 w-3.5" />
                Back to Home
              </button>

              <Link
                to="/chats"
                className="hidden lg:inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Chats
              </Link>
            </div>

            <div className="lg:hidden flex items-center gap-2">
              <Link
                to="/chats"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700"
                aria-label="Open chats"
              >
                <MessageCircle className="h-5 w-5" />
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-navy/15 bg-white text-navy"
                aria-label="Open guide navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="mt-3">
            <h1 className="text-charcoal font-bold text-xl sm:text-2xl tracking-tight capitalize leading-tight">
              {activeTab === "trails" ? "My Trail Assignments" : activeTab}
            </h1>
            <p className="text-gray-500 text-xs mt-0.5">Manage your marketplace visibility</p>
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
                      <p className="text-[10px] uppercase tracking-[0.2em] text-gold font-bold">Guide Navigation</p>
                      <h2 className="text-white font-heading font-bold text-lg mt-1">Control Menu</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMobileMenuOpen(false)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white"
                      aria-label="Close guide menu"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
                  {sidebarTabs.map((tab) => (
                    <button
                      key={`mobile-${tab.id}`}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm font-semibold transition-colors ${
                        activeTab === tab.id
                          ? "border-navy bg-navy/5 text-navy"
                          : "border-gray-200 bg-white text-gray-700"
                      }`}
                    >
                      <tab.icon className="h-4.5 w-4.5" />
                      <span>{tab.label}</span>
                      {tab.count ? (
                        <span className="ml-auto inline-flex min-w-5 justify-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-700">
                          {tab.count}
                        </span>
                      ) : null}
                    </button>
                  ))}

                  <Link
                    to="/guide-profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm font-semibold text-gray-700"
                  >
                    <Compass className="h-4.5 w-4.5" />
                    My Profile
                  </Link>

                  <Link
                    to="/chats"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm font-semibold text-gray-700"
                  >
                    <MessageCircle className="h-4.5 w-4.5" />
                    Chats
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

        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
          {isVerificationResolved && !isGuideApproved && (
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
                  className="px-4 py-2.5 bg-navy hover:bg-navy-light disabled:opacity-60 text-white rounded-xl text-sm font-semibold shadow-[0_10px_22px_rgba(12,35,64,0.2)]"
                >
                  {verificationSubmitting ? "Submitting..." : verification ? "Resubmit Documents" : "Submit Documents"}
                </button>
              </form>
            </div>
          )}

          {showGuideApprovalNotice && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">
                    Your guide verification is approved!
                  </p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    You can now create and manage listings (Message expires in 24 hours)
                  </p>
                  {getApprovalTimeFormatted() && (
                    <p className="text-xs text-emerald-600 mt-1">
                      Approved on: {getApprovalTimeFormatted()}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowGuideApprovalNotice(false);
                  if (authUser?.user_id) {
                    window.localStorage.setItem(`guideApprovalDismissed:${authUser.user_id}`, "true");
                  }
                }}
                className="flex-shrink-0 text-emerald-600 hover:text-emerald-800 transition-colors"
                aria-label="Close approval notice"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
          {activeTab === "trails" && (
            <motion.div key="trails" variants={fadeInUp} initial="initial" animate="animate" exit="exit" className="space-y-6">
              <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-4" variants={staggerFast} initial="initial" animate="animate">
                <StatCard icon={Mountain} label="Assigned Trails" value={myTrails.length} accent="blue" />
                <StatCard icon={Activity} label="Active Trails" value={myTrails.filter(t => t.is_active).length} accent="emerald" />
              </motion.div>

              <div className="bg-white/95 rounded-3xl border border-navy/10 shadow-[0_12px_30px_rgba(12,35,64,0.08)]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gold/20">
                  <h2 className="text-charcoal font-semibold text-base">Your Base Trails</h2>
                  <button
                    onClick={() => { setEditingTrail(null); setShowTrailForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-navy hover:bg-navy-light active:scale-[0.98] text-white rounded-xl text-sm font-semibold transition shadow-[0_10px_20px_rgba(12,35,64,0.18)]"
                    disabled={!isGuideApproved}
                  >
                    <Plus className="h-4 w-4" /> Add Trail
                  </button>
                </div>

                <div className="p-6">
                  {fetchingData ? (
                    <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-navy" /></div>
                  ) : myTrails.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-navy/20 bg-gradient-to-br from-white to-navy/5 text-center py-12 px-6">
                      <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-navy/10 text-navy animate-float">
                        <Mountain className="h-7 w-7" />
                      </div>
                      <p className="text-charcoal font-semibold">No trails assigned yet.</p>
                      <p className="text-sm text-gray-500 mt-1">Click Add Trail to list yourself and start receiving package bookings.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {myTrails.map(t => (
                        <div key={t.id} className={`border rounded-2xl p-5 relative transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(12,35,64,0.12)] ${t.is_active ? 'border-navy/15 bg-white shadow-[0_8px_20px_rgba(12,35,64,0.05)]' : 'border-gray-200 bg-gray-50 opacity-75'}`}>
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-bold text-charcoal text-lg">{t.trail_name}</h3>
                              <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><MapPin className="h-3.5 w-3.5" /> {t.region}</p>
                            </div>
                            <ExperienceBadge level={t.experience_level} />
                          </div>

                          <div className="flex gap-2 pt-4 border-t border-gray-100">
                            <button
                              onClick={() => handleToggleTrailActive(t.id, t.is_active)}
                              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold active:scale-[0.98] ${t.is_active ? 'border-gray-200 text-gray-600 hover:bg-gray-50' : 'bg-navy/5 border-navy/20 text-navy hover:bg-navy/10'}`}
                            >
                              {t.is_active ? <><EyeOff className="h-3.5 w-3.5" /> Deactivate</> : <><Eye className="h-3.5 w-3.5" /> Activate</>}
                            </button>
                            <button
                              onClick={() => { setEditingTrail(t); setShowTrailForm(true); }}
                              className="px-3 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition active:scale-95"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTrail(t.id)}
                              className="px-3 py-2 border border-red-100 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition active:scale-95"
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
            </motion.div>
          )}

          {activeTab === "services" && (
            <motion.div key="services" variants={fadeInUp} initial="initial" animate="animate" exit="exit" className="space-y-6">
              <div className="bg-white/95 rounded-3xl border border-navy/10 shadow-[0_12px_30px_rgba(12,35,64,0.08)]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gold/20">
                  <h2 className="text-charcoal font-semibold text-base">Service Packages</h2>
                  <button
                    onClick={() => { setEditingService(null); setShowServiceForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-navy hover:bg-navy-light active:scale-[0.98] text-white rounded-xl text-sm font-semibold transition shadow-[0_10px_20px_rgba(12,35,64,0.18)]"
                    disabled={myTrails.length === 0 || !isGuideApproved}
                  >
                    <Plus className="h-4 w-4" /> Add Package
                  </button>
                </div>

                <div className="p-6">
                  {!isVerificationResolved || fetchingData ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin text-navy" />
                    </div>
                  ) : !isGuideApproved ? (
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
                    <div className="rounded-2xl border border-dashed border-gold/30 bg-gradient-to-br from-white to-gold/10 text-center py-12 px-6">
                      <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/20 text-gold-dark animate-float">
                        <Package className="h-7 w-7" />
                      </div>
                      <p className="text-charcoal font-semibold">No service packages created.</p>
                      <p className="text-sm text-gray-500 mt-1">Create a signature package to stand out, for example Photography Trek or Budget Porter.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {services.map(s => (
                        <div key={s.service_id} className={`border rounded-2xl p-5 flex flex-col transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(12,35,64,0.12)] ${s.is_active ? 'border-navy/15 bg-white shadow-[0_8px_20px_rgba(12,35,64,0.05)]' : 'border-gray-200 bg-gray-50 opacity-75'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-charcoal text-lg">{s.title}</h3>
                            <span className="text-xs font-semibold px-2 py-1 bg-gold/10 text-gold-dark rounded-lg border border-gold/20">{s.trail_name}</span>
                          </div>
                          {(() => {
                            const approvalStatus = String(s.approval_status || "pending").toLowerCase();
                            const approvalStyles =
                              approvalStatus === "approved"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : approvalStatus === "rejected"
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : "border-amber-200 bg-amber-50 text-amber-700";
                            const approvalText =
                              approvalStatus === "approved"
                                ? "Approved: visible to tourists when active."
                                : approvalStatus === "rejected"
                                  ? `Rejected: ${s.approval_rejection_reason || "Please update details and resubmit."}`
                                  : "Pending admin approval: hidden from tourist listings until approved.";

                            return (
                              <div className={`mb-3 rounded-lg border px-2.5 py-2 text-[11px] font-semibold ${approvalStyles}`}>
                                {approvalText}
                              </div>
                            );
                          })()}
                          <p className="text-sm text-gray-500 mb-4 line-clamp-2 flex-1">{s.description}</p>

                          <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4 text-emerald-500" />
                              <span className="font-bold font-mono text-charcoal">{Number(s.price_per_day).toLocaleString()}</span>
                              <span className="text-xs text-gray-500 font-medium ml-1">/ participant / day</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-navy/5 px-2.5 py-1 rounded-lg border border-navy/10">
                              <Users className="h-3.5 w-3.5" /> Up to {s.max_group_size}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                              <Clock className="h-3.5 w-3.5" /> Min {Math.max(1, Number(s.min_booking_days || 1))} day{Math.max(1, Number(s.min_booking_days || 1)) === 1 ? "" : "s"}
                            </div>
                          </div>

                          <div className="flex gap-2 pt-4 border-t border-gray-100">
                            <button
                              onClick={() => handleToggleServiceActive(s.service_id, s.is_active)}
                              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold active:scale-[0.98] ${s.is_active ? 'border-gray-200 text-gray-600 hover:bg-gray-50' : 'bg-navy/5 border-navy/20 text-navy hover:bg-navy/10'}`}
                            >
                              {s.is_active ? <><EyeOff className="h-3.5 w-3.5" /> Deactivate</> : <><Eye className="h-3.5 w-3.5" /> Activate</>}
                            </button>
                            <button
                              onClick={() => { setEditingService(s); setShowServiceForm(true); }}
                              className="px-3 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition active:scale-95"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteService(s.service_id)}
                              className="px-3 py-2 border border-red-100 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition active:scale-95"
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
            </motion.div>
          )}

          {activeTab === "availability" && (
            <motion.div key="availability" variants={fadeInUp} initial="initial" animate="animate" exit="exit" className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-white/95 rounded-3xl border border-navy/10 shadow-[0_12px_30px_rgba(12,35,64,0.08)] p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-xl bg-gold/10 border border-gold/20">
                    <Calendar className="h-5 w-5 text-gold-dark" />
                  </div>
                  <div>
                    <h2 className="text-charcoal font-semibold text-base">Availability Calendar</h2>
                    <p className="text-gray-400 text-xs">Select any future date, then confirm action below. Tourist-booked dates are locked from edits.</p>
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-navy/10 bg-navy/5 px-2.5 py-2 text-center">
                    <p className="text-[10px] uppercase tracking-wide font-bold text-navy">Step 1</p>
                    <p className="text-[11px] text-gray-600 mt-0.5">Select Date</p>
                  </div>
                  <div className="rounded-xl border border-navy/10 bg-navy/5 px-2.5 py-2 text-center">
                    <p className="text-[10px] uppercase tracking-wide font-bold text-navy">Step 2</p>
                    <p className="text-[11px] text-gray-600 mt-0.5">Review Status</p>
                  </div>
                  <div className="rounded-xl border border-navy/10 bg-navy/5 px-2.5 py-2 text-center">
                    <p className="text-[10px] uppercase tracking-wide font-bold text-navy">Step 3</p>
                    <p className="text-[11px] text-gray-600 mt-0.5">Confirm</p>
                  </div>
                </div>

                {availabilityNotice && (
                  <div
                    className={`mb-4 rounded-xl border px-3 py-2 text-sm font-medium ${
                      availabilityNotice.type === "error"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {availabilityNotice.message}
                  </div>
                )}

                <div className="rounded-2xl border border-navy/10 bg-gradient-to-br from-white to-navy/5 p-2 sm:p-3">
                  <DayPicker
                    mode="single"
                    showOutsideDays
                    fixedWeeks
                    disabled={[{ before: startOfLocalDay(new Date()) }]}
                    selected={selectedAvailabilityDate || undefined}
                    onSelect={(day) => handleAvailabilityDaySelect(day)}
                    modifiers={{
                      available: (date) => {
                        const dateKey = toDateKey(date);
                        return (
                          Boolean(dateKey) &&
                          !isPastDateKey(dateKey) &&
                          !upcomingBookedDateSet.has(dateKey) &&
                          !manualBusyDateSet.has(dateKey)
                        );
                      },
                      busy: manualBusyDateKeys.map((key) => dateKeyToDate(key)).filter(Boolean),
                      booked: upcomingBookedDateKeys.map((key) => dateKeyToDate(key)).filter(Boolean),
                      updating: updatingAvailabilityDate
                        ? [dateKeyToDate(updatingAvailabilityDate)].filter(Boolean)
                        : [],
                    }}
                    modifiersClassNames={{
                      available: "bg-white text-gray-700 border border-gray-100 hover:bg-gray-50",
                      busy: "bg-amber-100 text-amber-900 font-semibold border border-amber-300 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.12)]",
                      booked: "bg-rose-100 text-rose-900 font-semibold border border-rose-300 line-through cursor-not-allowed",
                      updating: "animate-pulse bg-navy/15 text-navy font-semibold ring-2 ring-navy/25",
                    }}
                    className="w-full"
                    classNames={{
                      months: "flex justify-center",
                      month: "space-y-2 w-full",
                      caption: "flex justify-between py-1.5 px-1 relative items-center",
                      caption_label: "text-sm sm:text-base font-bold tracking-tight text-charcoal",
                      nav: "flex items-center gap-1",
                      nav_button: "h-7 w-7 sm:h-8 sm:w-8 rounded-lg border border-navy/15 bg-white text-navy hover:bg-navy/10 hover:border-navy/25 transition-all duration-200 active:scale-95",
                      table: "w-full border-collapse",
                      head_row: "grid grid-cols-7 gap-1 sm:gap-1.5",
                      head_cell: "text-gray-500 rounded-md w-full font-semibold text-[11px] sm:text-xs uppercase tracking-[0.06em]",
                      row: "grid grid-cols-7 gap-1 sm:gap-1.5 w-full mt-1.5",
                      cell: "h-9 w-9 sm:h-10 sm:w-10 text-center text-sm p-0 relative",
                      day: "h-9 w-9 sm:h-10 sm:w-10 p-0 font-semibold rounded-lg sm:rounded-xl hover:bg-navy/10 transition-all duration-150 hover:scale-[1.03] hover:shadow-sm",
                      day_selected: "bg-navy text-white border border-navy shadow-[0_6px_14px_rgba(12,35,64,0.28)] hover:bg-navy",
                      day_today: "border border-gold text-gold-dark ring-1 ring-gold/20",
                      day_outside: "text-gray-300 opacity-45",
                      day_disabled: "text-gray-300 opacity-70 cursor-not-allowed",
                    }}
                  />
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-semibold">
                  <div className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-rose-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Tourist Booked
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-amber-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Marked Busy
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-emerald-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Available
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-navy/10 bg-white p-3 sm:p-4 shadow-[0_8px_20px_rgba(12,35,64,0.06)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Selected Date</p>
                      <p className="text-sm font-bold text-charcoal mt-0.5">
                        {selectedAvailabilityDate
                          ? selectedAvailabilityDate.toLocaleDateString("en-US", {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Choose a date from calendar"}
                      </p>
                    </div>
                    {selectedAvailabilityDateKey && (
                      <span
                        className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-bold ${
                          selectedDateIsBooked
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : selectedDateIsBusy
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {selectedDateIsBooked
                          ? "Booked by Tourist"
                          : selectedDateIsBusy
                          ? "Busy (Manual)"
                          : "Available"}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={applySelectedAvailabilityChange}
                    disabled={
                      !selectedAvailabilityDateKey ||
                      selectedDateIsBooked ||
                      selectedDateIsPast ||
                      Boolean(updatingAvailabilityDate)
                    }
                    className={`mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                      !selectedAvailabilityDateKey || selectedDateIsBooked || selectedDateIsPast || updatingAvailabilityDate
                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                        : selectedDateIsBusy
                        ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-[0_10px_20px_rgba(5,150,105,0.22)]"
                        : "bg-amber-500 text-white hover:bg-amber-600 shadow-[0_10px_20px_rgba(245,158,11,0.22)]"
                    }`}
                  >
                    {updatingAvailabilityDate
                      ? "Updating..."
                      : !selectedAvailabilityDateKey
                      ? "Select a date first"
                      : selectedDateIsPast
                      ? "Past date (read-only)"
                      : selectedDateIsBooked
                      ? "Booked by tourist (locked)"
                      : selectedDateIsBusy
                      ? "Mark as Available"
                      : "Mark as Busy"}
                  </button>
                </div>

                {updatingAvailabilityDate && (
                  <p className="mt-3 text-xs text-navy inline-flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Updating {updatingAvailabilityDate}...
                  </p>
                )}
              </div>

              <div className="bg-white/95 rounded-3xl border border-navy/10 shadow-[0_12px_30px_rgba(12,35,64,0.08)] p-4 sm:p-6">
                <h2 className="text-charcoal font-semibold text-base mb-4">Upcoming Busy / Booked Dates</h2>

                {upcomingStatusRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-alpine/30 bg-gradient-to-br from-white to-alpine/10 text-center py-10 px-6">
                    <Calendar className="h-8 w-8 text-alpine mx-auto mb-2 animate-float" />
                    <p className="text-sm font-semibold text-charcoal">No upcoming blocked dates. You are fully available.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {upcomingStatusRows.map((row) => (
                      <div
                        key={`${row.status}-${row.dateKey}`}
                        className={`flex items-center justify-between p-3 rounded-xl border ${
                          row.status === "booked"
                            ? "bg-rose-50 border-rose-100"
                            : "bg-amber-50 border-amber-100"
                        }`}
                      >
                        <div className="flex items-center gap-3 text-sm font-bold text-gray-800">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          {dateKeyToDate(row.dateKey)?.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }) || row.dateKey}
                        </div>
                        <span
                          className={`text-xs font-bold px-2 py-1 rounded-lg ${
                            row.status === "booked"
                              ? "text-rose-700 bg-rose-100"
                              : "text-amber-700 bg-amber-100"
                          }`}
                        >
                          {row.status === "booked" ? "Booked by Tourist" : "Busy (Manual)"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "bookings" && (
            <motion.div key="bookings" variants={fadeInUp} initial="initial" animate="animate" exit="exit" className="space-y-6">
              <motion.div className="grid grid-cols-2 lg:grid-cols-5 gap-4" variants={staggerFast} initial="initial" animate="animate">
                <StatCard icon={Users} label="Current/Upcoming" value={currentGuideBookings.length} accent="blue" />
                <StatCard icon={Clock} label="Pending" value={currentGuideBookings.filter((b) => String(b.status || "").toLowerCase() === "pending").length} accent="amber" />
                <StatCard icon={CheckCircle2} label="Confirmed" value={currentGuideBookings.filter((b) => String(b.status || "").toLowerCase() === "confirmed").length} accent="emerald" />
                <StatCard icon={XCircle} label="History" value={historyGuideBookings.length} accent="purple" />
                <StatCard icon={DollarSign} label="Net Earnings" value={formatNprAmount(guideNetEarnings)} accent="emerald" />
              </motion.div>

              <div className="bg-white/95 rounded-3xl border border-navy/10 shadow-[0_12px_30px_rgba(12,35,64,0.08)] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-charcoal font-semibold text-base">Guide Package Bookings</h2>
                  <p className="text-xs text-gray-400">Current and upcoming bookings only</p>
                </div>

                {currentGuideBookings.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-navy/20 bg-gradient-to-br from-white to-navy/5 text-center py-12 px-6">
                    <Users className="h-10 w-10 text-navy/40 mx-auto mb-3 animate-float" />
                    <p className="text-charcoal font-semibold">No current or upcoming package bookings.</p>
                    <p className="text-sm text-gray-500 mt-1">Past bookings are moved to history below.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentGuideBookings.map((booking) => {
                      const bookingStatus = String(booking.status || "").toLowerCase();
                      const paymentStatus = String(booking.payment_status || "").toLowerCase();
                      const refundStatus = String(booking.refund_status || "").toLowerCase();
                      const isExpanded = Boolean(expandedBookingDetails[booking.booking_id]);
                      void hasBookingStarted(booking); // reserved for future use
                      const isPending = bookingStatus === "pending";
                      const isConfirmed = bookingStatus === "confirmed";
                      const isLocked = ["refund_requested", "refunded", "rejected", "expired"].includes(bookingStatus) || ["processing", "refunded"].includes(refundStatus);
                      const canChat = ["success", "refund_requested", "refunded"].includes(paymentStatus) && !["rejected", "expired"].includes(bookingStatus);

                      return (
                        <div key={booking.booking_id} className="rounded-2xl border border-navy/10 bg-white p-4 shadow-[0_8px_20px_rgba(12,35,64,0.05)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(12,35,64,0.12)]">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="font-bold text-charcoal">{booking.service_title}</h3>
                              <p className="text-xs text-gray-500 mt-1">{booking.tourist_name} • {booking.trail_name}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(booking.start_date).toLocaleDateString()} to {new Date(booking.end_date).toLocaleDateString()} • {booking.participants_count} participant{Number(booking.participants_count) > 1 ? "s" : ""}
                              </p>
                              {booking.approval_deadline_at && bookingStatus === "pending" && (
                                <p className="text-xs text-amber-600 mt-1">Approval deadline: {new Date(booking.approval_deadline_at).toLocaleString()}</p>
                              )}
                              {refundStatus && (
                                <p className="text-xs text-cyan-700 mt-1 capitalize">Refund status: {refundStatus}</p>
                              )}
                              {booking.refund_reference && (
                                <p className="text-xs text-gray-500 mt-1">Refund ref: {booking.refund_reference}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-charcoal">NPR {Number(booking.total_price || 0).toLocaleString()}</p>
                              <span className={`inline-flex mt-1 items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                                bookingStatus === "confirmed"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : bookingStatus === "pending"
                                  ? "border-violet-200 bg-violet-50 text-violet-700"
                                : bookingStatus === "rejected"
                                  ? "border-rose-200 bg-rose-50 text-rose-700"
                                : bookingStatus === "expired"
                                  ? "border-orange-200 bg-orange-50 text-orange-700"
                                  : bookingStatus === "cancelled"
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : bookingStatus === "refund_requested"
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-blue-200 bg-blue-50 text-blue-700"
                              }`}>
                                {bookingStatus.replace("_", " ")}
                              </span>
                              <div>
                                <button
                                  type="button"
                                  onClick={() => toggleBookingDetails(booking.booking_id)}
                                  className="mt-2 inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-100"
                                >
                                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                  {isExpanded ? "Hide details" : "View details"}
                                </button>
                              </div>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
                                <p><span className="font-semibold text-gray-500">Booking ID:</span> {booking.booking_id}</p>
                                <p><span className="font-semibold text-gray-500">Booking Code:</span> {booking.booking_code || "-"}</p>
                                <p><span className="font-semibold text-gray-500">Tourist:</span> {booking.tourist_name || "-"}</p>
                                <p><span className="font-semibold text-gray-500">Contact Phone:</span> {booking.contact_phone || "-"}</p>
                                <p><span className="font-semibold text-gray-500">Payment:</span> {(booking.payment_status || "pending").toString().replace("_", " ")}</p>
                                <p><span className="font-semibold text-gray-500">Refund:</span> {(booking.refund_status || "none").toString().replace("_", " ")}</p>
                                <p><span className="font-semibold text-gray-500">Created At:</span> {booking.created_at ? new Date(booking.created_at).toLocaleString() : "-"}</p>
                                <p><span className="font-semibold text-gray-500">Decided At:</span> {booking.decided_at ? new Date(booking.decided_at).toLocaleString() : "-"}</p>
                              </div>
                              {booking.special_requests && (
                                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                                  <span className="font-semibold">Special requests:</span> {booking.special_requests}
                                </div>
                              )}
                              {booking.review_id && (
                                <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-xs text-blue-800">
                                  <span className="font-semibold">Tourist review:</span> {Number(booking.review_rating || 0).toFixed(1)} / 5
                                  {booking.review_comment ? ` - ${booking.review_comment}` : ""}
                                </div>
                              )}
                            </div>
                          )}

                          {!isLocked && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {isPending && (
                                <>
                                <button
                                  onClick={() => handleGuideBookingStatus(booking.booking_id, "confirmed")}
                                  disabled={updatingBookingId === booking.booking_id}
                                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 active:scale-[0.98] disabled:opacity-60"
                                >
                                  {updatingBookingId === booking.booking_id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleGuideBookingStatus(booking.booking_id, "rejected")}
                                  disabled={updatingBookingId === booking.booking_id}
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 active:scale-[0.98] disabled:opacity-60"
                                >
                                  {updatingBookingId === booking.booking_id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                  Reject
                                </button>
                                </>
                              )}

                              {isConfirmed && (
                                <p className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">
                                  Confirmed booking: cancellation unavailable for guide
                                </p>
                              )}
                            </div>
                          )}

                          {canChat && (
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={() => openGuideBookingChat(booking)}
                                className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 active:scale-[0.98]"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                Chat With Tourist
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {historyGuideBookings.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-navy/10">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-charcoal">Booking History</h3>
                      <p className="text-xs text-gray-500">{historyGuideBookings.length} past booking{historyGuideBookings.length === 1 ? "" : "s"}</p>
                    </div>
                    <div className="space-y-2">
                      {historyGuideBookings.map((booking) => {
                        const bookingStatus = String(booking.status || "").toLowerCase();
                        const isExpanded = Boolean(expandedBookingDetails[`history-${booking.booking_id}`]);
                        return (
                          <div key={`history-${booking.booking_id}`} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-charcoal">{booking.service_title}</p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {booking.tourist_name} • {new Date(booking.start_date).toLocaleDateString()} to {new Date(booking.end_date).toLocaleDateString()}
                                </p>
                              </div>
                              <span className="inline-flex rounded-full border border-gray-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                                {bookingStatus.replace("_", " ")}
                              </span>
                            </div>
                            <div className="mt-2">
                              <button
                                type="button"
                                onClick={() => toggleBookingDetails(`history-${booking.booking_id}`)}
                                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-100"
                              >
                                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                {isExpanded ? "Hide details" : "View details"}
                              </button>
                            </div>
                            {isExpanded && (
                              <div className="mt-2 rounded-lg border border-gray-200 bg-white p-2.5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
                                  <p><span className="font-semibold text-gray-500">Booking ID:</span> {booking.booking_id}</p>
                                  <p><span className="font-semibold text-gray-500">Booking Code:</span> {booking.booking_code || "-"}</p>
                                  <p><span className="font-semibold text-gray-500">Tourist:</span> {booking.tourist_name || "-"}</p>
                                  <p><span className="font-semibold text-gray-500">Contact Phone:</span> {booking.contact_phone || "-"}</p>
                                  <p><span className="font-semibold text-gray-500">Participants:</span> {booking.participants_count || "-"}</p>
                                  <p><span className="font-semibold text-gray-500">Total:</span> NPR {Number(booking.total_price || 0).toLocaleString()}</p>
                                  <p><span className="font-semibold text-gray-500">Payment:</span> {(booking.payment_status || "pending").toString().replace("_", " ")}</p>
                                  <p><span className="font-semibold text-gray-500">Refund:</span> {(booking.refund_status || "none").toString().replace("_", " ")}</p>
                                </div>
                                {booking.special_requests && (
                                  <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                                    <span className="font-semibold">Special requests:</span> {booking.special_requests}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "reviews" && (
            <motion.div key="reviews" variants={fadeInUp} initial="initial" animate="animate" exit="exit" className="bg-white/95 rounded-3xl border border-navy/10 shadow-[0_12px_30px_rgba(12,35,64,0.08)] p-6">
              <div className="flex items-center gap-6 mb-8 border-b border-gray-100 pb-6">
                <div className="flex items-center justify-center bg-gradient-to-br from-gold to-gold-dark rounded-2xl p-4 shadow-lg shadow-gold/30">
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
                  <h2 className="text-2xl font-bold text-charcoal">Your Rating</h2>
                  <p className="text-gray-500">Based on {reviewsStats.total} total reviews from tourists.</p>
                </div>
              </div>

              {reviews.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gold/30 bg-gradient-to-br from-white to-gold/10 text-center py-12 px-6">
                  <Star className="h-10 w-10 text-gold-dark/70 mx-auto mb-3 animate-float" />
                  <p className="text-charcoal font-semibold">No reviews yet.</p>
                  <p className="text-sm text-gray-500 mt-1">Complete treks with excellent service to start collecting ratings.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map(r => (
                    <div key={r.review_id} className="p-4 rounded-2xl bg-navy/5 border border-navy/10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-navy/10 text-navy flex items-center justify-center font-bold text-xs">
                            {r.reviewer_name?.charAt(0) || "T"}
                          </div>
                          <p className="font-semibold text-charcoal text-sm">{r.reviewer_name || "Tourist"}</p>
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
            </motion.div>
          )}
          </AnimatePresence>
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

      <GuideBookingChatModal
        isOpen={chatModalOpen}
        onClose={closeGuideBookingChat}
        booking={activeChatBooking}
        currentRole="guide"
      />

      <LogoutModal isOpen={showLogoutModal} onConfirm={handleLogout} onCancel={handleStayLoggedIn} />
    </div>
  );
};

// ================= TRAIL FORM COMPONENT =================
const TrailForm = ({ trails, onSubmit, onCancel, initialData, isSubmitting }) => {
  const [form, setForm] = useState({
    trail_id: initialData?.trail_id || "",
    experience_level: initialData?.experience_level || "",
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleSubmit = (e) => { e.preventDefault(); onSubmit(form); };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-[0_20px_45px_rgba(12,35,64,0.22)] w-full max-w-lg border border-navy/10">
        <div className="flex items-center justify-between p-6 border-b border-gold/20 bg-gradient-to-r from-[#fdf9ef] to-white rounded-t-3xl">
          <h2 className="text-xl font-bold text-charcoal">{initialData ? "Edit Trail Assignment" : "Add Trail"}</h2>
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-xl transition"><X className="h-5 w-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {!initialData && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Trail</label>
              <select name="trail_id" value={form.trail_id} onChange={handleChange} required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-navy/40">
                <option value="">Select a trail...</option>
                {trails.map(t => <option key={t.trail_id} value={t.trail_id}>{t.trail_name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Experience Level</label>
            <select name="experience_level" value={form.experience_level} onChange={handleChange} required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-navy/40">
              <option value="">Select level...</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="expert">Expert</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onCancel} className="flex-1 px-4 py-2.5 border rounded-xl font-semibold transition active:scale-[0.98]">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 bg-navy hover:bg-navy-light text-white rounded-xl font-semibold transition active:scale-[0.98]">
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
    min_booking_days: initialData?.min_booking_days || 1,
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleSubmit = (e) => { e.preventDefault(); onSubmit(form); };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-[0_20px_45px_rgba(12,35,64,0.22)] w-full max-w-lg border border-navy/10">
        <div className="flex items-center justify-between p-6 border-b border-gold/20 bg-gradient-to-r from-[#fdf9ef] to-white rounded-t-3xl">
          <h2 className="text-xl font-bold text-charcoal">{initialData ? "Edit Package" : "Create Package"}</h2>
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-xl transition"><X className="h-5 w-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {!initialData && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">For Assigned Trail</label>
              <select name="trail_id" value={form.trail_id} onChange={handleChange} required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-navy/40">
                <option value="">Select assigned trail...</option>
                {myTrails.map(t => <option key={t.trail_id} value={t.trail_id}>{t.trail_name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Package Title</label>
            <input type="text" name="title" value={form.title} onChange={handleChange} required placeholder="e.g. Photography Trek" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-navy/40" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Daily Price per Participant (NPR)</label>
              <input type="number" name="price_per_day" value={form.price_per_day} onChange={handleChange} required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-navy/40" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Max Group Size</label>
              <input type="number" name="max_group_size" value={form.max_group_size} onChange={handleChange} required min="1" max="15" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-navy/40" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Minimum Booking Days</label>
              <input type="number" name="min_booking_days" value={form.min_booking_days} onChange={handleChange} required min="1" max="60" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-navy/40" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} required rows={3} placeholder="Describe what is included..." className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-navy/40 resize-none"></textarea>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onCancel} className="flex-1 px-4 py-2.5 border rounded-xl font-semibold transition active:scale-[0.98]">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 bg-navy hover:bg-navy-light text-white rounded-xl font-semibold transition active:scale-[0.98]">
              {isSubmitting ? "Saving..." : "Save Package"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GuideDashboard;
