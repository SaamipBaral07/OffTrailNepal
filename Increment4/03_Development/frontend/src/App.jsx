import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

import LandingPage from "./pages/LandingPage";
import TrailsPage from "./pages/TrailsPage";
import HomestaysPage from "./pages/HomestaysPage";
import GuidesPage from "./pages/GuidesPage";
import ContactUs from "./pages/ContactUs";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPassword from "./pages/ResetPassword";
import ForgotPassword from "./pages/ForgotPassword";
import TrailDetail from "./pages/TrailDetail";
import HomestayDetail from "./pages/HomestayDetail";
import MyBookings from "./pages/MyBookings";
import TouristProfile from "./pages/TouristProfile";
import TouristSettings from "./pages/TouristSettings";
import AIAssistant from "./pages/AIAssistant";
import WishlistPage from "./pages/WishlistPage";
import HostProfile from "./pages/HostProfile";
import GuideProfile from "./pages/GuideProfile";

import HostDashboard from "./pages/HostDashboard";
import GuideDashboard from "./pages/GuideDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AdminProfile from "./pages/AdminProfile";
import AdminAnalytics from "./pages/AdminAnalytics";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentFailed from "./pages/PaymentFailed";
import InvoicePage from "./pages/InvoicePage";
import Chats from "./pages/Chats";
import NotFound from "./pages/NotFound";

import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* Landing Page - visible to all users */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/trails" element={<TrailsPage />} />
          <Route path="/homestays" element={<HomestaysPage />} />
          <Route path="/guides" element={<GuidesPage />} />
          <Route path="/contact" element={<ContactUs />} />

          {/* Trail Detail - public */}
          <Route path="/trails/:id" element={<TrailDetail />} />
          <Route path="/homestays/:id" element={<HomestayDetail />} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/payment/failed" element={<PaymentFailed />} />

          {/* Auth pages */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* Password reset */}
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Host Dashboard */}
          <Route
            path="/host-dashboard"
            element={
              <ProtectedRoute allowedRoles={["host"]}>
                <HostDashboard />
              </ProtectedRoute>
            }
          />

          {/* Tourist Bookings */}
          <Route
            path="/my-bookings"
            element={
              <ProtectedRoute allowedRoles={["tourist"]}>
                <MyBookings />
              </ProtectedRoute>
            }
          />

          <Route
            path="/invoice/:bookingType/:bookingId"
            element={
              <ProtectedRoute allowedRoles={["tourist"]}>
                <InvoicePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/chats"
            element={
              <ProtectedRoute allowedRoles={["tourist", "guide"]}>
                <Chats />
              </ProtectedRoute>
            }
          />

          <Route
            path="/my-profile"
            element={
              <ProtectedRoute allowedRoles={["tourist"]}>
                <TouristProfile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/my-settings"
            element={
              <ProtectedRoute allowedRoles={["tourist"]}>
                <TouristSettings />
              </ProtectedRoute>
            }
          />

          <Route
            path="/wishlist"
            element={
              <ProtectedRoute allowedRoles={["tourist"]}>
                <WishlistPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/ai-assistant"
            element={
              <ProtectedRoute allowedRoles={["tourist"]}>
                <AIAssistant />
              </ProtectedRoute>
            }
          />

          <Route
            path="/host-profile"
            element={
              <ProtectedRoute allowedRoles={["host"]}>
                <HostProfile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/guide-profile"
            element={
              <ProtectedRoute allowedRoles={["guide"]}>
                <GuideProfile />
              </ProtectedRoute>
            }
          />

          {/* Guide Dashboard */}
          <Route
            path="/guide-dashboard"
            element={
              <ProtectedRoute allowedRoles={["guide"]}>
                <GuideDashboard />
              </ProtectedRoute>
            }
          />

          {/* Admin Dashboard */}
          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin-profile"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminProfile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin-analytics"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminAnalytics />
              </ProtectedRoute>
            }
          />

          {/* Catch all - show 404 page */}
          <Route path="*" element={<NotFound />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
