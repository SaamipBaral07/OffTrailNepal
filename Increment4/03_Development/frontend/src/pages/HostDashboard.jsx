import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../api";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import {
  LogOut,
  Home,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Phone,
  DollarSign,
  Users,
  Mountain,
  X,
  Upload,
  Loader2,
  Eye,
  EyeOff,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  BadgeCheck,
  Star,
  Wifi,
  ShowerHead,
  UtensilsCrossed,
  Car,
  Coffee,
  Tv,
  Snowflake,
  Shield,
  Mail,
  FileText,
  Key,
  UserCircle,
} from "lucide-react";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import LogoutModal from "../components/LogoutModal";
import { useAuth } from "../context/AuthContext";
import { getToken } from "../tokenStore";

const API = "http://localhost:5000/api";
const PLATFORM_COMMISSION_RATE = 0.1;
const HOST_PAYOUT_RATE = 1 - PLATFORM_COMMISSION_RATE;

const AMENITY_ICON_MAP = {
  wifi: Wifi,
  shower: ShowerHead,
  utensils: UtensilsCrossed,
  heater: Snowflake,
  mountain: Mountain,
  bathroom: Home,
  laundry: Shield,
  parking: Car,
  coffee: Coffee,
  charging: Key,
  tv: Tv,
};

const normalizeAmenityArray = (rawAmenities) => {
  if (Array.isArray(rawAmenities)) {
    return rawAmenities.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof rawAmenities === "string") {
    return rawAmenities
      .split(/,|\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const getHostBookingDisplayState = (booking) => {
  const directDisplay = String(booking?.host_display_status || "").trim().toLowerCase();
  const bookingStatus = String(booking?.status || "").trim().toLowerCase();
  const refundStatus = String(booking?.refund_status || "").trim().toLowerCase();
  const paymentStatus = String(booking?.payment_status || "").trim().toLowerCase();

  const normalizedStatus =
    directDisplay ||
    (bookingStatus === "cancelled"
      ? "cancelled"
      : bookingStatus === "refunded" || ["processed", "refunded"].includes(refundStatus) || paymentStatus === "refunded"
        ? "refunded"
        : bookingStatus === "refund_requested" || ["requested", "processing", "approved"].includes(refundStatus) || paymentStatus === "refund_requested"
          ? "refund_in_process"
          : "confirmed");

  const statusMap = {
    confirmed: {
      key: "confirmed",
      label: "Confirmed",
      icon: BadgeCheck,
      barClass: "bg-emerald-500",
      badgeClass: "bg-emerald-50 border-emerald-200 text-emerald-700",
    },
    cancelled: {
      key: "cancelled",
      label: "Cancelled",
      icon: XCircle,
      barClass: "bg-red-500",
      badgeClass: "bg-red-50 border-red-200 text-red-700",
    },
    refund_in_process: {
      key: "refund_in_process",
      label: "Refund In Process",
      icon: Clock,
      barClass: "bg-amber-500",
      badgeClass: "bg-amber-50 border-amber-200 text-amber-700",
    },
    refunded: {
      key: "refunded",
      label: "Refunded",
      icon: CheckCircle,
      barClass: "bg-sky-500",
      badgeClass: "bg-sky-50 border-sky-200 text-sky-700",
    },
  };

  return statusMap[normalizedStatus] || statusMap.confirmed;
};

const isHostEarningBooking = (booking) => {
  const bookingState = getHostBookingDisplayState(booking).key;
  const paymentStatus = String(booking?.payment_status || "").trim().toLowerCase();
  const refundStatus = String(booking?.refund_status || "").trim().toLowerCase();

  return (
    bookingState === "confirmed" &&
    paymentStatus === "success" &&
    !["requested", "processing", "approved", "processed", "refunded"].includes(refundStatus)
  );
};

const formatNprAmount = (amount) => {
  const normalized = Number.isFinite(amount) ? amount : 0;
  return `NPR ${normalized.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
};

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const toComparableDateKey = (dateValue) => {
  if (!dateValue) return null;
  const raw = String(dateValue).trim();
  if (!raw) return null;

  const datePrefixMatch = raw.match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/);
  if (datePrefixMatch) {
    return datePrefixMatch[1];
  }

  if (DATE_ONLY_RE.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
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

const hasHostBookingEnded = (booking, todayDateKey) => {
  const endDateKey = toComparableDateKey(booking?.check_out_date);
  return Boolean(endDateKey) && endDateKey < todayDateKey;
};

/* ─────────────────────────────────────────
   STATUS BADGE
───────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const normalized = status ? status.toLowerCase() : "pending";
  const config = {
    pending: {
      bg: "bg-amber-50 border-amber-200",
      text: "text-amber-700",
      icon: Clock,
      label: "Pending Review",
    },
    approved: {
      bg: "bg-emerald-50 border-emerald-200",
      text: "text-emerald-700",
      icon: CheckCircle,
      label: "Approved",
    },
    rejected: {
      bg: "bg-red-50 border-red-200",
      text: "text-red-700",
      icon: XCircle,
      label: "Rejected",
    },
  };

  const c = config[normalized] || config.pending;
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.text} backdrop-blur-sm shadow-sm`}>
      <Icon className="h-3.5 w-3.5" />
      <span className="tracking-wide uppercase">{c.label}</span>
    </span>
  );
};

/* ─────────────────────────────────────────
   STAT CARD (ANIMATED PREMIUM)
───────────────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, accent, delay }) => {
  const accents = {
    navy: "from-[#0A192F] to-[#112240]",
    gold: "from-[#D4AF37] to-[#F1D570]",
    alpine: "from-[#2C5234] to-[#3A6B44]",
    charcoal: "from-[#333333] to-[#4A4A4A]",
  };

  const iconColors = {
    navy: "text-[#0A192F] bg-[#0A192F]/10",
    gold: "text-[#D4AF37] bg-[#D4AF37]/10",
    alpine: "text-[#2C5234] bg-[#2C5234]/10",
    charcoal: "text-[#333333] bg-[#333333]/10",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
      className="relative bg-white rounded-2xl p-6 border border-gray-100 shadow-sm overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
    >
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br ${accents[accent]} opacity-5 group-hover:opacity-10 group-hover:scale-150 transition-all duration-700 ease-in-out`} />
      <div className="flex items-start justify-between relative z-10">
        <div>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: delay + 0.2, duration: 0.4 }}
            className={`inline-flex p-3 rounded-xl ${iconColors[accent]} mb-4 ring-1 ring-inset ring-current/10`}
          >
            <Icon className="h-6 w-6" />
          </motion.div>
          <p className="text-3xl font-bold text-gray-900 font-heading tracking-tight group-hover:text-[#0A192F] transition-colors">{value}</p>
          <p className="text-sm font-semibold text-gray-500 mt-1 tracking-wide uppercase">{label}</p>
        </div>
      </div>
    </motion.div>
  );
};

const isValidCoordinate = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

const LiveHomestayMapViewport = ({ latitude, longitude }) => {
  const map = useMap();

  useEffect(() => {
    map.flyTo([latitude, longitude], 11, {
      duration: 0.9,
      easeLinearity: 0.3,
    });
  }, [latitude, longitude, map]);

  return null;
};

/* ─────────────────────────────────────────
   CREATE / EDIT FORM
───────────────────────────────────────── */
const HomestayForm = ({ trails, amenityCatalog, amenityCatalogLoading, amenityCatalogError, onSubmit, onCancel, initialData, isSubmitting, onImagesChanged }) => {
  const [form, setForm] = useState({
    trail_id: initialData?.trail_id || "",
    name: initialData?.name || "",
    location: initialData?.location || "",
    price_per_night: initialData?.price_per_night || "",
    capacity: initialData?.capacity || "",
    description: initialData?.description || "",
    latitude: initialData?.latitude || "",
    longitude: initialData?.longitude || "",
    contact_phone: initialData?.contact_phone || "",
    total_rooms: initialData?.total_rooms || "1",
    available_rooms: initialData?.available_rooms ?? initialData?.total_rooms ?? "1",
    google_map_iframe_link: initialData?.google_map_iframe_link || "",
    property_ownership_type: initialData?.property_ownership_type || "owner",
  });
  const [selectedAmenities, setSelectedAmenities] = useState(normalizeAmenityArray(initialData?.amenities));
  const [images, setImages] = useState([]);
  const [registrationDoc, setRegistrationDoc] = useState(null);
  const [ownershipDoc, setOwnershipDoc] = useState(null);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [existingImages, setExistingImages] = useState(initialData?.images || []);
  const [replaceExistingImages, setReplaceExistingImages] = useState(false);
  const [imageActionLoading, setImageActionLoading] = useState(false);
  const [showLocationDetails, setShowLocationDetails] = useState(true);
  const parsedLatitude = form.latitude === "" ? Number.NaN : Number(form.latitude);
  const parsedLongitude = form.longitude === "" ? Number.NaN : Number(form.longitude);
  const hasCoordinatePair = form.latitude !== "" && form.longitude !== "";
  const hasValidCoordinates = isValidCoordinate(parsedLatitude, parsedLongitude);
  const selectedTrail = trails.find((trail) => String(trail.trail_id) === String(form.trail_id));
  const redPinMarkerIcon = useMemo(
    () => {
      const markerSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="34" height="46" viewBox="0 0 34 46" fill="none">
          <path d="M17 1.8C8.86 1.8 2.2 8.46 2.2 16.6C2.2 27.14 15.07 41.34 16.56 42.96C16.81 43.24 17.19 43.24 17.44 42.96C18.93 41.34 31.8 27.14 31.8 16.6C31.8 8.46 25.14 1.8 17 1.8Z" fill="#E53935" stroke="#B71C1C" stroke-width="2"/>
          <circle cx="17" cy="16.6" r="6.2" fill="white"/>
          <circle cx="17" cy="16.6" r="2.8" fill="#E53935"/>
        </svg>
      `;

      return L.icon({
        iconUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markerSvg.trim())}`,
        iconSize: [34, 46],
        iconAnchor: [17, 44],
        popupAnchor: [0, -38],
      });
    },
    []
  );

  useEffect(() => {
    setExistingImages(initialData?.images || []);
    setReplaceExistingImages(false);
    setShowLocationDetails(true);
    setSelectedAmenities(normalizeAmenityArray(initialData?.amenities));
  }, [initialData]);

  useEffect(() => {
    if (hasValidCoordinates) {
      setShowLocationDetails(true);
    }
  }, [hasValidCoordinates, parsedLatitude, parsedLongitude]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setImages(files);
    const previews = files.map((f) => URL.createObjectURL(f));
    setImagePreviews(previews);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!initialData && !registrationDoc) {
      window.alert("Please upload the homestay registration certificate.");
      return;
    }

    if (!initialData && !ownershipDoc) {
      window.alert("Please upload the property ownership document or rental agreement.");
      return;
    }

    const formData = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value !== "" && value !== null && value !== undefined) {
        formData.append(key, value);
      }
    });
    formData.append("amenities", selectedAmenities.join(", "));
    if (registrationDoc) {
      formData.append("homestay_registration_certificate", registrationDoc);
    }
    if (ownershipDoc) {
      formData.append("property_ownership_document", ownershipDoc);
    }
    if (initialData) {
      formData.append("replace_existing_images", replaceExistingImages ? "true" : "false");
    }
    images.forEach((img) => formData.append("images", img));
    onSubmit(formData);
  };

  const handleDeleteExistingImage = async (imageId) => {
    if (!initialData?.homestay_id || imageActionLoading) return;
    setImageActionLoading(true);
    try {
      await api.delete(`${API}/homestays/${initialData.homestay_id}/images/${imageId}`);
      setExistingImages((prev) => prev.filter((img) => img.image_id !== imageId));
      if (typeof onImagesChanged === "function") onImagesChanged();
    } catch (err) {
      console.error("Error deleting image:", err);
      window.alert(err.response?.data?.message || "Failed to delete image");
    } finally {
      setImageActionLoading(false);
    }
  };

  const handleSetPrimaryImage = async (imageId) => {
    if (!initialData?.homestay_id || imageActionLoading) return;
    setImageActionLoading(true);
    try {
      await api.patch(`${API}/homestays/${initialData.homestay_id}/images/${imageId}/primary`, {});
      setExistingImages((prev) =>
        prev.map((img) => ({ ...img, is_primary: img.image_id === imageId }))
      );
      if (typeof onImagesChanged === "function") onImagesChanged();
    } catch (err) {
      console.error("Error setting primary image:", err);
      const message =
        err.response?.data?.message ||
        (typeof err.response?.data === "string" ? err.response.data : null) ||
        err.message ||
        "Failed to set primary image";
      window.alert(message);
    } finally {
      setImageActionLoading(false);
    }
  };

  const handleAmenityToggle = (amenityLabel) => {
    setSelectedAmenities((prev) => {
      if (prev.includes(amenityLabel)) {
        return prev.filter((item) => item !== amenityLabel);
      }
      return [...prev, amenityLabel];
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-xl font-bold text-gray-900">
            {initialData ? "Edit Homestay" : "Create New Homestay"}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Trail Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Trail <span className="text-red-500">*</span>
            </label>
            <select
              name="trail_id"
              value={form.trail_id}
              onChange={handleChange}
              required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 transition-colors"
            >
              <option value="">Select a trail...</option>
              {trails.map((trail) => (
                <option key={trail.trail_id} value={trail.trail_id}>
                  {trail.trail_name} — {trail.region} ({trail.difficulty_level})
                </option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Homestay Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              maxLength={120}
              placeholder="e.g. Mountain View Homestay"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Location <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="location"
              value={form.location}
              onChange={handleChange}
              required
              maxLength={150}
              placeholder="e.g. Ghandruk Village, Kaski"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
            />
          </div>

          {/* Price & Capacity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Price / Night (NPR) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="price_per_night"
                value={form.price_per_night}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                placeholder="1500"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Capacity (guests) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="capacity"
                value={form.capacity}
                onChange={handleChange}
                required
                min="1"
                placeholder="6"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
              />
            </div>
          </div>

          {/* Room Inventory */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Total Rooms <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="total_rooms"
                value={form.total_rooms}
                onChange={handleChange}
                required
                min="1"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Available Rooms <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="available_rooms"
                value={form.available_rooms}
                onChange={handleChange}
                required
                min="0"
                max={form.total_rooms || undefined}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Property Ownership Type <span className="text-red-500">*</span>
            </label>
            <select
              name="property_ownership_type"
              value={form.property_ownership_type}
              onChange={handleChange}
              required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 transition-colors"
            >
              <option value="owner">I am the owner</option>
              <option value="rental">I am renting this property</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Homestay Registration Certificate <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setRegistrationDoc(e.target.files?.[0] || null)}
                required={!initialData}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
              />
              {initialData?.homestay_registration_certificate_doc_path && (
                <a
                  href={`http://localhost:5000${initialData.homestay_registration_certificate_doc_path}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex mt-2 text-xs text-blue-700 hover:underline"
                >
                  View current certificate
                </a>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {form.property_ownership_type === "rental"
                  ? "Rental Agreement"
                  : "Property Ownership Document"} <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setOwnershipDoc(e.target.files?.[0] || null)}
                required={!initialData}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
              />
              {initialData?.property_ownership_doc_path && (
                <a
                  href={`http://localhost:5000${initialData.property_ownership_doc_path}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex mt-2 text-xs text-blue-700 hover:underline"
                >
                  View current ownership/rental document
                </a>
              )}
            </div>
          </div>

          {/* Amenities */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Amenities Provided
            </label>
            {amenityCatalogLoading ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                Amenity catalog is loading. Please wait a moment.
              </div>
            ) : amenityCatalogError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {amenityCatalogError}
              </div>
            ) : amenityCatalog?.length ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {amenityCatalog.map((amenity) => {
                    const Icon = AMENITY_ICON_MAP[amenity.icon_key] || Star;
                    const isActive = selectedAmenities.includes(amenity.label);

                    return (
                      <button
                        key={amenity.key}
                        type="button"
                        onClick={() => handleAmenityToggle(amenity.label)}
                        className={`relative h-24 rounded-2xl border transition-all duration-200 flex flex-col items-center justify-center gap-2 ${
                          isActive
                            ? "border-gold bg-gradient-to-br from-gold-pale to-amber-50 text-gold-dark shadow-md"
                            : "border-gray-200 bg-white text-gray-600 hover:border-gold/60 hover:shadow-sm"
                        }`}
                      >
                        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${isActive ? "bg-white/80" : "bg-gray-50"}`}>
                          <Icon className="h-4.5 w-4.5" />
                        </span>
                        <span className="text-[11px] font-semibold text-center leading-tight px-1">{amenity.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Click to select amenities. Selected: <span className="font-semibold text-navy">{selectedAmenities.length}</span>
                </p>
              </>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                No amenities available right now.
              </div>
            )}
          </div>

          {/* Google map iframe link */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Google Maps Embed Link / iframe
            </label>
            <input
              type="text"
              name="google_map_iframe_link"
              value={form.google_map_iframe_link}
              onChange={handleChange}
              placeholder="https://www.google.com/maps/embed?... or full iframe code"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
            />
          </div>

          {/* Contact Phone */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Contact Phone
            </label>
            <input
              type="text"
              name="contact_phone"
              value={form.contact_phone}
              onChange={handleChange}
              maxLength={20}
              placeholder="+977-98XXXXXXXX"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
            />
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Latitude
              </label>
              <input
                type="number"
                name="latitude"
                value={form.latitude}
                onChange={handleChange}
                step="0.00000001"
                placeholder="28.37190000"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Longitude
              </label>
              <input
                type="number"
                name="longitude"
                value={form.longitude}
                onChange={handleChange}
                step="0.00000001"
                placeholder="83.80210000"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
              />
            </div>
          </div>

          <AnimatePresence initial={false}>
            {hasCoordinatePair && (
              <motion.div
                initial={{ opacity: 0, y: 12, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: 8, height: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-sky-50 to-blue-50 shadow-sm">
                  <div className="px-4 py-3 border-b border-blue-100/70">
                    <p className="text-sm font-bold text-navy">Location Preview</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {hasValidCoordinates
                        ? "Map pin updated using entered coordinates."
                        : "Enter valid coordinates to preview this location on map."}
                    </p>
                  </div>

                  {hasValidCoordinates ? (
                    <div className="relative h-[26rem]">
                      <MapContainer
                        center={[parsedLatitude, parsedLongitude]}
                        zoom={11}
                        scrollWheelZoom={false}
                        className="h-full w-full"
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <LiveHomestayMapViewport
                          latitude={parsedLatitude}
                          longitude={parsedLongitude}
                        />
                        <Marker
                          position={[parsedLatitude, parsedLongitude]}
                          icon={redPinMarkerIcon}
                          eventHandlers={{
                            click: () => setShowLocationDetails(true),
                          }}
                        />
                      </MapContainer>

                      <AnimatePresence initial={false}>
                        {showLocationDetails ? (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            transition={{ duration: 0.2 }}
                            style={{ zIndex: 650 }}
                            className="absolute top-3 right-3 w-[min(17rem,calc(100%-1.5rem))] bg-white/95 backdrop-blur rounded-xl border border-gray-200 shadow-xl p-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-[11px] uppercase tracking-[0.12em] font-bold text-gray-500">Marked Location</p>
                                <p className="text-[1.05rem] font-bold text-gray-900 mt-0.5 leading-tight">
                                  {form.name || "ABC Homevasio"}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowLocationDetails(false)}
                                className="p-1 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                                aria-label="Close location details"
                                title="Close details"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="mt-1.5 space-y-1 text-[0.92rem]">
                              <p className="text-gray-700 leading-snug">
                                <span className="font-semibold">Trail:</span>{" "}
                                {selectedTrail?.trail_name || "Kori Himal Trek"}
                              </p>
                              <p className="text-gray-700 leading-snug">
                                {form.location || "ABC Base camp"}
                              </p>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.button
                            type="button"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            transition={{ duration: 0.2 }}
                            style={{ zIndex: 650 }}
                            onClick={() => setShowLocationDetails(true)}
                            className="absolute top-3 right-3 px-3 py-1.5 rounded-lg text-xs font-semibold text-navy bg-white/95 border border-gray-200 shadow-md hover:bg-white"
                          >
                            Show details
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <div className="px-4 py-4 text-xs font-medium text-amber-700 bg-amber-50 border-t border-amber-100">
                      Coordinates must be within valid ranges: latitude between -90 and 90, longitude between -180 and 180.
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Description
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
              placeholder="Describe your homestay — amenities, views, meals included, etc."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 resize-none"
            />
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Photos {!initialData && "(first image will be primary)"}
            </label>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
              <Upload className="h-8 w-8 text-gray-400 mb-2" />
              <span className="text-sm text-gray-500">Click to upload images (max 5)</span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
            {imagePreviews.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {imagePreviews.map((preview, i) => (
                  <div key={i} className="relative">
                    <img
                      src={preview}
                      alt={`Preview ${i + 1}`}
                      className="h-20 w-20 object-cover rounded-lg border"
                    />
                    {i === 0 && !initialData && (
                      <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                        Primary
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {initialData && (
              <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={replaceExistingImages}
                  onChange={(e) => setReplaceExistingImages(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Replace all current photos with newly uploaded ones
              </label>
            )}
          </div>

          {/* Existing images (edit mode) */}
          {initialData && existingImages.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Current Photos
              </label>
              <div className="flex gap-2 flex-wrap">
                {existingImages.map((img) => (
                  <div key={img.image_id} className="relative space-y-1">
                    <img
                      src={`http://localhost:5000${img.image_path}`}
                      alt="Homestay"
                      className="h-20 w-20 object-cover rounded-lg border"
                    />
                    {img.is_primary && (
                      <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full inline-flex items-center gap-1">
                        <Star className="h-2.5 w-2.5" />
                        Primary
                      </span>
                    )}
                    <div className="flex gap-1">
                      {!img.is_primary && (
                        <button
                          type="button"
                          onClick={() => handleSetPrimaryImage(img.image_id)}
                          disabled={imageActionLoading}
                          className="text-[10px] px-1.5 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-60"
                        >
                          Set Primary
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteExistingImage(img.image_id)}
                        disabled={imageActionLoading}
                        className="text-[10px] px-1.5 py-1 rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Tip: Use "Set Primary" to choose cover photo, or remove old photos and upload new ones.
              </p>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-semibold transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {initialData ? "Updating..." : "Creating..."}
                </>
              ) : initialData ? (
                "Update Homestay"
              ) : (
                "Create Homestay"
              )}
            </button>
          </div>

          {!initialData && (
            <p className="text-xs text-gray-400 text-center">
              Your listing will be sent to admin for approval before it goes live.
            </p>
          )}
          {initialData && (
            <p className="text-xs text-amber-500 text-center">
              Editing will reset your listing status to "Pending Review".
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   DELETE CONFIRMATION MODAL
───────────────────────────────────────── */
const DeleteModal = ({ homestayName, onConfirm, onCancel, isDeleting }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 bg-red-100 rounded-xl">
          <Trash2 className="h-6 w-6 text-red-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Delete Homestay</h3>
          <p className="text-sm text-gray-500">This action cannot be undone</p>
        </div>
      </div>
      <p className="text-gray-600 mb-6">
        Are you sure you want to delete <strong>"{homestayName}"</strong>? All associated images
        and data will be permanently removed.
      </p>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isDeleting}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl font-semibold transition-colors"
        >
          {isDeleting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Deleting...
            </>
          ) : (
            "Delete"
          )}
        </button>
      </div>
    </div>
  </div>
);

/* ─────────────────────────────────────────
   HOMESTAY CARD
───────────────────────────────────────── */
const HomestayCard = ({ homestay, onEdit, onDelete, onToggleActive, onUpdateRooms, expanded, onToggleExpand }) => {
  const primaryImage = homestay.images?.find((img) => img.is_primary);
  const hasImages = homestay.images && homestay.images.length > 0;
  const [availableRoomsInput, setAvailableRoomsInput] = useState(String(homestay.available_rooms ?? 0));
  const [totalRoomsInput, setTotalRoomsInput] = useState(String(homestay.total_rooms ?? 1));

  useEffect(() => {
    setAvailableRoomsInput(String(homestay.available_rooms ?? 0));
    setTotalRoomsInput(String(homestay.total_rooms ?? 1));
  }, [homestay.available_rooms, homestay.total_rooms]);

  return (
    <div className="flex flex-col bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-2xl hover:shadow-navy/10 transition-all duration-500 group transform hover:-translate-y-1">
      {/* ── Visual Header ── */}
      <div className="relative h-[260px] w-full overflow-hidden bg-[#0A192F]">
        {hasImages ? (
          <img
            src={`http://localhost:5000${primaryImage?.image_path || homestay.images[0].image_path}`}
            alt={homestay.name}
            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-90 group-hover:opacity-100"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-navy/5">
            <Home className="h-20 w-20 text-navy/20" />
          </div>
        )}
        
        {/* Gradient Overlay for Text Visibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A192F]/95 via-[#0A192F]/20 to-transparent"></div>

        {/* Floating Top Elements */}
        <div className="absolute top-4 left-4 flex gap-2">
          <StatusBadge status={homestay.verified_status} />
        </div>
        {!homestay.is_active && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-red-600/90 backdrop-blur text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest shadow-lg">
            <EyeOff className="w-3 h-3" /> Hidden
          </div>
        )}

        {/* Overlay Details */}
        <div className="absolute bottom-4 left-4 right-4">
          <h3 className="text-2xl font-bold font-heading text-white leading-tight truncate mb-1">
            {homestay.name}
          </h3>
          <div className="flex items-center gap-2 text-sm text-white/80 font-medium">
            <MapPin className="h-4 w-4 text-gold shrink-0" />
            <span className="truncate">{homestay.location}</span>
          </div>
        </div>
      </div>

      {/* ── Content Body ── */}
      <div className="flex-1 flex flex-col">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-50 bg-gray-50/30">
          <div className="px-3 py-4 text-center">
            <p className="text-[9px] uppercase font-bold text-gray-400 tracking-widest mb-1.5 flex items-center justify-center gap-1">
              <DollarSign className="w-3 h-3" /> Per Night
            </p>
            <p className="font-bold text-gray-900 text-sm">NPR {Number(homestay.price_per_night).toLocaleString()}</p>
          </div>
          <div className="px-3 py-4 text-center">
            <p className="text-[9px] uppercase font-bold text-gray-400 tracking-widest mb-1.5 flex items-center justify-center gap-1">
              <Users className="w-3 h-3" /> Capacity
            </p>
            <p className="font-bold text-gray-900 text-sm">{homestay.capacity} Pax</p>
          </div>
          <div className="px-3 py-4 text-center">
            <p className="text-[9px] uppercase font-bold text-gray-400 tracking-widest mb-1.5 flex items-center justify-center gap-1">
              <Home className="w-3 h-3 text-gold" /> Rooms
            </p>
            <p className={`font-bold text-sm ${Number(homestay.available_rooms) > 0 ? "text-emerald-600" : "text-red-500"}`}>
              {homestay.available_rooms ?? 0} / {homestay.total_rooms ?? 0}
            </p>
          </div>
        </div>

        {/* Trail Affiliation & Expander */}
        <div className="px-5 pt-4 pb-1">
          <div className="flex items-center justify-between mb-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-navy/5 text-navy border border-navy/10 rounded-xl text-[11px] font-bold tracking-wide max-w-[65%]">
              <Mountain className="h-3.5 w-3.5 text-gold shrink-0" />
              <span className="truncate">{homestay.trail_name}</span>
            </div>
            
            <button 
              onClick={() => onToggleExpand(homestay.homestay_id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-navy bg-white border border-gray-200 hover:border-navy hover:bg-navy/5 rounded-xl transition-colors shrink-0"
            >
              {expanded ? "Less" : "More"}
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          {/* Expanded Details Section */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-5 mt-4 border-t border-gray-100 space-y-6">
                  
                  {/* About Block */}
                  {homestay.description && (
                    <div>
                      <h4 className="text-xs font-bold text-navy mb-2 flex items-center gap-2">
                         Description
                      </h4>
                      <p className="text-sm text-gray-600 leading-relaxed font-medium bg-[#FDFBF7] p-4 rounded-2xl border border-gold/10">
                        {homestay.description}
                      </p>
                    </div>
                  )}

                  {homestay.verified_status === "rejected" && homestay.rejection_reason && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                      <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">Rejection Reason</p>
                      <p className="text-sm font-medium text-red-700">{homestay.rejection_reason}</p>
                    </div>
                  )}
                  
                  {/* Visual Tags */}
                  {Array.isArray(homestay.amenities) && homestay.amenities.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-navy mb-2 flex items-center gap-2">
                         Amenities
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {homestay.amenities.map((a, idx) => (
                          <span key={`${a}-${idx}`} className="text-[11px] px-3 py-1 font-bold rounded-lg bg-white border border-gray-200 text-gray-600 shadow-sm">
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Connect Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {homestay.contact_phone && (
                      <div className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl">
                        <div className="p-2 bg-navy/5 text-navy rounded-lg">
                          <Phone className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone</p>
                          <p className="text-sm font-bold text-gray-900">{homestay.contact_phone}</p>
                        </div>
                      </div>
                    )}

                    {homestay.google_map_iframe_link && (
                      <div className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl">
                        <div className="p-2 bg-gold/10 text-gold-dark rounded-lg">
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Maps</p>
                          <a href={homestay.google_map_iframe_link} target="_blank" rel="noreferrer" className="text-sm font-bold text-gold-dark hover:underline">
                            View Pin
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Inventory Management Block */}
                  <div className="bg-navy rounded-2xl p-5 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl transform translate-x-10 -translate-y-10" />
                    <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2 relative z-10">
                       Room Inventory Matrix
                    </h4>
                    <form
                      className="flex flex-col sm:flex-row items-end gap-3 relative z-10"
                      onSubmit={(e) => {
                        e.preventDefault();
                        onUpdateRooms(homestay.homestay_id, totalRoomsInput, availableRoomsInput);
                      }}
                    >
                      <div className="flex-1 w-full">
                        <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1.5 ml-1">Total Limit</label>
                        <input
                          type="number" min="1" value={totalRoomsInput}
                          onChange={(e) => setTotalRoomsInput(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white/10 border border-white/10 text-white rounded-xl text-sm font-bold focus:border-gold focus:ring-1 focus:ring-gold transition-all"
                        />
                      </div>
                      <div className="flex-1 w-full">
                        <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1.5 ml-1">Available Now</label>
                        <input
                          type="number" min="0" max={totalRoomsInput || homestay.total_rooms || 0}
                          value={availableRoomsInput}
                          onChange={(e) => setAvailableRoomsInput(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white/10 border border-white/10 text-emerald-400 rounded-xl text-sm font-bold focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
                        />
                      </div>
                      <button type="submit" className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold rounded-xl bg-gold text-navy hover:bg-gold-light shadow-md transition-colors whitespace-nowrap">
                        Push Stats
                      </button>
                    </form>
                  </div>

                  {/* All images */}
                  {hasImages && homestay.images.length > 1 && (
                    <div>
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                        Gallery ({homestay.images.length} Photos)
                      </h4>
                      <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
                        {homestay.images.map((img) => (
                          <img
                            key={img.image_id}
                            src={`http://localhost:5000${img.image_path}`}
                            alt="Gallery item"
                            className="h-20 w-32 object-cover rounded-xl shadow-sm border border-gray-200 shrink-0 snap-start"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Professional Action Footer ── */}
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3 mt-auto">
          <button
            onClick={() => onToggleActive(homestay.homestay_id)}
            className="flex items-center justify-center w-10 h-10 rounded-full transition-all bg-white border border-gray-200 hover:border-gray-300 shadow-sm text-gray-500 hover:text-navy"
            title={homestay.is_active ? "Mark as Hidden" : "Mark as Active"}
          >
            {homestay.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-emerald-600" />}
          </button>
          
          <button
            onClick={() => onEdit(homestay)}
            className="flex items-center justify-center w-10 h-10 rounded-full transition-all bg-white border border-gray-200 hover:border-blue-200 shadow-sm text-gray-500 hover:text-blue-600"
            title="Edit Property"
          >
            <Pencil className="h-4 w-4" />
          </button>

          <button
            onClick={() => onDelete(homestay)}
            className="flex items-center justify-center w-10 h-10 rounded-full transition-all bg-red-50 border border-red-100 hover:border-red-300 shadow-sm text-red-500 hover:text-red-700 hover:bg-red-100"
            title="Delete Property"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   HOST DASHBOARD
───────────────────────────────────────── */
const HostDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { handleLogout, handleStayLoggedIn, showLogoutModal, setShowLogoutModal } =
    useLogoutHandler();
  const { user: authUser, loading } = useAuth();

  const [homestays, setHomestays] = useState([]);
  const [trails, setTrails] = useState([]);
  const [homestaysLoading, setHomestaysLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingHomestay, setEditingHomestay] = useState(null);
  const [deletingHomestay, setDeletingHomestay] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);
  const [amenityCatalog, setAmenityCatalog] = useState([]);
  const [amenityCatalogLoading, setAmenityCatalogLoading] = useState(false);
  const [amenityCatalogError, setAmenityCatalogError] = useState("");

  const profileImageUrl = user?.profile_image_path
    ? (String(user.profile_image_path).startsWith("http")
      ? user.profile_image_path
      : `http://localhost:5000${user.profile_image_path}`)
    : "";
  const [notification, setNotification] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [hostVerification, setHostVerification] = useState(undefined);
  const [hostVerificationSubmitting, setHostVerificationSubmitting] = useState(false);
  const [hostCitizenshipFile, setHostCitizenshipFile] = useState(null);

  const hostVerificationStatus = hostVerification?.verification_status || "not_submitted";
  const isHostVerified = hostVerificationStatus === "approved";
  const isHostVerificationPending = hostVerificationStatus === "pending";
  const isHostVerificationRejected = hostVerificationStatus === "rejected";
  const todayDateKey = getTodayDateKey();

  const currentHostBookings = useMemo(
    () => bookings.filter((booking) => !hasHostBookingEnded(booking, todayDateKey)),
    [bookings, todayDateKey]
  );

  const hostHistoryBookings = useMemo(
    () => bookings.filter((booking) => hasHostBookingEnded(booking, todayDateKey)),
    [bookings, todayDateKey]
  );

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Auth check
  useEffect(() => {
    if (loading) return;
    if (!getToken() || !authUser) { navigate("/login", { replace: true }); return; }
    if (authUser.user_type !== "host") { navigate("/login", { replace: true }); return; }
    setUser(authUser);
    setIsLoading(false);
  }, [loading, navigate, authUser]);

  // Show notification
  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Fetch homestays
  const fetchHomestays = useCallback(async (isPolling = false) => {
    if (!isPolling) setHomestaysLoading(true);
    try {
      const res = await api.get(`${API}/homestays/my`);
      setHomestays(res.data.homestays);
    } catch (err) {
      console.error("Error fetching homestays:", err);
      if (!isPolling) showNotification("Failed to load homestays", "error");
    } finally {
      if (!isPolling) setHomestaysLoading(false);
    }
  }, []);

  const fetchHostBookings = useCallback(async (isPolling = false) => {
    if (!isPolling) setBookingsLoading(true);
    try {
      const res = await api.get(`/api/bookings/host`);
      setBookings(res.data.bookings || []);
    } catch (err) {
      console.error("Error fetching host bookings:", err);
      if (!isPolling) showNotification("Failed to load bookings", "error");
    } finally {
      if (!isPolling) setBookingsLoading(false);
    }
  }, []);

  const fetchHostVerification = useCallback(async () => {
    try {
      const res = await api.get(`${API}/homestays/host/verification-status`);
      setHostVerification(res.data?.verification || null);
    } catch (err) {
      console.error("Error fetching host verification:", err);
    }
  }, []);

  const handleHostVerificationSubmit = async (e) => {
    e.preventDefault();
    if (!hostCitizenshipFile && !hostVerification?.citizenship_doc_path) {
      showNotification("Please upload your citizenship document.", "error");
      return;
    }

    setHostVerificationSubmitting(true);
    try {
      const formData = new FormData();
      if (hostCitizenshipFile) {
        formData.append("citizenship_image", hostCitizenshipFile);
      }

      await api.post(`${API}/homestays/host/verification-docs`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setHostCitizenshipFile(null);
      await fetchHostVerification();
      showNotification("Citizenship document submitted for admin review.");
    } catch (err) {
      console.error("Error submitting host verification:", err);
      showNotification(err.response?.data?.message || "Failed to submit verification document", "error");
    } finally {
      setHostVerificationSubmitting(false);
    }
  };

  useEffect(() => {
    if (isLoading || !user) return;
    const interval = setInterval(() => {
      fetchHomestays(true);
      fetchHostBookings(true);
      fetchHostVerification();
    }, 15000);
    return () => clearInterval(interval);
  }, [isLoading, user, fetchHomestays, fetchHostBookings, fetchHostVerification]);

  // Fetch trails for dropdown
  const fetchTrails = useCallback(async () => {
    try {
      const res = await api.get(`${API}/homestays/trails`);
      setTrails(res.data.trails);
    } catch (err) {
      console.error("Error fetching trails:", err);
    }
  }, []);

  const fetchAmenityCatalog = useCallback(async () => {
    setAmenityCatalogLoading(true);
    setAmenityCatalogError("");
    try {
      const res = await api.get(`${API}/homestays/amenities`);
      setAmenityCatalog(Array.isArray(res.data?.amenities) ? res.data.amenities : []);
    } catch (err) {
      console.error("Error fetching amenity catalog:", err);
      setAmenityCatalog([]);
      setAmenityCatalogError("Could not load amenities from server. Please refresh and try again.");
    } finally {
      setAmenityCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && user) {
      fetchHomestays();
      fetchHostBookings();
      fetchTrails();
      fetchAmenityCatalog();
      fetchHostVerification();
    }
  }, [isLoading, user, fetchHomestays, fetchHostBookings, fetchTrails, fetchAmenityCatalog, fetchHostVerification]);

  // Create homestay
  const handleCreate = async (formData) => {
    if (!isHostVerified) {
      showNotification("Complete and approve host citizenship verification before creating listings.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`${API}/homestays`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      showNotification("Homestay created! Sent for admin approval.");
      setShowCreateForm(false);
      fetchHomestays();
    } catch (err) {
      console.error("Error creating homestay:", err);
      showNotification(err.response?.data?.message || "Failed to create homestay", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update homestay
  const handleUpdate = async (formData) => {
    setIsSubmitting(true);
    try {
      await api.put(`${API}/homestays/${editingHomestay.homestay_id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      showNotification("Homestay updated! Status reset to pending review.");
      setEditingHomestay(null);
      fetchHomestays();
    } catch (err) {
      console.error("Error updating homestay:", err);
      showNotification(err.response?.data?.message || "Failed to update homestay", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete homestay
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.delete(`${API}/homestays/${deletingHomestay.homestay_id}`);
      showNotification("Homestay deleted successfully.");
      setDeletingHomestay(null);
      fetchHomestays();
    } catch (err) {
      console.error("Error deleting homestay:", err);
      showNotification(err.response?.data?.message || "Failed to delete homestay", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Toggle active
  const handleToggleActive = async (id) => {
    try {
      const res = await api.patch(
        `${API}/homestays/${id}/toggle-active`,
        {}
      );
      showNotification(res.data.message);
      fetchHomestays();
    } catch (err) {
      console.error("Error toggling status:", err);
      showNotification("Failed to toggle status", "error");
    }
  };

  const handleUpdateRooms = async (id, totalRoomsValue, availableRoomsValue) => {
    try {
      await api.patch(`${API}/homestays/${id}/rooms`, {
        total_rooms: Number(totalRoomsValue),
        available_rooms: Number(availableRoomsValue),
      });
      showNotification("Available rooms updated.");
      fetchHomestays();
    } catch (err) {
      console.error("Error updating rooms:", err);
      showNotification(err.response?.data?.message || "Failed to update available rooms", "error");
    }
  };

  // Stats
  const stats = {
    total: homestays.length,
    pending: homestays.filter((h) => h.verified_status === "pending").length,
    approved: homestays.filter((h) => h.verified_status === "approved").length,
    rejected: homestays.filter((h) => h.verified_status === "rejected").length,
    bookings: currentHostBookings.filter((b) => getHostBookingDisplayState(b).key === "confirmed").length,
    earnings: bookings.reduce((sum, booking) => {
      if (!isHostEarningBooking(booking)) return sum;
      const grossAmount = Number(booking.total_price || 0);
      if (!Number.isFinite(grossAmount) || grossAmount <= 0) return sum;
      return sum + (grossAmount * HOST_PAYOUT_RATE);
    }, 0),
  };
  const hostReviews = bookings
    .filter((booking) => Boolean(booking.review_id))
    .sort((a, b) => new Date(b.review_created_at || 0).getTime() - new Date(a.review_created_at || 0).getTime());
  const hostAverageRating = hostReviews.length
    ? (hostReviews.reduce((sum, item) => sum + Number(item.review_rating || 0), 0) / hostReviews.length)
    : 0;

  const renderHostBookingCard = (booking, keyPrefix) => {
    const bookingState = getHostBookingDisplayState(booking);
    const StatusIcon = bookingState.icon;

    return (
      <div key={`${keyPrefix}-${booking.booking_id}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-lg transition-all duration-300 md:flex md:items-center md:justify-between gap-6 group relative overflow-hidden">
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${bookingState.barClass}`} />

        <div className="flex items-center gap-4 md:w-1/4 mb-4 md:mb-0">
          <div className="h-12 w-12 rounded-full overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
            <Users className="h-6 w-6 text-navy/40" />
          </div>
          <div>
            <p className="font-bold text-gray-900 tracking-tight leading-tight">{booking.tourist_name}</p>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
              <Mail className="h-3 w-3" />
              <span className="truncate max-w-[150px]" title={booking.tourist_email}>{booking.tourist_email}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:w-2/4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Stay Profile</p>
            <p className="font-bold text-navy truncate">{booking.homestay_name}</p>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">
              <span className="text-gold">Code:</span> {booking.booking_code}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Schedule</p>
            <div className="flex items-center gap-1.5 font-bold text-gray-800 text-sm">
              <CalendarDays className="h-3.5 w-3.5 text-blue-500" />
              {new Date(booking.check_in_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              <span className="text-gray-400">→</span>
              {new Date(booking.check_out_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
          </div>

          <div className="hidden lg:block">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Scale</p>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-navy/5 border border-navy/10 text-xs font-bold text-navy">
              <span>{booking.rooms_booked} Unit{booking.rooms_booked > 1 ? "s" : ""}</span>
              <span className="h-3 w-[1px] bg-navy/20" />
              <span>{booking.guests_count} Pax</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-end md:w-1/4 gap-5 pt-4 md:pt-0 mt-4 md:mt-0 border-t md:border-t-0 border-gray-100">
          <div className="md:text-right">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Valuation</p>
            <p className="font-bold text-gray-900 leading-none">
              <span className="text-emerald-600 text-xs mr-0.5">NPR</span>
              {Number(booking.total_price || 0).toLocaleString()}
            </p>
            {booking.review_id && (
              <p className="mt-1 text-[11px] font-bold text-amber-700 inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                {Number(booking.review_rating || 0)} / 5
              </p>
            )}
          </div>

          <span className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${bookingState.badgeClass}`}>
            <StatusIcon className="h-3.5 w-3.5" />
            {bookingState.label}
          </span>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-navy border-t-gold animate-spin" />
          <p className="text-navy font-heading font-semibold tracking-wide">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex font-body">
      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            className={`fixed top-4 left-1/2 z-[100] px-6 py-3 rounded-xl shadow-lg shadow-black/10 text-sm font-semibold tracking-wide ${
              notification.type === "error"
                ? "bg-red-50 border border-red-200 text-red-700"
                : "bg-emerald-50 border border-emerald-200 text-emerald-700"
            }`}
          >
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-72 bg-navy border-r border-navy-light/30 fixed inset-y-0 shadow-2xl z-50">
        {/* Brand */}
        <div className="px-8 py-8 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12 rounded-full overflow-hidden shadow-lg shadow-black/40 ring-2 ring-gold/80 hover:ring-gold transition-all duration-300">
              <Link to="/">
                <img src="/offtrail-latest.png" alt="OffTrail Nepal" className="h-full w-full object-cover bg-white" />
              </Link>
            </div>
            <div>
              <p className="text-white font-heading font-bold text-2xl tracking-wide leading-none">OffTrail</p>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gold/10 border border-gold/20 mt-1.5">
                <Shield className="w-3 h-3 text-gold" />
                <span className="text-[9px] font-bold text-gold uppercase tracking-widest">Host Portal</span>
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
          <p className="px-4 mb-4 text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">
            Dashboard
          </p>
          <button
            type="button"
            onClick={() => scrollToSection("overview")}
            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-300 text-white/70 hover:bg-white/5 hover:text-white"
          >
            <Home className="h-5 w-5" /> Overview
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("properties")}
            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-300 text-white/70 hover:bg-white/5 hover:text-white"
          >
            <Key className="h-5 w-5" /> Properties
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold bg-white/10 text-white">{homestays.length || 0}</span>
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("bookings")}
            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-300 text-white/70 hover:bg-white/5 hover:text-white"
          >
            <CalendarDays className="h-5 w-5" /> Booking Requests
            {currentHostBookings.length > 0 && <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold bg-gold/20 text-gold">{currentHostBookings.length}</span>}
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("guest-reviews")}
            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-300 text-white/70 hover:bg-white/5 hover:text-white"
          >
            <Star className="h-5 w-5" /> Guest Reviews
            {hostReviews.length > 0 && <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold bg-gold/20 text-gold">{hostReviews.length}</span>}
          </button>
          <div className="pt-4 mt-4 border-t border-white/5">
            <Link to="/host-profile" className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-300 text-white/70 hover:bg-white/5 hover:text-white">
              <UserCircle className="h-5 w-5" /> My Profile
            </Link>
          </div>
        </nav>

        {/* User */}
        <div className="px-6 py-6 border-t border-white/5 bg-black/20">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-10 h-10 rounded-full border-2 border-gold/30 overflow-hidden bg-navy-light shadow-inner shadow-black/50 shrink-0">
              {profileImageUrl ? (
                <img src={profileImageUrl} alt="Host" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-gold font-bold font-heading">
                  {(user?.full_name || "H").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-bold truncate leading-tight">
                {user?.full_name || "Host Representative"}
              </p>
              <p className="text-white/50 text-[10px] font-medium mt-0.5 uppercase tracking-wider">Control Center</p>
            </div>
          </div>
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm font-bold transition-colors border border-red-500/20 hover:border-red-500/40"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Content Wrapper ── */}
      <div className="flex-1 lg:ml-72 flex flex-col min-h-screen relative overflow-x-hidden scroll-smooth bg-[#FDFBF7]">
        {/* Background Decorative Element */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-br from-gold/5 via-alpine/5 to-transparent rounded-full blur-3xl -z-10 transform translate-x-1/3 -translate-y-1/3 pointer-events-none" />
        
        {/* Mobile Header (Visible only on small screens) */}
        <header className="lg:hidden bg-navy border-b border-navy-light/30 px-4 py-4 sticky top-0 z-40 shadow-xl shadow-navy/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-gold/80">
              <img src="/offtrail-latest.png" alt="OffTrail Nepal" className="h-full w-full object-cover bg-white" />
            </Link>
            <div>
              <h1 className="text-lg font-heading font-bold text-white tracking-wide">
                OffTrail<span className="text-gold">Nepal</span>
              </h1>
            </div>
          </div>
          <button onClick={() => setShowLogoutModal(true)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-xl border border-transparent">
            <LogOut className="h-5 w-5" />
          </button>
        </header>

      {/* Main Content */}
      <main id="overview" className="max-w-[1600px] w-full mx-auto px-4 sm:px-8 py-8 space-y-8 relative z-10">
        {/* Welcome */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-heading font-bold text-gray-900 tracking-tight">Host Dashboard</h2>
            <p className="text-gray-500 mt-1 font-medium">
              Welcome back, <span className="font-bold text-navy">{user?.full_name || "Host"}</span>
            </p>
          </div>
          <button
            onClick={() => {
              if (!isHostVerified) {
                showNotification("Complete and approve host citizenship verification first.", "error");
                return;
              }
              setShowCreateForm(true);
            }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-gold to-gold-dark hover:shadow-lg hover:shadow-gold/20 text-navy rounded-xl font-bold shadow-sm transition-all hover:-translate-y-0.5 hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={!isHostVerified}
          >
            <Plus className="h-5 w-5" />
            Add New Homestay
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Host Verification</p>
              <h3 className="text-lg font-bold text-gray-900 mt-1">Citizenship Approval Required Before Listing</h3>
              <p className="text-sm text-gray-600 mt-1">
                PAN is already captured during registration. Upload citizenship for admin review to unlock listing creation.
              </p>
            </div>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
                isHostVerified
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : isHostVerificationPending
                    ? "bg-amber-50 border-amber-200 text-amber-700"
                    : isHostVerificationRejected
                      ? "bg-red-50 border-red-200 text-red-700"
                      : "bg-gray-50 border-gray-200 text-gray-600"
              }`}
            >
              {hostVerificationStatus === "not_submitted" ? "Not Submitted" : hostVerificationStatus}
            </span>
          </div>

          {isHostVerificationRejected && hostVerification?.rejection_reason && (
            <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              Rejection reason: {hostVerification.rejection_reason}
            </p>
          )}

          {hostVerification?.citizenship_doc_path && (
            <a
              href={`http://localhost:5000${hostVerification.citizenship_doc_path}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-sm text-blue-700 hover:underline"
            >
              <FileText className="h-4 w-4" />
              View submitted citizenship document
            </a>
          )}

          {!isHostVerified && (
            <form onSubmit={handleHostVerificationSubmit} className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Citizenship Document (image or PDF) <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => setHostCitizenshipFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              <button
                type="submit"
                disabled={hostVerificationSubmitting}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold disabled:bg-blue-300"
              >
                {hostVerificationSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Submit For Review
              </button>
            </form>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-6">
          <StatCard icon={Home} label="Total Listings" value={stats.total} accent="navy" delay={0.1} />
          <StatCard icon={Clock} label="Pending Review" value={stats.pending} accent="gold" delay={0.2} />
          <StatCard icon={CheckCircle} label="Approved" value={stats.approved} accent="alpine" delay={0.3} />
          <StatCard icon={XCircle} label="Rejected" value={stats.rejected} accent="charcoal" delay={0.4} />
          <StatCard icon={CalendarDays} label="Active Bookings" value={stats.bookings} accent="navy" delay={0.5} />
          <StatCard icon={DollarSign} label="Net Earnings" value={formatNprAmount(stats.earnings)} accent="gold" delay={0.6} />
        </div>

        {/* Homestay Listings */}
        <div id="properties" className="mb-4 pt-4 scroll-mt-20">
          <h2 className="text-xl font-bold text-gray-900">Your Homestay Listings</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage your properties and track their approval status
          </p>
        </div>

        {homestaysLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
        ) : homestays.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="mx-auto w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
              <Home className="h-10 w-10 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">No homestays yet</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Start by creating your first homestay listing. Once submitted, our admin team will
              review and approve it.
            </p>
            <button
              onClick={() => {
                if (!isHostVerified) {
                  showNotification("Complete and approve host citizenship verification first.", "error");
                  return;
                }
                setShowCreateForm(true);
              }}
              disabled={!isHostVerified}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
            >
              <Plus className="h-5 w-5" />
              Create Your First Listing
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {homestays.map((homestay) => (
              <HomestayCard
                key={homestay.homestay_id}
                homestay={homestay}
                onEdit={setEditingHomestay}
                onDelete={setDeletingHomestay}
                onToggleActive={handleToggleActive}
                onUpdateRooms={handleUpdateRooms}
                expanded={expandedCard === homestay.homestay_id}
                onToggleExpand={(id) => setExpandedCard(expandedCard === id ? null : id)}
              />
            ))}
          </div>
        )}

        <div id="bookings" className="mt-10 mb-4 pt-4 scroll-mt-20">
          <h2 className="text-xl font-bold text-gray-900">Current / Upcoming Booking Requests</h2>
          <p className="text-sm text-gray-500 mt-1">
            Active and upcoming reservations from tourists are shown here in real time.
          </p>
        </div>

        {bookingsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-7 w-7 text-blue-600 animate-spin" />
          </div>
        ) : currentHostBookings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
            No current or upcoming bookings right now.
          </div>
        ) : (
          <div className="space-y-4">
            {currentHostBookings.map((booking) => renderHostBookingCard(booking, "current"))}
          </div>
        )}

        {hostHistoryBookings.length > 0 && (
          <>
            <div className="mt-10 mb-4 pt-4 border-t border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Booking History</h2>
              <p className="text-sm text-gray-500 mt-1">
                Past bookings are retained here with full details.
              </p>
            </div>

            <div className="space-y-4">
              {hostHistoryBookings.map((booking) => renderHostBookingCard(booking, "history"))}
            </div>
          </>
        )}

        <div id="guest-reviews" className="mt-10 mb-4 pt-4 scroll-mt-20">
          <h2 className="text-xl font-bold text-gray-900">Guest Reviews</h2>
          <p className="text-sm text-gray-500 mt-1">
            Feedback from tourists after checkout. Average rating: {hostReviews.length > 0 ? `${hostAverageRating.toFixed(1)} / 5` : "No ratings yet"}
          </p>
        </div>

        {hostReviews.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
            No reviews yet. Tourists can submit ratings after their checkout date.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hostReviews.map((reviewBooking) => (
              <div key={`review-${reviewBooking.review_id}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{reviewBooking.tourist_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{reviewBooking.homestay_name}</p>
                  </div>
                  <div className="inline-flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Star
                        key={value}
                        className={`h-4 w-4 ${value <= Number(reviewBooking.review_rating || 0) ? "fill-amber-500 text-amber-500" : "text-gray-300 fill-transparent"}`}
                      />
                    ))}
                  </div>
                </div>
                {reviewBooking.review_comment && (
                  <p className="mt-3 text-sm text-gray-700 leading-relaxed">{reviewBooking.review_comment}</p>
                )}
                <p className="mt-3 text-xs text-gray-400">
                  {reviewBooking.review_created_at ? new Date(reviewBooking.review_created_at).toLocaleDateString() : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Form Modal */}
      {showCreateForm && (
        <HomestayForm
          trails={trails}
          amenityCatalog={amenityCatalog}
          amenityCatalogLoading={amenityCatalogLoading}
          amenityCatalogError={amenityCatalogError}
          onSubmit={handleCreate}
          onCancel={() => setShowCreateForm(false)}
          isSubmitting={isSubmitting}
          onImagesChanged={fetchHomestays}
        />
      )}

      {/* Edit Form Modal */}
      {editingHomestay && (
        <HomestayForm
          trails={trails}
          amenityCatalog={amenityCatalog}
          amenityCatalogLoading={amenityCatalogLoading}
          amenityCatalogError={amenityCatalogError}
          onSubmit={handleUpdate}
          onCancel={() => setEditingHomestay(null)}
          initialData={editingHomestay}
          isSubmitting={isSubmitting}
          onImagesChanged={fetchHomestays}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingHomestay && (
        <DeleteModal
          homestayName={deletingHomestay.name}
          onConfirm={handleDelete}
          onCancel={() => setDeletingHomestay(null)}
          isDeleting={isDeleting}
        />
      )}

      {/* Logout Modal */}
      <LogoutModal
        isOpen={showLogoutModal}
        onConfirm={handleLogout}
        onCancel={handleStayLoggedIn}
      />
      </div>
    </div>
  );
};

export default HostDashboard;
