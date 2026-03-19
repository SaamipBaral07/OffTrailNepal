import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Compass } from "lucide-react";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import LogoutModal from "../components/LogoutModal";
import { useAuth } from "../context/AuthContext";
import { getToken } from "../tokenStore";

const GuideDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { handleLogout, handleStayLoggedIn, showLogoutModal, setShowLogoutModal } = useLogoutHandler();
  const { user: authUser, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!getToken() || !authUser) {
      navigate("/login", { replace: true });
      return;
    }

    if (authUser.user_type !== "guide") {
      navigate("/login", { replace: true });
      return;
    }

    setUser(authUser);
    setIsLoading(false);
  }, [loading, navigate, authUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Brand Logo */}
            <div className="flex items-center">
              <Compass className="h-8 w-8 text-blue-600 mr-2" />
              <span className="text-xl font-bold text-gray-900">OffTrailNepal Guides</span>
            </div>

            {/* Logout Button */}
            <button
              onClick={setShowLogoutModal}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-colors duration-300"
            >
              <LogOut className="h-5 w-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Guide Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome back, {user?.full_name || "Guide"} 🧭</p>
        </div>

        {/* Guide Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { title: "Total Treks", value: "23", color: "bg-blue-500" },
            { title: "Active Bookings", value: "3", color: "bg-green-500" },
            { title: "Total Reviews", value: "156", color: "bg-yellow-500" },
            { title: "Rating", value: "4.9", color: "bg-purple-500" }
          ].map((stat, index) => (
            <div key={index} className="bg-white rounded-2xl shadow-sm border p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-xl`}>
                  <Compass className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Placeholder Content */}
        <div className="bg-white rounded-2xl shadow-sm border p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Treks</h2>
          <p className="text-gray-600">Manage your trek offerings, bookings, and build your reputation with travelers.</p>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <LogoutModal
        isOpen={showLogoutModal}
        onConfirm={handleLogout}
        onCancel={handleStayLoggedIn}
      />
    </div>
  );
};

export default GuideDashboard;
