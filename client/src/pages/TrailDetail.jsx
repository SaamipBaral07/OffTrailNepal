
// ╠═══════════════════════════════════════════════════════════════════════════════════════════════════════════╣
// ║ GET  /api/trails/public/:id             → trailRoutes.js        → trailController.getPublicTrailById    ║
// ║ GET  /api/trails/:id/community-photos   → trailRoutes.js        → trailController.getCommunityPhotos    ║
// ║ GET  /api/homestays/public/trail/:id    → homestayRoutes.js     → homestayController.getPublicByTrail   ║
// ║ GET  /api/trails/:id/services           → trailRoutes.js        → trailController.getTrailServices      ║
// ║ GET  /api/guides/public/trail/:id       → guideRoutes.js        → guideController.getPublicGuidesByTrail║
// ║ POST /api/trails/:id/community-photos   → trailRoutes.js        → trailController.uploadCommunityPhotos ║
// ║ POST /api/guide-bookings/payment/stripe/initiate → guideBookingRoutes.js → guideBookingController.initiateStripePayment  ║
// ║ POST /api/guide-bookings/payment/initiate        → guideBookingRoutes.js → guideBookingController.initiatePayment        ║
// ║ (via useWishlist hook)                                                                                  ║
// ║ GET  /api/wishlist/ids                  → wishlistRoutes.js     → wishlistController.getWishlistIds      ║
// ║ POST /api/wishlist/toggle               → wishlistRoutes.js     → wishlistController.toggleWishlistItem  ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════╝

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import {
  ArrowLeft,
  MapPin,
  Book,
  Mountain,
  TrendingUp,
  Camera,
  Calendar,
  Route,
  Timer,
  Clock,
  Download,
  Briefcase,
  Award,
  Tent,
  Home,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Users,
  Compass,
  Wifi,
  ShowerHead,
  UtensilsCrossed,
  Car,
  Coffee,
  Tv,
  Snowflake,
  Star,
  BadgeCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DayPicker } from "react-day-picker";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import TrailMap from "../components/TrailMap";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import LogoutModal from "../components/LogoutModal";
import { useWishlist } from "../hooks/useWishlist";
import WishlistToggleButton from "../components/wishlist/WishlistToggleButton";
import api from "../api";

