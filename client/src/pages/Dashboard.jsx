// ╔═════════════════════════════════════════════════════════════════════════════════════════════════════╗
// ║                                   API CALLS IN THIS PAGE                                            ║
// ╠═════════════════════════════════════════════════════════════════════════════════════════════════════╣
// ║ No direct API requests are made in this dashboard wrapper component.                                ║
// ╚═════════════════════════════════════════════════════════════════════════════════════════════════════╝

import { useState, useEffect } from "react";
import { 
  LogOut, 
  User, 
  Search, 
  Filter,
  Heart,
  TrendingUp, 
  Mountain,
  Compass,
  Wallet,
  Bell,
  Settings,
  ChevronRight,
  Calendar,
  CheckCircle,
  Users
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

import { useLogoutHandler } from "../hooks/useLogoutHandler";
import LogoutModal from "../components/LogoutModal";
import { useAuth } from "../context/AuthContext";
import { getToken } from "../tokenStore";

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { handleLogout, handleStayLoggedIn, showLogoutModal, setShowLogoutModal } = useLogoutHandler();
  const { user: authUser, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!getToken() || !authUser) {
      navigate("/login", { replace: true });
      return;
    }

    if (authUser.user_type !== "tourist") {
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

  // Logged-in tourist dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Brand Logo */}
            <div className="flex items-center">
              <Mountain className="h-8 w-8 text-blue-600 mr-2" />
              <span className="text-xl font-bold text-gray-900">OffTrailNepal</span>
            </div>

            {/* Search Bar */}
            <div className="flex-1 max-w-2xl mx-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="search"
                  placeholder="Search trails, guides, or destinations..."
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <button className="relative p-2 text-gray-600 hover:text-gray-900">
                <Bell className="h-6 w-6" />
                <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
              </button>
              
              <div className="relative group">
                <button className="flex items-center space-x-2 focus:outline-none">
                  <div className="h-8 w-8 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {user.full_name?.charAt(0) || "U"}
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium text-gray-900">{user.full_name || "User"}</p>
                    <p className="text-xs text-gray-500 capitalize">Tourist</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:rotate-90 transition-transform" />
                </button>
                
                {/* Dropdown Menu */}
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border py-1 hidden group-hover:block z-50">
                  <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    Profile
                  </button>
                  <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </button>
                  <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center">
                    <Wallet className="h-4 w-4 mr-2" />
                    Billing
                  </button>
                  <div className="border-t my-1"></div>
                  <button
                    onClick={setShowLogoutModal}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Dashboard Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user.full_name?.split(" ")[0] || "Explorer"}! 👋
          </h1>
          <p className="text-gray-600 mt-2">
            Ready for your next adventure in the Himalayas?
          </p>
          
          {/* Role Badge */}
          <div className="mt-4 inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-blue-100 to-emerald-100 border border-blue-200">
            <div className="h-2 w-2 bg-blue-500 rounded-full mr-2"></div>
            <span className="text-sm font-medium text-blue-700">
              Tourist Explorer
            </span>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { title: "Upcoming Trips", value: "2", icon: Calendar, color: "bg-blue-500" },
            { title: "Completed Treks", value: "5", icon: CheckCircle, color: "bg-green-500" },
            { title: "Saved Trails", value: "8", icon: Heart, color: "bg-pink-500" },
            { title: "Local Guides", value: "12", icon: Users, color: "bg-purple-500" }
          ].map((stat, index) => (
            <div key={index} className="bg-white rounded-2xl shadow-sm border p-6 hover:shadow-md transition-shadow duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-xl`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center text-sm">
                  <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                  <span className="text-green-600">+12% from last month</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Browse Trails CTA */}
        <div className="mt-12 text-center">
          <Link
            to="/trails"
            className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-blue-600 to-emerald-600 text-white rounded-xl font-bold hover:opacity-90 transition"
          >
            <Compass className="mr-2 h-5 w-5" />
            Browse Available Trails
          </Link>
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

export default Dashboard;