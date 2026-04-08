import { createContext, useContext, useState, useEffect, useRef } from "react";
import axios from "axios";
import { setToken, setCsrfToken } from "../tokenStore";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  // On page load:
  // 1. Fetch a fresh CSRF token
  // 2. Attempt a silent refresh using the HttpOnly cookie
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initAuth = async () => {
      try {
        // Fetch CSRF token first
        const csrfRes = await axios.get("http://localhost:5000/api/auth/csrf-token", {
          withCredentials: true,
        });
        setCsrfToken(csrfRes.data.csrfToken);

        // Then attempt silent refresh
        const res = await axios.post(
          "http://localhost:5000/api/auth/refresh-token",
          {},
          {
            withCredentials: true,
            headers: {
              "X-CSRF-Token": csrfRes.data.csrfToken,
            },
          }
        );

        setToken(res.data.token);
        setCsrfToken(res.data.csrfToken); // Update with new CSRF token from refresh
        setUser(res.data.user);
      } catch (error) {
        // Silent refresh failed - user likely not logged in
        setToken(null);
        setCsrfToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const setAuth = (token, userData, csrfToken) => {
    setToken(token);
    setUser(userData);
    if (csrfToken) setCsrfToken(csrfToken);
  };

  const clearAuth = () => {
    setToken(null);
    setCsrfToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, setAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
