import { Heart, Loader2 } from "lucide-react";

const WishlistToggleButton = ({
  active,
  loading,
  onClick,
  className = "",
  titleActive = "Remove from wishlist",
  titleInactive = "Add to wishlist",
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title={active ? titleActive : titleInactive}
      className={`inline-flex items-center justify-center rounded-full border transition-all duration-200 ${
        active
          ? "border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100"
          : "border-white/80 bg-white/90 text-gray-500 hover:bg-white hover:text-rose-600"
      } ${loading ? "cursor-wait opacity-75" : ""} ${className}`}
      aria-label={active ? titleActive : titleInactive}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart className={`h-4 w-4 ${active ? "fill-current" : ""}`} />
      )}
    </button>
  );
};

export default WishlistToggleButton;
