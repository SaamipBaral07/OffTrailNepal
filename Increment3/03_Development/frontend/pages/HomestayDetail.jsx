import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft,
  Home,
  Mountain,
  MapPin,
  Users,
  BedDouble,
  ExternalLink,
  Wifi,
  ShowerHead,
  UtensilsCrossed,
  Car,
  Coffee,
  Tv,
  Snowflake,
  Star,
  ChevronRight,
  CalendarDays,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import { setCsrfToken } from "../tokenStore";
import LogoutModal from "../components/LogoutModal";
import api from "../api";

const API = "http://localhost:5000";
const MOTION_CURVE = [0.22, 1, 0.36, 1];
const MOTION_DURATION = 0.32;
const MOTION_STAGGER = 0.07;

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: MOTION_STAGGER,
      delayChildren: MOTION_STAGGER,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION_DURATION,
      ease: MOTION_CURVE,
    },
  },
};

const getAmenityMeta = (rawAmenity) => {
  const amenity = String(rawAmenity || "").trim();
  const key = amenity.toLowerCase();

  if (key.includes("wifi") || key.includes("wi-fi") || key.includes("internet")) {
    return { icon: Wifi, label: amenity || "WiFi", tone: "bg-sky-50 text-sky-700 border-sky-200" };
  }
  if (key.includes("shower") || key.includes("bath")) {
    return { icon: ShowerHead, label: amenity || "Hot Shower", tone: "bg-cyan-50 text-cyan-700 border-cyan-200" };
  }
  if (key.includes("solar") && (key.includes("water") || key.includes("hot"))) {
    return { icon: Coffee, label: amenity || "Solar Hot Water", tone: "bg-amber-50 text-amber-700 border-amber-200" };
  }
  if (key.includes("breakfast") || key.includes("dinner") || key.includes("meal") || key.includes("food")) {
    return { icon: UtensilsCrossed, label: amenity || "Local Meals", tone: "bg-orange-50 text-orange-700 border-orange-200" };
  }
  if (key.includes("parking") || key.includes("car")) {
    return { icon: Car, label: amenity || "Parking", tone: "bg-indigo-50 text-indigo-700 border-indigo-200" };
  }
  if (key.includes("coffee") || key.includes("tea")) {
    return { icon: Coffee, label: amenity || "Tea/Coffee", tone: "bg-rose-50 text-rose-700 border-rose-200" };
  }
  if (key.includes("tv") || key.includes("television")) {
    return { icon: Tv, label: amenity || "TV", tone: "bg-violet-50 text-violet-700 border-violet-200" };
  }
  if (key.includes("heater") || key.includes("heating") || key.includes("warm")) {
    return { icon: Snowflake, label: amenity || "Heating", tone: "bg-red-50 text-red-700 border-red-200" };
  }
  if (key.includes("mountain view") || key.includes("view") || key.includes("panorama")) {
    return { icon: Mountain, label: amenity || "Mountain View", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
  if (key.includes("attached") && key.includes("bath")) {
    return { icon: ShowerHead, label: amenity || "Attached Bathroom", tone: "bg-teal-50 text-teal-700 border-teal-200" };
  }
  if (key.includes("charging") || key.includes("charge") || key.includes("socket") || key.includes("plug")) {
    return { icon: Tv, label: amenity || "Charging Point", tone: "bg-lime-50 text-lime-700 border-lime-200" };
  }

  return { icon: Star, label: amenity || "Amenity", tone: "bg-stone-100 text-stone-700 border-stone-200" };
};

const extractGoogleMapSrc = (rawValue) => {
  const value = String(rawValue || "").trim();
  if (!value) return null;

  const iframeSrcMatch = value.match(/src\s*=\s*['"]([^'"]+)['"]/i);
  const candidate = iframeSrcMatch?.[1] || value;

  try {
    const parsedUrl = new URL(candidate);
    const host = parsedUrl.hostname.toLowerCase();
    const isGoogleMapsHost = host.includes("google.com") || host.includes("goo.gl") || host.includes("googleusercontent.com");
    return isGoogleMapsHost ? parsedUrl.toString() : null;
  } catch {
    return null;
  }
};

const HomestayBookingModal = ({
  isOpen,
  onClose,
  onSubmit,
  bookingForm,
  handleBookingField,
  bookingFeedback,
  bookingSubmitting,
  paymentVerifying,
  paymentMethod,
  setPaymentMethod,
  isSoldOut,
  availableRooms,
  todayIso,
  user,
}) => {
  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const nonTouristUser = user && user.user_type !== "tourist";
  const disableSubmit = isSoldOut || bookingSubmitting || paymentVerifying || nonTouristUser;
  const paymentOptions = [
    {
      key: "esewa",
      label: "eSewa",
      description: "Pay in NPR",
      logo: "/images/esewa.png",
    },
    {
      key: "stripe",
      label: "Stripe",
      description: "Card payment (USD)",
      logo: "/images/stripe.png",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[90] bg-gradient-to-b from-black/55 via-black/50 to-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
      onClick={() => {
        if (bookingSubmitting || paymentVerifying) return;
        onClose();
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] rounded-3xl border border-white/15 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.4)] overflow-hidden flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-gold/20 bg-gradient-to-r from-navy via-navy-light to-navy-light/80">
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-white">Book This Homestay</h3>
            <p className="text-xs sm:text-sm text-gold/90 mt-1">
              Your room is confirmed only after successful payment.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={bookingSubmitting || paymentVerifying}
            className="p-2 hover:bg-white/20 rounded-xl transition disabled:opacity-60"
          >
            <span className="text-lg text-white">×</span>
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Payment Method</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {paymentOptions.map((option) => {
                  const isActive = paymentMethod === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setPaymentMethod(option.key)}
                      className={`rounded-2xl border px-3 py-3 text-left transition-all ${isActive ? "border-gold bg-gradient-to-r from-gold-pale to-amber-50 shadow-sm" : "border-stone-200 bg-white hover:border-gold/40 hover:bg-stone-50"}`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={option.logo}
                          alt={`${option.label} logo`}
                          className="h-8 w-14 object-contain"
                        />
                        <div>
                          <p className={`text-sm font-bold ${isActive ? "text-gold-dark" : "text-gray-700"}`}>{option.label}</p>
                          <p className="text-xs text-gray-500">{option.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-gray-600">
                Check-in Date
                <input
                  type="date"
                  min={todayIso}
                  value={bookingForm.check_in_date}
                  onChange={(e) => handleBookingField("check_in_date", e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gold/40"
                />
              </label>

              <label className="text-xs font-semibold text-gray-600">
                Check-out Date
                <input
                  type="date"
                  min={bookingForm.check_in_date || todayIso}
                  value={bookingForm.check_out_date}
                  onChange={(e) => handleBookingField("check_out_date", e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gold/40"
                />
              </label>

              <label className="text-xs font-semibold text-gray-600">
                Rooms Needed
                <input
                  type="number"
                  min="1"
                  max={Math.max(1, availableRooms)}
                  value={bookingForm.rooms_booked}
                  onChange={(e) => handleBookingField("rooms_booked", e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gold/40"
                />
              </label>

              <label className="text-xs font-semibold text-gray-600">
                Guests Count
                <input
                  type="number"
                  min="1"
                  value={bookingForm.guests_count}
                  onChange={(e) => handleBookingField("guests_count", e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gold/40"
                />
              </label>
            </div>

            <label className="block text-xs font-semibold text-gray-600">
              Contact Phone
              <input
                type="text"
                value={bookingForm.contact_phone}
                onChange={(e) => handleBookingField("contact_phone", e.target.value)}
                placeholder="Optional phone for host confirmation"
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gold/40"
              />
            </label>

            <label className="block text-xs font-semibold text-gray-600">
              Special Request
              <div className="relative mt-1">
                <MessageSquare className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-300" />
                <textarea
                  value={bookingForm.special_requests}
                  onChange={(e) => handleBookingField("special_requests", e.target.value)}
                  rows={3}
                  placeholder="Arrival notes, food preference, etc."
                  className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gold/40"
                />
              </div>
            </label>

            {bookingFeedback && (
              <p className={`text-sm font-medium ${bookingFeedback.type === "success" ? "text-emerald-700" : "text-red-600"}`}>
                {bookingFeedback.message}
              </p>
            )}

            {!user && (
              <p className="text-xs text-gray-500">
                Login is required. We will redirect you to sign in when you proceed.
              </p>
            )}

            {nonTouristUser && (
              <p className="text-xs text-red-600">
                Only tourist accounts can book homestay rooms.
              </p>
            )}
          </div>

          <div className="border-t border-stone-200 px-5 sm:px-6 py-4 bg-white/90">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={bookingSubmitting || paymentVerifying}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={disableSubmit}
                className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${isSoldOut ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-gradient-to-r from-gold to-[#D4A43A] text-navy shadow-md hover:shadow-lg hover:-translate-y-0.5"}`}
              >
                {(bookingSubmitting || paymentVerifying) && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSoldOut
                  ? "Fully Booked"
                  : bookingSubmitting
                    ? `Redirecting to ${paymentMethod === "stripe" ? "Stripe" : "eSewa"}...`
                    : paymentVerifying
                      ? "Verifying Payment..."
                      : `Pay with ${paymentMethod === "stripe" ? "Stripe" : "eSewa"} & Book`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

const HomestayDetail = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    handleLogout,
    handleStayLoggedIn,
    showLogoutModal,
    setShowLogoutModal,
  } = useLogoutHandler();
  const [homestay, setHomestay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [bookingForm, setBookingForm] = useState({
    check_in_date: "",
    check_out_date: "",
    rooms_booked: 1,
    guests_count: 1,
    contact_phone: "",
    special_requests: "",
  });
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [paymentVerifying, setPaymentVerifying] = useState(false);
  const [bookingFeedback, setBookingFeedback] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("esewa");
  const [showBookingModal, setShowBookingModal] = useState(false);
  const lastProcessedSessionRef = useRef(null);

  const loadHomestay = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/homestays/public/${id}`);
      setHomestay(res.data.homestay);
    } catch (err) {
      console.error(err);
      setHomestay(null);
    }
  }, [id]);

  useEffect(() => {
    const fetchHomestay = async () => {
      try {
        await loadHomestay();
      } catch (err) {
        console.error(err);
        setHomestay(null);
      } finally {
        setLoading(false);
      }
    };

    fetchHomestay();
  }, [loadHomestay]);

  const handleBookingField = (field, value) => {
    setBookingFeedback(null);
    setBookingForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleBookHomestay = async (event) => {
    event.preventDefault();
    setBookingFeedback(null);

    if (!user) {
      navigate("/login", { replace: false });
      return;
    }

    if (user.user_type !== "tourist") {
      setBookingFeedback({
        type: "error",
        message: "Only tourist accounts can book homestay rooms.",
      });
      return;
    }

    const payload = {
      homestay_id: homestay.homestay_id,
      check_in_date: bookingForm.check_in_date,
      check_out_date: bookingForm.check_out_date,
      rooms_booked: Number(bookingForm.rooms_booked),
      guests_count: Number(bookingForm.guests_count),
      contact_phone: bookingForm.contact_phone.trim(),
      special_requests: bookingForm.special_requests.trim(),
    };

    setBookingSubmitting(true);
    try {
      if (paymentMethod === "stripe") {
        let stripeRes;
        try {
          stripeRes = await api.post("/api/bookings/payment/stripe/initiate", payload);
        } catch (initialStripeErr) {
          if (initialStripeErr?.response?.status === 404) {
            try {
              stripeRes = await api.post("/api/bookings/stripe/initiate", payload);
            } catch {
              stripeRes = await api.post("/api/bookings/payment/stripe-initiate", payload);
            }
          } else {
            throw initialStripeErr;
          }
        }
        const checkoutUrl = stripeRes.data?.checkout_url;

        if (!checkoutUrl) {
          throw new Error("Invalid Stripe payment response from server");
        }

        setBookingFeedback({
          type: "success",
          message: "Redirecting to Stripe secure checkout...",
        });

        window.location.href = checkoutUrl;
      } else {
        const res = await api.post("/api/bookings/payment/initiate", payload);
        const paymentForm = res.data?.payment_form;

        if (!paymentForm?.action || !paymentForm?.fields) {
          throw new Error("Invalid payment response from server");
        }

        setBookingFeedback({
          type: "success",
          message: "Redirecting to eSewa secure payment...",
        });

        const form = document.createElement("form");
        form.method = (paymentForm.method || "POST").toUpperCase();
        form.action = paymentForm.action;
        form.style.display = "none";

        Object.entries(paymentForm.fields).forEach(([key, value]) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = key;
          input.value = String(value ?? "");
          form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
      }
    } catch (err) {
      setBookingFeedback({
        type: "error",
        message: err.response?.data?.message || "Failed to initiate payment. Please try again.",
      });
    } finally {
      setBookingSubmitting(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const paymentStatus = params.get("payment");
    const sessionToken = params.get("session_token");
    const failureReason = params.get("reason");

    if (!paymentStatus || !sessionToken) return;
    if (lastProcessedSessionRef.current === sessionToken) return;

    lastProcessedSessionRef.current = sessionToken;

    const verifyPayment = async () => {
      if (paymentStatus !== "success") {
        setBookingFeedback({
          type: "error",
          message: failureReason
            ? `Payment was not completed (${failureReason}). Please try again.`
            : "Payment was not completed. Please try again.",
        });
        navigate(location.pathname, { replace: true });
        return;
      }

      setPaymentVerifying(true);
      try {
        const statusRes = await api.get(`/api/bookings/payment/session/${sessionToken}`);
        const payment = statusRes.data?.payment;

        if (payment?.payment_status === "success" && payment?.booking_code) {
          setBookingFeedback({
            type: "success",
            message: `Payment successful and booking confirmed. Booking code: ${payment.booking_code}`,
          });
        } else if (payment?.payment_status === "failed" || payment?.payment_status === "expired") {
          throw new Error("Payment was not successful");
        } else {
          const csrfRes = await api.get("/api/auth/csrf-token");
          if (csrfRes?.data?.csrfToken) {
            setCsrfToken(csrfRes.data.csrfToken);
          }

          const verifyRes = await api.post("/api/bookings/payment/verify", { session_token: sessionToken });
          setBookingFeedback({
            type: "success",
            message: `${verifyRes.data.message} Booking code: ${verifyRes.data.booking?.booking_code || "N/A"}`,
          });
        }

        setBookingForm((prev) => ({
          ...prev,
          check_in_date: "",
          check_out_date: "",
          rooms_booked: 1,
          guests_count: 1,
          special_requests: "",
        }));

        await loadHomestay();
      } catch (err) {
        setBookingFeedback({
          type: "error",
          message: err.response?.data?.message || "Payment verification failed. Please contact support if amount was deducted.",
        });
      } finally {
        setPaymentVerifying(false);
        navigate(location.pathname, { replace: true });
      }
    };

    verifyPayment();
  }, [location.pathname, location.search, navigate, loadHomestay]);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [homestay?.homestay_id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f4f2ee] via-[#faf8f4] to-[#f2efe8]">
        <Header user={user} onLogoutClick={() => setShowLogoutModal(true)} />
        <div className="max-w-7xl mx-auto px-6 pt-32 pb-20 text-center text-gray-500">Loading homestay details...</div>

        <LogoutModal
          isOpen={showLogoutModal}
          onConfirm={handleLogout}
          onCancel={handleStayLoggedIn}
        />
      </div>
    );
  }

  if (!homestay) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f4f2ee] via-[#faf8f4] to-[#f2efe8]">
        <Header user={user} onLogoutClick={() => setShowLogoutModal(true)} />
        <div className="max-w-7xl mx-auto px-6 pt-32 pb-20">
          <p className="text-gray-600 mb-4">Homestay not found.</p>
          <Link to="/" className="text-blue-600 font-semibold hover:underline">Back to trails</Link>
        </div>

        <LogoutModal
          isOpen={showLogoutModal}
          onConfirm={handleLogout}
          onCancel={handleStayLoggedIn}
        />
      </div>
    );
  }

  const images = Array.isArray(homestay.images) ? homestay.images : [];
  const primary = images.find((img) => img.is_primary) || images[0] || null;
  const displayImages = images.length ? images : primary ? [primary] : [];
  const currentImage = displayImages[activeImageIndex] || primary;
  const amenities = Array.isArray(homestay.amenities) ? homestay.amenities : [];
  const availableRooms = Number(homestay.available_rooms ?? 0);
  const totalRooms = Number(homestay.total_rooms ?? 0);
  const googleMapSrc = extractGoogleMapSrc(homestay.google_map_iframe_link);
  const isSoldOut = availableRooms <= 0;
  const todayIso = new Date().toISOString().slice(0, 10);

  const amenityCards = amenities.map((item) => ({ ...getAmenityMeta(item), raw: item }));
  const reviewRows = Array.isArray(homestay.reviews) ? homestay.reviews : [];
  const avgRating = Number(homestay.reviews_stats?.avg_rating || 0);
  const totalReviews = Number(homestay.reviews_stats?.total_reviews || reviewRows.length || 0);
  const isNonTouristUser = Boolean(user && user.user_type !== "tourist");

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream via-[#f9f7f3] to-stone/40 font-body">
      <Header user={user} onLogoutClick={() => setShowLogoutModal(true)} />

      <motion.main
        className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-20 overflow-hidden"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <div className="pointer-events-none absolute -top-14 -left-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,_rgba(200,147,42,0.18)_0%,_rgba(200,147,42,0)_72%)]" />
        <div className="pointer-events-none absolute top-44 -right-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,_rgba(45,106,79,0.12)_0%,_rgba(45,106,79,0)_70%)]" />

        <motion.div variants={itemVariants} className="mb-6 sm:mb-8">
          <Link
            to={`/trails/${homestay.trail_id}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-navy hover:text-navy-light bg-white/90 border border-navy/10 rounded-full px-4 py-2 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
          >
            <ArrowLeft className="h-4 w-4" /> Back to trail
          </Link>
        </motion.div>

        <motion.section
          variants={itemVariants}
          className="relative rounded-3xl border border-gold/25 bg-gradient-to-r from-white via-gold-pale/60 to-white shadow-[0_14px_34px_rgba(12,35,64,0.08)] p-4 sm:p-6 lg:p-8 mb-8 overflow-hidden"
        >
          <div className="pointer-events-none absolute -right-24 -bottom-24 h-52 w-52 rounded-full bg-[radial-gradient(circle,_rgba(200,147,42,0.18)_0%,_rgba(200,147,42,0)_72%)]" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="uppercase text-[11px] tracking-[0.26em] text-gold-dark font-semibold mb-2">OffTrail Homestay</p>
              <h1 className="text-4xl sm:text-5xl leading-tight text-charcoal font-heading">{homestay.name}</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gold" />
                {homestay.location}, {homestay.region}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gold/30 bg-gold-pale text-gold-dark text-xs font-bold shadow-sm">
                NPR {Number(homestay.price_per_night).toLocaleString()} / night
              </span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold shadow-sm ${isSoldOut ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                {isSoldOut ? "All rooms booked" : `${availableRooms}/${totalRooms} rooms available`}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 text-xs font-bold shadow-sm">
                <Star className={`h-3.5 w-3.5 ${totalReviews > 0 ? "fill-amber-500 text-amber-500" : "text-amber-300"}`} />
                {totalReviews > 0 ? `${avgRating.toFixed(1)} / 5 (${totalReviews})` : "No reviews yet"}
              </span>
            </div>
          </div>
        </motion.section>

        <motion.section variants={itemVariants} className="grid lg:grid-cols-12 gap-6 lg:gap-8">
          <div className="lg:col-span-7 space-y-6">
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: MOTION_DURATION, ease: MOTION_CURVE }}
              className="rounded-3xl border border-navy/10 bg-white shadow-[0_12px_30px_rgba(12,35,64,0.08)] overflow-hidden"
            >
              {currentImage ? (
                <img
                  src={`${API}${currentImage.image_path}`}
                  alt={homestay.name}
                  className="w-full h-[300px] sm:h-[380px] lg:h-[460px] object-cover transition-transform duration-700 hover:scale-[1.02]"
                />
              ) : (
                <div className="w-full h-[300px] sm:h-[380px] lg:h-[460px] bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                  <Home className="h-12 w-12 text-gray-300" />
                </div>
              )}

              {displayImages.length > 1 && (
                <div className="p-3 sm:p-4 bg-gold-pale/40 border-t border-gold/20">
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {displayImages.slice(0, 10).map((img, idx) => (
                      <button
                        key={img.image_id || idx}
                        type="button"
                        onClick={() => setActiveImageIndex(idx)}
                        className={`relative h-16 sm:h-20 rounded-xl overflow-hidden border-2 transition-all duration-300 ${idx === activeImageIndex ? "border-gold shadow-md" : "border-transparent hover:border-gold/40 hover:-translate-y-0.5"}`}
                      >
                        <img src={`${API}${img.image_path}`} alt="Homestay" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>

            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: MOTION_DURATION, ease: MOTION_CURVE }}
              className="rounded-3xl border border-navy/10 bg-white p-6 shadow-[0_10px_24px_rgba(12,35,64,0.06)]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-navy/70 mb-3">Description</p>
              <p className="text-[15px] leading-8 text-gray-600 whitespace-pre-line">{homestay.description || "No detailed description has been added yet."}</p>
            </motion.div>
          </div>

          <aside className="lg:col-span-5 space-y-6 lg:sticky lg:top-28 h-fit">
            <motion.div
              variants={itemVariants}
              whileHover={{ y: -2 }}
              transition={{ duration: MOTION_DURATION, ease: MOTION_CURVE }}
              className="rounded-3xl border border-navy/10 bg-white p-6 shadow-[0_10px_24px_rgba(12,35,64,0.07)]"
            >
              <h2 className="text-3xl leading-none text-charcoal mb-4 font-heading">Stay Snapshot</h2>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="rounded-2xl bg-gold-pale border border-gold/25 p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-gold-dark font-semibold">Price / Night</p>
                  <p className="text-xl font-black text-charcoal mt-1">NPR {Number(homestay.price_per_night).toLocaleString()}</p>
                </div>
                <div className={`rounded-2xl border p-3 ${isSoldOut ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100"}`}>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-gray-500 font-semibold">Room Availability</p>
                  <p className={`text-xl font-black mt-1 ${isSoldOut ? "text-red-700" : "text-emerald-700"}`}>
                    {isSoldOut ? "Booked" : `${availableRooms}/${totalRooms}`}
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-sm text-gray-600">
                <p className="flex items-center gap-2"><Users className="h-4 w-4 text-navy" /> Capacity: {homestay.capacity} guests</p>
                <p className="flex items-center gap-2"><BedDouble className="h-4 w-4 text-alpine" /> Total rooms: {totalRooms}</p>
                <p className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  Guest rating: {totalReviews > 0 ? `${avgRating.toFixed(1)} out of 5 (${totalReviews} review${totalReviews === 1 ? "" : "s"})` : "No ratings yet"}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  to={`/trails/${homestay.trail_id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-navy/20 text-navy hover:bg-navy/5 transition-colors"
                >
                  Back to Trail <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>

            <motion.div
              variants={itemVariants}
              whileHover={{ y: -2 }}
              transition={{ duration: MOTION_DURATION, ease: MOTION_CURVE }}
              className="rounded-3xl border border-gold/25 bg-gradient-to-br from-white via-[#fffdf8] to-gold-pale/40 p-6 shadow-[0_10px_24px_rgba(12,35,64,0.06)]"
            >
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-navy/70">Book This Homestay</p>
                  <p className="text-sm text-gray-500 mt-1">Smarter checkout with a focused booking modal and secure payment handoff.</p>
                </div>
                <CalendarDays className="h-5 w-5 text-gold" />
              </div>

              <div className="rounded-2xl border border-gold/25 bg-white/90 p-3.5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-dark">Current Payment Method</p>
                <p className="mt-1 text-sm font-semibold text-charcoal">
                  {paymentMethod === "stripe" ? "Stripe (USD)" : "eSewa (NPR)"}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  You can change this inside the booking modal before paying.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowBookingModal(true)}
                disabled={isSoldOut || bookingSubmitting || paymentVerifying || isNonTouristUser}
                className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${isSoldOut || isNonTouristUser ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-gradient-to-r from-gold to-[#D4A43A] text-navy shadow-md hover:shadow-lg hover:-translate-y-0.5"}`}
              >
                {(bookingSubmitting || paymentVerifying) && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSoldOut
                  ? "Fully Booked"
                  : isNonTouristUser
                    ? "Only Tourists Can Book"
                    : bookingSubmitting
                      ? `Redirecting to ${paymentMethod === "stripe" ? "Stripe" : "eSewa"}...`
                      : paymentVerifying
                        ? "Verifying Payment..."
                        : "Open Booking Modal"}
              </button>

              {bookingFeedback && (
                <p className={`mt-3 text-sm font-medium ${bookingFeedback.type === "success" ? "text-emerald-700" : "text-red-600"}`}>
                  {bookingFeedback.message}
                </p>
              )}

              {isNonTouristUser && (
                <p className="mt-2 text-xs text-red-600">
                  Only tourist accounts can book homestay rooms.
                </p>
              )}

              {!user && (
                <p className="mt-2 text-xs text-gray-500">
                  Please login as a tourist account to make a booking.
                </p>
              )}
            </motion.div>

            {amenityCards.length > 0 && (
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -2 }}
                transition={{ duration: MOTION_DURATION, ease: MOTION_CURVE }}
                className="rounded-3xl border border-navy/10 bg-white p-6 shadow-[0_10px_24px_rgba(12,35,64,0.06)]"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-navy/70 mb-3">Amenities</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {amenityCards.map(({ icon: Icon, label, tone, raw }, idx) => (
                    <div key={`${raw}-${idx}`} className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border ${tone}`}>
                      <Icon className="h-3.5 w-3.5" />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </aside>
        </motion.section>

        <motion.section
          variants={itemVariants}
          whileHover={{ y: -2 }}
          transition={{ duration: MOTION_DURATION, ease: MOTION_CURVE }}
          className="mt-8 rounded-3xl border border-navy/10 bg-white p-4 sm:p-6 shadow-[0_10px_24px_rgba(12,35,64,0.06)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-navy/70">Guest Reviews</p>
              <p className="text-sm text-gray-600 mt-1">Ratings from tourists who already completed their stay.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-700">
              <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
              {totalReviews > 0 ? `${avgRating.toFixed(1)} / 5` : "No rating yet"}
            </div>
          </div>

          {reviewRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-500">
              This homestay has not received reviews yet.
            </div>
          ) : (
            <div className="space-y-3">
              {reviewRows.map((review) => (
                <div key={review.review_id} className="rounded-2xl border border-gray-100 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-charcoal">{review.reviewer_name || "Tourist"}</p>
                    <div className="inline-flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${star <= Number(review.rating || 0) ? "text-amber-500 fill-amber-500" : "text-gray-300 fill-transparent"}`}
                        />
                      ))}
                    </div>
                  </div>
                  {review.comment && <p className="mt-2 text-sm text-gray-700">{review.comment}</p>}
                  <p className="mt-2 text-xs text-gray-400">{new Date(review.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {googleMapSrc && (
          <motion.section
            variants={itemVariants}
            whileHover={{ y: -2 }}
            transition={{ duration: MOTION_DURATION, ease: MOTION_CURVE }}
            className="mt-8 rounded-3xl border border-navy/10 bg-white p-4 sm:p-6 shadow-[0_10px_24px_rgba(12,35,64,0.06)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-navy/70">Location Map</p>
                <p className="text-sm text-gray-600 mt-1">Exact area and navigation preview for this homestay.</p>
              </div>
              <a
                href={googleMapSrc}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-navy hover:text-navy-light"
              >
                <ExternalLink className="h-4 w-4" /> Open in Google Maps
              </a>
            </div>

            <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
              <iframe
                src={googleMapSrc}
                width="100%"
                height="360"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`${homestay.name} map`}
              />
            </div>
          </motion.section>
        )}
      </motion.main>

      <Footer />

      <HomestayBookingModal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        onSubmit={handleBookHomestay}
        bookingForm={bookingForm}
        handleBookingField={handleBookingField}
        bookingFeedback={bookingFeedback}
        bookingSubmitting={bookingSubmitting}
        paymentVerifying={paymentVerifying}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        isSoldOut={isSoldOut}
        availableRooms={availableRooms}
        todayIso={todayIso}
        user={user}
      />

      <LogoutModal
        isOpen={showLogoutModal}
        onConfirm={handleLogout}
        onCancel={handleStayLoggedIn}
      />
    </div>
  );
};

export default HomestayDetail;
