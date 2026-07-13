import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";

const VALID_TYPES = new Set(["trail", "homestay", "guide_package"]);

const normalizeType = (value) => String(value || "").trim().toLowerCase();

const toInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const keyFor = (itemType, itemId) => `${itemType}:${itemId}`;

export const useWishlist = () => {
  const { user } = useAuth();
  const [idsByType, setIdsByType] = useState({
    trail: [],
    homestay: [],
    guide_package: [],
  });
  const [loadingIds, setLoadingIds] = useState(false);
  const [updatingKeys, setUpdatingKeys] = useState({});

  const isTourist = user?.user_type === "tourist";

  const idSets = useMemo(
    () => ({
      trail: new Set(idsByType.trail || []),
      homestay: new Set(idsByType.homestay || []),
      guide_package: new Set(idsByType.guide_package || []),
    }),
    [idsByType]
  );

  const fetchWishlistIds = useCallback(async () => {
    if (!isTourist) {
      setIdsByType({ trail: [], homestay: [], guide_package: [] });
      return;
    }

    setLoadingIds(true);
    try {
      const res = await api.get("/api/wishlist/ids");
      const nextIds = res.data?.ids || {};
      setIdsByType({
        trail: Array.isArray(nextIds.trail) ? nextIds.trail.map((id) => Number(id)).filter(Boolean) : [],
        homestay: Array.isArray(nextIds.homestay) ? nextIds.homestay.map((id) => Number(id)).filter(Boolean) : [],
        guide_package: Array.isArray(nextIds.guide_package)
          ? nextIds.guide_package.map((id) => Number(id)).filter(Boolean)
          : [],
      });
    } catch (err) {
      console.error("Error loading wishlist ids:", err);
    } finally {
      setLoadingIds(false);
    }
  }, [isTourist]);

  useEffect(() => {
    fetchWishlistIds();
  }, [fetchWishlistIds]);

  const isWishlisted = useCallback(
    (itemType, itemId) => {
      const normalizedType = normalizeType(itemType);
      const numericId = toInt(itemId);
      if (!VALID_TYPES.has(normalizedType) || !numericId) return false;
      return idSets[normalizedType]?.has(numericId) || false;
    },
    [idSets]
  );

  const isUpdating = useCallback((itemType, itemId) => {
    const normalizedType = normalizeType(itemType);
    const numericId = toInt(itemId);
    if (!VALID_TYPES.has(normalizedType) || !numericId) return false;
    return Boolean(updatingKeys[keyFor(normalizedType, numericId)]);
  }, [updatingKeys]);

  const toggleWishlist = useCallback(async (itemType, itemId) => {
    const normalizedType = normalizeType(itemType);
    const numericId = toInt(itemId);

    if (!user) {
      return { ok: false, reason: "login-required", message: "Please login to use wishlist." };
    }

    if (!isTourist) {
      return { ok: false, reason: "tourist-only", message: "Only tourist accounts can use wishlist." };
    }

    if (!VALID_TYPES.has(normalizedType) || !numericId) {
      return { ok: false, reason: "invalid-item", message: "Invalid wishlist item." };
    }

    const updateKey = keyFor(normalizedType, numericId);
    if (updatingKeys[updateKey]) {
      return { ok: false, reason: "already-updating", message: "Wishlist update in progress." };
    }

    setUpdatingKeys((prev) => ({ ...prev, [updateKey]: true }));

    try {
      const res = await api.post("/api/wishlist/toggle", {
        item_type: normalizedType,
        item_id: numericId,
      });

      const wishlisted = Boolean(res.data?.wishlisted);

      setIdsByType((prev) => {
        const existing = Array.isArray(prev[normalizedType]) ? prev[normalizedType] : [];
        const exists = existing.includes(numericId);
        let next = existing;

        if (wishlisted && !exists) {
          next = [...existing, numericId];
        } else if (!wishlisted && exists) {
          next = existing.filter((id) => id !== numericId);
        }

        return {
          ...prev,
          [normalizedType]: next,
        };
      });

      return {
        ok: true,
        wishlisted,
        message: res.data?.message || (wishlisted ? "Added to wishlist" : "Removed from wishlist"),
      };
    } catch (err) {
      return {
        ok: false,
        reason: "request-failed",
        message: err.response?.data?.message || "Failed to update wishlist",
      };
    } finally {
      setUpdatingKeys((prev) => {
        const next = { ...prev };
        delete next[updateKey];
        return next;
      });
    }
  }, [isTourist, updatingKeys, user]);

  return {
    isTourist,
    loadingIds,
    idsByType,
    fetchWishlistIds,
    isWishlisted,
    isUpdating,
    toggleWishlist,
  };
};

export default useWishlist;
