import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import {
  Mountain,
  MapPin,
  Clock,
  TrendingUp,
  Search,
  SlidersHorizontal,
  ChevronRight,
  Loader2,
  X,
} from "lucide-react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import LogoutModal from "../components/LogoutModal";

const API = "http://localhost:5000";

const difficultyTag = {
  Easy: "Beginner Friendly",
  Moderate: "Most Popular",
  Difficult: "Challenging",
  Extreme: "Expert Only",
};

const TrailsPage = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const {
    handleLogout: originalHandleLogout,
    handleStayLoggedIn,
    showLogoutModal,
    setShowLogoutModal,
  } = useLogoutHandler();

  const [user, setUser] = useState(null);
  const [trails, setTrails] = useState([]);
  const [trailsLoading, setTrailsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("");
  const [maxDuration, setMaxDuration] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [availableRegions, setAvailableRegions] = useState([]);
  const [availableDifficulties, setAvailableDifficulties] = useState([]);

  useEffect(() => {
    if (authUser) setUser(authUser);
  }, [authUser]);

  const handleLogout = () => {
    originalHandleLogout();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    const fetchTrails = async () => {
      try {
        const params = {};
        if (searchQuery.trim()) params.q = searchQuery.trim();
        if (selectedRegion) params.region = selectedRegion;
        if (selectedDifficulty) params.difficulty = selectedDifficulty;
        if (maxDuration) params.maxDuration = maxDuration;
        if (sortBy) params.sort = sortBy;

        const res = await axios.get(`${API}/api/trails/public`, { params });
        setTrails(res.data?.trails || []);
        setAvailableRegions(res.data?.filters?.regions || []);
        setAvailableDifficulties(res.data?.filters?.difficulties || []);
      } catch (err) {
        console.error("Error fetching trails:", err);
        setTrails([]);
      } finally {
        setTrailsLoading(false);
      }
    };

    setTrailsLoading(true);
    const timer = window.setTimeout(fetchTrails, 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery, selectedRegion, selectedDifficulty, maxDuration, sortBy]);

  const hasActiveFilters = useMemo(
    () => Boolean(searchQuery.trim() || selectedRegion || selectedDifficulty || maxDuration || sortBy !== "recent"),
    [searchQuery, selectedRegion, selectedDifficulty, maxDuration, sortBy]
  );

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedRegion("");
    setSelectedDifficulty("");
    setMaxDuration("");
    setSortBy("recent");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream via-[#f8f6f2] to-[#f1ece2]">
      <Header user={user} onLogoutClick={() => setShowLogoutModal(true)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
        <section className="rounded-3xl border border-gold/20 bg-gradient-to-r from-navy via-navy-light to-navy-light/90 p-6 sm:p-8 shadow-[0_16px_35px_rgba(12,35,64,0.2)]">
          <p className="text-xs uppercase tracking-[0.2em] text-gold/90 font-semibold">Public Explorer</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-heading font-extrabold text-white">Explore Trekking Trails</h1>
          <p className="mt-3 max-w-2xl text-sm sm:text-base text-white/70">
            Browse all verified trails listed by OffTrail Nepal admins. Compare difficulty, duration, and elevation before choosing your next route.
          </p>
        </section>

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 text-navy mb-4">
            <SlidersHorizontal className="h-4 w-4" />
            <h2 className="text-sm font-bold uppercase tracking-wide">Find Trails Faster</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2 relative">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search trail name, region, description..."
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
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold text-sm bg-white"
            >
              <option value="">All Difficulties</option>
              {availableDifficulties.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>

            <select
              value={maxDuration}
              onChange={(e) => setMaxDuration(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold text-sm bg-white"
            >
              <option value="">Any Duration</option>
              <option value="3">Up to 3 days</option>
              <option value="7">Up to 7 days</option>
              <option value="14">Up to 14 days</option>
              <option value="21">Up to 21 days</option>
            </select>
          </div>

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold text-sm bg-white"
              >
                <option value="recent">Newest First</option>
                <option value="name_asc">Name A-Z</option>
                <option value="duration_asc">Shortest Duration</option>
                <option value="altitude_desc">Highest Altitude</option>
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
              {trailsLoading ? "Finding trails..." : `${trails.length} trail${trails.length === 1 ? "" : "s"} found`}
            </p>
          </div>
        </section>

        <section className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {trailsLoading ? (
            <div className="sm:col-span-2 lg:col-span-3 flex flex-col items-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-gold" />
              <p className="text-gray-400 text-sm">Loading trails…</p>
            </div>
          ) : trails.length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-3 text-center py-16 rounded-2xl border border-dashed border-gray-200 bg-white">
              <Mountain className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-semibold">No trails matched your filter</p>
              <p className="text-gray-400 text-sm mt-1">Try broader filters or clear all filters.</p>
            </div>
          ) : (
            trails.map((trail) => {
              const primaryImage = trail.images?.find((img) => img.is_primary);
              const imageUrl = primaryImage
                ? `${API}${primaryImage.image_path}`
                : "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&q=80";
              const tag = difficultyTag[trail.difficulty_level] || trail.difficulty_level;

              return (
                <motion.article
                  key={trail.trail_id}
                  whileHover={{ y: -5 }}
                  transition={{ duration: 0.25 }}
                  className="group bg-white rounded-2xl overflow-hidden shadow-lg shadow-navy/5 border border-gray-100 hover:shadow-xl hover:border-gold/20 transition-all duration-500"
                >
                  <Link to={`/trails/${trail.trail_id}`}>
                    <div className="relative h-52 overflow-hidden">
                      <img
                        src={imageUrl}
                        alt={trail.trail_name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-navy/60 via-transparent to-transparent" />
                      <span
                        className="absolute top-4 left-4 px-3 py-1 text-navy text-xs font-bold rounded-full backdrop-blur-sm"
                        style={{
                          background: "linear-gradient(135deg, rgba(200,147,42,0.9), rgba(224,176,74,0.9))",
                        }}
                      >
                        {tag}
                      </span>
                      {trail.max_altitude && (
                        <div className="absolute bottom-4 right-4 flex items-center gap-1 px-2.5 py-1 bg-white/90 backdrop-blur-sm rounded-full">
                          <Mountain className="h-3.5 w-3.5 text-gold" />
                          <span className="text-xs font-bold text-navy">{Number(trail.max_altitude).toLocaleString()}m</span>
                        </div>
                      )}
                    </div>
                  </Link>

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

                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={`/trails/${trail.trail_id}`}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold hover:text-gold-dark transition-colors"
                      >
                        View Trail
                        <ChevronRight className="h-4 w-4" />
                      </Link>

                      <Link
                        to={`/homestays?trailId=${trail.trail_id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy hover:text-gold transition-colors"
                      >
                        Stay Options
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
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

export default TrailsPage;
