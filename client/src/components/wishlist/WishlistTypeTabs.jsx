const TAB_CONFIG = [
  { id: "trail", label: "Trails" },
  { id: "homestay", label: "Homestays" },
  { id: "guide_package", label: "Guide Services" },
];

const WishlistTypeTabs = ({ activeType, counts, onChange }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {TAB_CONFIG.map((tab) => {
        const isActive = activeType === tab.id;
        const count = Number(counts?.[tab.id] || 0);

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
              isActive
                ? "border-gold/50 bg-gradient-to-r from-gold/20 to-gold/10 text-gold-dark shadow-sm"
                : "border-gray-200 bg-white text-gray-600 hover:border-gold/30 hover:text-navy"
            }`}
          >
            {tab.label}
            <span className={`inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
              isActive ? "bg-gold/30 text-gold-dark" : "bg-gray-100 text-gray-500"
            }`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default WishlistTypeTabs;
