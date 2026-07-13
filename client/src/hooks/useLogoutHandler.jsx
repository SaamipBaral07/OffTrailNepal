import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { getCsrfToken } from "../tokenStore";

export const useLogoutHandler = () => {
  const navigate = useNavigate();
  const { clearAuth } = useAuth();
  const [showLogoutModal, setShowLogoutModalState] = useState(false);
  const modalTriggeredRef = useRef(false); // ensures only first back shows modal
  const showLogoutModalRef = useRef(false); // track if modal is currently open

  // Keep ref in sync with state
  useEffect(() => {
    showLogoutModalRef.current = showLogoutModal;
  }, [showLogoutModal]);

  // Accept both setter-style calls (true/false) and button handlers (event arg).
  const setShowLogoutModal = (value = true) => {
    const nextVisible = typeof value === "boolean" ? value : true;
    setShowLogoutModalState(nextVisible);
    showLogoutModalRef.current = nextVisible;
    modalTriggeredRef.current = nextVisible;
  };

  const doLogout = () => {
    // Cookie sent automatically; server revokes it from DB and clears it
    const csrfToken = getCsrfToken();
    const config = { withCredentials: true };
    if (csrfToken) {
      config.headers = { "X-CSRF-Token": csrfToken };
    }
    const API_BASE = process.env.REACT_APP_API_URL || (process.env.REACT_APP_API_URL || (process.env.REACT_APP_API_URL || "http://localhost:5000") + "");
    axios.post(`${API_BASE}/api/auth/logout`, {}, config).catch(() => {});
    clearAuth();
  };

  // Handle logout (via logout button OR second back click)
  const handleLogout = () => {
    doLogout();
    setShowLogoutModal(false);
    navigate("/", { replace: true });
  };

  // Handle canceling logout (staying logged in) - resets modal trigger
  const handleStayLoggedIn = () => {
    setShowLogoutModal(false);
    // Re-lock the history state after closing the modal
    window.history.pushState({ isDashboard: true }, "", window.location.pathname);
  };

  // Handle opening logout modal (from button click)
  const openLogoutModal = () => {
    setShowLogoutModal(true);
  };

  // Prevent back button navigation - block navigation entirely and show modal once
  useEffect(() => {
    // Seed history with MANY blocking entries to create a large buffer
    // This prevents users from escaping the app via back button in new tabs
    for (let i = 0; i < 20; i++) {
      window.history.pushState({ isDashboard: true }, "", window.location.pathname);
    }

    const handlePopState = () => {
      // CRITICAL: Push state FIRST to prevent browser from escaping app
      // This must happen before any other logic
      window.history.pushState({ isDashboard: true }, "", window.location.pathname);

      // If modal is already open (second back click), logout and go home
      if (showLogoutModalRef.current) {
        // IMMEDIATELY clear auth (synchronous, no setTimeout)
        doLogout();

        // Update refs
        setShowLogoutModal(false);

        // Navigate after clearing auth
        navigate("/", { replace: true });
        return;
      }

      if (!modalTriggeredRef.current) {
        // First back click: show modal
        setShowLogoutModal(true);
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  return {
    handleLogout,
    handleStayLoggedIn,
    showLogoutModal,
    setShowLogoutModal,
    openLogoutModal,
  };
};
