import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getToken } from "../tokenStore";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!getToken()) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.user_type)) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
