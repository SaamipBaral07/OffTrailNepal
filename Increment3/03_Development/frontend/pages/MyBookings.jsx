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
} from "lucide-react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import LogoutModal from "../components/LogoutModal";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import { useAuth } from "../context/AuthContext";
import { getToken } from "../tokenStore";
import api from "../api";

const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const MyBookings = () => {
  const navigate = useNavigate();
  const { user: authUser, loading } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [notification, setNotification] = useState(null);
  const [cancellingBookingId, setCancellingBookingId] = useState(null);
  const [refundingBookingId, setRefundingBookingId] = useState(null);
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

  const activeBookings = useMemo(
    () => bookings.filter((booking) => booking.status === "confirmed"),
    [bookings]
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
              <p className="uppercase text-[11px] tracking-[0.24em] text-gold-dark font-semibold mb-2">Tourist Dashboard</p>
              <h1 className="text-3xl sm:text-4xl font-heading text-charcoal">My Homestay Bookings</h1>
              <p className="text-gray-500 mt-2">Track your reservations and booking status in one place.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-emerald-700 text-sm font-semibold">
              <BadgeCheck className="h-4 w-4" />
              {activeBookings.length} active booking{activeBookings.length === 1 ? "" : "s"}
            </div>
          </div>
        </section>

        {bookings.length === 0 ? (
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
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {bookings.map((booking) => {
              const bookingStatus = String(booking.status || "").toLowerCase();
              const paymentStatus = String(booking.payment_status || "").toLowerCase();
              const isCancelled = bookingStatus === "cancelled";
              const isRefundRequested = bookingStatus === "refund_requested" || paymentStatus === "refund_requested";
              const isRefunded = bookingStatus === "refunded" || paymentStatus === "refunded";
              const isPaid = paymentStatus === "success" || isRefundRequested || isRefunded;
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

                  {booking.special_requests && (
                    <p className="mt-3 text-xs text-gray-500">Special request: {booking.special_requests}</p>
                  )}

                  {!isCancelled && !isRefundRequested && !isRefunded && isPaid && (
                    <button
                      onClick={() => requestRefund(booking.booking_id)}
                      disabled={refundingBookingId === booking.booking_id}
                      className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-70"
                    >
                      {refundingBookingId === booking.booking_id && <Loader2 className="h-4 w-4 animate-spin" />}
                      Request Refund
                    </button>
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
          </section>
        )}
      </main>

      <Footer />
      <LogoutModal isOpen={showLogoutModal} onConfirm={handleLogout} onCancel={handleStayLoggedIn} />
    </div>
  );
};

export default MyBookings;
