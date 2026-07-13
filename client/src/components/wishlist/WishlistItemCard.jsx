import { Link } from "react-router-dom";
import { Heart, MapPin, Mountain, Star, Users } from "lucide-react";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1464822759844-d150ad6d3f2a?w=900&q=80";

const WishlistItemCard = ({ item, onRemove, removing }) => {
  const typeLabel =
    item.item_type === "trail"
      ? "Trail"
      : item.item_type === "homestay"
        ? "Homestay"
        : item.item_type === "guide_package"
          ? "Guide Service"
          : "Item";
  const imageSrc = item.image_path
    ? (String(item.image_path).startsWith("http") ? item.image_path : `http://localhost:5000${item.image_path}`)
    : FALLBACK_IMAGE;

  return (
    <article className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-all duration-200">
      <div className="relative h-48 bg-gray-100">
        {!item.removed ? (
          <img src={imageSrc} alt={item.title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Unavailable</span>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full border border-white/60 bg-white/90 px-2.5 py-1 text-[11px] font-bold text-navy">
          {typeLabel}
        </span>
      </div>

      <div className="p-4">
        <h3 className="text-base font-bold text-charcoal line-clamp-1">{item.title}</h3>
        <p className="mt-1 text-sm text-gray-500 line-clamp-2">{item.subtitle}</p>

        {!item.removed && item.item_type === "trail" && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700 font-semibold">
              <Mountain className="h-3 w-3" /> {item.metadata?.difficulty_level || "-"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700 font-semibold">
              <MapPin className="h-3 w-3" /> {item.metadata?.duration_days || 0} days
            </span>
          </div>
        )}

        {!item.removed && item.item_type === "homestay" && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700 font-semibold">
              NPR {Number(item.metadata?.price_per_night || 0).toLocaleString()} / person / night
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700 font-semibold">
              <Star className="h-3 w-3 fill-current" /> {Number(item.metadata?.avg_rating || 0).toFixed(1)}
            </span>
          </div>
        )}

        {!item.removed && item.item_type === "guide_package" && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-violet-700 font-semibold">
              <Users className="h-3 w-3" /> Max {Number(item.metadata?.max_group_size || 1)} pax
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700 font-semibold">
              NPR {Number(item.metadata?.price_per_day || 0).toLocaleString()} / day
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700 font-semibold">
              <Star className="h-3 w-3 fill-current" /> {Number(item.metadata?.avg_rating || 0).toFixed(1)}
            </span>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          {item.href ? (
            <Link
              to={item.href}
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              View
            </Link>
          ) : (
            <span className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">
              Listing unavailable
            </span>
          )}

          <button
            type="button"
            onClick={() => onRemove(item)}
            disabled={removing}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
          >
            <Heart className="h-3.5 w-3.5 fill-current" /> Remove
          </button>
        </div>
      </div>
    </article>
  );
};

export default WishlistItemCard;
