import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import {
  LogOut,
  Home,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Phone,
  DollarSign,
  Users,
  Mountain,
  X,
  Upload,
  Image,
  Loader2,
  Eye,
  EyeOff,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import LogoutModal from "../components/LogoutModal";
import { useAuth } from "../context/AuthContext";
import { getToken } from "../tokenStore";

const API = "http://localhost:5000/api";

/* ─────────────────────────────────────────
   STATUS BADGE
───────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const config = {
    pending: {
      bg: "bg-amber-50 border-amber-200",
      text: "text-amber-700",
      icon: Clock,
      label: "Pending Review",
    },
    approved: {
      bg: "bg-emerald-50 border-emerald-200",
      text: "text-emerald-700",
      icon: CheckCircle,
      label: "Approved",
    },
    rejected: {
      bg: "bg-red-50 border-red-200",
      text: "text-red-700",
      icon: XCircle,
      label: "Rejected",
    },
  };

  const c = config[status] || config.pending;
  const Icon = c.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.text}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {c.label}
    </span>
  );
};

/* ─────────────────────────────────────────
   STAT CARD
───────────────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, accent }) => {
  const accents = {
    blue: "from-blue-500 to-blue-600",
    emerald: "from-emerald-500 to-teal-500",
    amber: "from-amber-500 to-orange-500",
    purple: "from-violet-500 to-purple-600",
  };
  return (
    <div className="relative bg-white rounded-2xl p-5 border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
      <div
        className={`absolute -right-4 -top-4 w-20 h-20 rounded-full bg-gradient-to-br ${accents[accent]} opacity-10 group-hover:opacity-20 transition-opacity`}
      />
      <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${accents[accent]} mb-3`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <p className="text-2xl font-bold text-gray-900 font-mono">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  );
};

/* ─────────────────────────────────────────
   CREATE / EDIT FORM
───────────────────────────────────────── */
const HomestayForm = ({ trails, onSubmit, onCancel, initialData, isSubmitting }) => {
  const [form, setForm] = useState({
    trail_id: initialData?.trail_id || "",
    name: initialData?.name || "",
    location: initialData?.location || "",
    price_per_night: initialData?.price_per_night || "",
    capacity: initialData?.capacity || "",
    description: initialData?.description || "",
    latitude: initialData?.latitude || "",
    longitude: initialData?.longitude || "",
    contact_phone: initialData?.contact_phone || "",
    amenities: Array.isArray(initialData?.amenities) ? initialData.amenities.join(", ") : initialData?.amenities || "",
    total_rooms: initialData?.total_rooms || "1",
    available_rooms: initialData?.available_rooms ?? initialData?.total_rooms ?? "1",
    google_map_iframe_link: initialData?.google_map_iframe_link || "",
  });
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setImages(files);
    const previews = files.map((f) => URL.createObjectURL(f));
    setImagePreviews(previews);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value !== "" && value !== null && value !== undefined) {
        formData.append(key, value);
      }
    });
    images.forEach((img) => formData.append("images", img));
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-xl font-bold text-gray-900">
            {initialData ? "Edit Homestay" : "Create New Homestay"}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Trail Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Trail <span className="text-red-500">*</span>
            </label>
            <select
              name="trail_id"
              value={form.trail_id}
              onChange={handleChange}
              required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 transition-colors"
            >
              <option value="">Select a trail...</option>
              {trails.map((trail) => (
                <option key={trail.trail_id} value={trail.trail_id}>
                  {trail.trail_name} — {trail.region} ({trail.difficulty_level})
                </option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Homestay Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              maxLength={120}
              placeholder="e.g. Mountain View Homestay"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Location <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="location"
              value={form.location}
              onChange={handleChange}
              required
              maxLength={150}
              placeholder="e.g. Ghandruk Village, Kaski"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
            />
          </div>

          {/* Price & Capacity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Price / Night (NPR) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="price_per_night"
                value={form.price_per_night}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                placeholder="1500"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Capacity (guests) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="capacity"
                value={form.capacity}
                onChange={handleChange}
                required
                min="1"
                placeholder="6"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
              />
            </div>
          </div>

          {/* Room Inventory */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Total Rooms <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="total_rooms"
                value={form.total_rooms}
                onChange={handleChange}
                required
                min="1"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Available Rooms <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="available_rooms"
                value={form.available_rooms}
                onChange={handleChange}
                required
                min="0"
                max={form.total_rooms || undefined}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
              />
            </div>
          </div>

          {/* Amenities */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Amenities
            </label>
            <textarea
              name="amenities"
              value={form.amenities}
              onChange={handleChange}
              rows={2}
              placeholder="WiFi, Hot Shower, Breakfast, Heater"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">Separate amenities by commas.</p>
          </div>

          {/* Google map iframe link */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Google Maps Embed Link / iframe
            </label>
            <input
              type="text"
              name="google_map_iframe_link"
              value={form.google_map_iframe_link}
              onChange={handleChange}
              placeholder="https://www.google.com/maps/embed?... or full iframe code"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
            />
          </div>

          {/* Contact Phone */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Contact Phone
            </label>
            <input
              type="text"
              name="contact_phone"
              value={form.contact_phone}
              onChange={handleChange}
              maxLength={20}
              placeholder="+977-98XXXXXXXX"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
            />
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Latitude
              </label>
              <input
                type="number"
                name="latitude"
                value={form.latitude}
                onChange={handleChange}
                step="0.00000001"
                placeholder="28.37190000"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Longitude
              </label>
              <input
                type="number"
                name="longitude"
                value={form.longitude}
                onChange={handleChange}
                step="0.00000001"
                placeholder="83.80210000"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Description
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
              placeholder="Describe your homestay — amenities, views, meals included, etc."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 resize-none"
            />
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Photos {!initialData && "(first image will be primary)"}
            </label>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
              <Upload className="h-8 w-8 text-gray-400 mb-2" />
              <span className="text-sm text-gray-500">Click to upload images (max 5)</span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
            {imagePreviews.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {imagePreviews.map((preview, i) => (
                  <div key={i} className="relative">
                    <img
                      src={preview}
                      alt={`Preview ${i + 1}`}
                      className="h-20 w-20 object-cover rounded-lg border"
                    />
                    {i === 0 && !initialData && (
                      <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                        Primary
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Existing images (edit mode) */}
          {initialData?.images && initialData.images.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Current Photos
              </label>
              <div className="flex gap-2 flex-wrap">
                {initialData.images.map((img) => (
                  <div key={img.image_id} className="relative">
                    <img
                      src={`http://localhost:5000${img.image_path}`}
                      alt="Homestay"
                      className="h-20 w-20 object-cover rounded-lg border"
                    />
                    {img.is_primary && (
                      <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                        Primary
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-semibold transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {initialData ? "Updating..." : "Creating..."}
                </>
              ) : initialData ? (
                "Update Homestay"
              ) : (
                "Create Homestay"
              )}
            </button>
          </div>

          {!initialData && (
            <p className="text-xs text-gray-400 text-center">
              Your listing will be sent to admin for approval before it goes live.
            </p>
          )}
          {initialData && (
            <p className="text-xs text-amber-500 text-center">
              Editing will reset your listing status to "Pending Review".
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   DELETE CONFIRMATION MODAL
───────────────────────────────────────── */
const DeleteModal = ({ homestayName, onConfirm, onCancel, isDeleting }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 bg-red-100 rounded-xl">
          <Trash2 className="h-6 w-6 text-red-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Delete Homestay</h3>
          <p className="text-sm text-gray-500">This action cannot be undone</p>
        </div>
      </div>
      <p className="text-gray-600 mb-6">
        Are you sure you want to delete <strong>"{homestayName}"</strong>? All associated images
        and data will be permanently removed.
      </p>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isDeleting}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl font-semibold transition-colors"
        >
          {isDeleting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Deleting...
            </>
          ) : (
            "Delete"
          )}
        </button>
      </div>
    </div>
  </div>
);

/* ─────────────────────────────────────────
   HOMESTAY CARD
───────────────────────────────────────── */
const HomestayCard = ({ homestay, onEdit, onDelete, onToggleActive, onUpdateRooms, expanded, onToggleExpand }) => {
  const primaryImage = homestay.images?.find((img) => img.is_primary);
  const hasImages = homestay.images && homestay.images.length > 0;
  const [availableRoomsInput, setAvailableRoomsInput] = useState(String(homestay.available_rooms ?? 0));
  const [totalRoomsInput, setTotalRoomsInput] = useState(String(homestay.total_rooms ?? 1));

  useEffect(() => {
    setAvailableRoomsInput(String(homestay.available_rooms ?? 0));
    setTotalRoomsInput(String(homestay.total_rooms ?? 1));
  }, [homestay.available_rooms, homestay.total_rooms]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      {/* Card Header with Image */}
      <div className="relative">
        {hasImages ? (
          <img
            src={`http://localhost:5000${primaryImage?.image_path || homestay.images[0].image_path}`}
            alt={homestay.name}
            className="w-full h-48 object-cover"
          />
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
            <Home className="h-16 w-16 text-blue-300" />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <StatusBadge status={homestay.verified_status} />
        </div>
        {!homestay.is_active && (
          <div className="absolute top-3 right-3 bg-gray-800/80 text-white text-xs px-2 py-1 rounded-full">
            Inactive
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-bold text-gray-900 leading-tight">{homestay.name}</h3>
          <button onClick={() => onToggleExpand(homestay.homestay_id)} className="ml-2 mt-0.5">
            {expanded ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1">
          <MapPin className="h-3.5 w-3.5" />
          {homestay.location}
        </div>
        <div className="flex items-center gap-1.5 text-sm text-blue-600 mb-3">
          <Mountain className="h-3.5 w-3.5" />
          {homestay.trail_name} — {homestay.region}
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-700 mb-4">
          <span className="flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
            NPR {Number(homestay.price_per_night).toLocaleString()}/night
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-violet-500" />
            {homestay.capacity} guests
          </span>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${Number(homestay.available_rooms) > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            Rooms: {homestay.available_rooms ?? 0}/{homestay.total_rooms ?? 0}
          </span>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="border-t border-gray-100 pt-4 mt-2 space-y-3">
            {homestay.description && (
              <p className="text-sm text-gray-600 leading-relaxed">{homestay.description}</p>
            )}
            {Array.isArray(homestay.amenities) && homestay.amenities.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Amenities</p>
                <div className="flex flex-wrap gap-2">
                  {homestay.amenities.map((a, idx) => (
                    <span key={`${a}-${idx}`} className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {homestay.contact_phone && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <Phone className="h-3.5 w-3.5" />
                {homestay.contact_phone}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                Total Rooms: <span className="font-semibold text-gray-800">{homestay.total_rooms ?? 0}</span>
              </div>
              <div className={`text-sm rounded-lg px-3 py-2 border ${Number(homestay.available_rooms) > 0 ? "text-emerald-700 bg-emerald-50 border-emerald-100" : "text-red-700 bg-red-50 border-red-100"}`}>
                Available Now: <span className="font-semibold">{homestay.available_rooms ?? 0}</span>
              </div>
            </div>

            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateRooms(homestay.homestay_id, totalRoomsInput, availableRoomsInput);
              }}
            >
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Rooms</label>
                <input
                  type="number"
                  min="1"
                  value={totalRoomsInput}
                  onChange={(e) => setTotalRoomsInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Update Available Rooms</label>
                <input
                  type="number"
                  min="0"
                  max={totalRoomsInput || homestay.total_rooms || 0}
                  value={availableRoomsInput}
                  onChange={(e) => setAvailableRoomsInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Update
              </button>
            </form>

            {homestay.google_map_iframe_link && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Google Map</p>
                <a
                  href={homestay.google_map_iframe_link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-blue-600 hover:underline"
                >
                  Open location in Google Maps
                </a>
              </div>
            )}
            {homestay.latitude && homestay.longitude && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <MapPin className="h-3.5 w-3.5" />
                {Number(homestay.latitude).toFixed(6)}, {Number(homestay.longitude).toFixed(6)}
              </div>
            )}
            {/* All images */}
            {hasImages && homestay.images.length > 1 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  All Photos ({homestay.images.length})
                </p>
                <div className="flex gap-2 flex-wrap">
                  {homestay.images.map((img) => (
                    <img
                      key={img.image_id}
                      src={`http://localhost:5000${img.image_path}`}
                      alt="Homestay"
                      className="h-16 w-16 object-cover rounded-lg border"
                    />
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-gray-400">
              Created: {new Date(homestay.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
          <button
            onClick={() => onEdit(homestay)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            onClick={() => onToggleActive(homestay.homestay_id)}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl transition-colors ${
              homestay.is_active
                ? "text-amber-600 bg-amber-50 hover:bg-amber-100"
                : "text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
            }`}
            title={homestay.is_active ? "Deactivate" : "Activate"}
          >
            {homestay.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => onDelete(homestay)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   HOST DASHBOARD
───────────────────────────────────────── */
const HostDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { handleLogout, handleStayLoggedIn, showLogoutModal, setShowLogoutModal } =
    useLogoutHandler();
  const { user: authUser, loading } = useAuth();

  const [homestays, setHomestays] = useState([]);
  const [trails, setTrails] = useState([]);
  const [homestaysLoading, setHomestaysLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingHomestay, setEditingHomestay] = useState(null);
  const [deletingHomestay, setDeletingHomestay] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);
  const [notification, setNotification] = useState(null);

  // Auth check
  useEffect(() => {
    if (loading) return;
    if (!getToken() || !authUser) { navigate("/login", { replace: true }); return; }
    if (authUser.user_type !== "host") { navigate("/login", { replace: true }); return; }
    setUser(authUser);
    setIsLoading(false);
  }, [loading, navigate, authUser]);

  // Show notification
  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Fetch homestays
  const fetchHomestays = useCallback(async () => {
    setHomestaysLoading(true);
    try {
      const res = await api.get(`${API}/homestays/my`);
      setHomestays(res.data.homestays);
    } catch (err) {
      console.error("Error fetching homestays:", err);
      showNotification("Failed to load homestays", "error");
    } finally {
      setHomestaysLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoading || !user) return;
    const interval = setInterval(() => {
      fetchHomestays();
    }, 15000);
    return () => clearInterval(interval);
  }, [isLoading, user, fetchHomestays]);

  // Fetch trails for dropdown
  const fetchTrails = useCallback(async () => {
    try {
      const res = await api.get(`${API}/homestays/trails`);
      setTrails(res.data.trails);
    } catch (err) {
      console.error("Error fetching trails:", err);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && user) {
      fetchHomestays();
      fetchTrails();
    }
  }, [isLoading, user, fetchHomestays, fetchTrails]);

  // Create homestay
  const handleCreate = async (formData) => {
    setIsSubmitting(true);
    try {
      await api.post(`${API}/homestays`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      showNotification("Homestay created! Sent for admin approval.");
      setShowCreateForm(false);
      fetchHomestays();
    } catch (err) {
      console.error("Error creating homestay:", err);
      showNotification(err.response?.data?.message || "Failed to create homestay", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update homestay
  const handleUpdate = async (formData) => {
    setIsSubmitting(true);
    try {
      await api.put(`${API}/homestays/${editingHomestay.homestay_id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      showNotification("Homestay updated! Status reset to pending review.");
      setEditingHomestay(null);
      fetchHomestays();
    } catch (err) {
      console.error("Error updating homestay:", err);
      showNotification(err.response?.data?.message || "Failed to update homestay", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete homestay
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.delete(`${API}/homestays/${deletingHomestay.homestay_id}`);
      showNotification("Homestay deleted successfully.");
      setDeletingHomestay(null);
      fetchHomestays();
    } catch (err) {
      console.error("Error deleting homestay:", err);
      showNotification(err.response?.data?.message || "Failed to delete homestay", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Toggle active
  const handleToggleActive = async (id) => {
    try {
      const res = await api.patch(
        `${API}/homestays/${id}/toggle-active`,
        {}
      );
      showNotification(res.data.message);
      fetchHomestays();
    } catch (err) {
      console.error("Error toggling status:", err);
      showNotification("Failed to toggle status", "error");
    }
  };

  const handleUpdateRooms = async (id, totalRoomsValue, availableRoomsValue) => {
    try {
      await api.patch(`${API}/homestays/${id}/rooms`, {
        total_rooms: Number(totalRoomsValue),
        available_rooms: Number(availableRoomsValue),
      });
      showNotification("Available rooms updated.");
      fetchHomestays();
    } catch (err) {
      console.error("Error updating rooms:", err);
      showNotification(err.response?.data?.message || "Failed to update available rooms", "error");
    }
  };

  // Stats
  const stats = {
    total: homestays.length,
    pending: homestays.filter((h) => h.verified_status === "pending").length,
    approved: homestays.filter((h) => h.verified_status === "approved").length,
    rejected: homestays.filter((h) => h.verified_status === "rejected").length,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
          <p className="text-gray-500 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Notification Toast */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-[100] px-5 py-3 rounded-xl shadow-lg text-sm font-semibold transition-all ${
            notification.type === "error"
              ? "bg-red-600 text-white"
              : "bg-emerald-600 text-white"
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Nav */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Home className="h-8 w-8 text-blue-600 mr-2" />
              <span className="text-xl font-bold text-gray-900">OffTrailNepal</span>
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                Host
              </span>
            </div>
            <button
              onClick={setShowLogoutModal}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-colors duration-300"
            >
              <LogOut className="h-5 w-5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Host Dashboard</h1>
            <p className="text-gray-500 mt-1">
              Welcome back, <span className="font-semibold text-gray-700">{user?.full_name || "Host"}</span>
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm hover:shadow transition-all"
          >
            <Plus className="h-5 w-5" />
            Add New Homestay
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Home} label="Total Listings" value={stats.total} accent="blue" />
          <StatCard icon={Clock} label="Pending Review" value={stats.pending} accent="amber" />
          <StatCard icon={CheckCircle} label="Approved" value={stats.approved} accent="emerald" />
          <StatCard icon={XCircle} label="Rejected" value={stats.rejected} accent="purple" />
        </div>

        {/* Homestay Listings */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">Your Homestay Listings</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage your properties and track their approval status
          </p>
        </div>

        {homestaysLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
        ) : homestays.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="mx-auto w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
              <Home className="h-10 w-10 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">No homestays yet</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Start by creating your first homestay listing. Once submitted, our admin team will
              review and approve it.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
            >
              <Plus className="h-5 w-5" />
              Create Your First Listing
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {homestays.map((homestay) => (
              <HomestayCard
                key={homestay.homestay_id}
                homestay={homestay}
                onEdit={setEditingHomestay}
                onDelete={setDeletingHomestay}
                onToggleActive={handleToggleActive}
                onUpdateRooms={handleUpdateRooms}
                expanded={expandedCard === homestay.homestay_id}
                onToggleExpand={(id) => setExpandedCard(expandedCard === id ? null : id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <HomestayForm
          trails={trails}
          onSubmit={handleCreate}
          onCancel={() => setShowCreateForm(false)}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Edit Form Modal */}
      {editingHomestay && (
        <HomestayForm
          trails={trails}
          onSubmit={handleUpdate}
          onCancel={() => setEditingHomestay(null)}
          initialData={editingHomestay}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingHomestay && (
        <DeleteModal
          homestayName={deletingHomestay.name}
          onConfirm={handleDelete}
          onCancel={() => setDeletingHomestay(null)}
          isDeleting={isDeleting}
        />
      )}

      {/* Logout Modal */}
      <LogoutModal
        isOpen={showLogoutModal}
        onConfirm={handleLogout}
        onCancel={handleStayLoggedIn}
      />
    </div>
  );
};

export default HostDashboard;
