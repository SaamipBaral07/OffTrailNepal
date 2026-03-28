import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
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
  Download,
  Briefcase,
  Phone,
  Award,
  Tent,
  Home,
  ChevronRight,
  Users,
  Compass,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import TrailMap from "../components/TrailMap";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import LogoutModal from "../components/LogoutModal";

const API = "http://localhost:5000";

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

/* ─────────────────────────────────────────────
   PHOTO GALLERY — Pro mosaic with lightbox
───────────────────────────────────────────── */
const PhotoGallery = ({ images }) => {
  const [lightbox, setLightbox] = useState(null);
  if (!images?.length) return null;

  const count = Math.min(images.length, 5);
  const visible = images.slice(0, count);
  const src = (img) => `${API}${img.image_path}`;
  const open = (img) => setLightbox(images.indexOf(img));

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
    layout = (
      <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[420px] rounded-2xl overflow-hidden shadow-2xl">
        <Tile img={visible[0]} className="col-span-2 row-span-2" />
        {visible.slice(1).map((img, i) => <Tile key={img.image_id} img={img} className="col-span-1 row-span-1" />)}
        {images.length > 5 && (
          <div
            className="col-span-1 row-span-1 relative overflow-hidden cursor-pointer"
            onClick={() => open(images[4])}
          >
            <img src={src(images[4])} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center">
              <span className="text-white font-bold text-2xl">+{images.length - 4}</span>
              <span className="text-white/70 text-xs mt-0.5 tracking-wide">more photos</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {layout}
      <AnimatePresence>
        {lightbox !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4"
            onClick={() => setLightbox(null)}
          >
            <button
              className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl font-light transition"
              onClick={() => setLightbox(null)}
            >×</button>
            <button
              className="absolute left-5 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white text-3xl transition"
              onClick={(e) => { e.stopPropagation(); setLightbox((i) => (i - 1 + images.length) % images.length); }}
            >‹</button>
            <button
              className="absolute right-5 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white text-3xl transition"
              onClick={(e) => { e.stopPropagation(); setLightbox((i) => (i + 1) % images.length); }}
            >›</button>
            <motion.img
              key={lightbox}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              src={`${API}${images[lightbox]?.image_path}`}
              alt="Trail"
              className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/40 text-xs tracking-[0.2em] font-light">
              {lightbox + 1} / {images.length}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
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
}) => {
  const primary = homestay.images?.find((i) => i.is_primary) || homestay.images?.[0];
  const isNearTrail = Number.isFinite(distanceKm) && distanceKm <= distanceThresholdKm;

  return (
    <motion.div
      ref={cardRef}
      id={`homestay-card-${homestay.homestay_id}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      onClick={() => onSelect?.(homestay.homestay_id)}
      className={`bg-white rounded-2xl overflow-hidden border transition-all duration-300 group flex flex-col ${
        isHighlighted
          ? "border-emerald-400 ring-2 ring-emerald-200 shadow-lg"
          : "border-gray-100 hover:border-gold/40 hover:shadow-lg"
      }`}
      style={{ cursor: onSelect ? "pointer" : "default" }}
    >
      {/* Image */}
      <div className="relative h-44 bg-stone-100 overflow-hidden flex-shrink-0">
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
        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-sm">
          <span className="text-xs font-bold text-charcoal">
            NPR {Number(homestay.price_per_night).toLocaleString()}
            <span className="font-normal text-gray-400">/night</span>
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <h4 className="font-bold text-charcoal text-[15px] leading-tight mb-1.5">{homestay.name}</h4>
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2.5">
          <MapPin className="h-3 w-3 flex-shrink-0 text-gold" />
          {homestay.location}
        </div>
        {Number.isFinite(distanceKm) && (
          <div className="mb-3">
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
              isNearTrail
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-gray-50 text-gray-600 border-gray-200"
            }`}>
              <Route className="h-3 w-3" />
              {distanceKm.toFixed(2)} km from trail
            </span>
          </div>
        )}
        {homestay.description && (
          <p className="text-gray-400 text-xs leading-relaxed line-clamp-2 mb-3">{homestay.description}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-50">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Users className="h-3.5 w-3.5" />
            Up to {homestay.capacity} guest{homestay.capacity !== 1 ? "s" : ""}
          </div>
          {homestay.contact_phone && (
            <a
              href={`tel:${homestay.contact_phone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold/10 text-gold hover:bg-gold hover:text-white transition-all duration-200"
            >
              <Book className="h-3 w-3" />
              Book Now
            </a>
          )}
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
const GuideServiceCard = ({ service, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-gold/40 hover:shadow-lg transition-all duration-300 flex flex-col sm:flex-row"
    >
      {/* Guide Info Side */}
      <div className="bg-stone-50 p-6 sm:w-1/3 flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-gray-100/80">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gold to-amber-500 flex items-center justify-center text-white text-xl font-bold shadow-md mb-3">
          {service.guide_name.charAt(0)}
        </div>
        <h4 className="font-bold text-charcoal text-center mb-1">{service.guide_name}</h4>
        
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
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-lg text-charcoal">{service.title}</h3>
          <div className="text-right">
            <p className="text-lg font-black text-gold leading-none">
              NPR {Number(service.price_per_day).toLocaleString()}
            </p>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-1">per day</p>
          </div>
        </div>

        <p className="text-sm text-gray-500 leading-relaxed max-w-lg mb-4">
          {service.description}
        </p>

        <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-50">
          <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
            <Users className="h-4 w-4 text-emerald-500" />
            Max Group: {service.max_group_size} pax
          </div>
          
          <a
            href={`tel:${service.guide_phone}`}
            className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white text-xs font-bold rounded-xl hover:bg-black transition-colors shadow-sm"
          >
            <Phone className="h-3.5 w-3.5" /> Book Guide
          </a>
        </div>
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
const BaseGuideCard = ({ guide, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white rounded-xl p-4 border border-gray-100 flex items-center justify-between hover:border-gold/30 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-stone-100 text-gold flex items-center justify-center font-bold text-lg">
          {guide.full_name.charAt(0)}
        </div>
        <div>
          <h4 className="font-bold text-charcoal">{guide.full_name}</h4>
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
            <span className="flex items-center gap-1"><Briefcase className="h-3 w-3 text-gold" /> {guide.experience_years} yrs exp</span>
            <span className="flex items-center gap-1"><Award className="h-3 w-3 text-gold" /> <AwardBadge level={guide.experience_level} /></span>
          </div>
        </div>
      </div>
      
      <div className="text-right">
        <p className="font-bold text-charcoal">NPR {Number(guide.price_per_day).toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">/day</span></p>
        <a href={`tel:${guide.phone}`} className="inline-block mt-1 text-xs text-gold hover:text-amber-600 font-semibold" >
          Contact Guide
        </a>
      </div>
    </motion.div>
  );
};

/* ─────────────────────────────────────────────
   TABS
───────────────────────────────────────────── */
const TABS = ["Overview", "Itinerary", "Homestays", "Guides"];

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
const TrailDetail = () => {
  const { id } = useParams();
  const [trail, setTrail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [homestays, setHomestays] = useState([]);
  const [homestaysLoading, setHomestaysLoading] = useState(false);
  const [guideServices, setGuideServices] = useState([]);
  const [guidesLoading, setGuidesLoading] = useState(false);
  
  const [baseGuides, setBaseGuides] = useState([]);
  const [baseGuidesLoading, setBaseGuidesLoading] = useState(false);

  const [selectedHomestayId, setSelectedHomestayId] = useState(null);
  const [pendingScrollHomestayId, setPendingScrollHomestayId] = useState(null);
  const [nearTrailHomestayIds, setNearTrailHomestayIds] = useState([]);
  const [showOnlyNearTrail, setShowOnlyNearTrail] = useState(false);
  const [distanceThresholdKm, setDistanceThresholdKm] = useState(3);
  const [homestayDistanceMap, setHomestayDistanceMap] = useState({});
  const homestayCardRefs = useRef({});
  const mapSectionRef = useRef(null);
  const [pendingMapFocusHomestayId, setPendingMapFocusHomestayId] = useState(null);
  
  const [activeTab, setActiveTab] = useState("Overview");
  const tabRef = useRef(null);
  const { user: authUser } = useAuth();

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
    <div className="min-h-screen bg-[#faf9f7]">
      <Header user={user} onLogoutClick={() => setShowLogoutModal(true)} />

      {/* ════════════════════════════════
          HERO — cinematic full-width
      ════════════════════════════════ */}
      <div className="relative h-[75vh] min-h-[580px] max-h-[760px] overflow-hidden">
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
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-black/25 backdrop-blur-md rounded-xl text-white/90 text-sm font-medium border border-white/15 hover:bg-black/40 hover:border-white/30 transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            All Trails
          </Link>
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
        className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] supports-[backdrop-filter]:bg-white/60"
      >
        <div className="max-w-6xl mx-auto px-6 sm:px-10">
          <div className="flex items-center gap-0">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-5 py-4 text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
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
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10">
        <AnimatePresence mode="wait">

          {/* ─── OVERVIEW TAB ─── */}
          {activeTab === "Overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <div className="grid lg:grid-cols-3 gap-8 xl:gap-12">

                {/* Left: About + Gallery */}
                <div className="lg:col-span-2 space-y-10">

                  {/* About */}
                  <div>
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ background: "linear-gradient(to bottom, #C8932A, #E0B04A)" }} />
                      <h2 className="text-xl font-bold text-charcoal font-heading tracking-tight">About This Trek</h2>
                    </div>
                    <p className="text-gray-500 leading-[1.9] text-[15px] whitespace-pre-line">{trail.description}</p>
                  </div>

                  {/* Map */}
                  <div ref={mapSectionRef}>
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
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ background: "linear-gradient(to bottom, #C8932A, #E0B04A)" }} />
                          <h2 className="text-xl font-bold text-charcoal font-heading tracking-tight">Trail Gallery</h2>
                          <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                            {trail.images.length} photos
                          </span>
                        </div>
                        <p className="text-xs text-gray-300 hidden sm:block font-medium">Click to enlarge</p>
                      </div>
                      <PhotoGallery images={trail.images} />
                    </div>
                  )}
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
                            className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-bold rounded-xl bg-gradient-to-br from-gold to-amber-500 text-white hover:from-gold/90 hover:to-amber-500/90 transition-all shadow-[0_4px_14px_rgba(224,176,74,0.3)] hover:shadow-[0_6px_20px_rgba(224,176,74,0.4)] group"
                          >
                            <Download className="h-4 w-4 group-hover:-translate-y-0.5 transition-transform" />
                            Download GPX File
                          </a>
                          <p className="text-[10px] text-center text-gray-400 mt-3 font-semibold uppercase tracking-wider">
                            Compatible with Garmin, Caltopo & AllTrails
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
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              {trail.itineraries?.length > 0 ? (
                <div className="max-w-3xl">
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
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
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
                  <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100">
                    <p className="text-sm text-gray-400">
                      Showing <span className="font-semibold text-charcoal">{visibleHomestays.length}</span>
                      {showOnlyNearTrail ? " near-trail " : " "}
                      places to stay
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5">
                        <span className="font-semibold">Radius</span>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          step={1}
                          value={distanceThresholdKm}
                          onChange={(e) => setDistanceThresholdKm(Number(e.target.value))}
                          className="w-20 accent-emerald-500"
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
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {visibleHomestays.map((h, i) => (
                        <HomestayCard
                          key={h.homestay_id}
                          homestay={h}
                          index={i}
                          isHighlighted={selectedHomestayId === h.homestay_id}
                          distanceKm={homestayDistanceMap[h.homestay_id]}
                          distanceThresholdKm={distanceThresholdKm}
                          onSelect={handleHomestayCardSelect}
                          cardRef={(el) => {
                            if (el) homestayCardRefs.current[h.homestay_id] = el;
                          }}
                        />
                      ))}
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
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
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
                    There are no specialized packages listed for this trail yet. Check for independent guides below.
                  </p>
                </div>
              ) : (
                <div className="space-y-5 max-w-4xl mb-12">
                  {guideServices.map((service, i) => (
                    <GuideServiceCard key={service.service_id} service={service} index={i} />
                  ))}
                </div>
              )}
              
              {/* INDEPENDENT GUIDES SECTION */}
              <div className="flex items-center gap-3 mb-6 pt-6 border-t border-gray-100">
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
                       <BaseGuideCard key={guide.id} guide={guide} index={i} />
                    ))}
                 </div>
              )}

            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <Footer />

      <LogoutModal
        isOpen={showLogoutModal}
        onConfirm={handleLogout}
        onCancel={handleStayLoggedIn}
      />
    </div>
  );
};

export default TrailDetail;