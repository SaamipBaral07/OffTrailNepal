import axios from "axios";
import { getToken, setToken, getCsrfToken, setCsrfToken } from "./tokenStore";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";
const ACCOUNT_BLOCK_HINT_KEY = "offtrail_account_block_hint";

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // sends the HttpOnly refresh cookie automatically
});

// Request interceptor — attach in-memory access token & CSRF token
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Add CSRF token to all non-safe methods
  if (!["GET", "HEAD", "OPTIONS"].includes((config.method || "GET").toUpperCase())) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      config.headers["X-CSRF-Token"] = csrfToken;
    }
  }

  return config;
});

// Response interceptor — silently refresh on 401 TOKEN_EXPIRED
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      error.response?.data?.code === "TOKEN_EXPIRED" &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Cookie is sent automatically; add current CSRF token
        const csrfToken = getCsrfToken();
        const refreshConfig = {
          withCredentials: true,
          headers: {},
        };
        if (csrfToken) {
          refreshConfig.headers["X-CSRF-Token"] = csrfToken;
        }

        const res = await axios.post(
          `${API_BASE}/api/auth/refresh-token`,
          {},
          refreshConfig
        );

        const { token, csrfToken: newCsrfToken } = res.data;
        setToken(token);
        if (newCsrfToken) setCsrfToken(newCsrfToken);
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
        originalRequest.headers.Authorization = `Bearer ${token}`;
        if (newCsrfToken) {
          originalRequest.headers["X-CSRF-Token"] = newCsrfToken;
        }

        processQueue(null, token);
        return api(originalRequest);
      } catch (refreshError) {
        // Check for token replay detected
        if (
          refreshError.response?.status === 401 &&
          refreshError.response?.data?.code === "TOKEN_REUSE_DETECTED"
        ) {
          console.error("Token replay detected! All sessions revoked. Redirecting to login.");
          setToken(null);
          setCsrfToken(null);
          window.location.href = "/login";
        }

        if (
          refreshError.response?.status === 403 &&
          ["ACCOUNT_SUSPENDED"].includes(
            String(refreshError.response?.data?.code || "").trim().toUpperCase()
          )
        ) {
          window.sessionStorage.setItem(
            ACCOUNT_BLOCK_HINT_KEY,
            JSON.stringify({
              code: String(refreshError.response?.data?.code || "").trim().toUpperCase(),
              message: String(refreshError.response?.data?.message || "").trim(),
              reason: String(refreshError.response?.data?.reason || "").trim(),
            })
          );
          setToken(null);
          setCsrfToken(null);
          window.location.href = "/login";
        }

        processQueue(refreshError, null);
        setToken(null);
        setCsrfToken(null);
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
