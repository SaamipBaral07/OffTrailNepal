import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import {
  Home,
  MapPin,
  BedDouble,
  Users,
  Star,
  Search,
  SlidersHorizontal,
  ChevronRight,
  Loader2,
  X,
  Mountain,
} from "lucide-react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import LogoutModal from "../components/LogoutModal";

const API = "http://localhost:5000";

const HomestaysPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser } = useAuth();
  const {
    handleLogout: originalHandleLogout,
    handleStayLoggedIn,
    showLogoutModal,
    setShowLogoutModal,
  } = useLogoutHandler();

  const [user, setUser] = useState(null);
  const [homestays, setHomestays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availableRegions, setAvailableRegions] = useState([]);
  const [availableTrails, setAvailableTrails] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedTrailId, setSelectedTrailId] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minRating, setMinRating] = useState("");
  const [sortBy, setSortBy] = useState("recent");

  useEffect(() => {
    if (authUser) setUser(authUser);
  }, [authUser]);

  const handleLogout = () => {
    originalHandleLogout();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const incomingTrailId = params.get("trailId");
    if (incomingTrailId) {
      setSelectedTrailId(incomingTrailId);
    }
  }, [location.search]);

  useEffect(() => {
    const fetchHomestays = async () => {
      try {
        const params = {};
        if (searchQuery.trim()) params.q = searchQuery.trim();
        if (selectedRegion) params.region = selectedRegion;
        if (selectedTrailId) params.trailId = selectedTrailId;
        if (maxPrice) params.maxPrice = maxPrice;
        if (minRating) params.minRating = minRating;
        if (sortBy) params.sort = sortBy;

        const res = await axios.get(`${API}/api/homestays/public`, { params });
        setHomestays(res.data?.homestays || []);
        setAvailableRegions(res.data?.filters?.regions || []);
        setAvailableTrails(res.data?.filters?.trails || []);
      } catch (err) {
        console.error("Error fetching homestays:", err);
        setHomestays([]);
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    const timer = window.setTimeout(fetchHomestays, 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery, selectedRegion, selectedTrailId, maxPrice, minRating, sortBy]);

  const hasActiveFilters = useMemo(
    () => Boolean(searchQuery.trim() || selectedRegion || selectedTrailId || maxPrice || minRating || sortBy !== "recent"),
    [searchQuery, selectedRegion, selectedTrailId, maxPrice, minRating, sortBy]
  );

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedRegion("");
    setSelectedTrailId("");
    setMaxPrice("");
    setMinRating("");
    setSortBy("recent");
    navigate("/homestays", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream via-[#f8f6f2] to-[#f1ece2]">
      <Header user={user} onLogoutClick={() => setShowLogoutModal(true)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
        <section className="rounded-3xl border border-gold/20 bg-gradient-to-r from-navy via-navy-light to-navy-light/90 p-6 sm:p-8 shadow-[0_16px_35px_rgba(12,35,64,0.2)]">
          <p className="text-xs uppercase tracking-[0.2em] text-gold/90 font-semibold">Stay Explorer</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-heading font-extrabold text-white">Browse Trail Homestays</h1>
          <p className="mt-3 max-w-2xl text-sm sm:text-base text-white/70">
            Discover approved local stays along trekking routes. Compare prices, room availability, ratings, and trail context in one place.
          </p>
        </section>

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 text-navy mb-4">
            <SlidersHorizontal className="h-4 w-4" />
            <h2 className="text-sm font-bold uppercase tracking-wide">Filter Homestays</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2 relative">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by homestay, trail, region..."
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
              value={selectedTrailId}
              onChange={(e) => setSelectedTrailId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold text-sm bg-white"
            >
              <option value="">All Trails</option>
              {availableTrails.map((trail) => (
                <option key={trail.trail_id} value={trail.trail_id}>
                  {trail.trail_name}
                </option>
              ))}
            </select>

            <input
              type="number"
              min="1"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max price (NPR)"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold text-sm"
            />

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
                <option value="recent">Newest First</option>
                <option value="price_asc">Lowest Price</option>
                <option value="price_desc">Highest Price</option>
                <option value="rating_desc">Best Rated</option>
                <option value="rooms_desc">Most Rooms Available</option>
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
              {loading ? "Finding homestays..." : `${homestays.length} homestay${homestays.length === 1 ? "" : "s"} found`}
            </p>
          </div>
        </section>

        <section className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {loading ? (
            <div className="sm:col-span-2 lg:col-span-3 flex flex-col items-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-gold" />
              <p className="text-gray-400 text-sm">Loading homestays…</p>
            </div>
          ) : homestays.length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-3 text-center py-16 rounded-2xl border border-dashed border-gray-200 bg-white">
              <Home className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-semibold">No homestays matched your filter</p>
              <p className="text-gray-400 text-sm mt-1">Try adjusting filters or selecting a different trail.</p>
            </div>
          ) : (
            homestays.map((homestay) => {
              const primaryImage = homestay.images?.find((img) => img.is_primary) || homestay.images?.[0];
              const imageUrl = primaryImage
                ? `${API}${primaryImage.image_path}`
                : "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&q=80";
              const availableRooms = Number(homestay.available_rooms || 0);
              const totalRooms = Number(homestay.total_rooms || 0);
              const soldOut = availableRooms <= 0;

              return (
                <motion.article
                  key={homestay.homestay_id}
                  whileHover={{ y: -5 }}
                  transition={{ duration: 0.25 }}
                  className="group bg-white rounded-2xl overflow-hidden shadow-lg shadow-navy/5 border border-gray-100 hover:shadow-xl hover:border-gold/20 transition-all duration-500"
                >
                  <Link to={`/homestays/${homestay.homestay_id}`}>
                    <div className="relative h-52 overflow-hidden">
                      <img
                        src={imageUrl}
                        alt={homestay.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-navy/60 via-transparent to-transparent" />

                      <span className="absolute top-4 left-4 inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-navy backdrop-blur-sm">
                        <Mountain className="h-3.5 w-3.5 text-gold" />
                        {homestay.trail_name}
                      </span>

                      <span className={`absolute top-4 right-4 inline-flex items-center rounded-full px-3 py-1 text-xs font-bold backdrop-blur-sm ${soldOut ? "bg-red-50/95 text-red-700" : "bg-emerald-50/95 text-emerald-700"}`}>
                        {soldOut ? "Sold Out" : `${availableRooms}/${totalRooms || "-"} rooms`}
                      </span>
                    </div>
                  </Link>

                  <div className="p-5">
                    <h3 className="text-lg font-bold text-charcoal mb-1 group-hover:text-navy transition-colors">
                      {homestay.name}
                    </h3>

                    <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-3">
                      <MapPin className="h-3.5 w-3.5 text-gold" />
                      {homestay.location}, {homestay.region}
                    </p>

                    <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2">
                        <p className="text-gray-400">Price / Night</p>
                        <p className="font-bold text-gray-900 mt-0.5">NPR {Number(homestay.price_per_night || 0).toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2">
                        <p className="text-gray-400">Rating</p>
                        <p className="font-bold text-gray-900 mt-0.5 inline-flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                          {Number(homestay.avg_rating || 0).toFixed(1)} ({Number(homestay.total_reviews || 0)})
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-sm text-gray-500 mb-4">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-navy" />
                        {homestay.capacity} guests
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <BedDouble className="h-3.5 w-3.5 text-alpine" />
                        {totalRooms || "-"} rooms
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={`/homestays/${homestay.homestay_id}`}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold hover:text-gold-dark transition-colors"
                      >
                        View Homestay
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                      <Link
                        to={`/trails/${homestay.trail_id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy hover:text-gold transition-colors"
                      >
                        Trail Page
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

export default HomestaysPage;
