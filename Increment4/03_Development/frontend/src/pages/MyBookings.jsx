import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Home,
  Loader2,
  MapPin,
  Users,
  BedDouble,
  BadgeCheck,
  XCircle,
  Mountain,
  Compass,
  Package,
  Star,
  FileText,
  Download,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import LogoutModal from "../components/LogoutModal";
import GuideBookingChatModal from "../components/GuideBookingChatModal";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import { useAuth } from "../context/AuthContext";
import { getToken } from "../tokenStore";
import api from "../api";
import { downloadInvoicePdfFile, formatInvoiceDate, formatMoney } from "../utils/invoicePdf";

const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const hasCheckoutPassed = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  return Date.now() > endOfDay.getTime();
};

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const toComparableDateKey = (dateValue) => {
  if (!dateValue) return null;
  const asString = String(dateValue).trim();
  if (!asString) return null;

  const datePrefixMatch = asString.match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/);
  if (datePrefixMatch) {
    return datePrefixMatch[1];
  }

  if (DATE_ONLY_RE.test(asString)) {
    return asString;
  }

  const parsed = new Date(asString);
  if (Number.isNaN(parsed.getTime())) return null;

  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getTodayDateKey = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const hasServiceDateStarted = (dateValue) => {
  const dateKey = toComparableDateKey(dateValue);
  if (!dateKey) return false;
  return dateKey <= getTodayDateKey();
};

const hasServiceEnded = (dateValue) => {
  const dateKey = toComparableDateKey(dateValue);
  if (!dateKey) return false;
  return dateKey < getTodayDateKey();
};