const API = "http://localhost:5000";
const MOTION_CURVE = [0.22, 1, 0.36, 1];
const MOTION_DURATION = 0.32;
const MOTION_STAGGER = 0.07;
const MOTION_STAGGER_TIGHT = 0.05;
const GUIDE_MIN_ADVANCE_DAYS = Math.max(
  1,
  Number.parseInt(process.env.REACT_APP_GUIDE_MIN_ADVANCE_DAYS || "2", 10) || 2
);
const MAX_COMMUNITY_UPLOAD_FILES = 6;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const toDateKey = (value) => {
  if (!value) return null;
  if (typeof value === "string" && DATE_KEY_RE.test(value.trim())) {
    return value.trim();
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const yyyy = parsed.getUTCFullYear();
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const addDaysToDateKey = (dateKey, days) => {
  const normalized = toDateKey(dateKey);
  if (!normalized) return null;

  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return toDateKey(date);
};

const getMinimumGuideStartDateKey = () => {
  const today = toDateKey(new Date());
  return addDaysToDateKey(today, GUIDE_MIN_ADVANCE_DAYS);
};

const buildDateRangeKeys = (startDateKey, endDateKey) => {
  const start = toDateKey(startDateKey);
  const end = toDateKey(endDateKey);
  if (!start || !end || end < start) return [];

  const keys = [];
  let cursor = start;
  while (cursor <= end) {
    keys.push(cursor);
    cursor = addDaysToDateKey(cursor, 1);
    if (!cursor) break;
  }
  return keys;
};

const getBookingTotalDays = (startDateKey, endDateKey) => {
  const start = toDateKey(startDateKey);
  const end = toDateKey(endDateKey);
  if (!start || !end || end <= start) return 0;

  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [endYear, endMonth, endDay] = end.split("-").map(Number);
  const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
  const endUtc = Date.UTC(endYear, endMonth - 1, endDay);
  const msInDay = 24 * 60 * 60 * 1000;
  return Math.ceil((endUtc - startUtc) / msInDay);
};

const dateKeyToLocalDate = (value) => {
  const normalized = toDateKey(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  const localDate = new Date(year, month - 1, day);
  if (Number.isNaN(localDate.getTime())) return null;
  return localDate;
};

const localDateToDateKey = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "";
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const dd = String(value.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getLocalDayTimestamp = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
};

const isSameLocalDay = (a, b) => {
  const aTs = getLocalDayTimestamp(a);
  const bTs = getLocalDayTimestamp(b);
  return aTs !== null && bTs !== null && aTs === bTs;
};

const isBetweenLocalDays = (date, from, to) => {
  const dateTs = getLocalDayTimestamp(date);
  const fromTs = getLocalDayTimestamp(from);
  const toTs = getLocalDayTimestamp(to);
  if (dateTs === null || fromTs === null || toTs === null) return false;
  return dateTs > fromTs && dateTs < toTs;
};

const formatShortDate = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const difficultyConfig = {
  Easy: {
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-100",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
    glow: "shadow-emerald-200",
    fill: 1,
  },
  Moderate: {
    badge: "bg-amber-50 text-amber-700 border-amber-200 ring-amber-100",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
    glow: "shadow-amber-200",
    fill: 2,
  },
  Difficult: {
    badge: "bg-orange-50 text-orange-700 border-orange-200 ring-orange-100",
    dot: "bg-orange-500",
    bar: "bg-orange-500",
    glow: "shadow-orange-200",
    fill: 3,
  },
  Extreme: {
    badge: "bg-red-50 text-red-700 border-red-200 ring-red-100",
    dot: "bg-red-500",
    bar: "bg-red-500",
    glow: "shadow-red-200",
    fill: 4,
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

/* ─────────────────────────────────────────────
   PHOTO GALLERY — Pro mosaic with lightbox
───────────────────────────────────────────── */
const PhotoGallery = ({ images }) => {
  const [lightbox, setLightbox] = useState(null);
  const safeImages = Array.isArray(images) ? images : [];
  const count = Math.min(safeImages.length, 5);
  const visible = safeImages.slice(0, count);
  const src = (img) => `${API}${img.image_path}`;
  const open = (img) => setLightbox(safeImages.indexOf(img));
  const isLightboxOpen = lightbox !== null;

  useEffect(() => {
    if (!isLightboxOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isLightboxOpen]);

  if (!safeImages.length) return null;

  const Tile = ({ img, className = "" }) => (
    <div
      className={`group overflow-hidden cursor-zoom-in relative ${className}`}
      onClick={() => open(img)}
    >
      <img
        src={src(img)}
        alt="Trail"
        className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105 group-hover:brightness-90"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300" />
    </div>
  );

  let layout = null;
  if (count === 1) {
    layout = (
      <div className="h-[420px] rounded-2xl overflow-hidden shadow-xl">
        <Tile img={visible[0]} className="w-full h-full" />
      </div>
    );
  } else if (count === 2) {
    layout = (
      <div className="grid grid-cols-2 gap-2 h-80 rounded-2xl overflow-hidden shadow-xl">
        {visible.map((img) => <Tile key={img.image_id} img={img} className="h-full" />)}
      </div>
    );
  } else if (count === 3) {
    layout = (
      <div className="grid grid-cols-3 gap-2 h-80 rounded-2xl overflow-hidden shadow-xl">
        <Tile img={visible[0]} className="col-span-2 h-full" />
        <div className="grid grid-rows-2 gap-2">
          {visible.slice(1).map((img) => <Tile key={img.image_id} img={img} className="h-full" />)}
        </div>
      </div>
    );
  } else if (count === 4) {
    layout = (
      <div className="grid grid-cols-3 gap-2 h-[360px] rounded-2xl overflow-hidden shadow-xl">
        <Tile img={visible[0]} className="col-span-2 h-full" />
        <div className="grid grid-rows-3 gap-2">
          {visible.slice(1).map((img) => <Tile key={img.image_id} img={img} className="h-full" />)}
        </div>
      </div>
    );
  } else {
    const compactTiles = visible.slice(1, 4);
    const overflowImage = visible[4];
    const hiddenCount = Math.max(0, safeImages.length - 5);

    layout = (
      <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[420px] rounded-2xl overflow-hidden shadow-2xl">
        <Tile img={visible[0]} className="col-span-2 row-span-2" />
        {compactTiles.map((img) => <Tile key={img.image_id} img={img} className="col-span-1 row-span-1" />)}
        {overflowImage && (
          <div
            className="col-span-1 row-span-1 relative overflow-hidden cursor-pointer"
            onClick={() => open(overflowImage)}
          >
            <img src={src(overflowImage)} alt="Trail" className="w-full h-full object-cover" />
            {hiddenCount > 0 && (
              <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center">
                <span className="text-white font-bold text-2xl">+{hiddenCount}</span>
                <span className="text-white/70 text-xs mt-0.5 tracking-wide">more photos</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const lightboxMountNode = typeof document !== "undefined" ? document.body : null;

  return (
    <>
      {layout}
      {lightboxMountNode && createPortal(
        <AnimatePresence>
          {lightbox !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center px-2 py-4 sm:p-6"
              onClick={() => setLightbox(null)}
            >
              <button
                className="absolute top-3 right-3 sm:top-5 sm:right-5 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl font-light transition"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox(null);
                }}
              >×</button>
              <button
                className="absolute left-2 sm:left-5 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white text-3xl transition"
                onClick={(e) => { e.stopPropagation(); setLightbox((i) => (i - 1 + safeImages.length) % safeImages.length); }}
              >‹</button>
              <button
                className="absolute right-2 sm:right-5 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white text-3xl transition"
                onClick={(e) => { e.stopPropagation(); setLightbox((i) => (i + 1) % safeImages.length); }}
              >›</button>
              <motion.img
                key={lightbox}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                src={`${API}${safeImages[lightbox]?.image_path}`}
                alt="Trail"
                className="max-h-[88vh] max-w-[92vw] sm:max-h-[90vh] sm:max-w-[90vw] rounded-xl object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
              <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/40 text-xs tracking-[0.2em] font-light">
                {lightbox + 1} / {safeImages.length}
              </p>
            </motion.div>
          )}
        </AnimatePresence>,
        lightboxMountNode
      )}
    </>
  );
};

/* ─────────────────────────────────────────────
   HOMESTAY CARD — refined design
───────────────────────────────────────────── */
const HomestayCard = ({
  homestay,
  index,
  isHighlighted = false,
  cardRef,
  distanceKm = null,
  distanceThresholdKm = 3,
  onSelect,
  layout = "grid",
  showWishlist = false,
  wishlisted = false,
  wishlistLoading = false,
  onToggleWishlist,
}) => {
  const primary = homestay.images?.find((i) => i.is_primary) || homestay.images?.[0];
  const isNearTrail = Number.isFinite(distanceKm) && distanceKm <= distanceThresholdKm;
  const totalRooms = Number.isFinite(Number(homestay.total_rooms))
    ? Number(homestay.total_rooms)
    : Math.max(1, Number(homestay.capacity || 1));
  const availableRooms = Number.isFinite(Number(homestay.available_rooms))
    ? Number(homestay.available_rooms)
    : totalRooms;
  const isSoldOut = availableRooms <= 0;
  const amenities = Array.isArray(homestay.amenities)
    ? homestay.amenities
    : typeof homestay.amenities === "string"
      ? homestay.amenities.split(",").map((a) => a.trim()).filter(Boolean)
      : [];
  const avgRating = Number(homestay.avg_rating || 0);
  const totalReviews = Number(homestay.total_reviews || 0);
  const isListLayout = layout === "list";

  return (
    <motion.div
      ref={cardRef}
      id={`homestay-card-${homestay.homestay_id}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * MOTION_STAGGER, duration: MOTION_DURATION, ease: MOTION_CURVE }}
      onClick={() => onSelect?.(homestay.homestay_id)}
      className={`bg-white rounded-2xl overflow-hidden border transition-all duration-300 hover:-translate-y-0.5 group ${isListLayout ? "flex flex-col md:flex-row" : "flex flex-col"} ${
        isHighlighted
          ? "border-emerald-400 ring-2 ring-emerald-200 shadow-[0_16px_40px_rgba(16,185,129,0.18)]"
          : "border-gray-100 hover:border-gold/40 hover:shadow-[0_14px_36px_rgba(0,0,0,0.08)]"
      }`}
      style={{ cursor: onSelect ? "pointer" : "default" }}
    >
      {/* Image */}
      <div className={`relative bg-stone-100 overflow-hidden flex-shrink-0 ${isListLayout ? "h-56 md:h-auto md:w-[42%]" : "h-52"}`}>
        {primary ? (
          <img
            src={`${API}${primary.image_path}`}
            alt={homestay.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-100 to-amber-50">
            <Tent className="h-10 w-10 text-stone-300" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent pointer-events-none" />

        {showWishlist && (
          <div className="absolute top-3 left-3 z-10">
            <WishlistToggleButton
              active={wishlisted}
              loading={wishlistLoading}
              onClick={(event) => {
                event.stopPropagation();
                onToggleWishlist?.(event);
              }}
              className="h-9 w-9"
            />
          </div>
        )}

        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm border border-white/80">
          <span className="text-xs font-extrabold text-charcoal">
            NPR {Number(homestay.price_per_night).toLocaleString()}
            <span className="font-normal text-gray-400">/person/night</span>
          </span>
        </div>

        <div className={`absolute bottom-3 left-3 px-3 py-1.5 rounded-full text-[11px] font-semibold shadow-sm border ${isSoldOut ? "bg-red-600 text-white border-red-400" : "bg-emerald-600 text-white border-emerald-400"}`}>
          {isSoldOut ? "All Rooms Booked" : `${availableRooms}/${totalRooms || "-"} Rooms Available`}
        </div>
      </div>

      {/* Content */}
      <div className={`p-5 flex flex-col flex-1 ${isListLayout ? "md:p-6" : ""}`}>
        <h4 className={`font-extrabold text-charcoal leading-tight mb-2 ${isListLayout ? "text-xl" : "text-lg"}`}>{homestay.name}</h4>
        <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-3">
          <MapPin className="h-3 w-3 flex-shrink-0 text-gold" />
          {homestay.location}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          {Number.isFinite(distanceKm) && (
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
              isNearTrail
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-gray-50 text-gray-600 border-gray-200"
            }`}>
              <Route className="h-3 w-3" />
              {distanceKm.toFixed(2)} km from trail
            </span>
          )}

          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
            <Star className={`h-3 w-3 ${totalReviews > 0 ? "fill-amber-500 text-amber-500" : "text-amber-300"}`} />
            {totalReviews > 0 ? `${avgRating.toFixed(1)} (${totalReviews})` : "No reviews"}
          </span>

          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-violet-50 text-violet-700 border-violet-200">
            <Users className="h-3 w-3" />
            Up to {homestay.capacity} guests
          </span>
        </div>

        {homestay.description && (
          <p className={`text-gray-500 leading-relaxed mb-4 ${isListLayout ? "text-sm line-clamp-3" : "text-xs line-clamp-2"}`}>{homestay.description}</p>
        )}

        {amenities.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {amenities.slice(0, isListLayout ? 8 : 4).map((amenity, idx) => (
              <span
                key={`${amenity}-${idx}`}
                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${getAmenityMeta(amenity).tone}`}
              >
                {(() => {
                  const { icon: Icon, label } = getAmenityMeta(amenity);
                  return (
                    <>
                      <Icon className="h-3 w-3" />
                      {label}
                    </>
                  );
                })()}
              </span>
            ))}
            {amenities.length > (isListLayout ? 8 : 4) && (
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-gray-50 text-gray-500 border border-gray-200">
                +{amenities.length - (isListLayout ? 8 : 4)} more
              </span>
            )}
          </div>
        )}

        {isSoldOut && (
          <div className="mb-4 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-100 rounded-lg px-2.5 py-2">
            No rooms currently available. Please check back soon.
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4 border-t border-gray-100">
          <Link
            to={`/homestays/${homestay.homestay_id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-charcoal hover:text-gold px-3 py-2 rounded-lg border border-gray-200 hover:border-gold/40 hover:bg-amber-50/50 transition"
          >
            View Details <ChevronRight className="h-3.5 w-3.5" />
          </Link>

          {homestay.google_map_iframe_link && (
            <a
              href={homestay.google_map_iframe_link}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition"
            >
              View on Maps
            </a>
          )}

          <Link
            to={`/homestays/${homestay.homestay_id}`}
            onClick={(e) => e.stopPropagation()}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all duration-200 ${isSoldOut ? "bg-gray-100 text-gray-400 pointer-events-none border border-gray-200" : "bg-gold/10 text-gold hover:bg-gold hover:text-white border border-gold/30"}`}
          >
            <Book className="h-3 w-3" />
            {isSoldOut ? "Unavailable" : "Book Securely"}
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

/* ─────────────────────────────────────────────
   STAT PILL
───────────────────────────────────────────── */
const StatPill = ({ icon: Icon, label, value, iconClass = "text-gold" }) => (
  <div className="flex items-center gap-3.5 bg-black/20 backdrop-blur-md rounded-2xl px-4 py-3.5 border border-white/10 hover:bg-black/30 transition-all duration-300 shadow-xl">
    <div className={`w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 ${iconClass} border border-white/5`}>
      <Icon className="h-4 w-4" />
    </div>
    <div>
      <p className="text-[10px] text-white/50 uppercase tracking-[0.15em] font-bold mb-1">{label}</p>
      <p className="text-[15px] font-extrabold text-white leading-none tracking-tight">{value}</p>
    </div>
  </div>
);

/* ─────────────────────────────────────────────
   DIFFICULTY BAR
───────────────────────────────────────────── */
const DifficultyBar = ({ level }) => {
  const config = difficultyConfig[level] || difficultyConfig["Moderate"];
  return (
    <div className="mt-1">
      <div className="flex gap-1.5 mb-2">
        {[1,2,3,4].map((n) => (
          <div
            key={n}
            className={`h-1.5 flex-1 rounded-full overflow-hidden bg-gray-100`}
          >
            <div 
              className={`h-full w-full transition-all duration-700 ease-out origin-left ${n <= config.fill ? config.bar : "scale-x-0"}`}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase tracking-wider">
        <span>Easy</span>
        <span>Extreme</span>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   GUIDE SERVICE CARD
───────────────────────────────────────────── */
const GuideServiceCard = ({
  service,
  index,
  user,
  onBookPackage,
  showWishlist = false,
  wishlisted = false,
  wishlistLoading = false,
  onToggleWishlist,
}) => {
  const isTourist = user?.user_type === "tourist";
  const avgRating = Number(service.avg_rating || 0);
  const totalReviews = Number(service.total_reviews || 0);
  const minBookingDays = Math.max(1, Number(service.min_booking_days || 1));
  const unavailableDateCount = new Set(
    [
      ...(Array.isArray(service.booked_dates) ? service.booked_dates : []),
      ...(Array.isArray(service.manual_unavailable_dates)
        ? service.manual_unavailable_dates
        : []),
    ]
      .map((value) => toDateKey(value))
      .filter(Boolean)
  ).size;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * MOTION_STAGGER, duration: MOTION_DURATION, ease: MOTION_CURVE }}
      className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-gold/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex flex-col sm:flex-row"
    >
      {/* Guide Info Side */}
      <div className="bg-stone-50 p-6 sm:w-1/3 flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-gray-100/80">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gold to-amber-500 flex items-center justify-center text-white text-xl font-bold shadow-md mb-3">
          {service.guide_name.charAt(0)}
        </div>
        <div className="flex items-center justify-center gap-2 mb-1">
          <h4 className="font-bold text-charcoal text-center">{service.guide_name}</h4>
          {service.verification_status === 'approved' && (
            <BadgeCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" title="Verified guide" />
          )}
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 mb-3">
          <Star className={`h-3 w-3 ${totalReviews > 0 ? "fill-amber-500 text-amber-500" : "text-amber-300"}`} />
          {totalReviews > 0 ? `${avgRating.toFixed(1)} / 5 (${totalReviews})` : "No reviews yet"}
        </div>
        
        <div className="flex flex-wrap justify-center gap-2 text-[11px] font-semibold">
          <span className="flex items-center gap-1 bg-white border border-gray-200 px-2 py-1 rounded-full text-gray-500">
            <Briefcase className="h-3 w-3 text-gold" />
            {service.experience_years} yrs exp.
          </span>
          <span className="flex items-center gap-1 bg-white border border-gray-200 px-2 py-1 rounded-full text-gray-500">
            <AwardBadge level={service.experience_level} />
          </span>
        </div>
      </div>

      {/* Service Details Side */}
      <div className="p-6 sm:w-2/3 flex flex-col">
        <div className="flex justify-between items-start mb-2 gap-3">
          <div>
            <h3 className="font-bold text-lg text-charcoal">{service.title}</h3>
            {showWishlist && wishlisted && (
              <span className="mt-1 inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                Saved
              </span>
            )}
          </div>
          <div className="flex items-start gap-2">
            {showWishlist && (
              <WishlistToggleButton
                active={wishlisted}
                loading={wishlistLoading}
                onClick={onToggleWishlist}
                className="h-9 w-9 border-gray-200 bg-white text-gray-500 hover:text-rose-600"
              />
            )}
            <div className="text-right">
              <p className="text-lg font-black text-gold leading-none">
                NPR {Number(service.price_per_day).toLocaleString()}
              </p>
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-1">per participant / day</p>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-500 leading-relaxed max-w-lg mb-4">
          {service.description}
        </p>

        <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-50">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
              <Users className="h-4 w-4 text-emerald-500" />
              Max Group: {service.max_group_size} pax
            </div>
            {unavailableDateCount > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-semibold">
                <Calendar className="h-3.5 w-3.5" />
                Busy on {unavailableDateCount} upcoming day{unavailableDateCount === 1 ? "" : "s"}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-[11px] text-amber-700 font-semibold">
              <Clock className="h-3.5 w-3.5" />
              Minimum booking: {minBookingDays} day{minBookingDays === 1 ? "" : "s"}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onBookPackage(service)}
              className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white text-xs font-bold rounded-xl hover:bg-black transition-colors shadow-sm"
            >
              <Book className="h-3.5 w-3.5" />
              {isTourist ? "Book Package" : "Book Package"}
            </button>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-gray-500">
          Guide coordination and contact details are shared securely only through confirmed in-app bookings.
        </p>
      </div>
    </motion.div>
  );
};

const AwardBadge = ({ level }) => {
  const map = {
    beginner: "Beginner Friendly",
    intermediate: "Intermediate Guide",
    expert: "Expert Guide"
  };
  return <>{map[level] || level}</>;
};

/* ─────────────────────────────────────────────
   BASE GUIDE CARD
───────────────────────────────────────────── */
const BaseGuideCard = ({
  guide,
  index,
  showWishlist = false,
  wishlisted = false,
  wishlistLoading = false,
  onToggleWishlist,
}) => {
  const avgRating = Number(guide.avg_rating || 0);
  const totalReviews = Number(guide.total_reviews || 0);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * MOTION_STAGGER_TIGHT, duration: MOTION_DURATION, ease: MOTION_CURVE }}
      className="bg-white rounded-2xl p-5 border border-gray-100 hover:border-gold/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
    >
      <div className="w-full">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-12 h-12 rounded-full bg-stone-100 text-gold flex items-center justify-center font-bold text-lg flex-shrink-0">
              {guide.full_name.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <h4 className="font-bold text-charcoal truncate">{guide.full_name}</h4>
                {guide.verification_status === 'approved' && (
                  <BadgeCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" title="Verified guide" />
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">Independent base guide</p>
            </div>
          </div>

          {showWishlist && (
            <WishlistToggleButton
              active={wishlisted}
              loading={wishlistLoading}
              onClick={onToggleWishlist}
              className="h-8 w-8 border-gray-200 bg-white text-gray-500 hover:text-rose-600"
            />
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-gray-600">
          <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
            <Briefcase className="h-3 w-3 text-gold" /> {guide.experience_years} yrs exp
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
            <Award className="h-3 w-3 text-gold" /> <AwardBadge level={guide.experience_level} />
          </span>
        </div>

        <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
            <Star className={`h-3 w-3 ${totalReviews > 0 ? "fill-amber-500 text-amber-500" : "text-amber-300"}`} />
            {totalReviews > 0 ? `${avgRating.toFixed(1)} / 5 (${totalReviews})` : "No reviews yet"}
        </div>

        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-3">
          <p className="text-sm font-bold text-charcoal">Base Guide Profile</p>
          <p className="text-[11px] text-gray-500 mt-1">
            Bookings are available only through package cards with secure in-app payment.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

const GuidePackageBookingModal = ({
  service,
  isOpen,
  onClose,
  onSubmit,
  submitting,
  paymentMethod,
  setPaymentMethod,
}) => {
  const [form, setForm] = useState({
    start_date: "",
    end_date: "",
    participants_count: 1,
    contact_phone: "",
    special_requests: "",
  });
  const [hoveredDate, setHoveredDate] = useState(null);
  const [blockedRangeSelectionMessage, setBlockedRangeSelectionMessage] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setForm({
        start_date: "",
        end_date: "",
        participants_count: 1,
        contact_phone: "",
        special_requests: "",
      });
      setHoveredDate(null);
      setBlockedRangeSelectionMessage("");
    }
  }, [isOpen, service?.service_id]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const serviceMinBookingDays = useMemo(
    () => Math.max(1, Number(service?.min_booking_days || 1)),
    [service?.min_booking_days]
  );

  const minimumStartDateKey = useMemo(() => getMinimumGuideStartDateKey(), []);

  const blockedDateKeys = useMemo(() => {
    const bookedDates = Array.isArray(service?.booked_dates) ? service.booked_dates : [];
    const manualUnavailableDates = Array.isArray(service?.manual_unavailable_dates)
      ? service.manual_unavailable_dates
      : [];

    return Array.from(
      new Set(
        [...bookedDates, ...manualUnavailableDates]
          .map((value) => toDateKey(value))
          .filter(Boolean)
      )
    ).sort();
  }, [service?.booked_dates, service?.manual_unavailable_dates]);

  const blockedDateSet = useMemo(() => new Set(blockedDateKeys), [blockedDateKeys]);

  const bookingTotalDays = useMemo(
    () => getBookingTotalDays(form.start_date, form.end_date),
    [form.start_date, form.end_date]
  );

  const minimumSelectableEndDateKey = useMemo(() => {
    if (!form.start_date) return "";
    return addDaysToDateKey(form.start_date, serviceMinBookingDays) || "";
  }, [form.start_date, serviceMinBookingDays]);

  const normalizedParticipantsCount = Math.max(
    1,
    Number.parseInt(form.participants_count, 10) || 1
  );
  const ratePerParticipantPerDay = Number(service?.price_per_day || 0);
  const estimatedTotalAmount = useMemo(() => {
    if (bookingTotalDays <= 0 || !Number.isFinite(ratePerParticipantPerDay) || ratePerParticipantPerDay <= 0) {
      return 0;
    }

    return Number.parseFloat(
      (ratePerParticipantPerDay * bookingTotalDays * normalizedParticipantsCount).toFixed(2)
    );
  }, [bookingTotalDays, normalizedParticipantsCount, ratePerParticipantPerDay]);

  const selectedDateRange = useMemo(
    () => ({
      from: dateKeyToLocalDate(form.start_date) || undefined,
      to: dateKeyToLocalDate(form.end_date) || undefined,
    }),
    [form.start_date, form.end_date]
  );

  const hoverPreviewRange = useMemo(() => {
    if (!selectedDateRange.from || selectedDateRange.to || !hoveredDate) return null;

    const fromTs = getLocalDayTimestamp(selectedDateRange.from);
    const hoverTs = getLocalDayTimestamp(hoveredDate);
    if (fromTs === null || hoverTs === null) return null;

    return hoverTs >= fromTs
      ? { from: selectedDateRange.from, to: hoveredDate }
      : { from: hoveredDate, to: selectedDateRange.from };
  }, [selectedDateRange.from, selectedDateRange.to, hoveredDate]);

  const minimumStartDateObject = useMemo(
    () => dateKeyToLocalDate(minimumStartDateKey) || new Date(),
    [minimumStartDateKey]
  );

  const blockedDateObjects = useMemo(
    () => blockedDateKeys.map((dateKey) => dateKeyToLocalDate(dateKey)).filter(Boolean),
    [blockedDateKeys]
  );

  const blockedDatesInSelection = useMemo(() => {
    if (!form.start_date || !form.end_date) return [];
    return buildDateRangeKeys(form.start_date, form.end_date).filter((dateKey) =>
      blockedDateSet.has(dateKey)
    );
  }, [form.start_date, form.end_date, blockedDateSet]);

  const startDateTooSoon = Boolean(form.start_date) && form.start_date < minimumStartDateKey;
  const endDateInvalid = Boolean(form.start_date && form.end_date) && form.end_date <= form.start_date;
  const blockedDateConflictMessage = blockedDatesInSelection.length > 0
    ? `Guide is unavailable on ${blockedDatesInSelection[0]}. Please choose a different date range.`
    : "";
  const minimumDurationNotMet =
    Boolean(form.start_date && form.end_date) && bookingTotalDays < serviceMinBookingDays;
  const minimumDurationDeficit = minimumDurationNotMet
    ? Math.max(0, serviceMinBookingDays - bookingTotalDays)
    : 0;

  const minimumDurationHelper = useMemo(() => {
    if (!form.start_date) {
      return {
        containerClassName: "border-amber-200 bg-amber-50 text-amber-900",
        iconClassName: "text-amber-700",
        message: `Minimum booking is ${serviceMinBookingDays} day${serviceMinBookingDays === 1 ? "" : "s"}. Pick a start date to continue.`,
      };
    }

    if (!form.end_date) {
      return {
        containerClassName: "border-navy/20 bg-navy/5 text-navy",
        iconClassName: "text-navy",
        message: `Choose an end date on or after ${minimumSelectableEndDateKey} to meet the ${serviceMinBookingDays}-day minimum.`,
      };
    }

    if (blockedRangeSelectionMessage || blockedDateConflictMessage) {
      return {
        containerClassName: "border-red-200 bg-red-50 text-red-700",
        iconClassName: "text-red-600",
        message: blockedRangeSelectionMessage || blockedDateConflictMessage,
      };
    }

    if (minimumDurationNotMet) {
      return {
        containerClassName: "border-red-200 bg-red-50 text-red-700",
        iconClassName: "text-red-600",
        message: `You selected ${bookingTotalDays} day${bookingTotalDays === 1 ? "" : "s"}. Select at least ${minimumDurationDeficit} more day${minimumDurationDeficit === 1 ? "" : "s"}.`,
      };
    }

    return {
      containerClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
      iconClassName: "text-emerald-600",
      message: `Selected duration is ${bookingTotalDays} day${bookingTotalDays === 1 ? "" : "s"}. Minimum duration requirement is met.`,
    };
  }, [
    form.start_date,
    form.end_date,
    bookingTotalDays,
    serviceMinBookingDays,
    minimumSelectableEndDateKey,
    blockedRangeSelectionMessage,
    blockedDateConflictMessage,
    minimumDurationNotMet,
    minimumDurationDeficit,
  ]);

  const availabilityValidationMessage = startDateTooSoon
    ? `Please choose a start date on or after ${minimumStartDateKey}.`
    : endDateInvalid
      ? "End date must be after start date."
      : blockedRangeSelectionMessage
        ? blockedRangeSelectionMessage
      : blockedDateConflictMessage
        ? blockedDateConflictMessage
      : minimumDurationNotMet
        ? `You selected ${bookingTotalDays} day${bookingTotalDays === 1 ? "" : "s"}. This package requires at least ${serviceMinBookingDays} day${serviceMinBookingDays === 1 ? "" : "s"}.`
        : "";

  if (!isOpen || !service) return null;

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
      className="fixed inset-0 z-[80] bg-gradient-to-b from-black/55 via-black/50 to-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
      onClick={() => {
        if (submitting) return;
        onClose();
      }}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] rounded-3xl border border-white/15 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.4)] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-gold/20 bg-gradient-to-r from-navy via-navy-light to-navy-light/80">
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-white">Book Guide Package</h3>
            <p className="text-xs sm:text-sm text-gold/90 mt-1">{service.title} · {service.guide_name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-2 hover:bg-white/20 rounded-xl transition disabled:opacity-60"
          >
            <span className="text-lg text-white">×</span>
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();

            if (availabilityValidationMessage) {
              window.alert(availabilityValidationMessage);
              return;
            }

            onSubmit({ ...form, service_id: service.service_id });
          }}
          className="flex-1 min-h-0 flex flex-col"
        >
          <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5 space-y-4">
            <div className="rounded-2xl border border-navy/10 bg-gradient-to-br from-white to-navy/5 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-700">Package Date Range</p>
                <p className="text-xs text-gray-500">
                  {form.start_date && form.end_date
                    ? `${form.start_date} to ${form.end_date} (${bookingTotalDays} day${bookingTotalDays === 1 ? "" : "s"})`
                    : "Select trek start and end dates"}
                </p>
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-gold/35 bg-gold-pale px-2.5 py-1 text-[11px] font-semibold text-gold-dark">
                  Minimum booking: {serviceMinBookingDays} day{serviceMinBookingDays === 1 ? "" : "s"}
                </span>
                {form.start_date && !form.end_date && minimumSelectableEndDateKey && (
                  <span className="inline-flex items-center rounded-full border border-navy/20 bg-navy/5 px-2.5 py-1 text-[11px] font-semibold text-navy">
                    Earliest valid end date: {minimumSelectableEndDateKey}
                  </span>
                )}
              </div>

              <DayPicker
                mode="range"
                min={serviceMinBookingDays}
                excludeDisabled
                showOutsideDays
                fixedWeeks
                selected={selectedDateRange}
                onDayMouseEnter={(day) => setHoveredDate(day)}
                onDayMouseLeave={() => setHoveredDate(null)}
                onSelect={(range) => {
                  if (!range?.from) {
                    setBlockedRangeSelectionMessage("");
                    setForm((prev) => ({ ...prev, start_date: "", end_date: "" }));
                    return;
                  }

                  const startDateKey = localDateToDateKey(range.from);

                  if (!range.to) {
                    setBlockedRangeSelectionMessage("");
                    setForm((prev) => ({
                      ...prev,
                      start_date: startDateKey,
                      end_date: "",
                    }));
                    return;
                  }

                  const endDateKey = localDateToDateKey(range.to);
                  const proposedRangeKeys = buildDateRangeKeys(startDateKey, endDateKey);
                  const conflictingDateKey = proposedRangeKeys.find((dateKey) =>
                    blockedDateSet.has(dateKey)
                  );

                  if (conflictingDateKey) {
                    setBlockedRangeSelectionMessage(
                      `Cannot include unavailable date ${conflictingDateKey}. End your booking before this date or start after it.`
                    );
                    setForm((prev) => ({
                      ...prev,
                      start_date: startDateKey,
                      end_date: "",
                    }));
                    return;
                  }

                  setBlockedRangeSelectionMessage("");
                  setForm((prev) => ({
                    ...prev,
                    start_date: startDateKey,
                    end_date: endDateKey,
                  }));
                }}
                disabled={[{ before: minimumStartDateObject }, ...blockedDateObjects]}
                modifiers={{
                  previewStart: (date) =>
                    Boolean(
                      hoverPreviewRange &&
                        isSameLocalDay(date, hoverPreviewRange.from)
                    ),
                  previewMiddle: (date) =>
                    Boolean(
                      hoverPreviewRange &&
                        isBetweenLocalDays(date, hoverPreviewRange.from, hoverPreviewRange.to)
                    ),
                  previewEnd: (date) =>
                    Boolean(
                      hoverPreviewRange &&
                        isSameLocalDay(date, hoverPreviewRange.to)
                    ),
                }}
                modifiersClassNames={{
                  previewStart: "bg-amber-300 text-amber-950 rounded-l-xl rounded-r-none",
                  previewMiddle: "bg-amber-100 text-amber-900 rounded-none",
                  previewEnd: "bg-amber-300 text-amber-950 rounded-r-xl rounded-l-none",
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
                  day: "h-9 w-9 sm:h-10 sm:w-10 p-0 font-semibold rounded-lg sm:rounded-xl hover:bg-amber-100 hover:text-amber-900 transition-all duration-150 hover:scale-[1.03] hover:shadow-sm",
                  day_selected: "bg-gradient-to-br from-amber-400 to-yellow-300 text-amber-950 border border-amber-400 shadow-[0_6px_14px_rgba(217,119,6,0.28)] hover:from-amber-400 hover:to-yellow-300",
                  day_today: "border border-amber-400 text-amber-800 ring-1 ring-amber-200",
                  day_outside: "text-gray-300 opacity-45",
                  day_disabled: "text-gray-300 opacity-70 cursor-not-allowed",
                  day_range_middle: "bg-amber-100 text-amber-900 rounded-none",
                  day_range_start: "bg-amber-300 text-amber-950 rounded-l-xl rounded-r-none",
                  day_range_end: "bg-amber-300 text-amber-950 rounded-r-xl rounded-l-none",
                }}
              />

              <div className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 ${minimumDurationHelper.containerClassName}`}>
                <Timer className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${minimumDurationHelper.iconClassName}`} />
                <p className="text-xs font-semibold leading-relaxed">{minimumDurationHelper.message}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Participants</label>
                <input
                  type="number"
                  min="1"
                  max={service.max_group_size || 1}
                  required
                  value={form.participants_count}
                  onChange={(e) => setForm((prev) => ({ ...prev, participants_count: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl"
                />
                <p className="text-[11px] text-gray-400 mt-1">Max {service.max_group_size} people. Charges are per participant.</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Contact Phone</label>
                <input
                  type="text"
                  value={form.contact_phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, contact_phone: e.target.value }))}
                  placeholder="+977-98XXXXXXXX"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl"
                />
              </div>
            </div>

            <div className="rounded-xl border border-navy/15 bg-navy/5 p-3.5">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-navy">Fair Pricing Breakdown</p>
                  <p className="text-[11px] text-gray-600 mt-1">NPR {Number(ratePerParticipantPerDay || 0).toLocaleString()} x {normalizedParticipantsCount} participant{normalizedParticipantsCount === 1 ? "" : "s"} x {bookingTotalDays || 0} day{bookingTotalDays === 1 ? "" : "s"}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-gray-500 uppercase tracking-wide">Estimated Total</p>
                  <p className="text-base font-extrabold text-navy">NPR {estimatedTotalAmount.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Special Requests</label>
              <textarea
                rows={3}
                value={form.special_requests}
                onChange={(e) => setForm((prev) => ({ ...prev, special_requests: e.target.value }))}
                placeholder="Fitness level, dietary needs, pace preference, permits, etc."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl resize-none"
              />
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
              <p className="text-xs font-semibold text-amber-900">Guide availability policy</p>
              <p className="text-[11px] text-amber-800 mt-1">
                Book at least {GUIDE_MIN_ADVANCE_DAYS} day{GUIDE_MIN_ADVANCE_DAYS === 1 ? "" : "s"} in advance.
                Earliest start date: <span className="font-bold">{minimumStartDateKey}</span>.
              </p>
              <p className="text-[11px] text-amber-800 mt-1">
                This package requires a minimum duration of <span className="font-bold">{serviceMinBookingDays} day{serviceMinBookingDays === 1 ? "" : "s"}</span>.
              </p>
              {blockedDateKeys.length > 0 ? (
                <>
                  <p className="text-[11px] text-amber-800 mt-2">
                    This guide is currently unavailable on {blockedDateKeys.length} upcoming day
                    {blockedDateKeys.length === 1 ? "" : "s"}.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {blockedDateKeys.slice(0, 24).map((dateKey) => (
                      <span
                        key={dateKey}
                        className="inline-flex items-center rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-800"
                      >
                        {dateKey}
                      </span>
                    ))}
                    {blockedDateKeys.length > 24 && (
                      <span className="inline-flex items-center rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        +{blockedDateKeys.length - 24} more
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-[11px] text-amber-800 mt-2">
                  No unavailable dates are currently marked by this guide.
                </p>
              )}
            </div>

            {availabilityValidationMessage && (
              <p className="text-xs font-semibold text-red-600">{availabilityValidationMessage}</p>
            )}

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
          </div>

          <div className="border-t border-stone-200 px-5 sm:px-6 py-4 bg-white/90">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 font-semibold disabled:opacity-70"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || Boolean(availabilityValidationMessage)}
                className="flex-1 px-4 py-2.5 bg-charcoal text-white rounded-xl font-semibold hover:bg-black disabled:opacity-70"
              >
                {submitting ? `Redirecting to ${paymentMethod === "stripe" ? "Stripe" : "eSewa"}...` : `Pay with ${paymentMethod === "stripe" ? "Stripe" : "eSewa"}`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   TABS
───────────────────────────────────────────── */
const TABS = ["Overview", "Itinerary", "Homestays", "Guides"];

const tabMotion = {
  initial: { opacity: 0, y: 14, filter: "blur(3px)", scale: 0.995 },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", scale: 1 },
  exit: { opacity: 0, y: -10, filter: "blur(3px)", scale: 0.995 },
  transition: { duration: MOTION_DURATION, ease: MOTION_CURVE },
};

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
const TrailDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trail, setTrail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [homestays, setHomestays] = useState([]);
  const [homestaysLoading, setHomestaysLoading] = useState(false);
  const [guideServices, setGuideServices] = useState([]);
  const [guidesLoading, setGuidesLoading] = useState(false);
  
  const [baseGuides, setBaseGuides] = useState([]);
  const [baseGuidesLoading, setBaseGuidesLoading] = useState(false);
  const [showGuideBookingModal, setShowGuideBookingModal] = useState(false);
  const [selectedGuideService, setSelectedGuideService] = useState(null);
  const [guidePaymentMethod, setGuidePaymentMethod] = useState("esewa");
  const [guideBookingSubmitting, setGuideBookingSubmitting] = useState(false);

  const [communitySubmissions, setCommunitySubmissions] = useState([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityError, setCommunityError] = useState("");
  const [expandedCommunitySubmissionId, setExpandedCommunitySubmissionId] = useState(null);
  const [communityUploadFiles, setCommunityUploadFiles] = useState([]);
  const [communityCaption, setCommunityCaption] = useState("");
  const [communityTrekDate, setCommunityTrekDate] = useState("");
  const [communitySubmitting, setCommunitySubmitting] = useState(false);
  const [communityNotice, setCommunityNotice] = useState(null);

  const [selectedHomestayId, setSelectedHomestayId] = useState(null);
  const [pendingScrollHomestayId, setPendingScrollHomestayId] = useState(null);
  const [nearTrailHomestayIds, setNearTrailHomestayIds] = useState([]);
  const [showOnlyNearTrail, setShowOnlyNearTrail] = useState(false);
  const [homestayViewMode, setHomestayViewMode] = useState("grid");
  const [distanceThresholdKm, setDistanceThresholdKm] = useState(3);
  const [homestayDistanceMap, setHomestayDistanceMap] = useState({});
  const homestayCardRefs = useRef({});
  const mapSectionRef = useRef(null);
  const [pendingMapFocusHomestayId, setPendingMapFocusHomestayId] = useState(null);
  
  const [activeTab, setActiveTab] = useState("Overview");
  const tabRef = useRef(null);
  const { user: authUser } = useAuth();
  const { isTourist, isWishlisted, isUpdating, toggleWishlist } = useWishlist();

  const {
    handleLogout: originalHandleLogout,
    handleStayLoggedIn,
    showLogoutModal,
    setShowLogoutModal,
  } = useLogoutHandler();
  const handleLogout = () => originalHandleLogout();

  useEffect(() => {
    if (authUser) setUser(authUser);
  }, [authUser]);

  const fetchCommunityPhotos = useCallback(async () => {
    if (!id) return;

    setCommunityLoading(true);
    setCommunityError("");

    try {
      const response = await axios.get(`${API}/api/trails/${id}/community-photos`);
      const nextSubmissions = Array.isArray(response.data?.submissions)
        ? response.data.submissions
        : [];

      setCommunitySubmissions(nextSubmissions);
      setExpandedCommunitySubmissionId((previous) => {
        if (previous && nextSubmissions.some((item) => item.submission_id === previous)) {
          return previous;
        }
        return nextSubmissions[0]?.submission_id || null;
      });
    } catch (err) {
      setCommunityError(err.response?.data?.message || "Could not load trekker photo gallery.");
      setCommunitySubmissions([]);
      setExpandedCommunitySubmissionId(null);
    } finally {
      setCommunityLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCommunityPhotos();
  }, [fetchCommunityPhotos]);

  useEffect(() => {
    const fetchTrail = async () => {
      try {
        const res = await axios.get(`${API}/api/trails/public/${id}`);
        setTrail(res.data.trail);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTrail();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const fetchHomestays = async () => {
      setHomestaysLoading(true);
      try {
        const res = await axios.get(`${API}/api/homestays/public/trail/${id}`);
        setHomestays(res.data.homestays);
      } catch (err) {
        console.error(err);
      } finally {
        setHomestaysLoading(false);
      }
    };
    fetchHomestays();

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/api/homestays/public/trail/${id}`);
        setHomestays(res.data.homestays);
      } catch (err) {
        console.error(err);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const fetchGuideServices = async () => {
      setGuidesLoading(true);
      try {
        const res = await axios.get(`${API}/api/trails/${id}/services`);
        setGuideServices(res.data.services);
      } catch (err) {
        console.error(err);
      } finally {
        setGuidesLoading(false);
      }
    };
    const fetchBaseGuides = async () => {
      setBaseGuidesLoading(true);
      try {
        const res = await axios.get(`${API}/api/guides/public/trail/${id}`);
        setBaseGuides(res.data.guides);
      } catch (err) {
        console.error(err);
      } finally {
        setBaseGuidesLoading(false);
      }
    };
    
    fetchGuideServices();
    fetchBaseGuides();
  }, [id]);

  useEffect(() => {
    if (activeTab !== "Homestays" || !pendingScrollHomestayId) return;

    const timer = setTimeout(() => {
      const targetCard = homestayCardRefs.current[pendingScrollHomestayId];
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setPendingScrollHomestayId(null);
    }, 140);

    return () => clearTimeout(timer);
  }, [activeTab, pendingScrollHomestayId]);

  useEffect(() => {
    if (!selectedHomestayId) return;
    const timer = setTimeout(() => setSelectedHomestayId(null), 2600);
    return () => clearTimeout(timer);
  }, [selectedHomestayId]);

  const handleMapHomestaySelect = (homestayId) => {
    setSelectedHomestayId(homestayId);
    setPendingScrollHomestayId(homestayId);
    setActiveTab("Homestays");
  };

  const handleHomestayCardSelect = (homestayId) => {
    setSelectedHomestayId(homestayId);
    setPendingMapFocusHomestayId(homestayId);
    setActiveTab("Overview");
  };

  useEffect(() => {
    if (activeTab !== "Overview" || !pendingMapFocusHomestayId) return;

    const timer = setTimeout(() => {
      mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setPendingMapFocusHomestayId(null);
    }, 120);

    return () => clearTimeout(timer);
  }, [activeTab, pendingMapFocusHomestayId]);

  const visibleHomestays = useMemo(() => {
    if (!showOnlyNearTrail) return homestays;
    const nearSet = new Set(nearTrailHomestayIds);
    return homestays.filter((h) => nearSet.has(h.homestay_id));
  }, [homestays, showOnlyNearTrail, nearTrailHomestayIds]);

  const handleOpenGuidePackageBooking = (service) => {
    if (!user) {
      navigate("/login", { replace: false });
      return;
    }

    if (user.user_type !== "tourist") {
      window.alert("Only tourist accounts can book guide packages.");
      return;
    }

    setSelectedGuideService(service);
    setShowGuideBookingModal(true);
  };

  const handleWishlistToggle = async (itemType, itemId) => {
    const result = await toggleWishlist(itemType, itemId);
    if (!result.ok && result.reason === "login-required") {
      navigate("/login", { replace: false });
      return;
    }
    if (!result.ok && result.message) {
      window.alert(result.message);
    }
  };

  const handleCommunityFileChange = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) return;

    if (selectedFiles.length > MAX_COMMUNITY_UPLOAD_FILES) {
      setCommunityNotice({
        type: "error",
        message: `Please select up to ${MAX_COMMUNITY_UPLOAD_FILES} photos per submission.`,
      });
      setCommunityUploadFiles(selectedFiles.slice(0, MAX_COMMUNITY_UPLOAD_FILES));
      return;
    }

    setCommunityUploadFiles(selectedFiles);
    setCommunityNotice(null);
  };

  const handleSubmitCommunityPhotos = async (event) => {
    event.preventDefault();

    if (!user) {
      navigate("/login", { replace: false });
      return;
    }

    if (user.user_type !== "tourist") {
      setCommunityNotice({
        type: "error",
        message: "Only tourists can submit trail community photos.",
      });
      return;
    }

    if (!communityUploadFiles.length) {
      setCommunityNotice({ type: "error", message: "Please choose at least one photo." });
      return;
    }

    if (communityUploadFiles.length > MAX_COMMUNITY_UPLOAD_FILES) {
      setCommunityNotice({
        type: "error",
        message: `Please limit uploads to ${MAX_COMMUNITY_UPLOAD_FILES} photos.`,
      });
      return;
    }

    if (communityCaption.trim().length > 1200) {
      setCommunityNotice({
        type: "error",
        message: "Caption is too long (max 1200 characters).",
      });
      return;
    }

    setCommunitySubmitting(true);
    setCommunityNotice(null);

    try {
      const payload = new FormData();
      if (communityCaption.trim()) {
        payload.append("caption", communityCaption.trim());
      }
      if (communityTrekDate) {
        payload.append("trek_date", communityTrekDate);
      }
      communityUploadFiles.forEach((file) => {
        payload.append("photos", file);
      });

      const response = await api.post(`/api/trails/${id}/community-photos`, payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setCommunityNotice({
        type: "success",
        message:
          response.data?.message ||
          "Thanks for sharing. Your photos were submitted and are awaiting admin approval.",
      });
      setCommunityUploadFiles([]);
      setCommunityCaption("");
      setCommunityTrekDate("");
      await fetchCommunityPhotos();
    } catch (err) {
      setCommunityNotice({
        type: "error",
        message:
          err.response?.data?.message ||
          "Could not submit photos right now. Please try again.",
      });
    } finally {
      setCommunitySubmitting(false);
    }
  };

  const handleSubmitGuideBooking = async (payload) => {
    setGuideBookingSubmitting(true);
    try {
      if (guidePaymentMethod === "stripe") {
        const stripeRes = await api.post("/api/guide-bookings/payment/stripe/initiate", payload);
        const checkoutUrl = stripeRes.data?.checkout_url;

        if (!checkoutUrl) {
          throw new Error("Invalid Stripe payment response");
        }

        window.location.href = checkoutUrl;
        return;
      }

      const res = await api.post("/api/guide-bookings/payment/initiate", payload);
      const paymentForm = res.data?.payment_form;

      if (!paymentForm?.action || !paymentForm?.fields) {
        throw new Error("Invalid payment response from server");
      }

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
    } catch (err) {
      window.alert(err.response?.data?.message || "Failed to initiate guide package payment.");
    } finally {
      setGuideBookingSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-full border-2 border-gold/20 border-t-gold animate-spin" />
            <Mountain className="absolute inset-0 m-auto h-5 w-5 text-gold" />
          </div>
          <p className="text-sm text-gray-400 font-medium tracking-wide">Loading trail...</p>
        </div>
      </div>
    );
  }

  if (!trail) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center gap-5">
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
          <Mountain className="h-8 w-8 text-gray-300" />
        </div>
        <h2 className="text-2xl font-bold text-charcoal">Trail Not Found</h2>
        <p className="text-gray-400 text-sm">This trail doesn't exist or has been removed.</p>
        <Link to="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-white rounded-xl text-sm font-semibold hover:bg-gold/90 transition">
          <ArrowLeft className="h-4 w-4" /> Back to Trails
        </Link>
      </div>
    );
  }

  const primaryImage = trail.images?.find((img) => img.is_primary);
  const heroImage = primaryImage
    ? `${API}${primaryImage.image_path}`
    : "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1400&q=85";
  const gpxUrl = trail.gpx_file_path ? `${API}${trail.gpx_file_path}` : "";

  const diff = difficultyConfig[trail.difficulty_level] || difficultyConfig["Moderate"];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f5f2eb] via-[#fbfaf7] to-[#f3f1ea]">
      <Header user={user} onLogoutClick={() => setShowLogoutModal(true)} />

      {/* ════════════════════════════════
          HERO — cinematic full-width
      ════════════════════════════════ */}
      <div className="relative h-[75vh] min-h-[580px] max-h-[760px] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
        {/* Hero image with parallax feel */}
        <img
          src={heroImage}
          alt={trail.trail_name}
          className="w-full h-full object-cover object-center scale-[1.03]"
          style={{ filter: "saturate(1.1)" }}
        />

        {/* Multi-layer gradient for depth */}
        <div className="absolute inset-0" style={{
          background: `
            linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.0) 55%),
            linear-gradient(to top, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.45) 30%, rgba(0,0,0,0.0) 65%)
          `
        }} />

        {/* Top nav */}
        <div className="absolute top-0 left-0 right-0 px-6 sm:px-10 pt-24">
          <div className="flex items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-black/25 backdrop-blur-md rounded-xl text-white/90 text-sm font-medium border border-white/15 hover:bg-black/40 hover:border-white/30 transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            All Trails
          </Link>

          {isTourist && (
            <WishlistToggleButton
              active={isWishlisted("trail", trail.trail_id)}
              loading={isUpdating("trail", trail.trail_id)}
              onClick={() => handleWishlistToggle("trail", trail.trail_id)}
              className="h-10 w-10 border-white/20 bg-black/25 text-white hover:bg-black/40"
            />
          )}
          </div>
        </div>

        {/* Hero content */}
        <div className="absolute bottom-0 left-0 right-0 px-6 sm:px-10 pb-14">
          <div className="max-w-6xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              {/* Difficulty badge */}
              <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border mb-5 ring-1 ${diff.badge} ${diff.glow} bg-white shadow-sm`}>
                <span className={`w-2 h-2 rounded-full ${diff.dot} shadow-sm`} />
                {trail.difficulty_level}
              </div>

              {/* Title */}
              <h1 className="text-4xl sm:text-5xl lg:text-[4rem] font-black text-white mb-8 font-heading leading-[1.05] tracking-tight drop-shadow-2xl max-w-4xl">
                {trail.trail_name}
              </h1>

              {/* Stats row */}
              <div className="flex flex-wrap gap-3">
                <StatPill icon={MapPin} label="Region" value={trail.region} iconClass="text-[#E0B04A]" />
                <StatPill icon={Calendar} label="Duration" value={`${trail.duration_days} ${trail.duration_days === 1 ? "Day" : "Days"}`} iconClass="text-blue-300" />
                {trail.max_altitude && (
                  <StatPill icon={Mountain} label="Max Altitude" value={`${Number(trail.max_altitude).toLocaleString()} m`} iconClass="text-violet-300" />
                )}
                {trail.images?.length > 0 && (
                  <StatPill icon={Camera} label="Photos" value={`${trail.images.length} photos`} iconClass="text-pink-300" />
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════
          STICKY TAB BAR
      ════════════════════════════════ */}
        <div
        ref={tabRef}
        className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100 shadow-[0_10px_30px_rgba(0,0,0,0.05)] supports-[backdrop-filter]:bg-white/60"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-8 lg:px-10">
          <div className="flex items-center gap-0 overflow-x-auto no-scrollbar">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative whitespace-nowrap px-5 py-4 text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
                  activeTab === tab
                    ? "text-charcoal"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {tab === "Homestays" && (
                  <span className={`w-1.5 h-1.5 rounded-full ${homestays.length > 0 ? "bg-emerald-400" : "bg-gray-300"}`} />
                )}
                {tab}
                {tab === "Homestays" && homestays.length > 0 && (
                  <span className="text-[10px] bg-gold/15 text-gold font-bold px-1.5 py-0.5 rounded-full">
                    {homestays.length}
                  </span>
                )}
                {tab === "Guides" && guideServices.length > 0 && (
                  <span className="text-[10px] bg-blue-500/15 text-blue-600 font-bold px-1.5 py-0.5 rounded-full">
                    {guideServices.length}
                  </span>
                )}
                {activeTab === tab && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ background: "linear-gradient(to right, #C8932A, #E0B04A)" }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════
          CONTENT AREA
      ════════════════════════════════ */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 lg:px-10 py-10">
        <div className="rounded-3xl border border-stone-200 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.06)] p-5 sm:p-7 lg:p-8">
        <AnimatePresence mode="wait">

          {/* ─── OVERVIEW TAB ─── */}
          {activeTab === "Overview" && (
            <motion.div
              key="overview"
              initial={tabMotion.initial}
              animate={tabMotion.animate}
              exit={tabMotion.exit}
              transition={tabMotion.transition}
            >
              <div className="grid lg:grid-cols-3 gap-8 xl:gap-12">

                {/* Left: About + Gallery */}
                <div className="lg:col-span-2 space-y-10">

                  {/* About */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-6 lg:p-7 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ background: "linear-gradient(to bottom, #C8932A, #E0B04A)" }} />
                      <h2 className="text-xl font-bold text-charcoal font-heading tracking-tight">About This Trek</h2>
                    </div>
                    <p className="text-gray-500 leading-[1.9] text-[15px] whitespace-pre-line">{trail.description}</p>
                  </div>

                  {/* Map */}
                  <div ref={mapSectionRef} className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ background: "linear-gradient(to bottom, #C8932A, #E0B04A)" }} />
                      <h2 className="text-xl font-bold text-charcoal font-heading tracking-tight">Map View</h2>
                    </div>
                    <TrailMap
                      trailName={trail.trail_name}
                      gpxUrl={gpxUrl}
                      gpxGeojson={trail.gpx_geojson}
                      homestays={homestays}
                      homestaysLoading={homestaysLoading}
                      selectedHomestayId={selectedHomestayId}
                      distanceThresholdKm={distanceThresholdKm}
                      onDistanceThresholdChange={setDistanceThresholdKm}
                      onHomestaySelect={handleMapHomestaySelect}
                      onNearTrailHomestaysChange={setNearTrailHomestayIds}
                      onHomestayDistanceMapChange={setHomestayDistanceMap}
                    />
                  </div>

                  {/* Photo Gallery */}
                  {trail.images?.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ background: "linear-gradient(to bottom, #C8932A, #E0B04A)" }} />
                          <h2 className="text-xl font-bold text-charcoal font-heading tracking-tight">Trail Gallery</h2>
                          <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                            {trail.images.length} photos
                          </span>
                        </div>
                        <p className="text-xs text-gray-300 hidden sm:block font-medium">Tap photos to open gallery</p>
                      </div>
                      <PhotoGallery images={trail.images} />
                    </div>
                  )}

                  <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
                    <div className="flex items-center justify-between mb-4 gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ background: "linear-gradient(to bottom, #1f7a8c, #4fa3b4)" }} />
                        <h2 className="text-xl font-bold text-charcoal font-heading tracking-tight">Trekker Community Gallery</h2>
                        <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                          {communitySubmissions.length} approved
                        </span>
                      </div>
                      <p className="hidden sm:block text-xs text-gray-400">Admin-verified tourist submissions</p>
                    </div>

                    {communityLoading ? (
                      <div className="py-12 flex items-center justify-center">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <div className="w-5 h-5 rounded-full border-2 border-teal-200 border-t-teal-500 animate-spin" />
                          Loading approved submissions...
                        </div>
                      </div>
                    ) : communityError ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {communityError}
                      </div>
                    ) : communitySubmissions.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
                        <p className="text-sm font-semibold text-gray-700">No approved community photos yet</p>
                        <p className="mt-1 text-xs text-gray-500">
                          Tourist submissions appear here after admin verification.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {communitySubmissions.map((submission) => {
                          const isExpanded = expandedCommunitySubmissionId === submission.submission_id;
                          const submissionImages = Array.isArray(submission.images) ? submission.images : [];
                          return (
                            <div
                              key={submission.submission_id}
                              className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedCommunitySubmissionId((prev) =>
                                    prev === submission.submission_id ? null : submission.submission_id
                                  )
                                }
                                className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-gray-50 transition-colors"
                              >
                                <div>
                                  <p className="text-sm font-bold text-charcoal">
                                    {submission.tourist_name || "Verified Trekker"}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    Trek date: {formatShortDate(submission.trek_date)} · Approved: {formatShortDate(submission.approved_at || submission.created_at)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-[11px] font-semibold px-2 py-1 rounded-full border border-teal-200 bg-teal-50 text-teal-700">
                                    {submissionImages.length} photo{submissionImages.length === 1 ? "" : "s"}
                                  </span>
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4 text-gray-500" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-gray-500" />
                                  )}
                                </div>
                              </button>

                              <AnimatePresence initial={false}>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.22 }}
                                    className="border-t border-gray-100"
                                  >
                                    <div className="px-4 py-4 space-y-3">
                                      {submission.caption && (
                                        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                                          {submission.caption}
                                        </p>
                                      )}
                                      {submissionImages.length > 0 && (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                          {submissionImages.map((image) => (
                                            <a
                                              key={image.image_id}
                                              href={`${API}${image.image_path}`}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="group relative block rounded-lg overflow-hidden border border-gray-200"
                                            >
                                              <img
                                                src={`${API}${image.image_path}`}
                                                alt="Tourist submitted trail"
                                                className="h-28 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                              />
                                            </a>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Share your trek moments</p>
                      {!user ? (
                        <p className="mt-2 text-sm text-amber-900">
                          <Link to="/login" className="font-semibold underline underline-offset-2">Log in as a tourist</Link> to submit your trail photos for admin verification.
                        </p>
                      ) : user.user_type !== "tourist" ? (
                        <p className="mt-2 text-sm text-amber-900">
                          Photo submissions are available for tourist accounts after completing a paid booking on this trail.
                        </p>
                      ) : (
                        <form onSubmit={handleSubmitCommunityPhotos} className="mt-3 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-amber-900 mb-1">Trek Date (Optional)</label>
                              <input
                                type="date"
                                value={communityTrekDate}
                                onChange={(e) => setCommunityTrekDate(e.target.value)}
                                className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-amber-900 mb-1">Photos (up to {MAX_COMMUNITY_UPLOAD_FILES})</label>
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleCommunityFileChange}
                                className="block w-full text-xs text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-amber-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-amber-900 hover:file:bg-amber-200"
                              />
                            </div>
                          </div>

                          {communityUploadFiles.length > 0 && (
                            <p className="text-xs text-amber-900">
                              Selected: {communityUploadFiles.length} file{communityUploadFiles.length === 1 ? "" : "s"}
                            </p>
                          )}

                          <div>
                            <label className="block text-xs font-semibold text-amber-900 mb-1">Caption (Optional)</label>
                            <textarea
                              rows={3}
                              value={communityCaption}
                              onChange={(e) => setCommunityCaption(e.target.value)}
                              placeholder="Describe the viewpoint, weather, or trail moment..."
                              className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
                            />
                          </div>

                          {communityNotice && (
                            <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${communityNotice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                              {communityNotice.message}
                            </div>
                          )}

                          <div className="flex justify-end">
                            <button
                              type="submit"
                              disabled={communitySubmitting}
                              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                            >
                              {communitySubmitting ? "Submitting..." : "Submit For Verification"}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Trek Details Card */}
                <div className="lg:col-span-1">
                  <div className="sticky top-24">
                    {/* Details card */}
                    <div className="bg-white rounded-[1.25rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow duration-300 overflow-hidden mb-5">
                      <div className="px-6 py-5 bg-gradient-to-b from-stone-50/80 to-white border-b border-gray-100/50">
                        <div className="flex items-center gap-3.5">
                          <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm border border-amber-100/50 bg-gradient-to-br from-[#fdfbf7] to-[#f9f3e5]">
                            <Compass className="h-5 w-5 text-gold" />
                          </div>
                          <div>
                            <h3 className="text-[17px] font-extrabold text-charcoal tracking-tight">Trek At A Glance</h3>
                            <p className="text-[12px] font-medium text-gray-400 mt-0.5">Key facts & details</p>
                          </div>
                        </div>
                      </div>

                      <div className="px-6 pb-2 divide-y divide-gray-50/80">
                        {[
                          { icon: MapPin, label: "Region", value: trail.region, color: "text-gold" },
                          { icon: Calendar, label: "Duration", value: `${trail.duration_days} Days`, color: "text-blue-400" },
                          ...(trail.max_altitude ? [{ icon: Mountain, label: "Max Altitude", value: `${Number(trail.max_altitude).toLocaleString()} m`, color: "text-violet-400" }] : []),
                          ...(trail.itineraries?.length > 0 ? [{ icon: Route, label: "Itinerary Days", value: `${trail.itineraries.length} stages`, color: "text-emerald-500" }] : []),
                        ].map(({ icon: Icon, label, value, color }) => (
                          <div key={label} className="flex items-center justify-between py-4 group">
                            <span className="flex items-center gap-3 text-[14px] text-gray-500 font-medium">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 group-hover:bg-white group-hover:shadow-sm transition-all border border-gray-100/50">
                                <Icon className={`h-4 w-4 ${color}`} />
                              </div>
                              {label}
                            </span>
                            <span className="text-[14px] font-bold text-charcoal text-right leading-tight max-w-[140px]">{value}</span>
                          </div>
                        ))}

                        {/* Difficulty with bar */}
                        <div className="py-4">
                          <div className="flex items-center justify-between mb-4 group">
                            <span className="flex items-center gap-3 text-[14px] text-gray-500 font-medium">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 group-hover:bg-white group-hover:shadow-sm transition-all border border-gray-100/50">
                                <TrendingUp className="h-4 w-4 text-orange-400" /> 
                              </div>
                              Difficulty
                            </span>
                            <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ring-1 ${diff.badge}`}>
                              {trail.difficulty_level}
                            </span>
                          </div>
                          <DifficultyBar level={trail.difficulty_level} />
                        </div>

                        {/* Homestays quick link */}
                        {!homestaysLoading && homestays.length > 0 && (
                          <div className="py-4">
                            <button
                              onClick={() => setActiveTab("Homestays")}
                              className="w-full flex items-center justify-between group"
                            >
                              <span className="flex items-center gap-3 text-[14px] text-gray-500 font-medium">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 group-hover:bg-white group-hover:shadow-sm transition-all border border-gray-100/50">
                                  <Home className="h-4 w-4 text-amber-500" />
                                </div>
                                Homestays
                              </span>
                              <span className="flex items-center gap-1.5 text-[13px] font-bold text-gold group-hover:gap-2 transition-all bg-amber-50/50 px-2.5 py-1.5 rounded-lg border border-amber-100/50">
                                {homestays.length} available
                                <ChevronRight className="h-3.5 w-3.5" />
                              </span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* GPX download */}
                      {trail.gpx_file_path && (
                        <div className="px-5 py-5 border-t border-gray-50 bg-stone-50/30">
                          <a
                            href={`${API}${trail.gpx_file_path}`}
                            download
                            title="Download trail route for offline navigation in Maps.me, OsmAnd, Gaia GPS, or Garmin devices"
                            className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-bold rounded-xl bg-gradient-to-br from-gold to-amber-500 text-white hover:from-gold/90 hover:to-amber-500/90 transition-all shadow-[0_4px_14px_rgba(224,176,74,0.3)] hover:shadow-[0_6px_20px_rgba(224,176,74,0.4)] group"
                          >
                            <Download className="h-4 w-4 group-hover:-translate-y-0.5 transition-transform" />
                            Download GPX File
                          </a>
                          <p className="text-[10px] text-center text-gray-400 mt-3 font-semibold uppercase tracking-wider">
                            For offline navigation – import into your GPS app
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Homestay teaser card */}
                    {!homestaysLoading && homestays.length > 0 && (
                      <button
                        onClick={() => setActiveTab("Homestays")}
                        className="w-full relative overflow-hidden bg-white border border-gray-100 rounded-[1.25rem] px-5 py-5 text-left hover:border-gold/30 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-300 group z-10"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-50 to-orange-50/30 rounded-full blur-2xl -mr-10 -mt-10 -z-10 transition-all group-hover:scale-125" />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-stone-50 to-amber-50 border border-amber-100/60 rounded-[0.85rem] flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                              <Tent className="h-5 w-5 text-gold" />
                            </div>
                            <div>
                              <p className="text-[16px] font-extrabold text-charcoal mb-0.5 tracking-tight">Where to Stay</p>
                              <p className="text-[12px] text-gray-500 font-medium">{homestays.length} homestays on this trail</p>
                            </div>
                          </div>
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-gold group-hover:text-white transition-colors text-gray-400 shadow-sm border border-gray-100">
                            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                          </div>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── ITINERARY TAB ─── */}
          {activeTab === "Itinerary" && (
            <motion.div
              key="itinerary"
              initial={tabMotion.initial}
              animate={tabMotion.animate}
              exit={tabMotion.exit}
              transition={tabMotion.transition}
            >
              {trail.itineraries?.length > 0 ? (
                <div className="max-w-5xl">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ background: "linear-gradient(to bottom, #C8932A, #E0B04A)" }} />
                    <h2 className="text-xl font-bold text-charcoal font-heading tracking-tight">Day-by-Day Itinerary</h2>
                    <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                      {trail.itineraries.length} stages
                    </span>
                  </div>

                  <div className="relative">
                    {/* Timeline spine */}
                    <div className="absolute left-[19px] top-5 bottom-10 w-px"
                      style={{ background: "linear-gradient(to bottom, #C8932A55, #E0B04A22, transparent)" }}
                    />
                    <div className="space-y-0">
                      {trail.itineraries.map((it, i) => (
                        <motion.div
                          key={it.itinerary_id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.07 }}
                          className="flex gap-5 pb-5 last:pb-0"
                        >
                          {/* Day bubble */}
                          <div className="relative flex-shrink-0 z-10">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-extrabold shadow-lg"
                              style={{ background: "linear-gradient(135deg, #C8932A, #E0B04A)" }}
                            >
                              {it.day_number}
                            </div>
                          </div>

                          {/* Content card */}
                          <div className="flex-1 bg-white rounded-2xl px-6 py-5 border border-gray-100 hover:border-gold/25 hover:shadow-md transition-all duration-200 mb-1">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="text-[10px] text-gold uppercase tracking-[0.15em] font-bold mb-1">Day {it.day_number}</p>
                                {it.title && (
                                  <h3 className="text-base font-bold text-charcoal leading-snug">{it.title}</h3>
                                )}
                              </div>
                            </div>
                            <p className="text-gray-500 text-sm leading-relaxed mt-2">{it.description}</p>

                            {(it.altitude || it.distance_km || it.walking_hours) && (
                              <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-50">
                                {it.altitude && (
                                  <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-violet-50 px-3 py-1.5 rounded-lg font-medium">
                                    <Mountain className="h-3.5 w-3.5 text-violet-400" />
                                    {Number(it.altitude).toLocaleString()} m
                                  </div>
                                )}
                                {it.distance_km && (
                                  <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-blue-50 px-3 py-1.5 rounded-lg font-medium">
                                    <Route className="h-3.5 w-3.5 text-blue-400" />
                                    {it.distance_km} km
                                  </div>
                                )}
                                {it.walking_hours && (
                                  <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-emerald-50 px-3 py-1.5 rounded-lg font-medium">
                                    <Timer className="h-3.5 w-3.5 text-emerald-400" />
                                    {it.walking_hours} hrs walking
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center py-20 gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <Route className="h-7 w-7 text-gray-300" />
                  </div>
                  <p className="text-gray-500 font-semibold">No itinerary added yet</p>
                  <p className="text-gray-400 text-sm text-center max-w-xs">
                    Day-by-day breakdown for this trail hasn't been published yet.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* ─── HOMESTAYS TAB ─── */}
          {activeTab === "Homestays" && (
            <motion.div
              key="homestays"
              initial={tabMotion.initial}
              animate={tabMotion.animate}
              exit={tabMotion.exit}
              transition={tabMotion.transition}
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ background: "linear-gradient(to bottom, #C8932A, #E0B04A)" }} />
                <h2 className="text-xl font-bold text-charcoal font-heading tracking-tight">Where to Stay</h2>
                {!homestaysLoading && homestays.length > 0 && (
                  <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                    {homestays.length} homestay{homestays.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {homestaysLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-full border-2 border-gold/20 border-t-gold animate-spin" />
                    <p className="text-sm text-gray-400">Finding homestays...</p>
                  </div>
                </div>
              ) : homestays.length === 0 ? (
                <div className="flex flex-col items-center py-20 gap-4 bg-white rounded-2xl border border-gray-100">
                  <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center">
                    <Tent className="h-7 w-7 text-amber-300" />
                  </div>
                  <p className="text-gray-600 font-bold">No homestays listed yet</p>
                  <p className="text-gray-400 text-sm text-center max-w-xs leading-relaxed">
                    Homestays for this trail will appear here once hosts list them and they're approved.
                  </p>
                </div>
              ) : (
                <>
                  {/* Filter/sort bar */}
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
                    <p className="text-sm text-gray-400">
                      Showing <span className="font-semibold text-charcoal">{visibleHomestays.length}</span>
                      {showOnlyNearTrail ? " near-trail " : " "}
                      places to stay
                    </p>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <div className="inline-flex items-center rounded-full border border-gray-200 bg-white p-1 shadow-sm">
                        <button
                          type="button"
                          onClick={() => setHomestayViewMode("grid")}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-full transition ${homestayViewMode === "grid" ? "bg-charcoal text-white" : "text-gray-500 hover:bg-gray-100"}`}
                        >
                          Grid View
                        </button>
                        <button
                          type="button"
                          onClick={() => setHomestayViewMode("split")}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-full transition ${homestayViewMode === "split" ? "bg-charcoal text-white" : "text-gray-500 hover:bg-gray-100"}`}
                        >
                          Split View
                        </button>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5">
                        <span className="font-semibold">Radius</span>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          step={1}
                          value={distanceThresholdKm}
                          onChange={(e) => setDistanceThresholdKm(Number(e.target.value))}
                          className="w-24 accent-emerald-500"
                        />
                        <span className="font-bold text-charcoal">{distanceThresholdKm} km</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowOnlyNearTrail((prev) => !prev)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                          showOnlyNearTrail
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        {showOnlyNearTrail ? "Showing Near Trail" : "Show Near Trail Only"}
                      </button>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        {nearTrailHomestayIds.length} near trail
                      </div>
                    </div>
                  </div>

                  {showOnlyNearTrail && visibleHomestays.length === 0 ? (
                    <div className="flex flex-col items-center py-12 gap-3 bg-white rounded-2xl border border-gray-100">
                      <p className="text-sm font-semibold text-gray-700">No homestays within near-trail range</p>
                      <p className="text-xs text-gray-400 text-center max-w-xs">
                        Try turning off the filter to see all approved homestays on this trail.
                      </p>
                    </div>
                  ) : homestayViewMode === "split" ? (
                    <div className="grid lg:grid-cols-[minmax(0,1fr)_330px] gap-6 items-start">
                      <div className="space-y-6 relative z-0">
                        <div className="relative z-0 rounded-2xl overflow-hidden">
                          <TrailMap
                            trailName={trail.trail_name}
                            gpxUrl={gpxUrl}
                            gpxGeojson={trail.gpx_geojson}
                            homestays={homestays}
                            homestaysLoading={homestaysLoading}
                            selectedHomestayId={selectedHomestayId}
                            distanceThresholdKm={distanceThresholdKm}
                            onDistanceThresholdChange={setDistanceThresholdKm}
                            onHomestaySelect={handleMapHomestaySelect}
                            onNearTrailHomestaysChange={setNearTrailHomestayIds}
                            onHomestayDistanceMapChange={setHomestayDistanceMap}
                          />
                        </div>

                        <div className="space-y-4 relative z-10 pt-1">
                          {visibleHomestays.map((h, i) => (
                            <HomestayCard
                              key={h.homestay_id}
                              homestay={h}
                              index={i}
                              layout="list"
                              isHighlighted={selectedHomestayId === h.homestay_id}
                              distanceKm={homestayDistanceMap[h.homestay_id]}
                              distanceThresholdKm={distanceThresholdKm}
                              onSelect={handleHomestayCardSelect}
                              showWishlist={isTourist}
                              wishlisted={isWishlisted("homestay", h.homestay_id)}
                              wishlistLoading={isUpdating("homestay", h.homestay_id)}
                              onToggleWishlist={() => handleWishlistToggle("homestay", h.homestay_id)}
                              cardRef={(el) => {
                                if (el) homestayCardRefs.current[h.homestay_id] = el;
                              }}
                            />
                          ))}
                        </div>
                      </div>

                      <aside className="hidden lg:block lg:sticky lg:top-24 bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
                        <h3 className="text-base font-bold text-charcoal mb-2">Stay Planner</h3>
                        <p className="text-xs text-gray-500 mb-4">Quick booking context for this trail.</p>
                        <div className="space-y-3">
                          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-emerald-700 font-semibold">Near Trail Stays</p>
                            <p className="text-2xl font-black text-emerald-700 mt-1">{nearTrailHomestayIds.length}</p>
                          </div>
                          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-amber-700 font-semibold">Visible Stays</p>
                            <p className="text-2xl font-black text-amber-700 mt-1">{visibleHomestays.length}</p>
                          </div>
                          <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-blue-700 font-semibold">Suggestion</p>
                            <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                              For easier logistics, prefer stays within {distanceThresholdKm} km of the route and complete all bookings through OffTrail checkout.
                            </p>
                          </div>
                          <div className="rounded-xl bg-stone-50 border border-stone-200 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-gray-600 font-semibold">Best For</p>
                            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                              Split view works best when you compare map position and amenities side-by-side.
                            </p>
                          </div>
                        </div>
                      </aside>
                    </div>
                  ) : (
                    <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                        {visibleHomestays.map((h, i) => (
                          <HomestayCard
                            key={h.homestay_id}
                            homestay={h}
                            index={i}
                            isHighlighted={selectedHomestayId === h.homestay_id}
                            distanceKm={homestayDistanceMap[h.homestay_id]}
                            distanceThresholdKm={distanceThresholdKm}
                            onSelect={handleHomestayCardSelect}
                            showWishlist={isTourist}
                            wishlisted={isWishlisted("homestay", h.homestay_id)}
                            wishlistLoading={isUpdating("homestay", h.homestay_id)}
                            onToggleWishlist={() => handleWishlistToggle("homestay", h.homestay_id)}
                            cardRef={(el) => {
                              if (el) homestayCardRefs.current[h.homestay_id] = el;
                            }}
                          />
                        ))}
                      </div>

                      <aside className="hidden lg:block lg:sticky lg:top-24 bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
                        <h3 className="text-base font-bold text-charcoal mb-2">Booking Rail</h3>
                        <p className="text-xs text-gray-500 mb-4">Use this rail while exploring stays.</p>
                        <div className="space-y-3">
                          <div className="rounded-xl bg-stone-50 border border-stone-200 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-gray-600 font-semibold">Current View</p>
                            <p className="text-sm font-bold text-charcoal mt-1">{homestayViewMode === "split" ? "Split View" : "Grid View"}</p>
                          </div>
                          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-emerald-700 font-semibold">Near Trail</p>
                            <p className="text-2xl font-black text-emerald-700 mt-1">{nearTrailHomestayIds.length}</p>
                          </div>
                          <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-indigo-700 font-semibold">Tip</p>
                            <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
                              Switch to Split View to coordinate map markers with stay cards and shortlist quickly.
                            </p>
                          </div>
                        </div>
                      </aside>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ─── GUIDES TAB ─── */}
          {activeTab === "Guides" && (
            <motion.div
              key="guides"
              initial={tabMotion.initial}
              animate={tabMotion.animate}
              exit={tabMotion.exit}
              transition={tabMotion.transition}
            >
              <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
                <div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ background: "linear-gradient(to bottom, #C8932A, #E0B04A)" }} />
                    <h2 className="text-xl font-bold text-charcoal font-heading tracking-tight">Available Guide Packages</h2>
                    {!guidesLoading && guideServices.length > 0 && (
                      <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                        {guideServices.length} package{guideServices.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {guidesLoading ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 rounded-full border-2 border-blue-200 border-t-blue-500 animate-spin" />
                        <p className="text-sm text-gray-400">Finding guide packages...</p>
                      </div>
                    </div>
                  ) : guideServices.length === 0 ? (
                    <div className="flex flex-col items-center py-10 gap-4 bg-white rounded-2xl border border-gray-100 mb-10">
                      <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
                         <Compass className="h-7 w-7 text-blue-300" />
                      </div>
                      <p className="text-gray-600 font-bold">No Service Packages</p>
                      <p className="text-gray-400 text-sm text-center max-w-xs leading-relaxed">
                        There are no specialized packages listed for this trail yet. Package checkout is required for booking and payment.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5 max-w-4xl mb-12">
                      {guideServices.map((service, i) => (
                        <GuideServiceCard
                          key={service.service_id}
                          service={service}
                          index={i}
                          user={user}
                          onBookPackage={handleOpenGuidePackageBooking}
                          showWishlist={isTourist}
                          wishlisted={isWishlisted("guide_package", service.service_id)}
                          wishlistLoading={isUpdating("guide_package", service.service_id)}
                          onToggleWishlist={() => handleWishlistToggle("guide_package", service.service_id)}
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* INDEPENDENT GUIDES SECTION */}
                  <div className="flex flex-wrap items-center gap-3 mb-6 pt-6 border-t border-gray-100">
                    <div className="w-1 h-4 rounded-full flex-shrink-0 bg-gray-300" />
                    <h3 className="text-lg font-bold text-gray-600 font-heading tracking-tight">Independent Base Guides</h3>
                    {!baseGuidesLoading && baseGuides.length > 0 && (
                      <span className="text-xs font-semibold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                        {baseGuides.length} guide{baseGuides.length !== 1 ? "s" : ""} available
                      </span>
                    )}
                  </div>
                  
                  {baseGuidesLoading ? (
                     <p className="text-sm text-gray-400 py-4">Loading base guides...</p>
                  ) : baseGuides.length === 0 ? (
                     <p className="text-sm text-gray-500 bg-gray-50 py-6 px-4 rounded-xl text-center border border-gray-100">
                        No independent guides are currently assigned to this trail.
                     </p>
                  ) : (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl">
                        {baseGuides.map((guide, i) => (
                        <BaseGuideCard
                          key={guide.id}
                          guide={guide}
                          index={i}
                          showWishlist={false}
                        />
                        ))}
                     </div>
                  )}
                </div>

                <aside className="hidden lg:block lg:sticky lg:top-24 bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
                  <h3 className="text-base font-bold text-charcoal mb-2">Guide Info Rail</h3>
                  <p className="text-xs text-gray-500 mb-4">Quick compare before booking.</p>

                  <div className="space-y-3">
                    <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-blue-700 font-semibold">Packages</p>
                      <p className="text-2xl font-black text-blue-700 mt-1">{guideServices.length}</p>
                    </div>
                    <div className="rounded-xl bg-violet-50 border border-violet-100 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-violet-700 font-semibold">Base Guides</p>
                      <p className="text-2xl font-black text-violet-700 mt-1">{baseGuides.length}</p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-emerald-700 font-semibold">Pro Tip</p>
                      <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                        Book and pay only through package cards to keep every transaction protected and trackable in OffTrail Nepal.
                      </p>
                    </div>
                  </div>
                </aside>
              </div>

            </motion.div>
          )}

        </AnimatePresence>
        </div>
      </div>

      <Footer />

      <LogoutModal
        isOpen={showLogoutModal}
        onConfirm={handleLogout}
        onCancel={handleStayLoggedIn}
      />

      <GuidePackageBookingModal
        service={selectedGuideService}
        isOpen={showGuideBookingModal}
        onClose={() => {
          if (guideBookingSubmitting) return;
          setShowGuideBookingModal(false);
          setSelectedGuideService(null);
        }}
        onSubmit={handleSubmitGuideBooking}
        submitting={guideBookingSubmitting}
        paymentMethod={guidePaymentMethod}
        setPaymentMethod={setGuidePaymentMethod}
      />
    </div>
  );
};

export default TrailDetail;