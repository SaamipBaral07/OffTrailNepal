import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  ChevronDown,
  User,
  LogOut,
  Settings,
  Compass,
  CalendarCheck,
  MessageCircle,
} from "lucide-react";

const primaryLinks = [
  { name: "Home", to: "/" },
  { name: "Trails", to: "/trails" },
  { name: "Homestays", to: "/homestays" },
];

export const Header = ({ user, onLogoutClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const isHomeRoute = location.pathname === "/";
  const isTrailsRoute = location.pathname.startsWith("/trails");
  const isHomestaysRoute = location.pathname.startsWith("/homestays");
  const profileImageUrl = user?.profile_image_path
    ? (String(user.profile_image_path).startsWith("http")
      ? user.profile_image_path
      : `http://localhost:5000${user.profile_image_path}`)
    : "";

  /* ── Scroll tracking ── */
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* ── Close dropdown on outside click ── */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const goToPrimaryLink = (to) => {
    if (to === "/" && location.pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate(to);
    }
    setMobileMenuOpen(false);
  };

  const triggerLogout = () => {
    if (typeof onLogoutClick === "function") {
      onLogoutClick(true);
    }
    setDropdownOpen(false);
  };

  return (
    <>
      {/* ═══════════ FLOATING NAVBAR ═══════════ */}
      <motion.header
        initial={{ y: -120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-4 lg:px-6"
      >
        <div
          className={`max-w-7xl mx-auto transition-all duration-700 ease-out ${
            scrolled ? "mt-2" : "mt-3 sm:mt-4"
          }`}
        >
          <nav
            className={`relative flex items-center justify-between transition-all duration-700 ease-out ${
              scrolled
                ? "h-[64px] px-4 sm:px-5 rounded-2xl bg-navy/90 shadow-2xl shadow-navy/30 backdrop-blur-xl border border-white/[0.08]"
                : "h-[76px] px-4 sm:px-6 rounded-[22px] bg-navy/40 shadow-xl shadow-black/10 backdrop-blur-md border border-white/[0.06]"
            }`}
          >
            {/* ── Logo ── */}
            <Link to="/" className="flex items-center gap-3 group shrink-0">
              <motion.div
                whileHover={{ scale: 1.05, rotate: 2 }}
                transition={{ type: "spring", stiffness: 400 }}
                className={`relative rounded-full overflow-hidden transition-all duration-500 ${
                  scrolled
                    ? "h-10 w-10 sm:h-11 sm:w-11"
                    : "h-12 w-12 sm:h-14 sm:w-14"
                }`}
              >
                {/* Glow ring */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gold/40 via-gold/20 to-gold/40 p-[2px]">
                  <div className="h-full w-full rounded-full bg-navy/80 p-0.5">
                    <img
                      src="/offtrail-latest.png"
                      alt="OffTrail Nepal"
                      className="h-full w-full rounded-full object-cover"
                    />
                  </div>
                </div>
              </motion.div>

              <div className="flex flex-col leading-none">
                <div className="flex items-baseline gap-0">
                  <span
                    className={`font-extrabold text-white tracking-tight transition-all duration-500 font-heading ${
                      scrolled ? "text-lg" : "text-xl sm:text-[22px]"
                    }`}
                  >
                    OffTrail
                  </span>
                  <span
                    className={`font-extrabold tracking-tight transition-all duration-500 font-heading ${
                      scrolled ? "text-lg" : "text-xl sm:text-[22px]"
                    }`}
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
                <span
                  className={`text-white/40 tracking-[0.2em] uppercase font-medium transition-all duration-500 ${
                    scrolled
                      ? "text-[8px] sm:text-[9px]"
                      : "text-[9px] sm:text-[10px]"
                  }`}
                >
                  Est. 2025 &middot; Himalayan Treks
                </span>
              </div>
            </Link>

            {/* ── Desktop Nav: Single Row (center) ── */}
            <div className="hidden lg:flex items-center absolute left-1/2 -translate-x-1/2">
              <div className="flex items-center gap-2 rounded-full bg-white/[0.05] px-1.5 py-1 border border-white/[0.06] backdrop-blur-xl">
                <div className="flex items-center rounded-full transition-all duration-300">
                  <button
                    onClick={() => goToPrimaryLink("/")}
                    className={`relative px-4 py-2 text-[12px] font-semibold uppercase tracking-wider rounded-full transition-all duration-300 ${isHomeRoute ? "text-navy" : "text-white/70 hover:text-white hover:bg-white/10"}`}
                  >
                    {isHomeRoute && (
                      <motion.span
                        layoutId="activeNavPill"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: "linear-gradient(135deg, #C8932A, #E0B04A)",
                        }}
                      />
                    )}
                    <span className="relative z-10">HOME</span>
                  </button>
                </div>

                <span className="text-white/25 text-xs font-semibold px-1">•</span>

                <button
                  onClick={() => goToPrimaryLink("/trails")}
                  className={`relative px-4 py-2 text-[12px] font-semibold uppercase tracking-wider rounded-full transition-all duration-300 ${isTrailsRoute ? "text-navy" : "text-white/70 hover:text-white"}`}
                >
                  {isTrailsRoute && (
                    <motion.span
                      layoutId="primaryPagePill"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: "linear-gradient(135deg, #C8932A, #E0B04A)",
                      }}
                    />
                  )}
                  <span className="relative z-10">TRAILS</span>
                </button>

                <span className="text-white/25 text-xs font-semibold px-1">•</span>

                <button
                  onClick={() => goToPrimaryLink("/homestays")}
                  className={`relative px-4 py-2 text-[12px] font-semibold uppercase tracking-wider rounded-full transition-all duration-300 ${isHomestaysRoute ? "text-navy" : "text-white/70 hover:text-white"}`}
                >
                  {isHomestaysRoute && (
                    <motion.span
                      layoutId="primaryPagePill"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: "linear-gradient(135deg, #C8932A, #E0B04A)",
                      }}
                    />
                  )}
                  <span className="relative z-10">HOMESTAYS</span>
                </button>
              </div>
            </div>

            {/* ── Right Side ── */}
            <div className="flex items-center gap-2 sm:gap-3">
              {user ? (
                /* ── Logged-in dropdown ── */
                <div className="relative" ref={dropdownRef}>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-full hover:bg-white/10 transition-all duration-300 group"
                  >
                    {profileImageUrl ? (
                      <img
                        src={profileImageUrl}
                        alt={user.full_name || "User"}
                        className="h-9 w-9 rounded-full object-cover shadow-lg shadow-gold/25 ring-2 ring-gold/30"
                      />
                    ) : (
                      <div
                        className="h-9 w-9 rounded-full flex items-center justify-center text-navy font-bold text-sm shadow-lg shadow-gold/25"
                        style={{
                          background:
                            "linear-gradient(135deg, #C8932A, #E0B04A)",
                        }}
                      >
                        {user.full_name?.charAt(0).toUpperCase() || "U"}
                      </div>
                    )}
                    <div className="hidden md:block text-left">
                      <p className="text-sm font-semibold text-white leading-tight">
                        {user.full_name || "User"}
                      </p>
                      <p className="text-[10px] text-gold/60 capitalize tracking-wide">
                        {user.user_type}
                      </p>
                    </div>
                    <ChevronDown
                      className={`h-3.5 w-3.5 text-white/40 transition-transform duration-300 ${
                        dropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </motion.button>

                  <AnimatePresence>
                    {dropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl shadow-navy/20 border border-gray-100/80 py-1 overflow-hidden"
                      >
                        <div className="px-4 py-3.5 border-b border-gray-100 bg-gradient-to-r from-navy-50 to-white">
                          <p className="text-sm font-bold text-navy">
                            {user.full_name}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {user.email}
                          </p>
                          <span
                            className="inline-block mt-2 px-3 py-1 text-xs font-semibold rounded-full capitalize text-navy"
                            style={{
                              background:
                                "linear-gradient(135deg, rgba(200,147,42,0.15), rgba(224,176,74,0.15))",
                            }}
                          >
                            {user.user_type}
                          </span>
                        </div>
                        <div className="py-1">
                          {user.user_type === "tourist" ? (
                            <Link
                              to="/my-profile"
                              onClick={() => setDropdownOpen(false)}
                              className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-navy-50 hover:text-navy flex items-center gap-3 transition-colors"
                            >
                              <User className="h-4 w-4 text-gray-400" />
                              My Profile
                            </Link>
                          ) : user.user_type === "host" ? (
                            <Link
                              to="/host-profile"
                              onClick={() => setDropdownOpen(false)}
                              className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-navy-50 hover:text-navy flex items-center gap-3 transition-colors"
                            >
                              <User className="h-4 w-4 text-gray-400" />
                              My Profile
                            </Link>
                          ) : user.user_type === "guide" ? (
                            <Link
                              to="/guide-profile"
                              onClick={() => setDropdownOpen(false)}
                              className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-navy-50 hover:text-navy flex items-center gap-3 transition-colors"
                            >
                              <User className="h-4 w-4 text-gray-400" />
                              My Profile
                            </Link>
                          ) : (
                            <button className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-navy-50 hover:text-navy flex items-center gap-3 transition-colors">
                              <User className="h-4 w-4 text-gray-400" />
                              My Profile
                            </button>
                          )}
                          {user.user_type === "tourist" && (
                            <Link
                              to="/my-bookings"
                              onClick={() => setDropdownOpen(false)}
                              className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-navy-50 hover:text-navy flex items-center gap-3 transition-colors"
                            >
                              <CalendarCheck className="h-4 w-4 text-gray-400" />
                              My Bookings
                            </Link>
                          )}
                          {(user.user_type === "tourist" || user.user_type === "guide") && (
                            <Link
                              to="/chats"
                              onClick={() => setDropdownOpen(false)}
                              className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-navy-50 hover:text-navy flex items-center gap-3 transition-colors"
                            >
                              <MessageCircle className="h-4 w-4 text-gray-400" />
                              Chats
                            </Link>
                          )}
                          {user.user_type === "tourist" ? (
                            <Link
                              to="/my-settings"
                              onClick={() => setDropdownOpen(false)}
                              className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-navy-50 hover:text-navy flex items-center gap-3 transition-colors"
                            >
                              <Settings className="h-4 w-4 text-gray-400" />
                              Settings
                            </Link>
                          ) : (
                            <button className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-navy-50 hover:text-navy flex items-center gap-3 transition-colors">
                              <Settings className="h-4 w-4 text-gray-400" />
                              Settings
                            </button>
                          )}
                        </div>
                        <div className="border-t border-gray-100 pt-1">
                          <button
                            onClick={triggerLogout}
                            className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 hover:text-red-600 flex items-center gap-3 transition-colors"
                          >
                            <LogOut className="h-4 w-4" />
                            Logout
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                /* ── Guest buttons ── */
                <div className="hidden sm:flex items-center gap-2.5">
                  <Link
                    to="/login"
                    className="px-4 py-2 text-[13px] font-semibold text-white/80 hover:text-gold border border-white/[0.12] hover:border-gold/30 rounded-full transition-all duration-300"
                  >
                    Log in
                  </Link>
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Link
                      to="/register"
                      className="inline-flex items-center gap-1.5 px-5 py-2 text-[13px] font-bold text-navy rounded-full shadow-lg shadow-gold/25 hover:shadow-xl hover:shadow-gold/35 transition-all duration-300"
                      style={{
                        background:
                          "linear-gradient(135deg, #C8932A 0%, #E0B04A 50%, #D4A43A 100%)",
                      }}
                    >
                      <Compass className="h-3.5 w-3.5" />
                      Get Started
                    </Link>
                  </motion.div>
                </div>
              )}

              {/* ── Mobile toggle ── */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-full text-white/80 hover:bg-white/10 transition-colors"
                aria-label="Toggle menu"
              >
                <AnimatePresence mode="wait">
                  {mobileMenuOpen ? (
                    <motion.div
                      key="close"
                      initial={{ rotate: -90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: 90, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <X className="h-5 w-5" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="menu"
                      initial={{ rotate: 90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: -90, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Menu className="h-5 w-5" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          </nav>
        </div>

        {/* ═══════════ MOBILE MENU ═══════════ */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.96 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="lg:hidden max-w-7xl mx-auto mt-2 rounded-2xl bg-navy/95 backdrop-blur-2xl border border-white/[0.08] shadow-2xl shadow-navy/40 overflow-hidden"
            >
              <div className="px-4 py-5 space-y-1">
                {primaryLinks.map((link, i) => {
                  const isActive =
                    link.to === "/"
                      ? location.pathname === "/"
                      : location.pathname.startsWith(link.to);
                  return (
                    <motion.button
                      key={link.name}
                      initial={{ opacity: 0, x: -24 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06, ease: "easeOut" }}
                      onClick={() => goToPrimaryLink(link.to)}
                      className={`block w-full text-left px-4 py-3 rounded-xl transition-all duration-300 font-medium text-[15px] ${
                        isActive
                          ? "bg-gold/15 text-gold"
                          : "text-white/70 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {link.name}
                    </motion.button>
                  );
                })}

                {user && (user.user_type === "tourist" || user.user_type === "guide") && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="pt-3 mt-2 border-t border-white/10"
                  >
                    <Link
                      to="/chats"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full flex items-center gap-2 px-4 py-3 rounded-xl bg-gold/15 text-gold font-semibold hover:bg-gold/20 transition-all"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Chats
                    </Link>
                  </motion.div>
                )}
                {!user && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="pt-4 mt-2 border-t border-white/10 grid grid-cols-2 gap-3"
                  >
                    <Link
                      to="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-center px-4 py-3 text-white border border-white/15 rounded-xl hover:border-gold/30 hover:text-gold transition-all font-semibold text-sm"
                    >
                      Log in
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-center px-4 py-3 text-navy rounded-xl font-bold text-sm shadow-lg shadow-gold/20"
                      style={{
                        background:
                          "linear-gradient(135deg, #C8932A 0%, #E0B04A 100%)",
                      }}
                    >
                      Get Started
                    </Link>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>
    </>
  );
};