const MyBookings = () => {
  const navigate = useNavigate();
  const { user: authUser, loading } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [guideBookings, setGuideBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [notification, setNotification] = useState(null);
  const [cancellingBookingId, setCancellingBookingId] = useState(null);
  const [refundingBookingId, setRefundingBookingId] = useState(null);
  const [refundingGuideBookingId, setRefundingGuideBookingId] = useState(null);
  const [activeTab, setActiveTab] = useState("homestay");
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewDraft, setReviewDraft] = useState({
    bookingId: null,
    reviewType: "homestay",
    listingName: "",
    rating: 0,
    comment: "",
  });
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceLoadingKey, setInvoiceLoadingKey] = useState("");
  const [invoiceDownloading, setInvoiceDownloading] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [activeChatBooking, setActiveChatBooking] = useState(null);
  const {
    handleLogout,
    handleStayLoggedIn,
    showLogoutModal,
    setShowLogoutModal,
  } = useLogoutHandler();

  const showNotice = useCallback((message, type = "success") => {
    setNotification({ type, message });
    window.setTimeout(() => setNotification(null), 3800);
  }, []);

  const fetchBookings = useCallback(async () => {
    setLoadingBookings(true);
    try {
      const res = await api.get("/api/bookings/my");
      setBookings(res.data.bookings || []);

      const guideRes = await api.get("/api/guide-bookings/my");
      setGuideBookings(guideRes.data.bookings || []);
    } catch (err) {
      showNotice(err.response?.data?.message || "Could not load your bookings", "error");
    } finally {
      setLoadingBookings(false);
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

    fetchBookings();
  }, [loading, authUser, navigate, fetchBookings]);

  const currentHomestayBookings = useMemo(
    () => bookings.filter((booking) => !hasServiceEnded(booking.check_out_date)),
    [bookings]
  );

  const homestayHistoryBookings = useMemo(
    () => bookings.filter((booking) => hasServiceEnded(booking.check_out_date)),
    [bookings]
  );

  const currentGuideBookings = useMemo(
    () => guideBookings.filter((booking) => !hasServiceEnded(booking.end_date)),
    [guideBookings]
  );

  const guideHistoryBookings = useMemo(
    () => guideBookings.filter((booking) => hasServiceEnded(booking.end_date)),
    [guideBookings]
  );

  const activeBookings = useMemo(
    () => currentHomestayBookings.filter((booking) => booking.status === "confirmed"),
    [currentHomestayBookings]
  );

  const activeGuideBookings = useMemo(
    () => currentGuideBookings.filter((booking) => {
      const status = String(booking.status || "").toLowerCase();
      return status === "pending" || status === "confirmed";
    }),
    [currentGuideBookings]
  );

  const cancelBooking = async (bookingId) => {
    setCancellingBookingId(bookingId);
    try {
      const res = await api.patch(`/api/bookings/${bookingId}/cancel`, {});
      showNotice(res.data.message);
      await fetchBookings();
    } catch (err) {
      showNotice(err.response?.data?.message || "Failed to cancel booking", "error");
    } finally {
      setCancellingBookingId(null);
    }
  };

  const requestRefund = async (bookingId) => {
    const reasonInput = window.prompt("Enter a short reason for your refund request (optional):", "");
    if (reasonInput === null) return;

    setRefundingBookingId(bookingId);
    try {
      const res = await api.post(`/api/bookings/${bookingId}/refund/request`, {
        reason: String(reasonInput || "").trim() || null,
      });
      showNotice(res.data.message || "Refund request submitted");
      await fetchBookings();
    } catch (err) {
      const statusCode = err.response?.status;
      const serverMessage = err.response?.data?.message;

      if (!serverMessage && statusCode === 404) {
        showNotice("Refund API route is not available on the running backend. Please restart server.", "error");
      } else {
        showNotice(serverMessage || "Failed to request refund", "error");
      }
    } finally {
      setRefundingBookingId(null);
    }
  };

  const requestGuideRefund = async (bookingId) => {
    const reasonInput = window.prompt("Enter a short reason for your guide-package refund request (optional):", "");
    if (reasonInput === null) return;

    setRefundingGuideBookingId(bookingId);
    try {
      const res = await api.post(`/api/guide-bookings/${bookingId}/refund/request`, {
        reason: String(reasonInput || "").trim() || null,
      });
      showNotice(res.data.message || "Guide refund request submitted");
      await fetchBookings();
    } catch (err) {
      showNotice(err.response?.data?.message || "Failed to request guide refund", "error");
    } finally {
      setRefundingGuideBookingId(null);
    }
  };

  const openReviewModal = (booking, reviewType) => {
    const type = reviewType === "guide" ? "guide" : "homestay";
    const listingName = type === "guide"
      ? String(booking.guide_name || booking.service_title || "Guide Package")
      : String(booking.homestay_name || "Homestay");

    setHoverRating(0);
    setReviewDraft({
      bookingId: booking.booking_id,
      reviewType: type,
      listingName,
      rating: Number(booking.review_rating || 0),
      comment: String(booking.review_comment || ""),
    });
    setReviewModalOpen(true);
  };

  const closeReviewModal = () => {
    if (submittingReview) return;
    setReviewModalOpen(false);
    setHoverRating(0);
  };

  const submitBookingReview = async () => {
    if (!reviewDraft.bookingId) return;
    if (!reviewDraft.rating || reviewDraft.rating < 1 || reviewDraft.rating > 5) {
      showNotice("Please pick a star rating from 1 to 5", "error");
      return;
    }

    setSubmittingReview(true);
    try {
      const endpoint = reviewDraft.reviewType === "guide"
        ? `/api/guide-bookings/${reviewDraft.bookingId}/review`
        : `/api/bookings/${reviewDraft.bookingId}/review`;

      const res = await api.post(endpoint, {
        rating: reviewDraft.rating,
        comment: String(reviewDraft.comment || "").trim(),
      });
      showNotice(res.data?.message || "Review submitted successfully");
      setReviewModalOpen(false);
      setHoverRating(0);
      await fetchBookings();
    } catch (err) {
      showNotice(err.response?.data?.message || "Failed to submit review", "error");
    } finally {
      setSubmittingReview(false);
    }
  };

  const openInvoiceModal = async (bookingType, bookingId) => {
    const normalizedType = bookingType === "guide_package" ? "guide_package" : "homestay";
    const requestKey = `${normalizedType}:${bookingId}`;

    setInvoiceLoadingKey(requestKey);
    try {
      const res = await api.get(`/api/invoices/${normalizedType}/${bookingId}`);
      setInvoiceData(res.data?.invoice || null);
      setInvoiceModalOpen(true);
    } catch (err) {
      showNotice(err.response?.data?.message || "Unable to load invoice", "error");
    } finally {
      setInvoiceLoadingKey("");
    }
  };

  const closeInvoiceModal = () => {
    if (invoiceDownloading) return;
    setInvoiceModalOpen(false);
  };

  const downloadInvoicePdf = async () => {
    if (!invoiceData) return;
    setInvoiceDownloading(true);
    try {
      await downloadInvoicePdfFile(invoiceData);
      showNotice("Invoice downloaded successfully");
    } catch (_error) {
      showNotice("Unable to export invoice as PDF", "error");
    } finally {
      setInvoiceDownloading(false);
    }
  };

  const openGuideBookingChat = (booking) => {
    setActiveChatBooking(booking);
    setChatModalOpen(true);
  };

  const closeGuideBookingChat = () => {
    setChatModalOpen(false);
    setActiveChatBooking(null);
  };

  if (loading || loadingBookings) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f4f2ee] via-[#faf8f4] to-[#f2efe8]">
        <Header user={authUser} onLogoutClick={() => setShowLogoutModal(true)} />
        <div className="max-w-5xl mx-auto px-6 pt-32 pb-20 flex items-center justify-center">
          <div className="flex items-center gap-3 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin" />
            Loading your bookings...
          </div>
        </div>
        <LogoutModal isOpen={showLogoutModal} onConfirm={handleLogout} onCancel={handleStayLoggedIn} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f4f2ee] via-[#faf8f4] to-[#f2efe8]">
      <Header user={authUser} onLogoutClick={() => setShowLogoutModal(true)} />

      {notification && (
        <div
          className={`fixed right-4 top-20 z-[100] rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${
            notification.type === "error" ? "bg-red-600 text-white" : "bg-emerald-600 text-white"
          }`}
        >
          {notification.message}
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-20">
        <section className="rounded-3xl border border-gold/20 bg-white/90 shadow-[0_10px_30px_rgba(12,35,64,0.08)] p-6 sm:p-8 mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <button
                onClick={() => navigate("/")}
                className="inline-flex items-center gap-2 rounded-lg border border-gold/30 bg-white px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/5 transition-all mb-3"
              >
                <Home className="h-4 w-4" />
                Back to Home
              </button>
              <p className="uppercase text-[11px] tracking-[0.24em] text-gold-dark font-semibold mb-2">Tourist Dashboard</p>
              <h1 className="text-3xl sm:text-4xl font-heading text-charcoal">My Bookings</h1>
              <p className="text-gray-500 mt-2">Track your homestay and guide-package bookings in one place.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-emerald-700 text-sm font-semibold">
              <BadgeCheck className="h-4 w-4" />
              {activeTab === "homestay" ? activeBookings.length : activeGuideBookings.length} active booking{(activeTab === "homestay" ? activeBookings.length : activeGuideBookings.length) === 1 ? "" : "s"}
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <div className="mb-8 grid grid-cols-2 gap-4">
          <button
            onClick={() => setActiveTab("homestay")}
            className={`py-3 px-6 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
              activeTab === "homestay"
                ? "bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-lg shadow-amber-200 scale-105"
                : "bg-white border-2 border-amber-200 text-amber-700 hover:border-amber-300 hover:bg-amber-50"
            }`}
          >
            <BedDouble size={20} />
            Homestay Bookings
          </button>
          <button
            onClick={() => setActiveTab("guide")}
            className={`py-3 px-6 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
              activeTab === "guide"
                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200 scale-105"
                : "bg-white border-2 border-blue-200 text-blue-700 hover:border-blue-300 hover:bg-blue-50"
            }`}
          >
            <Mountain size={20} />
            Guide Bookings
          </button>
        </div>

        {bookings.length === 0 && guideBookings.length === 0 ? (
          <section className="rounded-3xl border border-navy/10 bg-white p-8 text-center shadow-[0_10px_24px_rgba(12,35,64,0.06)]">
            <Mountain className="h-10 w-10 mx-auto text-gold mb-3" />
            <h2 className="text-xl font-bold text-charcoal">No bookings yet</h2>
            <p className="text-gray-500 mt-2 mb-5">Discover approved homestays along trails and reserve your stay.</p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-[#D4A43A] px-4 py-2.5 text-sm font-bold text-navy"
            >
              <Home className="h-4 w-4" />
              Explore Trails
            </Link>
          </section>
        ) : (
          <section className="space-y-10">
            {activeTab === "homestay" && (
            <div className="rounded-3xl border border-navy/10 bg-white/95 shadow-[0_10px_30px_rgba(12,35,64,0.06)] p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gold/20">
                <div className="rounded-full bg-gradient-to-br from-gold to-[#D4A43A] p-2.5">
                  <Home className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="uppercase text-[10px] tracking-[0.2em] text-gold-dark font-semibold">Currently Viewing</p>
                  <h2 className="text-2xl font-bold text-charcoal">Homestay Bookings</h2>
                </div>
              </div>

              {currentHomestayBookings.length === 0 ? (
                <div className="rounded-2xl border border-navy/10 bg-gradient-to-br from-gray-50 to-white p-6 text-center text-sm text-gray-600">
                  <Home className="h-8 w-8 mx-auto text-gold/40 mb-2" />
                  <p>No current or upcoming homestay bookings.</p>
                </div>
              ) : (
                <>
                  <div className="mb-6 rounded-2xl border-l-4 border-l-amber-500 border border-amber-200 bg-gradient-to-r from-amber-50 to-white px-5 py-4 text-xs sm:text-sm text-amber-900">
                    <p className="font-bold text-amber-950 mb-2 flex items-center gap-2">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                      Refund Eligibility Guidelines
                    </p>
                    <div className="space-y-1 ml-2">
                      <p><span className="font-semibold">72+ hours before check-in:</span> 100% full refund</p>
                      <p><span className="font-semibold">24-72 hours before check-in:</span> 50% partial refund</p>
                      <p><span className="font-semibold">Under 24 hours:</span> Not eligible for refund</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {currentHomestayBookings.map((booking) => {
              const bookingStatus = String(booking.status || "").toLowerCase();
              const paymentStatus = String(booking.payment_status || "").toLowerCase();
              const isCancelled = bookingStatus === "cancelled";
              const isRefundRequested = bookingStatus === "refund_requested" || paymentStatus === "refund_requested";
              const isRefunded = bookingStatus === "refunded" || paymentStatus === "refunded";
              const isPaid = paymentStatus === "success" || isRefundRequested || isRefunded;
              const serviceDateStarted = hasServiceDateStarted(booking.check_in_date);
              const backendRefundEligible = typeof booking.refund_eligible === "boolean" ? booking.refund_eligible : null;
              const refundIneligibilityReason = String(booking.refund_reason || "").trim();
              const canAttemptHomestayRefund =
                !isCancelled && !isRefundRequested && !isRefunded && paymentStatus === "success";
              const canRequestHomestayRefund =
                canAttemptHomestayRefund && (backendRefundEligible ?? !serviceDateStarted);
              const hasReview = Boolean(booking.review_id);
              const canReview =
                (Boolean(booking.can_review) || (!hasReview && bookingStatus === "confirmed" && hasCheckoutPassed(booking.check_out_date))) &&
                paymentStatus === "success";
              return (
                <article
                  key={booking.booking_id}
                  className="rounded-3xl border border-navy/10 bg-white p-6 shadow-[0_10px_24px_rgba(12,35,64,0.06)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <h2 className="text-xl font-bold text-charcoal">{booking.homestay_name}</h2>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
                        isRefunded
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : isRefundRequested
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : isCancelled
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {(isCancelled || isRefundRequested) ? <XCircle className="h-3.5 w-3.5" /> : <BadgeCheck className="h-3.5 w-3.5" />}
                      {isRefunded ? "Refunded" : isRefundRequested ? "Refund Requested" : isCancelled ? "Cancelled" : "Confirmed"}
                    </span>
                  </div>

                  <div className="space-y-2.5 text-sm text-gray-600">
                    <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-gold" /> {booking.homestay_location}</p>
                    <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-navy" /> {formatDate(booking.check_in_date)} to {formatDate(booking.check_out_date)}</p>
                    <p className="flex items-center gap-2"><BedDouble className="h-4 w-4 text-navy" /> {booking.rooms_booked} room{booking.rooms_booked > 1 ? "s" : ""} booked</p>
                    <p className="flex items-center gap-2"><Users className="h-4 w-4 text-navy" /> {booking.guests_count} guest{booking.guests_count > 1 ? "s" : ""}</p>
                  </div>

                  <div className="mt-4 rounded-2xl border border-gold/20 bg-gold-pale/40 p-3 text-sm text-gray-700">
                    <p className="font-semibold text-navy">Booking Code: {booking.booking_code}</p>
                    <p className="mt-1">Total Price: NPR {Number(booking.total_price || 0).toLocaleString()}</p>
                    <p className="mt-1 capitalize">Payment Status: {paymentStatus || "not_paid"}</p>
                    {booking.refund_requested_amount && (
                      <p className="mt-1">Refund Requested: NPR {Number(booking.refund_requested_amount).toLocaleString()}</p>
                    )}
                  </div>

                  {isPaid && (
                    <button
                      type="button"
                      onClick={() => openInvoiceModal("homestay", booking.booking_id)}
                      disabled={invoiceLoadingKey === `homestay:${booking.booking_id}`}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl border border-navy/20 bg-navy/5 px-3.5 py-2 text-xs font-bold text-navy hover:bg-navy/10 disabled:opacity-60"
                    >
                      {invoiceLoadingKey === `homestay:${booking.booking_id}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileText className="h-3.5 w-3.5" />
                      )}
                      View Invoice
                    </button>
                  )}

                  {booking.special_requests && (
                    <p className="mt-3 text-xs text-gray-500">Special request: {booking.special_requests}</p>
                  )}

                  {hasReview && (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Your Review</p>
                      <div className="mt-2 inline-flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${star <= Number(booking.review_rating || 0) ? "text-amber-500 fill-amber-500" : "text-gray-300 fill-transparent"}`}
                          />
                        ))}
                        <span className="ml-1 text-xs font-semibold text-amber-700">
                          {Number(booking.review_rating || 0)} out of 5
                        </span>
                      </div>
                      {booking.review_comment && (
                        <p className="mt-2 text-sm text-gray-700">{booking.review_comment}</p>
                      )}
                    </div>
                  )}

                  {canReview && (
                    <div className="mt-4 rounded-2xl border border-gold/30 bg-gold-pale/50 p-3">
                      <p className="text-sm font-semibold text-charcoal">How was your stay at {booking.homestay_name}?</p>
                      <p className="text-xs text-gray-600 mt-1">Checkout completed. Share your rating so other travelers can decide confidently.</p>
                      <button
                        type="button"
                        onClick={() => openReviewModal(booking, "homestay")}
                        className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gold px-3.5 py-2 text-xs font-bold text-white hover:bg-gold-dark transition"
                      >
                        <Star className="h-3.5 w-3.5 fill-current" />
                        Leave a Review
                      </button>
                    </div>
                  )}

                  {canAttemptHomestayRefund && (
                    <>
                      <p className="mt-4 text-xs text-amber-700">
                        Refund rule applies by check-in date window (72h full, 24h-72h partial, below 24h not eligible).
                      </p>
                      {canRequestHomestayRefund ? (
                        <button
                          onClick={() => requestRefund(booking.booking_id)}
                          disabled={refundingBookingId === booking.booking_id}
                          className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-70"
                        >
                          {refundingBookingId === booking.booking_id && <Loader2 className="h-4 w-4 animate-spin" />}
                          Request Refund
                        </button>
                      ) : (
                        <p className="mt-2 text-xs text-red-700">
                          {refundIneligibilityReason || "Refund is not available once the check-in date starts."}
                        </p>
                      )}
                    </>
                  )}

                  {!isCancelled && !isRefundRequested && !isRefunded && !isPaid && (
                    <button
                      onClick={() => cancelBooking(booking.booking_id)}
                      disabled={cancellingBookingId === booking.booking_id}
                      className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-70"
                    >
                      {cancellingBookingId === booking.booking_id && <Loader2 className="h-4 w-4 animate-spin" />}
                      Cancel Booking
                    </button>
                  )}
                </article>
                  );
                })}
                  </div>
                </>
              )}

              {homestayHistoryBookings.length > 0 && (
                <div className="mt-6 pt-5 border-t border-navy/10">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-charcoal">Homestay Booking History</h3>
                    <p className="text-xs text-gray-500">{homestayHistoryBookings.length} past booking{homestayHistoryBookings.length === 1 ? "" : "s"}</p>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {homestayHistoryBookings.map((booking) => {
                      const bookingStatus = String(booking.status || "").toLowerCase();
                      const paymentStatus = String(booking.payment_status || "").toLowerCase();
                      const isCancelled = bookingStatus === "cancelled";
                      const isRefundRequested = bookingStatus === "refund_requested" || paymentStatus === "refund_requested";
                      const isRefunded = bookingStatus === "refunded" || paymentStatus === "refunded";
                      const isPaid = paymentStatus === "success" || isRefundRequested || isRefunded;
                      const hasReview = Boolean(booking.review_id);
                      const canReview =
                        (Boolean(booking.can_review) || (!hasReview && bookingStatus === "confirmed" && hasCheckoutPassed(booking.check_out_date))) &&
                        paymentStatus === "success";

                      return (
                        <article
                          key={`homestay-history-${booking.booking_id}`}
                          className="rounded-3xl border border-navy/10 bg-white p-6 shadow-[0_10px_24px_rgba(12,35,64,0.06)]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                            <h2 className="text-xl font-bold text-charcoal">{booking.homestay_name}</h2>
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
                                isRefunded
                                  ? "border-blue-200 bg-blue-50 text-blue-700"
                                  : isRefundRequested
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : isCancelled
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {(isCancelled || isRefundRequested) ? <XCircle className="h-3.5 w-3.5" /> : <BadgeCheck className="h-3.5 w-3.5" />}
                              {isRefunded ? "Refunded" : isRefundRequested ? "Refund Requested" : isCancelled ? "Cancelled" : "Confirmed"}
                            </span>
                          </div>

                          <div className="space-y-2.5 text-sm text-gray-600">
                            <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-gold" /> {booking.homestay_location}</p>
                            <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-navy" /> {formatDate(booking.check_in_date)} to {formatDate(booking.check_out_date)}</p>
                            <p className="flex items-center gap-2"><BedDouble className="h-4 w-4 text-navy" /> {booking.rooms_booked} room{booking.rooms_booked > 1 ? "s" : ""} booked</p>
                            <p className="flex items-center gap-2"><Users className="h-4 w-4 text-navy" /> {booking.guests_count} guest{booking.guests_count > 1 ? "s" : ""}</p>
                          </div>

                          <div className="mt-4 rounded-2xl border border-gold/20 bg-gold-pale/40 p-3 text-sm text-gray-700">
                            <p className="font-semibold text-navy">Booking Code: {booking.booking_code}</p>
                            <p className="mt-1">Total Price: NPR {Number(booking.total_price || 0).toLocaleString()}</p>
                            <p className="mt-1 capitalize">Payment Status: {paymentStatus || "not_paid"}</p>
                            {booking.refund_requested_amount && (
                              <p className="mt-1">Refund Requested: NPR {Number(booking.refund_requested_amount).toLocaleString()}</p>
                            )}
                          </div>

                          {isPaid && (
                            <button
                              type="button"
                              onClick={() => openInvoiceModal("homestay", booking.booking_id)}
                              disabled={invoiceLoadingKey === `homestay:${booking.booking_id}`}
                              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-navy/20 bg-navy/5 px-3.5 py-2 text-xs font-bold text-navy hover:bg-navy/10 disabled:opacity-60"
                            >
                              {invoiceLoadingKey === `homestay:${booking.booking_id}` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <FileText className="h-3.5 w-3.5" />
                              )}
                              View Invoice
                            </button>
                          )}

                          {booking.special_requests && (
                            <p className="mt-3 text-xs text-gray-500">Special request: {booking.special_requests}</p>
                          )}

                          {hasReview && (
                            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Your Review</p>
                              <div className="mt-2 inline-flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`h-4 w-4 ${star <= Number(booking.review_rating || 0) ? "text-amber-500 fill-amber-500" : "text-gray-300 fill-transparent"}`}
                                  />
                                ))}
                                <span className="ml-1 text-xs font-semibold text-amber-700">
                                  {Number(booking.review_rating || 0)} out of 5
                                </span>
                              </div>
                              {booking.review_comment && (
                                <p className="mt-2 text-sm text-gray-700">{booking.review_comment}</p>
                              )}
                            </div>
                          )}

                          {canReview && (
                            <div className="mt-4 rounded-2xl border border-gold/30 bg-gold-pale/50 p-3">
                              <p className="text-sm font-semibold text-charcoal">How was your stay at {booking.homestay_name}?</p>
                              <p className="text-xs text-gray-600 mt-1">Checkout completed. Share your rating so other travelers can decide confidently.</p>
                              <button
                                type="button"
                                onClick={() => openReviewModal(booking, "homestay")}
                                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gold px-3.5 py-2 text-xs font-bold text-white hover:bg-gold-dark transition"
                              >
                                <Star className="h-3.5 w-3.5 fill-current" />
                                Leave a Review
                              </button>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            )}

            {activeTab === "guide" && (
            <div className="rounded-3xl border border-navy/10 bg-white/95 shadow-[0_10px_30px_rgba(12,35,64,0.06)] p-6 sm:p-8 mt-8">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-blue/20">
                <div className="rounded-full bg-gradient-to-br from-blue-500 to-blue-600 p-2.5">
                  <Compass className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="uppercase text-[10px] tracking-[0.2em] text-blue-700 font-semibold">Currently Viewing</p>
                  <h2 className="text-2xl font-bold text-charcoal">Guide Package Bookings</h2>
                </div>
              </div>

              <div className="mb-6 rounded-2xl border-l-4 border-l-blue-500 border border-blue-200 bg-gradient-to-r from-blue-50 to-white px-5 py-4 text-xs sm:text-sm text-blue-900">
                <p className="font-bold text-blue-950 mb-2 flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  Refund Eligibility Guidelines
                </p>
                <div className="space-y-1 ml-2">
                  <p><span className="font-semibold">72+ hours before trek start:</span> 100% full refund</p>
                  <p><span className="font-semibold">24-72 hours before trek start:</span> 50% partial refund</p>
                  <p><span className="font-semibold">Under 24 hours:</span> Not eligible for tourist-initiated refund</p>
                </div>
              </div>

              {currentGuideBookings.length === 0 ? (
                <div className="rounded-2xl border border-navy/10 bg-gradient-to-br from-gray-50 to-white p-6 text-center text-sm text-gray-600">
                  <Compass className="h-8 w-8 mx-auto text-blue-400/40 mb-2" />
                  <p>No current or upcoming guide package bookings.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {currentGuideBookings.map((booking) => {
                    const bookingStatus = String(booking.status || "").toLowerCase();
                    const paymentStatus = String(booking.payment_status || "").toLowerCase();
                    const refundStatus = String(booking.refund_status || "").toLowerCase();
                    const hasGuideReview = Boolean(booking.review_id);
                    const canGuideReview =
                      (Boolean(booking.can_review) || (!hasGuideReview && bookingStatus === "confirmed" && hasCheckoutPassed(booking.end_date))) &&
                      paymentStatus === "success";
                    const isPending = bookingStatus === "pending";
                    const isConfirmed = bookingStatus === "confirmed";
                    const isRejected = bookingStatus === "rejected";
                    const isExpired = bookingStatus === "expired";
                    const isCancelled = bookingStatus === "cancelled";
                    const isRefundRequested = bookingStatus === "refund_requested" || paymentStatus === "refund_requested";
                    const isRefunded = bookingStatus === "refunded" || paymentStatus === "refunded";
                    const isRefundProcessing = refundStatus === "processing";
                    const isRefundRejected = refundStatus === "rejected";
                    const serviceDateStarted = hasServiceDateStarted(booking.start_date);
                    const backendRefundEligible = typeof booking.refund_eligible === "boolean" ? booking.refund_eligible : null;
                    const refundIneligibilityReason = String(booking.refund_reason || "").trim();
                    const canAttemptGuideRefund =
                      !isCancelled &&
                      !isRejected &&
                      !isExpired &&
                      !isRefundRequested &&
                      !isRefundProcessing &&
                      !isRefunded &&
                      isConfirmed &&
                      paymentStatus === "success";
                    const canRequestGuideRefund =
                      canAttemptGuideRefund && (backendRefundEligible ?? !serviceDateStarted);
                    const canUseChat = ["success", "refund_requested", "refunded"].includes(paymentStatus) && !["rejected", "expired"].includes(bookingStatus);

                    const statusClass = isRefunded
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : isRefundProcessing
                      ? "border-cyan-200 bg-cyan-50 text-cyan-700"
                      : isRefundRequested
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : isRejected || isCancelled || isExpired
                      ? "border-red-200 bg-red-50 text-red-700"
                      : isPending
                      ? "border-violet-200 bg-violet-50 text-violet-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700";

                    const statusLabel = isRefunded
                      ? "Refunded"
                      : isRefundProcessing
                      ? "Refund Processing"
                      : isRefundRequested
                      ? "Refund Requested"
                      : isRejected
                      ? "Rejected By Guide"
                      : isExpired
                      ? "Expired (No Approval)"
                      : isCancelled
                      ? "Cancelled By Guide"
                      : isPending
                      ? "Pending Guide Confirmation"
                      : "Confirmed";

                    return (
                      <article
                        key={booking.booking_id}
                        className="rounded-3xl border border-navy/10 bg-white p-6 shadow-[0_10px_24px_rgba(12,35,64,0.06)]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                          <h2 className="text-xl font-bold text-charcoal">{booking.service_title}</h2>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${statusClass}`}
                          >
                            {(isCancelled || isRejected || isExpired || isRefundRequested || isRefundProcessing) ? <XCircle className="h-3.5 w-3.5" /> : <BadgeCheck className="h-3.5 w-3.5" />}
                            {statusLabel}
                          </span>
                        </div>

                        <div className="space-y-2.5 text-sm text-gray-600">
                          <p className="flex items-center gap-2"><Package className="h-4 w-4 text-gold" /> Guide: {booking.guide_name}</p>
                          <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-gold" /> {booking.trail_name}</p>
                          <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-navy" /> {formatDate(booking.start_date)} to {formatDate(booking.end_date)}</p>
                          <p className="flex items-center gap-2"><Users className="h-4 w-4 text-navy" /> {booking.participants_count} participant{booking.participants_count > 1 ? "s" : ""}</p>
                        </div>

                        <div className="mt-4 rounded-2xl border border-gold/20 bg-gold-pale/40 p-3 text-sm text-gray-700">
                          <p className="font-semibold text-navy">Booking Code: {booking.booking_code}</p>
                          <p className="mt-1">Total Price: NPR {Number(booking.total_price || 0).toLocaleString()}</p>
                          <p className="mt-1 capitalize">Payment Status: {paymentStatus || "not_paid"}</p>
                          {refundStatus && <p className="mt-1 capitalize">Refund Status: {refundStatus}</p>}
                          {booking.refund_requested_amount && (
                            <p className="mt-1">Refund Requested: NPR {Number(booking.refund_requested_amount).toLocaleString()}</p>
                          )}
                          {booking.refund_reference && (
                            <p className="mt-1">Refund Ref: {booking.refund_reference}</p>
                          )}
                          {isRefundRejected && (
                            <p className="mt-1 text-red-700">Refund request was rejected by admin review.</p>
                          )}
                        </div>

                        {(paymentStatus === "success" || paymentStatus === "refund_requested" || paymentStatus === "refunded") && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openInvoiceModal("guide_package", booking.booking_id)}
                              disabled={invoiceLoadingKey === `guide_package:${booking.booking_id}`}
                              className="inline-flex items-center gap-2 rounded-xl border border-navy/20 bg-navy/5 px-3.5 py-2 text-xs font-bold text-navy hover:bg-navy/10 disabled:opacity-60"
                            >
                              {invoiceLoadingKey === `guide_package:${booking.booking_id}` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <FileText className="h-3.5 w-3.5" />
                              )}
                              View Invoice
                            </button>

                            {canUseChat && (
                              <button
                                type="button"
                                onClick={() => openGuideBookingChat(booking)}
                                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                Chat With Guide
                              </button>
                            )}
                          </div>
                        )}

                        {booking.special_requests && (
                          <p className="mt-3 text-xs text-gray-500">Special request: {booking.special_requests}</p>
                        )}

                        {hasGuideReview && (
                          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Your Guide Review</p>
                            <div className="mt-2 inline-flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-4 w-4 ${star <= Number(booking.review_rating || 0) ? "text-amber-500 fill-amber-500" : "text-gray-300 fill-transparent"}`}
                                />
                              ))}
                              <span className="ml-1 text-xs font-semibold text-blue-700">
                                {Number(booking.review_rating || 0)} out of 5
                              </span>
                            </div>
                            {booking.review_comment && (
                              <p className="mt-2 text-sm text-gray-700">{booking.review_comment}</p>
                            )}
                          </div>
                        )}

                        {canGuideReview && (
                          <div className="mt-4 rounded-2xl border border-blue-300 bg-blue-50/60 p-3">
                            <p className="text-sm font-semibold text-charcoal">How was your trek with {booking.guide_name}?</p>
                            <p className="text-xs text-gray-600 mt-1">Trek completed. Share your rating to help other travelers choose confidently.</p>
                            <button
                              type="button"
                              onClick={() => openReviewModal(booking, "guide")}
                              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
                            >
                              <Star className="h-3.5 w-3.5 fill-current" />
                              Leave a Review
                            </button>
                          </div>
                        )}

                        {canAttemptGuideRefund && (
                          <>
                            <p className="mt-4 text-xs text-amber-700">
                              Tourist refund rule applies by trek start date window (72h full, 24h-72h partial, below 24h not eligible).
                            </p>
                            {canRequestGuideRefund ? (
                              <button
                                onClick={() => requestGuideRefund(booking.booking_id)}
                                disabled={refundingGuideBookingId === booking.booking_id}
                                className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-70"
                              >
                                {refundingGuideBookingId === booking.booking_id && <Loader2 className="h-4 w-4 animate-spin" />}
                                Request Refund
                              </button>
                            ) : (
                              <p className="mt-2 text-xs text-red-700">
                                {refundIneligibilityReason || "Refund is not available once the trek start date begins."}
                              </p>
                            )}
                          </>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}

              {guideHistoryBookings.length > 0 && (
                <div className="mt-6 pt-5 border-t border-navy/10">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-charcoal">Guide Booking History</h3>
                    <p className="text-xs text-gray-500">{guideHistoryBookings.length} past booking{guideHistoryBookings.length === 1 ? "" : "s"}</p>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {guideHistoryBookings.map((booking) => {
                      const bookingStatus = String(booking.status || "").toLowerCase();
                      const paymentStatus = String(booking.payment_status || "").toLowerCase();
                      const refundStatus = String(booking.refund_status || "").toLowerCase();
                      const hasGuideReview = Boolean(booking.review_id);
                      const canGuideReview =
                        (Boolean(booking.can_review) || (!hasGuideReview && bookingStatus === "confirmed" && hasCheckoutPassed(booking.end_date))) &&
                        paymentStatus === "success";
                      const isPending = bookingStatus === "pending";
                      const isRejected = bookingStatus === "rejected";
                      const isExpired = bookingStatus === "expired";
                      const isCancelled = bookingStatus === "cancelled";
                      const isRefundRequested = bookingStatus === "refund_requested" || paymentStatus === "refund_requested";
                      const isRefunded = bookingStatus === "refunded" || paymentStatus === "refunded";
                      const isRefundProcessing = refundStatus === "processing";
                      const isRefundRejected = refundStatus === "rejected";
                      const canUseChat = ["success", "refund_requested", "refunded"].includes(paymentStatus) && !["rejected", "expired"].includes(bookingStatus);

                      const statusClass = isRefunded
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : isRefundProcessing
                        ? "border-cyan-200 bg-cyan-50 text-cyan-700"
                        : isRefundRequested
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : isRejected || isCancelled || isExpired
                        ? "border-red-200 bg-red-50 text-red-700"
                        : isPending
                        ? "border-violet-200 bg-violet-50 text-violet-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700";

                      const statusLabel = isRefunded
                        ? "Refunded"
                        : isRefundProcessing
                        ? "Refund Processing"
                        : isRefundRequested
                        ? "Refund Requested"
                        : isRejected
                        ? "Rejected By Guide"
                        : isExpired
                        ? "Expired (No Approval)"
                        : isCancelled
                        ? "Cancelled By Guide"
                        : isPending
                        ? "Pending Guide Confirmation"
                        : "Confirmed";

                      return (
                        <article
                          key={`guide-history-${booking.booking_id}`}
                          className="rounded-3xl border border-navy/10 bg-white p-6 shadow-[0_10px_24px_rgba(12,35,64,0.06)]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                            <h2 className="text-xl font-bold text-charcoal">{booking.service_title}</h2>
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${statusClass}`}
                            >
                              {(isCancelled || isRejected || isExpired || isRefundRequested || isRefundProcessing) ? <XCircle className="h-3.5 w-3.5" /> : <BadgeCheck className="h-3.5 w-3.5" />}
                              {statusLabel}
                            </span>
                          </div>

                          <div className="space-y-2.5 text-sm text-gray-600">
                            <p className="flex items-center gap-2"><Package className="h-4 w-4 text-gold" /> Guide: {booking.guide_name}</p>
                            <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-gold" /> {booking.trail_name}</p>
                            <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-navy" /> {formatDate(booking.start_date)} to {formatDate(booking.end_date)}</p>
                            <p className="flex items-center gap-2"><Users className="h-4 w-4 text-navy" /> {booking.participants_count} participant{booking.participants_count > 1 ? "s" : ""}</p>
                          </div>

                          <div className="mt-4 rounded-2xl border border-gold/20 bg-gold-pale/40 p-3 text-sm text-gray-700">
                            <p className="font-semibold text-navy">Booking Code: {booking.booking_code}</p>
                            <p className="mt-1">Total Price: NPR {Number(booking.total_price || 0).toLocaleString()}</p>
                            <p className="mt-1 capitalize">Payment Status: {paymentStatus || "not_paid"}</p>
                            {refundStatus && <p className="mt-1 capitalize">Refund Status: {refundStatus}</p>}
                            {booking.refund_requested_amount && (
                              <p className="mt-1">Refund Requested: NPR {Number(booking.refund_requested_amount).toLocaleString()}</p>
                            )}
                            {booking.refund_reference && (
                              <p className="mt-1">Refund Ref: {booking.refund_reference}</p>
                            )}
                            {isRefundRejected && (
                              <p className="mt-1 text-red-700">Refund request was rejected by admin review.</p>
                            )}
                          </div>

                          {(paymentStatus === "success" || paymentStatus === "refund_requested" || paymentStatus === "refunded") && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => openInvoiceModal("guide_package", booking.booking_id)}
                                disabled={invoiceLoadingKey === `guide_package:${booking.booking_id}`}
                                className="inline-flex items-center gap-2 rounded-xl border border-navy/20 bg-navy/5 px-3.5 py-2 text-xs font-bold text-navy hover:bg-navy/10 disabled:opacity-60"
                              >
                                {invoiceLoadingKey === `guide_package:${booking.booking_id}` ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <FileText className="h-3.5 w-3.5" />
                                )}
                                View Invoice
                              </button>

                              {canUseChat && (
                                <button
                                  type="button"
                                  onClick={() => openGuideBookingChat(booking)}
                                  className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                  Chat With Guide
                                </button>
                              )}
                            </div>
                          )}

                          {booking.special_requests && (
                            <p className="mt-3 text-xs text-gray-500">Special request: {booking.special_requests}</p>
                          )}

                          {hasGuideReview && (
                            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Your Guide Review</p>
                              <div className="mt-2 inline-flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`h-4 w-4 ${star <= Number(booking.review_rating || 0) ? "text-amber-500 fill-amber-500" : "text-gray-300 fill-transparent"}`}
                                  />
                                ))}
                                <span className="ml-1 text-xs font-semibold text-blue-700">
                                  {Number(booking.review_rating || 0)} out of 5
                                </span>
                              </div>
                              {booking.review_comment && (
                                <p className="mt-2 text-sm text-gray-700">{booking.review_comment}</p>
                              )}
                            </div>
                          )}

                          {canGuideReview && (
                            <div className="mt-4 rounded-2xl border border-blue-300 bg-blue-50/60 p-3">
                              <p className="text-sm font-semibold text-charcoal">How was your trek with {booking.guide_name}?</p>
                              <p className="text-xs text-gray-600 mt-1">Trek completed. Share your rating to help other travelers choose confidently.</p>
                              <button
                                type="button"
                                onClick={() => openReviewModal(booking, "guide")}
                                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
                              >
                                <Star className="h-3.5 w-3.5 fill-current" />
                                Leave a Review
                              </button>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            )}
          </section>
        )}
      </main>

      {invoiceModalOpen && invoiceData && (
        <div className="fixed inset-0 z-[118] bg-black/45 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-3xl rounded-3xl overflow-hidden border border-navy/20 bg-white shadow-[0_24px_60px_rgba(12,35,64,0.25)]">
            <div className="bg-gradient-to-r from-[#0C2340] via-[#163A5F] to-[#0C2340] px-6 py-5 text-white">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-full overflow-hidden border border-gold/40 bg-white/90 p-1">
                    <img
                      src={invoiceData.issuer?.logo_path || "/offtrail-latest.png"}
                      alt="OffTrail Nepal"
                      className="h-full w-full rounded-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-gold/90 font-semibold">Official Invoice</p>
                    <h3 className="text-2xl font-heading font-bold leading-tight">{invoiceData.issuer?.name || "OffTrail Nepal"}</h3>
                    <p className="text-sm text-white/70">{invoiceData.issuer?.location || "Pokhara, Nepal"}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/70">Invoice Number</p>
                  <p className="text-lg font-semibold text-gold/95">{invoiceData.invoice_number}</p>
                  <p className="text-xs text-white/70 mt-1">Issued on {formatInvoiceDate(invoiceData.issued_at)}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Billed To</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{invoiceData.snapshot?.billing_name || "-"}</p>
                  <p className="text-sm text-slate-600 mt-1">{invoiceData.snapshot?.billing_email || "-"}</p>
                  <p className="text-sm text-slate-600">{invoiceData.snapshot?.billing_phone || "-"}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Booking Summary</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{invoiceData.snapshot?.listing_name || "-"}</p>
                  <p className="text-sm text-slate-600 mt-1">{invoiceData.snapshot?.listing_location || "-"}</p>
                  <p className="text-xs text-slate-500 mt-2">Booking Code: {invoiceData.snapshot?.booking_code || "-"}</p>
                  <p className="text-xs text-slate-500 mt-1 capitalize">Booking Type: {invoiceData.booking_type === "guide_package" ? "Guide Package" : "Homestay"}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-2 bg-slate-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                  <p>Description</p>
                  <p className="text-right">Amount</p>
                </div>
                <div className="space-y-0">
                  <div className="grid grid-cols-2 px-4 py-3 text-sm border-t border-slate-100">
                    <p className="text-slate-700">
                      {invoiceData.booking_type === "guide_package"
                        ? `${invoiceData.snapshot?.listing_name || "Guide package"} (${invoiceData.snapshot?.participants_count || 0} participants)`
                        : `${invoiceData.snapshot?.listing_name || "Homestay stay"} (${invoiceData.snapshot?.rooms_booked || 0} rooms)`}
                    </p>
                    <p className="text-right font-semibold text-slate-800">{formatMoney(invoiceData.subtotal_amount)}</p>
                  </div>
                  <div className="grid grid-cols-2 px-4 py-3 text-sm border-t border-slate-100">
                    <p className="text-slate-700">Tax</p>
                    <p className="text-right text-slate-700">{formatMoney(invoiceData.tax_amount)}</p>
                  </div>
                  <div className="grid grid-cols-2 px-4 py-3 text-sm border-t border-slate-100">
                    <p className="text-slate-700">Service Charge</p>
                    <p className="text-right text-slate-700">{formatMoney(invoiceData.service_charge)}</p>
                  </div>
                  <div className="grid grid-cols-2 px-4 py-3 text-base border-t border-slate-200 bg-slate-50/60">
                    <p className="font-bold text-slate-900">Total Paid</p>
                    <p className="text-right font-bold text-slate-900">{formatMoney(invoiceData.total_amount)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-800">
                <p className="font-semibold">Payment Method: {String(invoiceData.payment_method || "unknown").toUpperCase()}</p>
                <p className="mt-1">Payment Status: <span className="font-semibold uppercase">{invoiceData.payment_status || "unknown"}</span></p>
                <p className="mt-1">Transaction Reference: <span className="font-semibold">{invoiceData.payment_reference || "-"}</span></p>
              </div>
            </div>

            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50/70 flex flex-wrap items-center justify-end gap-2">
              <Link
                to={`/invoice/${invoiceData.booking_type}/${invoiceData.booking_id}`}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                <ExternalLink className="h-4 w-4" />
                Open Full Page
              </Link>
              <button
                type="button"
                onClick={closeInvoiceModal}
                disabled={invoiceDownloading}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                Close
              </button>
              <button
                type="button"
                onClick={downloadInvoicePdf}
                disabled={invoiceDownloading}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-[#D4A43A] px-4 py-2 text-sm font-bold text-navy disabled:opacity-60"
              >
                {invoiceDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewModalOpen && (
        <div className="fixed inset-0 z-[120] bg-black/45 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-xl rounded-3xl border border-gold/20 bg-white p-6 shadow-[0_24px_60px_rgba(12,35,64,0.25)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-gold-dark font-semibold">{reviewDraft.reviewType === "guide" ? "Guide Review" : "Homestay Review"}</p>
                <h3 className="text-xl font-bold text-charcoal mt-1">{reviewDraft.reviewType === "guide" ? "Rate your guide experience" : "Rate your stay"}</h3>
                <p className="text-sm text-gray-600 mt-1">{reviewDraft.listingName}</p>
              </div>
              <button
                type="button"
                onClick={closeReviewModal}
                disabled={submittingReview}
                className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
              >
                Close
              </button>
            </div>

            <div className="mt-5">
              <p className="text-sm font-semibold text-charcoal mb-2">Select rating</p>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = star <= (hoverRating || reviewDraft.rating);
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setReviewDraft((prev) => ({ ...prev, rating: star }))}
                      className="rounded-lg p-1 transition-transform hover:scale-110"
                      aria-label={`Rate ${star} out of 5`}
                    >
                      <Star className={`h-9 w-9 ${active ? "text-amber-500 fill-amber-500" : "text-gray-300 fill-transparent"}`} />
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-sm font-semibold text-amber-700">
                {(hoverRating || reviewDraft.rating || 0)} out of 5
              </p>
            </div>

            <div className="mt-4">
              <label className="text-sm font-semibold text-charcoal">Write a review</label>
              <textarea
                value={reviewDraft.comment}
                onChange={(e) => setReviewDraft((prev) => ({ ...prev, comment: e.target.value }))}
                rows={4}
                maxLength={1500}
                placeholder={reviewDraft.reviewType === "guide"
                  ? "Tell others about safety, pacing, communication, route knowledge, and overall guide support..."
                  : "Tell others about cleanliness, host support, food, comfort, and location..."}
                className="mt-1.5 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gold/40"
              />
              <p className="mt-1 text-[11px] text-gray-400 text-right">{String(reviewDraft.comment || "").length}/1500</p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeReviewModal}
                disabled={submittingReview}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitBookingReview}
                disabled={submittingReview || !reviewDraft.rating}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-[#D4A43A] px-4 py-2 text-sm font-bold text-navy disabled:opacity-60"
              >
                {submittingReview && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit Review
              </button>
            </div>
          </div>
        </div>
      )}

      <GuideBookingChatModal
        isOpen={chatModalOpen}
        onClose={closeGuideBookingChat}
        booking={activeChatBooking}
        currentRole="tourist"
      />

      <Footer />
      <LogoutModal isOpen={showLogoutModal} onConfirm={handleLogout} onCancel={handleStayLoggedIn} />
    </div>
  );
};

export default MyBookings;
