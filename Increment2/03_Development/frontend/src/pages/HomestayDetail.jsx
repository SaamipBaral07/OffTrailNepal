import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft,
  Home,
  Mountain,
  MapPin,
  Phone,
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
} from "lucide-react";
import { motion } from "framer-motion";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { useAuth } from "../context/AuthContext";

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

const HomestayDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [homestay, setHomestay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    const fetchHomestay = async () => {
      try {
        const res = await axios.get(`${API}/api/homestays/public/${id}`);
        setHomestay(res.data.homestay);
      } catch (err) {
        console.error(err);
        setHomestay(null);
      } finally {
        setLoading(false);
      }
    };

    fetchHomestay();
  }, [id]);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [homestay?.homestay_id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f4f2ee] via-[#faf8f4] to-[#f2efe8]">
        <Header user={user} />
        <div className="max-w-7xl mx-auto px-6 pt-32 pb-20 text-center text-gray-500">Loading homestay details...</div>
      </div>
    );
  }

  if (!homestay) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f4f2ee] via-[#faf8f4] to-[#f2efe8]">
        <Header user={user} />
        <div className="max-w-7xl mx-auto px-6 pt-32 pb-20">
          <p className="text-gray-600 mb-4">Homestay not found.</p>
          <Link to="/" className="text-blue-600 font-semibold hover:underline">Back to trails</Link>
        </div>
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

  const amenityCards = amenities.map((item) => ({ ...getAmenityMeta(item), raw: item }));

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream via-[#f9f7f3] to-stone/40 font-body">
      <Header user={user} />

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
                {homestay.contact_phone && (
                  <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-navy-light" /> {homestay.contact_phone}</p>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  to={`/trails/${homestay.trail_id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-navy/20 text-navy hover:bg-navy/5 transition-colors"
                >
                  Back to Trail <ChevronRight className="h-3.5 w-3.5" />
                </Link>
                {homestay.contact_phone && (
                  <a
                    href={`tel:${homestay.contact_phone}`}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${isSoldOut ? "border-gray-200 bg-gray-100 text-gray-400 pointer-events-none" : "border-gold/30 bg-gold-pale text-gold-dark hover:bg-gold hover:text-white"}`}
                  >
                    {isSoldOut ? "Unavailable" : "Call to Book"}
                  </a>
                )}
              </div>
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
    </div>
  );
};

export default HomestayDetail;
