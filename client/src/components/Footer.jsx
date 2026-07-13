import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MapPin,
  Phone,
  Mail,
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  ArrowRight,
  Heart,
  Mountain,
  Compass,
  Route,
  Tent,
  Users,
} from "lucide-react";

/* ── Static Data ── */

const API = (process.env.REACT_APP_API_URL || (process.env.REACT_APP_API_URL || "http://localhost:5000") + "");

const productLinks = [
  { name: "Home", href: "/" },
  { name: "Trails", href: "/trails", icon: Route },
  { name: "Homestays", href: "/homestays", icon: Tent },
  { name: "Guides", href: "/guides", icon: Users },
  { name: "Contact", href: "/contact", icon: Mail },
  { name: "Sign In", href: "/login", icon: ArrowRight },
];

const socials = [
  { icon: Facebook, href: "#", label: "Facebook" },
  { icon: Instagram, href: "#", label: "Instagram" },
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Youtube, href: "#", label: "YouTube" },
];

/* ── Animation variants ── */

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

/* ═══════════════════════════════════════════════
   FOOTER COMPONENT
   ═══════════════════════════════════════════════ */

export const Footer = () => {
  const [listedTrails, setListedTrails] = useState([]);
  const [trailsLoading, setTrailsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchListedTrails = async () => {
      try {
        const response = await fetch(`${API}/api/trails/public?sort=name_asc`);
        if (!response.ok) {
          throw new Error("Unable to load listed trails");
        }

        const data = await response.json();
        const trails = Array.isArray(data?.trails) ? data.trails : [];

        if (!isMounted) return;
        setListedTrails(trails.slice(0, 6));
      } catch (error) {
        console.error("Footer trails load error:", error);
        if (isMounted) {
          setListedTrails([]);
        }
      } finally {
        if (isMounted) {
          setTrailsLoading(false);
        }
      }
    };

    fetchListedTrails();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <footer className="relative overflow-hidden -mt-8 sm:-mt-12">
      <div className="absolute -top-8 sm:-top-12 left-0 right-0 h-8 sm:h-12 bg-navy-dark" />
      {/* ── Wave Separator ── */}
      <div className="relative -mb-1">
        <svg
          viewBox="0 0 1440 80"
          className="w-full h-8 sm:h-12 lg:h-14"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0C2340" />
              <stop offset="100%" stopColor="#163A5F" />
            </linearGradient>
          </defs>
          <path
            d="M0,40 C240,80 480,0 720,40 C960,80 1200,0 1440,40 L1440,80 L0,80 Z"
            fill="url(#waveGrad)"
          />
        </svg>
      </div>

      {/* ── Main Footer Body ── */}
      <div
        style={{
          background: "linear-gradient(180deg, #0C2340 0%, #081A2F 60%, #060F1A 100%)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
          {/* ═══ Newsletter Card ═══ */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="relative mt-0 mb-8"
          >
            <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-black/30">
              {/* Gradient Background */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(135deg, #0C2340 0%, #163A5F 40%, #0C2340 100%)",
                }}
              />
              {/* Gold accent line at top */}
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, #C8932A 30%, #E0B04A 50%, #C8932A 70%, transparent 100%)",
                }}
              />
              {/* Decorative elements */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-gold/[0.06]" />
                <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-gold/[0.04]" />
                <Compass className="absolute top-6 right-8 h-20 w-20 text-white/[0.03] rotate-12" />
              </div>

              <div className="relative px-6 sm:px-10 py-10 sm:py-12 flex flex-col lg:flex-row items-center justify-between gap-8">
                <div className="max-w-lg text-center lg:text-left">
                  <motion.span
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest mb-4 border border-gold/25"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(200,147,42,0.15), rgba(224,176,74,0.08))",
                      color: "#E0B04A",
                    }}
                  >
                    <Mountain className="h-3 w-3" />
                    OffTrail Nepal
                  </motion.span>
                  <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2 font-heading leading-tight">
                    Start Planning Your Next Trek
                  </h3>
                  <p className="text-white/40 text-sm sm:text-base leading-relaxed">
                    Discover verified trails, trusted local guides, and authentic
                    homestays across Nepal - all in one place.
                  </p>
                </div>

                <div className="w-full lg:w-auto flex flex-col sm:flex-row items-center gap-3">
                  <Link
                    to="/trails"
                    className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm text-navy transition-all duration-300 hover:brightness-105"
                    style={{
                      background:
                        "linear-gradient(135deg, #C8932A 0%, #E0B04A 100%)",
                    }}
                  >
                    View Listed Trails
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/contact"
                    className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm text-white border border-white/15 hover:border-gold/35 hover:text-gold transition-all duration-300"
                  >
                    Contact Team
                    <Mail className="h-4 w-4" />
                  </Link>
                  <div className="text-white/25 text-[11px] text-center sm:text-left">
                    Based in Lakeside, Pokhara
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ═══ Footer Grid ═══ */}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-6 mb-8"
          >
            {/* ── Brand (spans 4 cols) ── */}
            <motion.div variants={fadeUp} className="lg:col-span-4">
              <Link to="/" className="flex items-center gap-3 group mb-5">
                <motion.div
                  whileHover={{ scale: 1.05, rotate: 2 }}
                  className="relative h-14 w-14 rounded-full overflow-hidden shrink-0"
                >
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gold/40 via-gold/20 to-gold/40 p-[2px]">
                    <div className="h-full w-full rounded-full bg-navy-dark p-0.5">
                      <img
                        src="/offtrail-latest.png"
                        alt="OffTrail Nepal"
                        className="h-full w-full rounded-full object-cover"
                      />
                    </div>
                  </div>
                </motion.div>

                <div className="flex flex-col leading-none">
                  <div className="flex items-baseline">
                    <span className="text-xl font-extrabold text-white tracking-tight font-heading">
                      OffTrail
                    </span>
                    <span
                      className="text-xl font-extrabold tracking-tight font-heading"
                      style={{
                        background:
                          "linear-gradient(135deg, #C8932A, #E0B04A, #D4A43A)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      &nbsp;Nepal
                    </span>
                  </div>
                  <span className="text-[9px] text-white/30 tracking-[0.25em] uppercase font-medium mt-0.5">
                    Est. 2025 &middot; Himalayan Treks
                  </span>
                </div>
              </Link>

              <p className="text-white/35 text-sm leading-relaxed mb-6 max-w-xs">
                Discover Nepal's hidden trails with expert local guides. We
                connect adventure seekers with authentic Himalayan experiences
                off the beaten path.
              </p>

              {/* Social Icons */}
              <div className="flex items-center gap-2.5">
                {socials.map(({ icon: Icon, href, label }) => (
                  <motion.a
                    key={label}
                    href={href}
                    aria-label={label}
                    whileHover={{ y: -3, scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="h-10 w-10 rounded-xl bg-white/[0.04] hover:bg-gold/15 border border-white/[0.06] hover:border-gold/30 flex items-center justify-center text-white/30 hover:text-gold transition-all duration-300"
                  >
                    <Icon className="h-4 w-4" />
                  </motion.a>
                ))}
              </div>
            </motion.div>

            {/* ── Quick Links (3 cols) ── */}
            <motion.div variants={fadeUp} className="lg:col-span-3">
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] mb-5 text-white/60">
                Platform Links
              </h4>
              <ul className="space-y-3">
                {productLinks.map((link) => (
                  <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-white/35 hover:text-gold text-sm transition-all duration-300 flex items-center gap-2 group hover:translate-x-1"
                  >
                    <ArrowRight className="h-3 w-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-gold" />
                    {link.name}
                  </Link>
                </li>
                ))}
              </ul>
            </motion.div>

            {/* ── Top Destinations (3 cols) ── */}
            <motion.div variants={fadeUp} className="lg:col-span-3">
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] mb-5 text-white/60">
                Listed Trails
              </h4>
              <ul className="space-y-3">
                {trailsLoading && (
                  <li className="text-white/25 text-sm">Loading listed trails...</li>
                )}

                {!trailsLoading && listedTrails.length === 0 && (
                  <li>
                    <Link
                      to="/trails"
                      className="text-white/35 hover:text-gold text-sm transition-all duration-300 flex items-center gap-2.5 group hover:translate-x-1"
                    >
                      <Mountain className="h-3 w-3 text-white/15 group-hover:text-gold transition-colors shrink-0" />
                      Explore all trails
                    </Link>
                  </li>
                )}

                {listedTrails.map((trail) => (
                  <li key={trail.trail_id}>
                    <Link
                      to={`/trails/${trail.trail_id}`}
                      className="text-white/35 hover:text-gold text-sm transition-all duration-300 flex items-center gap-2.5 group hover:translate-x-1"
                    >
                      <Mountain className="h-3 w-3 text-white/15 group-hover:text-gold transition-colors shrink-0" />
                      <span className="line-clamp-1">{trail.trail_name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* ── Contact (3 cols) ── */}
            <motion.div variants={fadeUp} className="lg:col-span-2">
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] mb-5 text-white/60">
                Contact Us
              </h4>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 group">
                  <div className="h-9 w-9 rounded-xl bg-gold/[0.08] flex items-center justify-center shrink-0 group-hover:bg-gold/15 transition-colors">
                    <MapPin className="h-4 w-4 text-gold" />
                  </div>
                  <span className="text-white/35 text-sm leading-relaxed pt-1.5">
                    Lakeside, Pokhara
                    <br />
                    Nepal 33700
                  </span>
                </li>
                <li className="flex items-center gap-3 group">
                  <div className="h-9 w-9 rounded-xl bg-gold/[0.08] flex items-center justify-center shrink-0 group-hover:bg-gold/15 transition-colors">
                    <Phone className="h-4 w-4 text-gold" />
                  </div>
                  <a
                    href="tel:+977614XXXXXX"
                    className="text-white/35 hover:text-gold text-sm transition-colors duration-300"
                  >
                    +977-61-4XXXXXX
                  </a>
                </li>
                <li className="flex items-center gap-3 group">
                  <div className="h-9 w-9 rounded-xl bg-gold/[0.08] flex items-center justify-center shrink-0 group-hover:bg-gold/15 transition-colors">
                    <Mail className="h-4 w-4 text-gold" />
                  </div>
                  <a
                    href="mailto:info@offtrailnepal.com"
                    className="text-white/35 hover:text-gold text-sm transition-colors duration-300"
                  >
                    info@offtrailnepal.com
                  </a>
                </li>
              </ul>
            </motion.div>
          </motion.div>

          {/* ═══ Bottom Bar ═══ */}
          <div className="border-t border-white/[0.06] pt-5 pb-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-white/20 text-xs">
                &copy; {new Date().getFullYear()} OffTrail Nepal. All rights
                reserved.
              </p>
              <div className="flex items-center gap-5 text-xs text-white/20">
                <Link to="/contact" className="hover:text-gold/60 transition-colors">
                  Privacy Policy
                </Link>
                <span className="w-1 h-1 rounded-full bg-white/10" />
                <Link to="/contact" className="hover:text-gold/60 transition-colors">
                  Terms of Service
                </Link>
                <span className="w-1 h-1 rounded-full bg-white/10" />
                <span className="flex items-center gap-1.5">
                  Made with
                  <Heart className="h-3 w-3 text-red-400/80 fill-red-400/80" />
                  in Nepal
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
