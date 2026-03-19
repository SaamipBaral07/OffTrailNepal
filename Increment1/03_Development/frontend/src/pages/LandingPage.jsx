import { Link, useNavigate } from "react-router-dom";
import {
  Compass,
  Users,
  Shield,
  ArrowRight,
  Star,
  MapPin,
  Clock,
  TrendingUp,
  ChevronRight,
  Mountain,
  Tent,
  Footprints,
  Quote,
  CheckCircle2,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import LogoutModal from "../components/LogoutModal";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const API = "http://localhost:5000";

/* ═══════════════════════════════════════════════
   STATIC DATA
   ═══════════════════════════════════════════════ */

const difficultyTag = {
  Easy: "Beginner Friendly",
  Moderate: "Most Popular",
  Difficult: "Challenging",
  Extreme: "Expert Only",
};

const features = [
  {
    icon: Compass,
    title: "Expert Local Guides",
    description:
      "Our certified Nepali guides bring decades of mountain wisdom, ensuring authentic and safe adventures through uncharted trails.",
    accent: "gold",
  },
  {
    icon: Tent,
    title: "Unique Accommodations",
    description:
      "Stay in handpicked local teahouses, eco-lodges, and homestays that immerse you in genuine Nepali culture and hospitality.",
    accent: "navy",
  },
  {
    icon: Shield,
    title: "Safety First",
    description:
      "Verified hosts, real-time trek tracking, 24/7 emergency support, and comprehensive travel insurance included in every booking.",
    accent: "alpine",
  },
  {
    icon: Users,
    title: "Community Driven",
    description:
      "Every trek directly supports local communities, preserving culture and funding sustainable mountain development projects.",
    accent: "gold",
  },
];

const steps = [
  {
    number: "01",
    title: "Choose Your Trail",
    description:
      "Browse curated treks across Nepal's diverse landscapes — from lush jungles to towering peaks above the clouds.",
    gradient: "from-gold to-gold-light",
  },
  {
    number: "02",
    title: "Book a Local Guide",
    description:
      "Select from verified, experienced guides with deep knowledge of local terrain, culture, and hidden spots.",
    gradient: "from-navy to-navy-light",
  },
  {
    number: "03",
    title: "Start Your Adventure",
    description:
      "Pack your bags and hit the trail. We handle all logistics so you can focus on the experience of a lifetime.",
    gradient: "from-alpine to-alpine-light",
  },
];

const testimonials = [
  {
    name: "Sarah Mitchell",
    location: "London, UK",
    avatar: "S",
    rating: 5,
    quote:
      "OffTrail Nepal gave me the most authentic trekking experience of my life. Our guide Pemba knew every hidden waterfall and viewpoint. Absolutely life-changing!",
  },
  {
    name: "James Chen",
    location: "San Francisco, USA",
    avatar: "J",
    rating: 5,
    quote:
      "The Manaslu Circuit trek was incredible. Zero crowds, stunning views, and the homestay experience was beyond anything I could've imagined. 10/10 recommend.",
  },
  {
    name: "Anita Sharma",
    location: "Mumbai, India",
    avatar: "A",
    rating: 5,
    quote:
      "As a solo female traveler, safety was my top concern. OffTrail's verified guide system and 24/7 support made me feel completely secure throughout the journey.",
  },
];

const stats = [
  { value: "200+", label: "Curated Trails", icon: Mountain },
  { value: "50+", label: "Expert Guides", icon: Compass },
  { value: "5,000+", label: "Happy Trekkers", icon: Users },
  { value: "4.9", label: "Average Rating", icon: Star },
];

/* ═══════════════════════════════════════════════
   ANIMATION VARIANTS
   ═══════════════════════════════════════════════ */

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const fadeUpItem = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

/* ═══════════════════════════════════════════════
   HELPER: Animated Counter
   ═══════════════════════════════════════════════ */

const AnimatedCounter = ({ target, inView }) => {
  const [count, setCount] = useState(0);
  const isNumber = /^[\d,]+/.test(target);
  const numericValue = parseInt(target.replace(/[^0-9]/g, ""), 10);
  const suffix = target.replace(/[0-9,]/g, "");

  useEffect(() => {
    if (!inView || !isNumber) return;
    let start = 0;
    const duration = 2000;
    const increment = numericValue / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= numericValue) {
        setCount(numericValue);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [inView, numericValue, isNumber]);

  if (!isNumber) return target;
  return `${count.toLocaleString()}${suffix}`;
};

/* ═══════════════════════════════════════════════
   HELPER: Section Header
   ═══════════════════════════════════════════════ */

const SectionHeader = ({ badge, badgeColor = "gold", title, subtitle }) => (
  <div className="text-center mb-14">
    <motion.span
      variants={fadeUpItem}
      className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4 ${
        badgeColor === "gold"
          ? "bg-gold/10 text-gold"
          : badgeColor === "navy"
          ? "bg-navy/10 text-navy"
          : "bg-alpine/10 text-alpine"
      }`}
    >
      <Sparkles className="h-3 w-3" />
      {badge}
    </motion.span>
    <motion.h2
      variants={fadeUpItem}
      className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-charcoal mb-4 font-heading"
    >
      {title}
    </motion.h2>
    <motion.p
      variants={fadeUpItem}
      className="text-gray-500 max-w-xl mx-auto text-lg"
    >
      {subtitle}
    </motion.p>
  </div>
);

/* ═══════════════════════════════════════════════
   HELPER: Feature icon bg + text color
   ═══════════════════════════════════════════════ */

const accentMap = {
  gold: { bg: "bg-gold/10", text: "text-gold", border: "group-hover:border-gold/30" },
  navy: { bg: "bg-navy/10", text: "text-navy", border: "group-hover:border-navy/30" },
  alpine: { bg: "bg-alpine/10", text: "text-alpine", border: "group-hover:border-alpine/30" },
};

/* ═══════════════════════════════════════════════
   LANDING PAGE COMPONENT
   ═══════════════════════════════════════════════ */

const LandingPage = () => {
  const [user, setUser] = useState(null);
  const [trails, setTrails] = useState([]);
  const [trailsLoading, setTrailsLoading] = useState(true);
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const {
    handleLogout: originalHandleLogout,
    handleStayLoggedIn,
    showLogoutModal,
    setShowLogoutModal,
  } = useLogoutHandler();

  const handleLogout = () => {
    originalHandleLogout();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    if (authUser) setUser(authUser);
  }, [authUser]);

  // Fetch trails from API
  useEffect(() => {
    const fetchTrails = async () => {
      try {
        const res = await axios.get(`${API}/api/trails/public`);
        setTrails(res.data.trails || []);
      } catch (err) {
        console.error("Error fetching trails:", err);
      } finally {
        setTrailsLoading(false);
      }
    };
    fetchTrails();
  }, []);

  /* ── Parallax scroll values ── */
  const { scrollY } = useScroll();
  const heroImageY = useTransform(scrollY, [0, 600], [0, 200]);
  const heroContentY = useTransform(scrollY, [0, 600], [0, -80]);
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);

  /* ── InView refs for counters ── */
  const statsRef = useRef(null);
  const statsInView = useInView(statsRef, { once: true, margin: "-80px" });

  return (
    <div className="min-h-screen bg-cream overflow-x-hidden">
      {/* ── Header ── */}
      <Header user={user} onLogoutClick={() => setShowLogoutModal(true)} />

      {/* ═══════════════════════════════════════════
          HERO SECTION
          ═══════════════════════════════════════════ */}
      <section
        id="home"
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
      >
        {/* Parallax Background Image */}
        <motion.div className="absolute inset-0" style={{ y: heroImageY }}>
          <img
            src="https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1920&q=80"
            alt="Nepal Himalayas"
            className="w-full h-[120%] object-cover"
          />
          {/* Navy gradient overlay */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(160deg, rgba(12,35,64,0.92) 0%, rgba(12,35,64,0.78) 40%, rgba(22,58,95,0.72) 70%, rgba(12,35,64,0.85) 100%)",
            }}
          />
          {/* Bottom fade to cream */}
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-cream to-transparent" />
        </motion.div>

        {/* Decorative Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute top-1/4 left-10 w-64 h-64 rounded-full border border-gold/10"
            animate={{ y: [0, -15, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-1/3 right-16 w-48 h-48 rounded-full border border-white/5"
            animate={{ y: [0, 12, 0] }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 2,
            }}
          />
          <motion.div
            className="absolute top-1/2 left-1/3 w-32 h-32 rounded-full border border-gold/5"
            animate={{ y: [0, -10, 0] }}
            transition={{
              duration: 7,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
          />
        </div>

        {/* Hero Content */}
        <motion.div
          className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center pt-24 pb-32"
          style={{ y: heroContentY, opacity: heroOpacity }}
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/10 backdrop-blur-md border border-gold/20 text-gold-light text-sm font-medium mb-8"
          >
            <Compass className="h-4 w-4" />
            Nepal's Premier Off-Trail Adventure Platform
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.7, ease: "easeOut" }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white mb-6 leading-[1.1] font-heading"
          >
            Discover Nepal's
            <br />
            <span
              className="text-transparent bg-clip-text"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #C8932A 0%, #E0B04A 50%, #D4A43A 100%)",
              }}
            >
              Hidden Trails
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="text-lg sm:text-xl text-white/60 mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            Connect with expert local guides, discover uncharted paths, and
            experience the authentic beauty of the Himalayas — far from the
            tourist crowds.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              to="/register"
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-bold text-navy rounded-xl shadow-xl shadow-gold/25 transition-all duration-300 hover:shadow-2xl hover:shadow-gold/40 hover:scale-[1.02]"
              style={{
                background:
                  "linear-gradient(135deg, #C8932A 0%, #E0B04A 100%)",
              }}
            >
              Start Your Adventure
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#destinations"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-semibold text-white border-2 border-white/20 rounded-xl hover:bg-white/10 hover:border-gold/30 backdrop-blur-sm transition-all duration-300"
            >
              View Trails
              <Footprints className="h-5 w-5" />
            </a>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            className="flex flex-wrap items-center justify-center gap-6 mt-12"
          >
            <div className="flex items-center gap-2 text-white/50 text-sm">
              <CheckCircle2 className="h-4 w-4 text-gold-light" />
              Verified Guides
            </div>
            <div className="flex items-center gap-2 text-white/50 text-sm">
              <CheckCircle2 className="h-4 w-4 text-gold-light" />
              24/7 Support
            </div>
            <div className="flex items-center gap-2 text-white/50 text-sm">
              <CheckCircle2 className="h-4 w-4 text-gold-light" />
              Free Cancellation
            </div>
            <div className="flex items-center gap-2 text-white/50 text-sm">
              <div className="flex -space-x-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="h-3.5 w-3.5 text-gold fill-gold"
                  />
                ))}
              </div>
              5,000+ Happy Trekkers
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════
          STATS BAR
          ═══════════════════════════════════════════ */}
      <section ref={statsRef} className="relative -mt-20 z-20 max-w-5xl mx-auto px-4">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6"
        >
          {stats.map((stat) => (
            <motion.div
              key={stat.label}
              variants={scaleIn}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="bg-white rounded-2xl p-6 text-center shadow-xl shadow-navy/5 border border-gray-100 hover:border-gold/20 transition-colors duration-300 cursor-default"
            >
              <stat.icon className="h-5 w-5 text-gold mx-auto mb-2" />
              <p className="text-3xl sm:text-4xl font-extrabold text-navy mb-1">
                <AnimatedCounter target={stat.value} inView={statsInView} />
              </p>
              <p className="text-sm text-gray-400 font-medium">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════
          DESTINATIONS
          ═══════════════════════════════════════════ */}
      <section id="destinations" className="py-24 sm:py-28 bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
          >
            <SectionHeader
              badge="Top Destinations"
              badgeColor="gold"
              title="Popular Treks in Nepal"
              subtitle="Hand-picked trails that showcase Nepal's most breathtaking landscapes and cultural heritage."
            />
          </motion.div>

          {/* Destination Cards */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-7"
          >
            {trailsLoading ? (
              <div className="sm:col-span-2 lg:col-span-3 flex flex-col items-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-gold" />
                <p className="text-gray-400 text-sm">Loading trails…</p>
              </div>
            ) : trails.length === 0 ? (
              <div className="sm:col-span-2 lg:col-span-3 text-center py-16">
                <Mountain className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No trails available yet. Check back soon!</p>
              </div>
            ) : (
              trails.map((trail) => {
                const primaryImage = trail.images?.find((img) => img.is_primary);
                const imageUrl = primaryImage
                  ? `${API}${primaryImage.image_path}`
                  : "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80";
                const tag = difficultyTag[trail.difficulty_level] || trail.difficulty_level;

                return (
                  <motion.div
                    key={trail.trail_id}
                    variants={fadeUpItem}
                    whileHover={{ y: -6, transition: { duration: 0.25 } }}
                    className="group bg-white rounded-2xl overflow-hidden shadow-lg shadow-navy/5 border border-gray-100 hover:shadow-xl hover:border-gold/20 transition-all duration-500 cursor-pointer"
                  >
                    {/* Image */}
                    <Link to={`/trails/${trail.trail_id}`}>
                      <div className="relative h-52 overflow-hidden">
                        <img
                          src={imageUrl}
                          alt={trail.trail_name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-navy/60 via-transparent to-transparent" />
                        {/* Tag */}
                        <span
                          className="absolute top-4 left-4 px-3 py-1 text-navy text-xs font-bold rounded-full backdrop-blur-sm"
                          style={{
                            background:
                              "linear-gradient(135deg, rgba(200,147,42,0.9), rgba(224,176,74,0.9))",
                          }}
                        >
                          {tag}
                        </span>
                        {/* Altitude badge */}
                        {trail.max_altitude && (
                          <div className="absolute bottom-4 right-4 flex items-center gap-1 px-2.5 py-1 bg-white/90 backdrop-blur-sm rounded-full">
                            <Mountain className="h-3.5 w-3.5 text-gold" />
                            <span className="text-xs font-bold text-navy">
                              {Number(trail.max_altitude).toLocaleString()}m
                            </span>
                          </div>
                        )}
                      </div>
                    </Link>

                    {/* Card Content */}
                    <div className="p-5">
                      <h3 className="text-lg font-bold text-charcoal mb-2 group-hover:text-navy transition-colors">
                        {trail.trail_name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 mb-4">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-gold" />
                          {trail.region}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-navy-400" />
                          {trail.duration_days} Days
                        </span>
                        <span className="flex items-center gap-1.5">
                          <TrendingUp className="h-3.5 w-3.5 text-alpine" />
                          {trail.difficulty_level}
                        </span>
                      </div>
                      <Link
                        to={`/trails/${trail.trail_id}`}
                        className="flex items-center gap-1.5 text-sm font-semibold text-gold hover:text-gold-dark transition-colors group/link"
                      >
                        View Details
                        <ChevronRight className="h-4 w-4 group-hover/link:translate-x-0.5 transition-transform" />
                      </Link>
                    </div>
                  </motion.div>
                );
              })
            )}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          FEATURES — WHY OFFTRAIL
          ═══════════════════════════════════════════ */}
      <section id="features" className="py-24 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
          >
            <SectionHeader
              badge="Why Choose Us"
              badgeColor="navy"
              title="Why OffTrail Nepal?"
              subtitle="We're not just another travel platform — we're your gateway to Nepal's most authentic off-trail experiences."
            />
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8"
          >
            {features.map((feat) => {
              const colors = accentMap[feat.accent];
              return (
                <motion.div
                  key={feat.title}
                  variants={fadeUpItem}
                  whileHover={{ y: -6, transition: { duration: 0.25 } }}
                  className={`group relative bg-cream rounded-2xl p-7 border border-gray-100 hover:border-transparent hover:shadow-xl hover:shadow-navy/5 transition-all duration-500 ${colors.border}`}
                >
                  <div
                    className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl ${colors.bg} mb-5 group-hover:scale-110 transition-transform duration-300`}
                  >
                    <feat.icon className={`h-7 w-7 ${colors.text}`} />
                  </div>
                  <h3 className="text-lg font-bold text-charcoal mb-2">
                    {feat.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {feat.description}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          HOW IT WORKS
          ═══════════════════════════════════════════ */}
      <section id="how-it-works" className="py-24 sm:py-28 bg-cream">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
          >
            <SectionHeader
              badge="Simple Process"
              badgeColor="gold"
              title="How It Works"
              subtitle="From choosing your dream trail to reaching the summit — we make it effortless."
            />
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="grid md:grid-cols-3 gap-8 md:gap-6 relative"
          >
            {/* Connecting Line (desktop) */}
            <div className="hidden md:block absolute top-20 left-[20%] right-[20%] h-[2px]">
              <div
                className="w-full h-full rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, #C8932A 0%, #0C2340 50%, #2D6A4F 100%)",
                  opacity: 0.2,
                }}
              />
            </div>

            {steps.map((step) => (
              <motion.div
                key={step.number}
                variants={fadeUpItem}
                className="relative text-center"
              >
                {/* Step Number Circle */}
                <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-full bg-white shadow-xl shadow-navy/5 border-2 border-gray-100 mb-6">
                  <span
                    className={`text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br ${step.gradient}`}
                  >
                    {step.number}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-charcoal mb-3">
                  {step.title}
                </h3>
                <p className="text-gray-500 text-sm max-w-xs mx-auto leading-relaxed">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          TESTIMONIALS
          ═══════════════════════════════════════════ */}
      <section id="testimonials" className="py-24 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
          >
            <SectionHeader
              badge="Testimonials"
              badgeColor="gold"
              title="What Trekkers Say"
              subtitle="Real stories from real adventurers who explored Nepal with us."
            />
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="grid md:grid-cols-3 gap-8"
          >
            {testimonials.map((t) => (
              <motion.div
                key={t.name}
                variants={fadeUpItem}
                whileHover={{ y: -6, transition: { duration: 0.25 } }}
                className="relative bg-cream rounded-2xl p-8 border border-gray-100 hover:shadow-xl hover:shadow-navy/5 hover:border-gold/20 transition-all duration-500"
              >
                {/* Quote Icon */}
                <Quote className="h-8 w-8 text-gold/20 mb-4" />

                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {[...Array(t.rating)].map((_, j) => (
                    <Star
                      key={j}
                      className="h-4 w-4 text-gold fill-gold"
                    />
                  ))}
                </div>

                {/* Quote Text */}
                <p className="text-gray-600 text-[15px] leading-relaxed mb-6 italic">
                  &ldquo;{t.quote}&rdquo;
                </p>

                {/* Author */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                  <div className="h-11 w-11 rounded-full flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br from-navy to-navy-light">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-charcoal">{t.name}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {t.location}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          CTA SECTION
          ═══════════════════════════════════════════ */}
      <section className="py-24 sm:py-28 relative overflow-hidden">
        {/* Background */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, #0C2340 0%, #081A2F 40%, #163A5F 100%)",
          }}
        />
        {/* Decorative circles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full border border-gold/10" />
          <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full border border-gold/5" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/[0.03]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="relative z-10 max-w-3xl mx-auto text-center px-4"
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Mountain className="h-12 w-12 text-gold mx-auto mb-6" />
          </motion.div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-6 leading-tight font-heading">
            Ready to Go
            <span className="text-gold"> Off Trail</span>?
          </h2>
          <p className="text-lg text-white/50 mb-10 max-w-lg mx-auto">
            Join thousands of adventurers discovering the real Nepal. Your next
            unforgettable Himalayan experience starts here.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-bold text-navy rounded-xl shadow-xl shadow-gold/25 hover:shadow-2xl hover:shadow-gold/40 hover:scale-[1.02] transition-all duration-300"
              style={{
                background:
                  "linear-gradient(135deg, #C8932A 0%, #E0B04A 100%)",
              }}
            >
              Create Free Account
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-semibold text-white border-2 border-white/15 rounded-xl hover:bg-white/10 hover:border-gold/30 transition-all duration-300"
            >
              Sign In
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <Footer />

      {/* ── Logout Modal ── */}
      <LogoutModal
        isOpen={showLogoutModal}
        onConfirm={handleLogout}
        onCancel={handleStayLoggedIn}
      />
    </div>
  );
};

export default LandingPage;
