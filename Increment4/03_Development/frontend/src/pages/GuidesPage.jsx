import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import {
  Compass,
  Search,
  SlidersHorizontal,
  Star,
  Briefcase,
  Route,
  Phone,
  Loader2,
  ChevronRight,
  X,
} from "lucide-react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import LogoutModal from "../components/LogoutModal";
import { useWishlist } from "../hooks/useWishlist";
import WishlistToggleButton from "../components/wishlist/WishlistToggleButton";

const API = "http://localhost:5000";

const GuidesPage = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const {
    handleLogout: originalHandleLogout,
    handleStayLoggedIn,
    showLogoutModal,
    setShowLogoutModal,
  } = useLogoutHandler();

  const [user, setUser] = useState(null);
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availableRegions, setAvailableRegions] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [minRating, setMinRating] = useState("");
  const [sortBy, setSortBy] = useState("experience_desc");

  const { isTourist, isWishlisted, isUpdating, toggleWishlist } = useWishlist();

  useEffect(() => {
    if (authUser) setUser(authUser);
  }, [authUser]);

  const handleLogout = () => {
    originalHandleLogout();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    const fetchGuides = async () => {
      try {
        const params = {};
        if (searchQuery.trim()) params.q = searchQuery.trim();
        if (selectedRegion) params.region = selectedRegion;
        if (minRating) params.minRating = minRating;
        if (sortBy) params.sort = sortBy;

        const res = await axios.get(`${API}/api/guides/public`, { params });
        setGuides(Array.isArray(res.data?.guides) ? res.data.guides : []);
        setAvailableRegions(Array.isArray(res.data?.filters?.regions) ? res.data.filters.regions : []);
      } catch (err) {
        console.error("Error fetching public guides:", err);
        setGuides([]);
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    const timer = window.setTimeout(fetchGuides, 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery, selectedRegion, minRating, sortBy]);

  const hasActiveFilters = useMemo(
    () => Boolean(searchQuery.trim() || selectedRegion || minRating || sortBy !== "experience_desc"),
    [searchQuery, selectedRegion, minRating, sortBy]
  );

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedRegion("");
    setMinRating("");
    setSortBy("experience_desc");
  };

  const handleToggleGuideWishlist = async (guideId) => {
    const result = await toggleWishlist("guide", guideId);
    if (!result.ok && result.reason === "login-required") {
      navigate("/login", { replace: false });
      return;
    }
    if (!result.ok && result.message) {
      window.alert(result.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream via-[#f8f6f2] to-[#f1ece2]">
      <Header user={user} onLogoutClick={() => setShowLogoutModal(true)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
        <section className="rounded-3xl border border-gold/20 bg-gradient-to-r from-navy via-navy-light to-navy-light/90 p-6 sm:p-8 shadow-[0_16px_35px_rgba(12,35,64,0.2)]">
          <p className="text-xs uppercase tracking-[0.2em] text-gold/90 font-semibold">Guide Explorer</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-heading font-extrabold text-white">Find Certified Trek Guides</h1>
          <p className="mt-3 max-w-3xl text-sm sm:text-base text-white/70">
            Browse approved and active guides in OffTrail Nepal. Compare experience, ratings, assigned trails, and available guide packages before your next trek.
          </p>
        </section>

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 text-navy mb-4">
            <SlidersHorizontal className="h-4 w-4" />
            <h2 className="text-sm font-bold uppercase tracking-wide">Filter Guides</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-2 relative">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search guide name, trail, or region..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold text-sm"
              />
            </div>

            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold text-sm bg-white"
            >
              <option value="">All Regions</option>
              {availableRegions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>

            <select
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold text-sm bg-white"
            >
              <option value="">Any Rating</option>
              <option value="4.5">4.5+ rating</option>
              <option value="4">4.0+ rating</option>
              <option value="3">3.0+ rating</option>
            </select>
          </div>

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold text-sm bg-white"
              >
                <option value="experience_desc">Most Experienced</option>
                <option value="rating_desc">Highest Rated</option>
                <option value="reviews_desc">Most Reviewed</option>
                <option value="price_asc">Lowest Starting Price</option>
                <option value="name_asc">Name A-Z</option>
              </select>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:text-navy hover:border-gold/40 transition-colors"
                >
                  <X className="h-4 w-4" />
                  Clear Filters
                </button>
              )}
            </div>

            <p className="text-sm text-gray-500">
              {loading ? "Finding guides..." : `${guides.length} guide${guides.length === 1 ? "" : "s"} found`}
            </p>
          </div>
        </section>

        <section className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="sm:col-span-2 lg:col-span-3 flex flex-col items-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-gold" />
              <p className="text-gray-400 text-sm">Loading guides...</p>
            </div>
          ) : guides.length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-3 text-center py-16 rounded-2xl border border-dashed border-gray-200 bg-white">
              <Compass className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-semibold">No guides matched your filters</p>
              <p className="text-gray-400 text-sm mt-1">Try broader filters or clear all filters.</p>
            </div>
          ) : (
            guides.map((guide) => {
              const trails = Array.isArray(guide.trails) ? guide.trails : [];
              const topTrails = trails.slice(0, 3);
              const firstTrailId = topTrails[0]?.trail_id;

              return (
                <motion.article
                  key={guide.guide_id}
                  whileHover={{ y: -5 }}
                  transition={{ duration: 0.25 }}
                  className="group bg-white rounded-2xl border border-gray-100 shadow-lg shadow-navy/5 hover:shadow-xl hover:border-gold/25 transition-all duration-500 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-gold to-[#D4A43A] text-navy font-bold text-lg flex items-center justify-center shadow-md">
                        {String(guide.full_name || "G").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-charcoal truncate">{guide.full_name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5 inline-flex items-center gap-1.5">
                          <Briefcase className="h-3.5 w-3.5 text-gold" />
                          {guide.experience_years} years experience
                        </p>
                      </div>
                    </div>

                    {isTourist && (
                      <WishlistToggleButton
                        active={isWishlisted("guide", guide.guide_id)}
                        loading={isUpdating("guide", guide.guide_id)}
                        onClick={() => handleToggleGuideWishlist(guide.guide_id)}
                        className="h-9 w-9 border-gray-200 bg-white text-gray-500 hover:text-rose-600"
                      />
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
                      <p className="text-amber-700 uppercase tracking-wide">Rating</p>
                      <p className="font-bold text-amber-800 mt-0.5 inline-flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                        {Number(guide.avg_rating || 0).toFixed(1)} ({Number(guide.total_reviews || 0)})
                      </p>
                    </div>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2">
                      <p className="text-blue-700 uppercase tracking-wide">Services</p>
                      <p className="font-bold text-blue-800 mt-0.5">{Number(guide.total_services || 0)} active</p>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2">
                      <p className="text-emerald-700 uppercase tracking-wide">Assigned Trails</p>
                      <p className="font-bold text-emerald-800 mt-0.5">{Number(guide.total_trails || 0)}</p>
                    </div>
                    <div className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-2">
                      <p className="text-violet-700 uppercase tracking-wide">Starting Price</p>
                      <p className="font-bold text-violet-800 mt-0.5">
                        {Number.isFinite(Number(guide.starting_price))
                          ? `NPR ${Number(guide.starting_price).toLocaleString()}/day`
                          : "Not listed"}
                      </p>
                    </div>
                  </div>

                  {topTrails.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 mb-2">Popular Assigned Trails</p>
                      <div className="flex flex-wrap gap-1.5">
                        {topTrails.map((trail) => (
                          <Link
                            key={`${guide.guide_id}-${trail.trail_id}`}
                            to={`/trails/${trail.trail_id}`}
                            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:border-gold/40 hover:text-navy"
                          >
                            <Route className="h-3 w-3 text-gold" />
                            {trail.trail_name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between gap-2 pt-4 border-t border-gray-100">
                    {guide.phone ? (
                      <a
                        href={`tel:${guide.phone}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy hover:text-gold"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        Contact Guide
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">Phone unavailable</span>
                    )}

                    {firstTrailId ? (
                      <Link
                        to={`/trails/${firstTrailId}`}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold hover:text-gold-dark"
                      >
                        View Packages
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-400">No trail linked yet</span>
                    )}
                  </div>
                </motion.article>
              );
            })
          )}
        </section>
      </main>

      <Footer />

      <LogoutModal
        isOpen={showLogoutModal}
        onConfirm={handleLogout}
        onCancel={handleStayLoggedIn}
      />
    </div>
  );
};

export default GuidesPage;
