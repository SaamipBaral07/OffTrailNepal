import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Loader2 } from "lucide-react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import LogoutModal from "../components/LogoutModal";
import WishlistTypeTabs from "../components/wishlist/WishlistTypeTabs";
import WishlistItemCard from "../components/wishlist/WishlistItemCard";
import { useAuth } from "../context/AuthContext";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import { getToken } from "../tokenStore";
import api from "../api";

const TYPE_LABEL = {
  trail: "trails",
  homestay: "homestays",
  guide: "guides",
};

const WishlistPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { handleLogout, handleStayLoggedIn, showLogoutModal, setShowLogoutModal } = useLogoutHandler();

  const [activeType, setActiveType] = useState("trail");
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ trail: 0, homestay: 0, guide: 0 });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 9,
    total_records: 0,
    total_pages: 1,
    has_prev: false,
    has_next: false,
  });
  const [loadingItems, setLoadingItems] = useState(true);
  const [actionBusyKey, setActionBusyKey] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!getToken() || !user) {
      navigate("/login", { replace: true });
      return;
    }
    if (user.user_type !== "tourist") {
      navigate("/", { replace: true });
    }
  }, [loading, navigate, user]);

  const fetchWishlist = useCallback(async (type = activeType, page = pagination.page) => {
    setLoadingItems(true);
    setError("");

    try {
      const res = await api.get("/api/wishlist", {
        params: {
          type,
          page,
          limit: pagination.limit,
        },
      });

      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      setCounts(res.data?.counts || { trail: 0, homestay: 0, guide: 0 });
      setPagination((prev) => ({
        ...prev,
        ...(res.data?.pagination || {}),
      }));
    } catch (err) {
      setItems([]);
      setError(err.response?.data?.message || "Failed to load wishlist");
    } finally {
      setLoadingItems(false);
    }
  }, [activeType, pagination.limit, pagination.page]);

  useEffect(() => {
    if (!user || user.user_type !== "tourist") return;
    fetchWishlist(activeType, pagination.page);
  }, [activeType, fetchWishlist, pagination.page, user]);

  const handleTypeChange = (nextType) => {
    if (nextType === activeType) return;
    setActiveType(nextType);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleRemove = async (item) => {
    const key = `${item.item_type}:${item.item_id}`;
    setActionBusyKey(key);

    try {
      await api.delete(`/api/wishlist/${item.item_type}/${item.item_id}`);
      await fetchWishlist(activeType, pagination.page);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove wishlist item");
    } finally {
      setActionBusyKey("");
    }
  };

  const sectionTitle = useMemo(() => {
    const noun = TYPE_LABEL[activeType] || "items";
    return `Saved ${noun}`;
  }, [activeType]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f4f2ee] via-[#faf8f4] to-[#f2efe8]">
      <Header user={user} onLogoutClick={() => setShowLogoutModal(true)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 space-y-6">
        <section className="rounded-3xl border border-navy/10 bg-white/95 p-6 sm:p-8 shadow-[0_10px_28px_rgba(12,35,64,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="uppercase text-[11px] tracking-[0.24em] text-gold-dark font-semibold mb-2">Tourist Wishlist</p>
              <h1 className="text-3xl sm:text-4xl font-heading text-charcoal">My Wishlist</h1>
              <p className="text-gray-500 mt-2">Keep trails, homestays, and guides in one place before booking.</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">
              <Heart className="h-4 w-4 fill-current" />
              {counts.trail + counts.homestay + counts.guide} saved
            </span>
          </div>

          <div className="mt-5">
            <WishlistTypeTabs activeType={activeType} counts={counts} onChange={handleTypeChange} />
          </div>
        </section>

        <section className="rounded-3xl border border-navy/10 bg-white p-5 sm:p-6 shadow-[0_8px_22px_rgba(12,35,64,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold text-charcoal">{sectionTitle}</h2>
            <p className="text-xs text-gray-500">Page {pagination.page} of {pagination.total_pages}</p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {loadingItems ? (
            <div className="py-14 flex items-center justify-center text-gray-500 gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading wishlist...
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
              <Heart className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-semibold">No saved {TYPE_LABEL[activeType] || "items"} yet</p>
              <p className="text-sm text-gray-500 mt-1">Use the heart icon while browsing to add items here.</p>
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {items.map((item) => (
                  <WishlistItemCard
                    key={`${item.item_type}-${item.item_id}`}
                    item={item}
                    onRemove={handleRemove}
                    removing={actionBusyKey === `${item.item_type}:${item.item_id}`}
                  />
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs text-gray-500">
                  Showing {items.length} of {pagination.total_records} saved {TYPE_LABEL[activeType] || "items"}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!pagination.has_prev || loadingItems}
                    onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={!pagination.has_next || loadingItems}
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
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

export default WishlistPage;
